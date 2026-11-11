import {AfterViewInit,OnDestroy,Component,ElementRef,ViewChild,inject,computed,signal,afterRenderEffect} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {AnimeLoaderComponent} from './anime-loader.component';
import {PlaybackService} from '../core/playback.service';
import {RemoteService} from '../core/remote.service';
import {PipService} from '../core/pip.service';
import {ExtraSegment} from '../core/intro.service';
import {PlayerIconComponent} from './player-icon.component';
@Component({selector:'app-player',standalone:true,imports:[CommonModule,FormsModule,AnimeLoaderComponent,PlayerIconComponent],templateUrl:'./player.component.html'})
export class PlayerComponent implements AfterViewInit,OnDestroy {
 readonly p=inject(PlaybackService);readonly remote=inject(RemoteService);
 readonly pip=inject(PipService);
 readonly controlHint=signal('');
 readonly selectedInterval=signal<'opening'|'recap'|'ending'>('opening');
 readonly intervalInfo=computed(()=>{
  const key=this.selectedInterval(),labels={opening:'Sigla iniziale',recap:'Riassunto',ending:'Sigla finale'};
  const actual=key==='opening'?this.p.intro():key==='recap'?this.p.recap():this.p.ending(),proposal=this.p.skipProposals()[key];
  const diagnostic=key==='opening'?null:this.p.skipDetails()[key];
  const reference=diagnostic?.reference||proposal,interval=actual||proposal;
  const format=(v:{start:number;end:number}|null|undefined)=>v?this.clock(v.start)+'–'+this.clock(v.end):'--';
  const source=actual?.source;
  const state=diagnostic?.state==='conflict'?'Intervallo in conflitto':source==='local'?'Correzione manuale':source==='audio'||source==='fingerprint'?'Verificato con audio':actual?(diagnostic?.state==='aligned'?'AniSkip riallineato':'AniSkip compatibile'):proposal?'Proposta AniSkip':'Intervallo non disponibile';
  const analyzing=key==='ending'?this.p.endingAnalyzing():this.p.introAnalyzing();
  const reason=source==='audio'||source==='fingerprint'?'Questo intervallo è stato riconosciuto direttamente con il confronto audio.':source==='local'?'Viene usata la correzione salvata per questa versione.':diagnostic?.reason||(analyzing?'Analisi audio in corso; fino alla conferma viene proposto AniSkip.':proposal?'I tempi AniSkip non sono ancora confermati per questa versione del video.':'Il servizio non ha fornito un intervallo utilizzabile.');
  const offset=diagnostic?.offset;
  return {label:labels[key],state,reference:format(reference),current:diagnostic?.state==='conflict'?'Salto sospeso':format(interval),offset:offset===undefined?'--':(offset>=0?'+':'')+offset.toFixed(1)+' s',reason,progress:analyzing};
 });
 explainInterval(key:string){if(!['opening','recap','ending'].includes(key))return;this.selectedInterval.set(key as 'opening'|'recap'|'ending');this.p.selectMenu.set('intervals');this.p.showControls();setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-interval-close]')));}
 closeInterval(){const key=this.selectedInterval();this.p.selectMenu.set(null);setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-interval="'+key+'"]')));}
 controlFocused(event:FocusEvent){const button=(event.target as HTMLElement)?.closest('button');this.controlHint.set(button?.getAttribute('aria-label')||button?.getAttribute('title')||'');}
 readonly controlsHeight=signal(0);private controlsObserver:ResizeObserver|null=null;
 @ViewChild('playerControls')set controlsElement(element:ElementRef<HTMLElement>|undefined){
  this.controlsObserver?.disconnect();this.controlsHeight.set(0);
  if(element){const update=()=>this.controlsHeight.set(element.nativeElement.getBoundingClientRect().height);update();if(typeof ResizeObserver!=='undefined'){this.controlsObserver=new ResizeObserver(update);this.controlsObserver.observe(element.nativeElement);}}
 }
 ngOnDestroy(){this.controlsObserver?.disconnect();}
 readonly skipIndicators=computed(()=>{
  const proposals=this.p.skipProposals();
  return [
   {key:'recap',icon:'↺',label:'Riassunto',interval:this.p.recap(),proposal:proposals.recap,analyzing:this.p.skipLoading()||this.p.introAnalyzing(),detail:this.p.introStatus()},
   {key:'opening',icon:'♫↑',label:'Sigla iniziale',interval:this.p.intro(),proposal:proposals.opening,analyzing:this.p.skipLoading()||this.p.introAnalyzing(),detail:this.p.introStatus()},
   {key:'ending',icon:'♫↓',label:'Sigla finale',interval:this.p.ending(),proposal:proposals.ending,analyzing:this.p.skipLoading()||this.p.endingAnalyzing(),detail:this.p.endingStatus()}
  ].map(item=>{
   const interval=item.interval||item.proposal,provisional=!item.interval&&!!item.proposal;
   const source=interval?.source,mark=source==='audio'||source==='fingerprint'?'✓':source==='local'?'✎':interval?(provisional?'A?':'A'):'';
   const times=interval?this.clock(interval.start)+'–'+this.clock(interval.end):'--';
   const origin=provisional?'Proposta AniSkip, da allineare':source==='aniskip'?'AniSkip compatibile':source==='local'?'Correzione manuale':interval?'Verificato con audio':'Intervallo non disponibile';
   const conflict=item.key!=='opening'&&this.p.skipDetails()[item.key as 'recap'|'ending']?.state==='conflict';
   return {...item,interval,provisional,mark:conflict?'!':mark,times,title:item.label+': '+times+'. '+(conflict?'Intervallo in conflitto.':origin)+'. '+item.detail};
  });
 });
 @ViewChild('skipIntroButton')set skipButton(button:ElementRef<HTMLButtonElement>|undefined){if(button)queueMicrotask(()=>{if(button.nativeElement.isConnected&&!this.p.skipQuiet()&&!this.p.selectMenu()&&this.p.scrub()===null)this.remote.focus(button.nativeElement);});}
 private readonly skipActionFocus=computed(()=>{
  if(!this.p.skipUndoAvailable()||this.p.selectMenu()||this.p.scrub()!==null||this.p.state().buffering||this.p.state().error)return null;
  return this.p.skipPrompt?'player-skip-segment':this.p.showNextEpisode?'player-next-episode':'player-undo-skip';
 });
 private readonly focusSkipAction=afterRenderEffect(()=>{const target=this.skipActionFocus();if(target)this.remote.focus(document.querySelector<HTMLElement>('[data-focus="'+target+'"]'));});
 @ViewChild('nextEpisodeButton')set nextButton(button:ElementRef<HTMLButtonElement>|undefined){if(button)queueMicrotask(()=>{if(button.nativeElement.isConnected&&(!this.p.endingSkipped()||this.p.skipUndoAvailable())&&this.p.showNextEpisode&&!this.p.selectMenu()&&this.p.scrub()===null)this.remote.focus(button.nativeElement);});}
 @ViewChild('htmlVideo')video!:ElementRef<HTMLVideoElement>;
 @ViewChild('avObject')object!:ElementRef<HTMLElement>;
 introStart=0;introEnd=0;segmentKind:'opening'|ExtraSegment='opening';
 ngAfterViewInit(){this.p.attach(this.video.nativeElement,this.object.nativeElement);this.pip.attach(this.video.nativeElement);}
 async audioMenu(){if(this.p.selectMenu()==='language'){this.p.selectMenu.set(null);return;}await this.p.openAudioMenu();if(this.p.selectMenu()==='language')setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-audio-option]:not(:disabled)')||document.querySelector<HTMLElement>('[data-audio-close]')));}
 clock(seconds:number){const x=Math.max(0,Math.floor(seconds||0));return (x>=3600?Math.floor(x/3600)+':':'')+String(Math.floor(x/60)%60).padStart(2,'0')+':'+String(x%60).padStart(2,'0');}
 timeline(event:Event){const el=event.currentTarget as HTMLElement,rect=el.getBoundingClientRect();this.p.seekTo(this.p.state().duration*Math.max(0,Math.min(1,((event as MouseEvent).clientX-rect.left)/rect.width)));}
 onKey(event:KeyboardEvent){if(event.key==='Enter'){event.preventDefault();this.p.showControls();}}
 chooseSegment(kind:'opening'|ExtraSegment){this.segmentKind=kind;const window=kind==='opening'?this.p.intro():kind==='ending'?this.p.ending():kind==='recap'?this.p.recap():this.p.prologue();this.introStart=window?.start??this.p.state().position;this.introEnd=window?.end??Math.min(this.p.state().duration,this.introStart+90);}
 editIntro(){this.chooseSegment('opening');this.p.selectMenu.set('intro');this.p.showControls();}
 clearSegment(){if(this.segmentKind==='opening')this.p.clearIntro();else this.p.clearSegment(this.segmentKind);this.p.selectMenu.set(null);}
 saveIntro(){try{if(this.segmentKind==='opening')this.p.saveIntro(Number(this.introStart),Number(this.introEnd));else this.p.saveSegment(this.segmentKind,Number(this.introStart),Number(this.introEnd));this.p.selectMenu.set(null);}catch(e){alert((e as Error).message);}}
}
