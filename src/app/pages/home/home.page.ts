import {Component,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PageBase} from '../../core/page-base';
import {AnimeCardComponent} from '../../components/anime-card.component';
import {Anime} from '../../core/models';
import {ExplorationService} from '../../core/exploration.service';
@Component({selector:'app-home-page',standalone:true,imports:[CommonModule,AnimeCardComponent],templateUrl:'./home.page.html',styleUrl:'./home.page.scss'})
export class HomePage extends PageBase {
 readonly exploration=inject(ExplorationService);
 readonly discover=this.vm.homeDiscover;
 readonly discoverBusy=this.vm.homeDiscoverBusy;readonly discoverMessage=this.vm.homeDiscoverMessage;
 shuffleDiscover(){void this.vm.shuffleHomeDiscover();}
 openDiscover(){this.vm.catalogPreviousOrder=false;this.filters.set({...this.vm.homeDiscoverFilters()});this.searchText.set('');this.page.set(0);this.vm.catalogFocusHint='results';this.nav.open('catalog');}
  readonly hasNewEpisode=this.vm.hasNewEpisode.bind(this.vm);
 openRecent(){this.vm.catalogPreviousOrder=false;this.filters.set({order:'episode_desc'});this.searchText.set('');this.page.set(0);this.vm.catalogFocusHint='results';this.nav.open('catalog');}
 openExplored(){this.filters.set({explored:'seen'});this.searchText.set('');this.page.set(0);this.vm.catalogFocusHint='results';this.nav.open('catalog');}
 hero(): Anime|null {return this.featured()[0]||this.cards()[0]||null;}
 meta(anime: Anime) {return [anime.date,anime.type,anime.status,Number(anime.score)>0?'★ '+anime.score:null,Number(anime.dub)?'Audio ITA':'SUB ITA'].filter(Boolean).join(' · ');}
 plot(anime: Anime) {const text=String(anime.plot||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();return text.slice(0,280);}
}
