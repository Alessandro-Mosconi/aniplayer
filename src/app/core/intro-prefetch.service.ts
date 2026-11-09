import {Injectable,inject,signal,effect} from '@angular/core';
import {Anime,Detail,Episode} from './models';
import {StorageService} from './storage.service';
import {AnimeWorldService} from './animeworld.service';
import {CatalogService} from './catalog.service';
import {PlaybackService} from './playback.service';
import {IntroDetectorService} from './intro-detector.service';
import {IntroService,IntroContext} from './intro.service';
import {readVideoDuration} from './mp4-duration';
const CHECK_EVERY=30*60000,RETRY=6*3600000;
type Job={state:'ready'|'not-found'|'error'|'disabled';updated:number;retryAt?:number;error?:string};
type Series={anime:Anime;episodes:Episode[];jobs:Record<string,Job>;checkedAt:number;nextCheck:number;error?:string};
interface PrefetchStore{series:Record<string,Series>;}
export interface PrefetchSnapshot{total:number;ready:number;notFound:number;disabled:number;errors:number;favorites:number;knownSeries:number;enabled:boolean;supported:boolean;paused:boolean;active:string;memoryFull:boolean;}
/** One cancellable job at a time; no video playback; no activity while user watches. */
@Injectable({providedIn:'root'})
export class IntroPrefetchService{
 private store=inject(StorageService);private api=inject(AnimeWorldService);private playback=inject(PlaybackService);private detector=inject(IntroDetectorService);private aniskip=inject(IntroService);
 readonly status=signal<PrefetchSnapshot>({total:0,ready:0,notFound:0,disabled:0,errors:0,favorites:0,knownSeries:0,enabled:false,supported:false,paused:true,active:'',memoryFull:false});
 private state:PrefetchStore;private timer:any;private controller:AbortController|null=null;private running=false;private stopped=false;private memoryFull=false;private cursor=0;private lastFavorites='';private lastActive='';
 constructor(){const saved=this.store.read<PrefetchStore>('introPrefetch',{series:{}});
  this.state={series:saved?.series&&typeof saved.series==='object'&&!Array.isArray(saved.series)?saved.series:{}};
  for(const [id,s]of Object.entries(this.state.series))if(!s?.anime||!Array.isArray(s.episodes))delete this.state.series[id];
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.suspend();else this.wake(3000);});
  window.addEventListener('pagehide',()=>this.suspend());
  effect(()=>{
   const favorites=this.store.favorites(),settings=this.store.settings(),playing=this.playback.state().opened;
   const ids=Object.keys(favorites).sort().join('|'),active=playing+'|'+String(settings['introPrefetch']!==false)+'|'+String(settings['introDetection']!==false);
   if(ids!==this.lastFavorites){this.lastFavorites=ids;this.favoritesChanged();}
   if(active!==this.lastActive){this.lastActive=active;if(playing||settings['introPrefetch']===false||settings['introDetection']===false)this.suspend();else this.wake(8000);}
   this.snapshot();
  });
  this.wake(10000);
 }
 enabled(){return this.store.settings()['introPrefetch']!==false&&this.store.settings()['introDetection']!==false&&this.detector.supported()&&!this.memoryFull;}
 private runnable(){return !this.stopped&&this.enabled()&&!document.hidden&&!this.playback.state().opened;}
 private checkpoint(id:string,signal:AbortSignal){if(signal.aborted||!this.runnable()||!this.store.favorites()[id])throw new DOMException('Prefetch sospeso','AbortError');}
 private persist(){if(!this.store.write('introPrefetch',this.state)){this.memoryFull=true;return false;}return true;}
 private favoritesChanged(){const ids=new Set(Object.keys(this.store.favorites()));for(const id of Object.keys(this.state.series))if(!ids.has(id))delete this.state.series[id];
  if(!ids.size)this.suspend();this.persist();this.snapshot();this.wake(3000);
 }
 private wake(delay=3000){if(this.running||!Object.keys(this.store.favorites()).length||!this.runnable())return;
  clearTimeout(this.timer);this.timer=setTimeout(()=>{this.timer=null;void this.run();},delay);
 }
 private suspend(){clearTimeout(this.timer);this.timer=null;this.controller?.abort();this.snapshot();}
 retry(){this.memoryFull=false;for(const series of Object.values(this.state.series)){series.nextCheck=0;for(const job of Object.values(series.jobs||{}))job.retryAt=0;}this.persist();this.snapshot();this.wake(2000);}
 snapshot(){
  const result:PrefetchSnapshot={total:0,ready:0,notFound:0,disabled:0,errors:0,favorites:Object.keys(this.store.favorites()).length,knownSeries:0,enabled:this.enabled(),supported:this.detector.supported(),paused:!this.runnable(),active:this.status().active,memoryFull:this.memoryFull};
  const detailed=this.store.read<Record<string,any>>('introDetections',{}),prepared=this.store.read<Record<string,any>>('introPrepared',{});
  for(const [id,series] of Object.entries(this.state.series))if(this.store.favorites()[id]){
   result.knownSeries++;if(series.error)result.errors++;
   for(const ep of series.episodes){result.total++;const job=series.jobs?.[String(ep.number)],key=this.detector.key(series.anime,ep),cache=[detailed[key],prepared[key]].filter(Boolean).sort((a,b)=>b.updated-a.updated)[0];
    if(cache?.state==='not-found'&&Date.now()-cache.updated<7*86400000)result.notFound++;
    else if(cache&&cache.version===3&&Number.isFinite(cache.start)&&cache.end>cache.start)result.ready++;
    else if(job?.state==='disabled')result.disabled++;else if(job?.state==='error')result.errors++;
   }
  }
  const last=this.status();if(JSON.stringify(result)!==JSON.stringify(last))this.status.set(result);
  return result;
 }
 private async refresh(id:string,signal:AbortSignal):Promise<Series>{
  const favorite=this.store.favorites()[id],old=this.state.series[id];let detail:Detail;
  if(favorite.provider==='animeworld'&&favorite.awSlug)detail=await this.api.detail(favorite);
  else{const match=await this.api.match(favorite);const selection=match.matches.find(m=>Number(m.anime.dub)===Number(favorite.dub));
   if(!selection)throw Error('Nessuna corrispondenza sicura per questa versione audio.');detail=selection;
  }
  this.checkpoint(id,signal);
  if(!detail.anime.awSlug||Number(detail.anime.dub)!==Number(favorite.dub))throw Error('Versione audio non corrispondente.');
  const episodes=detail.episodes.filter(e=>e?.id&&e.public!==0&&/^\d+(?:\.\d+)?$/.test(String(e.number))&&Number(e.number)>0).sort((a,b)=>Number(a.number)-Number(b.number));
  if(!episodes.length)throw Error('Nessun episodio pubblico disponibile.');
  const same=old?.anime?.awSlug===detail.anime.awSlug&&Number(old?.anime?.dub)===Number(detail.anime.dub),jobs=same?{...old.jobs}:{};
  for(const ep of episodes){const previous=old?.episodes?.find(e=>String(e.number)===String(ep.number));if(same&&previous&&String(previous.id)!==String(ep.id)){this.detector.forget(detail.anime,ep);delete jobs[ep.number];}}
  const available=new Set(episodes.map(e=>String(e.number)));for(const num of Object.keys(jobs))if(!available.has(num))delete jobs[num];
  const series:Series={anime:detail.anime,episodes,jobs,checkedAt:Date.now(),nextCheck:Date.now()+CHECK_EVERY};this.state.series[id]=series;this.persist();return series;
 }
 private ordered(series:Series){const first=series.episodes.findIndex(e=>!this.store.isSeen(series.anime,e)),start=Math.max(0,first);return series.episodes.slice(start).concat(series.episodes.slice(0,start));}
 private cached(series:Series,ep:Episode){const entry=this.detector.entry(series.anime,ep),job=series.jobs?.[String(ep.number)];
  if(entry&&entry.version===3){if(entry.state==='not-found'&&Date.now()-entry.updated<7*86400000)return true;if(Number.isFinite(entry.start)&&entry.end>entry.start)return true;}
  const correction=this.aniskip.corrections()[this.aniskip.context(series.anime,ep,0).key];if(correction?.disabled)return true;
  if(correction&&Number.isFinite(correction.duration)&&correction.duration>0&&Number.isFinite(correction.start)&&Number.isFinite(correction.end)&&correction.end>correction.start&&correction.end<correction.duration)return true;
  return !!job&&job.state==='disabled';
 }
 private next(series:Series){return this.ordered(series).find(ep=>!this.cached(series,ep)&&Date.now()>=(series.jobs?.[String(ep.number)]?.retryAt||0));}
 private async prepare(id:string,series:Series,ep:Episode,signal:AbortSignal){
  const title=series.anime.title_eng||series.anime.title||'Anime';this.status.update(s=>({...s,active:title+' · Ep. '+ep.number+' · durata'}));
  const url=await this.api.source(series.anime,ep),duration=await readVideoDuration(url,signal);this.checkpoint(id,signal);
  const ctx=this.aniskip.context(series.anime,ep,duration),local=this.aniskip.local(ctx);
  if(local){series.jobs[String(ep.number)]={state:local.state==='disabled'?'disabled':'ready',updated:Date.now(),retryAt:Date.now()+RETRY};return;}
  const saved=this.detector.saved(ctx,series.anime,ep);if(saved){this.detector.prepare(series.anime,ep,ctx,saved);return;}
  const info=await this.aniskip.load(ctx);this.checkpoint(id,signal);
  if(Date.now()<this.aniskip.badgeCooldown)throw Error('AniSkip in pausa: riprovare più tardi.');
  const hint=info.candidate||info.interval||null,lengthData=this.aniskip.skipLength(ctx,info),length=hint?hint.end-hint.start:lengthData?.exactEpisode?lengthData.seconds:null;
  try{
   const detected=await this.detector.detect({anime:series.anime,episode:ep,context:ctx,length,hint,signal,onProgress:s=>{this.status.update(x=>({...x,active:title+' · Ep. '+ep.number+' · '+s}));}});
   this.checkpoint(id,signal);this.detector.prepare(series.anime,ep,ctx,detected);series.jobs[String(ep.number)]={state:'ready',updated:Date.now()};
  }catch(e){this.checkpoint(id,signal);
   if(!(e instanceof Error)||!e.message.startsWith('Intro non individuata'))throw e;
   const negative=this.detector.rememberNotFound(series.anime,ep,ctx,hint);this.detector.prepare(series.anime,ep,ctx,negative);series.jobs[String(ep.number)]={state:'not-found',updated:Date.now()};
  }
 }
 private async run(){if(this.running||!this.runnable())return;
  if(Date.now()<this.aniskip.badgeCooldown){this.wake(this.aniskip.badgeCooldown-Date.now()+1000);return;}
  const ids=Object.keys(this.store.favorites());if(!ids.length)return;
  this.running=true;const controller=new AbortController();this.controller=controller;let selected:string|undefined,series:Series|undefined,episode:Episode|undefined;
  const timeout=setTimeout(()=>controller.abort(),120000);
  try{
   for(let i=0;i<ids.length;i++){const idx=(this.cursor+i)%ids.length,id=ids[idx],row=this.state.series[id];
    if(!row||Date.now()>=(row.nextCheck||0)||this.next(row)){selected=id;series=row;this.cursor=(idx+1)%ids.length;break;}
   }
   if(!selected)return;
   this.status.update(s=>({...s,active:'Controllo preferito '+selected}));
   if(!series||Date.now()>=(series.nextCheck||0))series=await this.refresh(selected,controller.signal);
   this.checkpoint(selected,controller.signal);episode=this.next(series);if(episode)await this.prepare(selected,series,episode,controller.signal);
  }catch(e){if(!controller.signal.aborted&&selected&&this.store.favorites()[selected]){
    const message=e instanceof Error?e.message:String(e);
    if(/spazio locale|memoria insufficiente/i.test(message))this.memoryFull=true;
    if(series&&episode)series.jobs[String(episode.number)]={state:'error',updated:Date.now(),retryAt:Date.now()+RETRY,error:message};
    else if(series){series.nextCheck=Date.now()+15*60000;series.error=message;}
    else{const favorite=this.store.favorites()[selected];this.state.series[selected]={anime:favorite,episodes:[],jobs:{},nextCheck:Date.now()+15*60000,checkedAt:Date.now(),error:message};}
   }}finally{clearTimeout(timeout);this.controller=null;this.running=false;this.persist();this.status.update(s=>({...s,active:''}));this.snapshot();this.wake(selected?3000:60000);}
 }
}
