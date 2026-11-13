import {Component,AfterViewInit,OnDestroy,ElementRef,inject,input,output,signal,computed,effect,Injector} from '@angular/core';
import {Anime,animeTitle} from '../core/models';
import {IntroService} from '../core/intro.service';
import {AppFacadeService} from '../core/app-facade.service';
@Component({selector:'app-anime-card',standalone:true,template:`
<button class="anime-card" [attr.data-focus]="'anime-'+anime().id" (click)="select.emit(anime())" [title]="animeTitle(anime())">
 <span class="poster"><img [src]="anime().imageurl||'assets/images/aniplayer-icon-512.png'" [alt]="animeTitle(anime())" loading="lazy" (error)="fallback($event)" />
 @if(anime().dub&&storage.badgeEnabled('audio')){<span class="dub-badge">ITA</span>}
 @if(newEpisode()&&storage.badgeEnabled('newEpisodes')){<span class="new-episode-badge" title="Episodio recente disponibile" aria-label="Episodio recente disponibile">EP+</span>}
 @else if(allSeen()&&storage.badgeEnabled('allSeen')){<span class="watched-all-badge" title="Tutti gli episodi disponibili risultano visti" aria-label="Tutti gli episodi disponibili visti">✓ Tutti visti</span>}
 @if(favorite()&&storage.badgeEnabled('favorites')){<span class="favorite-card-badge" [class.with-episode-badge]="(newEpisode()&&storage.badgeEnabled('newEpisodes'))||(allSeen()&&storage.badgeEnabled('allSeen')&&!(newEpisode()&&storage.badgeEnabled('newEpisodes')))" title="Nei preferiti" aria-label="Nei preferiti">★</span>}
 @if(introBadge()&&storage.badgeEnabled('aniskip')){<span class="intro-badge" title="Intervalli sigla presenti su AniSkip; verificare sempre la versione del video" aria-label="AniSkip rilevato">⏭ AS</span>}
 @if(progress()){<span class="card-progress"><span [style.width.%]="progress()"></span></span>}
 </span><span class="card-title">{{animeTitle(anime())}}</span>
 @if(anime().lastEpisodeDate){<span class="card-sub">Ep. {{anime().lastEpisode}} · {{episodeDate(anime().lastEpisodeDate!)}}</span>}
 <span class="card-sub">{{anime().releaseDate||anime().date||anime().type||'Serie anime'}} @if(anime().season){ &middot; {{anime().season}} } @if(anime().score){ · ★ {{anime().score}} }</span>
</button>`})
export class AnimeCardComponent implements AfterViewInit,OnDestroy{
 readonly anime=input.required<Anime>();readonly progress=input(0);readonly newEpisode=input(false);readonly select=output<Anime>();
 readonly introBadge=signal(false);animeTitle=animeTitle;
 private facade=inject(AppFacadeService);readonly storage=this.facade.storage;readonly allSeen=computed(()=>this.facade.allAvailableEpisodesSeen(this.anime()));readonly favorite=computed(()=>this.facade.storage.isFavorite(this.anime()));
 private injector=inject(Injector);private service=inject(IntroService);private host=inject(ElementRef<HTMLElement>);private observer:IntersectionObserver|null=null;private destroyed=false;
 episodeDate(value:string){const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(value);return match?`${match[3]}/${match[2]}/${match[1]}`:value;}
 ngAfterViewInit(){effect(()=>{const anime=this.anime(),enabled=this.storage.badgeEnabled('aniskip');this.observer?.disconnect();this.observer=null;this.introBadge.set(enabled&&this.service.hasBadge(anime));
  if(!enabled||!Number(anime.mal_id)||this.introBadge())return;
  if(typeof IntersectionObserver!=='undefined'){
   this.observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){this.observer?.disconnect();void this.checkBadge(anime);}},{rootMargin:'350px'});
   this.observer.observe(this.host.nativeElement);
  }else void this.checkBadge(anime);
 },{injector:this.injector});}
 private async checkBadge(anime:Anime){if(!this.destroyed&&await this.service.checkAvailability(anime)&&!this.destroyed&&this.storage.badgeEnabled('aniskip')&&this.anime()===anime)this.introBadge.set(true);}
 ngOnDestroy(){this.destroyed=true;this.observer?.disconnect();}
 fallback(e:Event){const target=e.target as HTMLImageElement;if(!target.src.endsWith('aniplayer-icon-512.png'))target.src='assets/images/aniplayer-icon-512.png';}
}

