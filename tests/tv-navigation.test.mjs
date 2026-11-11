import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';

test('PiP keeps background playback only while the system displays the video',()=>{
 const {pictureInPictureActive}=load('src/app/core/picture-in-picture.ts');
 assert.equal(pictureInPictureActive({},{}),false);
 assert.equal(pictureInPictureActive({AniPlayerNative:{isPipActive:()=>false}},{}),false);
 assert.equal(pictureInPictureActive({AniPlayerNative:{isPipActive:()=>true}},{}),true);
 assert.equal(pictureInPictureActive({},{pictureInPictureElement:{}}),true);
 assert.equal(pictureInPictureActive({},{querySelector:()=>({webkitPresentationMode:'picture-in-picture'})}),true);
 assert.equal(pictureInPictureActive({},{querySelector:()=>({webkitPresentationMode:'inline'})}),false);
});

function load(path,globals={},dependencies={}){
 const exports={};
 const signal=value=>Object.assign(()=>value,{set:next=>value=next,update:fn=>value=fn(value)});
 const context={exports,URL,URLSearchParams,Map,Promise,Date,console,setTimeout,clearTimeout,...globals,
  require:name=>{if(dependencies[name])return dependencies[name];if(name==='@angular/core')return {Injectable:()=>target=>target,signal,computed:fn=>fn};const relative=resolve(dirname(path),name+'.ts');return name.startsWith('.')&&existsSync(relative)?load(relative,globals,dependencies):{};}};
 const js=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,useDefineForClassFields:false}}).outputText;
 vm.runInNewContext(js,context);return exports;
}
function remoteFixture(){
 const document={activeElement:null,addEventListener(){},getElementById:()=>({contains:()=>true}),querySelector:()=>null};
 class Element{
  constructor(x,y,width=150,height=55,row=null){this.rect={left:x,top:y,right:x+width,bottom:y+height,width,height};this.row=row;}
  getBoundingClientRect(){return this.rect;}
  focus(){document.activeElement=this;}
  scrollIntoView(){this.scrolled=true;}
  blur(){document.activeElement=null;}
  hasAttribute(name){return name==='data-tv-input'&&this.tvInput===true;}
  closest(selector){return selector==='[data-focus-row]'?this.row:null;}
  matches(){return false;}
  getAttribute(){return null;}
 }
 class Input extends Element{}
 class TextArea extends Element{}
 const {RemoteService}=load('src/app/core/remote.service.ts',{document,window:{innerHeight:1080,innerWidth:1920},HTMLElement:Element,HTMLInputElement:Input,HTMLTextAreaElement:TextArea,HTMLSelectElement:class{}});
 const remote=new RemoteService({setKeys(){}});let items=[];
 remote.focusables=()=>items;
 return {remote,document,Element,Input,TextArea,setItems:value=>items=value};
}
test('Up returns from filters to the wide search field',()=>{
 const {remote,document,Input,Element,setItems}=remoteFixture();
 const search=new Input(0,0,1100),submit=new Element(1120,0),filter=new Element(0,110);
 setItems([search,submit,filter]);filter.focus();remote.move('up');assert.equal(document.activeElement,search);
});
test('Right and Left follow the filter row',()=>{
 const {remote,document,Element,setItems}=remoteFixture();
 const row={contains:el=>el.row===row},audio=new Element(0,100,200,80,row),type=new Element(220,100,200,55,row),result=new Element(20,200);
 setItems([audio,type,result]);audio.focus();remote.move('right');assert.equal(document.activeElement,type);
 remote.move('left');assert.equal(document.activeElement,audio);
});
test('MAL input releases Down/Up while Left stays available to the caret',()=>{
 const {remote,document,Input,Element,setItems}=remoteFixture();
 const client=new Input(0,0,1000),redirect=new Input(0,100,1000),save=new Element(0,200);
 setItems([client,redirect,save]);client.focus();
 const press=key=>{let prevented=false;remote.onKey({key,preventDefault(){prevented=true;},stopPropagation(){}});return prevented;};
 assert.equal(press('ArrowLeft'),false);assert.equal(document.activeElement,client);
 assert.equal(press('ArrowDown'),true);assert.equal(document.activeElement,redirect);
 press('ArrowDown');assert.equal(document.activeElement,save);
 press('ArrowUp');assert.equal(document.activeElement,redirect);
});
test('Return closes filter options before navigating away',()=>{
 const {remote,document}=remoteFixture();let closed=false,back=false;
 document.querySelector=selector=>selector==='[data-filter-close]'?{click(){closed=true;}}:null;
 remote.configure({player:()=>false,playerActive:()=>false,back(){back=true;}});
 remote.onKey({keyCode:10009,preventDefault(){},stopPropagation(){}});
 assert.equal(closed,true);assert.equal(back,false);
});
test('SUB pages contain only SUB, keep order and exact totals, and reuse scanned pages',async()=>{
 const {CatalogService}=load('src/app/core/catalog.service.ts');
 const service=new CatalogService({read:(_key,fallback)=>fallback});
 const records=Array.from({length:100},(_,id)=>({id:id+1,slug:'anime',dub:id%3===0?1:0}));
 const original=service.catalog.bind(service);let requests=0;
 service.catalog=async(filters={},offset=0,force=false)=>{
  if(filters.dubbed===0)return original(filters,offset,force);
  requests++;const all=filters.dubbed===1?records.filter(a=>a.dub===1):records;
  return {records:all.slice(offset,offset+30),tot:all.length};
 };
 const expected=records.filter(a=>a.dub===0);
 const first=await service.catalog({dubbed:0,genres:[51,21]},0);
 const second=await service.catalog({dubbed:0,genres:[51,21]},30);
 assert.equal(first.tot,expected.length);assert.equal(second.tot,expected.length);
 assert.deepEqual(Array.from(first.records,a=>a.id),expected.slice(0,30).map(a=>a.id));
 assert.deepEqual(Array.from(second.records,a=>a.id),expected.slice(30,60).map(a=>a.id));
 const before=requests;await service.catalog({dubbed:0,genres:[51,21]},0);assert.equal(requests,before);
});
test('AnimeWorld status reflects startup check, request failure and recovery',async()=>{
 let fail=false;
 const {AnimeWorldService}=load('src/app/core/animeworld.service.ts',{AbortController,fetch:async()=>{
  if(fail)throw Error('Network unavailable');
  return {ok:true,url:'https://www.animeworld.ac/',text:async()=>'<title>AnimeWorld</title>'};
 }});
 const service=new AnimeWorldService();
 assert.equal(service.connectionStatus(),'unchecked');assert.equal(service.online(),false);
 const check=service.checkConnection();assert.equal(service.connectionStatus(),'checking');
 assert.equal(await check,true);assert.equal(service.online(),true);assert.equal(service.connectionStatus(),'online');
 fail=true;await assert.rejects(service.request('/search?keyword=test'));
 assert.equal(service.online(),false);assert.equal(service.connectionStatus(),'offline');assert.match(service.connectionError(),/Network unavailable/);
 fail=false;assert.equal(await service.checkConnection(),true);assert.equal(service.online(),true);assert.equal(service.connectionError(),'');
});
test('AnimeWorld challenge and unrecognized page are not healthy',async()=>{
 let body='<title>Just a moment</title>';
 const {AnimeWorldService}=load('src/app/core/animeworld.service.ts',{AbortController,fetch:async()=>({ok:true,url:'https://www.animeworld.ac/',text:async()=>body})});
 const service=new AnimeWorldService();assert.equal(await service.checkConnection(),false);assert.equal(service.online(),false);
 body='<title>Unrelated page</title>';assert.equal(await service.checkConnection(),false);assert.equal(service.connectionStatus(),'offline');
});
test('TV inputs navigate without a keyboard and enter editing only on OK',()=>{
 const {remote,document,Input,Element,setItems}=remoteFixture();
 const input=new Input(0,100,1000),button=new Element(0,220);input.tvInput=true;input.readOnly=true;
 setItems([input,button]);remote.focus(input);assert.equal(input.readOnly,true);
 const press=key=>remote.onKey({key,preventDefault(){},stopPropagation(){}});
 press('ArrowDown');assert.equal(document.activeElement,button);assert.equal(input.readOnly,true);
 press('ArrowUp');assert.equal(document.activeElement,input);assert.equal(input.readOnly,true);
 press('Enter');assert.equal(input.readOnly,false);
 press('Escape');assert.equal(input.readOnly,true);assert.equal(document.activeElement,input);
 press('ArrowDown');assert.equal(document.activeElement,button);
});
test('Focusing an already visible control does not scroll away the top spacing',()=>{
 const {remote,Element}=remoteFixture();const visible=new Element(400,250);
 remote.focus(visible);assert.equal(visible.scrolled,undefined);
 const below=new Element(400,1100);remote.focus(below);assert.equal(below.scrolled,true);
});
test('Catalog sends genre objects and provider values, including multiple genres',async()=>{
 const {CatalogService}=load('src/app/core/catalog.service.ts');
 const service=new CatalogService({read:(_key,fallback)=>fallback});service.csrf='test';
 service.genres.set([{id:51,name:'Action'},{id:21,name:'Adventure'}]);let sent;
 service.request=async(_path,_method,payload)=>{sent=payload;return JSON.stringify({records:[],tot:0});};
 await service.catalog({genres:[51,21],type:'TV',status:'Terminato',order:'Popolarità'},0);
 assert.deepEqual(JSON.parse(JSON.stringify(sent.genres)),[{id:51,name:'Action'},{id:21,name:'Adventure'}]);
 assert.equal(sent.type,'TV');assert.equal(sent.status,'Terminato');assert.equal(sent.order,'Popolarità');
 await service.catalog({genres:[]},0);assert.equal(sent.genres,false);
});
test('Catalog request failure clears health and subsequent success restores it',async()=>{
 let status=500;
 const {CatalogService}=load('src/app/core/catalog.service.ts',{AbortController,fetch:async()=>({ok:status===200,status,url:'https://www.animeunity.co/archivio',headers:{get:()=>null},text:async()=>'<html></html>'})});
 const service=new CatalogService({read:(_key,fallback)=>fallback});service.online.set(true);
 await assert.rejects(service.request('/archivio'),/500/);assert.equal(service.online(),false);
 status=200;await service.request('/archivio');assert.equal(service.online(),true);assert.equal(service.connectionError(),'');
});
test('MAL resume reopens the same authorization with matching registered redirect and PKCE',()=>{
 const {MalService}=load('src/app/core/mal.service.ts',{crypto:webcrypto,document:{addEventListener(){}}});
 const memory=new Map(),store={read:(key,fallback)=>memory.get(key)??fallback,write:(key,value)=>{memory.set(key,value);return true;}};
 let opened;const service=new MalService(store,{onAppControl(){},openExternal:url=>opened=url});
 service.configure('9d92b44c64ef2d9f06816d455931c150','aniplayer://mal/callback');
 const first=service.begin();assert.equal(opened,first);
 const url=new URL(first);assert.equal(url.searchParams.get('redirect_uri'),'aniplayer://mal/callback');
 assert.equal(url.searchParams.get('code_challenge'),memory.get('malOAuth').verifier);
 assert.equal(service.begin(true),first);
 assert.notEqual(service.begin(),first);
 assert.throws(()=>service.configure(service.clientId(),'aniplayer://mal/callback?extra=true'),/Redirect/);
});
test('MAL phone authorization keeps the verifier on TV and does not open its browser',async()=>{
 const {MalService}=load('src/app/core/mal.service.ts',{crypto:webcrypto,document:{addEventListener(){}}});
 const memory=new Map(),store={read:(key,fallback)=>memory.get(key)??fallback,write:(key,value)=>{memory.set(key,value);return true;}};
 let opened=0;const service=new MalService(store,{onAppControl(){},openExternal(){opened++;}});
 const url=service.begin(false,false),params=new URL(url).searchParams;
 assert.equal(opened,0);assert.equal(service.authorizationUrl(),url);
 assert.equal(params.get('code_challenge'),memory.get('malOAuth').verifier);
 assert.equal(params.get('state'),memory.get('malOAuth').state);
 assert.equal(params.has('code_verifier'),false);
 await assert.rejects(service.complete('aniplayer://mal/callback?code=test&state=wrong'),/Callback/);
 const oldState=params.get('state');service.begin(false,false);
 assert.notEqual(memory.get('malOAuth').state,oldState);assert.equal(opened,0);
});
test('Bundled QR encoder handles a complete MAL authorization URL',()=>{
 const context={document:{documentElement:{tagName:'html'}},navigator:{userAgent:'test'}};
 vm.runInNewContext(readFileSync('src/assets/vendor/qrcode.js','utf8'),context);
 const url='https://myanimelist.net/v1/oauth2/authorize?'+new URLSearchParams({response_type:'code',client_id:'a'.repeat(32),redirect_uri:'aniplayer://mal/callback',state:'b'.repeat(64),code_challenge:'c'.repeat(64),code_challenge_method:'plain'});
 const element={childNodes:[{offsetWidth:360,offsetHeight:360,style:{}}]};
 const code=new context.QRCode(element,{text:url,width:360,height:360,correctLevel:context.QRCode.CorrectLevel.M});
 assert.equal(code._oQRCode.dataList[0].data,url);
 assert.ok(code._oQRCode.getModuleCount()>21);
 assert.match(element.innerHTML,/<table/);assert.equal(element.title,url);
});
test('MAL manual loopback callback exchanges the code over HTTPS and completes the session',async()=>{
 const requests=[];
 const {MalService,MAL_MANUAL_REDIRECT}=load('src/app/core/mal.service.ts',{crypto:webcrypto,AbortController,document:{addEventListener(){}},fetch:async(url,options)=>{
  requests.push({url,options});
  assert.equal(new URL(url).protocol,'https:');
  const data=url.endsWith('/token')?{access_token:'test-access',refresh_token:'test-refresh',expires_in:3600}:{id:123,name:'test-user'};
  return {ok:true,json:async()=>data};
 }});
 const memory=new Map(),store={read:(key,fallback)=>memory.get(key)??fallback,write:(key,value)=>{memory.set(key,value);return true;}};
 const service=new MalService(store,{onAppControl(){},openExternal(){}});service.sync=async()=>{};
 service.configure(service.clientId(),MAL_MANUAL_REDIRECT);service.begin(false,false);
 const pending=memory.get('malOAuth');
 const callback=new URL(MAL_MANUAL_REDIRECT);callback.search=new URLSearchParams({code:'test-code',state:pending.state}).toString();
 await assert.rejects(service.complete(callback.href.replace(':8765',':8766')),/Callback/);
 await assert.rejects(service.complete(callback.href+'#fragment'),/Callback/);
 await assert.rejects(service.complete(callback.href+'&state='+pending.state),/Callback/);
 assert.equal(requests.length,0);
 await service.complete(callback.href);
 const payload=new URLSearchParams(requests[0].options.body);
 assert.equal(payload.get('redirect_uri'),MAL_MANUAL_REDIRECT);assert.equal(payload.get('code_verifier'),pending.verifier);assert.equal(payload.get('code'),'test-code');assert.equal(payload.has('client_secret'),false);
 assert.equal(service.connected,true);assert.equal(service.session().user.name,'test-user');assert.equal(memory.get('malOAuth'),null);assert.equal(service.authorizationUrl(),'');
});
test('MAL HTTP redirects are restricted to loopback',()=>{
 const {MalService}=load('src/app/core/mal.service.ts',{crypto:webcrypto,document:{addEventListener(){}}});
 const service=new MalService({read:(_key,fallback)=>fallback,write:()=>true},{onAppControl(){}});
 for(const redirect of ['http://localhost:8765/callback','http://127.0.0.1:8765/callback','http://[::1]:8765/callback'])assert.doesNotThrow(()=>service.configure(service.clientId(),redirect));
 for(const redirect of ['http://example.com/callback','http://127.0.0.1.example.com/callback','http://user@127.0.0.1:8765/callback'])assert.throws(()=>service.configure(service.clientId(),redirect),/Redirect/);
});
test('Callback paste accepts Markdown and escaped separators without changing code or state',()=>{
 const {parseMalCallback}=load('src/app/core/mal.service.ts');
 const plain='http://127.0.0.1:8765/callback?code=test-code&state=test-state';
 for(const value of [plain,'  '+plain+'  ','<'+plain+'>','[callback]('+plain+')',plain.replace('&state','&amp;state'),plain.replace('&state','\\&state')]){
  const parsed=parseMalCallback(value);assert.equal(parsed.searchParams.get('code'),'test-code');assert.equal(parsed.searchParams.get('state'),'test-state');
 }
 assert.throws(()=>parseMalCallback('not a callback'),/incolla/);
});
test('MAL reports the exact callback validation failure beside the completion control',async()=>{
 const {MalService,MAL_MANUAL_REDIRECT}=load('src/app/core/mal.service.ts',{crypto:webcrypto,document:{addEventListener(){}}});
 const memory=new Map(),store={read:(key,fallback)=>memory.get(key)??fallback,write:(key,value)=>{memory.set(key,value);return true;}};
 const service=new MalService(store,{onAppControl(){},openExternal(){}});
 service.configure(service.clientId(),MAL_MANUAL_REDIRECT);service.begin(false,false);
 await assert.rejects(service.complete(MAL_MANUAL_REDIRECT+'?code=test-code'),/manca state/);
 assert.equal(service.connecting(),false);assert.match(service.connectionError(),/manca state/);assert.equal(service.status(),service.connectionError());
 await assert.rejects(service.complete(MAL_MANUAL_REDIRECT+'?code=test-code&state=old-state'),/altra richiesta/);
 assert.match(service.connectionError(),/altra richiesta/);
 await assert.rejects(service.complete('aniplayer://mal/callback?code=test-code&state=test-state'),/indirizzo di ritorno diverso/);
 assert.equal(service.connectionError().includes('test-code'),false);
});
test('Long callback and scheme omitted by mobile copy keep their complete code and state',()=>{
 const {parseMalCallback}=load('src/app/core/mal.service.ts');
 const code='def50200'+'a'.repeat(6000),state='b'.repeat(64);
 const parsed=parseMalCallback('127.0.0.1:8765/callback?code='+code+'&state='+state);
 assert.equal(parsed.protocol,'http:');assert.equal(parsed.searchParams.get('code'),code);assert.equal(parsed.searchParams.get('state'),state);
});
test('Multiline callback field activates only with OK and releases focus with Down',()=>{
 const {remote,document,TextArea,Element,setItems}=remoteFixture();const field=new TextArea(0,100,1000,180),button=new Element(0,320);field.tvInput=true;field.readOnly=true;setItems([field,button]);remote.focus(field);
 const press=key=>remote.onKey({key,preventDefault(){},stopPropagation(){}});
 press('ArrowDown');assert.equal(document.activeElement,button);press('ArrowUp');assert.equal(document.activeElement,field);assert.equal(field.readOnly,true);
 press('Enter');assert.equal(field.readOnly,false);press('Escape');assert.equal(field.readOnly,true);
});
test('TV relay client receives callback from the PC and submits it without IME input',async()=>{
 const callback='http://127.0.0.1:8765/callback?code=test-code&state=test-state';
 let resolveDone;const done=new Promise(resolve=>resolveDone=resolve);let submitted;
 const {MalPhoneRelayService}=load('src/app/core/mal-phone-relay.service.ts',{AbortController,fetch:async(url)=>({ok:true,json:async()=>url.endsWith('/pair')?{phonePath:'/p/'+'a'.repeat(48),pollPath:'/result/'+'b'.repeat(48)}:{callback}})});
 const service=new MalPhoneRelayService({begin:()=> 'https://myanimelist.net/v1/oauth2/authorize?state=test-state',complete:async value=>{submitted=value;resolveDone();},connectionError:()=>''});
 service.address.set('http://192.168.1.10:8766');await service.start();await done;assert.equal(submitted,callback);service.stop();
 service.address.set('http://example.com:8766');await assert.rejects(service.start(),/indirizzo HTTP locale/);
});
function malFixture(initial={}){
 const memory=new Map(Object.entries(initial)),store={read:(key,fallback)=>memory.has(key)?memory.get(key):fallback,write:(key,value)=>{memory.set(key,value);return true;},watchEvents:()=>null};
 const {MalService}=load('src/app/core/mal.service.ts',{crypto:webcrypto,document:{addEventListener(){}}});
 return {service:new MalService(store,{onAppControl(){},openExternal(){}}),store,memory};
}
const testSession=()=>({accessToken:'test-access',refreshToken:'test-refresh',expiresAt:Date.now()+3600000,clientId:'a'.repeat(32),redirectUri:'http://127.0.0.1:8765/callback',user:{id:7,name:'test-user'}});
test('Importing 641 titles after login handles a null outbox and keeps the linked session',async()=>{
 const {service,memory}=malFixture();
 service.begin(false,false);const pending=memory.get('malOAuth');
 service.request=async url=>url.endsWith('/token')?{access_token:'test-access',refresh_token:'test-refresh',expires_in:3600}:url.endsWith('/users/@me')?{id:7,name:'test-user'}:{data:Array.from({length:641},(_,i)=>({node:{id:i+1,num_episodes:12},list_status:{num_episodes_watched:3,status:'watching'}})),paging:{}};
 await service.complete(pending.redirectUri+'?code=test-code&state='+pending.state);
 assert.equal(service.connected,true);assert.equal(Object.keys(service.entries()).length,641);assert.equal(memory.get('malOutbox'),null);assert.equal(service.connectionError(),'');
});
test('Null and legacy outboxes support watching/completed updates and paused writes',async()=>{
 const {service,memory}=malFixture({malSession:testSession(),malOutbox:null});let watched=0,total=12;const writes=[];
 service.auth=async(_path,options)=>{if(options?.method==='PUT'){writes.push(new URLSearchParams(options.body));return {};}return {num_episodes:total,my_list_status:{num_episodes_watched:watched,status:'watching'}};};
 service.queue({mal_id:12},{number:'1'});await service.flush();assert.equal(writes.length,1);assert.equal(writes[0].get('status'),'watching');assert.equal(writes[0].get('num_watched_episodes'),'1');
 watched=11;memory.set('malOutbox',{accountId:7,events:{'12:12':{malId:12,number:12}}});await service.flush();assert.equal(writes[1].get('status'),'completed');
 service.setAutoUpdate(false);service.queue({mal_id:12},{number:'13'});await service.flush();assert.equal(writes.length,2);assert.equal(Object.keys(memory.get('malOutbox')).length,0);
});
test('A legacy queue belonging to a different account never writes to MAL',async()=>{
 const {service}=malFixture({malSession:testSession(),malOutbox:{accountId:99,events:{'12:1':{malId:12,number:1}}}});service.auth=async()=>{throw Error('Must not request');};await service.flush();
});
test('Episodes queued while a MAL update is in flight are sent without losing progress',async()=>{
 const {service,memory}=malFixture({malSession:testSession(),malOutbox:null});let resume,first=true,remote=0;const sent=[];
 service.auth=async(_path,options)=>{
  if(options?.method==='PUT'){const form=new URLSearchParams(options.body);remote=Number(form.get('num_watched_episodes'));sent.push(remote);return {};}
  if(first){first=false;await new Promise(resolve=>resume=resolve);}
  return {num_episodes:12,my_list_status:{num_episodes_watched:remote,status:'watching'}};
 };
 service.queue({mal_id:12},{number:'1'});service.queue({mal_id:12},{number:'2'});resume();await service.flush();
 assert.deepEqual(sent,[1,2]);assert.equal(Object.keys(memory.get('malOutbox')).length,0);
});
test('Public username import paginates with client ID only and marks watched episodes without login',async()=>{
 const requests=[],memory=new Map(),store={read:(key,fallback)=>memory.has(key)?memory.get(key):fallback,write:(key,value)=>{memory.set(key,value);return true;}};
 const {MalPublicService}=load('src/app/core/mal-public.service.ts',{AbortController,fetch:async(url,init)=>{
  requests.push({url,init});const second=new URL(url).searchParams.get('offset')==='1000';
  return {ok:true,status:200,json:async()=>({data:[{node:{id:second?20:10,num_episodes:12},list_status:{num_episodes_watched:second?12:3,status:second?'completed':'watching'}}],paging:second?{}:{next:'https://api.myanimelist.net/v2/users/test-user/animelist?offset=1000'}})};
 }},{'./mal.service':{MAL_PUBLIC_CLIENT_ID:'public-client-id'}});
 const service=new MalPublicService(store);await service.importUsername('test-user');
 assert.equal(service.count,2);assert.equal(service.username(),'test-user');assert.equal(service.isSeen({mal_id:10},{number:'3'}),true);assert.equal(service.isSeen({mal_id:10},{number:'4'}),false);
 for(const {init} of requests){assert.equal(init.headers['X-MAL-CLIENT-ID'],'public-client-id');assert.equal(init.headers.Authorization,undefined);assert.equal(init.method,undefined);}
 assert.equal(memory.has('malSession'),false);assert.equal(memory.has('malOutbox'),false);
 service.clear();assert.equal(service.isSeen({mal_id:10},{number:'3'}),false);
});
test('Public import failure preserves previous watched data and is independent of account disconnect',async()=>{
 const saved={username:'old-user',entries:{10:{watched:5}},syncedAt:123};
 const {service:account,store,memory}=malFixture({malSession:testSession(),malPublicData:saved});
 const {MalPublicService}=load('src/app/core/mal-public.service.ts',{AbortController,fetch:async()=>({ok:false,status:403})},{'./mal.service':{MAL_PUBLIC_CLIENT_ID:'public-client-id'}});
 const service=new MalPublicService(store);await service.importUsername('private-user');assert.match(service.error(),/pubblica/);assert.equal(service.username(),'old-user');assert.equal(service.isSeen({mal_id:10},{number:'5'}),true);
 account.disconnect();assert.equal(memory.get('malPublicData'),saved);assert.equal(service.isSeen({mal_id:10},{number:'5'}),true);
 const {LibraryService}=load('src/app/core/library.service.ts');const library=new LibraryService({isSeen:()=>false},account,service);assert.equal(library.isSeen({mal_id:10},{number:'5'}),true);
});
test('Disconnect persists remembered access and blocks every automatic MAL operation',async()=>{
 const {service,store,memory}=malFixture({malSession:testSession(),malData:{entries:{10:{watched:3}}}});let calls=0;
 service.request=async()=>{calls++;throw Error('Unexpected request');};service.disconnect();
 assert.equal(service.connected,false);assert.equal(service.rememberedUser,'test-user');assert.ok(memory.get('malSession').refreshToken);
 service.queue({mal_id:10},{number:'4'});await service.flush();await service.sync();await service.syncIfOld();assert.equal(calls,0);
 const {MalService}=load('src/app/core/mal.service.ts',{document:{addEventListener(){}}});const restarted=new MalService(store,{onAppControl(){}});
 assert.equal(restarted.connected,false);assert.equal(restarted.rememberedUser,'test-user');assert.equal(restarted.entries()['10'].watched,3);
});
test('Reconnect renews expired remembered access without OAuth and preserves paused preference',async()=>{
 const expired={...testSession(),expiresAt:0};const {service,memory}=malFixture({malSession:expired,malDisconnected:true,malAutoUpdate:false});let refreshed=0,opened=0;
 service.tv.openExternal=()=>{opened++;};service.token=async payload=>{refreshed++;assert.equal(payload.grant_type,'refresh_token');return {access_token:'renewed-access',refresh_token:'renewed-refresh',expires_in:3600};};
 service.request=async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer renewed-access');return url.endsWith('/users/@me')?{id:7,name:'test-user'}:{data:[],paging:{}};};
 await service.reconnect();assert.equal(refreshed,1);assert.equal(opened,0);assert.equal(service.connected,true);assert.equal(service.autoUpdate(),false);assert.equal(memory.get('malDisconnected'),false);assert.equal(memory.get('malSession').refreshToken,'renewed-refresh');
});
test('Revoked remembered authorization stays disconnected and explicitly requests reauthorization',async()=>{
 const {service,memory}=malFixture({malSession:{...testSession(),expiresAt:0},malDisconnected:true});
 service.token=async()=>{const error=Error('invalid_grant');error.status=400;throw error;};
 await assert.rejects(service.reconnect());assert.equal(service.connected,false);assert.equal(service.rememberedUser,'test-user');assert.ok(memory.get('malSession'));assert.match(service.connectionError(),/Autorizza di nuovo/);
});
test('Clearing downloaded data retains access and does not repopulate from an in-flight sync',async()=>{
 const {service,memory}=malFixture({malSession:testSession(),malData:{entries:{10:{watched:3}}},history:{keep:true}});let finish;
 service.auth=async()=>new Promise(resolve=>finish=resolve);const sync=service.sync();service.clearDownloaded();finish({data:[{node:{id:20},list_status:{num_episodes_watched:4}}],paging:{}});await sync;
 assert.equal(Object.keys(service.entries()).length,0);assert.equal(memory.get('malData'),null);assert.equal(service.connected,true);assert.equal(service.rememberedUser,'test-user');assert.equal(memory.get('history').keep,true);
 service.request=async()=>{throw Error('Cache must stay empty until an explicit refresh');};await service.syncIfOld();
});
test('Clearing pending updates prevents an in-flight read from sending the discarded update',async()=>{
 const {service,memory}=malFixture({malSession:testSession(),malOutbox:{10:[1]}});let finish,writes=0;
 service.auth=async(_path,options)=>{if(options?.method==='PUT'){writes++;return {};}return new Promise(resolve=>finish=resolve);};
 const flush=service.flush();service.clearPendingUpdates();finish({num_episodes:12,my_list_status:{num_episodes_watched:0}});await flush;
 assert.equal(writes,0);assert.equal(Object.keys(memory.get('malOutbox')).length,0);
});
test('Forget account removes remembered tokens and a late reconnect cannot restore them',async()=>{
 const {service,memory}=malFixture({malSession:testSession(),malDisconnected:true,malOutbox:{10:[1]},malPublicData:{username:'kept-public'}});let finish;
 service.request=async()=>new Promise(resolve=>finish=resolve);const reconnect=service.reconnect();service.forgetAccount();finish({id:7,name:'test-user'});await reconnect;
 assert.equal(service.connected,false);assert.equal(service.rememberedUser,'');assert.equal(memory.get('malSession'),null);assert.equal(memory.get('malData'),null);assert.equal(Object.keys(memory.get('malOutbox')).length,0);assert.equal(memory.get('malPublicData').username,'kept-public');
});
test('Public download cleanup retains username and can be reversed with a fresh import',async()=>{
 const {store,memory}=malFixture({malPublicData:{username:'test-user',entries:{10:{watched:3}},syncedAt:123}});
 const {MalPublicService}=load('src/app/core/mal-public.service.ts',{AbortController,fetch:async()=>({ok:true,status:200,json:async()=>({data:[{node:{id:20},list_status:{num_episodes_watched:2}}],paging:{}})})},{'./mal.service':{MAL_PUBLIC_CLIENT_ID:'test-client'}});
 const service=new MalPublicService(store);service.clearDownloaded();assert.equal(service.username(),'test-user');assert.equal(service.count,0);assert.equal(memory.get('malPublicData').username,'test-user');
 await service.importUsername(service.username());assert.equal(service.count,1);assert.equal(service.isSeen({mal_id:20},{number:'2'}),true);
});
test('Dashboard totals use watched episodes, known durations and assigned ratings only',()=>{
 const {parseMalEntry,summarizeMal,filterMalRows}=load('src/app/core/mal-library.ts');
 const make=(id,title,watched,total,status,score,duration,genres)=>({id,title,...parseMalEntry({node:{id,title,num_episodes:total,average_episode_duration:duration,genres:genres.map(name=>({name})),media_type:'tv',alternative_titles:{en:'Alias '+id}},list_status:{num_episodes_watched:watched,status,score}})});
 const rows=[make(1,'Série A',3,12,'watching',8,1200,['Action','Fantasy']),make(2,'B',12,12,'completed',0,1800,['Fantasy']),make(3,'C',0,24,'plan_to_watch',10,1440,['Comedy'])];
 const stats=summarizeMal(rows);assert.equal(stats.started,2);assert.equal(stats.episodes,15);assert.equal(stats.hours,7);assert.equal(stats.averageScore,8);assert.equal(stats.completed,1);assert.equal(stats.genres[0].name,'Fantasy');assert.equal(stats.genres[0].count,2);
 const filters={query:'',status:'',type:'',genres:[],watch:'all',order:'title'};
 assert.deepEqual(Array.from(filterMalRows(rows,{...filters,genres:['Action','Fantasy']}),r=>r.id),[1]);
 assert.deepEqual(Array.from(filterMalRows(rows,{...filters,query:'serie a'}),r=>r.id),[1]);
 assert.deepEqual(Array.from(filterMalRows(rows,{...filters,query:'alias 2'}),r=>r.id),[2]);
 assert.deepEqual(Array.from(filterMalRows(rows,{...filters,watch:'never'}),r=>r.id),[3]);
});
test('Library availability and profile selection never merge different MAL accounts',()=>{
 const {service:mal,store}=malFixture({malSession:testSession(),malData:{entries:{10:{watched:5,total:12,status:'watching'}}}});let publicName='other-user';
 const publicMal={username:()=>publicName,entries:()=>({20:{watched:2,total:10,status:'watching'}}),loading:()=>false};store.history=()=>({});store.watchEvents=()=>({'a':{malId:10,animeId:99,number:'3'},'b':{malId:10,animeId:99,number:'7'}});
 const {MalLibraryService}=load('src/app/core/mal-library.service.ts');const library=new MalLibraryService(mal,publicMal,store);
 assert.equal(library.available(),true);assert.deepEqual(Array.from(library.rows(),r=>r.id),[10]);assert.equal(library.progress({id:99,mal_id:10,episodes_count:12}).watched,6);
 library.preferred.set('public');assert.deepEqual(Array.from(library.rows(),r=>r.id),[20]);assert.equal(library.username(),'other-user');
 mal.disconnect();assert.equal(library.available(),true);publicName='';assert.equal(library.available(),false);
});
test('Watch and exploration filters compose across catalog pages without skipping matches',async()=>{
 const records=Array.from({length:120},(_,i)=>({id:i+1,title:'Anime '+(i+1)}));let calls=0;
 const catalog={domain:()=> 'https://catalog.test',genres:()=>[]};const ordered={page:async(_filters,offset)=>{calls++;return {records:records.slice(offset,offset+30),tot:records.length};}};
 const library={progressKey:()=> 'profile',progress:anime=>({watched:anime.id%2===0?1:0,remaining:3})};
 const exploration={fingerprint:()=> 'explored',matches:anime=>anime.id%3!==0};
 const {CatalogProgressService}=load('src/app/core/catalog-progress.service.ts');const service=new CatalogProgressService(catalog,library,ordered,exploration);
 const filters={watch:'never',explored:'never'};const first=await service.page(filters,0),next=await service.page(filters,30);
 const expected=records.filter(a=>a.id%2!==0&&a.id%3!==0).map(a=>a.id);
 assert.deepEqual([...Array.from(first.records,a=>a.id),...Array.from(next.records,a=>a.id)],expected);assert.equal(first.exact,true);assert.equal(next.hasMore,false);assert.equal(calls,4);
});

test('Minimum score filters all catalog pages while preserving order and excluding unrated titles',async()=>{
 const rows=Array.from({length:120},(_,i)=>({id:i+1,score:i%4===0?'8.50':i%4===1?'7.99':i%4===2?null:'9.0'}));
 const catalog={domain:()=> 'test'},ordered={page:async(_f,offset)=>({records:rows.slice(offset,offset+30),tot:rows.length})};
 const library={progressKey:()=>'',progress:a=>({watched:a.id%3===0?1:0,remaining:2})},exploration={fingerprint:()=>'',matches:()=>true};
 const {CatalogProgressService}=load('src/app/core/catalog-progress.service.ts');const service=new CatalogProgressService(catalog,library,ordered,exploration),filters={minScore:8,watch:'never'};
 const first=await service.page(filters,0),next=await service.page(filters,30);
 const expected=rows.filter(a=>Number(a.score)>=8&&a.id%3!==0).map(a=>a.id);
 assert.deepEqual([...Array.from(first.records,a=>a.id),...Array.from(next.records,a=>a.id)],expected);assert.equal(next.exact,true);
});

test('Minimum score applies to latest episodes and explored titles, including absent or invalid ratings',async()=>{
 const rows=[{id:1,score:'8.5',title:'A'},{id:2,score:'7.99',title:'B'},{id:3,score:null,title:'C'},{id:4,score:'9.1',title:'D'},{id:5,score:11,title:'E'}];
 const catalog={domain:()=> 'test',recentPage:async()=>({records:rows,lastPage:1})};
 const library={progressKey:()=>'',progress:()=>({watched:0,remaining:2})},exploration={fingerprint:()=>'',matches:()=>true,recent:()=>rows.map(anime=>({anime}))};
 const {CatalogProgressService}=load('src/app/core/catalog-progress.service.ts');const service=new CatalogProgressService(catalog,library,{},exploration);
 for(const filters of [{order:'episode_desc',minScore:8},{explored:'like',minScore:8}]){const result=await service.page(filters,0);assert.deepEqual(Array.from(result.records,a=>a.id),[1,4]);}
 const all=await service.page({order:'episode_desc'},0);assert.equal(all.records.length,5);
});

test('Latest episode ordering deduplicates series across pages and composes audio, watch and genre filters',async()=>{
 const rows=Array.from({length:76},(_,i)=>({id:i+1,slug:'anime-'+(i+1),title:'Anime '+(i+1),dub:i%2,type:'TV',lastEpisodeDate:'2026-11-01'}));
 const updates=[...rows.slice(0,30),...rows.slice(0,5),...rows.slice(30)];
 let genreCalls=0;
 const catalog={domain:()=> 'test',recentPage:async page=>({records:updates.slice((page-1)*30,page*30),lastPage:Math.ceil(updates.length/30)}),catalog:async f=>{genreCalls++;const row=rows.find(a=>a.title===f.title);return {records:row&&row.id%3===0?[row]:[],tot:row&&row.id%3===0?1:0};}};
 const library={progressKey:()=>'',progress:a=>({watched:a.id%4===0?1:0,remaining:12})};
 const exploration={fingerprint:()=>'',matches:(a,f)=>!f||f==='all'||f==='never'&&a.id%5!==0};
 const {CatalogProgressService}=load('src/app/core/catalog-progress.service.ts');const service=new CatalogProgressService(catalog,library,{},exploration);
 const first=await service.page({order:'episode_desc'},0),second=await service.page({order:'episode_desc'},30);
 assert.deepEqual([...Array.from(first.records,a=>a.id),...Array.from(second.records,a=>a.id)],rows.slice(0,60).map(a=>a.id));
 const filtered=await service.page({order:'episode_desc',dubbed:0,watch:'never',explored:'never',genres:[7]},0);
 assert.deepEqual(Array.from(filtered.records,a=>a.id),rows.filter(a=>a.dub===0&&a.id%4!==0&&a.id%5!==0&&a.id%3===0).map(a=>a.id));
 assert.equal(filtered.exact,true);assert.ok(genreCalls>0);
});

test('Latest episode search retries a failed genre lookup without skipping the provider page',async()=>{
 const rows=[{id:1,slug:'a',title:'A',dub:0},{id:2,slug:'b',title:'B',dub:0}];let fail=true;
 const catalog={domain:()=> 'test',recentPage:async()=>({records:rows,lastPage:1}),catalog:async f=>{if(f.title==='B'&&fail){fail=false;throw Error('network');}return {records:rows.filter(a=>a.title===f.title),tot:1};}};
 const library={progressKey:()=>'',progress:()=>({watched:0,remaining:1})},exploration={fingerprint:()=>'',matches:()=>true};
 const {CatalogProgressService}=load('src/app/core/catalog-progress.service.ts');const service=new CatalogProgressService(catalog,library,{},exploration),filters={order:'episode_desc',genres:[1]};
 await assert.rejects(service.page(filters,0),/network/);const result=await service.page(filters,0);assert.deepEqual(Array.from(result.records,a=>a.id),[1,2]);
});

test('Latest episode genre filtering handles entries without the primary title',async()=>{
 const rows=[{id:1,slug:'a',title:null,title_eng:'English title'},{id:2,slug:'b',title:null}];
 const catalog={domain:()=> 'test',recentPage:async()=>({records:rows,lastPage:1}),catalog:async f=>({records:f.title==='English title'?[rows[0]]:[],tot:1}),detail:async a=>({anime:{...a,genres:[{id:7}]}})};
 const library={progressKey:()=>'',progress:()=>({watched:0,remaining:0})},exploration={fingerprint:()=>'',matches:()=>true};
 const {CatalogProgressService}=load('src/app/core/catalog-progress.service.ts');const service=new CatalogProgressService(catalog,library,{},exploration);
 const result=await service.page({order:'episode_desc',genres:[7]},0);assert.deepEqual(Array.from(result.records,a=>a.id),[1,2]);
});

test('Provider episode updates preserve publication date and exclude hidden or undated episodes',()=>{
 const {CatalogService}=load('src/app/core/catalog.service.ts');const service=new CatalogService({read:(_key,fallback)=>fallback});
 const data={last_page:2,data:[{number:3,created_at:'2026-11-11 19:02:21',public:1,hidden:0,anime:{id:1,slug:'one'}},{number:2,created_at:'2026-11-10 10:00:00',public:1,hidden:1,anime:{id:2,slug:'hidden'}},{number:1,public:1,anime:{id:3,slug:'undated'}}]};
 const result=service.episodeUpdates({querySelector:()=>({getAttribute:()=>JSON.stringify(data)})});
 assert.equal(result.lastPage,2);assert.equal(result.records.length,1);assert.equal(result.records[0].lastEpisode,'3');assert.equal(result.records[0].lastEpisodeDate,'2026-11-11 19:02:21');
});
test('Discovery feedback persists, unifies audio variants and filters liked records locally',async()=>{
 const memory=new Map(),store={read:(key,fallback)=>memory.get(key)??fallback,write:(key,value)=>{memory.set(key,value);return true;}};
 const {ExplorationService}=load('src/app/core/exploration.service.ts');const exploration=new ExplorationService(store);
 exploration.mark({id:1,mal_id:100,title:'One',type:'TV'},'like');exploration.mark({id:2,mal_id:200,title:'Two',type:'Movie'},'dislike');exploration.mark({id:3,mal_id:100,title:'One DUB',dub:1});
 assert.equal(exploration.stats().total,2);assert.equal(exploration.stats().liked,1);assert.equal(exploration.matches({id:1,mal_id:100},'never'),false);assert.equal(new ExplorationService(store).stats().disliked,1);
 const {CatalogProgressService}=load('src/app/core/catalog-progress.service.ts');const service=new CatalogProgressService({domain:()=> 'test'}, {progress:()=>({watched:0,remaining:12})},{page:async()=>{throw Error('No network required');}},exploration);
 const result=await service.page({explored:'like',watch:'never'},0);assert.equal(result.records.length,1);assert.equal(result.records[0].mal_id,100);assert.equal(result.exact,true);
});
function orderCatalogFixture(){
 const records=Array.from({length:90},(_,i)=>({id:i+1,title:'Anime '+String(i+1).padStart(3,'0'),date:i<45?'2026':'2025',season:i%2?'Autunno':'Inverno',dub:i%3===0?1:0}));
 return {records,catalog:{domain:()=> 'test',oldestYear:()=>2025,catalog:async(filters,offset=0)=>{const filtered=records.filter(a=>(!filters.year||Number(a.date)===Number(filters.year))&&(filters.dubbed!==1||a.dub===1));return {records:filtered.slice(offset,offset+30),tot:filtered.length};}}};
}
test('Random catalog ordering is stable across pages, reproducible and reshuffles with a new seed',async()=>{
 const {CatalogOrderService}=load('src/app/core/catalog-order.service.ts');const {catalog}=orderCatalogFixture();const service=new CatalogOrderService(catalog),filters={order:'random',randomSeed:42};
 const first=await service.page(filters,0),second=await service.page(filters,30);const ids=[...Array.from(first.records,a=>a.id),...Array.from(second.records,a=>a.id)];assert.equal(new Set(ids).size,60);
 const repeat=await new CatalogOrderService(catalog).page(filters,0);assert.deepEqual(Array.from(repeat.records,a=>a.id),Array.from(first.records,a=>a.id));
 const changed=await service.page({...filters,randomSeed:43},0);assert.notDeepEqual(Array.from(changed.records,a=>a.id),Array.from(first.records,a=>a.id));
 const sub=await service.page({...filters,dubbed:0},0);assert.equal(sub.tot,60);assert.ok(sub.records.every(a=>a.dub===0));
});
test('Release ordering sorts globally by year and season, not only the current backend page',async()=>{
 const {CatalogOrderService,releaseValue}=load('src/app/core/catalog-order.service.ts');const {catalog}=orderCatalogFixture();const service=new CatalogOrderService(catalog);
 const first=await service.page({order:'release_desc'},0),second=await service.page({order:'release_desc'},30);const values=[...first.records,...second.records].map(releaseValue);assert.ok(values.every((n,i)=>!i||values[i-1]>=n));
 const oldest=await service.page({order:'release_asc'},0);assert.ok(oldest.records.every(a=>a.date==='2025'));assert.equal(oldest.records[0].season,'Inverno');
});
test('Retrying a failed random batch does not skip titles',async()=>{
 const {CatalogOrderService}=load('src/app/core/catalog-order.service.ts');const {catalog}=orderCatalogFixture();const original=catalog.catalog;let calls=0;
 catalog.catalog=async(...args)=>{calls++;if(calls===3)throw Error('Temporary provider failure');return original(...args);};
 const service=new CatalogOrderService(catalog),filters={order:'random',randomSeed:17};await assert.rejects(service.page(filters,0),/Temporary/);
 const retry=await service.page(filters,0),expected=await new CatalogOrderService({...catalog,catalog:original}).page(filters,0);
 assert.deepEqual(Array.from(retry.records,a=>a.id),Array.from(expected.records,a=>a.id));
});
test('Personal list release sort uses MAL dates and puts unavailable dates last',()=>{
 const {filterMalRows}=load('src/app/core/mal-library.ts');const rows=[{id:1,title:'Old',watched:1,total:12,status:'watching',score:0,anime:{release:'2010-05-01'}},{id:2,title:'New',watched:1,total:12,status:'watching',score:0,anime:{release:'2026-10-01'}},{id:3,title:'Unknown',watched:1,total:12,status:'watching',score:0}];
 const filters={query:'',status:'',type:'',genres:[],watch:'all',order:'release_desc'};
 assert.deepEqual(Array.from(filterMalRows(rows,filters),r=>r.id),[2,1,3]);assert.deepEqual(Array.from(filterMalRows(rows,{...filters,order:'release_asc'}),r=>r.id),[1,2,3]);
});

test('Watch coverage survives resume and completes before end without crediting a seek',()=>{
 const {WatchProgress}=load('src/app/core/watch-progress.ts');let tracker=new WatchProgress();
 for(let p=0;p<=800;p+=5)tracker.sample(p,1200,true,p*1000+1);
 assert.equal(tracker.complete(800),false);assert.equal(tracker.watched(),800);
 tracker=new WatchProgress(tracker.snapshot());
 for(let p=800;p<=1080;p+=5)tracker.sample(p,1200,true,p*1000+1);
 assert.equal(tracker.complete(1080),true);assert.equal(tracker.watched(),1080);
 const seek=new WatchProgress();seek.sample(0,1200,true,1);seek.sample(1100,1200,true,1001);assert.equal(seek.complete(1100),false);assert.equal(seek.watched(),0);
 tracker.interrupt();tracker.sample(1100,1200,true,2000000);assert.equal(tracker.complete(1100),false);
});
test('Exploration preference deletion preserves viewed status and undo restores the original record',()=>{
 const {ExplorationService}=load('src/app/core/exploration.service.ts');let persisted={};const service=new ExplorationService({read:()=>({}),write:(k,v)=>{persisted=v;return true;}});
 const anime={id:1,mal_id:10};service.mark(anime,'like');const before=service.get(anime);service.resetFeedback(anime);assert.equal(service.get(anime).feedback,'neutral');assert.equal(service.get(anime).viewedAt,before.viewedAt);service.restore(anime,before);assert.equal(service.get(anime).feedback,'like');service.clearFeedback('like');assert.equal(service.stats().total,1);assert.equal(service.stats().liked,0);service.restore(anime,undefined);assert.equal(Object.keys(persisted).length,0);
});

test('Manual MAL seen changes raise and lower progress even with automatic updates paused',async()=>{
 const {service}=malFixture({malSession:testSession(),malAutoUpdate:false});let remote=4;const writes=[];
 service.auth=async(path,init)=>{if(init?.method==='PUT'){const body=new URLSearchParams(init.body);remote=Number(body.get('num_watched_episodes'));writes.push([remote,body.get('status')]);return {};}return {num_episodes:12,my_list_status:{num_episodes_watched:remote,status:'watching',score:7}};};
 assert.equal(await service.setEpisodeSeen({id:1,mal_id:10},{id:2,number:8},true),8);
 assert.equal(await service.setEpisodeSeen({id:1,mal_id:10},{id:2,number:5},false),4);
 assert.deepEqual(writes,[[8,'watching'],[4,'watching']]);assert.equal(service.entries()[10].watched,4);
});


test('Release order recovers omitted seasons via paginated season filters before sorting a year',async()=>{
 const {CatalogOrderService,releaseValue}=load('src/app/core/catalog-order.service.ts');
 const rows=Array.from({length:72},(_,i)=>({id:i+1,title:String(i).padStart(3,'0'),date:'2026'}));
 const seasons=['Inverno','Primavera','Estate','Autunno'];
 const catalog={domain:()=> 'test',oldestYear:()=>2026,catalog:async(f,offset=0)=>{const records=rows.filter(a=>(!f.year||f.year===2026)&&(!f.season||seasons[Math.floor((a.id-1)/36)*3]===f.season));return {records:records.slice(offset,offset+30),tot:records.length};}};
 const service=new CatalogOrderService(catalog);const first=await service.page({order:'release_desc'},0),second=await service.page({order:'release_desc'},30);
 assert.equal(first.records[0].id,72);assert.ok(first.records.every(a=>a.season==='Autunno'));assert.equal(second.records[6].season,'Inverno');
 assert.ok(releaseValue({date:'2026-10-22'})>releaseValue({date:'2026-10-01'}));
 assert.ok(releaseValue({date:'2026-10-01'})>releaseValue({date:'2026',season:'Primavera'}));
});

test('Sidebar preferences persist order and visibility while settings cannot be hidden',()=>{
 const {SidebarService,normalizeSidebar}=load('src/app/core/sidebar.service.ts');let settings={};const store={settings:()=>settings,setSetting:(key,value)=>{settings={...settings,[key]:value};}};
 const service=new SidebarService(store);service.toggle('history');service.move('explore',-1);assert.equal(service.items()[1].id,'explore');assert.equal(service.items().find(item=>item.id==='history').visible,false);
 const reloaded=new SidebarService(store);assert.equal(reloaded.items()[1].id,'explore');assert.equal(reloaded.items().find(item=>item.id==='history').visible,false);reloaded.toggle('settings');assert.equal(reloaded.items().find(item=>item.id==='settings').visible,true);
 const valid=normalizeSidebar({order:['history','history','invalid'],hidden:['settings','invalid','home']});assert.equal(valid.order.length,7);assert.equal(valid.order[0],'history');assert.deepEqual(Array.from(valid.hidden),['home']);
 service.reset();assert.equal(service.items()[0].id,'home');assert.ok(service.items().every(item=>item.visible));
});

test('Release dates fetch matches only requested MAL IDs, preserves audio variants and caches across reloads',async()=>{
 let saved={},calls=0;
 const {ReleaseDatesService}=load('src/app/core/release-dates.service.ts',{AbortController,fetch:async(url,init)=>{calls++;assert.equal(url,'https://graphql.anilist.co');assert.deepEqual(JSON.parse(init.body).variables.ids,[10,20]);assert.equal(init.headers.Authorization,undefined);return {ok:true,json:async()=>({data:{Page:{media:[{idMal:10,startDate:{year:2026,month:10,day:25}},{idMal:20,startDate:{year:2026,month:10,day:1}},{idMal:99,startDate:{year:2026,month:10,day:31}}]}}})};}});
 const store={read:()=>saved,write:(key,value)=>{saved=value;return true;}};
 const rows=[{id:1,mal_id:10,date:'2026'},{id:2,mal_id:20,date:'2026'},{id:3,mal_id:10,date:'2026'}];
 const result=await new ReleaseDatesService(store).enrich(rows);assert.equal(result[0].releaseDate,'2026-10-25');assert.equal(result[2].releaseDate,'2026-10-25');assert.equal(saved[99],undefined);assert.equal(rows[0].releaseDate,undefined);
 await new ReleaseDatesService(store).enrich(rows);assert.equal(calls,1);
 const {compareRelease}=load('src/app/core/catalog-order.service.ts');assert.equal([...result].sort((a,b)=>compareRelease(a,b,true))[0].releaseDate,'2026-10-25');
});
test('Complete release dates override alphabetical title order across catalog pages',async()=>{
 const {CatalogOrderService}=load('src/app/core/catalog-order.service.ts');const rows=Array.from({length:65},(_,i)=>({id:i+1,mal_id:i+1,title:'Anime '+String(i).padStart(3,'0'),date:'2026',season:'Autunno'}));
 const catalog={domain:()=> 'test',oldestYear:()=>2026,catalog:async(f,offset=0)=>{const all=!f.year||f.year===2026?rows:[];return {records:all.slice(offset,offset+30),tot:all.length};}};
 const dates={enrich:async records=>records.map(a=>({...a,releaseDate:'2026-'+String(8+Math.floor((a.id-1)/28)).padStart(2,'0')+'-'+String((a.id-1)%28+1).padStart(2,'0')}))};
 const service=new CatalogOrderService(catalog,dates);const first=await service.page({order:'release_desc'},0),second=await service.page({order:'release_desc'},30);assert.equal(first.records[0].id,65);assert.equal(second.records[0].id,35);assert.equal(first.tot,65);
 const asc=await service.page({order:'release_asc'},0);assert.equal(asc.records[0].id,1);
});
test('Release metadata outage keeps catalog records and does not persist a false date',async()=>{
 const {ReleaseDatesService}=load('src/app/core/release-dates.service.ts',{AbortController,fetch:async()=>{throw Error('offline');}});let cache={};const service=new ReleaseDatesService({read:()=>cache,write:(k,v)=>{cache=v;return true;}});const result=await service.enrich([{id:1,mal_id:10,date:'2026'}]);assert.equal(result.length,1);assert.equal(result[0].releaseDate,undefined);assert.equal(Object.keys(cache).length,0);
});

test('Exit confirmation applies to every base route while nested pages keep their Back navigation',()=>{
 const {isBaseRoute,NavigationService}=load('src/app/core/navigation.service.ts');for(const route of ['home','catalog','explore','my-anime','favorites','history','settings'])assert.equal(isBaseRoute(route),true);for(const route of ['detail','related','mal','diagnostics'])assert.equal(isBaseRoute(route),false);
 const nav=new NavigationService();nav.open('catalog');nav.open('detail',{anime:{id:1}});nav.back();assert.equal(nav.route().name,'catalog');
});
test('Confirmed TV exit calls the current Tizen application only',()=>{
 let exits=0;const {TizenService}=load('src/app/core/tizen.service.ts',{window:{tizen:{},addEventListener(){}},navigator:{onLine:true},tizen:{application:{getCurrentApplication:()=>({exit(){exits++;}})}}});assert.equal(new TizenService().exitApp(),true);assert.equal(exits,1);
 const browser=load('src/app/core/tizen.service.ts',{window:{addEventListener(){}},navigator:{onLine:true}});assert.equal(new browser.TizenService().exitApp(),false);
});

function nextEpisodeFixture(){
 const document={activeElement:null};const {PlaybackService}=load('src/app/core/playback.service.ts',{document,AbortController});const saved=[];
 const local={history:()=>({}),settings:()=>({autonext:false}),watchCoverage:Object.assign(()=>({}),{set(){}}),watchKey:()=> 'mal:10:1',write(){},progress:(...args)=>saved.push(args)};
 const player=new PlaybackService({},local,{},{},{},{queue(){}},{});player.detail={anime:{id:10,mal_id:10},episodes:[{id:1,number:'1'},{id:2,number:'2',public:1}]};player.episode=player.detail.episodes[0];player.state.set({opened:true,playing:true,buffering:false,error:'',position:0,duration:1440,title:'Test',episode:1});return {player,saved,document};
}
test('Next episode prompt appears near end only for an available next episode, including when autoplay is off',()=>{
 const {player}=nextEpisodeFixture();assert.equal(player.showNextEpisode,false);player.state.update(s=>({...s,position:1296}));assert.equal(player.showNextEpisode,true);
 player.state.update(s=>({...s,buffering:true}));assert.equal(player.showNextEpisode,false);player.state.update(s=>({...s,buffering:false,duration:120,position:107}));assert.equal(player.showNextEpisode,false);player.state.update(s=>({...s,position:108}));assert.equal(player.showNextEpisode,true);
 player.detail.episodes[1].public=0;assert.equal(player.showNextEpisode,false);player.detail.episodes.pop();assert.equal(player.nextEpisode,null);assert.equal(player.showNextEpisode,false);
});
test('Next episode saves current progress before opening the next and OK works with hidden controls',async()=>{
 const {player,saved,document}=nextEpisodeFixture();player.state.update(s=>({...s,position:1300}));player.controls.set(false);let opened;
 player.open=async(detail,episode)=>{assert.equal(saved.length,1);opened=episode;};document.activeElement={getAttribute:()=> 'player-next-episode'};
 assert.equal(player.handleKey({key:'Enter',keyCode:13,repeat:false}),true);await Promise.resolve();assert.equal(opened.number,'2');assert.equal(saved[0][2],1300);
});

test('AniSkip ending accepts compatible unambiguous ED only and shares the opening request',async()=>{
 let calls=0;const memory={};const {IntroService}=load('src/app/core/intro.service.ts',{AbortController,fetch:async url=>{calls++;assert.match(url,/types%5B%5D=op&types%5B%5D=ed/);return {ok:true,status:200,json:async()=>({found:true,results:[{skipType:'op',episodeLength:1440,interval:{startTime:60,endTime:150}},{skipType:'ed',episodeLength:1440,interval:{startTime:1250,endTime:1340}}]})};}});
 const service=new IntroService({read:(key,fallback)=>memory[key]??fallback,write:(key,value)=>{memory[key]=value;return true;}}),ctx={mal:10,number:1,duration:1440,key:'test'};
 const [opening,ending]=await Promise.all([service.load(ctx),service.loadEnding(ctx)]);assert.equal(calls,1);assert.equal(opening.interval.start,60);assert.equal(ending.start,1250);assert.equal(ending.source,'aniskip');
 service.fetchTimes=async()=>[{skipType:'ed',episodeLength:1500,interval:{startTime:1250,endTime:1340}}];assert.equal(await service.loadEnding(ctx),null);
 service.fetchTimes=async()=>[{skipType:'ed',episodeLength:1440,interval:{startTime:1250,endTime:1340}},{skipType:'ed',episodeLength:1440,interval:{startTime:1300,endTime:1390}}];assert.equal(await service.loadEnding(ctx),null);
 service.fetchTimes=async()=>[{skipType:'ed',episodeLength:1440,interval:{startTime:60,endTime:150}}];assert.equal(await service.loadEnding(ctx),null);
 service.fetchTimes=async()=>{throw Error('Offline');};assert.equal(await service.loadEnding(ctx),null);
});
test('Verified ending controls next prompt timing and still requires 75 percent actual coverage to mark seen',()=>{
 const {player}=nextEpisodeFixture();player.ending.set({start:1250,end:1340,source:'aniskip'});player.state.update(s=>({...s,position:1249}));assert.equal(player.showNextEpisode,false);player.state.update(s=>({...s,position:1250}));assert.equal(player.showNextEpisode,false);assert.equal(player.activeSkip.kind,'ending');player.state.update(s=>({...s,position:1340}));assert.equal(player.showNextEpisode,true);assert.equal(player.activeSkip,null);
 const {WatchProgress}=load('src/app/core/watch-progress.ts');const progress=new WatchProgress();for(let p=0;p<=1250;p+=5)progress.sample(p,1440,true,p*1000+1);assert.equal(progress.complete(1250),false);assert.equal(progress.complete(1250,1250),true);
 const skipped=new WatchProgress();skipped.sample(1240,1440,true,1);skipped.sample(1250,1440,true,10001);assert.equal(skipped.complete(1250,1250),false);
 player.ending.set(null);player.state.update(s=>({...s,position:1250}));assert.equal(player.showNextEpisode,false);
});

test('Audio-confirmed opening shifts AniSkip ending by the same offset and rejects mixed versions',async()=>{
 const {IntroService}=load('src/app/core/intro.service.ts');const service=new IntroService({read:()=>({}),write:()=>true});const ctx={mal:10,number:1,duration:1470,key:'test'};
 const op={skipType:'op',episodeLength:1440,interval:{startTime:60,endTime:150}},ed={skipType:'ed',episodeLength:1440,interval:{startTime:1250,endTime:1340}};
 service.fetchTimes=async()=>[op,ed];assert.equal(await service.loadEnding(ctx),null);
 const shifted=await service.loadEnding(ctx,{start:90,end:180,source:'audio'});assert.equal(shifted.start,1280);assert.equal(shifted.end,1370);
 const negative=await service.loadEnding({...ctx,duration:1410},{start:30,end:120,source:'fingerprint'});assert.equal(negative.start,1220);
 assert.equal(await service.loadEnding(ctx,{start:90,end:200,source:'audio'}),null);
 service.fetchTimes=async()=>[op,{...ed,episodeLength:1450}];assert.equal(await service.loadEnding(ctx,{start:90,end:180,source:'audio'}),null);
 service.fetchTimes=async()=>[op,{...op,interval:{startTime:75,endTime:165}},ed];assert.equal(await service.loadEnding(ctx,{start:90,end:180,source:'audio'}),null);
});

test('TV platform detection distinguishes Samsung, LG, Android, Fire OS, Vega and browser',()=>{
 const {detectTvPlatform}=load('src/app/core/tv-platform.service.ts');assert.equal(detectTvPlatform({tizen:{}},''),'tizen');assert.equal(detectTvPlatform({webOSSystem:{}},''),'webos');assert.equal(detectTvPlatform({},'Mozilla Web0S Chrome/108'),'webos');assert.equal(detectTvPlatform({AniPlayerNative:{}},'Android TV'),'android');assert.equal(detectTvPlatform({AniPlayerNative:{}},'Android AFTSSS'),'fireos');assert.equal(detectTvPlatform({},'Vega Kepler'),'vega');assert.equal(detectTvPlatform({},'VIDAA SmartTV'),'vidaa');assert.equal(detectTvPlatform({},'Chrome Linux'),'browser');
});
test('LG Back and Android media keys use the same player semantics as Samsung',()=>{
 const {remoteKey}=load('src/app/core/remote.service.ts');for(const code of [461,4,10009])assert.equal(remoteKey({keyCode:code}),'Back');for(const code of [85,179,10252])assert.equal(remoteKey({keyCode:code}),'MediaPlayPause');assert.equal(remoteKey({keyCode:23}),'Enter');assert.equal(remoteKey({key:'ArrowRight'}),'ArrowRight');
 const {player}=nextEpisodeFixture();let paused=0;player.pause=()=>paused++;assert.equal(player.handleKey({keyCode:461}),true);assert.equal(player.controls(),false);assert.equal(player.handleKey({keyCode:19}),true);assert.equal(paused,1);
});
test('LG adapter launches external browser through Luna and does not expose Samsung AVPlay',()=>{
 const calls=[];class Bridge{call(uri,body){calls.push([uri,JSON.parse(body)]);this.onservicecallback();}}
 const {TvPlatformService}=load('src/app/core/tv-platform.service.ts',{window:{webOSSystem:{},PalmServiceBridge:Bridge,webapis:{avplay:{}},addEventListener(){},close(){calls.push(['close']);}},navigator:{onLine:true,userAgent:'Web0S'}});
 const platform=new TvPlatformService();assert.equal(platform.getAvplay(),null);platform.openExternal('https://myanimelist.net/');assert.equal(calls[0][0],'luna://com.webos.applicationManager/launch');assert.equal(calls[0][1].id,'com.webos.app.browser');assert.equal(platform.exitApp(),true);assert.throws(()=>platform.openExternal('javascript:alert(1)'),/non consentito/);
});


test('Recap and finale skips preserve post-credit material and remote OK skips only the active interval',async()=>{
 const {player,document}=nextEpisodeFixture();let sought=null,next=0;player.seekTo=position=>{sought=position;};player.next=async()=>{next++;};
 player.recap.set({start:0,end:55,source:'aniskip'});player.intro.set({start:60,end:150,source:'aniskip'});
 assert.equal(player.activeSkip.kind,'recap');await player.skipCurrentSegment();assert.equal(sought,55);assert.equal(next,0);
 player.state.update(s=>({...s,position:60}));assert.equal(player.activeSkip.kind,'opening');
 player.ending.set({start:1250,end:1340,source:'audio'});player.state.update(s=>({...s,position:1250}));document.activeElement={getAttribute:()=> 'player-skip-segment'};
 assert.equal(player.showNextEpisode,false);assert.equal(player.handleKey({key:'Enter',repeat:false}),true);await Promise.resolve();assert.equal(sought,1340);assert.equal(next,0);
 player.state.update(s=>({...s,position:1340}));assert.equal(player.activeSkip,null);assert.equal(player.showNextEpisode,true);
 player.ending.set({start:1350,end:1440,source:'aniskip'});player.state.update(s=>({...s,position:1350}));player.showControls();await player.skipCurrentSegment();assert.equal(next,1);
 player.detail.episodes.pop();player.showControls();await player.skipCurrentSegment();assert.equal(next,1);assert.equal(sought,1440);
 player.ending.set(null);player.intro.set(null);player.recap.set(null);player.state.update(s=>({...s,position:1400}));assert.equal(player.activeSkip,null);
});

test('Manual narrative/recap/ending intervals are scoped by episode, provider, audio and video duration',()=>{
 const data={};const store={read:(key,fallback)=>data[key]??fallback,write:(key,value)=>{data[key]=value;return true;}};
 const {IntroService}=load('src/app/core/intro.service.ts');const service=new IntroService(store);
 const ctx=service.context({id:1,mal_id:10,slug:'test',dub:0},{number:'1'},1440);
 service.saveSegment(ctx,'prologue',0,35);service.saveSegment(ctx,'ending',1350,1440);
 assert.equal(service.localSegment(ctx,'prologue').end,35);assert.equal(service.localSegment(ctx,'ending').end,1440);
 assert.equal(service.localSegment({...ctx,duration:1500},'ending'),null);assert.equal(service.localSegment({...ctx,key:ctx.key+'dub'},'ending'),null);
 assert.throws(()=>service.saveSegment(ctx,'recap',30,1500),/non valido/);service.clearSegment(ctx,'prologue');assert.equal(service.localSegment(ctx,'prologue'),null);
});

test('AniSkip recap uses duration validation and verified opening offset while rejecting mixed endings',async()=>{
 const {IntroService}=load('src/app/core/intro.service.ts');const service=new IntroService({read:()=>({}),write:()=>true});
 const ctx={mal:10,number:1,duration:1470,key:'test'};
 const op={skipType:'op',episodeLength:1440,interval:{startTime:60,endTime:150}},recap={skipType:'recap',episodeLength:1440,interval:{startTime:0,endTime:55}};
 service.fetchTimes=async()=>[op,recap];assert.equal(await service.loadRecap(ctx),null);
 const shifted=await service.loadRecap(ctx,{start:90,end:180,source:'audio'});assert.equal(shifted.start,30);assert.equal(shifted.end,85);
 service.fetchTimes=async()=>[{skipType:'mixed-ed',episodeLength:1470,interval:{startTime:1300,endTime:1420}}];assert.equal(await service.loadEnding(ctx),null);
 service.fetchTimes=async()=>[{...recap,episodeLength:1470},{...recap,episodeLength:1470,interval:{startTime:5,endTime:60}}];assert.equal(await service.loadRecap(ctx),null);
});

test('Ending audio analyzes each episodes own tail and needs two independent agreeing references',async()=>{
 const {consensus}=load('src/app/core/audio-fingerprint.ts');const windows=[],data={};let comparisons=0,oneOnly=false;
 const modules={
  './mp4-duration':{readVideoDuration:async()=>1500},
  './audio-fingerprint':{INTRO_AUDIO_VERSION:3,consensus,readAudio:async(url,signal,progress,window)=>{windows.push({url,...window});return {url};},inferRepeated:async()=>{comparisons++;if(oneOnly&&comparisons>1)return null;return {start:1300,end:1390,otherStart:1360,score:.95,coverage:1,temporalContrast:.5};}}
 };
 const {EndingDetectorService}=load('src/app/core/ending-detector.service.ts',{DOMException},modules);
 const store={read:(key,fallback)=>data[key]??fallback,write:(key,value)=>{data[key]=value;return true;}};
 const api={page:async()=>({episodes:[{number:'1'},{number:'2'},{number:'3'}]}),source:async(anime,ep)=>'https://example.com/'+ep.number};
 const service=new EndingDetectorService(store,api),anime={slug:'test',dub:0},episode={number:'1'};
 const ending=await service.detect(anime,episode,1440,new AbortController().signal);assert.equal(ending.start,1300);assert.equal(comparisons,2);
 assert.equal(windows[0].start,1140);assert.equal(windows[0].end,1440);assert.equal(windows[1].start,1200);assert.equal(windows[1].end,1500);
 assert.equal(service.saved(anime,episode,1440).end,1390);assert.equal(service.saved({...anime,dub:1},episode,1440),null);
 comparisons=0;oneOnly=true;assert.equal(await service.detect(anime,{number:'4'},1440,new AbortController().signal),null);
});


test('AniSkip prefetch reuses one request for opening, recap and ending and survives app restart',async()=>{
 let calls=0,resolveFetch;const data={};const rows=[{skipType:'op',episodeLength:1440,interval:{startTime:0,endTime:90}},{skipType:'recap',episodeLength:1440,interval:{startTime:90,endTime:150}},{skipType:'ed',episodeLength:1440,interval:{startTime:1350,endTime:1440}}];
 const {IntroService}=load('src/app/core/intro.service.ts',{AbortController,fetch:()=>{calls++;return new Promise(resolve=>{resolveFetch=()=>resolve({ok:true,status:200,json:async()=>({found:true,results:rows})});});}});
 const store={read:(key,fallback)=>data[key]??fallback,write:(key,value)=>{data[key]=value;return true;}},service=new IntroService(store),anime={id:1,mal_id:10,slug:'test'},episode={number:'1'};
 service.prefetch(anime,episode);const ctx=service.context(anime,episode,1440);
 const jobs=[service.load(ctx),service.loadRecap(ctx),service.loadEnding(ctx)];assert.equal(calls,1);resolveFetch();
 const [op,recap,ed]=await Promise.all(jobs);assert.equal(op.interval.start,0);assert.equal(recap.end,150);assert.equal(ed.end,1440);assert.equal(calls,1);
 const restarted=new IntroService(store);restarted.prefetch(anime,episode);const cached=await restarted.load(ctx);assert.equal(cached.interval.end,90);assert.equal(calls,1);
 assert.equal((await restarted.load({...ctx,duration:1500})).state,'review');
});

test('An AniSkip opening at time zero is actionable without invoking audio analysis',async()=>{
 const {player}=nextEpisodeFixture();let analyses=0;player.detail.anime.awSlug='test';
 const window={start:0,end:90,source:'aniskip'};
 player.introService={context:()=>({mal:10,number:1,duration:1440,key:'test'}),local:()=>null,localSegment:()=>null,load:async()=>({state:'ready',interval:window,message:'ready'}),skipLength:()=>({seconds:90}),loadEnding:async()=>null,loadRecap:async()=>({start:90,end:150,source:'aniskip'})};
 player.detector={saved:()=>null,supported:()=>true,detect:async()=>{analyses++;throw Error('must not run');}};
 await player.loadIntro(player.generation);await Promise.resolve();assert.equal(analyses,0);assert.equal(player.activeSkip.kind,'opening');assert.equal(player.intro().end,90);
 player.state.update(s=>({...s,position:90}));assert.equal(player.activeSkip.kind,'recap');
});


test('One Piece 100 ending survives sub-second EOF rounding without hiding post-credit content',async()=>{
 const {IntroService}=load('src/app/core/intro.service.ts');const service=new IntroService({read:()=>({}),write:()=>true});
 const row={skipType:'ed',episodeLength:1440.167,interval:{startTime:1325,endTime:1440}};
 service.fetchTimes=async()=>[row];
 for(const duration of [1439.9,1438,1440,1440.167]){
  const result=await service.loadEnding({mal:21,number:100,duration,key:'test'});assert.ok(result,'ending missing for duration '+duration);assert.equal(result.start,1325);assert.equal(result.end,Math.min(1440,duration));
 }
 assert.equal(await service.loadEnding({mal:21,number:100,duration:1430,key:'test'}),null);
 service.fetchTimes=async()=>[{...row,interval:{startTime:1250,endTime:1340}}];
 assert.equal((await service.loadEnding({mal:21,number:100,duration:1439.9,key:'test'})).end,1340);
 const {player}=nextEpisodeFixture();player.state.update(s=>({...s,duration:1439.9,position:1325}));player.ending.set({start:1325,end:1439.9,source:'aniskip'});
 assert.equal(player.activeSkip.kind,'ending');assert.equal(player.showNextEpisode,false);
});


test('One Piece 100 23m44 file keeps the audio-aligned ending even when the reference credits extend beyond EOF',async()=>{
 const {IntroService}=load('src/app/core/intro.service.ts');const service=new IntroService({read:()=>({}),write:()=>true});
 const ctx={mal:21,number:100,duration:1424,key:'one-piece-100'};
 const op={skipType:'op',episodeLength:1440.167,interval:{startTime:.957,endTime:90.957}};
 const ed={skipType:'ed',episodeLength:1440.167,interval:{startTime:1325,endTime:1440}};
 service.fetchTimes=async()=>[op,ed];assert.equal(await service.loadEnding(ctx),null,'duration alone is not an offset');
 const aligned=await service.loadEnding(ctx,{start:.957,end:90.957,source:'audio'});assert.equal(aligned.start,1325);assert.equal(aligned.end,1424);
 const shifted=await service.loadEnding(ctx,{start:0,end:90,source:'fingerprint'});assert.ok(Math.abs(shifted.start-1324.043)<.001);assert.equal(shifted.end,1424);
 service.fetchTimes=async()=>[op,{...ed,interval:{startTime:1250,endTime:1340}}];assert.equal((await service.loadEnding(ctx,{start:.957,end:90.957,source:'audio'})).end,1340,'post-credit tail must stay intact');
 service.fetchTimes=async()=>[op,{...ed,episodeLength:1480}];assert.equal(await service.loadEnding(ctx,{start:.957,end:90.957,source:'audio'}),null);
});


test('AniSkip proposals offer an immediate provisional skip and reject conflicting intervals',async()=>{
 const {IntroService}=load('src/app/core/intro.service.ts');const service=new IntroService({read:()=>({}),write:()=>true});
 const ctx={mal:21,number:100,duration:1424,key:'test'};
 service.fetchTimes=async()=>[{skipType:'op',episodeLength:1440.167,interval:{startTime:.957,endTime:90.957}},{skipType:'recap',episodeLength:1440.105,interval:{startTime:124,endTime:156}},{skipType:'ed',episodeLength:1440.167,interval:{startTime:1325,endTime:1440}}];
 const proposal=await service.proposals(ctx);assert.equal(proposal.ending.end,1440);assert.equal(proposal.recap.start,124);
 assert.equal(await service.loadEnding(ctx),null);
 const {player}=nextEpisodeFixture();player.skipProposals.set(proposal);player.state.update(s=>({...s,position:1325}));assert.equal(player.activeSkip.kind,'ending');assert.equal(player.activeSkip.provisional,true);
 service.fetchTimes=async()=>[{skipType:'op',episodeLength:1440,interval:{startTime:0,endTime:90}},{skipType:'op',episodeLength:1440,interval:{startTime:20,endTime:110}}];assert.equal((await service.proposals(ctx)).opening,null);
});


test('Previous episode is bounded by available episodes and saves current playback before opening',async()=>{
 const {player,saved}=nextEpisodeFixture();assert.equal(player.previousEpisode,null);
 player.episode=player.detail.episodes[1];player.state.update(s=>({...s,episode:2,position:300}));let opened=null;
 player.open=async(detail,episode)=>{assert.equal(saved.length,1);opened=episode;};
 await player.previous();assert.equal(opened.number,'1');assert.equal(saved[0][2],300);
 player.detail.episodes[0].public=0;assert.equal(player.previousEpisode,null);opened=null;await player.previous();assert.equal(opened,null);
 player.detail.episodes.shift();assert.equal(player.previousEpisode,null);
});

test('Skipping removes control focus and leaves video alone even when another skip segment starts immediately',async()=>{
 const {player,document}=nextEpisodeFixture();let blurred=0;
 player.engine='html5';player.video={currentTime:0};player.recap.set({start:0,end:60,source:'aniskip'});player.intro.set({start:60,end:150,source:'aniskip'});
 document.activeElement={closest:()=>true,blur(){blurred++;document.activeElement=null;}};
 await player.skipCurrentSegment();assert.equal(player.state().position,60);assert.equal(player.controls(),false);assert.equal(blurred,1);assert.equal(player.skipPrompt,null);assert.equal(player.showNextEpisode,false);
 player.showControls();assert.equal(player.controls(),true);assert.equal(player.skipPrompt.kind,'opening');clearTimeout(player.controlTimer);clearTimeout(player.skipQuietTimer);
});


function audioSwitchFixture(metadata=false){
 const document={activeElement:null,documentElement:{classList:{toggle(){}}},body:{classList:{toggle(){}}}};
 const {PlaybackService}=load('src/app/core/playback.service.ts',{document,AbortController,setInterval,clearInterval},metadata?{'./mp4-duration':{readVideoDuration:async()=>1500}}:{});const saved=[];
 const sub={anime:{id:10,mal_id:100,awSlug:'test-sub',dub:0,title:'Test'},episodes:[{id:'s1',number:'1',public:1},{id:'s2',number:'2',public:1}],related:[],count:2};
 const dub={...sub,anime:{...sub.anime,id:99,awSlug:'test-dub',dub:1},episodes:[{id:'d1',number:'1',public:1}]};
 const local={history:()=>({}),settings:()=>({resume:false,autonext:false}),isSeen:()=>false,watchCoverage:Object.assign(()=>({}),{set(){}}),watchKey:()=> 'mal:100:1',write(){},progress:(...args)=>saved.push(args)};
 const sourceCalls=[];const api={source:async(anime,episode)=>{sourceCalls.push({slug:anime.awSlug,number:episode.number});return 'https://example.com/'+anime.awSlug+'.mp4';},match:async()=>({matches:[sub,dub]})};
 const player=new PlaybackService(api,local,{},{prefetch(){}},{},{queue(){}},{},{});player.detail=sub;player.episode=sub.episodes[0];player.source='https://example.com/test-sub.mp4';player.audioOptions.set([sub,dub]);player.state.set({opened:true,playing:false,buffering:false,error:'',position:420,duration:1440,title:'Test',episode:1});
 const prepared=[];player.prepare=async(url,position,id,paused,exact)=>{prepared.push({url,position,paused,exact});player.state.update(s=>({...s,position,duration:1500,playing:!paused,buffering:false}));};
 return {player,sub,dub,saved,prepared,sourceCalls};
}

test('Audio source switch preserves exact seconds and pause even with resume disabled and a different catalog ID',async()=>{
 const {player,prepared,saved}=audioSwitchFixture();let changed;player.onAudioChanged=detail=>changed=detail;
 await player.switchAudio('dub');assert.equal(player.audioLanguage(),'dub');assert.equal(player.state().position,420);assert.equal(player.state().playing,false);
 assert.equal(prepared[0].position,420);assert.equal(prepared[0].exact,true);assert.equal(prepared[0].paused,true);assert.equal(changed.anime.id,10);assert.equal(changed.anime.awSlug,'test-dub');assert.equal(player.episode.id,'d1');assert.ok(saved.length>=2);
 player.close(false);
});

test('Missing audio episode or failed URL lookup does not replace the current video',async()=>{
 const {player,dub,prepared}=audioSwitchFixture();player.episode=player.detail.episodes[1];assert.equal(player.audioAvailable('dub'),false);await player.switchAudio('dub');assert.equal(prepared.length,0);assert.equal(player.detail.anime.awSlug,'test-sub');
 player.episode=player.detail.episodes[0];player.data.source=async()=>{throw Error('offline');};await player.switchAudio('dub');assert.equal(prepared.length,0);assert.equal(player.state().position,420);assert.equal(player.audioLanguage(),'sub');assert.equal(player.state().error,'');assert.match(player.audioNotice(),/attuale/);
});

test('Failed replacement restores previous source and timestamp without resetting to episode start',async()=>{
 const {player,prepared}=audioSwitchFixture();const prepare=player.prepare;player.prepare=async(url,...args)=>{if(url.includes('test-dub'))throw Error('new source too short');return prepare(url,...args);};
 await player.switchAudio('dub');assert.equal(player.audioLanguage(),'sub');assert.equal(player.state().position,420);assert.equal(player.state().playing,false);assert.equal(prepared[0].url,'https://example.com/test-sub.mp4');assert.match(player.audioNotice(),/ripristinata/);assert.equal(player.selectMenu(),'language');player.close(false);
});

test('Closing during language lookup does not reopen playback when the network finishes',async()=>{
 const {player,prepared}=audioSwitchFixture();let finish;player.data.source=()=>new Promise(resolve=>finish=resolve);const pending=player.switchAudio('dub');player.close(false);finish('https://example.com/new.mp4');await pending;assert.equal(prepared.length,0);assert.equal(player.state().opened,false);
});


test('Version alignment translates timestamps only for compatible opening boundaries',()=>{
 const {audioPosition}=load('src/app/core/audio-position.ts');const from={start:60,end:150,source:'audio'},to={start:90,end:180,source:'aniskip'};
 assert.equal(audioPosition(420,from,to).position,450);assert.equal(audioPosition(420,from,to).aligned,true);
 assert.equal(audioPosition(30,from,to).position,30);assert.equal(audioPosition(30,from,to).aligned,false);
 assert.equal(audioPosition(420,from,{...to,end:210}).position,420);assert.equal(audioPosition(420,from,null).aligned,false);
});

test('SUB to DUB uses the known opening offset and rollback restores the original rather than translated timestamp',async()=>{
 const {player,prepared}=audioSwitchFixture(true);player.intro.set({start:60,end:150,source:'audio'});
 player.introService={prefetch(){},context:()=>({mal:100,number:1,duration:1500,key:'dub'}),local:()=>null,load:async()=>({state:'ready',interval:{start:90,end:180,source:'aniskip'}})};player.detector={saved:()=>null};
 await player.switchAudio('dub');assert.equal(prepared[0].position,450);assert.equal(player.state().position,450);player.close(false);
 const retry=audioSwitchFixture(true),p=retry.player;p.intro.set({start:60,end:150,source:'audio'});p.introService=player.introService;p.detector=player.detector;
 const prepare=p.prepare;p.prepare=async(url,...args)=>{if(url.includes('test-dub'))throw Error('failed');return prepare(url,...args);};
 await p.switchAudio('dub');assert.equal(retry.prepared[0].position,420);assert.equal(p.state().position,420);p.close(false);
});

test('AVPlay source preparation seeks exact seconds and preserves paused playback',async()=>{
 const {player}=audioSwitchFixture();let sought=0,played=0;
 const av={close(){},open(){},setDisplayRect(){},setDisplayMethod(){},setListener(){},prepareAsync:ok=>ok(),getDuration:()=>1500000,seekTo:(ms,ok)=>{sought=ms;ok();},getTotalTrackInfo:()=>[],play:()=>played++};
 player.tv={getAvplay:()=>av,platform:'tizen'};delete player.prepare;player.loadIntro=async()=>{};
 await player.prepare('https://example.com/video.mp4',420,player.generation,true,true);assert.equal(sought,420000);assert.equal(played,0);assert.equal(player.state().position,420);assert.equal(player.state().playing,false);
 await assert.rejects(player.prepare('https://example.com/video.mp4',1501,player.generation,true,true),/termina prima/);
});

test('HTML5 source preparation waits for seeking and preserves exact timestamp while paused',async()=>{
 const {player}=audioSwitchFixture();
 class Video extends EventTarget{duration=1500;paused=true;value=0;playCalls=0;get currentTime(){return this.value;}set currentTime(value){this.value=value;queueMicrotask(()=>this.dispatchEvent(new Event('seeked')));}load(){queueMicrotask(()=>this.dispatchEvent(new Event('loadedmetadata')));}pause(){this.paused=true;}async play(){this.paused=false;this.playCalls++;}}
 const video=new Video();player.video=video;player.tv={getAvplay:()=>null,platform:'browser'};delete player.prepare;player.loadIntro=async()=>{};
 await player.prepare('https://example.com/video.mp4',420,player.generation,true,true);assert.equal(video.currentTime,420);assert.equal(video.playCalls,0);assert.equal(player.state().playing,false);
 await assert.rejects(player.prepare('https://example.com/video.mp4',1501,player.generation,false,true),/termina prima/);
});


test('The immediate AniSkip button updates after analysis while explicit manual disabling remains respected',()=>{
 const {player}=nextEpisodeFixture();player.skipProposals.set({opening:{start:0,end:90,source:'aniskip'},recap:null,ending:null});
 assert.equal(player.skipPrompt.provisional,true);assert.equal(player.skipPrompt.window.end,90);
 player.intro.set({start:10,end:100,source:'audio'});player.state.update(s=>({...s,position:10}));assert.equal(player.skipPrompt.provisional,false);assert.equal(player.skipPrompt.window.end,100);
 player.openingSkipDisabled=true;assert.equal(player.skipPrompt,null);
});

test('After skipping ED, next episode stays available without restoring the control overlay or focus',async()=>{
 const {player,document}=nextEpisodeFixture();player.engine='html5';player.video={currentTime:1250};player.state.update(s=>({...s,position:1250}));player.ending.set({start:1250,end:1340,source:'audio'});
 document.activeElement={closest:()=>true,blur(){document.activeElement=null;}};await player.skipCurrentSegment();
 assert.equal(player.state().position,1340);assert.equal(player.showNextEpisode,true);assert.equal(player.controls(),false);assert.equal(player.endingSkipped(),true);assert.equal(document.activeElement,null);
 player.detail.episodes[1].public=0;assert.equal(player.showNextEpisode,false);clearTimeout(player.skipQuietTimer);
});


test('Alignment rejects recap overlap and explains both the conflict and applied offset',()=>{
 const {alignSkip}=load('src/app/core/skip-alignment.ts');const ctx={mal:1,number:1,duration:1470,key:'test'};
 const op={skipType:'op',episodeLength:1440,interval:{startTime:60,endTime:150}},recap={skipType:'recap',episodeLength:1440,interval:{startTime:0,endTime:50}},ed={skipType:'ed',episodeLength:1440,interval:{startTime:1250,endTime:1340}};
 const opening={start:90,end:180,source:'audio'};
 const good=alignSkip(ctx,'recap',[op,recap,ed],opening);assert.equal(good.state,'aligned');assert.equal(good.offset,30);assert.equal(good.interval.start,30);assert.equal(good.reference.start,0);
 const bad=alignSkip(ctx,'recap',[op,{...recap,interval:{startTime:45,endTime:90}},ed],opening);assert.equal(bad.state,'conflict');assert.equal(bad.interval,null);assert.match(bad.reason,/sovrappone/);
});

test('An independently detected ending disambiguates two otherwise plausible AniSkip editions',()=>{
 const {alignSkip}=load('src/app/core/skip-alignment.ts');const ctx={mal:1,number:1,duration:1470,key:'test'};
 const rows=[{skipType:'op',episodeLength:1440,interval:{startTime:60,endTime:150}},{skipType:'ed',episodeLength:1440,interval:{startTime:1250,endTime:1340}},{skipType:'recap',episodeLength:1440,interval:{startTime:0,endTime:50}},
 {skipType:'op',episodeLength:1470,interval:{startTime:90,endTime:180}},{skipType:'ed',episodeLength:1470,interval:{startTime:1200,endTime:1290}},{skipType:'recap',episodeLength:1470,interval:{startTime:5,endTime:55}}];
 const result=alignSkip(ctx,'recap',rows,{start:90,end:180,source:'audio'},{start:1280,end:1370,source:'audio'});
 assert.equal(result.state,'aligned');assert.equal(result.reference.duration,1440);assert.equal(result.interval.start,30);
});

test('Undo skip restores the exact pre-skip position without crediting the skipped footage',async()=>{
 const {player}=nextEpisodeFixture();player.engine='html5';player.video={currentTime:20};player.state.update(s=>({...s,position:20}));player.recap.set({start:0,end:60,source:'aniskip'});
 await player.skipCurrentSegment();assert.equal(player.state().position,60);assert.equal(player.skipUndoAvailable(),true);
 await player.undoSkip();assert.equal(player.state().position,20);assert.equal(player.skipUndoAvailable(),false);assert.equal(player.controls(),false);assert.equal(player.tracker.watched(),0);clearTimeout(player.skipQuietTimer);
});

test('Undo terminal ending can return from the next episode and is cleared when the player closes',async()=>{
 const {player}=audioSwitchFixture();player.state.update(s=>({...s,position:1400,duration:1440}));player.ending.set({start:1350,end:1440,source:'aniskip'});
 await player.skipCurrentSegment();assert.equal(player.episode.number,'2');assert.equal(player.skipUndoAvailable(),true);
 await player.undoSkip();assert.equal(player.episode.number,'1');assert.equal(player.state().position,1400);assert.equal(player.state().playing,false);assert.equal(player.skipUndoAvailable(),false);
 player.close(false);assert.equal(player.skipUndoAvailable(),false);
});

test('Intro narrow search falls back to the original complete search rather than declaring a false negative',async()=>{
 const {IntroDetectorService}=load('src/app/core/intro-detector.service.ts');const detector=new IntroDetectorService({read:()=>({})},{},{}),passes=[];
 detector.detectPass=async(args,narrow)=>{passes.push(narrow);if(narrow)throw Error('outside narrow window');return {start:80,end:170};};
 const result=await detector.detect({anime:{},episode:{number:'1'},context:{},hint:{start:0,end:90},length:90});assert.equal(result.start,80);assert.equal(passes.join(','),'true,false');
 passes.length=0;detector.detectPass=async(args,narrow)=>{passes.push(narrow);return {start:0,end:90};};await detector.detect({anime:{},episode:{number:'1'},context:{},hint:{start:0,end:90},length:90});assert.equal(passes.join(','),'true');
});

test('A verified ending fingerprint needs only the current episode and a narrow audio window',async()=>{
 const math=load('src/app/core/audio-fingerprint.ts'),{packAudio}=load('src/app/core/audio-template.ts',{btoa,atob});let seed=7;
 const random=()=>{const v=Array.from({length:24},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296-.5;});const n=Math.hypot(...v);return v.map(x=>x/n);};
 const song=Array.from({length:360},random),packed=packAudio({frames:song,origin:0},0,90);assert.ok(packed);
 const data={endingFingerprints:{old:{...packed,version:3,series:'same',dub:0,episode:'1',remaining:50,updated:Date.now()}}},calls=[];
 const {EndingDetectorService}=load('src/app/core/ending-detector.service.ts',{btoa,atob,DOMException},{'./audio-fingerprint':{...math,readAudio:async(url,signal,progress,window)=>{calls.push({url,...window});return {frames:[...Array.from({length:120},random),...song,...Array.from({length:120},random)],origin:1300,step:.25,seconds:150,bytes:0,window};}}});
 const service=new EndingDetectorService({read:(key,f)=>data[key]??f,write:(key,v)=>{data[key]=v;return true;}},{page:async()=>({episodes:[{number:'1'},{number:'2'}]}),source:async(a,e)=>'https://example.com/'+e.number});
 const result=await service.detect({awSlug:'same',dub:0},{number:'2'},1470,new AbortController().signal);
 assert.equal(result.source,'fingerprint');assert.ok(Math.abs(result.start-1330)<1.5);assert.equal(calls.length,1);assert.equal(calls[0].end-calls[0].start,150);
});
