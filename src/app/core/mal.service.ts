import {Injectable,signal} from '@angular/core';
import {StorageService} from './storage.service';
import {TizenService} from './tizen.service';
import {Anime,Episode} from './models';
import {MalEntry,MAL_LIST_FIELDS,parseMalEntry} from './mal-library';
export type {MalEntry} from './mal-library';
interface Session {accessToken:string;refreshToken:string;expiresAt:number;clientId:string;redirectUri:string;user:{id:number;name:string}}
const API='https://api.myanimelist.net/v2';const TOKEN='https://myanimelist.net/v1/oauth2/token';
export const MAL_PUBLIC_CLIENT_ID='9d92b44c64ef2d9f06816d455931c150';
const DEFAULT_ID=MAL_PUBLIC_CLIENT_ID;
const REDIRECT='aniplayer://mal/callback';
export const MAL_MANUAL_REDIRECT='http://127.0.0.1:8765/callback';
function nonce(){const array=new Uint8Array(32);crypto.getRandomValues(array);return [...array].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function parseMalCallback(value:string){
 let text=String(value||'').trim();
 const markdown=text.match(/^\[[\s\S]*\]\((https?:\/\/[^\s]+|aniplayer:\/\/[^\s]+)\)$/);
 if(markdown)text=markdown[1];
 if(text.startsWith('<')&&text.endsWith('>'))text=text.slice(1,-1);
 text=text.replace(/[\r\n\t]/g,'');
 // Some mobile address bars omit the scheme when copying a loopback URL.
 if(/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?\//i.test(text))text='http://'+text;
 text=text.replace(/&amp;(?=(?:state|code|error)=)/g,'&').replace(/\\&(?=(?:state|code|error)=)/g,'&');
 try{return new URL(text);}catch{throw Error('Callback OAuth non valido: incolla l’indirizzo completo ricevuto dopo Allow.');}
}
@Injectable({providedIn:'root'})
export class MalService {
 readonly session=signal<Session|null>(this.local.read<Session|null>('malSession',null));
 readonly disconnected=signal(this.local.read<boolean>('malDisconnected',false)===true);
 readonly entries=signal<Record<string,MalEntry>>(this.local.read<any>('malData',null)?.entries||{});
 readonly status=signal('');readonly syncing=signal(false);
 readonly authorizationUrl=signal('');
 readonly connecting=signal(false);readonly connectionError=signal('');
 readonly autoUpdate=signal(this.local.read<boolean>('malAutoUpdate',true)!==false);
 private flushing:Promise<void>|null=null;
 private flushRequested=false;
 private completing:Promise<void>|null=null;
 private manualUpdate:Promise<number>|null=null;
 private lifecycle=0;private dataRevision=0;private outboxRevision=0;
 readonly clientId=signal(this.local.read<any>('malClient',{})?.clientId||DEFAULT_ID);
 readonly redirectUri=signal(this.local.read<any>('malClient',{})?.redirectUri||REDIRECT);
 private timer:any;
 constructor(private local:StorageService,private tv:TizenService){
  this.tv.onAppControl(uri=>{if(uri.startsWith('aniplayer://mal/callback'))void this.complete(uri).catch(e=>this.status.set(String(e.message||e)));});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&this.connected)void this.syncIfOld().catch(()=>{});});
 }
 get connected(){return !!this.session()?.accessToken&&!this.disconnected();}
 get rememberedUser(){return this.session()?.user?.name||'';}
 configure(id:string,redirect:string){if(!/^[a-f0-9]{32}$/i.test(id.trim()))throw Error('Client ID MAL non valido.');const parsed=new URL(redirect.trim());const loopback=parsed.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(parsed.hostname);if((!['aniplayer:','https:'].includes(parsed.protocol)&&!loopback)||parsed.username||parsed.password||parsed.search||parsed.hash)throw Error('Redirect MAL non valido: usa il redirect registrato su MAL (aniplayer, HTTPS oppure HTTP locale).');
  this.clientId.set(id.trim());this.redirectUri.set(redirect.trim());this.local.write('malClient',{clientId:id.trim(),redirectUri:redirect.trim()});}
 begin(resume=false,openBrowser=true){if(!crypto?.getRandomValues)throw Error('Generatore PKCE sicuro non disponibile.');
  const previous=this.local.read<any>('malOAuth',null);
  const pending=resume&&previous&&Date.now()-previous.created<15*60_000&&previous.clientId===this.clientId()&&previous.redirectUri===this.redirectUri()?previous:{verifier:nonce(),state:nonce(),created:Date.now(),redirectUri:this.redirectUri(),clientId:this.clientId()};
  if(!this.local.write('malOAuth',pending))throw Error('Impossibile salvare la richiesta MAL sulla TV.');
  const u=new URL('https://myanimelist.net/v1/oauth2/authorize');u.search=new URLSearchParams({response_type:'code',client_id:pending.clientId,redirect_uri:pending.redirectUri,state:pending.state,code_challenge:pending.verifier,code_challenge_method:'plain'}).toString();this.authorizationUrl.set(u.href);if(openBrowser)this.tv.openExternal(u.href);this.status.set('Completa l’autorizzazione MAL nel browser.');if(!openBrowser)this.status.set('Scansiona il QR dal telefono. Il ritorno alla TV richiede il callback completo.');return u.href;
 }
 private async request(url:string,init:RequestInit={}){const c=new AbortController(),timer=setTimeout(()=>c.abort(),18000);
  try{const r=await fetch(url,{...init,signal:c.signal,credentials:'omit',cache:'no-store',redirect:'error'});let result:any;try{result=await r.json();}catch{throw Error('Risposta MAL non riconosciuta');}if(!r.ok){const reason=result?.error;const hint=reason==='invalid_grant'?' Codice scaduto o già usato: avvia un nuovo collegamento.':reason==='invalid_client'?' Verifica Client ID e tipo di applicazione su MAL.':r.status===400?' Verifica che il Redirect URI coincida esattamente con quello registrato su MAL.':'';const e:any=new Error('MyAnimeList: HTTP '+r.status+'.'+hint);e.status=r.status;throw e;}return result;}finally{clearTimeout(timer);}
 }
 private token(payload:Record<string,string>){return this.request(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(payload).toString()});}
 complete(callback:string):Promise<void>{
  if(this.completing)return this.completing;
  this.connecting.set(true);this.connectionError.set('');this.status.set('Verifica del collegamento…');
  this.completing=this.finishConnection(callback).catch(error=>{const message=error instanceof Error?error.message:String(error);this.connectionError.set(message);this.status.set(message);throw error;}).finally(()=>{this.connecting.set(false);this.completing=null;});
  return this.completing;
 }
 private async finishConnection(callback:string){const lifecycle=this.lifecycle;const pending=this.local.read<any>('malOAuth',null);
  if(!pending)throw Error('Richiesta OAuth mancante sulla TV. Genera un QR e usa il callback ottenuto da quel QR.');
  if(Date.now()-pending.created>15*60_000)throw Error('Richiesta OAuth scaduta. Genera un nuovo QR e autorizza di nuovo.');
  const url=parseMalCallback(callback),expected=new URL(pending.redirectUri);
  if(url.protocol!==expected.protocol||url.host!==expected.host||url.pathname!==expected.pathname)throw Error('Callback OAuth non valido: indirizzo di ritorno diverso dalla richiesta avviata sulla TV. Atteso: '+expected.protocol+'//'+expected.host+expected.pathname+'. Usa il callback del QR corrente.');
  if(url.username||url.password||url.hash||url.searchParams.getAll('state').length>1||url.searchParams.getAll('code').length>1)throw Error('Callback OAuth non valido: indirizzo alterato o parametri duplicati. Ricopia l’URL completo dalla barra del browser.');
  if(!url.searchParams.get('state'))throw Error('Callback OAuth non valido: manca state. Incolla tutto l’URL, inclusa la parte &state=… alla fine.');
  if(url.searchParams.get('state')!==pending.state)throw Error('Callback OAuth non valido: appartiene a un’altra richiesta. Il QR è stato rigenerato oppure il link proviene da una vecchia scheda. Autorizza il QR corrente senza generarne altri.');
  if(url.searchParams.has('error'))throw Error('Accesso MAL rifiutato.');const code=url.searchParams.get('code');if(!code)throw Error('Codice OAuth mancante.');
  this.status.set('Scambio del codice con MyAnimeList…');
  const result=await this.token({grant_type:'authorization_code',client_id:pending.clientId,code,code_verifier:pending.verifier,redirect_uri:pending.redirectUri});
  this.status.set('Verifica dell’account MyAnimeList…');
  const tokens=this.parseTokens(result);const user=await this.request(API+'/users/@me',{headers:{Authorization:'Bearer '+tokens.accessToken}});
  if(!Number(user.id)||!user.name)throw Error('Utente MAL non riconosciuto.');
  if(lifecycle!==this.lifecycle)throw Error('Collegamento annullato.');
  const previous=this.session();if(previous?.user.id!==user.id){this.entries.set({});this.local.write('malData',null);this.local.write('malOutbox',null);}
  const session:Session={...tokens,clientId:pending.clientId,redirectUri:pending.redirectUri,user:{id:user.id,name:user.name}};
  this.session.set(session);this.disconnected.set(false);this.local.write('malDisconnected',false);this.local.write('malSession',session);this.local.write('malOAuth',null);this.authorizationUrl.set('');this.status.set('Connesso: '+user.name);
  try{await this.sync();}catch{this.status.set('Account collegato. Importazione della lista non riuscita: premi Aggiorna lista per riprovare.');}
 }
 private parseTokens(data:any){if(!data?.access_token||!data?.refresh_token||!(Number(data.expires_in)>0))throw Error('Token MAL non riconosciuti.');return {accessToken:String(data.access_token),refreshToken:String(data.refresh_token),expiresAt:Date.now()+Number(data.expires_in)*1000};}
 private async refresh(){const session=this.session();if(!session)throw Error('Account MAL non collegato.');const res=await this.token({grant_type:'refresh_token',client_id:session.clientId,refresh_token:session.refreshToken});if(this.session()!==session)throw Error('Account modificato durante il rinnovo.');const updated={...session,...this.parseTokens({...res,refresh_token:res.refresh_token||session.refreshToken})};this.session.set(updated);this.local.write('malSession',updated);}
 private async auth(path:string,init:RequestInit={}){const lifecycle=this.lifecycle;let session=this.session();if(!this.connected||!session)throw Error('Account MAL disconnesso.');if(Date.now()>session.expiresAt-60000)await this.refresh();session=this.session()!;
  for(let i=0;i<2;i++)try{if(!this.connected||lifecycle!==this.lifecycle)throw Error('Collegamento MAL interrotto.');const result=await this.request(API+path,{...init,headers:{...init.headers,Authorization:'Bearer '+this.session()!.accessToken}});if(!this.connected||lifecycle!==this.lifecycle)throw Error('Collegamento MAL interrotto.');return result;}catch(e:any){if(e.status!==401||i===1)throw e;await this.refresh();}
 }
 async syncIfOld(){if(!this.connected||this.local.read<boolean>('malDataCleared',false))return;const last=this.local.read<any>('malData',null)?.syncedAt||0;if(Date.now()-last>5*60_000)await this.sync();}
 async sync(){if(!this.connected||this.syncing())return;const lifecycle=this.lifecycle,revision=this.dataRevision;this.syncing.set(true);try{const entries:Record<string,MalEntry>={};let offset=0;let complete=false;
  for(let page=0;page<100;page++){const data=await this.auth('/users/@me/animelist?'+new URLSearchParams({fields:MAL_LIST_FIELDS,limit:'1000',offset:String(offset),nsfw:'true'}));
   if(lifecycle!==this.lifecycle||revision!==this.dataRevision)return;
   if(!Array.isArray(data?.data))throw Error('Lista MAL non valida.');for(const item of data.data){const id=Number(item.node?.id),s=item.list_status;if(id&&s)entries[id]=parseMalEntry(item);}
   if(!data.paging?.next){complete=true;break;}const next=new URL(data.paging.next);const o=Number(next.searchParams.get('offset'));if(next.origin!=='https://api.myanimelist.net'||!Number.isInteger(o)||o<=offset)throw Error('Paginazione MAL non valida.');offset=o;
  }
  if(!complete)throw Error('Importazione MAL incompleta.');this.entries.set(entries);this.local.write('malData',{accountId:this.session()!.user.id,entries,syncedAt:Date.now()});this.local.write('malDataCleared',false);this.status.set('Lista MAL sincronizzata.');await this.flush();
  }catch(e:any){if(lifecycle===this.lifecycle&&revision===this.dataRevision)this.status.set('Sincronizzazione fallita: '+String(e.message||e));throw e;}finally{this.syncing.set(false);}}
 isSeen(anime:Anime,episode:Episode){const entry=this.entries()[String(anime.mal_id||'')];return !!entry&&Number(episode.malNumber??episode.number)>0&&Number(episode.malNumber??episode.number)<=entry.watched;}
 setAutoUpdate(value:boolean){this.autoUpdate.set(value);this.local.write('malAutoUpdate',value);if(value)void this.flush();}
 private readOutbox():Record<string,number[]>{
  const raw=this.local.read<any>('malOutbox',null),out:Record<string,number[]>={};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return out;
  const add=(id:unknown,values:unknown)=>{if(!Number.isSafeInteger(Number(id))||Number(id)<=0||!Array.isArray(values))return;const key=String(id);out[key]=[...new Set([...(out[key]||[]),...values.map(Number).filter(n=>Number.isInteger(n)&&n>0)])].sort((a,b)=>a-b);};
  if('events' in raw){if(Number(raw.accountId)!==Number(this.session()?.user.id))return out;for(const event of Object.values(raw.events||{}) as any[])if(event)add(event.malId,[event.number]);}
  else for(const [id,values] of Object.entries(raw))add(id,values);
  return out;
 }
 queue(anime:Anime,episode:Episode){if(!this.connected||!this.autoUpdate()||!Number(anime.mal_id)||!Number.isInteger(Number(episode.malNumber??episode.number))||Number(episode.malNumber??episode.number)<=0)return;
  const out=this.readOutbox(),key=String(anime.mal_id);out[key]=[...new Set([...(out[key]||[]),Number(episode.malNumber??episode.number)])].sort((a,b)=>a-b);this.local.write('malOutbox',out);void this.flush();}
 flush():Promise<void>{if(!this.connected||!this.autoUpdate()||this.manualUpdate)return Promise.resolve();if(this.flushing){this.flushRequested=true;return this.flushing;}this.flushing=(async()=>{do{this.flushRequested=false;await this.flushOutbox();}while(this.flushRequested&&this.connected&&this.autoUpdate()&&!this.manualUpdate);})().finally(()=>{this.flushing=null;});return this.flushing;}
 private cacheProgress(id:number,watched:number,total:number,status:string,score:number,explicit=false){
  if(!explicit&&this.local.read<boolean>('malDataCleared',false))return;
  const old=this.entries()[String(id)],entries={...this.entries(),[String(id)]:{...old,watched,total,status,score,updatedAt:new Date().toISOString()}};
  this.entries.set(entries);const saved=this.local.read<any>('malData',null);this.local.write('malData',{accountId:this.session()?.user.id,entries,syncedAt:saved?.syncedAt||0});
 }
 setEpisodeSeen(anime:Anime,episode:Episode,value:boolean):Promise<number>{
  const id=Number(anime.mal_id),number=Number(episode.malNumber??episode.number);
  if(!this.connected)return Promise.reject(Error('Collega l’account MAL per aggiornare la lista.'));
  if(!Number.isSafeInteger(id)||id<=0||!Number.isInteger(number)||number<=0)return Promise.reject(Error('Questo episodio non ha un numero intero o un ID MAL utilizzabile.'));
  if(this.manualUpdate)return Promise.reject(Error('Attendi il completamento dell’aggiornamento precedente.'));
  const lifecycle=this.lifecycle;this.outboxRevision++;this.dataRevision++;
  this.manualUpdate=(async()=>{
   if(this.flushing)await this.flushing;
   if(lifecycle!==this.lifecycle||!this.connected)throw Error('Account MAL disconnesso durante l’aggiornamento.');
   const data=await this.auth('/anime/'+id+'?fields=num_episodes,my_list_status'),remote=Number(data.my_list_status?.num_episodes_watched)||0,total=Number(data.num_episodes)||0;
   const target=value?Math.max(remote,number):Math.min(remote,number-1);
   if(total>0&&target>total)throw Error('Il numero episodio supera il totale registrato su MAL.');
   const status=target===remote&&data.my_list_status?data.my_list_status.status:total>0&&target>=total?'completed':target>0?'watching':'plan_to_watch';
   if(lifecycle!==this.lifecycle||!this.connected)throw Error('Account MAL disconnesso durante l’aggiornamento.');
   if(target!==remote||value&&!data.my_list_status){await this.auth('/anime/'+id+'/my_list_status',{method:'PUT',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({num_watched_episodes:String(target),status}).toString()});}
   if(lifecycle!==this.lifecycle||!this.connected)throw Error('Account MAL disconnesso durante l’aggiornamento.');
   const out=this.readOutbox();delete out[String(id)];this.local.write('malOutbox',out);
   this.cacheProgress(id,target,total,status,Number(data.my_list_status?.score)||0,true);this.status.set('MAL aggiornato: '+target+' episodi visti.');return target;
  })().finally(()=>{this.manualUpdate=null;void this.flush();});return this.manualUpdate;
 }
 private async flushOutbox(){const accountId=this.session()?.user.id,lifecycle=this.lifecycle,revision=this.outboxRevision;const out=this.readOutbox();for(const [key,nums] of Object.entries(out)){
  const id=Number(key);if(!id||!nums.length)continue;
  try{const data=await this.auth('/anime/'+id+'?fields=num_episodes,my_list_status');const remote=Number(data.my_list_status?.num_episodes_watched)||0;let next=remote;
   const ownEvents=this.local.watchEvents()||{};const confirmed=new Set(nums);
   for(const row of Object.values(ownEvents))if(row.malId===id)confirmed.add(Number(row.number));
   while(confirmed.has(next+1))next++;
   if(!this.connected||lifecycle!==this.lifecycle||revision!==this.outboxRevision||this.session()?.user.id!==accountId||!this.autoUpdate())return;
   if(next>remote){const payload=new URLSearchParams({num_watched_episodes:String(next)});if(Number(data.num_episodes)>0&&next>=Number(data.num_episodes))payload.set('status','completed');else if(data.my_list_status?.status!=='completed')payload.set('status','watching');
    await this.auth('/anime/'+id+'/my_list_status',{method:'PUT',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:payload.toString()});}
   if(!this.connected||lifecycle!==this.lifecycle||revision!==this.outboxRevision||this.session()?.user.id!==accountId)return;
   this.cacheProgress(id,next,Number(data.num_episodes)||0,next>=Number(data.num_episodes)&&Number(data.num_episodes)>0?'completed':data.my_list_status?.status==='completed'?'completed':next>0?'watching':'plan_to_watch',Number(data.my_list_status?.score)||0);
   const latest=this.readOutbox();latest[key]=(latest[key]||[]).filter(number=>number>next);if(!latest[key].length)delete latest[key];this.local.write('malOutbox',latest);
  }catch(e:any){if(this.connected)this.status.set('Aggiornamento MAL in attesa: '+String(e.message||e));}
  }
 }
 disconnect(){this.lifecycle++;this.disconnected.set(true);this.local.write('malDisconnected',true);this.authorizationUrl.set('');this.local.write('malOAuth',null);this.connectionError.set('');this.status.set('Disconnesso. Account ricordato su questa TV: premi Riconnetti per riattivarlo.');}
 async reconnect(){
  if(this.connected||this.connecting())return;
  if(!this.session()?.refreshToken)throw Error('Nessun collegamento salvato: autorizza nuovamente l’account.');
  const lifecycle=this.lifecycle;this.connecting.set(true);this.connectionError.set('');this.status.set('Riconnessione a '+this.rememberedUser+'…');
  try{
   if(Date.now()>this.session()!.expiresAt-60000)await this.refresh();
   let session=this.session()!,user:any;
   try{user=await this.request(API+'/users/@me',{headers:{Authorization:'Bearer '+session.accessToken}});}catch(error:any){if(error.status!==401||lifecycle!==this.lifecycle)throw error;await this.refresh();session=this.session()!;user=await this.request(API+'/users/@me',{headers:{Authorization:'Bearer '+session.accessToken}});}
   if(lifecycle!==this.lifecycle)return;
   if(Number(user.id)!==Number(session.user.id))throw Error('Il collegamento salvato non corrisponde all’account. Autorizza nuovamente.');
   this.disconnected.set(false);this.local.write('malDisconnected',false);this.status.set('Riconnesso come '+this.rememberedUser+'.');
   try{await this.sync();}catch{if(this.connected)this.status.set('Account riconnesso. Premi Aggiorna lista per riprovare l’importazione.');}
  }catch(error:any){if(lifecycle===this.lifecycle){const message=error.status===400||error.status===401?'L’accesso salvato è scaduto o revocato da MAL. Premi Autorizza di nuovo.':'Riconnessione non riuscita. L’account resta ricordato: riprova quando MAL è raggiungibile.';this.connectionError.set(message);this.status.set(message);}throw error;}
  finally{this.connecting.set(false);}
 }
 clearDownloaded(){this.dataRevision++;this.entries.set({});this.local.write('malData',null);this.local.write('malDataCleared',true);this.status.set('Dati scaricati eliminati dalla TV. Account e progressi locali conservati.');}
 clearPendingUpdates(){this.outboxRevision++;this.local.write('malOutbox',{});this.status.set('Aggiornamenti in attesa eliminati dalla TV.');}
 forgetAccount(){this.disconnect();this.session.set(null);this.clearDownloaded();this.clearPendingUpdates();this.local.write('malSession',null);this.connectionError.set('');this.status.set('Account e autorizzazione dimenticati su questa TV. Per collegarlo servirà autorizzarlo di nuovo.');}
}


