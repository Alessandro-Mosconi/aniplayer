import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PageBase} from '../../core/page-base';
import {AnimeCardComponent} from '../../components/anime-card.component';
@Component({selector:'app-related-page',standalone:true,imports:[CommonModule,AnimeCardComponent],templateUrl:'./related.page.html',styleUrl:'./related.page.scss'})
export class RelatedPage extends PageBase {}
