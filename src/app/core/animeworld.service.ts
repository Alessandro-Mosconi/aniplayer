import {Injectable,signal} from '@angular/core';
import {Anime,AudioKind,Detail,Episode} from './models';
const BASE='https://www.animeworld.ac';
function html(body:string){return new DOMParser().parseFromString(body,'text/html');}
function normalize(value:string){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s*\(ita\)\s*$/i,'').replace(/[^a-z0-9]+/g,' ').trim();}
@Injectable({providedIn:'root'})
export class AnimeWorldService {
 readonly online=signal(false);
 readonly connectionStatus=signal<'unchecked'|'checking'|'online'|'offline'>('unchecked');
 readonly connectionError=signal('');
 private cache=new Map<string,{at:number;value:any}>();
 async checkConnection():Promise<boolean>{
  this.connectionStatus.set('checking');
  try{
   const body=await this.request('/');
   if(!/<title>[^<]*animeworld/i.test(body))throw Error('Pagina AnimeWorld non riconosciuta.');
   return true;
  }catch(error){this.online.set(false);this.connectionStatus.set('offline');this.connectionError.set(error instanceof Error?error.message:String(error));return false;}
 }
 private async request(path:string){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(BASE+path,{mode:'cors',credentials:'include',redirect:'follow',cache:'no-store',signal:controller.signal});if(new URL(response.url||BASE+path).origin!==BASE)throw Error('AnimeWorld ha cambiato dominio.');if(!response.ok)throw Error('AnimeWorld HTTP '+response.status);const body=await response.text();if(/<title>[^<]*(just a moment|attention required)|id=["']challenge-form/.test(body))throw Error('AnimeWorld richiede una verifica browser.');this.online.set(true);this.connectionStatus.set('online');this.connectionError.set('');return body;
  }catch(error){this.online.set(false);this.connectionStatus.set('offline');this.connectionError.set(error instanceof Error?error.message:String(error));throw error;}finally{clearTimeout(timer);}}
 private memo<T>(key:string,fn:()=>Promise<T>):Promise<T>{const cached=this.cache.get(key);if(cached&&Date.now()-cached.at<180000)return Promise.resolve(cached.value);return fn().then(value=>{this.cache.set(key,{at:Date.now(),value});if(this.cache.size>60)this.cache.delete(this.cache.keys().next().value!);return value;});}
 slug(input:Anime|string){const value=typeof input==='string'?input:input.awSlug||input.slug||'';if(!/^[a-zA-Z0-9._-]+$/.test(value))throw Error('Slug AnimeWorld non valido.');return value;}
 search(query:string,language:AudioKind='auto'):Promise<Anime[]>{query=String(query).trim().slice(0,150);if(!query)return Promise.resolve([]);return this.memo('search:'+query+':'+language,async()=>{
  const doc=html(await this.request('/search?keyword='+encodeURIComponent(query))),scope=doc.querySelector('#main .content')||doc,records=new Map<string,Anime>();
  for(const item of scope.querySelectorAll('.film-list .item,.item')){const link=item.querySelector<HTMLAnchorElement>('a.name[href^="/play/"]');if(!link)continue;const slug=link.getAttribute('href')!.slice(6).split('/')[0];if(!/^[a-zA-Z0-9._-]+$/.test(slug))continue;const dub=!!item.querySelector('.dub');if(language==='dub'&&!dub||language==='sub'&&dub)continue;
   const imageEl=item.querySelector<HTMLImageElement>('img');let imageurl='';try{const u=new URL(imageEl?.getAttribute('data-src')||imageEl?.getAttribute('src')||'',BASE);if(u.protocol==='https:')imageurl=u.href;}catch{}
   const a:Anime={id:'aw:'+slug,slug,awSlug:slug,provider:'animeworld',title:link.textContent?.trim()||'',title_original:link.getAttribute('data-jtitle')||'',dub:Number(dub),imageurl};if(a.title)records.set(slug,a);
  }return [...records.values()].sort((a,b)=>Number(b.dub)-Number(a.dub));});}
 page(anime:Anime|string):Promise<{episodes:Episode[];plot:string;mal_id?:number;anilist_id?:number}>{const slug=this.slug(anime);return this.memo('page:'+slug,async()=>{
  const doc=html(await this.request('/play/'+encodeURIComponent(slug))),episodes=new Map<string,Episode>();
  for(const link of doc.querySelectorAll('a[data-episode-num][data-id]')){const number=link.getAttribute('data-episode-num')||'',token=link.getAttribute('data-id')||'';if(/^\d+(?:\.\d+)?$/.test(number)&&/^[-\w]+$/.test(token))episodes.set(number,{id:'aw:'+slug+':'+token,number,token,public:1});}
  if(!episodes.size)throw Error('AnimeWorld non ha episodi pubblici per questa serie.');const result:{episodes:Episode[];plot:string;mal_id?:number;anilist_id?:number}={episodes:[...episodes.values()].sort((a,b)=>Number(a.number)-Number(b.number)),plot:doc.querySelector<HTMLMetaElement>('meta[name="description"]')?.content||''};
  for(const l of doc.querySelectorAll('a[href]')){const href=l.getAttribute('href')||'';let m=href.match(/^https:\/\/(?:www\.)?myanimelist\.net\/anime\/(\d+)(?:\/|$)/);if(m)result.mal_id=Number(m[1]);m=href.match(/^https:\/\/(?:www\.)?anilist\.co\/anime\/(\d+)(?:\/|$)/);if(m)result.anilist_id=Number(m[1]);}
  return result;});}
 async match(anime:Anime):Promise<{matches:Detail[];candidates:Anime[]}>{const titles=[...new Set([anime.title,anime.title_eng,anime.title_it].filter(Boolean) as string[])],aliases=titles.map(normalize),found=await Promise.allSettled(titles.map(t=>this.search(t.replace(/\s*\(ITA\)\s*$/i,''))));
  const all=[...new Map(found.flatMap(r=>r.status==='fulfilled'?r.value:[]).map(a=>[this.slug(a),a] as const)).values()];const exact=(a:Anime)=>[a.title,a.title_original].some(t=>aliases.includes(normalize(t||'')));
  const candidates=all.sort((a,b)=>Number(exact(b))-Number(exact(a))||Number(b.dub)-Number(a.dub)).slice(0,8);
  const checked=await Promise.allSettled(candidates.map(async candidate=>{const page=await this.page(candidate);const ids:(keyof Anime)[]=['mal_id','anilist_id'],comparable=ids.filter(k=>Number(anime[k])>0&&Number((page as any)[k])>0);
   const verified=comparable.length>0&&comparable.every(k=>Number(anime[k])===Number((page as any)[k]));return {candidate,page,verified,titleOnly:comparable.length===0&&exact(candidate)};}));
  const values=checked.filter((r):r is PromiseFulfilledResult<any>=>r.status==='fulfilled').map(r=>r.value);let matches=values.filter(v=>v.verified);
  if(!matches.length){const fallback=values.filter(v=>v.titleOnly);if(new Set(fallback.map(v=>normalize(v.candidate.title_original||v.candidate.title||''))).size===1)matches=fallback;}
  return {candidates:all,matches:matches.sort((a,b)=>Number(b.candidate.dub)-Number(a.candidate.dub)).map(v=>({anime:{...anime,provider:'animeworld' as const,awSlug:v.candidate.awSlug,dub:v.candidate.dub,mal_id:anime.mal_id||v.page.mal_id},episodes:v.page.episodes,related:[],count:v.page.episodes.length}))};
 }
 async detail(anime:Anime):Promise<Detail>{const page=await this.page(anime);return {anime:{...anime,mal_id:anime.mal_id||page.mal_id,plot:anime.plot||page.plot},episodes:page.episodes,related:[],count:page.episodes.length};}
 async source(anime:Anime,episode:Episode):Promise<string>{const page=await this.page(anime),ep=page.episodes.find(e=>Number(e.number)===Number(episode.number));if(!ep?.token)throw Error('Episodio non trovato su AnimeWorld.');
  for(const alt of [0,1]){const raw=await this.request('/api/episode/info?id='+encodeURIComponent(ep.token)+'&alt='+alt);let json:any;try{json=JSON.parse(raw);}catch{throw Error('Risposta video non valida.');}if(!json.grabber)continue;
   const url=new URL(json.grabber);if(url.protocol!=='https:'||url.username||url.password||!url.pathname.toLowerCase().endsWith('.mp4'))throw Error('La sorgente non è un MP4 HTTPS diretto.');return url.href;}
  throw Error('AnimeWorld non fornisce una sorgente video MP4.');
 }
}

