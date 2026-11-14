import {Component,inject,signal,output,OnDestroy,AfterViewInit,HostListener,ElementRef} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {StorageService} from '../core/storage.service';
import {Profile,avatarUrl,normalizeAvatarStyles,randomProfileAvatar,randomProfileName,tinyToolsProfileName} from '../core/profiles';
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
 openGallery(style:string){this.galleryReturnFocus=style;this.galleryStyle.set(style);this.galleryItems.set([]);this.imageError.set(false);this.loadMoreGallery();this.focus('[data-gallery-first]');}
 closeGallery(){clearTimeout(this.galleryTimer);this.galleryLoading.set(false);this.galleryStyle.set('');this.focus(this.favoritesOnly()&&!this.favoriteStyles().includes(this.galleryReturnFocus)?'[data-favorites-filter]':'[data-gallery-open="'+this.galleryReturnFocus+'"]');}
 loadMoreGallery(){const style=this.galleryStyle();if(!style||this.galleryLoading()||this.galleryItems().length>=240)return;const start=this.galleryItems().length;this.galleryItems.update(items=>[...items,...Array.from({length:Math.min(50,240-start)},(_,i)=>'dicebear10:'+style+':gallery-'+(start+i))]);this.galleryLoading.set(true);this.galleryTimer=setTimeout(()=>this.galleryLoading.set(false),1300);}
 onGalleryScroll(event:Event){if(!this.galleryStyle())return;const target=event.target as HTMLElement;if(target.scrollHeight-target.scrollTop-target.clientHeight<400)this.loadMoreGallery();}
 chooseGalleryAvatar(item:string){const style=this.galleryStyle();this.selectAvatar(style,item);this.closeGallery();}
 readonly favoriteStyles=signal<string[]>([]);readonly favoritesOnly=signal(false);
 visibleStyles(){return this.favoritesOnly()?this.styles().filter(style=>this.favoriteStyles().includes(style)):this.styles();}
 toggleFavorite(style:string){const removing=this.favoriteStyles().includes(style);const next=removing?this.favoriteStyles().filter(item=>item!==style):[...this.favoriteStyles(),style];if(this.id&&!this.storage.write('avatarStyleFavorites.'+this.id,next)){this.error.set('Impossibile salvare gli stili preferiti.');return;}this.favoriteStyles.set(next);if(removing&&this.favoritesOnly()&&!this.galleryStyle())this.focus('[data-favorites-filter]');}
 style='adventurer';private cooldown:ReturnType<typeof setTimeout>|undefined;
 private catalogRequest:AbortController|null=null;private catalogLoaded=false;
 variants(style:string){const batch=this.batches()[style]||0;return Array.from({length:4},(_,i)=>'dicebear10:'+style+':variant-'+batch+'-'+i);}
 regenerate(style:string){if(this.cooling())return;this.batches.update(old=>({...old,[style]:(old[style]||0)+1}));this.imageError.set(false);this.cooling.set(true);clearTimeout(this.cooldown);this.cooldown=setTimeout(()=>this.cooling.set(false),1200);}
 selectAvatar(style:string,item:string){this.style=style;this.avatar=item;}
 randomizeAvatar(){
  const previous=this.avatar;let next=randomProfileAvatar(this.styles());
  if(next===previous)next=next+'-alt';
  const match=next.match(/^dicebear10:([^:]+):/);this.selectAvatar(match?.[1]||'adventurer',next);this.imageError.set(false);
 }
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
 ngOnDestroy(){this.cancelNameRequest();clearTimeout(this.cooldown);clearTimeout(this.galleryTimer);this.catalogRequest?.abort();this.catalogRequest=null;}
 name='';avatar='generated:0';id:string|undefined;
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
 edit(profile?:Profile){this.cancelNameRequest();this.id=profile?.id;this.name=profile?profile.name:randomProfileName(this.storage.profiles());this.favoriteStyles.set(profile?normalizeAvatarStyles(this.storage.read('avatarStyleFavorites.'+profile.id,[])):[]);this.favoritesOnly.set(false);this.avatar=profile?profile.avatar:randomProfileAvatar(this.styles());this.style=this.avatar.match(/^(?:dicebear|dicebear10):([^:]+):/)?.[1]||'adventurer';if(!this.styles().includes(this.style))this.styles.update(styles=>[this.style,...styles]);this.batches.set({});void this.loadCatalog();this.error.set('');this.editing.set(true);if(!profile)void this.suggestName();this.focus('#profile-name');}
 choose(profile:Profile){try{this.storage.selectProfile(profile.id);if(profile.id===this.storage.profileId)this.closed.emit();}catch(e){this.fail(e);}}
 save(){try{const profile=this.storage.saveProfile(this.name,this.avatar,this.id);this.id=profile.id;if(!this.storage.write('avatarStyleFavorites.'+profile.id,this.favoriteStyles()))throw Error('Profilo salvato, ma impossibile salvare gli stili preferiti.');this.cancel();}catch(e){this.fail(e);}}
 cancel(){this.cancelNameRequest();this.editing.set(false);this.error.set('');this.focus(this.id?'[data-edit-profile="'+this.id+'"]':'[data-create-profile]');}
 private fail(e:unknown){this.error.set(e instanceof Error?e.message:String(e));}
}
