import {TvSwitchComponent} from '../../components/tv-switch.component';
import {SidebarService} from '../../core/sidebar.service';
import {LayoutService} from '../../core/layout.service';
import {RouteName} from '../../core/navigation.service';
import {Component,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PageBase} from '../../core/page-base';

import {FormsModule} from '@angular/forms';
import {MalPublicService} from '../../core/mal-public.service';
import {ExplorationService} from '../../core/exploration.service';
@Component({selector:'app-settings-page',standalone:true,imports:[TvSwitchComponent,CommonModule,FormsModule],templateUrl:'./settings.page.html',styleUrl:'./settings.page.scss'})
export class SettingsPage extends PageBase {
  readonly sidebar=inject(SidebarService);
  readonly layout=inject(LayoutService);
  moveMenu(id:RouteName,direction:-1|1){this.sidebar.move(id,direction);setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-menu-item="'+id+'"] button:not(:disabled)')));}
  readonly publicMal=inject(MalPublicService);
  readonly exploration=inject(ExplorationService);
  clearFeedback(kind:'like'|'dislike'){try{this.exploration.clearFeedback(kind);}catch(error){this.error.set(error instanceof Error?error.message:'Impossibile eliminare le preferenze.');}}
  clearExploration(){try{this.exploration.clear();}catch(error){this.error.set(error instanceof Error?error.message:'Impossibile eliminare le scelte.');}}
  openMal(mode:'public'|'account'){this.nav.open('mal',{filters:{malMode:mode}});}
  clearHistory(){
    if(!confirm('Cancellare cronologia, episodi visti e copertura locale?'))return;
    for(const key of ['history','seen','watchEvents','watchCoverage','seenResets'])this.storage.write(key,{});
    this.storage.history.set({});this.storage.seen.set({});this.storage.watchEvents.set({});this.storage.watchCoverage.set({});this.storage.seenResets.set({});
  }
}
