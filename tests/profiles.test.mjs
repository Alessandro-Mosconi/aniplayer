import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function setup(initial={}){
 const rows=new Map(Object.entries(initial).map(([k,v])=>['autv.'+k,JSON.stringify(v)]));let fail=false,reloads=0;
 const localStorage={getItem:k=>rows.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('Quota');rows.set(k,v);},removeItem:k=>{if(fail)throw Error('Storage');rows.delete(k);}};
 const angular={Injectable:()=>target=>target,signal:value=>{const s=()=>value;s.set=v=>{value=v;};return s;}};
 const modules={};
 for(const name of ['profiles','storage.service']){
  const source=readFileSync('src/app/core/'+name+'.ts','utf8');const exports={};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText,{exports,require:key=>key==='@angular/core'?angular:modules[key.slice(2)],localStorage,crypto:{getRandomValues:array=>array.fill(1)},window:{location:{reload:()=>reloads++}},URL,encodeURIComponent});modules[name]=exports;
 }
 return {Storage:modules['storage.service'].StorageService,profiles:modules.profiles,rows,fail:()=>{fail=true;},reloads:()=>reloads};
}
test('existing user data remains in the default profile; new profiles start empty',()=>{
 const env=setup({favorites:{one:{id:1}},settings:{resume:false},introPrepared:{shared:true},malSession:{accessToken:'old'}}),old=new env.Storage();
 assert.equal(old.favorites().one.id,1);assert.equal(old.settings().resume,false);
 const profile=old.saveProfile(' Secondo ','generated:2');old.selectProfile(profile.id);
 assert.equal(env.reloads(),1);const second=new env.Storage();assert.equal(second.profileId,profile.id);assert.equal(Object.keys(second.favorites()).length,0);assert.equal(second.settings().resume,true);assert.equal(second.read('malSession',null),null);
 assert.equal(second.read('introPrepared',{}).shared,true);second.write('introPrepared',{shared:'updated'});assert.equal(old.read('introPrepared',{}).shared,'updated');
 second.write('history',{second:true});assert.equal(old.read('history',null),null);
 // Async work in the old instance must stay associated with the old profile.
 old.write('malSession',{accessToken:'late'});assert.equal(second.read('malSession',null),null);
 second.selectProfile('default');assert.equal(new env.Storage().favorites().one.id,1);
});
test('reopening restores the last selected profile and falls back when it is missing',()=>{
 const env=setup({favorites:{default:true}}),original=new env.Storage(),other=original.saveProfile('Secondo','generated:1');
 original.selectProfile(other.id);const active=new env.Storage();active.write('favorites',{second:true});
 const reopened=new env.Storage();assert.equal(reopened.profileId,other.id);assert.equal(reopened.favorites().second,true);
 reopened.selectProfile('default');const switchedBack=new env.Storage();assert.equal(switchedBack.profileId,'default');assert.equal(switchedBack.favorites().default,true);
 env.rows.set('autv.activeProfile',JSON.stringify('missing'));assert.equal(new env.Storage().profileId,'default');
 const root=readFileSync('src/app/app.component.ts','utf8'),template=readFileSync('src/app/app.component.html','utf8');
 assert.match(root,/profilesOpen\s*=\s*signal\(false\)/);assert.match(template,/profilesOpen\.set\(true\)/);
});
test('names are unique after normalization; rename preserves profile id and data',()=>{
 const env=setup(),s=new env.Storage(),p=s.saveProfile(' Alice  Rossi ','generated:0');
 assert.equal(p.name,'Alice Rossi');assert.throws(()=>s.saveProfile('ＡＬＩＣＥ ROSSI','generated:1'),/già usato/);
 assert.throws(()=>s.saveProfile(' ','generated:0'));assert.throws(()=>s.saveProfile('a'.repeat(33),'generated:0'));
 assert.equal(s.saveProfile('Alicia','generated:3',p.id).id,p.id);assert.equal(s.profiles().length,2);
 assert.throws(()=>s.saveProfile('Bad','javascript:alert(1)'));
});
test('storage failures preserve profile list and selected profile',()=>{
 const env=setup(),s=new env.Storage();s.saveProfile('Alice','generated:0');env.fail();
 assert.throws(()=>s.saveProfile('Bob','generated:1'),/salvare/);assert.equal(s.profiles().length,2);
 assert.throws(()=>s.selectProfile(s.profiles()[1].id),/cambiare/);assert.equal(env.reloads(),0);
});
test('avatars work offline and shared analysis keys never get a profile prefix',()=>{
 const {profiles:p}=setup();assert.match(p.avatarUrl('generated:4'),/^data:image\/svg\+xml/);assert.equal(p.avatarUrl('javascript:bad'),'');
 for(const key of ['introPrepared','introPrefetch','introDetections','introFingerprints','skipTimesCache'])assert.equal(p.profileKey('alice',key),key);
 for(const key of ['favorites','history','seen','settings','malPublicData','malOutbox','explored'])assert.equal(p.profileKey('alice',key),'profile.alice.'+key);
});

test('DiceBear API avatars use pinned versions and accept all catalog styles',()=>{
 const env=setup(),p=env.profiles,s=new env.Storage();
 const avatar='dicebear:adventurer:variant-42';
 assert.match(p.avatarUrl(avatar),/^https:\/\/api\.dicebear\.com\/9\.x\/adventurer\/svg\?seed=variant-42/);
 assert.equal(p.avatarUrl(avatar),p.avatarUrl(avatar));
 assert.notEqual(p.avatarUrl(avatar),p.avatarUrl('dicebear:bottts:variant-42'));
 assert.notEqual(p.avatarUrl(avatar),p.avatarUrl('dicebear:adventurer:variant-43'));
 assert.equal(s.saveProfile('DiceBear',avatar).avatar,avatar);
 assert.throws(()=>s.saveProfile('Invalid','dicebear:unknown:seed'));
 const modern='dicebear10:pixel-art:seed-42';assert.equal(s.saveProfile('Modern',modern).avatar,modern);assert.equal(p.avatarUrl(modern),'https://api.dicebear.com/10.x/pixel-art/svg?seed=seed-42&size=160');
 assert.equal(p.avatarUrl('dicebear10:../bad:seed'),'');
 assert.equal(p.normalizeAvatarStyles(['bottts','../bad','bottts',12,'pixel-art']).join(','),'bottts,pixel-art');
});

test('deleting an inactive profile removes its private data and preserves shared analysis',()=>{
 const env=setup({favorites:{original:true},introPrepared:{shared:true}}),s=new env.Storage();
 const profile=s.saveProfile('Secondo','generated:2');
 env.rows.set('autv.profile.'+profile.id+'.history',JSON.stringify({private:true}));
 env.rows.set('autv.profile.'+profile.id+'.malSession',JSON.stringify({accessToken:'secret'}));
 env.rows.set('autv.avatarStyleFavorites.'+profile.id,JSON.stringify(['bottts']));
 assert.equal(s.deleteProfile(profile.id),true);assert.equal(s.profiles().length,1);
 assert.equal(env.rows.has('autv.profile.'+profile.id+'.history'),false);
 assert.equal(env.rows.has('autv.profile.'+profile.id+'.malSession'),false);
 assert.equal(env.rows.has('autv.avatarStyleFavorites.'+profile.id),false);
 assert.equal(s.favorites().original,true);assert.equal(s.read('introPrepared',{}).shared,true);assert.equal(env.reloads(),0);
 assert.throws(()=>s.deleteProfile('default'),/almeno un profilo/);
});
test('deleting the active legacy profile clears its keys and prevents late writes',()=>{
 const env=setup({favorites:{original:true},malSession:{accessToken:'secret'},introPrepared:{shared:true}}),s=new env.Storage();
 const replacement=s.saveProfile('Secondo','generated:1');assert.equal(s.deleteProfile('default'),true);
 assert.equal(env.reloads(),1);assert.equal(env.rows.has('autv.favorites'),false);assert.equal(env.rows.has('autv.malSession'),false);
 assert.equal(s.write('history',{late:true}),false);assert.equal(env.rows.has('autv.history'),false);
 const current=new env.Storage();assert.equal(current.profileId,replacement.id);assert.equal(current.read('introPrepared',{}).shared,true);
});
test('failed profile registry write leaves the profile and all data intact',()=>{
 const env=setup({favorites:{original:true}}),s=new env.Storage(),p=s.saveProfile('Secondo','generated:1');env.fail();
 assert.throws(()=>s.deleteProfile('default'),/Impossibile eliminare/);assert.equal(s.profiles().length,2);
 assert.equal(env.rows.has('autv.favorites'),true);assert.equal(env.reloads(),0);assert.equal(p.name,'Secondo');
});
test('suggested names stay unique even when all word combinations are taken',()=>{
 const {profiles:p}=setup(),profiles=[];
 for(let i=0;i<405;i++){
  const name=p.randomProfileName(profiles,()=>0);
  assert.doesNotThrow(()=>p.profileName(name,profiles));
  profiles.push({id:String(i),name,avatar:'generated:0'});
 }
 assert.equal(profiles[400].name,'SleepyNinja2');
});
test('random avatar uses an available style and creates a valid stable identifier',()=>{
 const {profiles:p}=setup();let i=0;const samples=[0.75,0.1,0.9];
 const avatar=p.randomProfileAvatar(['adventurer','pixel-art'],()=>samples[i++]);
 assert.match(avatar,/^dicebear10:pixel-art:random-/);assert.ok(p.DICEBEAR_AVATAR.test(avatar));
 assert.equal(p.avatarUrl(avatar),p.avatarUrl(avatar));
});
test('TinyTools suggestions are transformed and checked against existing profile names',()=>{
 const {profiles:p}=setup(),existing=[{id:'1',name:'CosmicComet',avatar:''}];
 assert.equal(p.tinyToolsProfileName({data:['COSMIC-COMET','crispy-bird']},existing),'CrispyBird');
 assert.equal(p.tinyToolsProfileName({data:['bad123','<script>-tag','a'.repeat(33)+'-bird']},existing),null);
 assert.equal(p.tinyToolsProfileName({data:null},existing),null);
});
