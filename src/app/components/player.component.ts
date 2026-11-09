import {AfterViewInit,Component,ElementRef,ViewChild,inject} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {AnimeLoaderComponent} from './anime-loader.component';
import {PlaybackService} from '../core/playback.service';
import {RemoteService} from '../core/remote.service';
@Component({selector:'app-player',standalone:true,imports:[CommonModule,FormsModule,AnimeLoaderComponent],templateUrl:'./player.component.html'})
export class PlayerComponent implements AfterViewInit {
 readonly p=inject(PlaybackService);readonly remote=inject(RemoteService);
 @ViewChild('skipIntroButton')set skipButton(button:ElementRef<HTMLButtonElement>|undefined){if(button)queueMicrotask(()=>{if(button.nativeElement.isConnected&&!this.p.selectMenu()&&this.p.scrub()===null)this.remote.focus(button.nativeElement);});}
 @ViewChild('nextEpisodeButton')set nextButton(button:ElementRef<HTMLButtonElement>|undefined){if(button)queueMicrotask(()=>{if(button.nativeElement.isConnected&&this.p.showNextEpisode&&!this.p.selectMenu()&&this.p.scrub()===null)this.remote.focus(button.nativeElement);});}
 @ViewChild('htmlVideo')video!:ElementRef<HTMLVideoElement>;
 @ViewChild('avObject')object!:ElementRef<HTMLElement>;
 introStart=0;introEnd=0;
 ngAfterViewInit(){this.p.attach(this.video.nativeElement,this.object.nativeElement);}
 clock(seconds:number){const x=Math.max(0,Math.floor(seconds||0));return (x>=3600?Math.floor(x/3600)+':':'')+String(Math.floor(x/60)%60).padStart(2,'0')+':'+String(x%60).padStart(2,'0');}
 timeline(event:Event){const el=event.currentTarget as HTMLElement,rect=el.getBoundingClientRect();this.p.seekTo(this.p.state().duration*Math.max(0,Math.min(1,((event as MouseEvent).clientX-rect.left)/rect.width)));}
 onKey(event:KeyboardEvent){if(event.key==='Enter'){event.preventDefault();this.p.showControls();}}
 editIntro(){this.introStart=this.p.intro()?.start||0;this.introEnd=this.p.intro()?.end||90;this.p.selectMenu.set('intro');this.p.showControls();}
 saveIntro(){try{this.p.saveIntro(Number(this.introStart),Number(this.introEnd));this.p.selectMenu.set(null);}catch(e){alert((e as Error).message);}}
}
