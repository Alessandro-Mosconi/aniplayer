import {Injectable} from '@angular/core';
import {Anime} from './models';
import {StorageService} from './storage.service';
const QUERY='query($ids:[Int]){Page(page:1,perPage:50){media(idMal_in:$ids,type:ANIME){idMal startDate{year month day}}}}';
/** Public release metadata; no login or user data is sent. */
@Injectable({providedIn:'root'})
export class ReleaseDatesService {
 private pending=new Map<string,Promise<Record<string,string>>>();
 constructor(private storage:StorageService){}
 async enrich(records:Anime[]):Promise<Anime[]>{
  const cache=this.storage.read<Record<string,{date:string;at:number}>>('releaseDates',{})||{},now=Date.now();
  const ids=[...new Set(records.filter(a=>!a.releaseDate&&Number(a.mal_id)>0).map(a=>Number(a.mal_id)))];
  const missing=ids.filter(id=>!cache[id]||now-cache[id].at>7*86400000);
  for(let start=0;start<missing.length;start+=50){
   const batch=missing.slice(start,start+50).sort((a,b)=>a-b),key=batch.join(',');let work=this.pending.get(key);
   if(!work){work=this.fetchDates(batch);this.pending.set(key,work);}
   try{const dates=await work;for(const [id,date] of Object.entries(dates))cache[id]={date,at:now};}
   catch{break;}finally{this.pending.delete(key);}
  }
  const bounded=Object.fromEntries(Object.entries(cache).sort((a,b)=>b[1].at-a[1].at).slice(0,6000));this.storage.write('releaseDates',bounded);
  return records.map(anime=>cache[String(anime.mal_id)]?.date?{...anime,releaseDate:cache[String(anime.mal_id)].date}:anime);
 }
 private async fetchDates(ids:number[]){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
   const response=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:QUERY,variables:{ids}}),signal:controller.signal});
   if(!response.ok)throw Error('Date di uscita non disponibili');const result=await response.json();
   if(result.errors||!Array.isArray(result.data?.Page?.media))throw Error('Risposta date non valida');
   const dates:Record<string,string>={};for(const row of result.data.Page.media){const d=row.startDate;if(!ids.includes(row.idMal)||!Number.isInteger(d?.year)||!Number.isInteger(d.month)||!Number.isInteger(d.day)||d.month<1||d.month>12||d.day<1||d.day>31)continue;dates[row.idMal]=`${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`;}return dates;
  }finally{clearTimeout(timer);}
 }
}
