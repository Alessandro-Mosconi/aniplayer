import {Injectable,signal} from '@angular/core';
declare const tizen:any;
declare const webapis:any;
export type TvPlatform='tizen'|'webos'|'android'|'fireos'|'vega'|'vidaa'|'browser';
export function detectTvPlatform(host:any,userAgent=''):TvPlatform{
 const ua=userAgent.toLowerCase();
 if(host?.tizen||/tizen/.test(ua))return 'tizen';
 if(host?.webOSSystem||host?.PalmSystem||/web0s|webos|netcast/.test(ua))return 'webos';
 if(/vega|kepler/.test(ua))return 'vega';
 if(/aft\w+|fire tv|fireos/.test(ua))return 'fireos';
 if(host?.AniPlayerNative||/android/.test(ua))return 'android';
 if(/vidaa/.test(ua))return 'vidaa';
 return 'browser';
}
@Injectable({providedIn:'root'})
export class TvPlatformService {
 readonly platform=detectTvPlatform(window,navigator.userAgent||'');
 readonly onTv=this.platform!=='browser';
 readonly label=({tizen:'SAMSUNG TIZEN',webos:'LG webOS',android:'ANDROID TV',fireos:'FIRE TV',vega:'FIRE TV VEGA',vidaa:'VIDAA',browser:'BROWSER'})[this.platform];
 readonly online=signal(navigator.onLine);
 private webosCalls=new Set<any>();
 constructor(){window.addEventListener('online',()=>this.online.set(true));window.addEventListener('offline',()=>this.online.set(false));}
 private samsung(){return typeof tizen!=='undefined'?tizen:(window as any).tizen;}
 getAvplay():any{return this.platform==='tizen'?(typeof webapis!=='undefined'?webapis?.avplay:(window as any).webapis?.avplay)||null:null;}
 exitApp(){
  const samsung=this.samsung();if(samsung?.application){samsung.application.getCurrentApplication().exit();return true;}
  const native=(window as any).AniPlayerNative;if(native){native.exit();return true;}
  if(this.platform==='webos'){window.close();return true;}
  return false;
 }
 setKeys(){try{const samsung=this.samsung();if(samsung)for(const key of ['MediaPlay','MediaPause','MediaPlayPause','MediaStop','MediaFastForward','MediaRewind'])samsung.tvinputdevice.registerKey(key);}catch{}}
 openExternal(value:string){
  const url=new URL(value);if(!['https:','http:'].includes(url.protocol))throw Error('Indirizzo esterno non consentito.');
  const samsung=this.samsung();if(samsung){try{const request=new samsung.ApplicationControl('http://tizen.org/appcontrol/operation/view',url.href);samsung.application.launchAppControl(request,null,()=>{},()=>window.open(url.href,'_blank'));return;}catch{}}
  const native=(window as any).AniPlayerNative;if(native){native.openExternal(url.href);return;}
  const bridge=(window as any).PalmServiceBridge;
  if(this.platform==='webos'&&bridge){const call=new bridge();this.webosCalls.add(call);call.onservicecallback=()=>this.webosCalls.delete(call);call.call('luna://com.webos.applicationManager/launch',JSON.stringify({id:'com.webos.app.browser',params:{target:url.href}}));return;}
  window.open(url.href,'_blank','noopener');
 }
 onAppControl(callback:(uri:string)=>void){
  try{const samsung=this.samsung();if(samsung){const app=samsung.application.getCurrentApplication();const uri=app.getRequestedAppControl()?.appControl?.uri;if(uri)callback(uri);app.addAppControlEventListener((data:any)=>{if(data?.appControl?.uri)callback(data.appControl.uri);});}}catch{}
  window.addEventListener('aniplayer-open-url',(event:Event)=>{const uri=(event as CustomEvent).detail;if(typeof uri==='string')callback(uri);});
  const native=(window as any).AniPlayerNative;try{const uri=native?.consumeLaunchUrl();if(uri)callback(uri);}catch{}
  window.addEventListener('webOSRelaunch',(event:Event)=>{const detail=(event as CustomEvent).detail;const uri=detail?.uri||detail?.launchParams?.uri;if(typeof uri==='string')callback(uri);});
 }
}
