import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function create(fetchMock){
 const signal=value=>Object.assign(()=>value,{set:v=>value=v,update:f=>value=f(value)}),profiles=[{id:'1',name:'CosmicComet',avatar:''}];
 const angular={Component:()=>x=>x,HostListener:()=>()=>{},signal,output:()=>({emit(){}}),ElementRef:class{},inject:type=>type?.name==='StorageService'?{profiles:()=>profiles}:{nativeElement:{querySelector:()=>null}}};
 const compile=(file,dependencies)=>{const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,useDefineForClassFields:false}}).outputText,{exports,require:key=>dependencies[key],fetch:fetchMock,AbortController,setTimeout,clearTimeout,URL,encodeURIComponent});return exports;};
 const core=compile('src/app/core/profiles.ts',{}),dependencies={'@angular/core':angular,'@angular/forms':{FormsModule:class{}},'../core/storage.service':{StorageService:class StorageService{}},'../core/profiles':core,'../core/avatar-styles':{AVATAR_STYLES:['pixel-art']},'./profile-avatar.directive':{},'./anime-loader.component':{}};
 return new (compile('src/app/components/profiles.component.ts',dependencies).ProfilesComponent)();
}
const response=data=>({ok:true,json:async()=>({data})});
test('TinyTools supplies a unique formatted name and avoids the previous suggestion',async()=>{
 const c=create(async()=>response(['cosmic-comet','flying-bed','sleepy-ninja']));c.editing.set(true);c.name='FlyingBed';await c.suggestName();assert.equal(c.name,'SleepyNinja');assert.equal(c.nameLoading(),false);
});
test('a slow response cannot overwrite a manually edited name or a newer suggestion',async()=>{
 const pending=[];const c=create(()=>new Promise(resolve=>pending.push(resolve)));c.editing.set(true);c.name='initial';
 const first=c.suggestName();const second=c.suggestName();pending[1](response(['lucky-fox']));await second;pending[0](response(['fuzzy-panda']));await first;assert.equal(c.name,'LuckyFox');
 const third=c.suggestName();c.name='Il mio nome';c.nameChanged();pending[2](response(['happy-bird']));await third;assert.equal(c.name,'Il mio nome');
});
test('network failures retain a locally generated name',async()=>{
 const c=create(async()=>{throw Error('offline');});c.editing.set(true);c.name='initial';await c.suggestName();assert.match(c.name,/^[A-Z][a-z]+[A-Z][a-z]+$/);assert.equal(c.nameLoading(),false);
});
test('random avatar changes only the avatar and keeps the selected style consistent',()=>{
 const c=create(async()=>response([]));c.name='MyName';c.avatar='dicebear10:adventurer:random-old';
 c.randomizeAvatar();assert.notEqual(c.avatar,'dicebear10:adventurer:random-old');assert.equal(c.name,'MyName');assert.match(c.avatar,/^dicebear10:pixel-art:random-/);assert.equal(c.style,'pixel-art');
});
test('randomizing both refreshes avatar and name for new and existing profiles',async()=>{
 const c=create(async()=>response(['lucky-fox']));c.editing.set(true);c.name='InitialName';c.avatar='generated:0';c.randomizeBoth();
 await new Promise(resolve=>setImmediate(resolve));assert.equal(c.name,'LuckyFox');assert.match(c.avatar,/^dicebear10:pixel-art:random-/);
 c.id='existing';const avatar=c.avatar;c.randomizeBoth();await new Promise(resolve=>setImmediate(resolve));assert.notEqual(c.avatar,avatar);assert.notEqual(c.name,'LuckyFox');
});
