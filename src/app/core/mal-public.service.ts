import {Injectable,signal} from '@angular/core';
import {StorageService} from './storage.service';
import {Anime,Episode} from './models';
import {MalEntry,MAL_PUBLIC_CLIENT_ID} from './mal.service';
import {MAL_LIST_FIELDS,parseMalEntry} from './mal-library';
const API='https://api.myanimelist.net/v2';
@Injectable({providedIn:'root'})
export class MalPublicService {
 private saved=this.local.read<any>('malPublicData',null);
 readonly username=signal<string>(this.saved?.username||'');
 readonly entries=signal<Record<string,MalEntry>>(this.saved?.entries||{});
 readonly syncedAt=signal<number>(this.saved?.syncedAt||0);
 readonly loading=signal(false);readonly status=signal('');readonly error=signal('');
 private generation=0;
 constructor(private local:StorageService){}
 get count(){return Object.keys(this.entries()).length;}
 isSeen(anime:Anime,episode:Episode){const watched=this.entries()[String(anime.mal_id)]?.watched||0;return Number(episode.malNumber??episode.number)>0&&Number(episode.malNumber??episode.number)<=watched;}
 updateKnownProgress(username:string,id:number,watched:number,total:number,status:string){if(this.username().toLowerCase()!==username.toLowerCase()||!this.entries()[String(id)])return;const entries={...this.entries(),[String(id)]:{...this.entries()[String(id)],watched,total,status}};this.entries.set(entries);this.local.write('malPublicData',{username:this.username(),entries,syncedAt:this.syncedAt()});}
 clearDownloaded(){this.generation++;this.entries.set({});this.syncedAt.set(0);this.loading.set(false);this.error.set('');this.local.write('malPublicData',{username:this.username(),entries:{},syncedAt:0});this.status.set('Dati scaricati eliminati. Username ricordato: premi Allinea i visti per scaricarli di nuovo.');}
 clear(){this.generation++;this.username.set('');this.entries.set({});this.syncedAt.set(0);this.loading.set(false);this.error.set('');this.status.set('Allineamento da username rimosso.');this.local.write('malPublicData',null);}
 async importUsername(value:string){
  const username=value.trim();if(!/^[a-zA-Z0-9_-]{1,32}$/.test(username)){this.error.set('Inserisci uno username MAL valido, non l’indirizzo del profilo.');return;}
  const generation=++this.generation;this.loading.set(true);this.error.set('');this.status.set('Lettura della lista pubblica…');
  try{
   const entries:Record<string,MalEntry>={};let offset=0,complete=false;
   for(let page=0;page<100;page++){
    const path='/users/'+encodeURIComponent(username)+'/animelist';
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);let data:any;
    try{const response=await fetch(API+path+'?'+new URLSearchParams({fields:MAL_LIST_FIELDS,limit:'1000',offset:String(offset),nsfw:'true'}),{headers:{'X-MAL-CLIENT-ID':MAL_PUBLIC_CLIENT_ID},credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal});
     if(response.status===403)throw Error('MAL non permette di leggere la lista: verifica che sia pubblica oppure riprova più tardi.');
     if(response.status===404)throw Error('Profilo MAL non trovato. Controlla lo username.');
     if(!response.ok)throw Error('Lista pubblica MAL: HTTP '+response.status);data=await response.json();
    }finally{clearTimeout(timer);}
    if(generation!==this.generation)return;
    if(!Array.isArray(data.data))throw Error('Lista pubblica MAL non riconosciuta.');
    for(const item of data.data){const id=Number(item?.node?.id),s=item?.list_status;if(id>0&&s)entries[String(id)]=parseMalEntry(item);}
    if(!data.paging?.next){complete=true;break;}
    const next=new URL(data.paging.next),nextOffset=Number(next.searchParams.get('offset'));
    if(next.origin!==new URL(API).origin||next.pathname!==new URL(API+path).pathname||!Number.isInteger(nextOffset)||nextOffset<=offset)throw Error('Paginazione della lista pubblica non valida.');offset=nextOffset;
   }
   if(!complete)throw Error('Importazione incompleta: riprova.');
   const syncedAt=Date.now();if(!this.local.write('malPublicData',{username,entries,syncedAt}))throw Error('Impossibile salvare la lista sulla TV.');
   this.username.set(username);this.entries.set(entries);this.syncedAt.set(syncedAt);this.status.set('Allineati '+Object.keys(entries).length+' anime di '+username+'.');
  }catch(error){if(generation===this.generation){this.error.set(error instanceof Error?error.message:'Impossibile leggere la lista pubblica dalla TV.');this.status.set('Allineamento non completato.');}}
  finally{if(generation===this.generation)this.loading.set(false);}
 }
}
