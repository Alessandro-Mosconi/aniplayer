/** MP4 duration from moov/mvhd, without AVPlay or downloading the full video. */
export async function readVideoDuration(url:string,signal?:AbortSignal):Promise<number>{
 const address=new URL(url);if(address.protocol!=='https:'||address.username||address.password)throw Error('Video HTTPS non valido.');
 const read=async(start:number,size:number)=>{
  if(signal?.aborted)throw new DOMException('Operazione annullata','AbortError');
  if(size<8||size>4*1024*1024)throw Error('Metadati MP4 oltre il limite.');
  const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,12000);signal?.addEventListener('abort',abort,{once:true});
  try{const r=await fetch(address.href,{credentials:'omit',mode:'cors',headers:{Range:`bytes=${start}-${start+size-1}`},signal:controller.signal});
   if(r.status!==206){await r.body?.cancel();throw Error('Il server non supporta Range (HTTP '+r.status+').');}
   const cr=/^bytes (\d+)-(\d+)\//.exec(r.headers.get('content-range')||'');if(cr&&Number(cr[1])!==start)throw Error('Range MP4 non corrispondente.');
   if(Number(r.headers.get('content-length'))>size){await r.body?.cancel();throw Error('Metadati MP4 oltre il limite.');}
   const reader=r.body?.getReader();if(!reader)throw Error('Body Range non disponibile.');const parts:Uint8Array[]=[];let count=0;
   while(true){if(signal?.aborted)throw new DOMException('Annullato','AbortError');const p=await reader.read();if(p.done)break;count+=p.value.byteLength;if(count>size){await reader.cancel();throw Error('Metadati MP4 troppo grandi.');}parts.push(p.value);}
   const data=new Uint8Array(count);let at=0;for(const p of parts){data.set(p,at);at+=p.length;}return new DataView(data.buffer);
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 };
 const wide=(v:DataView,p:number)=>{const n=v.getUint32(p)*4294967296+v.getUint32(p+4);if(!Number.isSafeInteger(n))throw Error('Offset MP4 non sicuro.');return n;};
 const kind=(v:DataView,p:number)=>String.fromCharCode(v.getUint8(p),v.getUint8(p+1),v.getUint8(p+2),v.getUint8(p+3));
 let offset=0;
 for(let i=0;i<24;i++){
  const header=await read(offset,16);if(header.byteLength<16)throw Error('Header MP4 incompleto.');let size=header.getUint32(0),skip=8;if(size===1){size=wide(header,8);skip=16;}
  if(size<skip)throw Error('MP4 progressivo non riconosciuto.');
  if(kind(header,4)==='moov'){
   const data=await read(offset,size);
   for(let p=skip;p+8<=data.byteLength;){let length=data.getUint32(p),base=8;if(length===1){length=wide(data,p+8);base=16;}if(length<base||p+length>data.byteLength)throw Error('Metadati MP4 incompleti.');
    if(kind(data,p+4)==='mvhd'){const start=p+base,version=data.getUint8(start);if(version>1||length<base+(version?32:20))throw Error('Durata MP4 non leggibile.');
     const scale=data.getUint32(start+(version?20:12)),ticks=version?wide(data,start+24):data.getUint32(start+16),duration=ticks/scale;
     if(!Number.isFinite(duration)||duration<=0||duration>86400)throw Error('Durata MP4 non valida.');return duration;
    }p+=length;
   }throw Error('Durata non presente nei metadati MP4.');
  }
  offset+=size;if(!Number.isSafeInteger(offset))throw Error('Offset MP4 non valido.');
 }
 throw Error('Metadati MP4 non trovati.');
}
