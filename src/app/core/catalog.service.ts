import {Injectable, signal} from '@angular/core';
import {Anime, CatalogFilters, Detail, Episode} from './models';
import {StorageService} from './storage.service';
import {UNITY_ORIGIN,UNITY_GENRES,unityAnime,unityQuery,unityEpisodes} from './unity-modern';
interface Cached<T>{at:number;value:T}
function parse(value:string){return new DOMParser().parseFromString(value,'text/html');}
function json(value:any,fallback:any){try{return JSON.parse(value);}catch{return fallback;}}
function attrsToObj(el:Element|null,key:string,fallback:any){return json(el?.getAttribute(key)||'',fallback);}
@Injectable({providedIn:'root'})
export class CatalogService {
 readonly domain=signal(UNITY_ORIGIN);
 readonly online=signal(false);
 readonly connectionError=signal('');
 readonly genres=signal<{id:number;name:string}[]>([]);
 readonly oldestYear=signal(1900);
 private csrf='';private queue=new Map<string,Promise<any>>();private cache=new Map<string,Cached<any>>();
 private subScans=new Map<string,{at:number;records:Anime[];offset:number;total:number;done:boolean;pending:Promise<void>}>();
 constructor(private store:StorageService){const d=store.read('domain',UNITY_ORIGIN);try{const value=this.normalizeDomain(d);this.domain.set(value);if(value!==d&&/^https:\/\/(?:www\.)?animeunity\.(?:co|cx)\/?$/i.test(d))this.store.write('domain',value);}catch{}}
 private normalizeDomain(value:string){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||u.pathname!=='/'||!u.hostname.includes('.'))throw Error('Inserisci il dominio HTTPS senza percorso o parametri.');if(['www.animeunity.co','animeunity.co','www.animeunity.cx'].includes(u.hostname))return UNITY_ORIGIN;return u.origin;}
 private modern(){return this.domain()===UNITY_ORIGIN;}
 supportsAudioFiltering(){return this.modern();}
 async setDomain(value:string){const old=this.domain(),oldToken=this.csrf;this.domain.set(this.normalizeDomain(value));this.csrf='';this.cache.clear();this.subScans.clear();try{await this.catalog({},0,true);if(!this.store.write('domain',this.domain()))throw Error('Impossibile salvare il dominio.');}catch(e){this.domain.set(old);this.csrf=oldToken;this.cache.clear();this.subScans.clear();throw e;}}
 private async request(path:string,method:'GET'|'POST'='GET',payload?:unknown){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(this.domain()+path,{method,headers:method==='POST'?{'Accept':'application/json','Content-Type':'application/json','X-CSRF-TOKEN':this.csrf,'X-Requested-With':'XMLHttpRequest'}:{Accept:path.startsWith('/api/')?'application/json':'text/html'},body:method==='POST'?JSON.stringify(payload):undefined,credentials:this.modern()?'omit':'include',mode:'cors',cache:'no-store',signal:controller.signal});
   if(new URL(response.url||this.domain()+path).origin!==this.domain())throw Error('Redirect verso un dominio diverso: verifica l’indirizzo.');
   if(response.headers.get('cf-mitigated')==='challenge')throw Error('Il provider richiede una verifica browser.');
   if(!response.ok){const e:any=new Error('AnimeUnity ha risposto HTTP '+response.status);e.status=response.status;throw e;}
   const body=await response.text();this.online.set(true);this.connectionError.set('');return body;
  }catch(error){this.online.set(false);this.connectionError.set(error instanceof Error?error.message:String(error));throw error;}finally{clearTimeout(timer);}
 }
 private memo<T>(key:string,seconds:number,fn:()=>Promise<T>,force=false):Promise<T>{const item=this.cache.get(key);if(!force&&item&&Date.now()-item.at<seconds*1000)return Promise.resolve(item.value);
  if(this.queue.has(key))return this.queue.get(key)!;
  const pending=fn().then(value=>{this.cache.set(key,{value,at:Date.now()});while(this.cache.size>24)this.cache.delete(this.cache.keys().next().value!);return value;}).finally(()=>this.queue.delete(key));this.queue.set(key,pending);return pending;}
 /** Original catalog version lookup: accepts only shared MAL/AniList identifiers. */
 async version(anime:Anime,dub:number):Promise<Anime>{
  if(Number(anime.dub)===dub)return anime;
  if(this.modern()&&anime.unityId&&anime.unityLanguages?.includes(dub?'ita':'jpn'))return {...anime,id:dub?anime.unityId+'-dub':anime.unityId,dub};
  const sameSeries=(candidate:Anime)=>{
   const keys:(keyof Anime)[]=['anilist_id','mal_id'];
   const present=keys.filter(k=>Number(anime[k])>0&&Number(candidate[k])>0);
   return present.length>0&&present.every(k=>Number(anime[k])===Number(candidate[k]));
  };
  const queries=[...new Set([anime.title,anime.title_eng,anime.title_it].filter(Boolean).map(t=>String(t).replace(/\s*\(ITA\)\s*$/i,'').trim()))];
  for(const title of queries){for(let offset=0;offset<150;offset+=30){
   const result=await this.catalog({title},offset);
   const candidate=result.records.find(a=>Number(a.dub)===dub&&sameSeries(a));
   if(candidate)return candidate;
   if(offset+result.records.length>=result.tot||!result.records.length)break;
  }}
  throw Error('Versione '+(dub?'DUB ITA':'SUB ITA')+' della stessa serie non trovata.');
 }
 async session(){if(this.modern()){const data=json(await this.request('/api/archive?per_page=30&page=1'),null);if(!Array.isArray(data?.data)||!Number.isFinite(Number(data.total)))throw Error('Archivio AnimeUnity non riconosciuto.');this.genres.set(UNITY_GENRES);this.oldestYear.set(1960);return true;}const html=await this.request('/archivio'),doc=parse(html),el=doc.querySelector('archivio');if(!/animeunity/i.test(doc.title||'')||!el)throw Error('Identità archivio AnimeUnity non riconosciuta.');const csrf=doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');if(!csrf)throw Error('Token CSRF assente.');this.csrf=csrf;this.online.set(true);this.genres.set(attrsToObj(el,'all_genres',[]));this.oldestYear.set(Number(el.getAttribute('anime_oldest_date'))||1900);return true;}
 /** The provider treats dubbed=0 as "all". Scan mixed pages for SUB, preserving order and exact pagination. */
 private async subCatalog(filters:CatalogFilters,offset:number,force:boolean){
  const base={...filters,dubbed:false},key=this.domain()+JSON.stringify(base);
  let scan=this.subScans.get(key);
  if(force||!scan||Date.now()-scan.at>120000){
   scan={at:Date.now(),records:[],offset:0,total:0,done:false,pending:Promise.resolve()};
   this.subScans.set(key,scan);
   while(this.subScans.size>4)this.subScans.delete(this.subScans.keys().next().value!);
  }
  const state=scan;
  const work=state.pending.then(async()=>{
   if(state.offset===0&&!state.done){
    const [all,dub]=await Promise.all([this.catalog(base,0,force),this.catalog({...base,dubbed:1},0,force)]);
    state.total=Math.max(0,all.tot-dub.tot);
    state.records.push(...all.records.filter(a=>Number(a.dub)===0));
    state.offset=all.records.length;state.done=state.offset>=all.tot||!all.records.length;
   }
   while(!state.done&&state.records.length<offset+30){
    const result=await this.catalog(base,state.offset,force);
    state.records.push(...result.records.filter(a=>Number(a.dub)===0));
    state.offset+=result.records.length;state.done=state.offset>=result.tot||!result.records.length;
   }
  });
  state.pending=work.catch(()=>{});await work;
  return {records:state.records.slice(offset,offset+30),tot:state.total};
 }
 catalog(filters:CatalogFilters={},offset=0,force=false):Promise<{records:Anime[];tot:number}>{
  offset=Math.max(0,offset);
  if(this.modern())return this.modernCatalog(filters,offset,force);
  if(filters.dubbed===0)return this.subCatalog(filters,offset,force);
  const selected=filters.genres||[];
  const payload={title:filters.title||false,type:filters.type||false,year:filters.year||false,order:filters.order||false,status:filters.status||false,genres:false as false|{id:number;name:string}[],offset,dubbed:filters.dubbed||false,season:filters.season||false};
  return this.memo('catalog:'+JSON.stringify({...payload,genres:selected}),120,async()=>{if(!this.csrf)await this.session();
   if(selected.length){payload.genres=selected.map(id=>{const genre=this.genres().find(g=>g.id===id);if(!genre)throw Error('Genere non disponibile: azzera i filtri e riprova.');return {id:genre.id,name:genre.name};});}
   let raw='';for(let attempt=0;attempt<2;attempt++){try{raw=await this.request('/archivio/get-animes','POST',payload);break;}catch(e:any){if(e.status===419&&attempt===0){await this.session();continue;}throw e;}}
   const result=json(raw,null);if(!result||!Array.isArray(result.records)||!Number.isFinite(Number(result.tot)))throw Error('Catalogo AnimeUnity non valido.');return {records:result.records.filter((x:any)=>x&&x.id&&x.slug),tot:Number(result.tot)};
  },force);
 }
 private modernCatalog(filters:CatalogFilters,offset:number,force=false):Promise<{records:Anime[];tot:number}>{
  return this.memo('modern-catalog:'+JSON.stringify(filters)+':'+offset,120,async()=>{
   if(!this.genres().length)this.genres.set(UNITY_GENRES);
   const page=Math.floor(offset/30)+1,skip=offset%30,language=filters.dubbed===1||filters.dubbed===true?'ita':filters.dubbed===0?'jpn':undefined;
   const fetchPage=async(n:number)=>{const body=json(await this.request('/api/archive?'+unityQuery(filters,n)),null);if(!Array.isArray(body?.data)||!Number.isFinite(Number(body.total)))throw Error('Catalogo AnimeUnity non valido.');return body;};
   const first=await fetchPage(page),rows=[...first.data];if(skip&&rows.length===30&&offset+30<Number(first.total)){const next=await fetchPage(page+1);rows.push(...next.data);}
   return {records:rows.slice(skip,skip+30).map((row:any)=>unityAnime(row,language)).filter((row:Anime|null):row is Anime=>!!row),tot:Number(first.total)};
  },force);
 }
 private modernUpdates(data:any){if(!Array.isArray(data?.data)||!Number.isFinite(Number(data.last_page)))throw Error('Aggiornamenti episodi non disponibili.');
  return {records:data.data.flatMap((row:any)=>{if(row.is_hidden||!row.episode?.anime||!['ita','jpn'].includes(row.language))return [];const anime=unityAnime(row.episode.anime,row.language);return anime?[{...anime,lastEpisode:String(row.episode.number),lastEpisodeId:row.id}]:[];}),lastPage:Number(data.last_page)};
 }
 private episodeUpdates(doc:Document){const data=attrsToObj(doc.querySelector('layout-items[is-episode]'),'items-json',null);
  if(!data||!Array.isArray(data.data)||!Number.isFinite(Number(data.last_page)))throw Error('Aggiornamenti episodi non disponibili.');
  return {records:data.data.filter((x:any)=>x?.anime?.id&&x.anime.slug&&x.public!==0&&x.hidden!==1&&typeof x.created_at==='string'&&/^\d{4}-\d{2}-\d{2}/.test(x.created_at)).map((x:any)=>({...x.anime,lastEpisode:String(x.number),lastEpisodeId:x.id,lastEpisodeDate:x.created_at})),lastPage:Number(data.last_page)};
 }
 recentPage(page=1){page=Math.max(1,Math.floor(page));return this.memo('episode-updates:'+page,180,async()=>this.modern()?this.modernUpdates(json(await this.request('/api/home/latest-episodes?page='+page+'&per_page=20'),null)):this.episodeUpdates(parse(await this.request(page===1?'/':'/?page='+page))));}
 home(){return this.memo('home',180,async()=>{if(this.modern()){const [featured,updates]=await Promise.all([this.catalog({order:'Popolarità'},0),this.recentPage(1)]);const seen=new Set<string>();const recent=updates.records.filter((a:Anime)=>{const id=String(a.id);if(seen.has(id))return false;seen.add(id);return true;});return {featured:featured.records.slice(0,5),recent};}const doc=parse(await this.request('/'));const featured=attrsToObj(doc.querySelector('the-carousel'),'animes',[]);const updates=this.episodeUpdates(doc);const seen=new Set<string>();const recent=updates.records.filter((a:Anime)=>{const id=String(a.id);if(seen.has(id))return false;seen.add(id);return true;});return {featured:Array.isArray(featured)?featured:[],recent};});}
 detail(anime:Anime):Promise<Detail>{return this.memo('detail:'+anime.id,300,async()=>{if(!anime.slug)throw Error('Identificativo della serie mancante.');if(this.modern())return this.modernDetail(anime);const doc=parse(await this.request('/anime/'+anime.id+'-'+encodeURIComponent(anime.slug)));const element=doc.querySelector('video-player');const info=attrsToObj(element,'anime',null);const episodes=attrsToObj(element,'episodes',[]);if(!info||String(info.id)!==String(anime.id)||!Array.isArray(episodes))throw Error('Dettaglio AnimeUnity non riconosciuto.');const related=Array.isArray(info.related)?info.related.filter((a:any)=>a&&a.id&&a.slug):[];return {anime:{...anime,...info},episodes:episodes.filter((e:any)=>e?.id),related,count:Number(element?.getAttribute('episodes_count'))||episodes.length};});}
 private async modernDetail(anime:Anime):Promise<Detail>{
  let id=anime.unityId||Number(anime.id),current=anime;
  if(!anime.unityId){const result=await this.catalog({title:anime.title||anime.title_eng||anime.title_it||''},0),bySlug=result.records.filter(item=>item.slug===anime.slug);
   const normalize=(value:string|undefined)=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s*\(ita\)\s*$/i,'').replace(/[^a-z0-9]+/g,' ').trim();
   const titles=[anime.title,anime.title_eng,anime.title_it].map(normalize).filter(Boolean),byTitle=result.records.filter(item=>[item.title,item.title_it,item.title_original].map(normalize).some(title=>!!title&&titles.includes(title))),matches=bySlug.length?bySlug:byTitle;
   if(matches.length===1){current={...matches[0],...anime,slug:matches[0].slug,unityId:matches[0].unityId,unityLanguages:matches[0].unityLanguages};id=matches[0].unityId!;}else throw Error('Serie non identificata nel nuovo catalogo AnimeUnity.');}
  if(!Number.isSafeInteger(id)||id<=0)throw Error('Identificativo AnimeUnity non valido.');
  try{const doc=parse(await this.request('/anime/'+id+'-'+encodeURIComponent(current.slug!))),page=attrsToObj(doc.querySelector('#app'),'data-page',null),props=page?.props,info=unityAnime(props?.anime,Number(current.dub)?'ita':'jpn');
   if(!info||info.unityId!==id||!Array.isArray(props?.loadedEpisodes?.episodes))throw Error('Dettaglio AnimeUnity non riconosciuto.');
   const episodes=unityEpisodes(props.loadedEpisodes.episodes,!!Number(current.dub)),related=(Array.isArray(props.relatedAnimes)?props.relatedAnimes:[]).map((row:any)=>unityAnime(row)).filter((row:Anime|null):row is Anime=>!!row&&row.unityId!==id);
   return {anime:{...current,...info,id:current.id},episodes,related,count:Number(props.loadedEpisodes.total)||episodes.length};
  }catch{const result=json(await this.request('/api/anime/'+id+'/episodes?start=1'),null);if(!Array.isArray(result?.episodes))throw Error('Episodi AnimeUnity non disponibili.');const episodes=unityEpisodes(result.episodes,!!Number(current.dub));return {anime:current,episodes,related:[],count:Number(result.total)||episodes.length};}
 }
 async relatedFor(anime:Anime):Promise<Anime[]>{
  const ids=(['mal_id','anilist_id'] as const).filter(key=>Number(anime[key])>0);
  if(!ids.length)return [];
  const titles=[...new Set([anime.title_eng,anime.title_it,anime.title].filter((value):value is string=>!!value).map(value=>value.trim()).filter(Boolean))];
  for(const title of titles){
   const result=await this.catalog({title},0);
   const match=result.records.find(candidate=>ids.some(key=>Number(candidate[key])===Number(anime[key]))&&ids.every(key=>!Number(candidate[key])||Number(candidate[key])===Number(anime[key])));
   if(match)return (await this.detail(match)).related;
  }
  return [];
 }
 episodes(anime:Anime,anchor:string|number,start:number,end:number):Promise<Episode[]>{const path=this.modern()?'/api/anime/'+(anime.unityId||Number(anime.id))+'/episodes?start='+Math.max(1,start):'/info_api/'+anime.id+'/'+encodeURIComponent(String(anchor))+'?start_range='+start+'&end_range='+end;return this.memo(path,300,async()=>{const result=json(await this.request(path),null);if(!Array.isArray(result?.episodes))throw Error('Episodi non disponibili.');return this.modern()?unityEpisodes(result.episodes,!!Number(anime.dub)):result.episodes;});}
}

