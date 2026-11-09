import {Injectable, signal} from '@angular/core';
declare const webapis: any;
declare const tizen: any;
@Injectable({providedIn:'root'})
export class TizenService {
 readonly onTv = typeof window!=='undefined' && !!(window as any).tizen;
 readonly online=signal(navigator.onLine);
 constructor(){window.addEventListener('online',()=>this.online.set(true));window.addEventListener('offline',()=>this.online.set(false));}
 getAvplay(): any {return typeof webapis!=='undefined' ? webapis?.avplay : null;}
 exitApp(){if(typeof tizen==='undefined')return false;tizen.application.getCurrentApplication().exit();return true;}
 setKeys(){try{if(typeof tizen!=='undefined')for(const key of ['MediaPlay','MediaPause','MediaPlayPause','MediaStop','MediaFastForward','MediaRewind'])tizen.tvinputdevice.registerKey(key);}catch{}}
 openExternal(url:string){if(typeof tizen!=='undefined'){
   try{const request=new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/view',url);
     tizen.application.launchAppControl(request,null,()=>{},()=>{window.open(url,'_blank');});return;}catch{}
  }window.open(url,'_blank');}
 onAppControl(callback:(uri:string)=>void){
  try{if(typeof tizen==='undefined')return;
    tizen.application.getCurrentApplication().getRequestedAppControl()?.appControl?.uri && callback(tizen.application.getCurrentApplication().getRequestedAppControl().appControl.uri);
    tizen.application.getCurrentApplication().addAppControlEventListener((data:any)=>{if(data?.appControl?.uri)callback(data.appControl.uri);});
  }catch{}
 }
}
