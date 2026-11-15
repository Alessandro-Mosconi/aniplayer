import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {sha256} from '@noble/hashes/sha2.js';

function load(path){
 const exports={};const context={exports,TextEncoder,TextDecoder,Uint8Array,Uint32Array,Float64Array,DataView,ArrayBuffer,Date,Math,Set,Map,require:name=>{
  if(name==='@noble/hashes/sha2.js')return {sha256};const file=resolve(dirname(path),name+'.ts');return name.startsWith('.')&&existsSync(file)?load(file):{};
 }};
 vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);return exports;
}

test('optical backup omits accounts and restores data through the Decimen protocol despite dropped frames',()=>{
 const {opticalBackup,OPTICAL_BACKUP_KEYS}=load('src/app/core/optical-backup.ts');
 const data={introDetections:{ep:{start:42,end:132}},introFingerprints:{sample:{data:'abcdef'.repeat(3000)}},malSession:{secret:'private'}};
 const payload=opticalBackup({read:(key,fallback)=>data[key]??fallback});
 const {DecimenV3Encoder}=load('src/app/core/optical/decimen-v3.ts');const {fnv1a}=load('src/app/core/optical/protocol.ts');
 const encoder=new DecimenV3Encoder(payload,620,421),blocks=new Map();
 for(let seq=0;seq<encoder.k*4;seq++){
  const {bytes}=encoder.encodeNext();
  if(seq===0){
   const qr=QRCode.create([{data:bytes,mode:'byte'}],{errorCorrectionLevel:'L',maskPattern:4});
   const scale=4,margin=4,width=(qr.modules.size+margin*2)*scale,pixels=new Uint8ClampedArray(width*width*4);pixels.fill(255);
   for(let y=0;y<qr.modules.size;y++)for(let x=0;x<qr.modules.size;x++)if(qr.modules.data[y*qr.modules.size+x])for(let dy=0;dy<scale;dy++)for(let dx=0;dx<scale;dx++){const p=(((y+margin)*scale+dy)*width+(x+margin)*scale+dx)*4;pixels[p]=pixels[p+1]=pixels[p+2]=0;}
   const scanned=jsQR(pixels,width,width);assert.ok(scanned);assert.deepEqual(scanned.binaryData,Array.from(bytes));
  }
  if(seq<encoder.k&&seq%5===0)continue;
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);assert.deepEqual(Array.from(bytes.slice(0,4)),[0xd1,0xc3,3,0]);assert.equal(view.getUint16(4,true),421);
  const position=seq%(2*encoder.k);if(position<encoder.k)blocks.set(position,bytes.slice(22));
  if(blocks.size===encoder.k){const blockLen=view.getUint16(12,true),reconstructed=new Uint8Array(encoder.k*blockLen);for(const [index,block] of blocks)reconstructed.set(block,index*blockLen);const result=reconstructed.slice(0,view.getUint32(14,true));assert.equal(fnv1a(result),view.getUint32(18,true));
   const header=new DataView(result.buffer),nameLength=header.getUint16(5,true),typeLength=header.getUint16(7,true),offset=49+nameLength+typeLength;assert.equal(new TextDecoder().decode(result.slice(49,49+nameLength)),'aniplayer-metadati.json');
   const file=result.slice(offset);assert.deepEqual(Array.from(sha256(file)),Array.from(result.slice(17,49)));const backup=JSON.parse(new TextDecoder().decode(file));assert.equal(backup.dati_originali.introDetections.ep.start,42);assert.equal(backup.dati_originali.introFingerprints.sample.data.length,18000);assert.equal(backup.dati_originali.malSession,undefined);assert.equal(Object.keys(backup.dati_originali).length,OPTICAL_BACKUP_KEYS.length);return;}
 }
 assert.fail('receiver did not reconstruct the transfer');
});

test('readable metadata combines episodes and preserves separate sources and audio versions',()=>{
 const {buildMetadata}=load('src/app/core/metadata-export.ts');
 const data={introPrefetch:{series:{x:{anime:{id:1,mal_id:99,awSlug:'show',dub:0,title:'Show'},episodes:[{id:5,number:'5'},{id:6,number:'6'}],jobs:{}}}},
  introDetections:{'3|show|0|5':{series:{id:1,mal_id:99},episode:'5',start:111,end:201,duration:1450,lengthSource:'AniSkip',method:'episodes',updated:200},'3|show|1|5':{series:{id:2,mal_id:99},episode:'5',start:120,end:210,duration:1450,updated:200}},
  introPrepared:{'3|show|0|6':{episode:'6',state:'not-found',updated:100}},
  introCorrections:{'mal:99|animeworld|show|sub|5':{start:110,end:200,duration:1450,updated:300}},
  skipSegments:{'mal:99|animeworld|show|sub|5|prologue':{start:0,end:30,duration:1450,updated:100}},
  endingDetections:{'3|show|0|5':{start:1300,end:1390,duration:1450,source:'audio',updated:100}},
  skipTimesCache:{'99:5':{time:123,rows:[{skipType:'op',episodeLength:1461,interval:{startTime:122,endTime:212}},{skipType:'ed',episodeLength:1461,interval:{startTime:1311,endTime:1401}}]}}};
 const series=buildMetadata(data),sub=series.find(item=>item.identita.audio==='sub'),dub=series.find(item=>item.identita.audio==='dub');
 assert.equal(series.length,2);assert.equal(sub.identita.titolo,'Show');const ep=sub.episodi.find(row=>row.numero==='5');
 assert.equal(ep.salti.sigla_iniziale.aniskip[0].inizio,122);assert.equal(ep.salti.sigla_iniziale.calcolato.inizio,111);assert.equal(ep.salti.sigla_iniziale.calcolato.origine,'audio_con_durata_aniskip');assert.equal(ep.salti.sigla_iniziale.manuale.inizio,110);
 assert.equal(ep.salti.sigla_finale.calcolato.inizio,1300);assert.equal(ep.salti.sigla_finale.allineamento.inizio,1300);assert.equal(ep.salti.sigla_finale.allineamento.offset_secondi,-11);assert.equal(ep.salti.intro_narrativa.manuale.fine,30);
 assert.equal(sub.episodi.find(row=>row.numero==='6').salti.sigla_iniziale.stato_calcolo,'non_trovato');assert.equal(dub.episodi[0].salti.sigla_iniziale.calcolato.inizio,120);
});
