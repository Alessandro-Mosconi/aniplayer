import {Component,inject,signal,effect,OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PageBase} from '../../core/page-base';
import {Anime,Detail,Episode,cleanError} from '../../core/models';
import {AnimeCardComponent} from '../../components/anime-card.component';
import {ExplorationService} from '../../core/exploration.service';
@Component({selector:'app-anime-detail-page',standalone:true,imports:[CommonModule,AnimeCardComponent],templateUrl:'./anime-detail.page.html',styleUrl:'./anime-detail.page.scss'})
export class AnimeDetailPage extends PageBase implements OnDestroy {
  readonly exploration=inject(ExplorationService);
  readonly adjacent=signal<{previous:Anime|null;next:Anime|null}>({previous:null,next:null});private adjacentRequest=0;private destroyed=false;
  constructor(){super();effect(()=>{const detail=this.details(),request=++this.adjacentRequest;this.historyStatus.set('');this.adjacent.set({previous:null,next:null});if(detail)void this.vm.nextSeasonService.adjacent(detail).then(result=>{if(!this.destroyed&&request===this.adjacentRequest)this.adjacent.set(result);}).catch(()=>{});});}
  ngOnDestroy(){this.destroyed=true;this.adjacentRequest++;}
  readonly discoveryStatus=signal('');
  readonly historyStatus=signal('');
  readonly actionHint=signal('');
  actionFocused(event:FocusEvent){const button=(event.target as HTMLElement)?.closest('button');this.actionHint.set(button?.getAttribute('data-hint')||'');}
  inHistory(anime:Anime){return Object.values(this.storage.history()).some(row=>String(row.anime.id)===String(anime.id)||Number(anime.mal_id)>0&&Number(row.anime.mal_id)===Number(anime.mal_id));}
  removeFromContinue(anime:Anime){try{this.storage.removeFromHistory(anime);this.historyStatus.set('Rimosso da Continua a guardare. Gli episodi visti restano salvati.');setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-focus="detail-fav"]')));}catch(error){this.historyStatus.set(cleanError(error));}}
  removeDiscovery(anime:Anime){
    try{
      this.exploration.restore(anime,undefined);
      this.discoveryStatus.set('Scelta eliminata. Questo anime torna tra i mai esplorati.');
      setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-focus="detail-fav"]')));
    }catch(error){this.discoveryStatus.set(cleanError(error));}
  }
  readonly unwatch=signal<{anime:Anime;episode:Episode;remote:boolean}|null>(null);readonly marking=signal(false);readonly markStatus=signal('');private markFocus:HTMLElement|null=null;
  chooseAudio(detail:Detail){const current=this.details();if(!current||!detail.episodes.length)return;
    // A different audio source uses its own episodes and slug; keep the catalog metadata.
    this.details.set({...detail,anime:{...current.anime,...detail.anime},related:current.related});
    this.episodePage.set(0);this.sourceNotice.set('');
  }
  audioOptions(){const found=new Map<number,Detail>();for(const value of this.audioMatches()){if(value.episodes.length&&value.anime.awSlug)found.set(Number(value.anime.dub),value);}return [...found.values()].sort((a,b)=>Number(a.anime.dub)-Number(b.anime.dub));}
  episodes(){return this.details()?.episodes.slice(this.episodePage()*24,this.episodePage()*24+24)||[];}
  resumeEpisode(detail:Detail){const h=this.storage.history()[String(detail.anime.id)];return h&&!h.completed&&h.position>0&&h.duration>5&&h.position<h.duration-5&&this.storage.settings()['resume']!==false?detail.episodes.find(e=>String(e.number)===String(h.episode.number)&&e.public!==0)||null:null;}
  async playResume(){const detail=this.details();if(!detail)return;const h=this.storage.history()[String(detail.anime.id)];const ep=h&&!h.completed?detail.episodes.find(e=>String(e.number)===String(h.episode.number)):null;await this.play(ep||detail.episodes[0]);}
  async play(episode:Episode){const detail=this.details();if(!detail?.anime.awSlug){this.error.set('Non è disponibile una sorgente AnimeWorld verificata.');return;}
    this.remote.remember();await this.playback.open(detail,episode,{versions:this.audioOptions()});setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-focus="player-skip-segment"]')||document.getElementById('p-close')||undefined),120);
  }
  toggle(anime:Anime){this.storage.toggleFavorite(anime);if(document.activeElement?.getAttribute('data-focus')==='detail-fav')this.actionHint.set(this.storage.isFavorite(anime)?'Rimuovi questo anime dai preferiti':'Aggiungi questo anime ai preferiti');}
  mark(anime:Anime,ep:Episode){if(this.marking())return;this.markFocus=document.activeElement as HTMLElement;if(this.lib.isSeen(anime,ep)){if(!this.mal.connected){void this.applyMark(anime,ep,false);return;}this.unwatch.set({anime,episode:ep,remote:Number(anime.mal_id)>0&&Number.isInteger(Number(ep.number))});setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-dialog-cancel]')));return;}void this.applyMark(anime,ep,true);}
  cancelUnwatch(){this.unwatch.set(null);setTimeout(()=>this.remote.focus(this.markFocus));}
  confirmUnwatch(){const choice=this.unwatch();if(!choice)return;this.unwatch.set(null);void this.applyMark(choice.anime,choice.episode,false);}
  private async applyMark(anime:Anime,episode:Episode,value:boolean){this.marking.set(true);this.markStatus.set(this.mal.connected?'Aggiornamento MAL in corso…':'Aggiornamento dei visti…');this.error.set('');try{await this.lib.mark(anime,episode,value,this.details()?.episodes||[]);this.markStatus.set(this.mal.connected?'MAL e AniPlayer aggiornati.':'Visti locali aggiornati.');}catch(error){this.markStatus.set(cleanError(error));}finally{this.marking.set(false);setTimeout(()=>this.remote.focus(this.markFocus));}}
}
