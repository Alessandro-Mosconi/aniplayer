import {Injectable,computed,effect,inject,signal,untracked} from '@angular/core';
import {Anime,Detail,CatalogFilters,animeTitle,cleanError} from './models';
import {CatalogService} from './catalog.service';
import {AnimeWorldService} from './animeworld.service';
import {StorageService} from './storage.service';
import {PlaybackService} from './playback.service';
import {NavigationService,RouteState,isBaseRoute} from './navigation.service';
import {RemoteService} from './remote.service';
import {MalService} from './mal.service';
import {LibraryService} from './library.service';
import {TizenService} from './tizen.service';
import {IntroPrefetchService} from './intro-prefetch.service';
import {CatalogProgressService} from './catalog-progress.service';
@Injectable({providedIn:'root'})
export class AppFacadeService {
 readonly nav=inject(NavigationService);readonly catalog=inject(CatalogService);readonly animeworld=inject(AnimeWorldService);
 readonly storage=inject(StorageService);readonly playback=inject(PlaybackService);readonly remote=inject(RemoteService);readonly mal=inject(MalService);
 readonly lib=inject(LibraryService);readonly tv=inject(TizenService);readonly prefetch=inject(IntroPrefetchService);
 readonly catalogProgress=inject(CatalogProgressService);
 readonly catalogTotalExact=signal(true);readonly catalogHasMore=signal(false);
 readonly loading=signal(false);readonly error=signal('');readonly featured=signal<Anime[]>([]);readonly recent=signal<Anime[]>([]);
 readonly cards=signal<Anime[]>([]);readonly total=signal(0);readonly details=signal<Detail|null>(null);readonly related=signal<Anime[]>([]);
 readonly candidates=signal<Anime[]>([]);readonly audioMatches=signal<Detail[]>([]);readonly sourceNotice=signal('');
 readonly searchText=signal('');readonly filters=signal<CatalogFilters>({});readonly page=signal(0);readonly episodePage=signal(0);
 readonly activeDetail=signal<Anime|null>(null);readonly domainField=signal(this.catalog.domain());readonly malClient=signal(this.mal.clientId());readonly malRedirect=signal(this.mal.redirectUri());readonly malCallback=signal('');
 readonly selectLanguage=signal<'auto'|'dub'|'sub'>('auto');readonly allFavorites=computed(()=>Object.values(this.storage.favorites()));
 readonly allHistory=computed(()=>Object.values(this.storage.history()).sort((a,b)=>b.updated-a.updated));
 readonly viewTitle=animeTitle;
 genreText(anime:Anime){const g=anime.genres as any;return Array.isArray(g)?g.map(x=>typeof x==='string'?x:x.name||'').filter(Boolean).join(' / '):typeof g==='string'?g:'';}
 private seq=0; catalogFocusHint:'search'|'results'|'filters'|null=null;
 constructor(){
  void this.animeworld.checkConnection();
  this.remote.configure({player:e=>this.playback.handleKey(e),back:()=>this.back(),playerActive:()=>this.playback.state().opened});
  this.playback.onClosed=()=>this.remote.restore();
  effect(()=>{const route=this.nav.route();untracked(()=>void this.load(route));});
  window.addEventListener('aniplayer-suspend',()=>this.playback.pause());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)this.playback.pause();});
 }
 readonly exitPrompt=signal(false);private exitFocus:HTMLElement|null=null;
 back(){
  if(this.playback.state().opened){this.playback.handleKey(new KeyboardEvent('keydown',{key:'Back'}));return;}
  if(this.exitPrompt()){this.cancelExit();return;}
  if(isBaseRoute(this.nav.route().name)){
   this.exitFocus=document.activeElement as HTMLElement;this.exitPrompt.set(true);
   setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-exit-cancel]')));return;
  }
  this.nav.back();
 }
 cancelExit(){this.exitPrompt.set(false);setTimeout(()=>{if(this.exitFocus?.isConnected)this.remote.focus(this.exitFocus);else this.remote.first(document.getElementById('view')||undefined);});}
 confirmExit(){
  try{if(this.tv.exitApp())return;this.cancelExit();this.error.set('Nel browser puoi chiudere la scheda. Sulle piattaforme supportate questo comando chiude AniPlayer.');}
  catch(error){this.cancelExit();this.error.set('Impossibile chiudere l’app: '+cleanError(error));}
 }
 go(name:RouteState['name']){if(name==='explore'&&this.storage.settings()['exploreEnabled']===false)return;this.nav.open(name);}
 openAnime(anime:Anime){this.nav.open('detail',{anime});}
 private async load(route:RouteState){const seq=++this.seq;this.error.set('');this.loading.set(false);this.details.set(null);this.audioMatches.set([]);this.sourceNotice.set('');
  if(['home','catalog'].includes(route.name)){this.loading.set(true);try{
   if(route.name==='home'){
    const [h,c]=await Promise.allSettled([this.catalog.home(),this.catalog.catalog({},0)]);
    if(seq!==this.seq)return;
    if(h.status==='fulfilled'){this.featured.set(h.value.featured);this.recent.set(h.value.recent);}if(c.status==='fulfilled'){this.cards.set(c.value.records);this.total.set(c.value.tot);}
    if(h.status==='rejected'&&c.status==='rejected')throw h.reason;
   }else {this.cards.set([]);this.total.set(0);this.catalogHasMore.set(false);this.catalogTotalExact.set(true);const result=await this.catalogProgress.page({...this.filters(),title:this.searchText()||false as any},this.page()*30);if(seq!==this.seq)return;this.cards.set(result.records);this.total.set(result.tot);this.catalogTotalExact.set(result.exact);this.catalogHasMore.set(result.hasMore);}
  }catch(e){if(seq===this.seq)this.error.set(cleanError(e));}finally{if(seq===this.seq)this.loading.set(false);}}
  if(route.name==='detail'&&route.anime){this.loading.set(true);this.activeDetail.set(route.anime);try{
    const anime=route.anime;let detail:Detail;
    if(anime.provider==='animeworld'){
      detail=await this.animeworld.detail(anime);
      try{const alternative=await this.animeworld.match(detail.anime);if(seq!==this.seq)return;
       this.audioMatches.set(alternative.matches);this.candidates.set(alternative.candidates);
       const preferred=alternative.matches.find(m=>m.anime.awSlug===anime.awSlug);
       if(preferred&&preferred.episodes.length)detail={...preferred,anime:{...detail.anime,...preferred.anime},related:detail.related};
      }catch{}
    }
    else {
     const [catalogDetail,match]=await Promise.all([this.catalog.detail(anime),this.animeworld.match(anime)]);
     const preferred=match.matches.find(m=>Number(m.anime.dub)===Number(anime.dub))||match.matches[0];
     this.audioMatches.set(match.matches);this.candidates.set(match.candidates);
     if(match.matches.length&&new Set(match.matches.map(m=>Number(m.anime.dub))).size<2){
      void this.findOtherAudioVersion(seq,catalogDetail.anime,match.matches);
     }
     if(preferred){detail={...preferred,anime:{...catalogDetail.anime,...preferred.anime},related:catalogDetail.related};}
     else {detail={...catalogDetail,episodes:[],count:0};this.sourceNotice.set('Nessun abbinamento verificato con AnimeWorld.');}
    }
    if(seq!==this.seq)return;this.details.set(detail);this.episodePage.set(0);
   }catch(e){if(seq===this.seq)this.error.set(cleanError(e));}finally{if(seq===this.seq)this.loading.set(false);}}
  if(route.name==='related'&&route.anime){this.loading.set(true);try{const d=await this.catalog.detail(route.anime);if(seq===this.seq){this.related.set(d.related);this.activeDetail.set(d.anime);}}catch(e){if(seq===this.seq)this.error.set(cleanError(e));}finally{if(seq===this.seq)this.loading.set(false);}}
  if(seq===this.seq)setTimeout(()=>{if(seq!==this.seq||this.playback.state().opened||this.exitPrompt())return;
    if(route.name==='catalog'&&this.catalogFocusHint){
      const hint=this.catalogFocusHint;this.catalogFocusHint=null;
      const target=this.error()?document.querySelector<HTMLElement>('[data-focus=catalog-submit]'):hint==='results'?document.querySelector<HTMLElement>('.catalog-grid .anime-card'):hint==='filters'?document.querySelector<HTMLElement>('[data-focus=filter-audio]'):document.querySelector<HTMLElement>('[data-focus=catalog-search]');
      this.remote.focus(target||document.querySelector<HTMLElement>('[data-focus=catalog-submit]'));
    }else if(route.name==='explore'&&document.querySelector('[data-explore-card]'))this.remote.focus(document.querySelector<HTMLElement>('[data-explore-card]'));
    else this.remote.first(document.getElementById('view')||undefined);
  },60);
 }
 /** Fetch alternate catalog audio asynchronously so the detail page opens promptly. */
 private async findOtherAudioVersion(seq:number,anime:Anime,known:Detail[]){
  const wanted=known.some(m=>Number(m.anime.dub)===1)?0:1;
  try{
   const version=await this.catalog.version(anime,wanted);if(seq!==this.seq)return;
   const found=await this.animeworld.match(version);if(seq!==this.seq)return;
   const alternative=found.matches.find(m=>Number(m.anime.dub)===wanted&&m.episodes.length);
   if(!alternative)return;
   const fresh=this.audioMatches();if(fresh.some(m=>Number(m.anime.dub)===wanted))return;
   this.audioMatches.set([...fresh,{...alternative,anime:{...version,...alternative.anime}}]);
  }catch{/* Non mostrare versioni non verificabili. */}
 }
 progress(anime:Anime){const row=this.storage.history()[String(anime.id)];return row?.duration?row.position/row.duration*100:0;}
}

