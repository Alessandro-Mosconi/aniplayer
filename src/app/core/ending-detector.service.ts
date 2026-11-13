import {Injectable} from '@angular/core';
import {Anime,Episode} from './models';
import {StorageService} from './storage.service';
import {AnimeWorldService} from './animeworld.service';
import {INTRO_AUDIO_VERSION,readAudio,inferRepeated,consensus,matchTemplate,Match,Spectrum} from './audio-fingerprint';
import {PackedAudio,packAudio,unpackAudio} from './audio-template';
import {readVideoDuration} from './mp4-duration';
import {IntroWindow} from './intro.service';
interface EndingTemplate extends PackedAudio {version:number;series:string;dub:number;episode:string;remaining:number;updated:number;}

/** Audio repetition only: never claims to distinguish narrative post-credit scenes. */
@Injectable({providedIn:'root'})
export class EndingDetectorService {
 constructor(private store:StorageService,private api:AnimeWorldService){}
 supported(){return typeof (globalThis as any).AudioDecoder==='function'&&typeof (globalThis as any).EncodedAudioChunk==='function';}
 private key(anime:Anime,episode:Episode){return [INTRO_AUDIO_VERSION,anime.awSlug||anime.slug,Number(anime.dub),(episode.malNumber??episode.number)].join('|');}
 saved(anime:Anime,episode:Episode,duration:number):IntroWindow|null{
  const row=this.store.read<Record<string,any>>('endingDetections',{})[this.key(anime,episode)];
  return row&&Number.isFinite(row.start)&&Number.isFinite(row.end)&&Math.abs(row.duration-duration)<=2&&row.start>=duration*.5&&row.end-row.start>=45&&row.end-row.start<=150&&row.end<=duration?{start:row.start,end:row.end,source:row.source==='fingerprint'?'fingerprint':'audio'}:null;
 }
 private templates(anime:Anime,episode:Episode){return Object.values(this.store.read<Record<string,EndingTemplate>>('endingFingerprints',{})).filter(t=>t.version===INTRO_AUDIO_VERSION&&t.series===(anime.awSlug||anime.slug)&&Number(t.dub)===Number(anime.dub)&&t.episode!==String(episode.malNumber??episode.number)&&typeof t.data==='string'&&t.length>=45&&t.length<=150&&Number.isFinite(t.remaining)&&t.remaining>=0&&t.remaining<=300).sort((a,b)=>b.updated-a.updated).slice(0,3);}
 private persist(anime:Anime,episode:Episode,duration:number,current:Spectrum,start:number,end:number,source:'audio'|'fingerprint'):IntroWindow{
  const rows=this.store.read<Record<string,any>>('endingDetections',{});rows[this.key(anime,episode)]={start,end,duration,source,updated:Date.now()};
  Object.keys(rows).sort((a,b)=>rows[b].updated-rows[a].updated).slice(100).forEach(k=>delete rows[k]);this.store.write('endingDetections',rows);
  const packed=packAudio(current,start,end);
  if(packed){const templates=this.store.read<Record<string,EndingTemplate>>('endingFingerprints',{});templates[this.key(anime,episode)]={...packed,series:anime.awSlug||anime.slug||'',dub:Number(anime.dub),episode:String(episode.malNumber??episode.number),version:INTRO_AUDIO_VERSION,remaining:duration-end,updated:Date.now()};Object.keys(templates).sort((a,b)=>templates[b].updated-templates[a].updated).slice(12).forEach(k=>delete templates[k]);this.store.write('endingFingerprints',templates);}
  return {start,end,source};
 }
 async detect(anime:Anime,episode:Episode,duration:number,signal:AbortSignal):Promise<IntroWindow|null>{
  const check=()=>{if(signal.aborted)throw new DOMException('Analisi annullata','AbortError');};
  const page=await this.api.page(anime);check();
  const refs=[...new Map(page.episodes.filter(e=>e.public!==0&&Number(e.number)!==Number(episode.malNumber??episode.number)).map(e=>[Number(e.number),e])).values()].sort((a,b)=>Math.abs(Number(a.number)-Number(episode.malNumber??episode.number))-Math.abs(Number(b.number)-Number(episode.malNumber??episode.number))).slice(0,4);
  const templates=this.templates(anime,episode);if(refs.length<2&&!templates.length)return null;
  const urls=new Map<string,string>();
  const load=async(ep:Episode,length?:number,window?:{start:number;end:number}):Promise<Spectrum>=>{
   check();const key=String(ep.number),url=urls.get(key)||await this.api.source(anime,ep);urls.set(key,url);check();const seconds=length??await readVideoDuration(url,signal);check();
   return readAudio(url,signal,()=>{},window||{start:Math.max(seconds*.5,seconds-300),end:seconds});
  };
  const matchStored=async(current:Spectrum)=>{
   const matches:{start:number;end:number}[]=[];
   for(const t of templates){try{check();const match=await matchTemplate(current,unpackAudio(t),t.length,null,signal);if(match&&match.start>=duration*.5&&match.start+t.length<=duration)matches.push({start:match.start,end:match.start+t.length});}catch{check();}}
   const best=matches[0];return best&&!matches.some(m=>Math.abs(m.start-best.start)>3||Math.abs(m.end-best.end)>3)?best:null;
  };
  if(templates.length){const t=templates[0],window={start:Math.max(duration*.5,duration-t.remaining-t.length-30),end:Math.min(duration,duration-t.remaining+30)};
   if(window.end>window.start){const quick=await load(episode,duration,window),match=await matchStored(quick);if(match){check();return this.persist(anime,episode,duration,quick,match.start,match.end,'fingerprint');}}
  }
  const current=await load(episode,duration),matches:Match[]=[];
  if(templates.length){const match=await matchStored(current);if(match){check();return this.persist(anime,episode,duration,current,match.start,match.end,'fingerprint');}}
  if(refs.length<2)return null;
  for(const ref of refs){
   try{const other=await load(ref);const match=await inferRepeated(current,other,signal);check();if(match)matches.push({...match,episode:String(ref.number)});if(consensus(matches,true))break;}catch{check();}
  }
  const agreed=consensus(matches,true);if(!agreed)return null;
  const start=Math.min(agreed[0].start,agreed[1].start),end=Math.min(agreed[0].end!,agreed[1].end!);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<duration*.5||end>duration||end-start<45||end-start>150)return null;
  check();return this.persist(anime,episode,duration,current,start,end,'audio');
 }
}
