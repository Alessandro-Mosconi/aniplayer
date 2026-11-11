import type {Spectrum} from './audio-fingerprint';
export interface PackedAudio {data:string;count:number;length:number;}
export function packAudio(spectrum:Spectrum,start:number,end:number):PackedAudio|null{
 if(!Array.isArray(spectrum.frames))return null;
 const begin=Math.round((start-spectrum.origin)/.25),count=Math.round((end-start)/.25);
 if(begin<0||count<80||count>720||begin+count>spectrum.frames.length)return null;
 const bytes=new Uint8Array(count*24);
 for(let i=0;i<count;i++){const vector=spectrum.frames[begin+i];if(vector)for(let j=0;j<24;j++)bytes[i*24+j]=Math.max(-127,Math.min(127,Math.round(vector[j]*127)));}
 let binary='';for(let i=0;i<bytes.length;i+=4096)binary+=String.fromCharCode(...bytes.subarray(i,i+4096));
 return {data:btoa(binary),count,length:count*.25};
}
export function unpackAudio(template:PackedAudio):Spectrum{
 if(!Number.isInteger(template.count)||template.count<80||template.count>720)throw Error('Impronta audio non valida.');
 const raw=atob(template.data);if(raw.length!==template.count*24)throw Error('Impronta audio incompleta.');
 const frames:(number[]|null)[]=[];for(let i=0;i<template.count;i++){const vector=Array.from({length:24},(_,j)=>{const byte=raw.charCodeAt(i*24+j);return (byte>127?byte-256:byte)/127;});const norm=Math.hypot(...vector);frames.push(norm>.01?vector.map(v=>v/norm):null);}
 return {frames,origin:0,step:.25,seconds:template.count*.25,bytes:0,window:{start:0,end:template.count*.25}};
}
