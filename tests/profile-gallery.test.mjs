import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('gallery loads bounded batches, retains selection and restores focus when filtered',()=>{
 const signal=value=>Object.assign(()=>value,{set:v=>value=v,update:f=>value=f(value)});
 let timer=0;const timers=new Map(),focus=[];
 const storage={read:(_k,v)=>v,write:()=>true};const element={nativeElement:{querySelector:selector=>({focus(){focus.push(selector);},scrollIntoView(){}})}};
 const angular={Component:()=>x=>x,HostListener:()=>()=>{},signal,output:()=>({emit(){}}),ElementRef:class{},inject:type=>type?.name==='StorageService'?storage:element};
 const exports={};const source=readFileSync('src/app/components/profiles.component.ts','utf8');
 const dependencies={'@angular/core':angular,'@angular/forms':{FormsModule:class{}},'../core/storage.service':{StorageService:class StorageService{}},'../core/profiles':{avatarUrl:()=>'',normalizeAvatarStyles:x=>x},'../core/avatar-styles':{AVATAR_STYLES:['pixel-art']},'./profile-avatar.directive':{},'./anime-loader.component':{}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,useDefineForClassFields:false}}).outputText,{exports,require:key=>dependencies[key],setTimeout:fn=>{const id=++timer;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),AbortController,Array,Set});
 const component=new exports.ProfilesComponent();component.openGallery('pixel-art');assert.equal(component.galleryItems().length,50);
 component.loadMoreGallery();assert.equal(component.galleryItems().length,50);
 timers.get(component.galleryTimer)();component.onGalleryScroll({target:{scrollHeight:1000,scrollTop:700,clientHeight:250}});assert.equal(component.galleryItems().length,100);
 const chosen=component.galleryItems()[70];component.chooseGalleryAvatar(chosen);assert.equal(component.avatar,chosen);assert.equal(component.galleryStyle(),'');
 const pending=[...timers.values()];for(const callback of pending)callback();assert.ok(focus.some(x=>x.includes('data-gallery-open')));
 component.openGallery('pixel-art');component.favoriteStyles.set(['pixel-art']);component.favoritesOnly.set(true);component.toggleFavorite('pixel-art');component.closeGallery();for(const callback of [...timers.values()])callback();assert.ok(focus.includes('[data-favorites-filter]'));
});
