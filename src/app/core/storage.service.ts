import {Injectable, signal} from '@angular/core';
import {Anime,Episode,SavedProgress} from './models';
import {DEFAULT_PROFILE,DICEBEAR_AVATAR,PROFILE_KEYS,Profile,AvatarInfo,profileKey,profileName} from './profiles';
export type BadgeKind='audio'|'newEpisodes'|'allSeen'|'favorites'|'aniskip'|'malStatus'|'menuUpdates';
const BADGE_DEFAULTS:Record<BadgeKind,boolean>={audio:true,newEpisodes:true,allSeen:true,favorites:true,aniskip:false,malStatus:true,menuUpdates:true};
@Injectable({providedIn:'root'})
export class StorageService {
 private prefix='autv.'; // Preserva la compatibilità dei dati originali.
 private rawRead<T>(key:string,fallback:T):T{try{const raw=localStorage.getItem(this.prefix+key);return raw===null?fallback:JSON.parse(raw) as T;}catch{return fallback;}}
 readonly profiles=signal<Profile[]>(this.rawRead<Profile[]>('profiles',[{...DEFAULT_PROFILE}]));
 // Keep this instance bound to its original profile until reload: pending async work
 // must never write into the newly selected profile.
 readonly profileId=this.profiles().find(p=>p.id===this.rawRead('activeProfile','default'))?.id||this.profiles()[0]?.id||'default';
 private deletedProfile=false;
 read<T>(key:string,fallback:T):T{return this.rawRead(profileKey(this.profileId,key),fallback);}
 write<T>(key:string,value:T):boolean{if(this.deletedProfile&&PROFILE_KEYS.has(key))return false;try{localStorage.setItem(this.prefix+profileKey(this.profileId,key),JSON.stringify(value));return true;}catch{return false;}}
 currentProfile(){return this.profiles().find(p=>p.id===this.profileId)||DEFAULT_PROFILE;}
 saveProfile(name:string,avatar:string,id?:string,avatarInfo?:AvatarInfo){
  const profiles=this.profiles(),value=profileName(name,profiles,id);
  if(id&&!profiles.some(p=>p.id===id))throw Error('Profilo non trovato.');
  if(!DICEBEAR_AVATAR.test(avatar)&&!/^generated:(?:[0-9]|1[01])$/.test(avatar)&&!/^https:\/\/cdn\.myanimelist\.net\//.test(avatar)&&!/^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/character\/[^?#\s]+$/.test(avatar))throw Error('Immagine profilo non valida.');
  const old=profiles.find(p=>p.id===id);const info=avatarInfo||(old?.avatar===avatar?old.avatarInfo:undefined);
  const profile:Profile={id:id||Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join(''),name:value,avatar,...(info?{avatarInfo:info}:{})};
  const next=id?profiles.map(p=>p.id===id?profile:p):[...profiles,profile];
  if(!this.write('profiles',next))throw Error('Impossibile salvare il profilo. Spazio locale insufficiente.');
  this.profiles.set(next);return profile;
 }
 // Angular can normalize the packaged entry URL to a directory. TV engines
 // cannot reload that directory: always reopen the actual application document.
 private restartApp(){window.location.replace(new URL('index.html',document.baseURI).href);}
 selectProfile(id:string){if(!this.profiles().some(p=>p.id===id))throw Error('Profilo non trovato.');if(id===this.profileId)return;if(!this.write('activeProfile',id))throw Error('Impossibile cambiare profilo.');this.restartApp();}
 deleteProfile(id:string){
  const profiles=this.profiles();if(!profiles.some(p=>p.id===id))throw Error('Profilo non trovato.');
  if(profiles.length<=1)throw Error('Deve rimanere almeno un profilo.');
  const next=profiles.filter(p=>p.id!==id),active=id===this.profileId;
  if(!this.write('profiles',next))throw Error('Impossibile eliminare il profilo.');
  this.profiles.set(next);if(active)this.deletedProfile=true;
  let cleanupFailed=false;
  for(const key of [...PROFILE_KEYS].map(key=>profileKey(id,key)).concat('avatarStyleFavorites.'+id,'avatarAnimeFavorites.'+id))try{localStorage.removeItem(this.prefix+key);}catch{cleanupFailed=true;}
  if(active){this.write('activeProfile',next[0].id);this.restartApp();}
  return !cleanupFailed;
 }
 readonly favorites=signal<Record<string,Anime>>(this.read('favorites',{}));
 readonly history=signal<Record<string,SavedProgress>>(this.read('history',{}));
 readonly hiddenFromContinue=signal<Record<string,boolean>>(this.read('hiddenFromContinue',{}));
 readonly seen=signal<Record<string,number>>(this.read('seen',{}));
 readonly settings=signal<Record<string,any>>({...{autonext:true,engine:'auto',resume:true,historyEnabled:true,introDetection:true,introPrefetch:true,exploreEnabled:false},...this.read('settings',{})});
 readonly watchEvents=signal<Record<string,{at:number;malId:number|null;number:string;animeId:string|number}>>(this.read('watchEvents',{}));
 readonly watchCoverage=signal<Record<string,any>>(this.read('watchCoverage',{}));
 readonly seenResets=signal<Record<string,{from:number;to:number|null;at:number}[]>>(this.read('seenResets',{})||{});
 toggleFavorite(anime:Anime){const next={...this.favorites()};if(next[String(anime.id)])delete next[String(anime.id)];else next[String(anime.id)]={...anime};this.favorites.set(next);this.write('favorites',next);}
 isFavorite(anime:Anime){return !!this.favorites()[String(anime.id)];}
 hideFromContinue(anime:Anime){const hidden={...this.hiddenFromContinue()};for(const row of Object.values(this.history()))if(String(row.anime.id)===String(anime.id)||Number(anime.mal_id)>0&&Number(row.anime.mal_id)===Number(anime.mal_id))hidden[String(row.anime.id)]=true;if(!this.write('hiddenFromContinue',hidden))throw Error('Impossibile aggiornare Continua a guardare.');this.hiddenFromContinue.set(hidden);}
 removeFromHistory(anime:Anime){const next={...this.history()},hidden={...this.hiddenFromContinue()};let hiddenChanged=false;for(const [key,row] of Object.entries(next))if(String(row.anime.id)===String(anime.id)||Number(anime.mal_id)>0&&Number(row.anime.mal_id)===Number(anime.mal_id)){delete next[key];if(hidden[key]){delete hidden[key];hiddenChanged=true;}}if(!this.write('history',next))throw Error('Impossibile aggiornare la cronologia.');this.history.set(next);if(hiddenChanged&&this.write('hiddenFromContinue',hidden))this.hiddenFromContinue.set(hidden);}
 setSetting(key:string,value:any){const next={...this.settings(),[key]:value};this.settings.set(next);this.write('settings',next);}
 badgeEnabled(kind:BadgeKind){const value=this.settings()['badges']?.[kind];return typeof value==='boolean'?value:BADGE_DEFAULTS[kind];}
 setBadgeEnabled(kind:BadgeKind,enabled:boolean){const previous=this.settings()['badges'];this.setSetting('badges',{...(previous&&typeof previous==='object'&&!Array.isArray(previous)?previous:{}),[kind]:enabled});}
 watchKey(anime:Anime,episode:Episode){return (Number(anime.mal_id)>0?'mal:'+anime.mal_id:'anime:'+anime.id)+':'+(episode.malNumber??episode.number);}
 private seriesKey(anime:Anime){return Number(anime.mal_id)>0?'mal:'+anime.mal_id:'anime:'+anime.id;}
 private resetAt(anime:Anime,number:number){return Math.max(0,...(this.seenResets()[this.seriesKey(anime)]||[]).filter(r=>number>=r.from&&(r.to===null||number<=r.to)).map(r=>r.at));}
 isSeen(anime:Anime,episode:Episode){const reset=this.resetAt(anime,Number(episode.malNumber??episode.number)),at=Math.max(Number(this.seen()[String(episode.id)])||0,Number(this.watchEvents()[this.watchKey(anime,episode)]?.at)||0);return at>reset;}
 markSeen(anime:Anime,episode:Episode,seen=true){if(!seen){this.clearSeen(anime,Number(episode.malNumber??episode.number),Number(episode.malNumber??episode.number),[episode]);return;}const next={...this.seen()},events={...this.watchEvents()},key=this.watchKey(anime,episode);const at=Math.max(Date.now(),this.resetAt(anime,Number(episode.malNumber??episode.number))+1);next[String(episode.id)]=at;events[key]={at,malId:Number(anime.mal_id)||null,number:String(episode.malNumber??episode.number),animeId:anime.id};this.seen.set(next);this.watchEvents.set(events);this.write('seen',next);this.write('watchEvents',events);}
 clearSeenFrom(anime:Anime,from:number,episodes:Episode[]=[]){this.clearSeen(anime,from,null,episodes);}
 private clearSeen(anime:Anime,from:number,to:number|null,episodes:Episode[]){
  const key=this.seriesKey(anime),at=Date.now(),resets={...this.seenResets(),[key]:[...(this.seenResets()[key]||[]),{from,to,at}]};this.seenResets.set(resets);this.write('seenResets',resets);
  const matches=(number:number)=>number>=from&&(to===null||number<=to),same=(a:Anime)=>Number(anime.mal_id)>0&&Number(a.mal_id)===Number(anime.mal_id)||String(a.id)===String(anime.id);
  const seen={...this.seen()},events={...this.watchEvents()},coverage={...this.watchCoverage()},history={...this.history()};
  for(const episode of episodes)if(matches(Number(episode.malNumber??episode.number)))delete seen[String(episode.id)];
  for(const [id,event] of Object.entries(events))if((Number(anime.mal_id)>0&&Number(event.malId)===Number(anime.mal_id)||String(event.animeId)===String(anime.id))&&matches(Number(event.number)))delete events[id];
  for(const id of Object.keys(coverage))if(id.startsWith(key+':')&&matches(Number(id.slice(key.length+1))))delete coverage[id];
  for(const [id,row] of Object.entries(history))if(same(row.anime)&&matches(Number(row.episode.malNumber??row.episode.number)))history[id]={...row,completed:false,position:0,updated:at};
  this.seen.set(seen);this.watchEvents.set(events);this.watchCoverage.set(coverage);this.history.set(history);for(const [name,value]of Object.entries({seen,watchEvents:events,watchCoverage:coverage,history}))this.write(name,value);
 }
 progress(anime:Anime,episode:Episode,position:number,duration:number,completed=false,availableEpisodes?:Episode[]){if(!Number.isFinite(position)||position<0)return;if(this.settings()['historyEnabled']!==false){const old=this.history(),playable=availableEpisodes?.filter(item=>item.public!==0).map(item=>({id:item.id,number:item.number,...(item.malNumber!=null?{malNumber:item.malNumber}:{})})),availableThrough=playable?.reduce((max,item)=>Math.max(max,Number(item.number)||0),0)||old[String(anime.id)]?.availableThrough,knownEpisodes=playable?.length?playable:old[String(anime.id)]?.availableEpisodes;const next={...old,[String(anime.id)]:{anime,episode,position:Math.floor(position),duration,completed:completed||this.isSeen(anime,episode),updated:Date.now(),...(availableThrough?{availableThrough}:{}),...(knownEpisodes?.length?{availableEpisodes:knownEpisodes}:{})}};const keys=Object.keys(next).sort((a,b)=>next[b].updated-next[a].updated);for(const key of keys.slice(100))delete next[key];this.history.set(next);this.write('history',next);if(this.hiddenFromContinue()[String(anime.id)]){const hidden={...this.hiddenFromContinue()};delete hidden[String(anime.id)];if(this.write('hiddenFromContinue',hidden))this.hiddenFromContinue.set(hidden);}}if(completed)this.markSeen(anime,episode);}
}


