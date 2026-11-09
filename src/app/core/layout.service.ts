import {Injectable,computed,effect,inject,signal,DestroyRef} from '@angular/core';
import {StorageService} from './storage.service';
import {TvPlatformService} from './tv-platform.service';

@Injectable({providedIn:'root'})
export class LayoutService {
 private readonly storage=inject(StorageService);
 private readonly platform=inject(TvPlatformService);
 private readonly tvViewport=document.querySelector('meta[name="viewport"]')?.getAttribute('content')||'width=1920,initial-scale=1';
 private readonly native=(window as any).AniPlayerNative;
 private readonly phone=this.native?.isTelevision?.()===false||(!this.native&&this.platform.platform==='android'&&/Mobile/i.test(navigator.userAgent));
 readonly pc= computed(()=>this.storage.settings()['pcLayout']??(this.phone||!this.platform.onTv));
 private readonly mobileQuery=window.matchMedia('(max-width:760px), (pointer:coarse) and (max-width:1000px)');
 private readonly small=signal(this.mobileQuery.matches);
 readonly mobile=computed(()=>this.pc()&&this.small());
 readonly menuOpen=signal(false);
 constructor(){effect(()=>{
  document.documentElement.classList.toggle('browser-layout',this.pc());
  document.documentElement.classList.toggle('mobile-layout',this.mobile());
  document.documentElement.classList.toggle('mobile-menu-open',this.mobile()&&this.menuOpen());
  if(!this.mobile())this.menuOpen.set(false);
  document.querySelector('meta[name="viewport"]')?.setAttribute('content',this.pc()?'width=device-width,initial-scale=1':this.tvViewport);
 });const update=()=>this.small.set(this.mobileQuery.matches);this.mobileQuery.addEventListener('change',update);inject(DestroyRef).onDestroy(()=>this.mobileQuery.removeEventListener('change',update));}
 setPc(enabled:boolean){this.storage.setSetting('pcLayout',enabled);}
}
