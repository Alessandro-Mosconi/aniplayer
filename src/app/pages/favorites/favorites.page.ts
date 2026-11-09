import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PageBase} from '../../core/page-base';
import {AnimeCardComponent} from '../../components/anime-card.component';
@Component({selector:'app-favorites-page',standalone:true,imports:[CommonModule,AnimeCardComponent],templateUrl:'./favorites.page.html',styleUrl:'./favorites.page.scss'})
export class FavoritesPage extends PageBase {}
