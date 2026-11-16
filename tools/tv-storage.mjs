// CDP backup/restore di sole chiavi autv.*, inclusi token MAL: backup PRIVATO.
import {execFileSync} from 'node:child_process';
import {copyFileSync,existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));const path=join(root,'local-private','tv-userdata.json');
const [operation,device]=process.argv.slice(2);
const sdb=process.env.SDB_PATH||(process.platform==='win32'?join(process.env.USERPROFILE||'', '.tizen-extension-platform','server','sdktools','data','tools','sdb.exe'):'sdb');
const appId='tOIM55JMUl.AnimePlayer',packageId='tOIM55JMUl';
function call(...args){return execFileSync(sdb,['-s',device,...args],{encoding:'utf8',timeout:16000});}
async function connect(){const result=call('shell','0','debug',appId);const match=/port:\s*(\d+)/i.exec(result);if(!match)throw Error('Porta debugger assente: '+result);
 try{execFileSync(sdb,['-s',device,'forward','--remove','tcp:9223'],{stdio:'ignore',timeout:16000});}catch{}
 call('forward','tcp:9223',`tcp:${match[1]}`);
 const info=await fetch('http://127.0.0.1:9223/json/list').then(r=>r.json());const target=info.find(x=>x.webSocketDebuggerUrl&&/AnimePlayer|index\.html|file:\/\//i.test(x.title+' '+x.url))||info.find(x=>x.webSocketDebuggerUrl);
 if(!target)throw Error('Pagina debugger Tizen non trovata');
 const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});setTimeout(()=>reject(Error('Timeout WS debugger')),8000);});return ws;
}
let nextRequestId=0;
export function evaluate(ws,expression){return new Promise((resolve,reject)=>{const id=++nextRequestId;const timeout=setTimeout(()=>{ws.removeEventListener('message',handler);reject(Error('Timeout Runtime.evaluate'));},10000);
 const handler=event=>{let msg;try{msg=JSON.parse(event.data);}catch{return;}if(msg.id===id){clearTimeout(timeout);ws.removeEventListener('message',handler);if(msg.error||msg.result?.exceptionDetails){const detail=msg.error?.message||msg.result?.exceptionDetails?.exception?.description||msg.result?.exceptionDetails?.text||'errore sconosciuto';reject(Error('Errore CDP: '+String(detail).split('\n')[0]));}else resolve(msg.result?.result?.value);}};
 ws.addEventListener('message',handler);ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));});}
export async function readBackup(ws,{attempts=20,delay=750}={}){
 let lastError;
 for(let i=0;i<attempts;i++)try{
  const json=await evaluate(ws,'JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith("autv.")).map(k=>[k,localStorage.getItem(k)])))');
  const data=JSON.parse(json);if(!data||typeof data!=='object'||Array.isArray(data)||!Object.keys(data).length||Object.entries(data).some(([key,value])=>!key.startsWith('autv.')||typeof value!=='string'))throw Error('Dati AniPlayer non ancora disponibili o backup vuoto.');return data;
 }catch(error){lastError=error;if(i+1<attempts)await new Promise(resolve=>setTimeout(resolve,delay));}
 throw Error('Lettura dati TV non riuscita: '+(lastError instanceof Error?lastError.message:String(lastError)));
}
export async function waitForStorage(ws,{attempts=20,delay=750}={}){
 let lastError;
 for(let i=0;i<attempts;i++){try{if(await evaluate(ws,'(()=>{try{return typeof localStorage.length === "number"}catch(e){return false}})()')===true)return;}catch(error){lastError=error;}if(i+1<attempts)await new Promise(resolve=>setTimeout(resolve,delay));}
 throw Error('Archivio TV non disponibile: '+(lastError instanceof Error?lastError.message:'pagina non pronta'));
}
async function main(){if(!['backup','restore'].includes(operation)||!device){console.error('Uso: node tools/tv-storage.mjs backup|restore IP:26101');process.exitCode=2;return;}
let ws;try{ws=await connect();if(operation==='backup'){
 const data=await readBackup(ws);mkdirSync(dirname(path),{recursive:true});
 const temporary=path+'.tmp-'+process.pid;writeFileSync(temporary,JSON.stringify({time:new Date().toISOString(),data},null,2),{mode:0o600});
 if(existsSync(path)){const stamp=new Date().toISOString().replace(/[:.]/g,'-');copyFileSync(path,join(dirname(path),'tv-userdata-precedente-'+stamp+'.json'));}
 renameSync(temporary,path);console.log('Backup TV: '+Object.keys(data).length+' chiavi');
}else{
 const data=JSON.parse(readFileSync(path,'utf8')).data;if(!data||typeof data!=='object'||Array.isArray(data)||!Object.keys(data).length||Object.entries(data).some(([key,value])=>!key.startsWith('autv.')||typeof value!=='string'))throw Error('Backup locale non valido: ripristino annullato.');
 await waitForStorage(ws);const expression=`(()=>{const data=${JSON.stringify(data)};for(const [k,v] of Object.entries(data))localStorage.setItem(k,v);if(!Object.entries(data).every(([k,v])=>localStorage.getItem(k)===v))throw Error('Verifica ripristino non riuscita');return Object.keys(data).length})()`;
 const n=await evaluate(ws,expression);console.log('Ripristino TV: '+n+' chiavi');
}}catch(e){console.error('Backup/restore non riuscito:',e.message);process.exitCode=1}finally{ws?.close();}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
