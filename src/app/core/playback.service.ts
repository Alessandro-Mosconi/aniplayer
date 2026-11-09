import {WatchProgress} from './watch-progress';
import {Injectable, signal} from '@angular/core';
import {Anime,Episode,Detail,PlaybackState} from './models';
import {StorageService} from './storage.service';
import {AnimeWorldService} from './animeworld.service';
import {TizenService} from './tizen.service';
import {IntroService,IntroWindow,IntroContext} from './intro.service';
import {IntroDetectorService} from './intro-detector.service';
import {RemoteService} from './remote.service';
import {MalService} from './mal.service';
const initial:PlaybackState={playing:false,position:0,duration:0,opened:false,buffering:false,title:'',episode:0,error:''};
@Injectable({providedIn:'root'})
export class PlaybackService {
 onClosed:(()=>void)|null=null;
 private setTransparentVideoLayer(active:boolean){
  // Tizen AVPlay composita il video dietro il DOM Web: uno sfondo HTML opaco lo nasconde
  // anche quando AVPlay sta riproducendo correttamente l'audio e avanza la timeline.
  document.documentElement.classList.toggle('tv-video-active',active);
  document.body.classList.toggle('tv-video-active',active);
 }

 readonly state=signal<PlaybackState>({...initial});
 readonly controls=signal(true);readonly html5=signal(false);readonly scrub=signal<number|null>(null);readonly intro=signal<IntroWindow|null>(null);
 readonly ending=signal<IntroWindow|null>(null);private endingRequest=0;
 readonly selectMenu=signal<'quality'|'subtitles'|'intro'|null>(null);
 readonly introStatus=signal('');readonly aniSkipDuration=signal<number|null>(null);private introAbort:AbortController|null=null;
 readonly audioSources=signal<{label:string;url:string}[]>([]);
 readonly subtitles=signal<{label:string;index:number}[]>([]);
 private timer:any;private controlTimer:any;private generation=0;private engine:'avplay'|'html5'|null=null;
 private source='';private detail:Detail|null=null;private episode:Episode|null=null;private video:HTMLVideoElement|null=null;
 private object:HTMLElement|null=null;private av:any;private lastSave=0;private lastTick=0;private watchedSeconds=0;private wasPlaying=false;private finishedOnce=false;
 private tracker=new WatchProgress();private autoMarked=false;
 private originalPoster='';private playbackSegments:[number,number][]=[];
 constructor(private data:AnimeWorldService,private local:StorageService,private tv:TizenService,private introService:IntroService,private remote:RemoteService,private mal:MalService,private detector:IntroDetectorService){}
 attach(video:HTMLVideoElement|null,object:HTMLElement|null){if(video)this.video=video;if(object)this.object=object;}
 private patch(partial:Partial<PlaybackState>){this.state.update(s=>({...s,...partial}));}
 async open(detail:Detail,episode:Episode){this.close(false);const id=++this.generation;this.detail=detail;this.episode=episode;this.lastTick=0;this.watchedSeconds=0;this.finishedOnce=false;this.playbackSegments=[];this.lastSave=0;this.tracker=new WatchProgress(this.local.watchCoverage()?.[this.local.watchKey(detail.anime,episode)]);this.autoMarked=this.local.isSeen(detail.anime,episode);this.scrub.set(null);this.intro.set(null);this.ending.set(null);this.introStatus.set('');this.aniSkipDuration.set(null);this.selectMenu.set(null);
  this.setTransparentVideoLayer(true);this.patch({...initial,opened:true,title:detail.anime.title_eng||detail.anime.title||'Anime',episode:Number(episode.number),buffering:true});this.showControls();
  try{const url=await this.data.source(detail.anime,episode);if(this.generation!==id)return;this.source=url;this.audioSources.set([{label:'AnimeWorld · MP4',url}]);
   const saved=this.local.history()[String(detail.anime.id)];const resume=this.local.settings()['resume']!==false&&saved&&String(saved.episode.number)===String(episode.number)&&!saved.completed?saved.position:0;
   await this.prepare(url,resume,id);if(this.generation!==id)return;
   this.timer=setInterval(()=>this.save(),10000);
   if(this.state().duration>0)void this.loadIntro(id);
  }catch(e){if(id===this.generation)this.fail(e);}
 }
 private async prepare(url:string,resume:number,id:number){this.patch({buffering:true,error:''});
  const av=this.tv.getAvplay();const pref=this.local.settings()['engine']||'auto';
  if(pref==='avplay'&&!av)throw Error('AVPlay non è disponibile sul dispositivo.');
  this.engine=av&&pref!=='html5'?'avplay':'html5';this.html5.set(this.engine==='html5');
  if(this.engine==='avplay'){
   this.av=av;try{av.close();}catch{}
   av.open(url);av.setDisplayRect(0,0,1920,1080);av.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
   av.setListener({
    onbufferingstart:()=>{if(id===this.generation)this.patch({buffering:true});},
    onbufferingcomplete:()=>{if(id===this.generation)this.patch({buffering:false});},
    oncurrentplaytime:(ms:number)=>{if(id===this.generation)this.tick(ms/1000,Number(av.getDuration())/1000);},
    onstreamcompleted:()=>{if(id===this.generation)this.finished();},
    onerror:(reason:unknown)=>{if(id===this.generation)this.fail(reason);},
    onsubtitlechange:()=>{},onbufferingprogress:()=>{},ondrmevent:()=>{if(id===this.generation)this.fail('DRM non gestito');}
   });
   await new Promise<void>((resolve,reject)=>{let done=false;const timeout=setTimeout(()=>{if(!done){done=true;reject(Error('Timeout preparazione AVPlay'));}},20000);av.prepareAsync(()=>{if(!done){done=true;clearTimeout(timeout);resolve();}},(e:unknown)=>{if(!done){done=true;clearTimeout(timeout);reject(e);}});});
   if(id!==this.generation)return;
   const duration=Number(av.getDuration())/1000;this.patch({duration,buffering:false});
   if(resume>0&&resume<duration-5)await new Promise<void>(resolve=>{const timeout=setTimeout(resolve,3500);try{av.seekTo(Math.floor(resume*1000),()=>{clearTimeout(timeout);resolve();},()=>{clearTimeout(timeout);resolve();});}catch{clearTimeout(timeout);resolve();}});
   if(id!==this.generation)return;
   try{const tracks=av.getTotalTrackInfo()||[];this.subtitles.set(tracks.map((t:any,i:number)=>({...t,index:i})).filter((t:any)=>t.type==='TEXT').map((t:any)=>({label:String(t.extra_info||'Sottotitoli '+(t.index+1)),index:t.index})));}catch{}
   av.play();this.patch({playing:true,buffering:false});
  }else{
   const video=this.video;if(!video)throw Error('Elemento video non ancora disponibile');
   await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>{cleanup();reject(Error('Timeout caricamento HTML5'));},20000);const ok=()=>{cleanup();resolve();},err=()=>{cleanup();reject(Error('Formato video non compatibile'));};const cleanup=()=>{clearTimeout(timeout);video.removeEventListener('loadedmetadata',ok);video.removeEventListener('error',err);};video.addEventListener('loadedmetadata',ok);video.addEventListener('error',err);video.src=url;video.load();});
   if(id!==this.generation)return;
   if(resume>0&&resume<video.duration-5)video.currentTime=resume;
   this.patch({duration:video.duration,buffering:false});await video.play();this.patch({playing:true});
  }
 }
 onHtmlTime(){if(this.engine==='html5'&&this.video)this.tick(this.video.currentTime,this.video.duration);}
 onHtmlEnded(){if(this.engine==='html5')this.finished();}
 onHtmlWaiting(){if(this.engine==='html5')this.patch({buffering:true});}
 onHtmlPlaying(){if(this.engine==='html5')this.patch({buffering:false,playing:true});}
 private tick(position:number,duration:number){if(!Number.isFinite(position))return;const playing=this.state().playing;
  this.tracker.sample(position,duration,playing&&!this.state().buffering);const complete=this.tracker.complete(position,this.ending()?.start);this.playbackSegments=this.tracker.ranges as [number,number][];
  this.lastTick=position;this.patch({position,duration:Number.isFinite(duration)?duration:this.state().duration});
  if(complete&&!this.autoMarked)this.save(true);
  if(playing&&this.local.settings()['autonext']!==false&&duration>60&&position>=duration-2)this.finished();
  if(position-this.lastSave>=10)this.save();
 }
 get playbackProgress(){return this.state().duration?100*this.state().position/this.state().duration:0;}
 get nextEpisode(){if(!this.detail||!this.episode)return null;const number=Number(this.episode.number)+1;return this.detail.episodes.find(episode=>Number(episode.number)===number&&episode.public!==0)||null;}
 get showNextEpisode(){const s=this.state(),start=this.ending()?.start??s.duration-Math.min(180,s.duration*.1);return s.opened&&!s.error&&!s.buffering&&Number.isFinite(s.duration)&&s.duration>0&&s.position>=start&&s.position<s.duration&&!!this.nextEpisode;}
 private playedUnique(){const spans=[...this.playbackSegments].sort((a,b)=>a[0]-b[0]);let total=0,end=-1;for(const [from,to]of spans){total+=Math.max(0,to-Math.max(from,end));end=Math.max(end,to);}return total;}
 private finished(){const s=this.state();if(this.finishedOnce||!this.detail||!this.episode||!s.duration)return;this.finishedOnce=true;
  this.save(this.tracker.complete(s.position,this.ending()?.start));this.patch({playing:false});
  if(this.local.settings()['autonext']!==false){const nextNumber=Number(this.episode.number)+1;if(this.detail.episodes.some(e=>Number(e.number)===nextNumber))void this.next();}
 }
 private save(completed=false){if(!this.detail||!this.episode||!this.state().duration)return;const s=this.state();const eligible=completed||this.tracker.complete(s.position,this.ending()?.start);const coverage={...this.local.watchCoverage(),[this.local.watchKey(this.detail.anime,this.episode)]:this.tracker.snapshot()};const bounded=Object.fromEntries(Object.entries(coverage).sort((a,b)=>(b[1].updated||0)-(a[1].updated||0)).slice(0,200));this.local.watchCoverage.set(bounded);this.local.write('watchCoverage',bounded);this.local.progress(this.detail.anime,this.episode,s.position,s.duration,eligible||this.autoMarked);if(eligible&&!this.autoMarked){this.autoMarked=true;this.mal.queue(this.detail.anime,this.episode);}this.lastSave=s.position;}
 toggle(){this.tracker.interrupt();if(!this.state().opened)return;try{if(this.engine==='avplay'){const state=this.av.getState();if(state==='PLAYING'){this.av.pause();this.patch({playing:false});}else{this.av.play();this.patch({playing:true});}}else if(this.video){if(this.video.paused){this.video.play();this.patch({playing:true});}else{this.video.pause();this.patch({playing:false});}}}catch(e){this.fail(e);}this.showControls();}
 pause(){this.tracker.interrupt();try{if(this.engine==='avplay'&&this.av?.getState?.()==='PLAYING')this.av.pause();if(this.engine==='html5')this.video?.pause();}catch{}this.patch({playing:false});this.save();}
 seekBy(delta:number){this.seekTo(this.state().position+delta);}
 seekTo(position:number){const max=this.state().duration;if(!max)return;const p=Math.max(0,Math.min(max-1,position));this.lastTick=0;this.tracker.interrupt();
  try{if(this.engine==='avplay')this.av.seekTo(Math.floor(p*1000),()=>{},()=>{});else if(this.video)this.video.currentTime=p;this.patch({position:p});}catch(e){this.fail(e);}this.showControls();}
 skipIntro(){const win=this.intro();if(win&&this.state().position<=win.end&&this.state().position>=Math.max(0,win.start-5))this.seekTo(win.end);}
 /** Original priority: per-episode manual correction > verified audio cache > new analysis. */
 private async loadIntro(generation:number){
  this.introAbort?.abort();this.introAbort=null;
  const detail=this.detail,episode=this.episode,duration=this.state().duration;
  if(!detail||!episode||!Number.isFinite(duration)||duration<=0)return;
  const ctx=this.introService.context(detail.anime,episode,duration);
  const same=()=>this.generation===generation&&this.detail===detail&&this.episode===episode&&this.state().opened;
  this.loadEnding(ctx,generation);
  const local=this.introService.local(ctx);
  if(local){this.intro.set(local.state==='ready'?local.interval||null:null);this.introStatus.set(local.message);return;}
  if(this.local.settings()['introDetection']!==false){
   const cached=this.detector.saved(ctx,detail.anime,episode);
   if(cached){this.intro.set({start:cached.start,end:cached.end,source:cached.method==='template'?'fingerprint':'audio'});this.introStatus.set('Sigla già verificata con confronto audio.');this.loadEnding(ctx,generation,this.intro()!);return;}
  }
  this.introStatus.set('Verifica AniSkip…');
  const info=await this.introService.load(ctx);if(!same())return;
  const lengthInfo=this.introService.skipLength(ctx,info);this.aniSkipDuration.set(lengthInfo?.seconds||null);
  if(info.state==='disabled'||info.state==='changed'){this.intro.set(null);this.introStatus.set(info.message);return;}
  const detect=this.local.settings()['introDetection']!==false&&this.detector.supported()&&!!detail.anime.awSlug;
  // When no browser-side WebCodecs is available, accept only a duration-validated AniSkip interval.
  if(!detect){this.intro.set(info.state==='ready'?info.interval||null:null);
   this.introStatus.set(this.detector.supported()?info.message:'Decoder WebCodecs non disponibile: '+info.message);return;
  }
  const quick=info.state==='ready'?info.interval||null:null;
  const reference=info.candidate||info.interval||null;
  if(this.detector.notFound(ctx,detail.anime,episode)){this.intro.set(quick);this.introStatus.set('Nessuna intro confermata nella precedente analisi.');return;}
  const seconds=this.introService.skipLength(ctx,info),length=reference?reference.end-reference.start:seconds?.exactEpisode?seconds.seconds:null;
  const controller=new AbortController();this.introAbort=controller;
  const timer=setTimeout(()=>controller.abort(),120000);
  this.intro.set(quick);this.introStatus.set('Confronto audio tra episodi in corso…');
  try{
   const result=await this.detector.detect({anime:detail.anime,episode,context:ctx,length,hint:reference,signal:controller.signal,onProgress:message=>{if(same())this.introStatus.set(message);}});
   if(!same()||this.introService.local(ctx)||controller.signal.aborted)return;
   this.intro.set({start:result.start,end:result.end,source:result.method==='template'?'fingerprint':'audio'});
   this.loadEnding(ctx,generation,this.intro()!);
   this.introStatus.set(result.method==='template'?'Intro verificata con impronta locale.':'Intro verificata confrontando due episodi.');
  }catch(e){if(!same()||this.introService.local(ctx))return;
   const message=e instanceof Error?e.message:String(e);
   // Do not mark a failure or transient CORS error as a negative result.
   if(message.startsWith('Intro non individuata')&&!controller.signal.aborted){
    try{this.detector.rememberNotFound(detail.anime,episode,ctx,reference);}catch{}
   }
   this.intro.set(quick);this.introStatus.set(controller.signal.aborted?'Analisi audio annullata.':'Intro non confermata: '+message);
  }finally{clearTimeout(timer);if(this.introAbort===controller)this.introAbort=null;}
 }
 private loadEnding(ctx:IntroContext,generation:number,detected?:IntroWindow){
  const request=++this.endingRequest;
  void this.introService.loadEnding(ctx,detected).then(ending=>{if(request===this.endingRequest&&generation===this.generation&&this.state().opened)this.ending.set(ending);});
 }
 /** Manual fallback from the original player; a relative skip, never labelled as verified intro. */
 skipByAniSkip(trim=0){const seconds=this.aniSkipDuration();if(seconds===null||seconds-trim<=0||!this.state().opened)return;
  if(this.detail&&this.episode&&this.introService.local(this.introService.context(this.detail.anime,this.episode,this.state().duration))?.state==='disabled')return;
  this.seekBy(seconds-trim);
 }
 cancelIntroAnalysis(){this.introAbort?.abort();this.introStatus.set('Analisi sospesa.');}
 recalculateIntro(){if(!this.detail||!this.episode)return;
  this.detector.forget(this.detail.anime,this.episode);void this.loadIntro(this.generation);
 }
 disableIntro(){if(!this.detail||!this.episode)return;
  this.introAbort?.abort();this.introService.save(this.detail.anime,this.episode,this.state().duration,0,0,true);
  this.intro.set(null);this.introStatus.set('Salto intro disattivato per questo episodio.');
 }
 saveIntro(start:number,end:number){if(this.detail&&this.episode){
   this.introAbort?.abort();this.introService.save(this.detail.anime,this.episode,this.state().duration,start,end);
   this.intro.set({start,end,source:'local'});this.introStatus.set('Correzione locale salvata.');
 }}
 clearIntro(){if(this.detail&&this.episode){this.introService.clear(this.detail.anime,this.episode,this.state().duration);this.detector.forget(this.detail.anime,this.episode);this.intro.set(null);void this.loadIntro(this.generation);}}
 showControls(){this.controls.set(true);clearTimeout(this.controlTimer);if(!this.selectMenu())this.controlTimer=setTimeout(()=>this.controls.set(false),7000);}
 hideControls(){this.controls.set(false);this.selectMenu.set(null);clearTimeout(this.controlTimer);}
 handleKey(e:KeyboardEvent):boolean{if(!this.state().opened)return false;const key=({10009:'Back',27:'Escape',8:'Backspace',13:'Enter',37:'ArrowLeft',39:'ArrowRight',38:'ArrowUp',40:'ArrowDown',415:'MediaPlay',19:'MediaPause',10252:'MediaPlayPause',413:'MediaStop',417:'MediaFastForward',412:'MediaRewind'} as Record<number,string>)[e.keyCode]||e.key;
  if(['MediaPlayPause','MediaPlay','MediaPause'].includes(key)){if(key==='MediaPause')this.pause();else if(key==='MediaPlay'&&!this.state().playing)this.toggle();else if(key==='MediaPlayPause')this.toggle();return true;}
  if(key==='MediaFastForward'){this.seekBy(30);return true;}if(key==='MediaRewind'){this.seekBy(-30);return true;}if(key==='MediaStop'){this.close();return true;}
  if(['Back','Escape','Backspace','BrowserBack'].includes(key)){if(this.scrub()!==null){this.scrub.set(null);this.showControls();}else if(this.selectMenu()){this.selectMenu.set(null);this.showControls();}else if(this.controls()){this.hideControls();}else this.close();return true;}
  if(key==='Enter'&&document.activeElement?.getAttribute('data-focus')==='player-skip-intro'&&this.intro()&&this.state().position<this.intro()!.end){this.skipIntro();return true;}
  if(key==='Enter'&&document.activeElement?.getAttribute('data-focus')==='player-next-episode'&&this.showNextEpisode){if(!e.repeat)void this.next();return true;}
  if(!this.controls()){if(['Enter','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key)){this.showControls();setTimeout(()=>this.remote.focus(document.getElementById('p-toggle')||undefined),0);return true;}}
  if(key==='Enter'&&document.activeElement?.id==='timeline'){this.commitScrub();this.showControls();return true;}

  if(document.activeElement?.id==='timeline'&&key==='ArrowLeft'){this.moveScrub(-10);return true;}
  if(document.activeElement?.id==='timeline'&&key==='ArrowRight'){this.moveScrub(10);return true;}
  this.showControls();return false;
 }
 moveScrub(delta:number){const duration=this.state().duration;if(duration<=0)return;this.scrub.set(Math.max(0,Math.min(duration-1,(this.scrub()??this.state().position)+delta)));this.showControls();}
 commitScrub(){const position=this.scrub();this.scrub.set(null);if(position!==null)this.seekTo(position);}
 setSubtitleTrack(index:number|null){try{if(this.engine==='avplay'&&this.av){if(index===null){this.av.setSilentSubtitle(true);}else{this.av.setSelectTrack('TEXT',index);this.av.setSilentSubtitle(false);}}else if(this.video){for(let i=0;i<this.video.textTracks.length;i++)this.video.textTracks[i].mode=index===i?'showing':'disabled';}this.selectMenu.set(null);this.showControls();}catch(e){this.fail(e);}}
 async next(){const episode=this.nextEpisode,detail=this.detail;if(!episode||!detail)return;this.save();await this.open(detail,episode);}
 fail(error:unknown){this.patch({buffering:false,playing:false,error:error instanceof Error?error.message:String(error)});}
 close(save=true){const wasOpen=this.state().opened;this.introAbort?.abort();this.introAbort=null;if(save)this.save();++this.generation;clearInterval(this.timer);clearTimeout(this.controlTimer);try{this.av?.stop();}catch{}try{this.av?.close();}catch{}try{this.video?.pause();if(this.video){this.video.removeAttribute('src');this.video.load();}}catch{}
  this.av=null;this.engine=null;this.setTransparentVideoLayer(false);this.html5.set(false);this.scrub.set(null);this.source='';this.detail=null;this.episode=null;this.intro.set(null);this.ending.set(null);this.introStatus.set('');this.aniSkipDuration.set(null);this.selectMenu.set(null);this.state.set({...initial});this.controls.set(true);if(save&&wasOpen&&this.onClosed)setTimeout(()=>this.onClosed?.(),40);
 }
}
