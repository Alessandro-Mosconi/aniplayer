import {Component,OnInit,OnDestroy,computed,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PageBase} from '../../core/page-base';
import {Anime,CatalogFilters} from '../../core/models';
import {CatalogProgressService} from '../../core/catalog-progress.service';
import {ExplorationService} from '../../core/exploration.service';
import {remoteKey} from '../../core/remote.service';
@Component({selector:'app-explore-page',standalone:true,imports:[CommonModule],templateUrl:'./explore.page.html',styleUrl:'./explore.page.scss'})
export class ExplorePage extends PageBase implements OnInit,OnDestroy {
 readonly exploration=inject(ExplorationService);private source=inject(CatalogProgressService);
 readonly transition=signal<'left'|'right'|'down'|null>(null);readonly favoritePulse=signal(false);readonly entering=signal(false);readonly undoAvailable=signal(false);private lastAction:{anime:Anime;record:any;favorite:boolean}|null=null;private actionLocked=false;
 readonly current=signal<Anime|null>(null);readonly busy=signal(false);readonly message=signal('');readonly saved=signal('');
 readonly isFavorite=computed(()=>{const anime=this.current();return !!anime&&this.storage.isFavorite(anime);});
 readonly plot=computed(()=>String(this.current()?.plot||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
 private pool:Anime[]=[];private destroyed=false;private hasMore=true;private offset=0;private deckSeen=new Set<string>();private menuRequested=false;
 private activeFilters:CatalogFilters={...{watch:'never',explored:'never'},...(this.nav.route().filters||{}),order:'random',randomSeed:Math.floor(Math.random()*4294967296)};
 activeFilterChips(){
  const f=this.activeFilters,chips:string[]=[];
  if(f.title?.trim())chips.push('Ricerca: '+f.title.trim());
  if(f.watch==='never')chips.push('Mai visti');else if(f.watch==='unwatched')chips.push('Con episodi da vedere');
  const explored:Record<string,string>={seen:'Gi? esplorati',like:'Mi piace',dislike:'Non mi interessa',never:'Mai esplorati'};
  if(f.explored&&explored[f.explored])chips.push(explored[f.explored]);
  if(f.dubbed===0)chips.push('SUB ITA');else if(f.dubbed===1||f.dubbed===true)chips.push('DUB ITA');
  if(f.type)chips.push('Tipo: '+(f.type==='Movie'?'Film':f.type));
  if(f.status)chips.push('Stato: '+f.status);
  if(f.year)chips.push('Anno: '+f.year);
  if(f.season)chips.push('Stagione: '+f.season);
  if(f.genres)for(const id of f.genres)chips.push('Genere: '+(this.catalog.genres().find(g=>g.id===id)?.name||id));
  return chips;
 }
 ngOnInit(){if(this.storage.settings()['exploreEnabled']===false){this.nav.replace('catalog');return;}this.remote.setExploreHandler(event=>{
  const key=remoteKey(event);
  if(['Back','Escape','Backspace','BrowserBack'].includes(key)&&document.activeElement?.closest('app-explore-page')&&!document.querySelector('[data-tv-dialog]')){if(!event.repeat)this.focusMenu();return true;}
  if(!document.activeElement?.matches('[data-explore-card]'))return false;
  if(event.repeat&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key))return true;
  if(key==='ArrowLeft'){void this.react('dislike');return true;}if(key==='ArrowRight'){void this.react('like');return true;}if(key==='ArrowUp'){this.favorite();return true;}if(key==='ArrowDown'){void this.skip();return true;}if(key==='Enter'&&this.current()){this.openAnime(this.current()!);return true;}return false;
 });void this.next();}
 focusMenu(){this.menuRequested=true;this.remote.focus(document.querySelector<HTMLElement>('.sidebar nav button.active')||document.querySelector<HTMLElement>('.sidebar nav button'));}
 cardFocused(){this.menuRequested=false;}
 ngOnDestroy(){this.destroyed=true;this.remote.setExploreHandler(null);}
 async next(){
  if(this.busy())return;this.busy.set(true);this.message.set('Cerco il prossimo anime…');
  try{
   let candidate:Anime|undefined;
   for(let attempts=0;attempts<4&&!candidate;attempts++){
    while(this.pool.length&&!candidate){const anime=this.pool.shift()!;if(!this.deckSeen.has(this.exploration.key(anime))&&this.exploration.matches(anime,this.activeFilters.explored))candidate=anime;}
    if(candidate||!this.hasMore)break;
    const batch=await this.source.page(this.activeFilters,this.activeFilters.explored==='never'?0:this.offset);if(this.destroyed)return;this.pool=batch.records;this.hasMore=batch.hasMore;if(this.activeFilters.explored!=='never')this.offset+=batch.records.length;
   }
   while(!candidate&&this.pool.length){const anime=this.pool.shift()!;if(!this.deckSeen.has(this.exploration.key(anime))&&this.exploration.matches(anime,this.activeFilters.explored))candidate=anime;}
   if(this.destroyed)return;
   if(candidate){this.deckSeen.add(this.exploration.key(candidate));this.exploration.mark(candidate);this.current.set(candidate);this.message.set('');setTimeout(()=>{if(!this.destroyed&&!this.menuRequested)this.remote.focus(document.querySelector<HTMLElement>('[data-explore-card]'));});}
   else {this.current.set(null);this.message.set(this.hasMore?'Non ho ancora trovato un titolo con questi filtri. Premi Continua ricerca.':'Hai terminato gli anime disponibili con questi filtri. Puoi rivedere quelli già esplorati.');}
  }catch(error){if(!this.destroyed)this.message.set(error instanceof Error?error.message:'Esplorazione non disponibile.');}
  finally{if(!this.destroyed)this.busy.set(false);}
 }
 private remember(anime:Anime){this.lastAction={anime,record:this.exploration.get(anime),favorite:this.storage.isFavorite(anime)};this.undoAvailable.set(true);}
 private async animate(direction:'left'|'right'|'down'){this.actionLocked=true;this.transition.set(direction);await new Promise(resolve=>setTimeout(resolve,window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:280));this.transition.set(null);if(this.destroyed)return;await this.next();this.entering.set(true);setTimeout(()=>this.entering.set(false),300);this.actionLocked=false;}
 async react(feedback:'like'|'dislike'){const anime=this.current();if(!anime||this.busy()||this.actionLocked)return;try{this.remember(anime);this.exploration.mark(anime,feedback);this.saved.set((feedback==='like'?'Mi piace salvato: ':'Non mi interessa salvato: ')+this.viewTitle(anime));await this.animate(feedback==='like'?'right':'left');}catch(error){this.actionLocked=false;this.message.set(error instanceof Error?error.message:'Scelta non salvata.');}}
 async skip(){const anime=this.current();if(!anime||this.busy()||this.actionLocked)return;this.remember(anime);this.saved.set('Saltato: '+this.viewTitle(anime));await this.animate('down');}
 favorite(){const anime=this.current();if(!anime||this.busy()||this.actionLocked)return;this.remember(anime);this.storage.toggleFavorite(anime);this.favoritePulse.set(false);setTimeout(()=>this.favoritePulse.set(true));setTimeout(()=>this.favoritePulse.set(false),500);this.saved.set((this.isFavorite()?'Aggiunto ai preferiti: ':'Rimosso dai preferiti: ')+this.viewTitle(anime));}
 undo(){const action=this.lastAction;if(!action||this.busy()||this.actionLocked)return;try{this.exploration.restore(action.anime,action.record);if(this.storage.isFavorite(action.anime)!==action.favorite)this.storage.toggleFavorite(action.anime);this.current.set(action.anime);this.saved.set('Scelta annullata: '+this.viewTitle(action.anime));this.undoAvailable.set(false);this.lastAction=null;this.entering.set(true);setTimeout(()=>{this.entering.set(false);if(!this.destroyed&&!this.menuRequested)this.remote.focus(document.querySelector<HTMLElement>('[data-explore-card]'));},300);}catch(error){this.message.set(error instanceof Error?error.message:'Impossibile annullare.');}}
 resetCurrent(){const anime=this.current();if(!anime||this.busy()||this.actionLocked)return;try{this.remember(anime);this.exploration.resetFeedback(anime);this.saved.set('Preferenza eliminata: '+this.viewTitle(anime));}catch(error){this.message.set(error instanceof Error?error.message:'Impossibile eliminare.');}}
 restart(){this.activeFilters={...this.activeFilters,explored:'all',randomSeed:Math.floor(Math.random()*4294967296)};this.pool=[];this.offset=0;this.deckSeen.clear();this.hasMore=true;void this.next();}
 fallback(event:Event){const image=event.target as HTMLImageElement;if(!image.src.endsWith('aniplayer-icon-512.png'))image.src='assets/images/aniplayer-icon-512.png';}
}

