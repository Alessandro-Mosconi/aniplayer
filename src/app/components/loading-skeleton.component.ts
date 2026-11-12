import {Component,input} from '@angular/core';
import {AnimeLoaderComponent} from './anime-loader.component';

@Component({
 selector:'app-loading-skeleton',standalone:true,imports:[AnimeLoaderComponent],
 template:`
 <div class="skeleton-stage">
  <div class="skeleton-content" aria-hidden="true">
   @if(variant()==='home'){<div class="skeleton-hero"></div><div class="skeleton-title"></div>}
   @if(variant()==='detail'||variant()==='explore'){
    <div class="skeleton-feature"><div class="skeleton-poster"></div><div class="skeleton-copy"><div class="skeleton-line short"></div><div class="skeleton-line title"></div><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></div>
   }
   <div class="skeleton-grid">@for(item of placeholders;track item){<div class="skeleton-card"><div class="skeleton-cover"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>}</div>
  </div>
  <div class="skeleton-loader"><app-anime-loader [message]="message()" /></div>
 </div>`,
 styles:[`
 :host{display:block}.skeleton-stage{position:relative;min-height:380px;overflow:hidden}.skeleton-content{opacity:.5;pointer-events:none}.skeleton-hero,.skeleton-feature{height:clamp(300px,42vh,430px);border-radius:20px;background:#26334b;margin-bottom:32px}.skeleton-feature{display:flex;gap:30px;padding:22px}.skeleton-poster{width:28%;max-width:300px;height:100%;border-radius:12px;background:#3b4a65}.skeleton-copy{flex:1;padding:20px 0}.skeleton-title,.skeleton-line,.skeleton-cover{border-radius:8px;background:#35445f}.skeleton-title{width:220px;height:26px;margin:0 0 24px}.skeleton-line{height:15px;margin:15px 0;width:88%}.skeleton-line.short{width:46%}.skeleton-line.title{height:32px;width:65%;margin:24px 0}.skeleton-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:24px;max-height:420px;overflow:hidden}.skeleton-cover{width:100%;aspect-ratio:2/3}.skeleton-loader{position:absolute;inset:0;display:flex;justify-content:center;align-items:flex-start;pointer-events:none}.skeleton-content{animation:skeleton-pulse 1.8s ease-in-out infinite}@keyframes skeleton-pulse{50%{opacity:.3}}@media(prefers-reduced-motion:reduce){.skeleton-content{animation:none}}@media(max-width:760px){.skeleton-stage{min-height:300px}.skeleton-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.skeleton-feature{height:300px;gap:15px;padding:15px}.skeleton-poster{width:35%}.skeleton-copy{padding:5px 0}}
 `]
})
export class LoadingSkeletonComponent {
 readonly variant=input<'grid'|'home'|'detail'|'explore'>('grid');
 readonly message=input('Caricamento…');
 readonly placeholders=Array.from({length:8},(_,i)=>i);
}
