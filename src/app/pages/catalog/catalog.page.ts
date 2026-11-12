import {LoadingDotsComponent} from '../../components/loading-dots.component';
import {LoadingSkeletonComponent} from '../../components/loading-skeleton.component';
﻿import {Component,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PageBase} from '../../core/page-base';
import {CatalogFilters} from '../../core/models';
import {AnimeCardComponent} from '../../components/anime-card.component';
import {FormsModule} from '@angular/forms';
@Component({selector:'app-catalog-page',standalone:true,imports:[LoadingDotsComponent,LoadingSkeletonComponent,CommonModule,AnimeCardComponent,FormsModule],templateUrl:'./catalog.page.html',styleUrl:'./catalog.page.scss'})
export class CatalogPage extends PageBase {
  readonly expanded=signal<string|null>(null);
  readonly filterIcons:Record<string,string>={watch:'◉',explored:'◈',dubbed:'♫',type:'▣',status:'◷',minScore:'★',genres:'▦'};
  readonly orderIcons:Record<string,string>={default:'☰',random:'⤨',episode_desc:'▶',release_desc:'▣','Lista A-Z':'Aa','Popolarità':'♥',Valutazione:'★'};
  orderIcon(value:string|number|false){return this.orderIcons[String(value||'default')]||'↕';}
  readonly groups:{key:keyof CatalogFilters;label:string;options:{value:string|number|false;label:string}[]}[]=[
    {key:'type',label:'Tipo',options:[{value:false,label:'Tutti'},{value:'TV',label:'TV'},{value:'TV Short',label:'TV brevi'},{value:'Movie',label:'Film'},{value:'OVA',label:'OVA'},{value:'ONA',label:'ONA'},{value:'Special',label:'Special'}]},
    {key:'status',label:'Stato',options:[{value:false,label:'Tutti'},{value:'Terminato',label:'Conclusi'},{value:'In Corso',label:'In corso'},{value:'In Uscita',label:'In uscita'},{value:'Droppato',label:'Interrotti'}]},
    {key:'minScore',label:'Voto minimo',options:[{value:false,label:'Tutti'},{value:5,label:'5+'},{value:6,label:'6+'},{value:7,label:'7+'},{value:7.5,label:'7,5+'},{value:8,label:'8+'},{value:8.5,label:'8,5+'},{value:9,label:'9+'},{value:9.5,label:'9,5+'}]},
    {key:'dubbed',label:'Lingua e sottotitoli',options:[{value:false,label:'Tutti'},{value:0,label:'SUB ITA'},{value:1,label:'DUB ITA'}]},
    {key:'watch',label:'Visti',options:[{value:'all',label:'Tutti'},{value:'never',label:'Mai visti'},{value:'unwatched',label:'Con episodi da vedere'}]},
    {key:'explored',label:'Esplorati',options:[{value:'all',label:'Tutti'},{value:'seen',label:'Già esplorati'},{value:'like',label:'👍 Mi piace'},{value:'dislike',label:'👎 Non mi interessa'},{value:'never',label:'Mai esplorati'}]},
    {key:'order',label:'Ordine',options:[{value:false,label:'Predefinito'},{value:'random',label:'Casuale'},{value:'release_desc',label:'Uscita anime'},{value:'Lista A-Z',label:'Titolo'},{value:'Popolarità',label:'Popolarità'},{value:'Valutazione',label:'Valutazione'} ]}
  ];
  filterLabel(key:keyof CatalogFilters){if(key==='order'){const order=this.filters().order;if(order==='release_asc')return 'Uscita anime';if(order==='Lista Z-A')return 'Titolo';if(order==='score_asc')return 'Valutazione';if(order==='popularity_asc')return 'Popolarità';}return this.groups.find(g=>g.key===key)?.options.find(o=>o.value===(this.filters()[key]??false))?.label||'Tutti';}
  directionLabel(){switch(this.filters().order){case 'Lista A-Z':return 'A → Z';case 'Lista Z-A':return 'Z → A';case 'release_desc':return 'Più recenti';case 'release_asc':return 'Più antichi';case 'Valutazione':case 'Popolarità':return 'Decrescente';case 'score_asc':case 'popularity_asc':return 'Crescente';default:return '';}}
  toggleDirection(){const opposite:Record<string,string>={'Lista A-Z':'Lista Z-A','Lista Z-A':'Lista A-Z',release_desc:'release_asc',release_asc:'release_desc',Valutazione:'score_asc',score_asc:'Valutazione','Popolarità':'popularity_asc',popularity_asc:'Popolarità'};const order=this.filters().order;if(order&&opposite[order])this.setFilter('order',opposite[order]);}
  optionSelected(key:keyof CatalogFilters,value:string|number|false){const current=this.filters()[key]??false;if(key==='order'){const canonical:Record<string,string>={release_asc:'release_desc','Lista Z-A':'Lista A-Z',score_asc:'Valutazione',popularity_asc:'Popolarità'};return (typeof current==='string'?(canonical[current]||current):current)===value;}return current===value;}  togglePanel(key:string){this.expanded.update(x=>x===key?null:key);if(this.expanded())setTimeout(()=>this.remote.first(document.getElementById('filter-options')||undefined));}
  closePanel(){const key=this.expanded();this.expanded.set(null);setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>(`[data-focus="filter-${key==='dubbed'?'audio':key}"]`)));}
  selectedGenres(){return this.filters().genres||[];}
  excludedGenres(){return this.filters().excludedGenres||[];}
  genreState(id:number){return this.selectedGenres().includes(id)?'include':this.excludedGenres().includes(id)?'exclude':'neutral';}
  clearGenres(){this.filters.update(f=>({...f,genres:[],excludedGenres:[]}));}
  toggleRecentEpisodes(){const order=this.filters().order;if(order==='episode_desc'){this.setFilter('order',this.vm.catalogPreviousOrder||false);}else{this.vm.catalogPreviousOrder=order||false;this.setFilter('order','episode_desc');}this.refreshCatalog();}
  toggleGenre(id:number){const state=this.genreState(id),advanced=this.storage.settings()['excludeGenresEnabled']===true;this.filters.update(f=>({...f,genres:state==='neutral'?[...this.selectedGenres(),id]:this.selectedGenres().filter(x=>x!==id),excludedGenres:state==='include'&&advanced?[...this.excludedGenres().filter(x=>x!==id),id]:this.excludedGenres().filter(x=>x!==id)}));}
  refreshCatalog(){if(this.filters().order==='random')this.filters.update(x=>({...x,randomSeed:Math.floor(Math.random()*4294967296)}));this.expanded.set(null);this.page.set(0);this.vm.catalogFocusHint='results';this.nav.replace('catalog');}
  openExplore(){this.nav.open('explore',{exploreOrigin:'catalog',filters:{...this.filters(),title:this.searchText()||''}});}
  setFilter(key:keyof CatalogFilters,value:unknown){this.filters.update(x=>({...x,[key]:value}));}
  resetFilters(){this.vm.catalogPreviousOrder=false;this.filters.set({});this.searchText.set('');this.refreshCatalog();}
  catalogPage(value:number){if(value>this.page()&&this.cards().length<30&&this.catalogHasMore()&&!this.catalogTotalExact())value=this.page();this.page.set(value);this.vm.catalogFocusHint='results';this.nav.replace('catalog');}
}








