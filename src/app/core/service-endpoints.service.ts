import {Injectable} from '@angular/core';
import {StorageService} from './storage.service';

export type PublicService='aniskip'|'anilist';
export const PUBLIC_SERVICE_DEFAULTS:Record<PublicService,string>={aniskip:'https://api.aniskip.com',anilist:'https://graphql.anilist.co'};
export function normalizeServiceOrigin(value:string){
 const url=new URL(value.trim());
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash||url.pathname!=='/'||!url.hostname.includes('.'))throw Error('Inserisci un dominio HTTPS senza percorso o parametri.');
 return url.origin;
}
@Injectable({providedIn:'root'})
export class ServiceEndpointsService {
 constructor(private storage:StorageService){}
 origin(service:PublicService){const saved=this.storage.settings()['serviceEndpoints']?.[service];try{return saved?normalizeServiceOrigin(saved):PUBLIC_SERVICE_DEFAULTS[service];}catch{return PUBLIC_SERVICE_DEFAULTS[service];}}
 async probe(service:PublicService,value:string){
  const origin=normalizeServiceOrigin(value),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
   const response=service==='anilist'
    ?await fetch(origin,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:'query{Media(id:1,type:ANIME){id}}'}),signal:controller.signal,redirect:'error'})
    :await fetch(origin+'/v2/skip-times/1/1?types%5B%5D=op&episodeLength=0',{signal:controller.signal,redirect:'error'});
   if(!response.ok&&!(service==='aniskip'&&response.status===404))throw Error('HTTP '+response.status);
   if(response.url&&new URL(response.url).origin!==origin)throw Error('Il servizio ha risposto da un dominio diverso.');
   const data=await response.json();
   if(service==='anilist'?(!!data.errors||Number(data.data?.Media?.id)!==1):(typeof data.found!=='boolean'&&!Array.isArray(data.results)))throw Error('Risposta del servizio non riconosciuta.');
   return origin;
  }finally{clearTimeout(timer);}
 }
 async save(service:PublicService,value:string){
  const origin=await this.probe(service,value),settings=this.storage.settings(),next={...settings,serviceEndpoints:{...(settings['serviceEndpoints']||{}),[service]:origin}};
  if(!this.storage.write('settings',next))throw Error('Impossibile salvare l’indirizzo.');
  this.storage.settings.set(next);
  if(service==='aniskip'){this.storage.write('skipTimesCache',{});this.storage.write('aniskipAvailability',{});}
 }
}
