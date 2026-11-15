import {Anime} from './models';

/** Strip edition and season suffixes without using short or fuzzy title matches. */
export function discoveryTitle(value:unknown):string{
 if(typeof value!=='string')return '';
 return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/\s*[[({]\s*(?:dub|sub|ita|italiano|italian|sub ita|dub ita)[^\])}]*[\])}]/gi,' ')
  .replace(/\s*[-–—:]?\s*(?:season|stagione|part|parte)\s*\d+(?:\s.*)?$/i,' ')
  .replace(/\s+\d+(?:st|nd|rd|th)\s+season(?:\s.*)?$/i,' ')
  .replace(/\s+(?:dub|sub)(?:\s+ita)?$/i,' ')
  .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function titles(anime:Anime){return [anime.title,anime.title_eng,anime.title_it,anime.title_original].map(discoveryTitle).filter(Boolean);}
export function sameDiscoverySeries(a:Anime,b:Anime):boolean{
 if(a.id!=null&&b.id!=null&&String(a.id)===String(b.id))return true;
 if(Number(a.mal_id)>0&&Number(a.mal_id)===Number(b.mal_id))return true;
 if(Number(a.anilist_id)>0&&Number(a.anilist_id)===Number(b.anilist_id))return true;
 const other=new Set(titles(b));return titles(a).some(title=>other.has(title));
}
/** Prefer series not in the preceding strip, then fill with other distinct series. */
export function diverseHomeDiscovery(records:Anime[],previous:Anime[],limit=20):Anime[]{
 const result:Anime[]=[];
 for(const fresh of [true,false])for(const anime of records){
  if(result.length>=limit)return result;
  if(!anime||anime.id==null||result.some(item=>sameDiscoverySeries(item,anime)))continue;
  if(fresh&&previous.some(item=>sameDiscoverySeries(item,anime)))continue;
  result.push(anime);
 }
 return result;
}
