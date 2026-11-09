import {SidebarService} from './core/sidebar.service';
import {LayoutService} from './core/layout.service';
import {Component,inject,effect,HostListener} from '@angular/core';
import {AppFacadeService} from './core/app-facade.service';
import {PlayerComponent} from './components/player.component';
import {AnimeLoaderComponent} from './components/anime-loader.component';
import {HomePage} from './pages/home/home.page';
import {CatalogPage} from './pages/catalog/catalog.page';
import {AnimeDetailPage} from './pages/anime-detail/anime-detail.page';
import {RelatedPage} from './pages/related/related.page';
import {FavoritesPage} from './pages/favorites/favorites.page';
import {HistoryPage} from './pages/history/history.page';
import {SettingsPage} from './pages/settings/settings.page';
import {MalPage} from './pages/mal/mal.page';
import {DiagnosticsPage} from './pages/diagnostics/diagnostics.page';
import {MyAnimePage} from './pages/my-anime/my-anime.page';
import {MalLibraryService} from './core/mal-library.service';
import {ExplorePage} from './pages/explore/explore.page';
@Component({selector:'app-root',standalone:true,imports:[PlayerComponent,AnimeLoaderComponent,HomePage,CatalogPage,AnimeDetailPage,RelatedPage,FavoritesPage,HistoryPage,SettingsPage,MalPage,DiagnosticsPage,MyAnimePage,ExplorePage],templateUrl:'./app.component.html'})
export class AppComponent {
  // A small shell: app state, layout and cross-page player are shared.
  readonly sidebar=inject(SidebarService);
  readonly layout=inject(LayoutService);
  readonly vm=inject(AppFacadeService);
  readonly malLibrary=inject(MalLibraryService);
  readonly nav=this.vm.nav;
  readonly catalog=this.vm.catalog;
  readonly animeworld=this.vm.animeworld;
  readonly playback=this.vm.playback;
  readonly loading=this.vm.loading;
  readonly error=this.vm.error;
  constructor(){effect(()=>{const route=this.nav.route();this.layout.menuOpen.set(false);});}
  openMobileMenu(){this.layout.menuOpen.set(true);setTimeout(()=>document.querySelector<HTMLElement>('[data-mobile-menu-close]')?.focus({preventScroll:true}));}
  closeMobileMenu(){this.layout.menuOpen.set(false);setTimeout(()=>document.querySelector<HTMLElement>('[data-mobile-menu-open]')?.focus({preventScroll:true}));}
  @HostListener('document:keydown',['$event'])
  trapMobileMenu(event:KeyboardEvent){
   if(event.key!=='Tab'||!this.layout.mobile()||!this.layout.menuOpen())return;
   const items=Array.from(document.querySelectorAll<HTMLButtonElement>('#main-navigation button:not(:disabled)'));
   const first=items[0],last=items[items.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
  go(name: Parameters<AppFacadeService['go']>[0]){this.layout.menuOpen.set(false);this.vm.go(name);}
}
