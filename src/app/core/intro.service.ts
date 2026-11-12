import {alignSkip,SkipAlignment} from './skip-alignment';
import {Injectable} from '@angular/core';
import {Anime,Episode} from './models';
import {StorageService} from './storage.service';
import {ServiceEndpointsService,PUBLIC_SERVICE_DEFAULTS} from './service-endpoints.service';
export type IntroSource='local'|'aniskip'|'audio'|'fingerprint';
export interface IntroWindow{start:number;end:number;source:IntroSource;}
export type ExtraSegment='recap'|'prologue'|'ending';
export interface SkipProposals{opening:IntroWindow|null;recap:IntroWindow|null;ending:IntroWindow|null;}
export interface IntroContext{mal:number;number:number;duration:number;key:string;}
export interface IntroCandidate{start:number;end:number;referenceDuration:number;delta:number;}
export interface IntroResult{state:'ready'|'review'|'disabled'|'changed'|'unavailable';source?:IntroSource;interval?:IntroWindow;candidate?:IntroCandidate;message:string;}
export const validIntro=(start:number,end:number,duration:number)=>Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end>start&&end<duration;
@Injectable({providedIn:'root'})
export class IntroService{
 private memo=new Map<string,{time:number;promise:Promise<any[]>}>();
 private badgeJobs=new Map<number,Promise<boolean>>();private badgeQueue:Promise<unknown>=Promise.resolve();
 badgeCooldown=0;
 private memoOrigin='';
 constructor(private store:StorageService,private endpoints:ServiceEndpointsService){}
 context(anime:Anime,episode:Episode,duration:number):IntroContext{
  const mal=Number(anime.mal_id),number=Number(episode.number);
  return {mal,number,duration,key:[Number.isSafeInteger(mal)&&mal>0?'mal:'+mal:'anime:'+anime.id,anime.provider||'animeworld',anime.awSlug||anime.slug,Number(anime.dub)?'dub':'sub',String(episode.number)].join('|')};
 }
 corrections(){return this.store.read<Record<string,any>>('introCorrections',{});}
 private legacyKey(ctx:IntroContext){const parts=ctx.key.split('|');
  const id=Number.isSafeInteger(ctx.mal)&&ctx.mal>0?ctx.mal:parts[0].replace(/^anime:/,'');
  return [id,parts[2]||'',parts[3]==='dub'?1:0,parts[4]||ctx.number].join(':');
 }
 availability(){return this.store.read<Record<string,any>>('aniskipAvailability',{});}
 hasBadge(anime:Anime){const entry=this.availability()[Number(anime?.mal_id)];return !!entry&&entry.found===true&&Date.now()-entry.checkedAt<7*86400000;}
 local(context:IntroContext):IntroResult|null{
  const rows=this.corrections();let v=rows[context.key];
  if(!v){
   // Preserve manual edits from the first Angular preview (autv.angularIntroCorrections).
   const legacy=this.store.read<Record<string,any>>('angularIntroCorrections',{})[this.legacyKey(context)];
   if(legacy&&Number.isFinite(legacy.duration)&&Number.isFinite(legacy.start)&&Number.isFinite(legacy.end)){
    v={...legacy,disabled:false,updated:Date.now()};rows[context.key]=v;this.store.write('introCorrections',rows);
   }
  }
  if(!v)return null;
  if(!Number.isFinite(v.duration)||Math.abs(v.duration-context.duration)>2)return {state:'changed',message:'La durata del video è cambiata: verifica la correzione locale.'};
  if(v.disabled===true)return {state:'disabled',message:'Salto intro disattivato per questo episodio.'};
  if(!validIntro(v.start,v.end,context.duration))return null;
  return {state:'ready',source:'local',interval:{start:v.start,end:v.end,source:'local'},message:'Intervallo locale verificato.'};
 }
 save(anime:Anime,episode:Episode,duration:number,start:number,end:number,disabled=false){
  if(!Number.isFinite(duration)||duration<=0||!disabled&&!validIntro(start,end,duration))throw Error('Intervallo intro non valido.');
  const ctx=this.context(anime,episode,duration),rows=this.corrections();rows[ctx.key]={start,end,disabled,duration,updated:Date.now()};
  Object.keys(rows).sort((a,b)=>rows[b].updated-rows[a].updated).slice(500).forEach(k=>delete rows[k]);
  if(!this.store.write('introCorrections',rows))throw Error('Impossibile salvare la correzione.');
 }
 clear(anime:Anime,episode:Episode,duration=0){const rows=this.corrections(),ctx=this.context(anime,episode,duration);delete rows[ctx.key];
  if(!this.store.write('introCorrections',rows))throw Error('Errore cancellazione correzione.');
  const old=this.store.read<Record<string,any>>('angularIntroCorrections',{});delete old[this.legacyKey(ctx)];this.store.write('angularIntroCorrections',old);
 }
 private record(mal:number,episode:number,rows:any[],duration=0){
  const candidates=rows.filter(r=>r?.skipType==='op'&&r.interval&&validIntro(Number(r.interval.startTime),Number(r.interval.endTime),Number(r.episodeLength)+.1)&&Number.isFinite(Number(r.episodeLength))).sort((a,b)=>duration?Math.abs(a.episodeLength-duration)-Math.abs(b.episodeLength-duration):0);
  const row=candidates[0];if(!row)return false;const stored=this.availability();stored[mal]={found:true,episode,introLength:row.interval.endTime-row.interval.startTime,checkedAt:Date.now()};
  Object.keys(stored).sort((a,b)=>stored[b].checkedAt-stored[a].checkedAt).slice(1000).forEach(k=>delete stored[k]);this.store.write('aniskipAvailability',stored);return true;
 }
 async fetchTimes(ctx:IntroContext):Promise<any[]>{
  const origin=this.endpoints?.origin('aniskip')||PUBLIC_SERVICE_DEFAULTS.aniskip;if(origin!==this.memoOrigin){this.memo.clear();this.memoOrigin=origin;}
  const base=ctx.mal+':'+ctx.number,now=Date.now();
  // Fetch all timings while the video is preparing; validate duration locally later.
  const warmed=this.memo.get(base+':0');if(ctx.duration>0&&warmed&&now-warmed.time<900000)return warmed.promise;
  if(ctx.duration===0){const saved=this.store.read<Record<string,any>>('skipTimesCache',{})[base];
   if(saved?.version===1&&Array.isArray(saved.rows)&&now-saved.time<(saved.rows.length?7*86400000:3600000)){
    const promise=Promise.resolve(saved.rows);this.memo.set(base+':0',{time:now,promise});return promise;
   }
  }
  const key=base+':'+Math.round(ctx.duration),cached=this.memo.get(key);
  if(cached&&Date.now()-cached.time<900000)return cached.promise;
  const request=(async()=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
   try{const url=`${origin}/v2/skip-times/${ctx.mal}/${ctx.number}?types%5B%5D=op&types%5B%5D=ed&types%5B%5D=recap&episodeLength=${ctx.duration.toFixed(3)}`;
    const r=await fetch(url,{mode:'cors',credentials:'omit',signal:controller.signal});if(r.status===404){if(ctx.duration===0)this.cacheTimes(base,[]);return [];}
    if(r.status===429)this.badgeCooldown=Date.now()+300000;
    if(!r.ok)throw Error('AniSkip HTTP '+r.status);
    const data=await r.json();if((this.endpoints?.origin('aniskip')||PUBLIC_SERVICE_DEFAULTS.aniskip)!==origin)return [];if(data.found===false){if(ctx.duration===0)this.cacheTimes(base,[]);return [];}if(!Array.isArray(data.results))throw Error('Risposta AniSkip non valida');
    if(ctx.duration===0)this.cacheTimes(base,data.results);
    this.record(ctx.mal,ctx.number,data.results,ctx.duration);return data.results;
   }finally{clearTimeout(timer);}
  })();this.memo.set(key,{time:Date.now(),promise:request});if(this.memo.size>40)this.memo.delete(this.memo.keys().next().value!);
  try{return await request;}catch(e){this.memo.delete(key);throw e;}
 }
 private cacheTimes(key:string,results:any[]){
  const rows=results.filter(row=>['op','ed','recap'].includes(row?.skipType)&&Number.isFinite(row.episodeLength)&&row.episodeLength>0&&row.episodeLength<=86400&&Number.isFinite(row.interval?.startTime)&&Number.isFinite(row.interval?.endTime)&&row.interval.startTime>=0&&row.interval.endTime>row.interval.startTime&&row.interval.endTime<=row.episodeLength+.5).slice(0,30);
  const cache=this.store.read<Record<string,any>>('skipTimesCache',{});cache[key]={version:1,time:Date.now(),rows};
  Object.keys(cache).sort((a,b)=>cache[b].time-cache[a].time).slice(60).forEach(k=>delete cache[k]);this.store.write('skipTimesCache',cache);
 }
 prefetch(anime:Anime,episode:Episode){
  const ctx=this.context(anime,episode,0);if(!Number.isSafeInteger(ctx.mal)||ctx.mal<=0||!Number.isFinite(ctx.number)||ctx.number<=0)return;
  void this.fetchTimes(ctx).catch(()=>{});
 }
 async reference(mal:number,number:number,length:number|null){if(!Number.isSafeInteger(mal)||mal<=0)return null;
  const rows=(await this.fetchTimes({mal,number,duration:0,key:''})).filter(r=>r.skipType==='op'&&r.interval&&validIntro(Number(r.interval.startTime),Number(r.interval.endTime),Number(r.episodeLength)+.1)).sort((a,b)=>length?Math.abs(a.interval.endTime-a.interval.startTime-length)-Math.abs(b.interval.endTime-b.interval.startTime-length):0);
  const row=rows[0];return row?{start:Number(row.interval.startTime),end:Number(row.interval.endTime),referenceDuration:Number(row.episodeLength)}:null;
 }
 async loadEnding(ctx:IntroContext,detected?:IntroWindow):Promise<IntroWindow|null>{
  return this.loadExtra(ctx,'ed',detected);
 }
 async proposals(ctx:IntroContext):Promise<SkipProposals>{
  const empty:SkipProposals={opening:null,recap:null,ending:null};
  if(!Number.isSafeInteger(ctx.mal)||ctx.mal<=0||ctx.number<=0)return empty;
  try{const rows=await this.fetchTimes(ctx);
   const pick=(kind:string)=>{
    const candidates=rows.filter(row=>row.skipType===kind&&Number.isFinite(row.episodeLength)&&row.episodeLength>0&&Number.isFinite(row.interval?.startTime)&&Number.isFinite(row.interval?.endTime)&&row.interval.startTime>=0&&row.interval.endTime>row.interval.startTime&&row.interval.endTime<=row.episodeLength+.5).sort((a,b)=>Math.abs(a.episodeLength-ctx.duration)-Math.abs(b.episodeLength-ctx.duration));
    const best=candidates[0];if(!best||candidates.some(row=>Math.abs(Math.abs(row.episodeLength-ctx.duration)-Math.abs(best.episodeLength-ctx.duration))<.5&&(Math.abs(row.interval.startTime-best.interval.startTime)>2||Math.abs(row.interval.endTime-best.interval.endTime)>2)))return null;
    return {start:best.interval.startTime,end:best.interval.endTime,source:'aniskip' as const};
   };
   return {opening:pick('op'),recap:pick('recap'),ending:pick('ed')};
  }catch{return empty;}
 }
 async loadRecap(ctx:IntroContext,detected?:IntroWindow):Promise<IntroWindow|null>{return this.loadExtra(ctx,'recap',detected);}
 async alignment(ctx:IntroContext,kind:'ed'|'recap',opening?:IntroWindow,ending?:IntroWindow):Promise<SkipAlignment>{
  if(!Number.isSafeInteger(ctx.mal)||ctx.mal<=0||!Number.isFinite(ctx.number)||ctx.number<=0||!Number.isFinite(ctx.duration)||ctx.duration<=0)return {state:'unavailable',interval:null,reason:'MAL ID, numero episodio o durata non disponibili.'};
  try{let rows=await this.fetchTimes(ctx);if(!rows.some(r=>r.skipType===kind)||opening&&!rows.some(r=>r.skipType==='op'))rows=await this.fetchTimes({...ctx,duration:0});return alignSkip(ctx,kind,rows,opening,ending);}
  catch{return {state:'unavailable',interval:null,reason:'AniSkip non ? raggiungibile; restano disponibili gli intervalli gi? caricati.'};}
 }
 private async loadExtra(ctx:IntroContext,kind:'ed'|'recap',detected?:IntroWindow):Promise<IntroWindow|null>{return (await this.alignment(ctx,kind,detected)).interval;}

 localSegment(ctx:IntroContext,kind:ExtraSegment):IntroWindow|null{
  const row=this.store.read<Record<string,any>>('skipSegments',{})[ctx.key+'|'+kind];
  return row&&Number.isFinite(row.duration)&&Math.abs(row.duration-ctx.duration)<=2&&Number.isFinite(row.start)&&Number.isFinite(row.end)&&row.start>=0&&row.end>row.start&&row.end<=ctx.duration?{start:row.start,end:row.end,source:'local'}:null;
 }
 saveSegment(ctx:IntroContext,kind:ExtraSegment,start:number,end:number){
  if(!Number.isFinite(ctx.duration)||ctx.duration<=0||!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>ctx.duration)throw Error('Intervallo non valido.');
  const rows=this.store.read<Record<string,any>>('skipSegments',{});rows[ctx.key+'|'+kind]={start,end,duration:ctx.duration,updated:Date.now()};
  Object.keys(rows).sort((a,b)=>rows[b].updated-rows[a].updated).slice(500).forEach(key=>delete rows[key]);
  if(!this.store.write('skipSegments',rows))throw Error('Impossibile salvare il salto.');
 }
 clearSegment(ctx:IntroContext,kind:ExtraSegment){const rows=this.store.read<Record<string,any>>('skipSegments',{});delete rows[ctx.key+'|'+kind];if(!this.store.write('skipSegments',rows))throw Error('Impossibile eliminare il salto.');}
 async checkAvailability(anime:Anime):Promise<boolean>{
  const mal=Number(anime.mal_id),queued=this.badgeJobs.get(mal);if(queued)return queued;
  const result=this.badgeQueue.then(()=>this.probeAvailability(anime));
  this.badgeQueue=result.then(()=>undefined,()=>undefined);this.badgeJobs.set(mal,result);
  try{return await result;}finally{this.badgeJobs.delete(mal);}
 }
 private async probeAvailability(anime:Anime){const mal=Number(anime.mal_id);if(!Number.isSafeInteger(mal)||mal<=0||Date.now()<this.badgeCooldown)return this.hasBadge(anime);
  const existing=this.availability()[mal];if(existing&&Date.now()-existing.checkedAt<(existing.found?7*86400000:6*3600000))return this.hasBadge(anime);
  const episodes=[...new Set([existing?.found?Number(existing.episode):1,1,2,3])];try{for(const number of episodes){if(Date.now()<this.badgeCooldown)break;const rows=await this.fetchTimes({mal,number,duration:0,key:''});if(this.record(mal,number,rows))return true;}
   const data=this.availability();data[mal]={found:false,checkedAt:Date.now()};this.store.write('aniskipAvailability',data);return false;
  }catch{this.badgeCooldown=Math.max(this.badgeCooldown,Date.now()+60000);return false;}
 }
 skipLength(ctx:IntroContext,info:IntroResult){const interval=info.candidate||info.interval;const seconds=interval?interval.end-interval.start:0;
  if(seconds>5&&seconds<=300)return {seconds,exactEpisode:true};const v=this.availability()[ctx.mal];if(v&&v.found&&v.introLength>5&&v.introLength<=300)return {seconds:v.introLength,exactEpisode:Number(v.episode)===ctx.number};return null;
 }
 async load(ctx:IntroContext):Promise<IntroResult>{
  if(!Number.isFinite(ctx.duration)||ctx.duration<=0)return {state:'unavailable',message:'Durata non disponibile.'};
  const local=this.local(ctx);if(local)return local;
  if(!Number.isSafeInteger(ctx.mal)||ctx.mal<=0||!Number.isFinite(ctx.number)||ctx.number<=0)return {state:'unavailable',message:'MAL ID o numero episodio mancante.'};
  try{
   let rows=await this.fetchTimes(ctx);if(!rows.length)rows=await this.fetchTimes({...ctx,duration:0});
   const candidates:IntroCandidate[]=rows.filter(r=>r.skipType==='op'&&Number.isFinite(r.episodeLength)&&r.episodeLength>0&&r.interval&&validIntro(r.interval.startTime,r.interval.endTime,ctx.duration))
    .map(r=>({start:r.interval.startTime,end:r.interval.endTime,referenceDuration:r.episodeLength,delta:Math.abs(r.episodeLength-ctx.duration)})).sort((a,b)=>a.delta-b.delta);
   if(!candidates.length)return {state:'unavailable',message:'Nessun intervallo AniSkip utilizzabile.'};
   const best=candidates[0],ambiguous=candidates.some(r=>r!==best&&Math.abs(r.delta-best.delta)<.5&&(Math.abs(r.start-best.start)>2||Math.abs(r.end-best.end)>2));
   if(best.delta>3||ambiguous)return {state:'review',candidate:best,message:ambiguous?'Intervalli AniSkip discordanti: verifica manualmente.':'Durata differente: verificare prima del salto.'};
   return {state:'ready',source:'aniskip',interval:{start:best.start,end:best.end,source:'aniskip'},candidate:best,message:'Intervallo AniSkip compatibile.'};
  }catch(e){return {state:'unavailable',message:'AniSkip non disponibile: '+(e instanceof Error?e.message:String(e))};}
 }
 // Public facade kept for the Angular playback component.
 async fetch(anime:Anime,episode:Episode,duration:number):Promise<IntroWindow|null>{const r=await this.load(this.context(anime,episode,duration));return r.state==='ready'?r.interval||null:null;}
}
