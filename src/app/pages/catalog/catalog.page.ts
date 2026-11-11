import {LoadingDotsComponent} from '../../components/loading-dots.component';
import {AnimeLoaderComponent} from '../../components/anime-loader.component';
﻿import {Component,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PageBase} from '../../core/page-base';
import {CatalogFilters} from '../../core/models';
import {AnimeCardComponent} from '../../components/anime-card.component';
import {FormsModule} from '@angular/forms';
@Component({selector:'app-catalog-page',standalone:true,imports:[LoadingDotsComponent,AnimeLoaderComponent,CommonModule,AnimeCardComponent,FormsModule],templateUrl:'./catalog.page.html',styleUrl:'./catalog.page.scss'})
export class CatalogPage extends PageBase {
  readonly expanded=signal<string|null>(null);
  readonly groups:{key:keyof CatalogFilters;label:string;options:{value:string|number|false;label:string}[]}[]=[
    {key:'watch',label:'Visti',options:[{value:'all',label:'Tutti'},{value:'never',label:'Mai visti'},{value:'unwatched',label:'Con episodi da vedere'}]},
    {key:'explored',label:'Esplorati',options:[{value:'all',label:'Tutti'},{value:'seen',label:'Già esplorati'},{value:'like',label:'👍 Mi piace'},{value:'dislike',label:'👎 Non mi interessa'},{value:'never',label:'Mai esplorati'}]},
    {key:'dubbed',label:'Audio',options:[{value:false,label:'Tutti'},{value:0,label:'SUB ITA'},{value:1,label:'DUB ITA'}]},
    {key:'type',label:'Tipo',options:[{value:false,label:'Tutti'},{value:'TV',label:'TV'},{value:'TV Short',label:'TV brevi'},{value:'Movie',label:'Film'},{value:'OVA',label:'OVA'},{value:'ONA',label:'ONA'},{value:'Special',label:'Special'}]},
    {key:'status',label:'Stato',options:[{value:false,label:'Tutti'},{value:'Terminato',label:'Conclusi'},{value:'In Corso',label:'In corso'},{value:'In Uscita',label:'In uscita'},{value:'Droppato',label:'Interrotti'}]},
    {key:'order',label:'Ordine',options:[{value:false,label:'Predefinito'},{value:'release_desc',label:'Uscita · Più recenti'},{value:'release_asc',label:'Uscita · Più antichi'},{value:'random',label:'Casuale'},{value:'Lista A-Z',label:'Titolo A–Z'},{value:'Lista Z-A',label:'Titolo Z–A'},{value:'Popolarità',label:'Più visti'},{value:'Valutazione',label:'Valutazione'}]}
  ];
  filterLabel(key:keyof CatalogFilters){return this.groups.find(g=>g.key===key)?.options.find(o=>o.value===(this.filters()[key]??false))?.label||'Tutti';}
  togglePanel(key:string){this.expanded.update(x=>x===key?null:key);if(this.expanded())setTimeout(()=>this.remote.first(document.getElementById('filter-options')||undefined));}
  closePanel(){const key=this.expanded();this.expanded.set(null);setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>(`[data-focus="filter-${key==='dubbed'?'audio':key}"]`)));}
  selectedGenres(){return this.filters().genres||[];}
  toggleGenre(id:number){const selected=this.selectedGenres();this.setFilter('genres',selected.includes(id)?selected.filter(x=>x!==id):[...selected,id]);}
  refreshCatalog(){if(this.filters().order==='random')this.filters.update(x=>({...x,randomSeed:Math.floor(Math.random()*4294967296)}));this.expanded.set(null);this.page.set(0);this.vm.catalogFocusHint='results';this.nav.replace('catalog');}
  openExplore(){this.nav.open('explore',{filters:{...this.filters(),title:this.searchText()||false}});}
  setFilter(key:keyof CatalogFilters,value:unknown){this.filters.update(x=>({...x,[key]:value}));}
  resetFilters(){this.filters.set({});this.searchText.set('');this.refreshCatalog();}
  catalogPage(value:number){if(value>this.page()&&this.cards().length<30&&this.catalogHasMore()&&!this.catalogTotalExact())value=this.page();this.page.set(value);this.vm.catalogFocusHint='results';this.nav.replace('catalog');}
}

