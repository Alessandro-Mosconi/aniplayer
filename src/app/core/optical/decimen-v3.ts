import {sha256} from '@noble/hashes/sha2.js';
import {fnv1a,splitmix32} from './protocol';

/** Decimen v3 file container, without compression. */
export function fileContainer(bytes:Uint8Array):Uint8Array{
 const encoder=new TextEncoder(),name=encoder.encode('aniplayer-metadati.json'),type=encoder.encode('application/json');
 const out=new Uint8Array(49+name.length+type.length+bytes.length),view=new DataView(out.buffer);
 out.set([0x44,0x43,0x46,0x32]);view.setUint8(4,0);view.setUint16(5,name.length,true);view.setUint16(7,type.length,true);
 view.setUint32(9,bytes.length,true);view.setUint32(13,bytes.length,true);out.set(sha256(bytes),17);
 out.set(name,49);out.set(type,49+name.length);out.set(bytes,49+name.length+type.length);return out;
}

/** Block indices are deterministic; sweep data blocks then send repair frames. */
export function frameBlocks(k:number,session:number,seq:number):number[]{
 const position=seq%(2*k);if(position<k)return [position];
 let seed=(Math.imul(session+1,0x9e3779b1)^(seq+0x85ebca6b))|0;
 seed=Math.imul(seed^(seed>>>13),0xc2b2ae35);seed=(seed^(seed>>>16))|0;
 const random=splitmix32(seed),degree=Math.min(k,4+random()%21),indices=new Set<number>();
 while(indices.size<degree)indices.add(random()%k);return [...indices];
}
export class DecimenV3Encoder{
 readonly k:number;private sequence=0;private readonly blockSize:number;private readonly checksum:number;
 constructor(private readonly payload:Uint8Array,frameSize:number,private readonly session:number){
  this.blockSize=frameSize-22;this.k=Math.ceil(payload.length/this.blockSize);this.checksum=fnv1a(payload);
  if(!Number.isInteger(frameSize)||this.blockSize<1||this.k<1||this.k>65535||!Number.isInteger(session)||session<1||session>65535)throw Error('Backup troppo grande per la trasmissione.');
 }
 encodeNext(){
  const seq=this.sequence++;if(seq>0xffffffff)throw Error('Trasmissione terminata: riavvia il backup.');
  const frame=new Uint8Array(22+this.blockSize),view=new DataView(frame.buffer);
  frame.set([0xd1,0xc3,3,0]);view.setUint16(4,this.session,true);view.setUint32(6,seq,true);view.setUint16(10,this.k,true);view.setUint16(12,this.blockSize,true);view.setUint32(14,this.payload.length,true);view.setUint32(18,this.checksum,true);
  for(const block of frameBlocks(this.k,this.session,seq)){const base=block*this.blockSize;for(let i=0;i<this.blockSize&&base+i<this.payload.length;i++)frame[22+i]^=this.payload[base+i];}
  return {seq,bytes:frame};
 }
}
