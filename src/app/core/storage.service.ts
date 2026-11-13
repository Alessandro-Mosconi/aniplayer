import {Injectable, signal} from '@angular/core';
import {Anime,Episode,SavedProgress} from './models';
export type BadgeKind='audio'|'newEpisodes'|'allSeen'|'favorites'|'aniskip'|'malStatus'|'menuUpdates';
const BADGE_DEFAULTS:Record<BadgeKind,boolean>={audio:true,newEpisodes:true,allSeen:true,favorites:true,aniskip:false,malStatus:true,menuUpdates:true};
@Injectable({providedIn:'root'})
export class StorageService {
 private prefix='autv.'; // Preserva la compatibilità dei dati originali.
 read<T>(key:string,fallback:T):T{try{const raw=localStorage.getItem(this.prefix+key);return raw===null?fallback:JSON.parse(raw) as T;}catch{return fallback;}}
 write<T>(key:string,value:T):boolean{try{localStorage.setItem(this.prefix+key,JSON.stringify(value));return true;}catch{return false;}}
 readonly favorites=signal<Record<string,Anime>>(this.read('favorites',{}));
 readonly history=signal<Record<string,SavedProgress>>(this.read('history',{}));
 readonly seen=signal<Record<string,number>>(this.read('seen',{}));
 readonly settings=signal<Record<string,any>>({...{autonext:true,engine:'auto',resume:true,introDetection:true,introPrefetch:true,exploreEnabled:false},...this.read('settings',{})});
 readonly watchEvents=signal<Record<string,{at:number;malId:number|null;number:string;animeId:string|number}>>(this.read('watchEvents',{}));
 readonly watchCoverage=signal<Record<string,any>>(this.read('watchCoverage',{}));
 readonly seenResets=signal<Record<string,{from:number;to:number|null;at:number}[]>>(this.read('seenResets',{})||{});
 toggleFavorite(anime:Anime){const next={...this.favorites()};if(next[String(anime.id)])delete next[String(anime.id)];else next[String(anime.id)]={...anime};this.favorites.set(next);this.write('favorites',next);}
 isFavorite(anime:Anime){return !!this.favorites()[String(anime.id)];}
 removeFromHistory(anime:Anime){const next={...this.history()};for(const [key,row] of Object.entries(next))if(String(row.anime.id)===String(anime.id)||Number(anime.mal_id)>0&&Number(row.anime.mal_id)===Number(anime.mal_id))delete next[key];if(!this.write('history',next))throw Error('Impossibile aggiornare Continua a guardare.');this.history.set(next);}
 setSetting(key:string,value:any){const next={...this.settings(),[key]:value};this.settings.set(next);this.write('settings',next);}
 badgeEnabled(kind:BadgeKind){const value=this.settings()['badges']?.[kind];return typeof value==='boolean'?value:BADGE_DEFAULTS[kind];}
 setBadgeEnabled(kind:BadgeKind,enabled:boolean){const previous=this.settings()['badges'];this.setSetting('badges',{...(previous&&typeof previous==='object'&&!Array.isArray(previous)?previous:{}),[kind]:enabled});}
 watchKey(anime:Anime,episode:Episode){return (Number(anime.mal_id)>0?'mal:'+anime.mal_id:'anime:'+anime.id)+':'+episode.number;}
 private seriesKey(anime:Anime){return Number(anime.mal_id)>0?'mal:'+anime.mal_id:'anime:'+anime.id;}
 private resetAt(anime:Anime,number:number){return Math.max(0,...(this.seenResets()[this.seriesKey(anime)]||[]).filter(r=>number>=r.from&&(r.to===null||number<=r.to)).map(r=>r.at));}
 isSeen(anime:Anime,episode:Episode){const reset=this.resetAt(anime,Number(episode.number)),at=Math.max(Number(this.seen()[String(episode.id)])||0,Number(this.watchEvents()[this.watchKey(anime,episode)]?.at)||0);return at>reset;}
 markSeen(anime:Anime,episode:Episode,seen=true){if(!seen){this.clearSeen(anime,Number(episode.number),Number(episode.number),[episode]);return;}const next={...this.seen()},events={...this.watchEvents()},key=this.watchKey(anime,episode);const at=Math.max(Date.now(),this.resetAt(anime,Number(episode.number))+1);next[String(episode.id)]=at;events[key]={at,malId:Number(anime.mal_id)||null,number:String(episode.number),animeId:anime.id};this.seen.set(next);this.watchEvents.set(events);this.write('seen',next);this.write('watchEvents',events);}
 clearSeenFrom(anime:Anime,from:number,episodes:Episode[]=[]){this.clearSeen(anime,from,null,episodes);}
 private clearSeen(anime:Anime,from:number,to:number|null,episodes:Episode[]){
  const key=this.seriesKey(anime),at=Date.now(),resets={...this.seenResets(),[key]:[...(this.seenResets()[key]||[]),{from,to,at}]};this.seenResets.set(resets);this.write('seenResets',resets);
  const matches=(number:number)=>number>=from&&(to===null||number<=to),same=(a:Anime)=>Number(anime.mal_id)>0&&Number(a.mal_id)===Number(anime.mal_id)||String(a.id)===String(anime.id);
  const seen={...this.seen()},events={...this.watchEvents()},coverage={...this.watchCoverage()},history={...this.history()};
  for(const episode of episodes)if(matches(Number(episode.number)))delete seen[String(episode.id)];
  for(const [id,event] of Object.entries(events))if((Number(anime.mal_id)>0&&Number(event.malId)===Number(anime.mal_id)||String(event.animeId)===String(anime.id))&&matches(Number(event.number)))delete events[id];
  for(const id of Object.keys(coverage))if(id.startsWith(key+':')&&matches(Number(id.slice(key.length+1))))delete coverage[id];
  for(const [id,row] of Object.entries(history))if(same(row.anime)&&matches(Number(row.episode.number)))history[id]={...row,completed:false,position:0,updated:at};
  this.seen.set(seen);this.watchEvents.set(events);this.watchCoverage.set(coverage);this.history.set(history);for(const [name,value]of Object.entries({seen,watchEvents:events,watchCoverage:coverage,history}))this.write(name,value);
 }
 progress(anime:Anime,episode:Episode,position:number,duration:number,completed=false){if(!Number.isFinite(position)||position<0)return;const old=this.history();const next={...old,[String(anime.id)]:{anime,episode,position:Math.floor(position),duration,completed:completed||this.isSeen(anime,episode),updated:Date.now()}};const keys=Object.keys(next).sort((a,b)=>next[b].updated-next[a].updated);for(const key of keys.slice(100))delete next[key];this.history.set(next);this.write('history',next);if(completed)this.markSeen(anime,episode);}
}

