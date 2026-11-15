import {Episode,SavedProgress} from './models';

/** Keep an entry until the last known playable episode has been completed. */
export function shouldContinueWatching(row:SavedProgress,latestAvailable=0,isSeen?:(episode:Episode)=>boolean):boolean{
 if(!row.completed)return true;
 const watched=Number(row.episode.number);if(!Number.isFinite(watched)||watched<=0)return true;
 const episodes=Array.isArray(row.availableEpisodes)?row.availableEpisodes.filter(ep=>ep&&ep.public!==0&&Number(ep.number)>0):[];
 if(episodes.length&&isSeen){
  if(episodes.some(ep=>String(ep.id)!==String(row.episode.id)&&!isSeen(ep)))return true;
  const last=episodes.reduce((max,ep)=>Math.max(max,Number(ep.number)),0);
  return Number(latestAvailable)>last;
 }
 const snapshot=Number(row.availableThrough)||0;
 const airing=/in\s*corso|releasing|airing|ongoing/i.test(String(row.anime.status||''));
 const declared=Math.max(Number(row.anime.episodes_count)||0,Number(row.anime.real_episodes_count)||0);
 const knownLatest=Math.max(Number(row.anime.lastEpisode)||0,Number(latestAvailable)||0);
 // Playback's list is the actual available edition; older data falls back to
 // catalog counts, without guessing if no episode count is known.
 const available=Math.max(snapshot||((airing&&knownLatest>0)?knownLatest:declared),knownLatest);
 return available<=0||watched<available;
}
