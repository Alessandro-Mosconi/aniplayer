import {LoadingSkeletonComponent} from '../../components/loading-skeleton.component';
﻿import {Component,OnInit,OnDestroy,computed,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PageBase} from '../../core/page-base';
import {Anime,CatalogFilters} from '../../core/models';
import {CatalogProgressService} from '../../core/catalog-progress.service';
import {ExplorationService} from '../../core/exploration.service';
import {remoteKey} from '../../core/remote.service';
import {LayoutService} from '../../core/layout.service';
import {ExploreArtworkService} from '../../core/explore-artwork.service';
@Component({selector:'app-explore-page',standalone:true,imports:[LoadingSkeletonComponent,CommonModule],templateUrl:'./explore.page.html',styleUrl:'./explore.page.scss'})
export class ExplorePage extends PageBase implements OnInit,OnDestroy {
 readonly exploration=inject(ExplorationService);private source=inject(CatalogProgressService);
 readonly layout=inject(LayoutService);private artwork=inject(ExploreArtworkService);readonly artworkUrl=signal('');
 readonly showInfo=signal(false);readonly showFilters=signal(false);readonly showHelp=signal(false);
 readonly transition=signal<'left'|'right'|'down'|'up'|null>(null);readonly entering=signal(false);readonly undoAvailable=signal(false);private lastAction:{anime:Anime;record:any;favorite:boolean}|null=null;private actionLocked=false;
 readonly current=signal<Anime|null>(null);readonly busy=signal(false);readonly message=signal('');readonly saved=signal('');
 readonly drag=signal<{x:number;y:number}|null>(null);
 private gesture:{id:number;x:number;y:number;at:number;target:HTMLElement}|null=null;
 readonly swipeHint=computed(()=>{const d=this.drag();if(!d||Math.max(Math.abs(d.x),Math.abs(d.y))<35)return '';return Math.abs(d.x)>Math.abs(d.y)?(d.x>0?'Mi piace':'Non mi interessa'):(d.y<0?'Preferiti':'Salta');});
 swipeStart(event:PointerEvent){
  if(!event.isPrimary){this.cancelSwipe();return;}
  if(!['touch','pen'].includes(event.pointerType)||this.busy()||this.actionLocked||!this.current())return;
  const target=event.currentTarget as HTMLElement;
  this.gesture={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now(),target};
  target.setPointerCapture(event.pointerId);this.drag.set({x:0,y:0});
 }
 swipeMove(event:PointerEvent){const g=this.gesture;if(!g||g.id!==event.pointerId)return;this.drag.set({x:event.clientX-g.x,y:event.clientY-g.y});}
 swipeEnd(event:PointerEvent){
  const g=this.gesture;if(!g||g.id!==event.pointerId)return;
  const x=event.clientX-g.x,y=event.clientY-g.y,elapsed=performance.now()-g.at;
  this.cancelSwipe();
  // Require a deliberate, clearly directional gesture; taps/diagonals do nothing.
  const major=Math.max(Math.abs(x),Math.abs(y)),minor=Math.min(Math.abs(x),Math.abs(y));
  if(major<60||major<minor*1.3||elapsed>1800)return;
  if(Math.abs(x)>Math.abs(y))void this.react(x>0?'like':'dislike');
  else if(y<0)this.favorite();else void this.skip();
 }
 cancelSwipe(){const g=this.gesture;this.gesture=null;this.drag.set(null);if(g?.target.hasPointerCapture(g.id))g.target.releasePointerCapture(g.id);}
 readonly isFavorite=computed(()=>{const anime=this.current();return !!anime&&this.storage.isFavorite(anime);});
 readonly plot=computed(()=>String(this.current()?.plot||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
 private pool:Anime[]=[];private destroyed=false;private hasMore=true;private offset=0;private deckSeen=new Set<string>();
 private pendingBatch:Promise<void>|null=null;private deckGeneration=0;
 private activeFilters:CatalogFilters={...{watch:'never',explored:'never'},...(this.nav.route().filters||{}),order:'random',randomSeed:Math.floor(Math.random()*4294967296)};
 activeFilterChips(){
  const f=this.activeFilters,chips:string[]=[];
  if(typeof f.title==='string'&&f.title.trim())chips.push('Ricerca: '+f.title.trim());
  if(f.watch==='never')chips.push('Mai visti');else if(f.watch==='unwatched')chips.push('Con episodi da vedere');
  const explored:Record<string,string>={seen:'Già esplorati',like:'Mi piace',dislike:'Non mi interessa',never:'Mai esplorati'};
  if(f.explored&&explored[f.explored])chips.push(explored[f.explored]);
  if(f.dubbed===0)chips.push('SUB ITA');else if(f.dubbed===1||f.dubbed===true)chips.push('DUB ITA');
  if(f.type)chips.push('Tipo: '+(f.type==='Movie'?'Film':f.type));
  if(f.status)chips.push('Stato: '+f.status);
  if(f.year)chips.push('Anno: '+f.year);
  if(f.season)chips.push('Stagione: '+f.season);
  if(f.minScore)chips.push('Voto minimo: '+String(f.minScore).replace('.',',')+'+');
  if(f.genres)for(const id of f.genres)chips.push('Genere: '+(this.catalog.genres().find(g=>g.id===id)?.name||id));
  if(f.excludedGenres)for(const id of f.excludedGenres)chips.push('Senza: '+(this.catalog.genres().find(g=>g.id===id)?.name||id));
  return chips;
 }
 ngOnInit(){if(this.storage.settings()['exploreEnabled']===false){this.nav.replace('catalog');return;}window.scrollTo(0,0);document.querySelector<HTMLElement>('.workspace')?.scrollTo(0,0);document.getElementById('view')?.scrollTo(0,0);this.remote.setExploreHandler(event=>{
  const key=remoteKey(event);
  if(['Back','Escape','Backspace','BrowserBack'].includes(key)&&!document.querySelector('[data-tv-dialog]')){if(!event.repeat)this.exploreBack();return true;}
  if(!document.activeElement?.matches('[data-explore-card]'))return false;
  if(event.repeat&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key))return true;
  if(key==='ArrowLeft'){void this.react('dislike');return true;}if(key==='ArrowRight'){void this.react('like');return true;}if(key==='ArrowUp'){this.favorite();return true;}if(key==='ArrowDown'){void this.skip();return true;}if(key==='Enter'&&this.current()){this.openAnime(this.current()!);return true;}return false;
 });void this.next();}
 exploreBack(){this.nav.back();}

 ngOnDestroy(){this.cancelSwipe();this.destroyed=true;this.remote.setExploreHandler(null);}
 async next(){
  if(this.busy())return;this.busy.set(true);this.message.set('Cerco il prossimo anime…');
  try{
   let candidate:Anime|undefined;
   for(let attempts=0;attempts<4&&!candidate;attempts++){
    while(this.pool.length&&!candidate){const anime=this.pool.shift()!;if(!this.deckSeen.has(this.exploration.key(anime))&&this.exploration.matches(anime,this.activeFilters.explored))candidate=anime;}
    if(candidate||!this.hasMore)break;
    await this.fillPool();if(this.destroyed)return;
   }
   while(!candidate&&this.pool.length){const anime=this.pool.shift()!;if(!this.deckSeen.has(this.exploration.key(anime))&&this.exploration.matches(anime,this.activeFilters.explored))candidate=anime;}
   if(this.destroyed)return;
   if(candidate){this.deckSeen.add(this.exploration.key(candidate));this.exploration.mark(candidate);this.current.set(candidate);this.artworkUrl.set(this.artwork.get(candidate));this.showInfo.set(false);this.message.set('');if(this.pool.length<=6&&this.hasMore)void this.fillPool().catch(()=>{});setTimeout(()=>{if(!this.destroyed&&!this.layout.mobile())this.remote.focus(document.querySelector<HTMLElement>('[data-explore-card]'));});}
   else {this.current.set(null);this.message.set(this.hasMore?'Non ho ancora trovato un titolo con questi filtri. Premi Continua ricerca.':'Hai terminato gli anime disponibili con questi filtri. Puoi rivedere quelli già esplorati.');}
  }catch(error){if(!this.destroyed)this.message.set(error instanceof Error?error.message:'Esplorazione non disponibile.');}
  finally{if(!this.destroyed)this.busy.set(false);}
 }
 private fillPool():Promise<void>{
  if(this.pendingBatch)return this.pendingBatch;
  if(!this.hasMore)return Promise.resolve();
  const generation=this.deckGeneration,offset=this.activeFilters.explored==='never'?0:this.offset;
  const pending=this.source.page(this.activeFilters,offset).then(batch=>{
   if(this.destroyed||generation!==this.deckGeneration)return;
   const known=new Set(this.pool.map(anime=>this.exploration.key(anime)));
   for(const anime of batch.records){const key=this.exploration.key(anime);if(!known.has(key)&&!this.deckSeen.has(key)){known.add(key);this.pool.push(anime);}}
   this.hasMore=batch.hasMore;if(this.activeFilters.explored!=='never')this.offset+=batch.records.length;
   void this.loadArtwork(batch.records);
  }).finally(()=>{if(this.pendingBatch===pending)this.pendingBatch=null;});
  this.pendingBatch=pending;return pending;
 }
 private remember(anime:Anime){this.lastAction={anime,record:this.exploration.get(anime),favorite:this.storage.isFavorite(anime)};this.undoAvailable.set(true);}
 private async animate(direction:'left'|'right'|'down'|'up'){this.actionLocked=true;this.entering.set(false);this.transition.set(direction);await new Promise(resolve=>setTimeout(resolve,window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:520));this.transition.set(null);if(this.destroyed)return;await this.next();this.entering.set(true);setTimeout(()=>this.entering.set(false),300);this.actionLocked=false;}
 async react(feedback:'like'|'dislike'){const anime=this.current();if(!anime||this.busy()||this.actionLocked)return;try{this.remember(anime);this.exploration.mark(anime,feedback);this.saved.set((feedback==='like'?'Mi piace salvato: ':'Non mi interessa salvato: ')+this.viewTitle(anime));await this.animate(feedback==='like'?'right':'left');}catch(error){this.actionLocked=false;this.message.set(error instanceof Error?error.message:'Scelta non salvata.');}}
 async skip(){const anime=this.current();if(!anime||this.busy()||this.actionLocked)return;this.remember(anime);this.saved.set('Saltato: '+this.viewTitle(anime));await this.animate('down');}
 async favorite(){const anime=this.current();if(!anime||this.busy()||this.actionLocked)return;try{this.remember(anime);this.storage.toggleFavorite(anime);this.saved.set((this.isFavorite()?'Aggiunto ai preferiti: ':'Rimosso dai preferiti: ')+this.viewTitle(anime));await this.animate('up');}catch(error){this.actionLocked=false;this.message.set(error instanceof Error?error.message:'Impossibile aggiornare i preferiti.');}}
 undo(){const action=this.lastAction;if(!action||this.busy()||this.actionLocked)return;try{this.exploration.restore(action.anime,action.record);if(this.storage.isFavorite(action.anime)!==action.favorite)this.storage.toggleFavorite(action.anime);this.current.set(action.anime);this.artworkUrl.set(this.artwork.get(action.anime));this.saved.set('Scelta annullata: '+this.viewTitle(action.anime));this.undoAvailable.set(false);this.lastAction=null;this.entering.set(true);setTimeout(()=>{this.entering.set(false);if(!this.destroyed&&!this.layout.mobile())this.remote.focus(document.querySelector<HTMLElement>('[data-explore-card]'));},300);}catch(error){this.message.set(error instanceof Error?error.message:'Impossibile annullare.');}}
 resetCurrent(){const anime=this.current();if(!anime||this.busy()||this.actionLocked)return;try{this.remember(anime);this.exploration.resetFeedback(anime);this.saved.set('Preferenza eliminata: '+this.viewTitle(anime));}catch(error){this.message.set(error instanceof Error?error.message:'Impossibile eliminare.');}}
 restart(){this.deckGeneration++;this.pendingBatch=null;this.activeFilters={...this.activeFilters,explored:'all',randomSeed:Math.floor(Math.random()*4294967296)};this.pool=[];this.offset=0;this.deckSeen.clear();this.hasMore=true;void this.next();}
 private async loadArtwork(records:Anime[]){await this.artwork.prefetch(records);const anime=this.current();if(!this.destroyed&&anime){const url=this.artwork.get(anime);if(url)this.artworkUrl.set(url);}}
 fallback(event:Event){const image=event.target as HTMLImageElement;const anime=this.current();const original=anime?.imageurl||anime?.imageurl_cover||'assets/images/aniplayer-icon-512.png';if(this.artworkUrl()&&image.src===this.artworkUrl()){this.artworkUrl.set('');image.src=original;}else if(!image.src.endsWith('aniplayer-icon-512.png'))image.src='assets/images/aniplayer-icon-512.png';}
}







