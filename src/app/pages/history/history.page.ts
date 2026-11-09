import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PageBase} from '../../core/page-base';
import {AnimeCardComponent} from '../../components/anime-card.component';
@Component({selector:'app-history-page',standalone:true,imports:[CommonModule,AnimeCardComponent],templateUrl:'./history.page.html',styleUrl:'./history.page.scss'})
export class HistoryPage extends PageBase {}
