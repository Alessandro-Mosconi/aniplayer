import {Component,AfterViewInit,OnDestroy,ElementRef,inject,input,output,signal} from '@angular/core';
import {Anime,animeTitle} from '../core/models';
import {IntroService} from '../core/intro.service';
@Component({selector:'app-anime-card',standalone:true,template:`
<button class="anime-card" [attr.data-focus]="'anime-'+anime().id" (click)="select.emit(anime())" [title]="animeTitle(anime())">
 <span class="poster"><img [src]="anime().imageurl||'assets/images/aniplayer-icon-512.png'" [alt]="animeTitle(anime())" loading="lazy" (error)="fallback($event)" />
 @if(anime().dub){<span class="dub-badge">ITA</span>}
 @if(introBadge()){<span class="intro-badge" title="Intervalli sigla presenti su AniSkip; verificare sempre la versione del video" aria-label="AniSkip rilevato">⏭ AS</span>}
 @if(progress()){<span class="card-progress"><span [style.width.%]="progress()"></span></span>}
 </span><span class="card-title">{{animeTitle(anime())}}</span>
 <span class="card-sub">{{anime().releaseDate||anime().date||anime().type||'Serie anime'}} @if(anime().season){ ? {{anime().season}} } @if(anime().score){ · ★ {{anime().score}} }</span>
</button>`})
export class AnimeCardComponent implements AfterViewInit,OnDestroy{
 readonly anime=input.required<Anime>();readonly progress=input(0);readonly select=output<Anime>();
 readonly introBadge=signal(false);animeTitle=animeTitle;
 private service=inject(IntroService);private host=inject(ElementRef<HTMLElement>);private observer:IntersectionObserver|null=null;private destroyed=false;
 ngAfterViewInit(){this.introBadge.set(this.service.hasBadge(this.anime()));
  if(!Number(this.anime().mal_id)||this.introBadge())return;
  if(typeof IntersectionObserver!=='undefined'){
   this.observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){this.observer?.disconnect();void this.checkBadge();}},{rootMargin:'350px'});
   this.observer.observe(this.host.nativeElement);
  }else void this.checkBadge();
 }
 private async checkBadge(){if(!this.destroyed&&await this.service.checkAvailability(this.anime())&&!this.destroyed)this.introBadge.set(true);}
 ngOnDestroy(){this.destroyed=true;this.observer?.disconnect();}
 fallback(e:Event){const target=e.target as HTMLImageElement;if(!target.src.endsWith('aniplayer-icon-512.png'))target.src='assets/images/aniplayer-icon-512.png';}
}
