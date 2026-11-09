import {Injectable,signal} from '@angular/core';
import {MalService} from './mal.service';
@Injectable({providedIn:'root'})
export class MalPhoneRelayService {
 readonly address=signal('');readonly phoneUrl=signal('');readonly status=signal('');
 private generation=0;private timer:ReturnType<typeof setTimeout>|undefined;
 constructor(private mal:MalService){}
 stop(){this.generation++;clearTimeout(this.timer);this.phoneUrl.set('');this.status.set('');}
 private async request(url:string,init:RequestInit={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);try{const response=await fetch(url,{...init,credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});if(!response.ok)throw Error('Relay PC: HTTP '+response.status);return await response.json();}finally{clearTimeout(timer);}}
 async start(){
  this.stop();const generation=this.generation;
  const base=new URL(this.address().trim());
  const host=base.hostname,parts=host.split('.').map(Number);
  const ipv4=parts.length===4&&parts.every(x=>Number.isInteger(x)&&x>=0&&x<=255);
  const local=host==='localhost'||host==='[::1]'||ipv4&&(parts[0]===10||parts[0]===127||parts[0]===192&&parts[1]===168||parts[0]===172&&parts[1]>=16&&parts[1]<=31);
  if(base.protocol!=='http:'||!local||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error('Inserisci l’indirizzo HTTP locale del PC mostrato dal relay, senza percorso.');
  this.status.set('Connessione al PC…');
  try{
   const authorizationUrl=this.mal.begin(false,false);
   const result=await this.request(base.origin+'/pair',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({authorizationUrl}).toString()});
   if(generation!==this.generation)return;
   if(!/^\/p\/[a-f0-9]{48}$/.test(result.phonePath)||!/^\/result\/[a-f0-9]{48}$/.test(result.pollPath))throw Error('Risposta relay non valida.');
   this.phoneUrl.set(base.origin+result.phonePath);this.status.set('Scansiona il QR. Incolla il callback nella pagina sul telefono e premi Invia alla TV.');
   const deadline=Date.now()+15*60_000;
   const poll=async()=>{
    if(generation!==this.generation)return;
    if(Date.now()>deadline){this.phoneUrl.set('');this.status.set('Richiesta scaduta: avvia di nuovo il collegamento.');return;}
    try{
     const response=await this.request(base.origin+result.pollPath);
     if(generation!==this.generation)return;
     if(response.callback){this.phoneUrl.set('');this.status.set('Indirizzo ricevuto dal telefono. Collegamento a MAL…');await this.mal.complete(response.callback);this.status.set('Account collegato.');return;}
     this.timer=setTimeout(()=>void poll(),1500);
    }catch{if(generation===this.generation){this.phoneUrl.set('');this.status.set(this.mal.connectionError()||'Collegamento interrotto. Controlla che il relay sul PC sia aperto e raggiungibile dalla TV.');}}
   };
   void poll();
  }catch(error){this.status.set('PC non raggiungibile. Verifica indirizzo, relay aperto e accesso alla rete locale.');throw error;}
 }
}
