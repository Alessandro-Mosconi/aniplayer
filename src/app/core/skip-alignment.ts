import type {IntroContext,IntroWindow} from './intro.service';
export interface SkipAlignment {
 state:'aligned'|'compatible'|'verified'|'proposal'|'conflict'|'missing'|'unavailable';
 interval:IntroWindow|null;reason:string;offset?:number;reference?:{start:number;end:number;duration:number};
}
const audio=(v?:IntroWindow|null)=>!!v&&['audio','fingerprint'].includes(v.source);
const valid=(r:any)=>Number.isFinite(r?.episodeLength)&&r.episodeLength>0&&Number.isFinite(r.interval?.startTime)&&Number.isFinite(r.interval?.endTime)&&r.interval.startTime>=0&&r.interval.endTime>r.interval.startTime&&r.interval.endTime<=r.episodeLength+.5;
const overlap=(a:number,b:number,c:number,d:number)=>Math.min(b,d)-Math.max(a,c)>1.5;

/** Match a coherent edition first; never translate a conflicting recap into the OP. */
export function alignSkip(ctx:IntroContext,kind:'ed'|'recap',rows:any[],opening?:IntroWindow|null,ending?:IntroWindow|null):SkipAlignment{
 const no=(state:SkipAlignment['state'],reason:string):SkipAlignment=>({state,reason,interval:null});
 const segments=rows.filter(r=>r.skipType===kind&&valid(r));
 if(kind==='ed'&&audio(ending)&&ending!.start>=ctx.duration*.5&&ending!.end<=ctx.duration)return {state:'verified',interval:ending!,reason:'Finale riconosciuta direttamente confrontando l’audio.'};
 if(!segments.length)return no('missing','AniSkip non contiene questo intervallo per l’episodio.');
 let offset=0,referenceDuration=ctx.duration,anchor:any=null;
 if(audio(opening)){
  const length=opening!.end-opening!.start;
  const anchors=rows.filter(r=>r.skipType==='op'&&valid(r)&&Math.abs(r.interval.endTime-r.interval.startTime-length)<=2&&segments.some(s=>Math.abs(s.episodeLength-r.episodeLength)<=.5))
   .map(r=>({...r,offset:opening!.start-r.interval.startTime}));
  // A second independently recognized song can select the correct reference edition.
  const agreesWithEnding=(op:any)=>audio(ending)&&rows.some(ed=>ed.skipType==='ed'&&valid(ed)&&Math.abs(ed.episodeLength-op.episodeLength)<=.5&&Math.abs(ed.interval.endTime-ed.interval.startTime-(ending!.end-ending!.start))<=2&&Math.abs((ending!.start-ed.interval.startTime)-op.offset)<=2);
  const consistent=anchors.filter(agreesWithEnding),pool=consistent.length?consistent:anchors;
  pool.sort((a,b)=>Math.abs(ctx.duration-(a.episodeLength+a.offset))-Math.abs(ctx.duration-(b.episodeLength+b.offset)));
  anchor=pool[0];
  if(!anchor){
   if(kind==='recap'&&segments.every(r=>overlap(r.interval.startTime,r.interval.endTime,opening!.start,opening!.end)))return no('conflict','Il riassunto proposto si sovrappone alla sigla riconosciuta e non c’è un riferimento compatibile per riallinearli.');
   return no('proposal','La sigla riconosciuta non corrisponde alla durata della sigla AniSkip della stessa versione.');
  }
  const conflict=pool.some(r=>r!==anchor&&Math.abs(r.offset-anchor.offset)>2&&(Math.abs(r.episodeLength-anchor.episodeLength)<=.5||Math.abs(Math.abs(ctx.duration-r.episodeLength-r.offset)-Math.abs(ctx.duration-anchor.episodeLength-anchor.offset))<2));
  if(conflict)return no('conflict','Più versioni AniSkip sono plausibili ma richiedono offset diversi.');
  referenceDuration=anchor.episodeLength;offset=anchor.offset;
 }
 const candidates=segments.filter(r=>Math.abs(r.episodeLength-referenceDuration)<=(anchor ? .5 : 3)).map(r=>{
  const start=r.interval.startTime+offset,rawEnd=r.interval.endTime+offset;
  const terminal=kind==='ed'&&Math.abs(r.episodeLength-r.interval.endTime)<=3;
  const end=terminal&&rawEnd>ctx.duration&&rawEnd-ctx.duration<=(anchor?30:3)?ctx.duration:rawEnd;
  return {row:r,start,end,delta:Math.abs(r.episodeLength-referenceDuration)};
 }).sort((a,b)=>a.delta-b.delta);
 if(!candidates.length)return no('proposal','Il video e il riferimento AniSkip hanno durate diverse; non c’è ancora un offset affidabile.');
 const best=candidates[0],reference={start:best.row.interval.startTime,end:best.row.interval.endTime,duration:best.row.episodeLength};
 const rejected=(state:SkipAlignment['state'],reason:string):SkipAlignment=>({...no(state,reason),reference,offset});
 if(candidates.some(r=>Math.abs(r.delta-best.delta)<.5&&(Math.abs(r.start-best.start)>2||Math.abs(r.end-best.end)>2)))return rejected('conflict','AniSkip contiene intervalli discordanti per la stessa versione.');
 if(kind==='recap'){
  const op=anchor?.interval;
  if(op&&overlap(reference.start,reference.end,op.startTime,op.endTime)||audio(opening)&&overlap(best.start,best.end,opening!.start,opening!.end))return rejected('conflict','Il riassunto si sovrappone alla sigla riconosciuta. Il salto del riassunto viene sospeso per non saltare contenuto sbagliato.');
 }
 if(best.start<0||best.end>ctx.duration||best.end<=best.start)return rejected('conflict','Applicando l’offset, l’intervallo esce dai limiti del video.');
 if(kind==='ed'&&(best.start<ctx.duration*.5||best.end-best.start<15||best.end-best.start>300)||kind==='recap'&&(best.end>ctx.duration*.5||best.end-best.start<5||best.end-best.start>600))return rejected('conflict','La posizione o la durata dell’intervallo non è coerente con questo segmento.');
 const clipped=best.end<reference.end+offset;
 return {state:anchor?'aligned':'compatible',interval:{start:best.start,end:best.end,source:'aniskip'},reference,offset,reason:(anchor?'Riallineato usando inizio e fine della sigla riconosciuta.':'Intervallo AniSkip compatibile con la durata del video.')+(clipped?' La fine è limitata alla durata effettiva del file.':'')};
}
