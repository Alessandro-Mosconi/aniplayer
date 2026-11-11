import {WatchProgress} from './watch-progress';
import {Injectable, signal} from '@angular/core';
import {Anime,Episode,Detail,PlaybackState} from './models';
import {StorageService} from './storage.service';
import {AnimeWorldService} from './animeworld.service';
import {TizenService} from './tizen.service';
import {IntroService,IntroWindow,IntroContext,ExtraSegment,SkipProposals} from './intro.service';
import {EndingDetectorService} from './ending-detector.service';
import {IntroDetectorService} from './intro-detector.service';
import {RemoteService,remoteKey} from './remote.service';
import {MalService} from './mal.service';
import {readVideoDuration} from './mp4-duration';
import {audioPosition} from './audio-position';
import {SkipAlignment} from './skip-alignment';
const initial:PlaybackState={playing:false,position:0,duration:0,opened:false,buffering:false,title:'',episode:0,error:''};
interface SkipUndo {detail:Detail;episode:Episode;position:number;playing:boolean;url:string;versions:Detail[];generation:number;expires:number;}
@Injectable({providedIn:'root'})
export class PlaybackService {
 onClosed:(()=>void)|null=null;
 onAudioChanged:((detail:Detail)=>void)|null=null;
 audioVersionsProvider:(()=>Detail[])|null=null;
 private audioSwitchRequest=0;
 readonly audioOptions=signal<Detail[]>([]);readonly audioLoading=signal(false);readonly audioSwitching=signal(false);readonly audioNotice=signal('');readonly audioLanguage=signal<'sub'|'dub'>('sub');
 private setTransparentVideoLayer(active:boolean){
  // Tizen AVPlay composita il video dietro il DOM Web: uno sfondo HTML opaco lo nasconde
  // anche quando AVPlay sta riproducendo correttamente l'audio e avanza la timeline.
  document.documentElement.classList.toggle('tv-video-active',active);
  document.body.classList.toggle('tv-video-active',active);
 }

 readonly state=signal<PlaybackState>({...initial});
 readonly controls=signal(true);readonly html5=signal(false);readonly scrub=signal<number|null>(null);readonly intro=signal<IntroWindow|null>(null);
 readonly ending=signal<IntroWindow|null>(null);private endingRequest=0;
 readonly recap=signal<IntroWindow|null>(null);readonly prologue=signal<IntroWindow|null>(null);readonly endingStatus=signal('');
 readonly skipProposals=signal<SkipProposals>({opening:null,recap:null,ending:null});
 readonly skipQuiet=signal(false);private skipQuietTimer:ReturnType<typeof setTimeout>|undefined;
 readonly endingSkipped=signal(false);private openingSkipDisabled=false;
 readonly introAnalyzing=signal(false);readonly endingAnalyzing=signal(false);readonly skipLoading=signal(false);
 readonly skipDetails=signal<{recap:SkipAlignment|null;ending:SkipAlignment|null}>({recap:null,ending:null});
 readonly skipUndoAvailable=signal(false);readonly skipNotice=signal('');private skipUndo:SkipUndo|null=null;private skipUndoTimer:ReturnType<typeof setTimeout>|undefined;
 private endingAbort:AbortController|null=null;private endingAudioTried=false;
 readonly selectMenu=signal<'quality'|'subtitles'|'intro'|'language'|'intervals'|null>(null);
 readonly introStatus=signal('');readonly aniSkipDuration=signal<number|null>(null);private introAbort:AbortController|null=null;
 readonly audioSources=signal<{label:string;url:string}[]>([]);
 readonly subtitles=signal<{label:string;index:number}[]>([]);
 private timer:any;private controlTimer:any;private generation=0;private engine:'avplay'|'html5'|null=null;
 private source='';private detail:Detail|null=null;private episode:Episode|null=null;private video:HTMLVideoElement|null=null;
 private object:HTMLElement|null=null;private av:any;private lastSave=0;private lastTick=0;private watchedSeconds=0;private wasPlaying=false;private finishedOnce=false;
 private tracker=new WatchProgress();private autoMarked=false;
 private originalPoster='';private playbackSegments:[number,number][]=[];
 constructor(private data:AnimeWorldService,private local:StorageService,private tv:TizenService,private introService:IntroService,private remote:RemoteService,private mal:MalService,private detector:IntroDetectorService,private endingDetector:EndingDetectorService){}
 attach(video:HTMLVideoElement|null,object:HTMLElement|null){if(video)this.video=video;if(object)this.object=object;}
 private patch(partial:Partial<PlaybackState>){this.state.update(s=>({...s,...partial}));}
 async open(detail:Detail,episode:Episode,options:{position?:number;paused?:boolean;url?:string;versions?:Detail[]}={}){if(options.position===undefined){++this.audioSwitchRequest;this.audioSwitching.set(false);}this.close(false);const id=++this.generation;this.detail=detail;this.episode=episode;this.audioLanguage.set(Number(detail.anime.dub)?'dub':'sub');this.audioOptions.set(options.versions||[]);this.audioNotice.set('');this.lastTick=0;this.watchedSeconds=0;this.finishedOnce=false;this.playbackSegments=[];this.lastSave=0;this.tracker=new WatchProgress(this.local.watchCoverage()?.[this.local.watchKey(detail.anime,episode)]);this.autoMarked=this.local.isSeen(detail.anime,episode);this.scrub.set(null);this.intro.set(null);this.ending.set(null);this.introStatus.set('');this.aniSkipDuration.set(null);this.selectMenu.set(null);
  this.setTransparentVideoLayer(true);this.patch({...initial,opened:true,title:detail.anime.title_eng||detail.anime.title||'Anime',episode:Number(episode.number),buffering:true});this.showControls();
  this.introService.prefetch?.(detail.anime,episode);
  try{const url=options.url||await this.data.source(detail.anime,episode);if(this.generation!==id)return;this.source=url;this.audioSources.set([{label:'AnimeWorld · MP4',url}]);
   const saved=this.local.history()[String(detail.anime.id)];const resume=options.position??(this.local.settings()['resume']!==false&&saved&&String(saved.episode.number)===String(episode.number)&&!saved.completed?saved.position:0);
   await this.prepare(url,resume,id,!!options.paused,options.position!==undefined);if(this.generation!==id)return;
   this.timer=setInterval(()=>this.save(),10000);
  }catch(e){if(id===this.generation)this.fail(e);}
 }
 private async prepare(url:string,resume:number,id:number,paused=false,exact=false){this.patch({buffering:true,error:''});
  const av=this.tv.getAvplay();const pref=this.local.settings()['engine']||'auto';
  // A Samsung preference may be imported on another TV: use its HTML5 engine.
  if(pref==='avplay'&&!av&&this.tv.platform==='tizen')throw Error('AVPlay non disponibile sul dispositivo.');
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
   if(exact&&(!Number.isFinite(resume)||resume<0||resume>=duration))throw Error('La nuova versione termina prima della posizione corrente.');
   if(resume>0&&resume<duration-(exact?0:5))await new Promise<void>((resolve,reject)=>{const failed=()=>exact?reject(Error('Impossibile mantenere la posizione.')):resolve();const timeout=setTimeout(failed,5000);try{av.seekTo(Math.floor(resume*1000),()=>{clearTimeout(timeout);resolve();},()=>{clearTimeout(timeout);failed();});}catch{clearTimeout(timeout);failed();}});
   if(id!==this.generation)return;
   this.patch({position:resume>0&&resume<duration-(exact?0:5)?resume:0});if(duration>0)void this.loadIntro(id);
   try{const tracks=av.getTotalTrackInfo()||[];this.subtitles.set(tracks.map((t:any,i:number)=>({...t,index:i})).filter((t:any)=>t.type==='TEXT').map((t:any)=>({label:String(t.extra_info||'Sottotitoli '+(t.index+1)),index:t.index})));}catch{}
   if(!paused)av.play();this.patch({playing:!paused,buffering:false});
  }else{
   const video=this.video;if(!video)throw Error('Elemento video non ancora disponibile');
   await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>{cleanup();reject(Error('Timeout caricamento HTML5'));},20000);const ok=()=>{cleanup();resolve();},err=()=>{cleanup();reject(Error('Formato video non compatibile'));};const cleanup=()=>{clearTimeout(timeout);video.removeEventListener('loadedmetadata',ok);video.removeEventListener('error',err);};video.addEventListener('loadedmetadata',ok);video.addEventListener('error',err);video.src=url;video.load();});
   if(id!==this.generation)return;
   if(exact&&(!Number.isFinite(resume)||resume<0||resume>=video.duration))throw Error('La nuova versione termina prima della posizione corrente.');
   if(resume>0&&resume<video.duration-(exact?0:5)){
    if(exact)await new Promise<void>((resolve,reject)=>{const cleanup=()=>{clearTimeout(timeout);video.removeEventListener('seeked',ok);video.removeEventListener('error',fail);};const ok=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(Error('Impossibile mantenere la posizione.'));};const timeout=setTimeout(fail,10000);video.addEventListener('seeked',ok);video.addEventListener('error',fail);video.currentTime=resume;});
    else video.currentTime=resume;
   }
   if(id!==this.generation)return;
   this.patch({duration:video.duration,position:video.currentTime,buffering:false});if(video.duration>0)void this.loadIntro(id);if(!paused)await video.play();else video.pause();this.patch({playing:!paused});
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
  if(playing&&this.local.settings()['autonext']!==false&&duration>60&&position>=duration-2&&!(this.ending()&&this.ending()!.end<duration-.5))this.finished();
  if(position-this.lastSave>=10)this.save();
  if(playing&&duration>180&&position>=duration-420&&!this.ending()&&!this.endingAudioTried)void this.analyzeEnding();
 }
 get playbackProgress(){return this.state().duration?100*this.state().position/this.state().duration:0;}
 get nextEpisode(){if(!this.detail||!this.episode)return null;const number=Number(this.episode.number)+1;return this.detail.episodes.find(episode=>Number(episode.number)===number&&episode.public!==0)||null;}
 get previousEpisode(){if(!this.detail||!this.episode)return null;const number=Number(this.episode.number)-1;return this.detail.episodes.find(episode=>Number(episode.number)===number&&episode.public!==0)||null;}
 get skipPrompt(){return this.skipQuiet()?null:this.activeSkip;}
 private proposedWindow(kind:keyof SkipProposals):IntroWindow|null{
  if((kind==='recap'||kind==='ending')&&this.skipDetails()[kind]?.state==='conflict')return null;
  const window=this.skipProposals()[kind],duration=this.state().duration;
  if(!window||!Number.isFinite(duration)||duration<=0||!Number.isFinite(window.start)||!Number.isFinite(window.end)||window.start<0||window.start>=duration||window.end<=window.start)return null;
  if(window.end>duration)return kind==='ending'&&window.end-duration<=30?{...window,end:duration}:null;
  return window;
 }
 get showNextEpisode(){const s=this.state(),end=this.ending()||this.proposedWindow('ending'),nearEnd=s.duration-Math.min(180,s.duration*.1),start=end?(end.end<s.duration-.5?Math.max(end.end,nearEnd):end.start):nearEnd;return (!this.skipQuiet()||this.endingSkipped())&&!this.activeSkip&&s.opened&&!s.error&&!s.buffering&&Number.isFinite(s.duration)&&s.duration>0&&s.position>=start&&s.position<s.duration&&!!this.nextEpisode;}
 get activeSkip():{kind:ExtraSegment|'opening';label:string;window:IntroWindow;provisional:boolean}|null{
  const s=this.state();if(!s.opened||s.error||s.buffering||this.selectMenu()||this.scrub()!==null)return null;
  for(const [kind,label,actual,proposal] of [['recap','Salta riassunto',this.recap(),this.proposedWindow('recap')],['prologue','Salta intro',this.prologue(),null],['opening','Salta sigla',this.intro(),this.proposedWindow('opening')],['ending','Salta finale',this.ending(),this.proposedWindow('ending')]] as const){
   if(kind==='opening'&&this.openingSkipDisabled||kind==='ending'&&this.endingSkipped())continue;
   if(!actual&&(kind==='recap'||kind==='ending')&&this.skipDetails()[kind]?.state==='conflict')continue;
   const window=actual||proposal;
   if(window&&s.position>=Math.max(0,window.start-(kind==='opening'?5:0))&&s.position<window.end)return {kind,label,window,provisional:!actual};
  }return null;
 }
 async skipCurrentSegment(){const action=this.activeSkip;if(!action)return;
  const recovery=this.captureSkip(),generation=this.generation;
  if(action.kind==='ending'&&this.state().duration-action.window.end<=.5&&this.nextEpisode){await this.next();if(this.generation===generation||this.generation===generation+2){this.finishSkip();this.offerUndo(recovery);}return;}
  // Seeking skips coverage credit and preserves everything following the interval.
  this.seekTo(action.window.end);
  this.finishSkip(action.kind==='ending');
  this.offerUndo(recovery);
 }
 private captureSkip():SkipUndo|null{return this.detail&&this.episode&&this.state().opened?{detail:this.detail,episode:this.episode,position:this.state().position,playing:this.state().playing,url:this.source,versions:this.audioOptions(),generation:this.generation,expires:0}:null;}
 private offerUndo(recovery:SkipUndo|null){if(!recovery||!this.state().opened||this.state().error)return;clearTimeout(this.skipUndoTimer);this.skipUndo={...recovery,generation:this.generation,expires:Date.now()+5000};this.skipUndoAvailable.set(true);this.skipUndoTimer=setTimeout(()=>this.clearSkipUndo(),5000);}
 private clearSkipUndo(){clearTimeout(this.skipUndoTimer);this.skipUndo=null;this.skipUndoAvailable.set(false);}
 async undoSkip(){
  const recovery=this.skipUndo;if(!recovery||Date.now()>recovery.expires||recovery.generation!==this.generation){this.clearSkipUndo();return;}
  this.clearSkipUndo();
  if(this.detail===recovery.detail&&this.episode===recovery.episode){this.seekTo(recovery.position);if(recovery.playing!==this.state().playing)this.toggle();this.finishSkip();return;}
  const fallback=this.captureSkip(),generation=this.generation;this.save();
  await this.open(recovery.detail,recovery.episode,{position:recovery.position,paused:!recovery.playing,url:recovery.url||undefined,versions:recovery.versions});
  if(this.generation!==generation+2)return;
  if(this.state().error&&fallback){await this.open(fallback.detail,fallback.episode,{position:fallback.position,paused:!fallback.playing,url:fallback.url||undefined,versions:fallback.versions});if(this.generation===generation+4)this.skipNotice.set('Non è stato possibile annullare il salto.');return;}
  this.finishSkip();
 }
 private finishSkip(ending=false){
  if(!this.state().opened||this.state().error)return;
  this.endingSkipped.set(ending);this.skipQuiet.set(true);this.hideControls();
  const focused=document.activeElement as HTMLElement|null;
  if(focused?.closest?.('#player')||focused?.getAttribute?.('data-focus')?.startsWith('player-skip'))focused?.blur?.();
  clearTimeout(this.skipQuietTimer);this.skipQuietTimer=setTimeout(()=>this.skipQuiet.set(false),2500);
 }
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
 skipIntro(){const win=this.intro();if(win&&this.state().position<win.end&&this.state().position>=Math.max(0,win.start-5)){const recovery=this.captureSkip();this.seekTo(win.end);this.finishSkip();this.offerUndo(recovery);}}
 /** Original priority: per-episode manual correction > verified audio cache > new analysis. */
 private async loadIntro(generation:number){
  this.introAbort?.abort();this.introAbort=null;this.introAnalyzing.set(false);
  const detail=this.detail,episode=this.episode,duration=this.state().duration;
  if(!detail||!episode||!Number.isFinite(duration)||duration<=0)return;
  const ctx=this.introService.context(detail.anime,episode,duration);
  const same=()=>this.generation===generation&&this.detail===detail&&this.episode===episode&&this.state().opened;
  this.skipLoading.set(true);
  void this.introService.proposals?.(ctx).then(rows=>{if(same())this.skipProposals.set(rows);}).finally(()=>{if(same())this.skipLoading.set(false);});
  this.loadEnding(ctx,generation);
  const local=this.introService.local(ctx);
  this.openingSkipDisabled=local?.state==='disabled';
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
  if(quick&&quick.start<=5){this.intro.set(quick);this.introStatus.set('Salto pronto da AniSkip.');return;}
  const reference=info.candidate||info.interval||null;
  if(this.detector.notFound(ctx,detail.anime,episode)){this.intro.set(quick);this.introStatus.set('Nessuna intro confermata nella precedente analisi.');return;}
  const seconds=this.introService.skipLength(ctx,info),length=reference?reference.end-reference.start:seconds?.exactEpisode?seconds.seconds:null;
  const controller=new AbortController();this.introAbort=controller;
  this.introAnalyzing.set(true);
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
  }finally{clearTimeout(timer);if(this.introAbort===controller){this.introAbort=null;this.introAnalyzing.set(false);}}
 }
 private loadEnding(ctx:IntroContext,generation:number,detected?:IntroWindow){
  const request=++this.endingRequest;
  const current=()=>request===this.endingRequest&&generation===this.generation&&this.state().opened;
  this.prologue.set(this.introService.localSegment?.(ctx,'prologue')||null);
  this.recap.set(this.introService.localSegment?.(ctx,'recap')||null);
  const existing=this.ending(),direct=existing&&['audio','fingerprint'].includes(existing.source)?existing:this.endingDetector?.saved(this.detail!.anime,this.episode!,ctx.duration)||null;
  this.ending.set(this.introService.localSegment?.(ctx,'ending')||direct);
  if(this.introService.alignment){
   void this.introService.alignment(ctx,'ed',detected,direct||undefined).then(info=>{if(current()){this.skipDetails.update(d=>({...d,ending:info}));this.ending.set(this.introService.localSegment?.(ctx,'ending')||direct||info.interval);}});
   void this.introService.alignment(ctx,'recap',detected,direct||undefined).then(info=>{if(current()){this.skipDetails.update(d=>({...d,recap:info}));this.recap.set(this.introService.localSegment?.(ctx,'recap')||info.interval);}});
   return;
  }
  void this.introService.loadEnding(ctx,detected).then(ending=>{if(current())this.ending.set(this.introService.localSegment?.(ctx,'ending')||ending||this.ending());});
  void this.introService.loadRecap?.(ctx,detected).then(recap=>{if(current())this.recap.set(this.introService.localSegment?.(ctx,'recap')||recap);});
 }
 async analyzeEnding(){
  const detail=this.detail,episode=this.episode,generation=this.generation,duration=this.state().duration;
  if(!detail||!episode||this.ending()||this.endingAudioTried||this.local.settings()['introDetection']===false||!this.endingDetector?.supported()||!detail.anime.awSlug)return;
  this.endingAudioTried=true;const controller=new AbortController();this.endingAbort=controller;const timer=setTimeout(()=>controller.abort(),90000);
  this.endingAnalyzing.set(true);
  this.endingStatus.set('Confronto audio della sigla finale…');
  try{const ending=await this.endingDetector.detect(detail.anime,episode,duration,controller.signal);
   if(generation!==this.generation||controller.signal.aborted)return;
   if(ending&&!this.ending()){this.ending.set(ending);const ctx=this.introService.context(detail.anime,episode,duration);this.loadEnding(ctx,generation,this.intro()||undefined);}
   this.endingStatus.set(ending?(ending.source==='fingerprint'?'Sigla finale riconosciuta con impronta audio.':'Sigla finale verificata con due episodi.'):'Sigla finale non confermata: nessun salto automatico.');
  }catch{if(generation===this.generation)this.endingStatus.set('Analisi finale non disponibile. Puoi impostare un intervallo manuale.');}
  finally{clearTimeout(timer);if(this.endingAbort===controller){this.endingAbort=null;this.endingAnalyzing.set(false);}}
 }
 saveSegment(kind:ExtraSegment,start:number,end:number){if(!this.detail||!this.episode)return;const ctx=this.introService.context(this.detail.anime,this.episode,this.state().duration);this.introService.saveSegment(ctx,kind,start,end);const window:IntroWindow={start,end,source:'local'};if(kind==='ending')this.ending.set(window);else if(kind==='recap')this.recap.set(window);else this.prologue.set(window);}
 clearSegment(kind:ExtraSegment){if(!this.detail||!this.episode)return;this.introService.clearSegment(this.introService.context(this.detail.anime,this.episode,this.state().duration),kind);if(kind==='ending')this.ending.set(null);else if(kind==='recap')this.recap.set(null);else this.prologue.set(null);}
 /** Manual fallback from the original player; a relative skip, never labelled as verified intro. */
 skipByAniSkip(trim=0){const seconds=this.aniSkipDuration();if(seconds===null||seconds-trim<=0||!this.state().opened)return;
  if(this.detail&&this.episode&&this.introService.local(this.introService.context(this.detail.anime,this.episode,this.state().duration))?.state==='disabled')return;
  const recovery=this.captureSkip();this.seekBy(seconds-trim);
  this.finishSkip();
  this.offerUndo(recovery);
 }
 cancelIntroAnalysis(){this.introAbort?.abort();this.introStatus.set('Analisi sospesa.');}
 recalculateIntro(){if(!this.detail||!this.episode)return;
  this.detector.forget(this.detail.anime,this.episode);void this.loadIntro(this.generation);
 }
 disableIntro(){if(!this.detail||!this.episode)return;
  this.openingSkipDisabled=true;
  this.introAbort?.abort();this.introService.save(this.detail.anime,this.episode,this.state().duration,0,0,true);
  this.intro.set(null);this.introStatus.set('Salto intro disattivato per questo episodio.');
 }
 saveIntro(start:number,end:number){if(this.detail&&this.episode){
   this.openingSkipDisabled=false;
   this.introAbort?.abort();this.introService.save(this.detail.anime,this.episode,this.state().duration,start,end);
   this.intro.set({start,end,source:'local'});this.introStatus.set('Correzione locale salvata.');
 }}
 clearIntro(){if(this.detail&&this.episode){this.introService.clear(this.detail.anime,this.episode,this.state().duration);this.detector.forget(this.detail.anime,this.episode);this.intro.set(null);void this.loadIntro(this.generation);}}
 showControls(){clearTimeout(this.skipQuietTimer);this.skipQuiet.set(false);this.endingSkipped.set(false);this.controls.set(true);clearTimeout(this.controlTimer);if(!this.selectMenu())this.controlTimer=setTimeout(()=>this.controls.set(false),7000);}
 hideControls(){this.controls.set(false);this.selectMenu.set(null);clearTimeout(this.controlTimer);}
 handleKey(e:KeyboardEvent):boolean{if(!this.state().opened)return false;const key=remoteKey(e);
  if(['MediaPlayPause','MediaPlay','MediaPause'].includes(key)){if(key==='MediaPause')this.pause();else if(key==='MediaPlay'&&!this.state().playing)this.toggle();else if(key==='MediaPlayPause')this.toggle();return true;}
  if(key==='MediaFastForward'){this.seekBy(30);return true;}if(key==='MediaRewind'){this.seekBy(-30);return true;}if(key==='MediaStop'){this.close();return true;}
  if(['Back','Escape','Backspace','BrowserBack'].includes(key)){if(this.scrub()!==null){this.scrub.set(null);this.showControls();}else if(this.selectMenu()){this.selectMenu.set(null);this.showControls();}else if(this.controls()){this.hideControls();}else this.close();return true;}
  if(key==='Enter'&&document.activeElement?.getAttribute('data-focus')==='player-skip-intro'&&this.intro()&&this.state().position<this.intro()!.end){this.skipIntro();return true;}
  if(key==='Enter'&&document.activeElement?.getAttribute('data-focus')==='player-skip-segment'&&this.activeSkip){if(!e.repeat)void this.skipCurrentSegment();return true;}
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
 audioAvailable(language:'sub'|'dub'){return !!this.audioOptions().find(d=>Number(!!d.anime.dub)===(language==='dub'?1:0)&&d.episodes.some(e=>Number(e.number)===Number(this.episode?.number)&&e.public!==0));}
 private mergeAudioVersions(detail:Detail,options:Detail[]){
  const merged=new Map<number,Detail>();for(const candidate of [detail,...options]){
   if(!candidate.anime.awSlug)continue;
   if(['mal_id','anilist_id'].some(key=>Number((detail.anime as any)[key])>0&&Number((candidate.anime as any)[key])>0&&Number((detail.anime as any)[key])!==Number((candidate.anime as any)[key])))continue;
   const dub=Number(!!candidate.anime.dub);if(!merged.has(dub))merged.set(dub,candidate);
  }return [...merged.values()];
 }
 async openAudioMenu(){
  const detail=this.detail,generation=this.generation;if(!detail||this.audioSwitching())return;
  this.selectMenu.set('language');this.audioNotice.set('');this.showControls();
  this.audioOptions.set(this.mergeAudioVersions(detail,[...this.audioOptions(),...(this.audioVersionsProvider?.()||[])]));
  if(this.audioOptions().length>=2||this.audioLoading())return;
  this.audioLoading.set(true);
  try{const result=await this.data.match(detail.anime);if(generation===this.generation)this.audioOptions.set(this.mergeAudioVersions(detail,[...this.audioOptions(),...result.matches,...(this.audioVersionsProvider?.()||[])]));}
  catch{if(generation===this.generation)this.audioNotice.set('Non riesco a verificare l’altra versione. Il video attuale resta disponibile.');}
  finally{if(generation===this.generation)this.audioLoading.set(false);}
 }
 async switchAudio(language:'sub'|'dub'){
  const original=this.detail,originalEpisode=this.episode,generation=this.generation;
  if(!original||!originalEpisode||this.audioSwitching()||language===this.audioLanguage())return;
  const target=this.audioOptions().find(d=>Number(!!d.anime.dub)===(language==='dub'?1:0)),episode=target?.episodes.find(e=>Number(e.number)===Number(originalEpisode.number)&&e.public!==0);
  if(!target||!episode){this.audioNotice.set('Questa versione non è disponibile per l’episodio corrente.');return;}
  const request=++this.audioSwitchRequest;this.audioSwitching.set(true);this.audioNotice.set('');const versions=this.audioOptions();
  try{
   // Resolve first while the old video is still intact and playable.
   const url=await this.data.source(target.anime,episode);if(generation!==this.generation)return;
   let targetIntro:IntroWindow|null=null;
   try{
    const duration=await readVideoDuration(url);if(generation!==this.generation)return;
    const ctx=this.introService.context(target.anime,episode,duration),local=this.introService.local(ctx);
    if(local)targetIntro=local.state==='ready'?local.interval||null:null;
    else{const cached=this.detector.saved(ctx,target.anime,episode);if(cached)targetIntro={start:cached.start,end:cached.end,source:'audio'};else{const info=await this.introService.load(ctx);if(info.state==='ready')targetIntro=info.interval||null;}}
   }catch{/* Metadata/decoder unavailable: preserve seconds rather than invent an offset. */}
   if(generation!==this.generation)return;
   const originalPosition=this.state().position,alignment=audioPosition(originalPosition,this.intro(),targetIntro),position=alignment.position,paused=!this.state().playing,oldUrl=this.source;
   this.save();const replacement={...target,anime:{...target.anime,id:original.anime.id}};
   await this.open(replacement,episode,{position,paused,url,versions});
   if(this.generation!==generation+2)return;
   if(this.state().error){
    await this.open(original,originalEpisode,{position:originalPosition,paused,url:oldUrl||undefined,versions});
    if(this.generation!==generation+4)return;
    this.audioNotice.set(this.state().error?'Cambio fallito. Anche la sorgente precedente non è disponibile: riapri l’episodio.':'Cambio non riuscito: ripristinata la versione precedente allo stesso minuto.');
    this.selectMenu.set('language');this.showControls();return;
   }
   this.save();this.audioNotice.set(alignment.aligned?'Versioni allineate sulla sigla.':'Posizione mantenuta; allineamento della sigla non disponibile.');this.onAudioChanged?.(replacement);this.showControls();
   const activeGeneration=this.generation;setTimeout(()=>{if(activeGeneration===this.generation&&this.state().opened)this.remote.focus?.(document.querySelector?.<HTMLElement>('[data-focus="p-subtitles"]'));});
  }catch{if(generation===this.generation)this.audioNotice.set('Cambio non riuscito: continui con la versione attuale.');}
  finally{if(request===this.audioSwitchRequest)this.audioSwitching.set(false);}
 }
 async next(){const episode=this.nextEpisode,detail=this.detail;if(!episode||!detail)return;this.save();await this.open(detail,episode,{versions:this.audioOptions()});}
 async previous(){const episode=this.previousEpisode,detail=this.detail;if(!episode||!detail)return;this.save();await this.open(detail,episode,{versions:this.audioOptions()});}
 fail(error:unknown){this.patch({buffering:false,playing:false,error:error instanceof Error?error.message:String(error)});}
 close(save=true){this.clearSkipUndo();this.skipNotice.set('');this.skipDetails.set({recap:null,ending:null});this.openingSkipDisabled=false;this.endingSkipped.set(false);this.audioLoading.set(false);if(save){++this.audioSwitchRequest;this.audioSwitching.set(false);}clearTimeout(this.skipQuietTimer);this.skipQuiet.set(false);this.skipProposals.set({opening:null,recap:null,ending:null});this.skipLoading.set(false);this.introAnalyzing.set(false);this.endingAnalyzing.set(false);this.endingAbort?.abort();this.endingAbort=null;this.endingAudioTried=false;this.recap.set(null);this.prologue.set(null);this.endingStatus.set('');const wasOpen=this.state().opened;this.introAbort?.abort();this.introAbort=null;if(save)this.save();++this.generation;clearInterval(this.timer);clearTimeout(this.controlTimer);try{this.av?.stop();}catch{}try{this.av?.close();}catch{}try{this.video?.pause();if(this.video){this.video.removeAttribute('src');this.video.load();}}catch{}
  this.av=null;this.engine=null;this.setTransparentVideoLayer(false);this.html5.set(false);this.scrub.set(null);this.source='';this.detail=null;this.episode=null;this.intro.set(null);this.ending.set(null);this.introStatus.set('');this.aniSkipDuration.set(null);this.selectMenu.set(null);this.state.set({...initial});this.controls.set(true);if(save&&wasOpen&&this.onClosed)setTimeout(()=>this.onClosed?.(),40);
 }
}
