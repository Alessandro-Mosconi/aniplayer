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
import {MalLibraryService} from './mal-library.service';
import {NextSeasonService} from './next-season.service';
import {pictureInPictureActive} from './picture-in-picture';
@Injectable({providedIn:'root'})
export class AppFacadeService {
 readonly nav=inject(NavigationService);readonly catalog=inject(CatalogService);readonly animeworld=inject(AnimeWorldService);
 readonly storage=inject(StorageService);readonly playback=inject(PlaybackService);readonly remote=inject(RemoteService);readonly mal=inject(MalService);
 readonly lib=inject(LibraryService);readonly tv=inject(TizenService);readonly prefetch=inject(IntroPrefetchService);
 readonly catalogProgress=inject(CatalogProgressService);
 readonly malLibrary=inject(MalLibraryService);
 readonly nextSeasonService=inject(NextSeasonService);
 readonly catalogTotalExact=signal(true);readonly catalogHasMore=signal(false);
 readonly catalogScanning=signal(false);readonly catalogScanMessage=signal('');
 readonly loading=signal(false);readonly error=signal('');readonly featured=signal<Anime[]>([]);readonly recent=signal<Anime[]>([]);
 readonly homeDiscover=signal<Anime[]>([]);
 readonly homeDiscoverFilters=signal<CatalogFilters>({});
 readonly homeDiscoverBusy=signal(false);readonly homeDiscoverMessage=signal('');private homeDiscoverRequest=0;
 readonly settingsCategory=signal<'general'|'catalog'|'playback'|'mal'|'data'|'badges'>('general');settingsFocusHint:string|null=null;
 readonly cards=signal<Anime[]>([]);readonly total=signal(0);readonly details=signal<Detail|null>(null);readonly related=signal<Anime[]>([]);
 readonly candidates=signal<Anime[]>([]);readonly audioMatches=signal<Detail[]>([]);readonly sourceNotice=signal('');
 readonly searchText=signal('');readonly filters=signal<CatalogFilters>({});readonly page=signal(0);readonly episodePage=signal(0);
 readonly activeDetail=signal<Anime|null>(null);readonly domainField=signal(this.catalog.domain());readonly malClient=signal(this.mal.clientId());readonly malRedirect=signal(this.mal.redirectUri());readonly malCallback=signal('');
 readonly latestEpisodeUpdates=signal<Anime[]>(this.readEpisodeUpdates());
 readonly newFavoriteEpisodeCount=computed(()=>this.allFavorites().filter(anime=>this.hasNewEpisode(anime)).length);
 readonly selectLanguage=signal<'auto'|'dub'|'sub'>('auto');readonly allFavorites=computed(()=>Object.values(this.storage.favorites()));
 readonly allHistory=computed(()=>Object.values(this.storage.history()).sort((a,b)=>b.updated-a.updated));
 readonly viewTitle=animeTitle;
 genreText(anime:Anime){const g=anime.genres as any;return Array.isArray(g)?g.map(x=>typeof x==='string'?x:x.name||'').filter(Boolean).join(' / '):typeof g==='string'?g:'';}
 private seq=0;private episodeUpdateRequest=0; catalogFocusHint:'search'|'results'|'filters'|null=null; catalogPreviousOrder:string|false=false;
 constructor(){
  void this.animeworld.checkConnection();
  this.remote.configure({player:e=>this.playback.handleKey(e),back:()=>this.back(),playerActive:()=>this.playback.state().opened});
  this.playback.onClosed=()=>this.remote.restore();
  this.playback.audioVersionsProvider=()=>this.audioMatches();
  this.playback.seasonResolver=(detail,episode)=>this.nextSeasonService.resolve(detail,episode);
  this.playback.onSeasonChanged=detail=>this.nav.replace('detail',{anime:detail.anime});
  this.playback.onAudioChanged=detail=>{if(String(this.details()?.anime.id)===String(detail.anime.id))this.details.set({...detail,related:this.details()?.related||detail.related});};
  effect(()=>{const route=this.nav.route();untracked(()=>void this.load(route));});
  setInterval(()=>{if(document.visibilityState==='visible')void this.refreshEpisodeUpdates();},15*60*1000);
  window.addEventListener('aniplayer-suspend',()=>{if(!pictureInPictureActive(window,document))this.playback.pause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!pictureInPictureActive(window,document))this.playback.pause();});
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
 async shuffleHomeDiscover(){
  if(this.homeDiscoverBusy())return;
  const seq=this.seq,request=++this.homeDiscoverRequest,discoverFilters:CatalogFilters={order:'random',randomSeed:Math.floor(Math.random()*4294967296)};
  this.homeDiscoverBusy.set(true);this.homeDiscoverMessage.set('');
  try{const result=await this.catalogProgress.page({...discoverFilters,title:false as any},0);if(seq===this.seq&&result.records.length){this.homeDiscoverFilters.set(discoverFilters);this.homeDiscover.set(result.records);}else if(seq===this.seq)this.homeDiscoverMessage.set('Nessun anime trovato.');}
  catch{if(seq===this.seq)this.homeDiscoverMessage.set('Impossibile mescolare. Riprova.');}
  finally{if(request===this.homeDiscoverRequest)this.homeDiscoverBusy.set(false);}
 }
 private async continueScoreScan(seq:number,filters:CatalogFilters,offset:number){
  this.catalogScanning.set(true);this.catalogScanMessage.set('');
  try{while(seq===this.seq){
   await new Promise(resolve=>setTimeout(resolve,350));if(seq!==this.seq)return;
   const result=await this.catalogProgress.page(filters,offset);if(seq!==this.seq)return;
   this.cards.set(result.records);this.total.set(result.tot);this.catalogTotalExact.set(result.exact);this.catalogHasMore.set(result.hasMore);
   if(result.exact||!result.hasMore||result.records.length>=30)return;
  }}catch{if(seq===this.seq)this.catalogScanMessage.set('Ricerca sospesa. Premi Continua ricerca per riprovare.');}
  finally{if(seq===this.seq)this.catalogScanning.set(false);}
 }
 private async load(route:RouteState){const seq=++this.seq;this.catalogScanning.set(false);this.catalogScanMessage.set('');this.error.set('');this.loading.set(false);this.details.set(null);this.audioMatches.set([]);this.sourceNotice.set('');
  if(['home','catalog'].includes(route.name)){this.loading.set(true);try{
   if(route.name==='home'){
    const [h,c]=await Promise.allSettled([this.catalog.home(),this.catalog.catalog({},0)]);
    if(seq!==this.seq)return;
    if(h.status==='fulfilled'){this.featured.set(h.value.featured);this.recent.set(h.value.recent);this.mergeEpisodeUpdates(h.value.recent);void this.refreshEpisodeUpdates();}this.homeDiscoverFilters.set({});if(c.status==='fulfilled'){this.cards.set(c.value.records);this.homeDiscover.set(c.value.records);this.total.set(c.value.tot);}else this.homeDiscover.set([]);
    this.homeDiscoverBusy.set(false);void this.shuffleHomeDiscover();
    if(h.status==='rejected'&&c.status==='rejected')throw h.reason;
   }else {this.cards.set([]);this.total.set(0);this.catalogHasMore.set(false);this.catalogTotalExact.set(true);const query={...this.filters(),title:this.searchText()||false as any},offset=this.page()*30;const result=await this.catalogProgress.page(query,offset);if(seq!==this.seq)return;this.cards.set(result.records);this.total.set(result.tot);this.catalogTotalExact.set(result.exact);this.catalogHasMore.set(result.hasMore);if(query.minScore&&!result.exact&&result.hasMore&&result.records.length<30)void this.continueScoreScan(seq,query,offset);}
  }catch(e){if(seq===this.seq)this.error.set(cleanError(e));}finally{if(seq===this.seq)this.loading.set(false);}}
  if(route.name==='detail'&&route.anime){this.loading.set(true);this.activeDetail.set(route.anime);try{
    const anime=route.anime;let detail:Detail;
    if(anime.provider==='animeworld'){
      detail=await this.animeworld.detail(anime);
      const [matched,relations]=await Promise.allSettled([this.animeworld.match(detail.anime),this.catalog.relatedFor(detail.anime)]);
      if(seq!==this.seq)return;
      if(matched.status==='fulfilled'){
       this.audioMatches.set(matched.value.matches);this.candidates.set(matched.value.candidates);
       const preferred=matched.value.matches.find(m=>m.anime.awSlug===anime.awSlug);
       if(preferred&&preferred.episodes.length)detail={...preferred,anime:{...detail.anime,...preferred.anime},related:detail.related};
      }
      if(relations.status==='fulfilled')detail={...detail,related:relations.value};
    }
    else {
     const catalogDetail=await this.catalog.detail(anime);const match=await this.animeworld.match(catalogDetail.anime);
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
    }else if(route.name==='settings'&&this.settingsFocusHint){const hint=this.settingsFocusHint;this.settingsFocusHint=null;this.remote.focus(document.querySelector<HTMLElement>(`[data-focus="${hint}"]`)||document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]'));}
    else if(route.name==='explore'&&document.querySelector('[data-explore-card]'))this.remote.focus(document.querySelector<HTMLElement>('[data-explore-card]'));
    else this.remote.first(document.getElementById('view')||undefined);
  },60);
 }
 private readEpisodeUpdates():Anime[]{const saved=this.storage.read<unknown>('episodeUpdates',[]);return Array.isArray(saved)?saved:[];}
 private async refreshEpisodeUpdates(){
  const request=++this.episodeUpdateRequest,records:Anime[]=[];
  try{for(let page=1;page<=5;page++){
   const result=await this.catalog.recentPage(page);if(request!==this.episodeUpdateRequest)return;
   records.push(...result.records);this.mergeEpisodeUpdates(records);
   if(page>=result.lastPage||!result.records.length)break;
  }}catch{/* Keep the updates already received if the provider is unavailable. */}
 }
 private mergeEpisodeUpdates(incoming:Anime[]){
  const tracked=[...this.allFavorites(),...this.allHistory().map(row=>row.anime)];
  const kept=this.latestEpisodeUpdates().filter(item=>tracked.some(anime=>this.sameEdition(item,anime)));
  const latest=new Map<string,Anime>();
  for(const item of [...kept,...incoming]){
   if(!item||!item.id||!Number.isFinite(Number(item.lastEpisode))||Number(item.lastEpisode)<=0)continue;
   const key=String(item.id),previous=latest.get(key);
   if(!previous||Number(item.lastEpisode)>Number(previous.lastEpisode)||Number(item.lastEpisode)===Number(previous.lastEpisode)&&!previous.lastEpisodeId)latest.set(key,item);
  }
  const updates=[...latest.values()];this.latestEpisodeUpdates.set(updates);
  this.storage.write('episodeUpdates',updates.filter(item=>tracked.some(anime=>this.sameEdition(item,anime))));
 }
 hasNewEpisode(anime:Anime):boolean{
  const latest=this.latestUpdateFor(anime);if(!latest)return false;
  const episode={id:latest.lastEpisodeId??'',number:String(latest.lastEpisode)};
  const identity={...anime,mal_id:anime.mal_id||latest.mal_id,anilist_id:anime.anilist_id||latest.anilist_id};
  if(this.lib.isSeen(identity,episode))return false;
  return !Object.values(this.storage.history()).some(row=>row.completed&&this.sameSeries(row.anime,anime)&&Number(row.episode.number)===Number(episode.number));
 }
 hasTrackedNewEpisode(anime:Anime):boolean{return (this.allFavorites().some(item=>this.sameEdition(item,anime))||this.allHistory().some(item=>this.sameEdition(item.anime,anime)))&&this.hasNewEpisode(anime);}
 allAvailableEpisodesSeen(anime:Anime):boolean{
  const update=this.latestUpdateFor(anime),identity={...anime,mal_id:anime.mal_id||update?.mal_id,anilist_id:anime.anilist_id||update?.anilist_id};
  const entries=this.malLibrary.source()?this.malLibrary.entries():this.mal.entries();
  const declared=Math.max(Number(anime.episodes_count)||0,Number(anime.real_episodes_count)||0,Number(entries[String(identity.mal_id)]?.total)||0);
  const latest=Math.max(Number(anime.lastEpisode)||0,Number(update?.lastEpisode)||0);
  const airing=/in\s*corso|releasing|airing|ongoing/i.test(String(anime.status||update?.status||''));
  const total=airing&&latest>0?latest:Math.max(declared,latest);
  if(!Number.isSafeInteger(total)||total<=0||total>20000)return false;
  const history=Object.values(this.storage.history()).filter(row=>row.completed&&this.sameSeries(row.anime,identity));
  const remoteEntries=this.mal.connected?this.mal.entries():this.lib.publicMal?.username()?this.lib.publicMal.entries():this.mal.entries();
  const remoteWatched=Math.max(0,Math.floor(Number(remoteEntries[String(identity.mal_id)]?.watched)||0));
  for(let number=Math.min(remoteWatched,total)+1;number<=total;number++){
   const saved=history.find(row=>Number(row.episode.number)===number);
   if(!this.lib.isSeen(identity,{id:saved?.episode.id??'',number:String(number)})&&!saved)return false;
  }
  return true;
 }
 private latestUpdateFor(anime:Anime):Anime|undefined{return this.latestEpisodeUpdates().filter(item=>this.sameEdition(item,anime)&&Number(item.lastEpisode)>0).reduce<Anime|undefined>((latest,item)=>!latest||Number(item.lastEpisode)>Number(latest.lastEpisode)?item:latest,undefined);}
 private sameEdition(left:Anime,right:Anime){if(String(left.id)===String(right.id))return true;return this.sameSeries(left,right)&&(left.dub==null||right.dub==null||Number(left.dub)===Number(right.dub));}
 private sameSeries(left:Anime,right:Anime){
  if(String(left.id)===String(right.id))return true;
  return Number(left.mal_id)>0&&Number(left.mal_id)===Number(right.mal_id)||Number(left.anilist_id)>0&&Number(left.anilist_id)===Number(right.anilist_id);
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

