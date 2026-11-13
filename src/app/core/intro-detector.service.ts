import {Injectable} from '@angular/core';
import {Anime,Episode} from './models';
import {StorageService} from './storage.service';
import {AnimeWorldService} from './animeworld.service';
import {IntroService,IntroContext,IntroCandidate,validIntro} from './intro.service';
import {INTRO_AUDIO_VERSION,readAudio,compare,inferRepeated,matchTemplate,searchWindow,consensus,Spectrum,AudioHint,Match} from './audio-fingerprint';
export interface Detection{start:number;end:number;duration:number;version:number;updated:number;state?:'not-found';source?:string;lengthSource?:string;method?:string;hint?:AudioHint|null;[key:string]:any;}
interface Template{version:number;source:string;dub:number;referenceEpisode:string;start:number;length:number;count:number;step:number;data:string;updated:number;id:string;}
@Injectable({providedIn:'root'})
export class IntroDetectorService{
 private cache=new Map<string,{time:number;value:Spectrum}>();
 private readonly version=INTRO_AUDIO_VERSION;
 constructor(private store:StorageService,private api:AnimeWorldService,private aniskip:IntroService){}
 supported(){return typeof (globalThis as any).AudioDecoder==='function'&&typeof (globalThis as any).EncodedAudioChunk==='function';}
 key(anime:Anime,ep:Episode){return [this.version,anime.awSlug||anime.slug,Number(anime.dub),String(ep.number)].join('|');}
 entry(anime:Anime,episode:Episode):Detection|null{
  const key=this.key(anime,episode),detail=this.store.read<Record<string,Detection>>('introDetections',{})[key],prepared=this.store.read<Record<string,Detection>>('introPrepared',{})[key];
  return [detail,prepared].filter(Boolean).sort((a,b)=>b.updated-a.updated)[0]||null;
 }
 saved(ctx:IntroContext,anime:Anime,ep:Episode):Detection|null{
  const entry=this.entry(anime,ep);if(!entry||entry.version!==this.version||!Number.isFinite(entry.duration)||Math.abs(entry.duration-ctx.duration)>2||!validIntro(entry.start,entry.end,ctx.duration))return null;
  return entry;
 }
 notFound(ctx:IntroContext,anime:Anime,ep:Episode){const row=this.entry(anime,ep);return !!row&&row.version===this.version&&row.state==='not-found'&&Math.abs(row.duration-ctx.duration)<=2&&Date.now()-row.updated<7*86400000;}
 forget(anime:Anime,ep:Episode){this.cache.delete(this.key(anime,ep));for(const name of ['introDetections','introPrepared']){
  const rows=this.store.read<Record<string,Detection>>(name,{});delete rows[this.key(anime,ep)];if(!this.store.write(name,rows))throw Error('Non è stato possibile eliminare il rilevamento.');
 }}
 prepare(anime:Anime,ep:Episode,ctx:IntroContext,result:Detection){
  const row:Detection={version:this.version,duration:ctx.duration,episode:String(ep.number),updated:Date.now(),start:result.start,end:result.end};
  if(result.state==='not-found'){row.state='not-found';row.hint=result.hint||null;row.start=NaN;row.end=NaN;}
  else{if(!validIntro(result.start,result.end,ctx.duration))throw Error('Intervallo preparato non valido.');row.lengthSource=result.lengthSource;}
  const rows=this.store.read<Record<string,Detection>>('introPrepared',{});rows[this.key(anime,ep)]=row;
  const keys=Object.keys(rows).sort((a,b)=>rows[b].updated-rows[a].updated);keys.slice(250).forEach(k=>delete rows[k]);
  if(!this.store.write('introPrepared',rows))throw Error('Spazio locale insufficiente per preparare la sigla.');return row;
 }
 private templates(anime:Anime):Template[]{const rows=this.store.read<Record<string,Template>>('introFingerprints',{});return Object.values(rows).filter(t=>[2,this.version].includes(t.version)&&t.source===(anime.awSlug||anime.slug)&&Number(t.dub)===Number(anime.dub)&&typeof t.data==='string'&&t.count>=80&&t.count<=720);}
 private unpack(template:Template):Spectrum{const text=atob(template.data);if(text.length!==template.count*24)throw Error('Impronta audio incompleta.');const frames:(number[]|null)[]=[];
  for(let i=0;i<template.count;i++){const vector:number[]=[];for(let j=0;j<24;j++){const v=text.charCodeAt(i*24+j);vector.push((v>127?v-256:v)/127);}const norm=Math.hypot(...vector);frames.push(norm>.01?vector.map(v=>v/norm):null);}
  return {frames,origin:0,step:.25,seconds:template.count*.25,bytes:0,window:{start:0,end:template.count*.25}};
 }
 private remember(anime:Anime,ep:Episode,current:Spectrum,start:number,end:number){
  const begin=Math.round((start-current.origin)/.25),count=Math.round((end-start)/.25),bytes=new Uint8Array(count*24);
  if(begin<0||count<80||count>720||begin+count>current.frames.length)return null;
  for(let i=0;i<count;i++){const vector=current.frames[begin+i];if(vector)for(let j=0;j<24;j++)bytes[i*24+j]=Math.max(-127,Math.min(127,Math.round(vector[j]*127)));}
  let hash=2166136261;for(const v of bytes){hash^=v;hash=Math.imul(hash,16777619)>>>0;}
  let packed='';for(let i=0;i<bytes.length;i+=4096)packed+=String.fromCharCode(...bytes.subarray(i,i+4096));
  const id='spectral-v'+this.version+'-'+hash.toString(16).padStart(8,'0'),row:Template={id,version:this.version,source:anime.awSlug||anime.slug||'',dub:Number(anime.dub),referenceEpisode:String(ep.number),start,length:end-start,count,step:.25,data:btoa(packed),updated:Date.now()};
  const rows=this.store.read<Record<string,Template>>('introFingerprints',{});rows[row.source+'|'+row.dub+'|'+row.id]=row;
  Object.keys(rows).sort((a,b)=>rows[b].updated-rows[a].updated).slice(12).forEach(k=>delete rows[k]);
  return this.store.write('introFingerprints',rows)?{id,count,bytes:bytes.length}:null;
 }
 private persist(anime:Anime,ep:Episode,ctx:IntroContext,result:any):Detection{
  const entry:Detection={...result,version:this.version,duration:ctx.duration,series:{id:anime.id,mal_id:anime.mal_id,anilist_id:anime.anilist_id,awSlug:anime.awSlug||anime.slug,dub:Number(anime.dub)},episode:String(ep.number),updated:Date.now()};
  const rows=this.store.read<Record<string,Detection>>('introDetections',{});rows[this.key(anime,ep)]=entry;
  Object.keys(rows).sort((a,b)=>rows[b].updated-rows[a].updated).slice(200).forEach(k=>delete rows[k]);
  if(!this.store.write('introDetections',rows))throw Error('Impossibile salvare il riconoscimento audio.');
  if(this.store.read<Record<string,Detection>>('introPrepared',{})[this.key(anime,ep)])this.prepare(anime,ep,ctx,entry);
  return entry;
 }
 rememberNotFound(anime:Anime,ep:Episode,ctx:IntroContext,hint:AudioHint|null){return this.persist(anime,ep,ctx,{state:'not-found',hint:hint?{start:hint.start,end:hint.end}:null});}
 private async load(anime:Anime,ep:Episode,signal:AbortSignal|undefined,hint:AudioHint|null,onProgress:(s:string)=>void,narrow=false){
  const window=searchWindow(hint,narrow),key=this.key(anime,ep),existing=this.cache.get(key);
  if(existing&&Date.now()-existing.time<1800000&&existing.value.window.start<=window.start&&existing.value.window.end>=window.end)return existing.value;
  onProgress('Analisi audio · episodio '+ep.number);const url=await this.api.source(anime,ep);checkAbort(signal);
  const value=await readAudio(url,signal,p=>onProgress('Audio ep. '+ep.number+' · '+Math.floor(p.seconds)+' s · '+Math.round(p.bytes/1024)+' KB'),window);
  this.cache.set(key,{time:Date.now(),value});while(this.cache.size>5)this.cache.delete(this.cache.keys().next().value!);return value;
 }
 /**
  * Uses a verified AniSkip length when available, otherwise discovers a
  * 45–150s repeated segment. Requires 2 agreeing episode comparisons, or
  * a previously verified fingerprint. Inconclusive analysis does not auto-skip.
  */
 async detect(args:{anime:Anime;episode:Episode;context:IntroContext;length:number|null;hint:AudioHint|null;signal?:AbortSignal;onProgress?:(s:string)=>void}):Promise<Detection>{
  if(args.hint||this.templates(args.anime).length){
   try{return await this.detectPass(args,true);}catch{checkAbort(args.signal);args.onProgress?.('Ricerca audio estesa…');}
  }
  return this.detectPass(args,false);
 }
 private async detectPass(args:{anime:Anime;episode:Episode;context:IntroContext;length:number|null;hint:AudioHint|null;signal?:AbortSignal;onProgress?:(s:string)=>void},narrow:boolean):Promise<Detection>{
  const {anime,episode,context,length,hint,signal}=args,onProgress=args.onProgress||(()=>{}),infer=length===null;
  if(!infer&&(!Number.isFinite(length)||length<20||length>180))throw Error('Durata intro non supportata (20–180 s).');
  checkAbort(signal);const page=await this.api.page(anime),others=page.episodes.filter(e=>Number(e.number)!==Number(episode.malNumber??episode.number)&&e.public!==0);
  const next=others.filter(e=>Number(e.number)>Number(episode.malNumber??episode.number)).sort((a,b)=>Number(a.number)-Number(b.number)),
   previous=others.filter(e=>Number(e.number)<Number(episode.malNumber??episode.number)).sort((a,b)=>Number(b.number)-Number(a.number));const refs:Episode[]=[];
  for(let i=0;refs.length<4&&(i<next.length||i<previous.length);i++){if(next[i])refs.push(next[i]);if(previous[i]&&refs.length<4)refs.push(previous[i]);}
  if(refs.length<2&&!this.templates(anime).length)throw Error('Servono due altri episodi o un’impronta audio locale verificata.');
  const latest=this.templates(anime).sort((a,b)=>b.updated-a.updated)[0],seed=hint||(latest?{start:latest.start,end:latest.start+latest.length}:null);
  const current=await this.load(anime,episode,signal,narrow?seed:hint,onProgress,narrow);const templates:({template:Template}&Match)[]=[];
  for(const t of this.templates(anime)){
   checkAbort(signal);if(t.referenceEpisode===String(episode.malNumber??episode.number))continue;
   onProgress('Confronto con impronta audio locale');try{const match=await matchTemplate(current,this.unpack(t),t.length,length,signal);if(match)templates.push({...match,template:t});}catch(e){checkAbort(signal);}
  }
  templates.sort((a,b)=>b.score-a.score);const best=templates[0];
  if(best&&!templates.some(t=>Math.abs(t.start-best.start)>3||infer&&Math.abs(t.template.length-best.template.length)>6)){
   const start=best.start,end=start+(infer?best.template.length:length);
   if(validIntro(start,end,context.duration))return this.persist(anime,episode,context,{start,end,lengthSource:infer?'impronta locale':'AniSkip',method:'template',fingerprint:{id:best.template.id},score:best.score,bytes:current.bytes});
  }
  if(refs.length<2)throw Error('Servono almeno due episodi di confronto.');
  const matches:Match[]=[],errors:string[]=[],attempts:any[]=[];let bytes=current.bytes;
  for(const ref of refs){
   try{checkAbort(signal);let anchor:AudioHint|null=null;
    if(context.mal>0)try{anchor=await this.aniskip.reference(context.mal,Number(ref.number),length);}catch(e){checkAbort(signal);}
    const other=await this.load(anime,ref,signal,narrow?(anchor||seed):anchor,onProgress,narrow);bytes+=other.bytes;
    onProgress('Confronto episodi '+episode.number+' / '+ref.number);
    const match=infer?await inferRepeated(current,other,signal):await compare(current,other,length!,signal);
    attempts.push({episode:String(ref.number),matched:!!match});if(match)matches.push({...match,episode:String(ref.number)});
    if(consensus(matches,infer))break;
   }catch(e){checkAbort(signal);errors.push(e instanceof Error?e.message:String(e));attempts.push({episode:String(ref.number),error:errors[errors.length-1]});}
  }
  const agreed=consensus(matches,infer);
  if(!agreed){if(errors.length)throw Error('Analisi incompleta: '+errors[0]);throw new Error('Intro non individuata: nessuna corrispondenza concorde.');}
  const uncertainty=Math.abs(agreed[0].start-agreed[1].start),start=Math.min(agreed[0].start,agreed[1].start),end=infer?Math.min(agreed[0].end!,agreed[1].end!):start+length!;
  if(!validIntro(start,end,context.duration))throw Error('Intervallo riconosciuto fuori dal video.');
  checkAbort(signal);const fingerprint=this.remember(anime,episode,current,start,end);
  return this.persist(anime,episode,context,{start,end,length:end-start,lengthSource:infer?'audio':'AniSkip',method:'episodes',uncertainty,fingerprint,score:Math.min(...agreed.map(m=>m.score)),matches:agreed,attempts,bytes});
 }
}
function checkAbort(signal?:AbortSignal){if(signal?.aborted)throw new DOMException('Analisi annullata','AbortError');}
