import {DetailCharacters,fetchDetailCharacters} from '../../core/anilist-avatars';
import {ProfileAvatarDirective} from '../../components/profile-avatar.directive';
import {Component,inject,signal,effect,untracked,OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PageBase} from '../../core/page-base';
import {Anime,Detail,Episode,cleanError} from '../../core/models';
import {AnimeCardComponent} from '../../components/anime-card.component';
import {ExplorationService} from '../../core/exploration.service';
@Component({selector:'app-anime-detail-page',standalone:true,imports:[CommonModule,AnimeCardComponent,ProfileAvatarDirective],templateUrl:'./anime-detail.page.html',styleUrl:'./anime-detail.page.scss'})
export class AnimeDetailPage extends PageBase implements OnDestroy {
  readonly exploration=inject(ExplorationService);
  readonly adjacent=signal<{previous:Anime|null;next:Anime|null}>({previous:null,next:null});private adjacentRequest=0;private destroyed=false;
  constructor(){super();effect(()=>{const detail=this.details(),request=++this.adjacentRequest;untracked(()=>this.closeCharacterAvatars(false));this.historyStatus.set('');this.adjacent.set({previous:null,next:null});if(detail)void this.vm.nextSeasonService.adjacent(detail).then(result=>{if(!this.destroyed&&request===this.adjacentRequest)this.adjacent.set(result);}).catch(()=>{});});}
  ngOnDestroy(){this.closeCharacterAvatars(false);this.destroyed=true;this.adjacentRequest++;}
  readonly characterDialog=signal(false);readonly characterLoading=signal(false);readonly characterError=signal('');readonly characterData=signal<DetailCharacters|null>(null);readonly characterStatus=signal('');private characterRequest:AbortController|null=null;
  openCharacterAvatars(){this.characterData.set(null);this.characterError.set('');this.characterStatus.set('');this.characterDialog.set(true);setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-character-close]')));void this.loadCharacterAvatars();}
  closeCharacterAvatars(restore=true){this.characterRequest?.abort();this.characterRequest=null;this.characterLoading.set(false);const wasOpen=this.characterDialog();this.characterDialog.set(false);if(restore&&wasOpen)setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-focus="detail-avatars"]')));}
  async loadCharacterAvatars(){const detail=this.details();if(!detail||this.characterLoading())return;const previous=this.characterData();if(previous&&!previous.hasNext)return;const controller=new AbortController();this.characterRequest=controller;this.characterLoading.set(true);this.characterError.set('');const timer=setTimeout(()=>controller.abort(),15000);try{const anime=detail.anime;const result=await fetchDetailCharacters({id:Number(anime.anilist_id)||undefined,malId:Number(anime.mal_id)||undefined,title:anime.title_original||anime.title_eng||anime.title||anime.title_it||''},previous,controller.signal);if(this.characterRequest===controller)this.characterData.set(result);}catch(error){if(this.characterRequest===controller)this.characterError.set(error instanceof Error&&error.name!=='AbortError'?error.message:'Richiesta scaduta. Riprova.');}finally{clearTimeout(timer);if(this.characterRequest===controller){this.characterRequest=null;this.characterLoading.set(false);}}}
  chooseCharacterAvatar(item:{image:string;name:string;anime:string}){try{const profile=this.storage.currentProfile();this.storage.saveProfile(profile.name,item.image,profile.id,{name:item.name,anime:item.anime});this.characterStatus.set('Immagine del profilo aggiornata.');this.closeCharacterAvatars();}catch(error){this.characterError.set(cleanError(error));}}
  readonly discoveryStatus=signal('');
  readonly historyStatus=signal('');
  readonly actionHint=signal('');
  actionFocused(event:FocusEvent){const button=(event.target as HTMLElement)?.closest('button');this.actionHint.set(button?.getAttribute('data-hint')||'');}
  inHistory(anime:Anime){return Object.values(this.storage.history()).some(row=>String(row.anime.id)===String(anime.id)||Number(anime.mal_id)>0&&Number(row.anime.mal_id)===Number(anime.mal_id));}
  inContinue(anime:Anime){return this.vm.continueWatching().some(row=>String(row.anime.id)===String(anime.id)||Number(anime.mal_id)>0&&Number(row.anime.mal_id)===Number(anime.mal_id));}
  removeFromContinue(anime:Anime){try{this.storage.hideFromContinue(anime);this.historyStatus.set('Rimosso da Continua a guardare. La cronologia resta salvata.');setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-focus="detail-fav"]')));}catch(error){this.historyStatus.set(cleanError(error));}}
  removeFromHistory(anime:Anime){try{this.storage.removeFromHistory(anime);this.historyStatus.set('Rimosso dalla cronologia. Gli episodi visti restano salvati.');setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-focus="detail-fav"]')));}catch(error){this.historyStatus.set(cleanError(error));}}
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
  resumeEpisode(detail:Detail){const h=this.storage.history()[String(detail.anime.id)];return h&&!h.completed&&h.position>0&&h.duration>5&&h.position<h.duration-5&&this.storage.settings()['historyEnabled']!==false&&this.storage.settings()['resume']!==false?detail.episodes.find(e=>String(e.number)===String(h.episode.number)&&e.public!==0)||null:null;}
  async playResume(){const detail=this.details();if(!detail)return;const h=this.storage.history()[String(detail.anime.id)];const ep=this.storage.settings()['historyEnabled']!==false&&h&&!h.completed?detail.episodes.find(e=>String(e.number)===String(h.episode.number)&&e.public!==0):null;await this.play(ep||detail.episodes[0]);}
  async play(episode:Episode){const detail=this.details();if(!detail?.anime.awSlug){this.error.set('Non è disponibile una sorgente AnimeWorld verificata.');return;}
    this.remote.remember();await this.playback.open(detail,episode,{versions:this.audioOptions()});setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-focus="player-skip-segment"]')||document.getElementById('p-close')||undefined),120);
  }
  toggle(anime:Anime){this.storage.toggleFavorite(anime);if(document.activeElement?.getAttribute('data-focus')==='detail-fav')this.actionHint.set(this.storage.isFavorite(anime)?'Rimuovi questo anime dai preferiti':'Aggiungi questo anime ai preferiti');}
  mark(anime:Anime,ep:Episode){if(this.marking())return;this.markFocus=document.activeElement as HTMLElement;if(this.lib.isSeen(anime,ep)){if(!this.mal.connected){void this.applyMark(anime,ep,false);return;}this.unwatch.set({anime,episode:ep,remote:Number(anime.mal_id)>0&&Number.isInteger(Number(ep.number))});setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-dialog-cancel]')));return;}void this.applyMark(anime,ep,true);}
  cancelUnwatch(){this.unwatch.set(null);setTimeout(()=>this.remote.focus(this.markFocus));}
  confirmUnwatch(){const choice=this.unwatch();if(!choice)return;this.unwatch.set(null);void this.applyMark(choice.anime,choice.episode,false);}
  private async applyMark(anime:Anime,episode:Episode,value:boolean){this.marking.set(true);this.markStatus.set(this.mal.connected?'Aggiornamento MAL in corso…':'Aggiornamento dei visti…');this.error.set('');try{await this.lib.mark(anime,episode,value,this.details()?.episodes||[]);this.markStatus.set(this.mal.connected?'MAL e AniPlayer aggiornati.':'Visti locali aggiornati.');}catch(error){this.markStatus.set(cleanError(error));}finally{this.marking.set(false);setTimeout(()=>this.remote.focus(this.markFocus));}}
}
