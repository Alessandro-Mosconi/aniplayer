import {Injectable} from '@angular/core';
import {CatalogService} from './catalog.service';
import {MalLibraryService} from './mal-library.service';
import {Anime,CatalogFilters,animeTitle} from './models';
import {CatalogOrderService,compareRelease,seededShuffle} from './catalog-order.service';
import {ExplorationService} from './exploration.service';
@Injectable({providedIn:'root'})
export class CatalogProgressService {
 private scans=new Map<string,{at:number;records:Anime[];offset:number;done:boolean;pending:Promise<void>}>();
 constructor(private catalog:CatalogService,private library:MalLibraryService,private ordered:CatalogOrderService,private exploration:ExplorationService){}
 async page(filters:CatalogFilters,offset:number){
  if(filters.explored&&['seen','like','dislike'].includes(filters.explored)){
   const title=String(filters.title||'').toLowerCase();
   let records=this.exploration.recent().map(r=>r.anime).filter(anime=>{
    if(!this.exploration.matches(anime,filters.explored))return false;
    if(title&&![anime.title,anime.title_eng,anime.title_it].some(t=>String(t||'').toLowerCase().includes(title)))return false;
    if(filters.type&&anime.type!==filters.type||filters.status&&anime.status!==filters.status||filters.year&&Number(anime.date)!==Number(filters.year)||filters.dubbed!==undefined&&filters.dubbed!==false&&Number(anime.dub)!==Number(filters.dubbed))return false;
    const genres=Array.isArray(anime.genres)?anime.genres as any[]:[];if((filters.genres||[]).some(id=>!genres.some(g=>Number(g?.id)===id)))return false;
    const progress=this.library.progress(anime);return !filters.watch||filters.watch==='all'||filters.watch==='never'&&progress.watched===0||filters.watch==='unwatched'&&progress.remaining>0;
   });
   if(filters.order==='random')records=seededShuffle(records.sort((a,b)=>animeTitle(a).localeCompare(animeTitle(b))),filters.randomSeed??1);
   else if(filters.order==='release_desc'||filters.order==='release_asc')records.sort((a,b)=>compareRelease(a,b,filters.order==='release_desc'));
   else if(filters.order==='Lista A-Z'||filters.order==='Lista Z-A')records.sort((a,b)=>animeTitle(a).localeCompare(animeTitle(b))*(filters.order==='Lista Z-A'?-1:1));
   else if(filters.order==='Valutazione')records.sort((a,b)=>Number(b.score||0)-Number(a.score||0));
   else if(filters.order==='Popolarità')records.sort((a,b)=>Number((b as any).visite||0)-Number((a as any).visite||0));
   return {records:records.slice(offset,offset+30),tot:records.length,exact:true,hasMore:offset+30<records.length};
  }
  if((!filters.watch||filters.watch==='all')&&(!filters.explored||filters.explored==='all')){const result=await this.ordered.page(filters,offset);return {...result,exact:true,hasMore:offset+result.records.length<result.tot};}
  const key=this.catalog.domain()+JSON.stringify(filters)+this.library.progressKey()+this.exploration.fingerprint();let scan=this.scans.get(key);
  if(!scan||Date.now()-scan.at>120000){scan={at:Date.now(),records:[],offset:0,done:false,pending:Promise.resolve()};this.scans.set(key,scan);while(this.scans.size>4)this.scans.delete(this.scans.keys().next().value!);}
  const state=scan;
  const work=state.pending.then(async()=>{
   // Bounded work: Continue search resumes the same scan instead of skipping matches.
   for(let pages=0;pages<12&&!state.done&&state.records.length<offset+31;pages++){
    const result=await this.ordered.page(filters,state.offset);
    state.records.push(...result.records.filter(anime=>{const progress=this.library.progress(anime);return (!filters.watch||filters.watch==='all'||filters.watch==='never'&&progress.watched===0||filters.watch==='unwatched'&&progress.remaining>0)&&this.exploration.matches(anime,filters.explored);}));
    state.offset+=result.records.length;state.done=!result.records.length||state.offset>=result.tot;
   }
  });state.pending=work.catch(()=>{});await work;
  return {records:state.records.slice(offset,offset+30),tot:state.records.length,exact:state.done,hasMore:state.records.length>offset+30||!state.done};
 }
}

