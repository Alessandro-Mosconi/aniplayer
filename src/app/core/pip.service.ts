import {Injectable,inject,signal} from '@angular/core';
import {TvPlatformService} from './tv-platform.service';

@Injectable({providedIn:'root'})
export class PipService {
 private readonly platform=inject(TvPlatformService);
 private readonly native=(window as any).AniPlayerNative;
 readonly supported=signal(false);readonly notice=signal('');
 private video:HTMLVideoElement|null=null;
 attach(video:HTMLVideoElement){
  this.video=video;
  const update=()=>{
   const v=video as any;
   const phone=this.native?.isTelevision?.()===false;
   const browser=!this.platform.onTv||(this.platform.platform==='android'&&/Mobile/i.test(navigator.userAgent));
   this.supported.set(phone?!!this.native?.isPipSupported?.():!this.native&&browser&&!!((document.pictureInPictureEnabled&&v.requestPictureInPicture)||v.webkitSupportsPresentationMode?.('picture-in-picture')));
   this.native?.setPipPlayback?.(!video.paused&&!video.ended&&video.readyState>=2,video.videoWidth||16,video.videoHeight||9);
  };
  for(const name of ['play','playing','pause','ended','loadedmetadata','emptied'])video.addEventListener(name,update);
  video.addEventListener('emptied',()=>{if(document.pictureInPictureElement===video)void document.exitPictureInPicture().catch(()=>{});});
  window.addEventListener('aniplayer-pip',(event:Event)=>{
   const detail=(event as CustomEvent).detail;
   document.documentElement.classList.toggle('native-pip',!!detail?.active);
   if(detail?.error)this.notice.set(detail.error);
  });
  update();
 }
 async enter(){
  const video=this.video as any;this.notice.set('');
  if(!video||video.readyState<2){this.notice.set('Attendi che il video sia pronto.');return;}
  try{
   if(this.native?.isPipSupported?.()){this.native.enterPip(video.videoWidth||16,video.videoHeight||9);return;}
   if(document.pictureInPictureElement===video)await document.exitPictureInPicture();
   else if(document.pictureInPictureEnabled&&video.requestPictureInPicture)await video.requestPictureInPicture();
   else if(video.webkitSupportsPresentationMode?.('picture-in-picture'))video.webkitSetPresentationMode(video.webkitPresentationMode==='picture-in-picture'?'inline':'picture-in-picture');
   else this.notice.set('Picture-in-Picture non supportato da questo browser.');
  }catch{this.notice.set('Impossibile aprire il Picture-in-Picture. Verifica le autorizzazioni del dispositivo o del browser.');}
 }
}
