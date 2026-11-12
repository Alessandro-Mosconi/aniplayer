import {Component,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PageBase} from '../../core/page-base';
import {cleanError} from '../../core/models';
import {FormsModule} from '@angular/forms';
import {PublicService,ServiceEndpointsService} from '../../core/service-endpoints.service';

type ServiceKey='unity'|'world'|'aniskip'|'anilist'|'mal';
type ServiceResult={ok:boolean;text:string};
@Component({selector:'app-diagnostics-page',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./diagnostics.page.html',styleUrl:'./diagnostics.page.scss'})
export class DiagnosticsPage extends PageBase {
 readonly endpoints=inject(ServiceEndpointsService);
 readonly draft=signal<Record<Exclude<ServiceKey,'mal'>,string>>({unity:this.catalog.domain(),world:this.animeworld.domain(),aniskip:this.endpoints.origin('aniskip'),anilist:this.endpoints.origin('anilist')});
 readonly busy=signal<ServiceKey|null>(null);
 readonly results=signal<Partial<Record<ServiceKey,ServiceResult>>>({});
 readonly services=[
  {key:'unity',name:'AnimeUnity',purpose:'Catalogo e aggiornamenti',editable:true},
  {key:'world',name:'AnimeWorld',purpose:'Episodi e sorgenti video',editable:true},
  {key:'aniskip',name:'AniSkip',purpose:'Intervalli delle sigle',editable:true},
  {key:'anilist',name:'AniList',purpose:'Date e copertine',editable:true},
  {key:'mal',name:'MyAnimeList',purpose:'Liste e progressi',editable:false}
 ] as const;
 setDraft(key:Exclude<ServiceKey,'mal'>,value:string){this.draft.update(d=>({...d,[key]:value}));this.results.update(r=>{const next={...r};delete next[key];return next;});}
 private result(key:ServiceKey,ok:boolean,text:string){this.results.update(r=>({...r,[key]:{ok,text}}));}
 async test(key:ServiceKey){
  if(this.busy())return;this.busy.set(key);this.results.update(r=>{const next={...r};delete next[key];return next;});
  try{
   if(key==='unity')await this.catalog.session();
   else if(key==='world'){if(!await this.animeworld.checkConnection())throw Error(this.animeworld.connectionError()||'Servizio non raggiungibile.');}
   else if(key==='mal')await this.testMal();
   else await this.endpoints.probe(key as PublicService,this.draft()[key as PublicService]);
   this.result(key,true,key==='unity'||key==='world'?'Connessione attuale verificata.':'Servizio raggiungibile.');
  }catch(error){this.result(key,false,cleanError(error));}
  finally{this.busy.set(null);}
 }
 async save(key:Exclude<ServiceKey,'mal'>){
  if(this.busy())return;this.busy.set(key);this.results.update(r=>{const next={...r};delete next[key];return next;});
  try{
   const value=this.draft()[key];
   if(key==='unity'){await this.catalog.setDomain(value);this.domainField.set(this.catalog.domain());this.setDraft(key,this.catalog.domain());}
   else if(key==='world'){await this.animeworld.setDomain(value);this.setDraft(key,this.animeworld.domain());}
   else {await this.endpoints.save(key,value);this.setDraft(key,this.endpoints.origin(key));}
   this.result(key,true,'Indirizzo verificato e salvato.');
  }catch(error){this.result(key,false,cleanError(error));}
  finally{this.busy.set(null);}
 }
 private async testMal(){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{const response=await fetch('https://api.myanimelist.net/v2/anime/1?fields=id',{headers:{'X-MAL-CLIENT-ID':this.mal.clientId()},credentials:'omit',redirect:'error',signal:controller.signal});if(!response.ok)throw Error('MyAnimeList HTTP '+response.status);if(response.url&&new URL(response.url).origin!=='https://api.myanimelist.net')throw Error('Risposta da un dominio inatteso.');const data=await response.json();if(Number(data.id)!==1)throw Error('Risposta MyAnimeList non riconosciuta.');}
  finally{clearTimeout(timer);}
 }
 openMal(){this.nav.open('mal',{filters:{malMode:'account'}});}
}
