import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {preparePlatform} from '../tools/prepare-platform.mjs';
test('webOS manifest lets the system foreground the app on relaunch',async()=>{
 const info=JSON.parse(await readFile(new URL('../platforms/webos/appinfo.json',import.meta.url),'utf8'));
 assert.equal(info.handlesRelaunch,false);
});
test('webOS preparation copies the built app and keeps remote Back under application control',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'aniplayer-platform-test-'));
 try{
  await mkdir(join(dir,'dist/aniplayer/browser'),{recursive:true});await writeFile(join(dir,'dist/aniplayer/browser/index.html'),'<app-root></app-root>');
  await mkdir(join(dir,'platforms/webos'),{recursive:true});await writeFile(join(dir,'platforms/webos/appinfo.json'),JSON.stringify({id:'org.aniplayer.tv',type:'web',main:'index.html',disableBackHistoryAPI:true}));
  await mkdir(join(dir,'src/assets/images'),{recursive:true});await writeFile(join(dir,'src/assets/images/aniplayer-icon-512.png'),'test icon');
  const stage=await preparePlatform('webos',{build:false,projectRoot:dir});assert.equal(await readFile(join(stage,'index.html'),'utf8'),'<app-root></app-root>');assert.equal(JSON.parse(await readFile(join(stage,'appinfo.json'))).disableBackHistoryAPI,true);
  await writeFile(join(stage,'old-file.txt'),'stale');await preparePlatform('webos',{build:false,projectRoot:dir});await assert.rejects(readFile(join(stage,'old-file.txt')));
  await assert.rejects(preparePlatform('../../private',{build:false,projectRoot:dir}),/non valida/);
 }finally{if(!resolve(dir).startsWith(resolve(tmpdir()))||!dir.includes('aniplayer-platform-test-'))throw Error('Test cleanup path invalid');await rm(dir,{recursive:true,force:true});}
});
