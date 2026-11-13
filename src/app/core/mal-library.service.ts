import {Injectable,computed,signal} from '@angular/core';
import {MalService} from './mal.service';
import {MalPublicService} from './mal-public.service';
import {StorageService} from './storage.service';
import {Anime} from './models';
import {MalRow,MalListFilters,summarizeMal} from './mal-library';
@Injectable({providedIn:'root'})
export class MalLibraryService {
 readonly preferred=signal<'auto'|'account'|'public'>('auto');readonly error=signal('');
 readonly view=signal<'dashboard'|'list'>('dashboard');readonly page=signal(0);
 readonly filters=signal<MalListFilters>({query:'',status:'',type:'',genres:[],watch:'seen',order:'title'});
 readonly available=computed(()=>this.mal.connected||!!this.publicMal.username());
 readonly source=computed(()=>this.preferred()==='public'&&this.publicMal.username()?'public':this.preferred()==='account'&&this.mal.connected?'account':this.mal.connected?'account':this.publicMal.username()?'public':null);
 readonly username=computed(()=>this.source()==='account'?this.mal.rememberedUser:this.source()==='public'?this.publicMal.username():'');
 readonly entries=computed(()=>this.source()==='account'?this.mal.entries():this.source()==='public'?this.publicMal.entries():{});
 readonly rows=computed<MalRow[]>(()=>Object.entries(this.entries()).map(([id,entry])=>({...entry,id:Number(id),title:entry.anime?.title||'Anime MAL #'+id})));
 readonly stats=computed(()=>summarizeMal(this.rows()));
 readonly loading=computed(()=>this.source()==='account'?this.mal.syncing():this.publicMal.loading());
 constructor(readonly mal:MalService,readonly publicMal:MalPublicService,private storage:StorageService){}
 async refresh(){this.error.set('');try{if(this.source()==='account')await this.mal.sync();else if(this.source()==='public'){await this.publicMal.importUsername(this.publicMal.username());this.error.set(this.publicMal.error());}}catch(error){this.error.set(error instanceof Error?error.message:'Aggiornamento della lista non riuscito.');}}
 progress(anime:Anime){
  const entries=this.source()?this.entries():this.mal.entries();const entry=entries[String(anime.mal_id)];const malWatched=entry?.watched||0;
  const local=new Set<number>();
  for(const row of Object.values(this.storage.watchEvents()||{}))if((Number(anime.mal_id)>0&&Number(row.malId)===Number(anime.mal_id))||String(row.animeId)===String(anime.id)){const n=Number(row.number);if(n>0)local.add(n);}
  for(const row of Object.values(this.storage.history()||{}))if(row.completed&&((Number(anime.mal_id)>0&&Number(row.anime.mal_id)===Number(anime.mal_id))||String(row.anime.id)===String(anime.id))){const n=Number(row.episode.malNumber??row.episode.number);if(n>0)local.add(n);}
  const watched=malWatched+[...local].filter(n=>n>malWatched).length;
  const total=Number(anime.episodes_count)||Number(anime.real_episodes_count)||entry?.total||0;
  return {watched,total,remaining:Math.max(0,total-watched)};
 }
 progressKey(){return JSON.stringify([this.source(),Object.entries(this.source()?this.entries():this.mal.entries()).map(([id,e])=>[id,e.watched,e.total]),this.storage.watchEvents(),Object.values(this.storage.history()||{}).filter(h=>h.completed).map(h=>[h.anime.id,h.anime.mal_id,h.episode.number])]);}
}
