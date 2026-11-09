import {Injectable} from '@angular/core';
import {StorageService} from './storage.service';
import {MalService} from './mal.service';
import {Anime,Episode} from './models';
import {MalPublicService} from './mal-public.service';
@Injectable({providedIn:'root'})
export class LibraryService {
 constructor(readonly storage:StorageService,readonly mal:MalService,readonly publicMal:MalPublicService){}
 isSeen(anime:Anime,episode:Episode){const remote=this.mal.connected?this.mal.isSeen(anime,episode):this.publicMal.username()?this.publicMal.isSeen(anime,episode):this.mal.isSeen(anime,episode);return this.storage.isSeen(anime,episode)||remote;}
 async mark(anime:Anime,episode:Episode,value:boolean,episodes:Episode[]=[]){
  if(this.mal.connected&&Number(anime.mal_id)>0&&Number.isInteger(Number(episode.number))){
   const watched=await this.mal.setEpisodeSeen(anime,episode,value),entry=this.mal.entries()[String(anime.mal_id)];
   if(value)this.storage.markSeen(anime,episode,true);else this.storage.clearSeenFrom(anime,Number(episode.number),episodes);
   this.publicMal.updateKnownProgress(this.mal.rememberedUser,Number(anime.mal_id),watched,entry?.total||0,entry?.status||'watching');return;
  }
  if(!value&&(this.publicMal.isSeen(anime,episode)||this.mal.isSeen(anime,episode)))throw Error('La lista importata è in sola lettura. Riconnetti o collega l’account MAL per modificarla.');
  this.storage.markSeen(anime,episode,value);
 }
}
