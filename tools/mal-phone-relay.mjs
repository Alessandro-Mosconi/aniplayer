// Optional LAN clipboard relay. Tokens are exchanged and stored by the TV, not this process.
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {networkInterfaces} from 'node:os';
import {pathToFileURL} from 'node:url';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createRelay(){
 const sessions=new Map();
 const key=()=>randomBytes(24).toString('hex');
 return http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  for(const [id,s] of sessions)if(Date.now()-s.at>15*60_000)sessions.delete(id);
  const path=new URL(req.url,'http://localhost').pathname;
  async function body(){let text='';for await(const chunk of req){text+=chunk;if(text.length>20000)throw Error('Testo troppo lungo.');}return new URLSearchParams(text);}
  try{
   if(req.method==='POST'&&path==='/pair'){
    if(sessions.size>=12){send(429,{error:'Troppe richieste: attendi la scadenza delle precedenti.'});return;}
    const data=await body(),auth=new URL(data.get('authorizationUrl'));
    if(auth.origin!=='https://myanimelist.net'||auth.pathname!=='/v1/oauth2/authorize'||auth.searchParams.has('client_secret')||auth.searchParams.has('code_verifier')||!auth.searchParams.get('state')||!auth.searchParams.get('code_challenge'))throw Error('Richiesta di autorizzazione non valida.');
    const phone=key(),tv=key();sessions.set(tv,{phone,auth:auth.href,state:auth.searchParams.get('state'),redirect:auth.searchParams.get('redirect_uri'),at:Date.now(),callback:null});
    send(200,{phonePath:'/p/'+phone,pollPath:'/result/'+tv});return;
   }
   const poll=path.match(/^\/result\/([a-f0-9]{48})$/);
   if(req.method==='GET'&&poll){const session=sessions.get(poll[1]);if(!session){send(410,{error:'Richiesta scaduta.'});return;}send(200,{callback:session.callback});if(session.callback)sessions.delete(poll[1]);return;}
   const page=path.match(/^\/p\/([a-f0-9]{48})(\/callback)?$/);
   const session=page?[...sessions.values()].find(s=>s.phone===page[1]):null;
   if(page&&session&&req.method==='POST'&&page[2]){
    const data=await body();let text=(data.get('callback')||'').trim().replace(/[\r\n\t]/g,'').replace(/&amp;(?=state=)/g,'&');
    if(/^(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(text))text='http://'+text;
    const callback=new URL(text),expected=new URL(session.redirect);
    if(expected.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(expected.hostname)&&callback.protocol==='https:'&&callback.host===expected.host&&callback.pathname===expected.pathname)callback.protocol='http:';
    if(callback.host!==expected.host||callback.pathname!==expected.pathname||callback.protocol!==expected.protocol||callback.username||callback.password||callback.hash||callback.searchParams.getAll('state').length!==1||callback.searchParams.getAll('code').length!==1||callback.searchParams.get('state')!==session.state||!callback.searchParams.get('code'))throw Error('Il callback non corrisponde a questo QR. Ricopia il link dalla richiesta appena autorizzata.');
    session.callback=callback.href;send(200,{message:'Indirizzo inviato. Controlla AniPlayer sulla TV.'});return;
   }
   if(page&&session&&req.method==='GET'&&!page[2]){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});
    res.end(`<!doctype html><html lang="it"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Collega AniPlayer</title><style>body{font:18px system-ui;max-width:650px;margin:30px auto;padding:20px;background:#10182a;color:#eef}a,button{display:inline-block;background:#697ddd;color:white;padding:16px;border-radius:10px;border:0;font:inherit}textarea{box-sizing:border-box;width:100%;min-height:180px;margin:16px 0;font:16px monospace}p{line-height:1.5}</style><h1>Collega AniPlayer</h1><p>1. Autorizza AniPlayer su MyAnimeList. L'autorizzazione si apre in una nuova scheda.</p><a href="${escape(session.auth)}" target="_blank" rel="noreferrer noopener">Apri MyAnimeList</a><p>2. Dopo Allow, copia tutto l'indirizzo dalla barra del browser, anche se la pagina locale non si apre. Torna in questa scheda.</p><form><label for="callback">3. Incolla qui l'indirizzo completo</label><textarea id="callback" name="callback" maxlength="16384" autocomplete="off" autocapitalize="none" spellcheck="false" required></textarea><button>Invia alla TV</button></form><p id="status" role="status"></p><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button'),status=document.querySelector('#status');button.disabled=true;status.textContent='Invio…';try{const r=await fetch(location.pathname+'/callback',{method:'POST',body:new URLSearchParams(new FormData(e.target))});const data=await r.json();status.textContent=data.message||data.error;if(!r.ok)button.disabled=false;}catch{status.textContent='PC non raggiungibile. Controlla la rete e riprova.';button.disabled=false;}};</script></html>`);return;
   }
   send(404,{error:'Pagina non disponibile o richiesta scaduta.'});
  }catch{send(400,{error:'Indirizzo non valido per questa richiesta. Incolla il callback completo del QR corrente.'});}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const server=createRelay();server.on('error',()=>{console.error('Impossibile avviare il relay sulla porta 8766.');process.exitCode=1;});
 server.listen(8766,'0.0.0.0',()=>{console.log('Relay MAL attivo. In AniPlayer inserisci uno di questi indirizzi del PC:');for(const list of Object.values(networkInterfaces()))for(const item of list||[])if(item.family==='IPv4'&&!item.internal)console.log('http://'+item.address+':8766');console.log('Lascia questa finestra aperta durante il collegamento. Nessun callback o token viene scritto su disco.');});
}
