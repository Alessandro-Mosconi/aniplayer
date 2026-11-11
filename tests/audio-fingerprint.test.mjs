import test from 'node:test';
import assert from 'node:assert/strict';
import {compare,consensus,inferRepeated,matchTemplate,SpectralFrames,searchWindow,INTRO_AUDIO_VERSION} from '../src/app/core/audio-fingerprint.ts';
function randomFrames(count,seed=77){let value=seed>>>0;return Array.from({length:count},()=>{const a=[];for(let j=0;j<24;j++){value=(Math.imul(1664525,value)+1013904223)>>>0;a.push(value/0x100000000-.5);}const n=Math.hypot(...a);return a.map(x=>x/n);});}
function spectrum(frames){return {frames,origin:0,step:.25,seconds:frames.length*.25,bytes:0,window:{start:0,end:360}};}
test('FFT architecture maintains original 24 bands and 0.25s timestep',()=>{
 assert.equal(INTRO_AUDIO_VERSION,3);
 const spectrumFrames=new SpectralFrames(11025);
 for(let k=0;k<4;k++){const pcm=new Float32Array(2756);for(let i=0;i<pcm.length;i++)pcm[i]=.4*Math.sin(2*Math.PI*440*(i+2756*k)/11025);spectrumFrames.push(pcm,k*.25,11025);}
 const frames=spectrumFrames.finish().filter(Boolean);assert.ok(frames.length>=3);
 assert.equal(frames[0].length,24);assert.ok(Math.abs(Math.hypot(...frames[0])-1)<1e-6);
});
test('full diagonal match finds a shifted 50s repeated audio region',async()=>{
 const song=randomFrames(200,10),left=spectrum([...randomFrames(40,11),...song,...randomFrames(60,12)]),right=spectrum([...randomFrames(70,13),...song,...randomFrames(30,14)]);
 const match=await compare(left,right,50);
 assert.ok(match, 'expected repeated opening');assert.ok(Math.abs(match.start-10)<1.5);assert.ok(Math.abs(match.otherStart-17.5)<1.5);
 assert.ok(match.score>.75);assert.ok(match.temporalContrast>.12);
});
test('unrelated audio cannot establish consensus or a match',async()=>{
 const left=spectrum(randomFrames(220,71)),right=spectrum(randomFrames(220,303));
 assert.equal(await compare(left,right,40),null);
 assert.equal(consensus([{start:20,score:.99,otherStart:0,coverage:1,temporalContrast:.8,episode:'2'},{start:32,score:.99,otherStart:0,coverage:1,temporalContrast:.8,episode:'3'}]),null);
 assert.equal(consensus([{start:20,score:.99,otherStart:0,coverage:1,temporalContrast:.8,episode:'2'},{start:20,score:.99,otherStart:0,coverage:1,temporalContrast:.8,episode:'2'}]),null);
});
test('two independent references that agree qualify',()=>{
 const a={start:15,end:105,score:.86,otherStart:0,coverage:.9,temporalContrast:.4,episode:'2'};
 const b={start:17,end:107,score:.78,otherStart:1,coverage:.83,temporalContrast:.31,episode:'3'};
 assert.ok(consensus([a,b],true));
});
test('repeated segments can be inferred without AniSkip, but short jingles cannot',async()=>{
 const repeated=randomFrames(240,521),one=spectrum([...randomFrames(65,72),...repeated,...randomFrames(65,73)]),two=spectrum([...randomFrames(40,74),...repeated,...randomFrames(90,75)]);
 const inferred=await inferRepeated(one,two);
 assert.ok(inferred,'expected repeat detection');assert.ok(inferred.end-inferred.start>=45);
 const short=randomFrames(24,76),shortOne=spectrum([...randomFrames(200,78),...short,...randomFrames(200,79)]),shortTwo=spectrum([...randomFrames(150,80),...short,...randomFrames(250,81)]);
 assert.equal(await inferRepeated(shortOne,shortTwo),null);
});
test('fingerprint window validates hint length without trusting AniSkip offset',()=>{
 assert.deepEqual(searchWindow({start:180,end:270}),{start:90,end:360});
 assert.deepEqual(searchWindow({start:50,end:360}),{start:0,end:360});
});

test('Ending matches retain absolute tail timestamps and stop before post-credit audio',async()=>{
 const song=randomFrames(240,800),left={...spectrum([...randomFrames(60,801),...song,...randomFrames(80,802)]),origin:1200};
 const right={...spectrum([...randomFrames(40,803),...song,...randomFrames(100,804)]),origin:1260};
 const third={...spectrum([...randomFrames(80,805),...song,...randomFrames(60,806)]),origin:1170};
 const a=await inferRepeated(left,right),b=await inferRepeated(left,third);
 assert.ok(a&&b);assert.ok(a.start>=1214&&a.start<=1216);assert.ok(a.end>=1274&&a.end<=1276);
 assert.ok(a.otherStart>=1269&&a.otherStart<=1271);
 assert.ok(consensus([{...a,episode:'2'},{...b,episode:'3'}],true));
});
