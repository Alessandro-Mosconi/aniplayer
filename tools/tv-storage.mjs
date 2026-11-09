// CDP backup/restore di sole chiavi autv.*, inclusi token MAL: backup PRIVATO.
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));const path=join(root,'local-private','tv-userdata.json');
const [operation,device]=process.argv.slice(2);
const sdb=process.env.SDB_PATH||(process.platform==='win32'?join(process.env.USERPROFILE||'', '.tizen-extension-platform','server','sdktools','data','tools','sdb.exe'):'sdb');
const appId='tOIM55JMUl.AnimePlayer',packageId='tOIM55JMUl';
function call(...args){return execFileSync(sdb,['-s',device,...args],{encoding:'utf8',timeout:16000});}
async function connect(){const result=call('shell','0','debug',appId);const match=/port:\s*(\d+)/i.exec(result);if(!match)throw Error('Porta debugger assente: '+result);
 try{call('forward','--remove','tcp:9223');}catch{}
 call('forward','tcp:9223',`tcp:${match[1]}`);
 const info=await fetch('http://127.0.0.1:9223/json/list').then(r=>r.json());const target=info.find(x=>x.webSocketDebuggerUrl&&/AnimePlayer|index\.html|file:\/\//i.test(x.title+' '+x.url))||info.find(x=>x.webSocketDebuggerUrl);
 if(!target)throw Error('Pagina debugger Tizen non trovata');
 const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});setTimeout(()=>reject(Error('Timeout WS debugger')),8000);});return ws;
}
function evaluate(ws,expression){return new Promise((resolve,reject)=>{const id=Date.now()%1000000;const timeout=setTimeout(()=>reject(Error('Timeout Runtime.evaluate')),10000);
 const handler=event=>{let msg;try{msg=JSON.parse(event.data);}catch{return;}if(msg.id===id){clearTimeout(timeout);ws.removeEventListener('message',handler);if(msg.error||msg.result?.exceptionDetails)reject(Error('Errore CDP'));else resolve(msg.result?.result?.value);}};
 ws.addEventListener('message',handler);ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));});}
if(!['backup','restore'].includes(operation)||!device){console.error('Uso: node tools/tv-storage.mjs backup|restore IP:26101');process.exit(2)}
let ws;try{ws=await connect();if(operation==='backup'){
 const json=await evaluate(ws,'JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith("autv.")).map(k=>[k,localStorage.getItem(k)])))');
 const data=JSON.parse(json);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify({time:new Date().toISOString(),data},null,2),{mode:0o600});console.log('Backup TV: '+Object.keys(data).length+' chiavi');
}else{
 const data=JSON.parse(readFileSync(path,'utf8')).data;const expression=`(()=>{const data=${JSON.stringify(data)};for(const [k,v] of Object.entries(data)){if(k.startsWith('autv.'))localStorage.setItem(k,v)}return Object.keys(data).length})()`;
 const n=await evaluate(ws,expression);console.log('Ripristino TV: '+n+' chiavi');
}}catch(e){console.error('Backup/restore non riuscito:',e.message);process.exitCode=1}finally{ws?.close();}
