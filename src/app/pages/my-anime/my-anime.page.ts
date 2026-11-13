import {LoadingDotsComponent} from '../../components/loading-dots.component';
import {AnimeLoaderComponent} from '../../components/anime-loader.component';
import {Component,OnInit,OnDestroy,computed,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {PageBase} from '../../core/page-base';
import {MalLibraryService} from '../../core/mal-library.service';
import {MalListFilters,MalRow,filterMalRows} from '../../core/mal-library';
import {ExplorationService} from '../../core/exploration.service';
@Component({selector:'app-my-anime-page',standalone:true,imports:[LoadingDotsComponent,AnimeLoaderComponent,CommonModule,FormsModule],templateUrl:'./my-anime.page.html',styleUrl:'./my-anime.page.scss'})
export class MyAnimePage extends PageBase implements OnInit,OnDestroy {
 readonly library=inject(MalLibraryService);readonly view=this.library.view;readonly listFilters=this.library.filters;readonly listPage=this.library.page;
 readonly exploration=inject(ExplorationService);
 readonly expanded=signal<string|null>(null);readonly opening=signal<number|null>(null);readonly notice=signal('');readonly selected=signal<MalRow|null>(null);
 readonly filtered=computed(()=>filterMalRows(this.library.rows(),this.listFilters()));
 readonly visible=computed(()=>this.filtered().slice(this.listPage()*30,this.listPage()*30+30));
 readonly allSeenIds=computed(()=>new Set(this.visible().filter(row=>this.vm.allAvailableEpisodesSeen({id:'mal:'+row.id,mal_id:row.id,episodes_count:row.total})).map(row=>row.id)));
 readonly favoriteMalIds=computed(()=>new Set(this.allFavorites().map(anime=>Number(anime.mal_id)).filter(id=>id>0)));
 readonly genres=computed(()=>[...new Set(this.library.rows().flatMap(r=>r.anime?.genres||[]))].sort((a,b)=>a.localeCompare(b)));
 readonly types=computed(()=>[...new Set(this.library.rows().map(r=>r.anime?.type).filter((x):x is string=>!!x))].sort());
 readonly statuses=[{value:'',label:'Tutti'},{value:'watching',label:'In corso'},{value:'completed',label:'Completati'},{value:'on_hold',label:'In pausa'},{value:'dropped',label:'Interrotti'},{value:'plan_to_watch',label:'Da iniziare'}];
 readonly watches=[{value:'all',label:'Tutti'},{value:'seen',label:'Con episodi visti'},{value:'never',label:'Mai visti'},{value:'remaining',label:'Con episodi da vedere'}];
 readonly orders=[{value:'title',label:'Titolo',icon:'Aa'},{value:'random',label:'Casuale',icon:'⤨'},{value:'release_desc',label:'Uscita anime',icon:'▣'},{value:'score',label:'Il mio voto',icon:'★'},{value:'remaining',label:'Episodi da vedere',icon:'▶'},{value:'updated',label:'Aggiornati su MAL',icon:'◷'}];
 readonly scores=[0,5,6,7,7.5,8,8.5,9,9.5];
 private destroyed=false;
 ngOnInit(){if(this.listPage()*30>=this.filtered().length)this.listPage.set(0);if(this.library.available()&&this.library.rows().some(r=>!r.anime?.title))void this.refreshList();}
 async refreshList(){await this.library.refresh();if(this.listPage()*30>=this.filtered().length)this.listPage.set(0);}
 ngOnDestroy(){this.destroyed=true;}
 statusLabel(status:string){return this.statuses.find(s=>s.value===status)?.label||status;}
 watchLabel(){return this.watches.find(s=>s.value===this.listFilters().watch)?.label||'Tutti';}
 orderLabel(){const aliases:Record<string,string>={title_desc:'title',release_asc:'release_desc',score_asc:'score',remaining_asc:'remaining',updated_asc:'updated'};const order=this.listFilters().order;return this.orders.find(s=>s.value===(aliases[order]||order))?.label||'Titolo';}
 orderSelected(value:string){return this.orderLabel()===this.orders.find(s=>s.value===value)?.label;}
 directionLabel(){switch(this.listFilters().order){case 'title':return 'A → Z';case 'title_desc':return 'Z → A';case 'release_desc':return 'Più recenti';case 'release_asc':return 'Più antichi';case 'score':case 'remaining':case 'updated':return 'Decrescente';case 'score_asc':case 'remaining_asc':case 'updated_asc':return 'Crescente';default:return '';}}
 toggleDirection(){const opposite:Record<string,string>={title:'title_desc',title_desc:'title',release_desc:'release_asc',release_asc:'release_desc',score:'score_asc',score_asc:'score',remaining:'remaining_asc',remaining_asc:'remaining',updated:'updated_asc',updated_asc:'updated'};const order=opposite[this.listFilters().order];if(order)this.setFilter('order',order);}
 selectOrder(value:string){if(value==='random')this.listFilters.update(f=>({...f,order:value,randomSeed:Math.floor(Math.random()*4294967296)}));else this.setFilter('order',value);this.listPage.set(0);}
 setFilter(key:keyof MalListFilters,value:any){this.listFilters.update(f=>({...f,[key]:value,...(key==='status'?{watch:'all'}:{})}));this.listPage.set(0);}
 genreState(name:string){return this.listFilters().genres.includes(name)?'include':(this.listFilters().excludedGenres||[]).includes(name)?'exclude':'neutral';}
 clearGenres(){this.listFilters.update(f=>({...f,genres:[],excludedGenres:[]}));this.listPage.set(0);}
 toggleGenre(name:string){const state=this.genreState(name),advanced=this.storage.settings()['excludeGenresEnabled']===true;this.listFilters.update(f=>({...f,genres:state==='neutral'?[...f.genres,name]:f.genres.filter(g=>g!==name),excludedGenres:state==='include'&&advanced?[...(f.excludedGenres||[]).filter(g=>g!==name),name]:(f.excludedGenres||[]).filter(g=>g!==name)}));this.listPage.set(0);}
 reset(){this.listFilters.set({query:'',status:'',type:'',genres:[],watch:'seen',order:'title'});this.listPage.set(0);}
 showStatus(status:string){this.reset();this.setFilter('status',status);this.view.set('list');}
 showGenre(name:string){this.reset();this.setFilter('genres',[name]);this.view.set('list');}
 showExplored(value:'seen'|'like'|'dislike'){this.filters.set({explored:value});this.searchText.set('');this.page.set(0);this.vm.catalogFocusHint='results';this.nav.open('catalog');}
 changeSource(source:'account'|'public'){this.library.preferred.set(source);this.reset();this.notice.set('');if(this.library.rows().some(r=>!r.anime?.title))void this.refreshList();}
 applySearch(){this.expanded.set(null);this.listPage.set(0);setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-my-card]')));}
 togglePanel(key:string){this.expanded.update(x=>x===key?null:key);if(this.expanded())setTimeout(()=>this.remote.first(document.getElementById('my-options')||undefined));}
 closePanel(){const key=this.expanded();this.expanded.set(null);setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>(`[data-focus="my-filter-${key}"]`)));}
 turnPage(delta:number){this.listPage.update(n=>Math.max(0,n+delta));setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-my-card]')));}
 fallback(event:Event){const img=event.target as HTMLImageElement;if(!img.src.endsWith('aniplayer-icon-512.png'))img.src='assets/images/aniplayer-icon-512.png';}
 async openRow(row:MalRow){
  if(this.opening())return;this.opening.set(row.id);this.notice.set('Cerco la serie nel catalogo…');this.selected.set(row);
  try{
   const saved=[...this.allFavorites(),...this.allHistory().map(h=>h.anime)].find(a=>Number(a.mal_id)===row.id&&(a.slug||a.awSlug));
   if(saved){this.openAnime(saved);return;}
   if(!row.anime?.title)throw Error('Titolo non disponibile: aggiorna prima la lista.');
   for(const title of [...new Set([row.title,...row.anime.aliases])].slice(0,3)){
    for(let offset=0;offset<90;offset+=30){const result=await this.catalog.catalog({title},offset);if(this.destroyed)return;const found=result.records.find(a=>Number(a.mal_id)===row.id);if(found){this.openAnime(found);return;}if(offset+result.records.length>=result.tot||!result.records.length)break;}
   }
   this.notice.set('Non ho trovato un abbinamento verificato. Puoi cercare il titolo nel catalogo.');
  }catch(error){if(!this.destroyed)this.notice.set(error instanceof Error?error.message:'Ricerca nel catalogo non riuscita.');}
  finally{if(!this.destroyed)this.opening.set(null);}
 }
 searchCatalog(){const row=this.selected();if(!row)return;this.searchText.set(row.anime?.title||row.title);this.filters.set({});this.page.set(0);this.vm.catalogFocusHint='results';this.nav.open('catalog');}
}
