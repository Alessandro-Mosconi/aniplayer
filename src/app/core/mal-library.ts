export interface MalAnime {title:string;image:string;type:string;genres:string[];duration:number;year:number;release?:string;aliases:string[];}
export interface MalEntry {watched:number;total:number;status:string;score:number;updatedAt?:string;anime?:MalAnime;}
export interface MalRow extends MalEntry {id:number;title:string;}
export const MAL_LIST_FIELDS='list_status,num_episodes,media_type,genres,average_episode_duration,start_date,alternative_titles';
export function parseMalEntry(item:any):MalEntry {
 const n=item.node,s=item.list_status;
 return {watched:Math.max(0,Number(s.num_episodes_watched)||0),total:Math.max(0,Number(n.num_episodes)||0),status:s.status||'',score:Number(s.score)||0,updatedAt:s.updated_at,
  anime:{title:n.title||'',image:n.main_picture?.large||n.main_picture?.medium||'',type:n.media_type||'',genres:(n.genres||[]).map((g:any)=>g.name).filter(Boolean),duration:Math.max(0,Number(n.average_episode_duration)||0),year:Number(n.start_date?.slice(0,4))||0,release:n.start_date||'',aliases:[n.alternative_titles?.en,n.alternative_titles?.ja,...(n.alternative_titles?.synonyms||[])].filter(Boolean)}};
}
export function summarizeMal(rows:MalRow[]){
 const seen=rows.filter(r=>r.watched>0),rated=seen.filter(r=>r.score>0),genres=new Map<string,number>();
 let seconds=0,timedEpisodes=0,knownWatched=0,knownTotal=0;
 for(const row of seen){for(const genre of row.anime?.genres||[])genres.set(genre,(genres.get(genre)||0)+1);if(row.anime?.duration){seconds+=row.watched*row.anime.duration;timedEpisodes+=row.watched;}if(row.total>0){knownTotal+=row.total;knownWatched+=Math.min(row.watched,row.total);}}
 return {total:rows.length,started:seen.length,completed:rows.filter(r=>r.status==='completed').length,watching:rows.filter(r=>r.status==='watching').length,episodes:seen.reduce((n,r)=>n+r.watched,0),hours:seconds/3600,timedEpisodes,averageScore:rated.length?rated.reduce((n,r)=>n+r.score,0)/rated.length:0,rated:rated.length,progress:knownTotal?Math.round(knownWatched/knownTotal*100):0,
  genres:[...genres].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)).slice(0,6),
  statuses:['watching','completed','on_hold','dropped','plan_to_watch'].map(status=>({status,count:rows.filter(r=>r.status===status).length}))};
}
export interface MalListFilters {query:string;status:string;type:string;genres:string[];excludedGenres?:string[];minScore?:number;watch:string;order:string;randomSeed?:number;}
export function filterMalRows(rows:MalRow[],filters:MalListFilters){
 const query=filters.query.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const result=rows.filter(r=>{
  if(query&&![r.title,...(r.anime?.aliases||[])].some(t=>t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query)))return false;
  return (!filters.status||r.status===filters.status)&&(!filters.type||r.anime?.type===filters.type)&&filters.genres.every(g=>r.anime?.genres.includes(g))&&(!(filters.excludedGenres?.length)||!!r.anime?.genres&&!filters.excludedGenres.some(g=>r.anime!.genres.includes(g)))&&(!filters.minScore||r.score>0&&r.score>=filters.minScore)&&(filters.watch!=='seen'||r.watched>0)&&(filters.watch!=='never'||r.watched===0)&&(filters.watch!=='remaining'||r.total>r.watched);
 });
 if(filters.order==='random'){let seed=(filters.randomSeed??1)>>>0;for(let i=result.length-1;i>0;i--){seed=(seed+0x6D2B79F5)>>>0;let x=Math.imul(seed^(seed>>>15),1|seed);x^=x+Math.imul(x^(x>>>7),61|x);const j=Math.floor(((x^(x>>>14))>>>0)/4294967296*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
 return result.sort((a,b)=>{if(filters.order==='release_desc'||filters.order==='release_asc'){const x=Date.parse(a.anime?.release||String(a.anime?.year||''))||0,y=Date.parse(b.anime?.release||String(b.anime?.year||''))||0;return (!x&&!y?0:!x?1:!y?-1:(x-y)*(filters.order==='release_desc'?-1:1))||a.title.localeCompare(b.title);}if(filters.order==='score'||filters.order==='score_asc')return (!a.score&&!b.score?0:!a.score?1:!b.score?-1:(a.score-b.score)*(filters.order==='score'?-1:1))||a.title.localeCompare(b.title);if(filters.order==='remaining'||filters.order==='remaining_asc')return ((a.total-a.watched)-(b.total-b.watched))*(filters.order==='remaining'?-1:1)||a.title.localeCompare(b.title);if(filters.order==='updated'||filters.order==='updated_asc')return ((Date.parse(a.updatedAt||'')||0)-(Date.parse(b.updatedAt||'')||0))*(filters.order==='updated'?-1:1)||a.title.localeCompare(b.title);return a.title.localeCompare(b.title)*(filters.order==='title_desc'?-1:1);});
}
