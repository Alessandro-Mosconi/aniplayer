import {AniAvatar,AniCatalog,AnimeSort,fetchAniCatalog,fetchAniCharacters} from '../core/anilist-avatars';
import {Component,inject,signal,output,OnDestroy,AfterViewInit,HostListener,ElementRef} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {StorageService} from '../core/storage.service';
import {Profile,AvatarInfo,avatarUrl,normalizeAvatarStyles,randomProfileAvatar,randomProfileName,tinyToolsProfileName} from '../core/profiles';
import {AVATAR_STYLES} from '../core/avatar-styles';
import {ProfileAvatarDirective} from './profile-avatar.directive';
import {AnimeLoaderComponent} from './anime-loader.component';
@Component({selector:'app-profiles',standalone:true,imports:[FormsModule,ProfileAvatarDirective,AnimeLoaderComponent],templateUrl:'./profiles.component.html',styleUrl:'./profiles.component.scss'})
export class ProfilesComponent implements OnDestroy,AfterViewInit {
 readonly storage=inject(StorageService);readonly closed=output<void>();readonly avatarUrl=avatarUrl;
 private readonly element:ElementRef<HTMLElement>=inject(ElementRef);
 @HostListener('keydown',['$event']) trapTab(event:KeyboardEvent){
  if(event.key!=='Tab')return;
  const items=Array.from(this.element.nativeElement.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,a[href]:not([tabindex="-1"])'));
  const first=items[0],last=items[items.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 }
 readonly editing=signal(false);readonly error=signal('');
 readonly confirmingDelete=signal(false);
 deleteName(){return this.storage.profiles().find(profile=>profile.id===this.id)?.name||'';}
 requestDelete(){if(!this.id)return;this.error.set('');this.confirmingDelete.set(true);this.focus('[data-delete-cancel]');}
 cancelDelete(){this.confirmingDelete.set(false);this.error.set('');this.focus('[data-delete-profile]');}
 confirmDelete(){if(!this.id)return;try{const cleaned=this.storage.deleteProfile(this.id);this.confirmingDelete.set(false);this.editing.set(false);this.id=undefined;this.error.set(cleaned?'':'Profilo eliminato, ma alcuni dati locali non sono stati rimossi.');this.focus('[data-profile-first]');}catch(e){this.fail(e);}}
 readonly styles=signal<string[]>([...AVATAR_STYLES]);
 readonly cooling=signal(false);readonly catalogLoading=signal(false);readonly catalogNotice=signal('');readonly imageError=signal(false);
 readonly batches=signal<Record<string,number>>({});
 readonly galleryStyle=signal('');readonly galleryItems=signal<string[]>([]);readonly galleryLoading=signal(false);
 private galleryTimer:ReturnType<typeof setTimeout>|undefined;private galleryReturnFocus='';
 readonly aniVisible=signal(10);readonly aniCharacterLoading=signal(false);readonly aniCharacterError=signal('');private aniCharacterRequest:AbortController|null=null;
 readonly avatarTab=signal<'styles'|'anime'>('styles');readonly aniSeries=signal<number|null>(null);
 readonly favoriteAnime=signal<{id:number;name:string;items:AniAvatar[]}[]>([]);readonly favoriteAnimeOnly=signal(false);readonly animeBatches=signal<Record<number,number>>({});
 animePreview(series:{id:number;items:AniAvatar[]}){const items=series.items;if(items.length<=4)return items;const start=((this.animeBatches()[series.id]||0)*4)%items.length;return Array.from({length:Math.min(4,items.length)},(_,i)=>items[(start+i)%items.length]);}
 isFavoriteAnime(id:number){return this.favoriteAnime().some(item=>item.id===id);}
 regenerateAnime(id:number){if(this.cooling()||(this.aniGroups().find(item=>item.id===id)?.items.length||0)<=4)return;this.animeBatches.update(old=>({...old,[id]:(old[id]||0)+1}));this.cooling.set(true);clearTimeout(this.cooldown);this.cooldown=setTimeout(()=>this.cooling.set(false),1200);}
 toggleFavoriteAnime(series:{id:number;name:string;items:AniAvatar[]}){const removing=this.favoriteAnime().some(item=>item.id===series.id);const next=removing?this.favoriteAnime().filter(item=>item.id!==series.id):[...this.favoriteAnime(),series];if(this.id&&!this.storage.write('avatarAnimeFavorites.'+this.id,next)){this.error.set('Impossibile salvare le serie preferite.');return;}this.favoriteAnime.set(next);if(removing&&this.favoriteAnimeOnly()&&!this.galleryStyle())this.focus('[data-anime-favorites]');}
 setAvatarTab(tab:'styles'|'anime'){this.avatarTab.set(tab);if(tab==='anime'&&!this.aniCatalog()&&!this.aniLoading())void this.loadAni(true);}
 aniGroups(){const groups=new Map<number,{id:number;name:string;items:AniAvatar[]}>();for(const item of this.aniCatalog()?.items||[]){let group=groups.get(item.animeId);if(!group){group={id:item.animeId,name:item.anime,items:[]};groups.set(item.animeId,group);}group.items.push(item);}const loaded=[...groups.values()];if(this.favoriteAnimeOnly())return this.favoriteAnime().map(saved=>loaded.find(item=>item.id===saved.id)||saved);return loaded.slice(0,this.aniVisible());}
 openAniSeries(id:number){this.aniSeries.set(id);this.galleryStyle.set('anilist');this.focus('[data-gallery-first]');}
 closeAniSeries(){this.aniCharacterRequest?.abort();this.aniCharacterRequest=null;this.aniCharacterLoading.set(false);this.aniCharacterError.set('');const id=this.aniSeries();this.galleryStyle.set('');this.aniSeries.set(null);this.focus('[data-anime-series="'+id+'"]');}
 readonly aniCatalog=signal<AniCatalog|null>(null);readonly aniLoading=signal(false);readonly aniError=signal('');
 readonly aniSortOptions:{value:AnimeSort;label:string}[]=[{value:'POPULARITY_DESC',label:'Popolarità'},{value:'SCORE_DESC',label:'Punteggio'},{value:'TRENDING_DESC',label:'Tendenza'},{value:'FAVOURITES_DESC',label:'Preferiti'}];
 setAniSort(value:AnimeSort){if(this.aniLoading()||this.aniSort===value)return;this.aniSort=value;void this.loadAni(true);}
 aniSort:AnimeSort='POPULARITY_DESC';aniSearch='';private aniRequest:AbortController|null=null;private aniKey='';
 async loadAni(reset=false){if(this.aniLoading())return;const search=this.aniSearch.trim();const key='aniAvatarCache.v3.'+this.aniSort+'.'+search.toLowerCase();if(!reset&&this.aniKey!==key)reset=true;this.aniKey=key;if(reset){this.aniVisible.set(10);const cached=this.storage.read<{time:number;catalog:AniCatalog}|null>(key,null);this.aniCatalog.set(cached&&Date.now()-cached.time<86400000?cached.catalog:null);}else this.aniVisible.update(count=>count+10);
 const controller=new AbortController();this.aniRequest=controller;this.aniLoading.set(true);this.aniError.set('');const timer=setTimeout(()=>controller.abort(),30000);try{let result=this.aniCatalog();while((!result||result.media.length<this.aniVisible())&&(!result||result.hasNext)){result=await fetchAniCatalog({sort:this.aniSort,search},result,controller.signal);if(this.aniRequest!==controller)return;this.aniCatalog.set(result);this.storage.write(key,{time:Date.now(),catalog:result});} }catch(e){if(this.aniRequest===controller)this.aniError.set(e instanceof Error&&e.name!=='AbortError'?e.message:'Richiesta scaduta. Riprova.');}finally{clearTimeout(timer);if(this.aniRequest===controller){this.aniRequest=null;this.aniLoading.set(false);}}}
 async loadMoreAniCharacters(){const id=this.aniSeries(),catalog=this.aniCatalog();if(id===null||!catalog||this.aniCharacterLoading())return;const controller=new AbortController();this.aniCharacterRequest=controller;this.aniCharacterLoading.set(true);this.aniCharacterError.set('');const timer=setTimeout(()=>controller.abort(),15000);try{const result=await fetchAniCharacters(catalog,id,controller.signal);if(this.aniCharacterRequest!==controller)return;this.aniCatalog.set(result);this.storage.write(this.aniKey,{time:Date.now(),catalog:result});}catch(e){if(this.aniCharacterRequest===controller)this.aniCharacterError.set(e instanceof Error&&e.name!=='AbortError'?e.message:'Richiesta scaduta. Riprova.');}finally{clearTimeout(timer);if(this.aniCharacterRequest===controller){this.aniCharacterRequest=null;this.aniCharacterLoading.set(false);}}}
 aniHasMoreCharacters(id:number){return !!this.aniCatalog()?.media.find(item=>item.id===id)?.hasMoreCharacters;}
 openGallery(style:string){this.galleryReturnFocus=style;this.galleryStyle.set(style);this.galleryItems.set([]);this.imageError.set(false);this.loadMoreGallery();this.focus('[data-gallery-first]');}
 closeGallery(){this.aniRequest?.abort();this.aniRequest=null;this.aniLoading.set(false);clearTimeout(this.galleryTimer);this.galleryLoading.set(false);this.galleryStyle.set('');this.focus(this.galleryReturnFocus==='anilist'?'[data-anilist-open]':this.favoritesOnly()&&!this.favoriteStyles().includes(this.galleryReturnFocus)?'[data-favorites-filter]':'[data-gallery-open="'+this.galleryReturnFocus+'"]');}
 loadMoreGallery(){const style=this.galleryStyle();if(!style||this.galleryLoading()||this.galleryItems().length>=240)return;const start=this.galleryItems().length;this.galleryItems.update(items=>[...items,...Array.from({length:Math.min(50,240-start)},(_,i)=>'dicebear10:'+style+':gallery-'+(start+i))]);this.galleryLoading.set(true);this.galleryTimer=setTimeout(()=>this.galleryLoading.set(false),1300);}
 onGalleryScroll(event:Event){if(!this.galleryStyle()||this.galleryStyle()==='anilist')return;const target=event.target as HTMLElement;if(target.scrollHeight-target.scrollTop-target.clientHeight<400)this.loadMoreGallery();}
 chooseGalleryAvatar(item:string){const style=this.galleryStyle();this.selectAvatar(style,item);this.closeGallery();}
 readonly favoriteStyles=signal<string[]>([]);readonly favoritesOnly=signal(false);
 visibleStyles(){return this.favoritesOnly()?this.styles().filter(style=>this.favoriteStyles().includes(style)):this.styles();}
 toggleFavorite(style:string){const removing=this.favoriteStyles().includes(style);const next=removing?this.favoriteStyles().filter(item=>item!==style):[...this.favoriteStyles(),style];if(this.id&&!this.storage.write('avatarStyleFavorites.'+this.id,next)){this.error.set('Impossibile salvare gli stili preferiti.');return;}this.favoriteStyles.set(next);if(removing&&this.favoritesOnly()&&!this.galleryStyle())this.focus('[data-favorites-filter]');}
 style='adventurer';private cooldown:ReturnType<typeof setTimeout>|undefined;
 private catalogRequest:AbortController|null=null;private catalogLoaded=false;
 variants(style:string){const batch=this.batches()[style]||0;return Array.from({length:4},(_,i)=>'dicebear10:'+style+':variant-'+batch+'-'+i);}
 regenerate(style:string){if(this.cooling())return;this.batches.update(old=>({...old,[style]:(old[style]||0)+1}));this.imageError.set(false);this.cooling.set(true);clearTimeout(this.cooldown);this.cooldown=setTimeout(()=>this.cooling.set(false),1200);}
 selectAvatar(style:string,item:string,info?:AvatarInfo){this.style=style;this.avatar=item;this.avatarInfo=info;}
 avatarDescription(){const match=this.avatar.match(/^(?:dicebear|dicebear10):([^:]+):/);if(match)return {name:this.styleLabel(match[1]),detail:'Stile avatar'};if(this.avatarInfo)return {name:this.avatarInfo.name,detail:this.avatarInfo.anime};return {name:this.avatar.startsWith('generated:')?'Avatar originale':'Immagine profilo',detail:''};}
 randomizeAvatar(){
  const previous=this.avatar;let next=randomProfileAvatar(this.styles());
  if(next===previous)next=next+'-alt';
  const match=next.match(/^dicebear10:([^:]+):/);this.selectAvatar(match?.[1]||'adventurer',next);this.imageError.set(false);
 }
 async randomizeAnime(){if(this.aniLoading())return;if(!this.aniCatalog()?.items.length)await this.loadAni(true);const items=this.aniCatalog()?.items||[];if(!items.length){this.aniError.set('Nessun personaggio disponibile. Riprova dalla scheda Personaggi anime.');this.avatarTab.set('anime');return;}const choices=items.filter(item=>item.image!==this.avatar);const pool=choices.length?choices:items;const selected=pool[Math.floor(Math.random()*pool.length)];this.selectAvatar('anilist',selected.image,{name:selected.name,anime:selected.anime});this.imageError.set(false);}
 randomizeBoth(){this.randomizeAvatar();void this.suggestName();}
 styleLabel(value:string){return value.split('-').map(word=>word.charAt(0).toUpperCase()+word.slice(1)).join(' ');}
 async loadCatalog(){
  if(this.catalogLoaded)return;this.catalogLoaded=true;
  const cached=normalizeAvatarStyles(this.storage.read('avatarStyles',[]));if(cached.length)this.styles.set(cached);
  const controller=new AbortController();this.catalogRequest=controller;this.catalogLoading.set(true);const timer=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch('https://api.dicebear.com/10.x',{signal:controller.signal,credentials:'omit'});if(!response.ok)throw Error('Catalogo non disponibile');const body=await response.json();const styles=normalizeAvatarStyles(body?.styles);if(!styles.length)throw Error('Catalogo vuoto');this.styles.set(styles);this.storage.write('avatarStyles',styles);}
  catch{if(this.catalogRequest===controller)this.catalogNotice.set('Catalogo online non disponibile: mostriamo gli stili salvati.');}
  finally{clearTimeout(timer);if(this.catalogRequest===controller)this.catalogLoading.set(false);}
 }
 ngOnDestroy(){this.aniCharacterRequest?.abort();this.aniRequest?.abort();this.cancelNameRequest();clearTimeout(this.cooldown);clearTimeout(this.galleryTimer);this.catalogRequest?.abort();this.catalogRequest=null;}
 name='';avatar='generated:0';avatarInfo:AvatarInfo|undefined;id:string|undefined;
 ngAfterViewInit(){this.focus('[data-profile-first]');}
 private focus(selector:string){setTimeout(()=>{const target=this.element.nativeElement.querySelector<HTMLElement>(selector);target?.focus({preventScroll:true});target?.scrollIntoView({block:'nearest',inline:'nearest'});});}
 focusAllStyles(){this.focus('[data-all-styles]');}
 readonly nameLoading=signal(false);private nameRequest:AbortController|null=null;
 private cancelNameRequest(){this.nameRequest?.abort();this.nameRequest=null;this.nameLoading.set(false);}
 nameChanged(){this.cancelNameRequest();}
 async suggestName(){
  this.cancelNameRequest();const previous=this.name,editingId=this.id,excluded={id:'',name:previous,avatar:''};
  this.name=randomProfileName([...this.storage.profiles().filter(profile=>profile.id!==editingId),excluded]);const fallback=this.name;this.error.set('');
  const controller=new AbortController();this.nameRequest=controller;this.nameLoading.set(true);const timer=setTimeout(()=>controller.abort(),7000);
  try{
   const response=await fetch('https://tinytools.cc/api/v1/username?count=12&numbers=false&capitalize=true&separator=-',{credentials:'omit',signal:controller.signal});
   if(!response.ok)throw Error('TinyTools unavailable');const data=await response.json();
   if(this.nameRequest!==controller||controller.signal.aborted||!this.editing()||this.id!==editingId||this.name!==fallback)return;
   const candidate=tinyToolsProfileName(data,[...this.storage.profiles().filter(profile=>profile.id!==editingId),excluded]);if(candidate)this.name=candidate;
  }catch{/* Keep the immediately available local suggestion. */}
  finally{clearTimeout(timer);if(this.nameRequest===controller){this.nameRequest=null;this.nameLoading.set(false);}}
 }
 edit(profile?:Profile){this.cancelNameRequest();this.avatarTab.set('styles');this.id=profile?.id;this.name=profile?profile.name:randomProfileName(this.storage.profiles());this.favoriteAnime.set(profile?this.storage.read('avatarAnimeFavorites.'+profile.id,[]):[]);this.favoriteAnimeOnly.set(false);this.animeBatches.set({});this.favoriteStyles.set(profile?normalizeAvatarStyles(this.storage.read('avatarStyleFavorites.'+profile.id,[])):[]);this.favoritesOnly.set(false);this.avatar=profile?profile.avatar:randomProfileAvatar(this.styles());this.avatarInfo=profile?.avatarInfo;this.style=this.avatar.match(/^(?:dicebear|dicebear10):([^:]+):/)?.[1]||'adventurer';if(!this.styles().includes(this.style))this.styles.update(styles=>[this.style,...styles]);this.batches.set({});void this.loadCatalog();this.error.set('');this.editing.set(true);if(!profile)void this.suggestName();this.focus('#profile-name');}
 choose(profile:Profile){try{this.storage.selectProfile(profile.id);if(profile.id===this.storage.profileId)this.closed.emit();}catch(e){this.fail(e);}}
 save(){try{const profile=this.storage.saveProfile(this.name,this.avatar,this.id,this.avatarInfo);this.id=profile.id;if(!this.storage.write('avatarAnimeFavorites.'+profile.id,this.favoriteAnime()))throw Error('Profilo salvato, ma impossibile salvare le serie preferite.');if(!this.storage.write('avatarStyleFavorites.'+profile.id,this.favoriteStyles()))throw Error('Profilo salvato, ma impossibile salvare gli stili preferiti.');this.cancel();}catch(e){this.fail(e);}}
 cancel(){this.cancelNameRequest();this.editing.set(false);this.error.set('');this.focus(this.id?'[data-edit-profile="'+this.id+'"]':'[data-create-profile]');}
 private fail(e:unknown){this.error.set(e instanceof Error?e.message:String(e));}
}
