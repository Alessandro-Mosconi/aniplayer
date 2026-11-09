import {Component,input,signal} from '@angular/core';
import {loadingPhrases} from '../frasi-caricamento';

/** Visual e frasi del loader originale, senza script inline (CSP Tizen). */
@Component({
 selector:'app-anime-loader', standalone:true,
 template:`<div class="app-loader" [class.loader-page]="variant()==='page'" [class.loader-player]="variant()==='player'" role="status" aria-live="polite">
  <div class="anime-loader" aria-hidden="true">
    <svg class="loader-shuriken" viewBox="0 0 64 64"><path d="M32 4 39 24 60 32 40 39 32 60 24 40 4 32 24 24Z" fill="currentColor"/><circle cx="32" cy="32" r="5" fill="#171e35"/></svg>
    <i class="loader-spark spark-one"></i><i class="loader-spark spark-two"></i>
  </div>
  <span class="loader-caption">UN ATTIMO, SENPAI</span>
  <span class="loader-message">{{message()}}</span>
  <span class="loader-phrase" aria-hidden="true">{{phrase()}}</span>
 </div>`
})
export class AnimeLoaderComponent {
 readonly message=input('Caricamento…');readonly variant=input<'page'|'player'>('page');
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
