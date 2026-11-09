import {ReleaseDatesService} from './release-dates.service';
﻿import {Injectable} from '@angular/core';
import {CatalogService} from './catalog.service';
import {Anime,CatalogFilters,animeTitle} from './models';
export function seededShuffle<T>(values:T[],seed:number){const result=[...values];let n=seed>>>0;const random=()=>{n=(n+0x6D2B79F5)>>>0;let x=Math.imul(n^(n>>>15),1|n);x^=x+Math.imul(x^(x>>>7),61|x);return ((x^(x>>>14))>>>0)/4294967296;};for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
const seasons:Record<string,number>={inverno:1,winter:1,primavera:4,spring:4,estate:7,summer:7,autunno:10,fall:10,autumn:10};
export function releaseValue(anime:Anime){
 const date=String(anime.releaseDate||anime.date||'').trim(),match=/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/.exec(date);
 if(!match)return 0;
 const month=Number(match[2])||seasons[String(anime.season||'').trim().toLowerCase()]||0;
 return Number(match[1])*10000+month*100+(Number(match[3])||0);
}
export function compareRelease(a:Anime,b:Anime,descending:boolean){const av=releaseValue(a),bv=releaseValue(b);return (!av||!bv)?(av? -1:bv?1:animeTitle(a).localeCompare(animeTitle(b))):(av-bv)*(descending?-1:1)||String(a.id).localeCompare(String(b.id),undefined,{numeric:true})*(descending?-1:1);}

interface OrderedScan {at:number;records:Anime[];total:number;initialized:boolean;year:number;indices:number[];cursor:number;done:boolean;pending:Promise<void>;raw:CatalogFilters;}
@Injectable({providedIn:'root'})
export class CatalogOrderService {
 private scans=new Map<string,OrderedScan>();
 constructor(private catalog:CatalogService,private dates?:ReleaseDatesService){}
 async page(filters:CatalogFilters,offset=0):Promise<{records:Anime[];tot:number}>{
  if(!['random','release_desc','release_asc'].includes(String(filters.order)))return this.catalog.catalog(filters,offset);
  const key=this.catalog.domain()+JSON.stringify(filters);let state=this.scans.get(key);
  if(!state||Date.now()-state.at>120000){state={at:Date.now(),records:[],total:0,initialized:false,year:Number(filters.year)||(filters.order==='release_asc'?1900:new Date().getFullYear()+1),indices:[],cursor:0,done:false,pending:Promise.resolve(),raw:{...filters,order:'Lista A-Z',dubbed:filters.order==='random'&&filters.dubbed===0?false:filters.dubbed}};this.scans.set(key,state);while(this.scans.size>3)this.scans.delete(this.scans.keys().next().value!);}
  const scan=state;
  const work=scan.pending.then(async()=>{
   if(!scan.initialized){const first=await this.catalog.catalog(scan.raw,0);scan.total=first.tot;if(filters.order==='release_asc'&&!filters.year)scan.year=this.catalog.oldestYear?.()||1900;if(filters.order==='random'){scan.indices=seededShuffle(Array.from({length:Math.ceil(first.tot/30)},(_,i)=>i),filters.randomSeed??1);if(filters.dubbed===0){const dubbed=await this.catalog.catalog({...scan.raw,dubbed:1},0);scan.total=Math.max(0,first.tot-dubbed.tot);}}scan.initialized=true;scan.done=scan.total===0;}
   while(!scan.done&&scan.records.length<offset+30){
    if(filters.order==='random'){
     const indices=scan.indices.slice(scan.cursor,scan.cursor+4);
     const pages=await Promise.all(indices.map(index=>this.catalog.catalog(scan.raw,index*30)));
     scan.cursor+=indices.length;
     const records=pages.flatMap(page=>page.records).filter(a=>filters.dubbed!==0||Number(a.dub)===0);
     const known=new Set(scan.records.map(a=>String(a.id)));scan.records.push(...seededShuffle(records,(filters.randomSeed??1)+scan.cursor).filter(a=>{if(known.has(String(a.id)))return false;known.add(String(a.id));return true;}));scan.done=scan.cursor>=scan.indices.length;if(scan.done)scan.total=scan.records.length;
    }else{
     const year=scan.year,yearFilters={...scan.raw,year};const first=await this.catalog.catalog(yearFilters,0),records=[...first.records];
     for(let start=30;start<first.tot;start+=120){const pages=await Promise.all(Array.from({length:Math.min(4,Math.ceil((first.tot-start)/30))},(_,i)=>this.catalog.catalog(yearFilters,start+i*30)));records.push(...pages.flatMap(page=>page.records));}
     if(this.dates){const enriched=await this.dates.enrich(records);records.splice(0,records.length,...enriched);}
     // Archive rows may expose the year without the season. Recover it from
     // the provider's season filters before sorting the complete year.
     const missing=records.filter(a=>!a.releaseDate&&!a.season&&!/^\d{4}-\d{2}/.test(String(a.date||'')));
     if(missing.length){
      const names=filters.season?[filters.season]:['Inverno','Primavera','Estate','Autunno'];
      const membership=new Map<string,string[]>();
      for(let batch=0;batch<names.length;batch+=2)await Promise.all(names.slice(batch,batch+2).map(async season=>{
       const sf={...yearFilters,season};const first=await this.catalog.catalog(sf,0);let rows=first.records;
       for(let start=0;;start+=30){
        for(const row of rows){const key=String(row.id);membership.set(key,[...(membership.get(key)||[]),season]);}
        if(start+rows.length>=first.tot||!rows.length)break;
        rows=(await this.catalog.catalog(sf,start+30)).records;
       }
      }));
      for(let i=0;i<records.length;i++){const choices=membership.get(String(records[i].id));if(!records[i].season&&choices?.length===1)records[i]={...records[i],season:choices[0]};}
     }
     records.sort((a,b)=>compareRelease(a,b,filters.order==='release_desc'));
     const existing=new Set(scan.records.map(a=>String(a.id)));scan.records.push(...records.filter(a=>{if(existing.has(String(a.id)))return false;existing.add(String(a.id));return true;}));scan.year+=filters.order==='release_asc'?1:-1;
     scan.done=!!filters.year||scan.records.length>=scan.total||scan.year<(this.catalog.oldestYear?.()||1900)||scan.year>new Date().getFullYear()+1;
     // Unknown years are kept at the end instead of disappearing from the result.
     if(scan.done&&scan.records.length<scan.total&&!filters.year){const known=new Set(scan.records.map(a=>String(a.id)));for(let start=0;start<scan.total;start+=30){const page=await this.catalog.catalog(scan.raw,start);for(const anime of page.records)if(!known.has(String(anime.id))){scan.records.push(anime);known.add(String(anime.id));}if(!page.records.length)break;}}
     if(scan.done)scan.total=scan.records.length;
    }
   }
  });scan.pending=work.catch(()=>{});await work;return {records:scan.records.slice(offset,offset+30),tot:scan.total};
 }
}

