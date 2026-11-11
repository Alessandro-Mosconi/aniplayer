/**
 * Conservatively recognizes repeated *audio* between episodes, not song names.
 * Port of the original 0.25s/24-band FFT architecture. Analysis requires
 * WebCodecs AAC, HTTP 206 and CORS; the TV remains functional without them.
 */
export const INTRO_AUDIO_VERSION=3;
const STEP=.25,MAX_BYTES=32*1024*1024,MAX_SECONDS=360;
const tick=()=>new Promise<void>(r=>setTimeout(r,0));
const check=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Analisi interrotta','AbortError');};
export type Frame=number[]|null;
export interface Spectrum{frames:Frame[];origin:number;step:number;seconds:number;bytes:number;window:{start:number;end:number};}
export interface AudioHint{start:number;end:number;}
export interface Match{start:number;end?:number;otherStart:number;score:number;coverage:number;temporalContrast:number;templateMatch?:string;episode?:string;}
export function searchWindow(hint?:AudioHint|null,narrow=false){if(hint&&Number.isFinite(hint.start)&&Number.isFinite(hint.end)&&hint.start>=0&&hint.end>hint.start&&hint.end-hint.start<=180){const margin=narrow?30:90,start=Math.max(0,hint.start-margin);return {start,end:Math.min(start+MAX_SECONDS,hint.end+margin)};}return {start:0,end:MAX_SECONDS};}
export class SpectralFrames{
 private stride:number;private rate:number;private phase=0;private bin=-1;private samples:number[]=[];private frames:Frame[]=[];
 private readonly size=2048;private readonly window:number[];private readonly bands:number[];
 constructor(rate:number){this.stride=Math.max(1,Math.round(rate/11025));this.rate=rate/this.stride;
  this.window=Array.from({length:this.size},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(this.size-1)));
  this.bands=Array.from({length:25},(_,i)=>Math.max(1,Math.round(80*Math.pow(4500/80,i/24)*this.size/this.rate)));
 }
 push(pcm:Float32Array,time:number,rate:number){for(let i=0;i<pcm.length;i++){
  if(this.phase++%this.stride)continue;const bin=Math.floor((time+i/rate)/STEP);if(bin<0)continue;
  if(bin!==this.bin){this.flush();this.bin=bin;}this.samples.push(pcm[i]);
 }}
 private flush(){if(this.bin<0||!this.samples.length)return;const pcm=this.samples,n=pcm.length;let rms=0;for(const x of pcm)rms+=x*x;
  if(n<this.rate*STEP*.65||Math.sqrt(rms/n)<.0001){this.frames[this.bin]=null;this.samples=[];return;}
  const size=this.size,real=new Float64Array(size),imag=new Float64Array(size),offset=Math.max(0,Math.floor((n-size)/2));
  for(let i=0;i<size;i++)real[i]=(pcm[offset+i]||0)*this.window[i];
  for(let i=1,j=0;i<size;i++){let bit=size>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){const v=real[i];real[i]=real[j];real[j]=v;}}
  for(let length=2;length<=size;length<<=1){const angle=-2*Math.PI/length,wr=Math.cos(angle),wi=Math.sin(angle);
   for(let base=0;base<size;base+=length){let ur=1,ui=0;for(let j=0;j<length/2;j++){
    const a=base+j,b=a+length/2,tr=ur*real[b]-ui*imag[b],ti=ur*imag[b]+ui*real[b];real[b]=real[a]-tr;imag[b]=imag[a]-ti;real[a]+=tr;imag[a]+=ti;
    const next=ur*wr-ui*wi;ui=ur*wi+ui*wr;ur=next;
   }}
  }
  const values:number[]=[];for(let band=0;band<24;band++){let power=0;for(let bin=this.bands[band];bin<this.bands[band+1]&&bin<size/2;bin++)power+=real[bin]*real[bin]+imag[bin]*imag[bin];values.push(Math.log(1e-12+power));}
  const mean=values.reduce((a,b)=>a+b,0)/values.length;let norm=0;for(let i=0;i<values.length;i++){values[i]-=mean;norm+=values[i]*values[i];}
  this.frames[this.bin]=norm>1e-10?values.map(v=>v/Math.sqrt(norm)):null;this.samples=[];
 }
 finish(){this.flush();return this.frames;}
}
export async function readAudio(url:string,signal?:AbortSignal,onProgress:(p:{seconds:number;bytes:number})=>void=()=>{},window:{start:number;end:number}={start:0,end:MAX_SECONDS}):Promise<Spectrum>{
 check(signal);const Decoder=(globalThis as any).AudioDecoder,Chunk=(globalThis as any).EncodedAudioChunk;
 if(typeof Decoder!=='function'||typeof Chunk!=='function')throw Error('WebCodecs AudioDecoder non disponibile sul dispositivo.');
 const from=window.start,to=window.end;
 if(!Number.isFinite(from)||!Number.isFinite(to)||from<0||to<=from||to-from>MAX_SECONDS+.01)throw Error('Finestra audio non valida.');
 const address=new URL(url);if(address.protocol!=='https:'||address.username||address.password)throw Error('Audio non HTTPS.');
 let downloaded=0,requests=0,decoder:any,decodeError:unknown;
 const range=async(start:number,end:number):Promise<Uint8Array>=>{
  check(signal);const length=end-start+1;
  if(!Number.isSafeInteger(start)||start<0||length<=0||downloaded+length>MAX_BYTES||requests>=600)throw Error('Limite traffico audio raggiunto.');
  const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,12000);signal?.addEventListener('abort',abort,{once:true});
  try{const r=await fetch(address.href,{mode:'cors',credentials:'omit',headers:{Range:`bytes=${start}-${end}`},signal:controller.signal});
   if(r.status!==206){await r.body?.cancel();throw Error('HTTP Range non supportato (HTTP '+r.status+').');}
   const cr=/^bytes (\d+)-(\d+)\//.exec(r.headers.get('content-range')||'');if(cr&&Number(cr[1])!==start){await r.body?.cancel();throw Error('Content-Range errato.');}
   if(Number(r.headers.get('content-length'))>length){await r.body?.cancel();throw Error('Range oltre il limite.');}
   const reader=r.body?.getReader();if(!reader)throw Error('Body Range non leggibile.');const parts:Uint8Array[]=[];let count=0;
   while(true){check(signal);const p=await reader.read();if(p.done)break;count+=p.value.byteLength;if(count>length){await reader.cancel();throw Error('Range troppo grande.');}parts.push(p.value);}
   const buf=new Uint8Array(count);let at=0;for(const p of parts){buf.set(p,at);at+=p.length;}downloaded+=count;requests++;return buf;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 };
 // Multiple byte ranges avoid transferring empty gaps between AAC chunks.
 // Some CDNs do not support multipart/byteranges: fall back to bounded single ranges.
 type Segment={start:number;end:number;data:Uint8Array};
 const multiRange=async(ranges:{start:number;end:number}[]):Promise<Segment[]>=>{
  if(ranges.length===1){const r=ranges[0];return [{start:r.start,end:r.end,data:await range(r.start,r.end)}];}
  check(signal);const requested=ranges.reduce((sum,r)=>sum+r.end-r.start+1,0),limit=requested+32768;
  if(downloaded+limit>MAX_BYTES||requests>=600)throw Error('Limite dati o richieste audio raggiunto.');
  const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,12000);
  signal?.addEventListener('abort',abort,{once:true});
  try{
   const res=await fetch(address.href,{mode:'cors',credentials:'omit',headers:{Range:'bytes='+ranges.map(r=>r.start+'-'+r.end).join(',')},signal:controller.signal});
   const boundary=/boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(res.headers.get('content-type')||'');
   if(res.status!==206||!boundary){await res.body?.cancel();throw Error('HTTP Range multiple non supportate.');}
   const reader=res.body?.getReader();if(!reader)throw Error('Range multipart senza body.');
   const chunks:Uint8Array[]=[];let size=0;
   while(true){check(signal);const part=await reader.read();if(part.done)break;size+=part.value.length;
    if(size>limit){await reader.cancel();throw Error('HTTP multipart troppo grande.');}chunks.push(part.value);
   }
   const bytes=new Uint8Array(size);let at=0;for(const part of chunks){bytes.set(part,at);at+=part.length;}
   const marker=new TextEncoder().encode('--'+(boundary[1]||boundary[2])),separator=new Uint8Array([13,10,13,10]);
   const find=(needle:Uint8Array,start:number)=>{outer:for(let i=start;i<=bytes.length-needle.length;i++){
    for(let j=0;j<needle.length;j++)if(bytes[i+j]!==needle[j])continue outer;return i;
   }return -1;};
   const found:Segment[]=[];let position=find(marker,0);
   while(position>=0){const from=position+marker.length;
    if(bytes[from]===45&&bytes[from+1]===45)break;
    const headerEnd=find(separator,from);if(headerEnd<0||headerEnd-from>2048)throw Error('Header multipart non valido.');
    const header=new TextDecoder().decode(bytes.subarray(from,headerEnd));
    const match=/content-range:\s*bytes\s+(\d+)-(\d+)\//i.exec(header);
    if(!match)throw Error('Content-Range multipart assente.');
    const start=Number(match[1]),end=Number(match[2]),dataStart=headerEnd+4,length=end-start+1;
    if(!Number.isSafeInteger(start)||length<=0||dataStart+length>bytes.length)throw Error('Blocco AAC multipart incompleto.');
    found.push({start,end,data:bytes.subarray(dataStart,dataStart+length)});
    position=find(marker,dataStart+length);
   }
   if(!ranges.every(r=>found.some(p=>p.start<=r.start&&p.end>=r.end)))throw Error('Alcuni Range AAC non sono stati restituiti.');
   downloaded+=size;requests++;return found;
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 };
 const type=(v:DataView,p:number)=>String.fromCharCode(v.getUint8(p),v.getUint8(p+1),v.getUint8(p+2),v.getUint8(p+3));
 const wide=(v:DataView,p:number)=>{const n=v.getUint32(p)*4294967296+v.getUint32(p+4);if(!Number.isSafeInteger(n))throw Error('MP4 con offset troppo grande.');return n;};
 type Box={type:string;p:number;start:number;end:number};
 try{
  let offset=0,moov:Uint8Array|undefined,headerSize=8;
  for(let n=0;n<20;n++){const head=new DataView((await range(offset,offset+15)).buffer),kind=type(head,4);let size=head.getUint32(0);headerSize=8;
   if(size===1){size=wide(head,8);headerSize=16;}if(size<headerSize)throw Error('MP4 non riconosciuto.');
   if(kind==='moov'){if(size>4*1024*1024)throw Error('Metadati MP4 troppo grandi.');moov=await range(offset,offset+size-1);break;}offset+=size;
  }
  if(!moov)throw Error('moov MP4 non trovato.');const view=new DataView(moov.buffer,moov.byteOffset,moov.byteLength),bytes=moov;
  const boxes=(start:number,end:number):Box[]=>{const rows:Box[]=[];for(let p=start;p+8<=end;){let size=view.getUint32(p),h=8;if(size===1){size=wide(view,p+8);h=16;}if(size===0)size=end-p;
   if(size<h||p+size>end)throw Error('MP4 incompleto.');rows.push({type:type(view,p+4),p,start:p+h,end:p+size});p+=size;}return rows;};
  const child=(box:Box|undefined,kind:string):Box|undefined=>box?boxes(box.start,box.end).find(b=>b.type===kind):undefined;
  const root:Box={type:'moov',p:0,start:headerSize,end:moov.byteLength},mvhd=child(root,'mvhd'),movieScale=mvhd?view.getUint32(mvhd.start+(bytes[mvhd.start]===1?20:12)):0;
  let track:Box|undefined,trak:Box|undefined;
  for(const item of boxes(root.start,root.end).filter(b=>b.type==='trak')){const mdia=child(item,'mdia'),hdlr=child(mdia,'hdlr');if(hdlr&&type(view,hdlr.start+8)==='soun'){track=mdia;trak=item;break;}}
  if(!track)throw Error('Traccia audio MP4 non trovata.');const mdhd=child(track,'mdhd');if(!mdhd)throw Error('mdhd mancante.');
  const scale=view.getUint32(mdhd.start+(bytes[mdhd.start]===1?20:12)),stbl=child(child(track,'minf'),'stbl'),stsd=child(stbl,'stsd');
  if(!stsd||!stbl)throw Error('stsd mancante.');const entry=boxes(stsd.start+8,stsd.end).find(b=>b.type==='mp4a');if(!entry)throw Error('Solo MP4 con audio AAC è supportato.');
  const channels=view.getUint16(entry.p+24),sampleRate=view.getUint32(entry.p+32)>>>16,esds=boxes(entry.p+36,entry.end).find(b=>b.type==='esds');
  if(!esds||!sampleRate)throw Error('AAC esds non riconosciuto.');
  const descriptor=(start:number)=>{const tag=bytes[start++];let length=0,b=0,n=0;do{if(++n>4||start>=esds.end)throw Error('Descrittore AAC non valido.');b=bytes[start++];length=length*128+(b&127);}while(b&128);
   if(start+length>esds.end)throw Error('Descrittore AAC incompleto.');return {tag,start,end:start+length};};
  const es=descriptor(esds.start+4);let p=es.start+3,flags=bytes[es.start+2];if(flags&128)p+=2;if(flags&64)p+=1+bytes[p];if(flags&32)p+=2;
  const config=descriptor(p),specific=config.tag===4?descriptor(config.start+13):null;
  if(!specific||specific.tag!==5)throw Error('Configurazione AAC assente.');
  const description=bytes.slice(specific.start,specific.end);if(description[0]>>>3!==2)throw Error('AAC non-LC non supportato.');
  const stts=child(stbl,'stts');if(!stts)throw Error('Tempi AAC non trovati.');
  const timings:{first:number;ticks:number;delta:number}[]=[];let totalSamples=0,totalTicks=0,sampleDelta=0;
  for(let i=0;i<view.getUint32(stts.start+4);i++){const count=view.getUint32(stts.start+8+i*8),delta=view.getUint32(stts.start+12+i*8);if(!count||!delta)throw Error('Tempi AAC invalidi.');
   if(!sampleDelta)sampleDelta=delta;timings.push({first:totalSamples,ticks:totalTicks,delta});totalSamples+=count;totalTicks+=count*delta;
  }if(!scale||!sampleDelta)throw Error('Tempi AAC invalidi.');const sampleSeconds=sampleDelta/scale;
  let timeOffset=0;const elst=child(child(trak,'edts'),'elst');
  if(elst){if(bytes[elst.start]!==0||!movieScale)throw Error('Edit list MP4 non supportata.');
   for(let i=0;i<view.getUint32(elst.start+4);i++){const at=elst.start+8+i*12,duration=view.getUint32(at),mediaTime=view.getInt32(at+4);
    if(view.getInt16(at+8)!==1||view.getUint16(at+10)!==0)throw Error('Edit list a velocità variabile.');
    if(mediaTime===-1)timeOffset+=duration/movieScale;else{timeOffset-=mediaTime/scale;break;}
   }
  }
  const stco=child(stbl,'stco')||child(stbl,'co64'),stsc=child(stbl,'stsc'),stsz=child(stbl,'stsz');if(!stco||!stsc||!stsz)throw Error('MP4 frammentato non supportato.');
  const fixed=view.getUint32(stsz.start+4),sampleCount=view.getUint32(stsz.start+8),rules:{first:number;count:number}[]=[];
  if(sampleCount>1000000)throw Error('Troppe unità AAC.');for(let i=0;i<view.getUint32(stsc.start+4);i++)rules.push({first:view.getUint32(stsc.start+8+i*12),count:view.getUint32(stsc.start+12+i*12)});
  const sampleAt=(time:number)=>{const ticks=Math.max(0,(time-timeOffset)*scale);let timing=timings[0];for(const item of timings){if(item.ticks>ticks)break;timing=item;}
   return Math.min(sampleCount,Math.max(0,timing.first+Math.floor((ticks-timing.ticks)/timing.delta)));
  };
  const chunks:{position:number;end:number;sizes:number[];firstSample:number}[]=[];let count=0,ruleIndex=0;
  const minSample=Math.max(0,sampleAt(from)-32),maxSample=Math.min(sampleCount,sampleAt(to)+1);
  for(let i=0;i<view.getUint32(stco.start+4)&&count<maxSample&&count<sampleCount;i++){
   while(ruleIndex+1<rules.length&&rules[ruleIndex+1].first<=i+1)ruleIndex++;const rule=rules[ruleIndex];if(!rule||rule.first>i+1||!rule.count)throw Error('Mappa campioni AAC non valida.');
   let position=stco.type==='stco'?view.getUint32(stco.start+8+i*4):wide(view,stco.start+8+i*8);const sizes:number[]=[],firstSample=Math.max(count,minSample);
   for(let j=0;j<rule.count&&count<maxSample&&count<sampleCount;j++,count++){
    const size=fixed||view.getUint32(stsz.start+12+count*4);if(!size||size>262144)throw Error('Campione AAC non valido.');
    if(count<minSample)position+=size;else sizes.push(size);
   }if(sizes.length)chunks.push({position,sizes,firstSample,end:position+sizes.reduce((a,b)=>a+b,0)});
  }
  if(!chunks.length)throw Error('Nessun campione AAC disponibile.');
  const supported=await Decoder.isConfigSupported({codec:'mp4a.40.2',sampleRate,numberOfChannels:channels,description});if(!supported.supported)throw Error('Decodifica AAC non supportata.');
  const profiles=new SpectralFrames(sampleRate);
  decoder=new Decoder({output:(frame:any)=>{try{const pcm=new Float32Array(frame.numberOfFrames);frame.copyTo(pcm,{planeIndex:0,format:'f32-planar'});profiles.push(pcm,frame.timestamp/1e6,frame.sampleRate);}catch(e){decodeError=e;}finally{frame.close();}},error:(e:unknown)=>{decodeError=e;}});
  decoder.configure(supported.config);let decoded=0,timingIndex=0;
  let useMulti=true;
  for(let i=0;i<chunks.length;){check(signal);const first=chunks[i];let endIndex=i,parts:Segment[]|null=null;
   if(useMulti){endIndex=Math.min(chunks.length-1,i+31);
    const ranges:{start:number;end:number}[]=[];
    for(let j=i;j<=endIndex;j++){const c=chunks[j],last=ranges[ranges.length-1];
     if(last&&c.position===last.end+1)last.end=c.end-1;
     else ranges.push({start:c.position,end:c.end-1});
    }
    try{parts=await multiRange(ranges);}catch(e){check(signal);useMulti=false;endIndex=i;}
   }
   if(!parts){let end=first.end;
    while(endIndex+1<chunks.length&&chunks[endIndex+1].position>=end&&chunks[endIndex+1].end-first.position<=512*1024){endIndex++;end=chunks[endIndex].end;}
    if(downloaded+end-first.position>MAX_BYTES)throw Error('Budget byte audio esaurito.');
    parts=[{start:first.position,end:end-1,data:await range(first.position,end-1)}];
   }
   for(;i<=endIndex;i++){const chunk=chunks[i],part=parts.find(p=>p.start<=chunk.position&&p.end>=chunk.end-1);
    if(!part)throw Error('Campione AAC mancante dal Range.');let at=chunk.position-part.start;
    for(let n=0;n<chunk.sizes.length;n++){
     check(signal);const sample=chunk.firstSample+n;
     while(timingIndex+1<timings.length&&timings[timingIndex+1].first<=sample)timingIndex++;
     const timing=timings[timingIndex],size=chunk.sizes[n],timestamp=Math.round(((timing.ticks+(sample-timing.first)*timing.delta)/scale+timeOffset)*1e6);
     decoder.decode(new Chunk({type:'key',timestamp,data:part.data.subarray(at,at+size)}));at+=size;decoded++;
     if(decoder.decodeQueueSize>=64){await decoder.flush();if(decodeError)throw decodeError;await tick();}
    }
   }
   onProgress({seconds:decoded*sampleSeconds,bytes:downloaded});await tick();
  }
  await decoder.flush();if(decodeError)throw decodeError;
  const frames=profiles.finish();const firstBin=frames.findIndex((_,i)=>i in frames),slice=frames.slice(Math.max(0,firstBin));
  if(slice.filter(Boolean).length<80)throw Error('Audio utile insufficiente per il confronto.');
  return {frames:slice,origin:Math.max(0,firstBin)*STEP,step:STEP,seconds:slice.length*STEP,bytes:downloaded,window:{start:from,end:to}};
 }finally{if(decoder&&decoder.state!=='closed')decoder.close();}
}
const dot=(a:Frame|undefined,b:Frame|undefined)=>{if(!a||!b)return -1;let score=0;for(let k=0;k<a.length;k++)score+=a[k]*b[k];return score;};
export function consensus(matches:Match[],infer=false):[Match,Match]|null{let best:null|[Match,Match]=null,quality=-1;
 for(let i=0;i<matches.length;i++)for(let j=i+1;j<matches.length;j++){
  const a=matches[i],b=matches[j];if(a.episode===b.episode||Math.abs(a.start-b.start)>6||infer&&Math.abs((a.end||0)-(b.end||0))>8)continue;
  const score=Math.min(a.score,b.score);if(score>quality){quality=score;best=[a,b];}
 }return best;
}
/** Full-window diagonal matcher: 90% valid frames, 80% >=0.50, score >=0.60. */
export async function compare(left:Spectrum,right:Spectrum,length:number,signal?:AbortSignal):Promise<Match|null>{
 const a=left.frames,b=right.frames,window=Math.round(length/STEP),results:Match[]=[];
 if(window<80||window>Math.min(a.length,b.length))return null;
 for(let shift=-b.length+window;shift<=a.length-window;shift++){
  if(shift%16===0){check(signal);await tick();}const ai=Math.max(0,shift),bi=Math.max(0,-shift),count=Math.min(a.length-ai,b.length-bi);
  let sum=0,good=0,valid=0,best:Match|null=null;const scores:number[]=[];
  for(let k=0;k<count;k++){const score=dot(a[ai+k],b[bi+k]);scores.push(score);if(score>=0){sum+=score;valid++;if(score>=.5)good++;}
   if(k>=window){const old=scores[k-window];if(old>=0){sum-=old;valid--;if(old>=.5)good--;}}
   if(k+1<window||valid<window*.9||good<window*.8)continue;
   const quality=sum/window;
   if(quality>=.60&&(!best||quality>best.score+1e-8))best={start:(ai+k-window+1)*STEP,otherStart:(bi+k-window+1)*STEP,score:quality,coverage:good/window,temporalContrast:0};
  }if(best)results.push(best);
 }
 results.sort((a,b)=>b.score-a.score);const best=results[0];if(!best)return null;
 const competitor=results.find(r=>Math.abs(r.start-best.start)>Math.max(5,length*.5));if(competitor&&best.score-competitor.score<.10)return null;
 const peakStart=best.start,peakOther=best.otherStart,peakScore=best.score;
 for(let back=1;back<=16;back++){
  const start=peakStart-back*STEP,other=peakOther-back*STEP;if(start<0||other<0)break;
  let sum=0,good=0,valid=0;for(let i=0;i<window;i++){const score=dot(a[Math.round(start/STEP)+i],b[Math.round(other/STEP)+i]);if(score>=0){sum+=score;valid++;if(score>=.5)good++;}}
  if(valid>=window*.9&&good>=window*.8&&sum/window>=peakScore-.01){best.start=start;best.otherStart=other;best.score=sum/window;best.coverage=good/window;}
 }
 let scrambled=0;for(let i=0;i<window;i++)scrambled+=Math.max(0,dot(a[Math.round(best.start/STEP)+i],b[Math.round(best.otherStart/STEP)+(i*53)%window]));
 best.temporalContrast=best.score-scrambled/window;if(best.temporalContrast<.12)return null;
 return {...best,start:best.start+left.origin,otherStart:best.otherStart+right.origin};
}
export async function inferRepeated(left:Spectrum,right:Spectrum,signal?:AbortSignal):Promise<Match|null>{
 const a=left.frames,b=right.frames,candidates:(Match&{weight:number})[]=[],smooth=8,gap=12;
 for(let shift=-b.length+180;shift<=a.length-180;shift++){
  if(shift%16===0){check(signal);await tick();}const ai=Math.max(0,shift),bi=Math.max(0,-shift),count=Math.min(a.length-ai,b.length-bi),scores:number[]=[];
  let rolling=0,runStart=-1,lastGood=-1;
  const finish=()=>{if(runStart<0)return;const start=runStart,end=lastGood+1,frames=end-start,seconds=frames*STEP;runStart=-1;
   if(seconds<45||seconds>150)return;let sum=0,good=0,scrambled=0;
   for(let i=0;i<frames;i++){const score=Math.max(0,scores[start+i]);sum+=score;if(score>=.5)good++;scrambled+=Math.max(0,dot(a[ai+start+i],b[bi+start+(i*53)%frames]));}
   const score=sum/frames,contrast=score-scrambled/frames;if(score<.6||good/frames<.75||contrast<.12)return;
   candidates.push({start:(ai+start)*STEP,end:(ai+end)*STEP,otherStart:(bi+start)*STEP,score,coverage:good/frames,temporalContrast:contrast,weight:seconds*score});
  };
  for(let k=0;k<count;k++){const score=Math.max(0,dot(a[ai+k],b[bi+k]));scores.push(score);rolling+=score;if(k>=smooth)rolling-=scores[k-smooth];
   if(k>=smooth-1&&rolling/smooth>=.58){if(runStart<0)runStart=k-smooth+1;lastGood=k;}else if(runStart>=0&&k-lastGood>gap)finish();
  }finish();
 }
 candidates.sort((a,b)=>b.weight-a.weight);const best=candidates[0];if(!best)return null;
 const other=candidates.find(c=>Math.min(c.end||0,best.end||0)-Math.max(c.start,best.start)<((best.end||0)-best.start)*.5);
 if(other&&other.weight>best.weight*.9)return null;
 return {...best,start:best.start+left.origin,end:(best.end||0)+left.origin,otherStart:best.otherStart+right.origin};
}
export async function matchTemplate(current:Spectrum,template:Spectrum,length:number,targetLength:number|null,signal?:AbortSignal):Promise<Match|null>{
 const wanted=targetLength??length;if(Math.abs(length-wanted)>Math.max(15,wanted*.2))return null;
 const aligned=(m:Match|null)=>{if(!m)return null;const start=m.start-m.otherStart;if(start< -2)return null;return {...m,start:Math.max(0,start)};};
 const full=aligned(await compare(current,template,Math.min(length,wanted),signal));if(full)return {...full,templateMatch:'full'};
 if(length<80)return null;
 const core=24,offsets=[length*.1,Math.min(length-core,length*.65)],matches:Match[]=[];
 for(const offset of offsets){const from=Math.round(offset/STEP),part={...template,frames:template.frames.slice(from,from+Math.round(core/STEP)),origin:from*STEP};
  const m=aligned(await compare(current,part,core,signal));if(!m||m.score<.78||m.coverage<.85||m.temporalContrast<.18)return null;matches.push(m);
 }
 if(Math.abs(matches[0].start-matches[1].start)>1)return null;
 return {start:Math.min(...matches.map(m=>m.start)),otherStart:0,score:Math.min(...matches.map(m=>m.score)),coverage:Math.min(...matches.map(m=>m.coverage)),temporalContrast:Math.min(...matches.map(m=>m.temporalContrast)),templateMatch:'two-sections'};
}
