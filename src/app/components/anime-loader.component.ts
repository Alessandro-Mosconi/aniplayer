import {Component,input,signal,computed} from '@angular/core';
import {LoadingDotsComponent} from './loading-dots.component';
import {loadingPhrases} from '../frasi-caricamento';

/** Visual e frasi del loader originale, senza script inline (CSP Tizen). */
@Component({
 selector:'app-anime-loader', standalone:true,imports:[LoadingDotsComponent],
 template:`@if(variant()==='inline'){<div class="inline-loader" role="status" [attr.aria-label]="plainMessage()"><span>{{plainMessage()}}<app-loading-dots /></span><small aria-hidden="true">{{phrase()}}</small></div>}@else{<div class="app-loader" [class.loader-page]="variant()==='page'" [class.loader-player]="variant()==='player'" role="status" [attr.aria-label]="plainMessage()">
  <div class="anime-loader" aria-hidden="true">
    <svg class="loader-shuriken" viewBox="0 0 64 64"><path d="M32 4 39 24 60 32 40 39 32 60 24 40 4 32 24 24Z" fill="currentColor"/><circle cx="32" cy="32" r="5" fill="#171e35"/></svg>
    <i class="loader-spark spark-one"></i><i class="loader-spark spark-two"></i>
  </div>
  <span class="loader-caption">UN ATTIMO, SENPAI</span>
  <span class="loader-message" aria-hidden="true">{{plainMessage()}}<app-loading-dots /></span>
  <span class="loader-phrase" aria-hidden="true">{{phrase()}}</span>
 </div>}`,
 styles:[`.inline-loader{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 18px;color:#b9c7df;padding:12px 0}.inline-loader small{font-size:.85em;color:#90a1bf}`]
})
export class AnimeLoaderComponent {
 readonly message=input('Caricamento…');readonly variant=input<'page'|'player'|'inline'>('page');
 readonly plainMessage=computed(()=>this.message().replace(/[.\u2026\s]+$/u,''));
 readonly phrase=signal('');private interval:ReturnType<typeof setInterval>|undefined;
 private previous='';
 ngOnInit(){this.advance();this.interval=setInterval(()=>this.advance(),5000);}
 ngOnDestroy(){if(this.interval)clearInterval(this.interval);}
 private advance(){const list=[...new Set(loadingPhrases.map(x=>x.trim()).filter(Boolean))];if(!list.length)return;
  const alternatives=list.filter(x=>x!==this.previous);
  const pool=alternatives.length?alternatives:list;
  const next=pool[Math.floor(Math.random()*pool.length)];this.previous=next;this.phrase.set(next);
 }
}
