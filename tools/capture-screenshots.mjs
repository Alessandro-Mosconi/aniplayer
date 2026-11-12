// Run npm start first. Uses an isolated Chrome profile and demonstration library data.
// ANIPLAYER_SCREENSHOT_URL and CHROME_PATH override the development URL and browser.
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const baseUrl=process.env.ANIPLAYER_SCREENSHOT_URL||'http://127.0.0.1:4200';
const root=process.cwd();mkdirSync(join(root,'docs/screenshots'),{recursive:true});
const profile=join(process.env.TEMP,'aniplayer-readme-'+Date.now());
const chrome=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--disable-gpu','--allow-file-access-from-files','--remote-debugging-port=0','--user-data-dir='+profile,'--window-size=1920,1080','about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
 const active=join(profile,'DevToolsActivePort');for(let i=0;i<80&&!existsSync(active);i++)await wait(100);
 const port=readFileSync(active,'utf8').split('\n')[0];const targets=await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',j,{once:true});});
 let next=0;const pending=new Map(),errors=[];ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id&&pending.has(m.id)){const {resolve,reject,timer}=pending.get(m.id);clearTimeout(timer);pending.delete(m.id);m.error?reject(Error(m.error.message)):resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},15000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 await call('Page.enable');await call('Runtime.enable');await call('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});

 await call('Page.addScriptToEvaluateOnNewDocument',{source:"window.webOSSystem={};"});
 await call('Page.navigate',{url:baseUrl});
 const evalJs=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};

 const until=async(expression,seconds=60)=>{for(let i=0;i<seconds*2;i++){if(await evalJs(expression))return;await wait(500);}throw Error('Timeout '+expression);};
 const shot=async(name)=>{await evalJs(`document.fonts.ready`);await wait(1800);const result=await call('Page.captureScreenshot',{format:'png'});writeFileSync(join(root,'docs/screenshots/'+name+'-tv.png'),Buffer.from(result.data,'base64'));console.log('Captured '+name);};
 await until(`!!document.querySelector('.hero-art')&&document.querySelectorAll('app-anime-card').length>0`);
 await shot('home');
 await evalJs(`window.__vm=ng.getComponent(document.querySelector('app-home-page')).vm;window.__anime=__vm.featured()[0]||__vm.recent()[0];window.__demo=[...new Map([...__vm.featured(),...__vm.recent(),...__vm.cards()].filter(a=>a.mal_id).map(a=>[a.mal_id,a])).values()].slice(0,12);`);
 await evalJs(`__vm.go('catalog')`);await until(`!!document.querySelector('app-catalog-page')&&!__vm.loading()&&document.querySelectorAll('app-anime-card').length>0`);await shot('catalog');
 await evalJs(`document.querySelector('[data-focus="filter-audio"]').click()`);await shot('catalog-filters');
 await evalJs(`__vm.storage.setSetting('exploreEnabled',true);__vm.go('explore')`);await until(`!!document.querySelector('[data-explore-card]')`,90);await shot('explore');
 await evalJs(`__vm.openAnime(__anime)`);await until(`!!__vm.details()&&!__vm.loading()`,90);await shot('anime-detail');
 await evalJs(`__vm.storage.favorites.set(Object.fromEntries(__demo.slice(0,8).map(a=>[a.id,a])));__vm.storage.history.set(Object.fromEntries(__demo.slice(0,6).map((a,i)=>[a.id,{anime:a,episode:{id:'demo-'+i,number:String(i+1),public:1},position:360+i*120,duration:1440,completed:false,updated:Date.now()-i*3600000}])));__vm.go('favorites')`);await until(`!!document.querySelector('app-favorites-page')`);await shot('favorites');
 await evalJs(`__vm.go('history')`);await until(`!!document.querySelector('app-history-page')`);await shot('history');
 await evalJs(`__vm.go('settings')`);await until(`!!document.querySelector('app-settings-page')`);await shot('settings');
 await evalJs(`ng.getComponent(document.querySelector('app-settings-page')).selectCategory('data')`);await until(`!!document.querySelector('[data-focus="settings-services"]')`);await evalJs(`document.querySelector('[data-focus="settings-services"]').click()`);await until(`!!document.querySelector('app-diagnostics-page')`);await shot('diagnostics');
 if(process.env.ANIPLAYER_CHECK_SERVICES==='1')for(const key of ['unity','world','aniskip','anilist','mal']){const result=await evalJs(`(async()=>{const page=ng.getComponent(document.querySelector('app-diagnostics-page'));await page.test('${key}');return page.results()['${key}'];})()`);console.log('Service '+key+': '+JSON.stringify(result));}
 await evalJs(`__vm.back()`);await until(`!!document.querySelector('app-settings-page')&&!!document.querySelector('#settings-tab-data[aria-selected="true"]')`);
 await evalJs(`(()=>{const m=ng.getComponent(document.querySelector('app-settings-page')).publicMal;m.username.set('Profilo dimostrativo');m.syncedAt.set(Date.now());m.entries.set(Object.fromEntries(__demo.map((a,i)=>[a.mal_id,{watched:i%3===0?12:Math.min(11,3+i),total:12,status:i%3===0?'completed':'watching',score:7+i%3,updated:Date.now()-i*86400000,anime:{title:a.title_eng||a.title,image:a.imageurl,type:'tv',genres:(a.genres||[]).map(g=>typeof g==='string'?g:g.name),duration:1440,year:Number(a.date)||2026,aliases:[]}}])));__vm.go('my-anime');})()`);await until(`!!document.querySelector('app-my-anime-page')`);await shot('dashboard');
 await evalJs(`ng.getComponent(document.querySelector('app-my-anime-page')).library.view.set('list')`);await shot('my-list');
 await evalJs(`__vm.go('settings')`);await until(`!!document.querySelector('app-settings-page')`);await evalJs(`ng.getComponent(document.querySelector('app-settings-page')).selectCategory('mal')`);await until(`!!document.querySelector('[data-focus="settings-mal-account"]')`);await shot('settings-mal');await evalJs(`document.querySelector('[data-focus="settings-mal-account"]').click()`);await until(`!!document.querySelector('app-mal-page')`);await shot('mal');
 if(process.env.ANIPLAYER_CHECK_SCORE==='1'){
  await evalJs(`__vm.filters.set({minScore:9});__vm.searchText.set('');__vm.page.set(0);__vm.go('catalog')`);
  await until(`!!document.querySelector('app-catalog-page')&&!__vm.loading()`,120);
  const sample=()=>evalJs(`({count:__vm.total(),visible:__vm.cards().length,exact:__vm.catalogTotalExact(),scanning:__vm.catalogScanning(),error:__vm.error(),scanError:__vm.catalogScanMessage()})`);
  console.log('Score 9+ initial: '+JSON.stringify(await sample()));await wait(5000);console.log('Score 9+ later: '+JSON.stringify(await sample()));
  await evalJs(`__vm.filters.update(f=>({...f,order:'Valutazione'}));__vm.nav.replace('catalog')`);await until(`!!document.querySelector('app-catalog-page')&&!__vm.loading()`,120);console.log('Score 9+ by rating: '+JSON.stringify(await sample()));
 }
 if(errors.length)throw Error(JSON.stringify(errors));console.log('Screenshot TV salvati in docs/screenshots/. Nessun account personale utilizzato.');
}finally{ws?.close();chrome.kill();}
