import {TvSwitchComponent} from '../../components/tv-switch.component';
import {SidebarService} from '../../core/sidebar.service';
import {LayoutService} from '../../core/layout.service';
import {RouteName} from '../../core/navigation.service';
import {Component,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PageBase} from '../../core/page-base';

import {FormsModule} from '@angular/forms';
import {MalPublicService} from '../../core/mal-public.service';
import {ExplorationService} from '../../core/exploration.service';
import {MalLibraryService} from '../../core/mal-library.service';
@Component({selector:'app-settings-page',standalone:true,imports:[TvSwitchComponent,CommonModule,FormsModule],templateUrl:'./settings.page.html',styleUrl:'./settings.page.scss'})
export class SettingsPage extends PageBase {
  readonly sidebar=inject(SidebarService);
  readonly layout=inject(LayoutService);
  readonly category=this.vm.settingsCategory;
  readonly categories=[{id:'general',label:'Generali'},{id:'catalog',label:'Catalogo'},{id:'badges',label:'Badge'},{id:'playback',label:'Riproduzione'},{id:'mal',label:'MyAnimeList'},{id:'data',label:'Dati e rete'}] as const;
  readonly badgeOptions=[{id:'newEpisodes',label:'Nuovi episodi (EP+)'},{id:'allSeen',label:'Tutti gli episodi visti'},{id:'favorites',label:'Preferiti'},{id:'audio',label:'Audio italiano (ITA)'},{id:'aniskip',label:'Disponibilità AniSkip'},{id:'malStatus',label:'Stato nella lista MAL'},{id:'menuUpdates',label:'Novità nel menu Preferiti'}] as const;
  selectCategory(id:'general'|'catalog'|'playback'|'mal'|'data'|'badges'){this.category.set(id);}
  openDiagnostics(focus:string){this.vm.settingsFocusHint=focus;this.nav.open('diagnostics');}
  readonly menuOrderNotice=signal('');
  moveMenu(id:RouteName,direction:-1|1){const before=this.sidebar.items().findIndex(item=>item.id===id);this.sidebar.move(id,direction);const after=this.sidebar.items().findIndex(item=>item.id===id);if(before===after)return;const item=this.sidebar.items()[after];this.menuOrderNotice.set(item.label+' spostato in posizione '+(after+1));setTimeout(()=>{const row=document.querySelector<HTMLElement>('[data-menu-item="'+id+'"]');const preferred=row?.querySelector<HTMLElement>('[data-menu-move="'+direction+'"]:not(:disabled)');const fallback=row?.querySelector<HTMLElement>('[data-menu-move="'+(direction===1?-1:1)+'"]:not(:disabled)');this.remote.focus(preferred||fallback);});}
  readonly publicMal=inject(MalPublicService);
  readonly exploration=inject(ExplorationService);
  setExploreEnabled(enabled:boolean){this.storage.setSetting('exploreEnabled',enabled);if(!enabled)this.filters.update(f=>({...f,explored:'all'}));}
  private readonly personalLibrary=inject(MalLibraryService);
  setExcludeGenres(enabled:boolean){this.storage.setSetting('excludeGenresEnabled',enabled);if(!enabled){this.filters.update(f=>({...f,excludedGenres:[]}));this.personalLibrary.filters.update(f=>({...f,excludedGenres:[]}));}}
  clearFeedback(kind:'like'|'dislike'){try{this.exploration.clearFeedback(kind);}catch(error){this.error.set(error instanceof Error?error.message:'Impossibile eliminare le preferenze.');}}
  clearExploration(){try{this.exploration.clear();}catch(error){this.error.set(error instanceof Error?error.message:'Impossibile eliminare le scelte.');}}
  openMal(mode:'public'|'account'){this.nav.open('mal',{filters:{malMode:mode}});}
  clearHistory(){
    if(!confirm('Cancellare cronologia, episodi visti e copertura locale?'))return;
    for(const key of ['history','seen','watchEvents','watchCoverage','seenResets'])this.storage.write(key,{});
    this.storage.history.set({});this.storage.seen.set({});this.storage.watchEvents.set({});this.storage.watchCoverage.set({});this.storage.seenResets.set({});
  }
}
