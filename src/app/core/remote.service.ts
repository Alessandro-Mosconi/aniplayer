import {Injectable, signal} from '@angular/core';
import {TizenService} from './tizen.service';

export type RemoteDirection='up'|'down'|'left'|'right';
@Injectable({providedIn:'root'})
export class RemoteService {
  readonly lastKey=signal('');
  private history:string[]=[];
  private verticalX:number|null=null;
  private listener:(event:KeyboardEvent)=>boolean=()=>false;
  private backHandler:()=>void=()=>{};
  private playerActive:()=>boolean=()=>false;
  private exploreHandler:((event:KeyboardEvent)=>boolean)|null=null;
  setExploreHandler(handler:((event:KeyboardEvent)=>boolean)|null){this.exploreHandler=handler;}
  constructor(private tv:TizenService){
    this.tv.setKeys();
    document.addEventListener('keydown',e=>this.onKey(e),true);
    document.addEventListener('focusout',e=>{const el=e.target;if((el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)&&el.hasAttribute('data-tv-input'))el.readOnly=true;});
  }
  configure(handlers:{player:(e:KeyboardEvent)=>boolean;back:()=>void;playerActive:()=>boolean}){
    this.listener=handlers.player;this.backHandler=handlers.back;this.playerActive=handlers.playerActive;
  }
  private key(e:KeyboardEvent):string {
    const code=e.keyCode||e.which;
    return ({37:'ArrowLeft',38:'ArrowUp',39:'ArrowRight',40:'ArrowDown',13:'Enter',65376:'Enter',65385:'Escape',10009:'Back',8:'Backspace',27:'Escape',415:'MediaPlay',19:'MediaPause',10252:'MediaPlayPause',413:'MediaStop',417:'MediaFastForward',412:'MediaRewind'} as Record<number,string>)[code]||e.key;
  }
  private onKey(e:KeyboardEvent){
    const key=this.key(e);this.lastKey.set(key);
    if(this.playerActive()&&this.listener(e)){e.preventDefault();e.stopPropagation();return;}
    if(!this.playerActive()&&this.exploreHandler?.(e)){e.preventDefault();e.stopPropagation();return;}
    const dialog=document.querySelector<HTMLElement>('[data-tv-dialog]');
    if(dialog&&['Back','BrowserBack','Escape'].includes(key)){e.preventDefault();e.stopPropagation();if(!e.repeat)dialog.querySelector<HTMLElement>('[data-dialog-cancel]')?.click();return;}
    const field=document.activeElement;
    if((field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement)&&field.hasAttribute('data-tv-input')){
      if(key==='Enter'){
        e.preventDefault();e.stopPropagation();
        if(e.repeat)return;
        if(field.readOnly){field.readOnly=false;field.blur();field.readOnly=false;field.focus({preventScroll:true});}
        else {field.readOnly=true;field.blur();this.focus(field);const search=field.closest('.search-line');if(search)search.querySelector<HTMLElement>('[data-search-submit],[data-focus="catalog-submit"]')?.click();}
        return;
      }
      if(['Back','BrowserBack','Escape'].includes(key)&&!field.readOnly){
        e.preventDefault();e.stopPropagation();field.readOnly=true;field.blur();this.focus(field);return;
      }
    }
    if(['Back','BrowserBack','Escape'].includes(key)){
      const close=document.querySelector<HTMLElement>('[data-filter-close]');
      if(close){e.preventDefault();e.stopPropagation();close.click();return;}
    }
    // Return while editing dismisses the input/select instead of losing the page.
    if(['Back','Escape'].includes(key)&&this.editing()){
      const el=document.activeElement as HTMLElement;
      if(el.closest('.search-line')||el.closest('.filter-bar')){
        e.preventDefault();e.stopPropagation();el.blur();
        this.verticalX=null;
        this.focus(document.querySelector<HTMLElement>('[data-focus="catalog-submit"]'));
        return;
      }
    }
    if(['Back','BrowserBack','Escape'].includes(key)||(key==='Backspace'&&!this.editing())){
      e.preventDefault();e.stopPropagation();this.backHandler();return;
    }
    if(this.editing()){
      if(key==='ArrowDown'||key==='ArrowUp'){
        const active=document.activeElement as HTMLElement;
        if(active.closest('.search-line')){
          e.preventDefault();e.stopPropagation();active.blur();
          this.verticalX=null;
          const personal=!!active.closest('app-my-anime-page');const next=key==='ArrowDown'?document.querySelector<HTMLElement>(personal?'[data-focus="my-filter-status"]':'[data-focus="filter-audio"]'):document.querySelector<HTMLElement>(personal?'[data-focus="nav-my-anime"]':'[data-focus="nav-catalog"]');
          this.focus(next||document.querySelector<HTMLElement>('.sidebar nav button'));return;
        }
      }
      // Text fields keep Left/Right for the caret; Up/Down always leave the field.
      if(!(document.activeElement instanceof HTMLSelectElement)&&(key==='ArrowDown'||key==='ArrowUp')){
        e.preventDefault();e.stopPropagation();this.move(key==='ArrowDown'?'down':'up');
      }
      return;
    }
    // The plot is a TV-focusable internal scroll region, not merely a scrollbar.
    const active=document.activeElement as HTMLElement|null;
    if(active?.matches('.detail-plot[tabindex="0"]')&&(key==='ArrowDown'||key==='ArrowUp')){
      const delta=key==='ArrowDown'?128:-128,limit=active.scrollHeight-active.clientHeight;
      if((delta>0&&active.scrollTop<limit-2)||(delta<0&&active.scrollTop>2)){
        e.preventDefault();e.stopPropagation();active.scrollTop=Math.max(0,Math.min(limit,active.scrollTop+delta));return;
      }
    }
    if(key==='Enter'&&document.activeElement?.getAttribute('role')==='slider')return;
    const dir=({ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'} as Record<string,RemoteDirection>)[key];
    if(dir){e.preventDefault();e.stopPropagation();this.move(dir);}
    else if(key==='Enter'&&document.activeElement instanceof HTMLElement&&document.activeElement.matches('[data-tv-click]')){e.preventDefault();document.activeElement.click();}
  }
  private editing(){const el=document.activeElement;return !!el&&(((el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)&&!el.readOnly)||el instanceof HTMLSelectElement||el.getAttribute('contenteditable')==='true');}
  focusables():HTMLElement[]{return [...document.querySelectorAll<HTMLElement>('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')]
    .filter(el=>{const dialog=document.querySelector('[data-tv-dialog]');if(dialog&&!dialog.contains(el))return false;if(el.closest('[hidden],[inert],[aria-hidden="true"]'))return false;const rect=el.getBoundingClientRect();return rect.width>1&&rect.height>1&&getComputedStyle(el).visibility!=='hidden';});}
  focus(el:HTMLElement|null|undefined){if(!el)return;el.focus({preventScroll:true});
    const rect=el.getBoundingClientRect();
    const top=(el.closest('app-catalog-page')||el.closest('app-my-anime-page'))&&!el.closest('.search-line')?152:56;
    if(rect.top<top||rect.bottom>window.innerHeight-56||rect.left<0||rect.right>window.innerWidth)el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'} as ScrollIntoViewOptions);
  }
  remember(){const key=(document.activeElement as HTMLElement)?.dataset?.focus;if(key){this.history.push(key);if(this.history.length>25)this.history.shift();}}
  restore(){const key=this.history.pop();const el=key?document.querySelector<HTMLElement>(`[data-focus="${CSS.escape(key)}"]`):null;this.focus(el||this.focusables()[0]);}
  first(scope?:HTMLElement){this.verticalX=null;const list=this.focusables().filter(e=>!scope||scope.contains(e));this.focus(list[0]);}
  move(dir:RemoteDirection){
    const all=this.focusables();if(!all.length)return;
    const active=document.activeElement instanceof HTMLElement?document.activeElement:null;
    if(!active||!all.includes(active)){this.focus(all[0]);return;}
    // Vertical navigation stays in the page instead of unexpectedly jumping to the sidebar.
    const content=document.getElementById('view');
    const row=active.closest('[data-focus-row]');
    if(row&&(dir==='left'||dir==='right')){
      const siblings=all.filter(el=>row.contains(el)),index=siblings.indexOf(active);
      const next=siblings[index+(dir==='right'?1:-1)];
      if(next){this.verticalX=null;this.focus(next);return;}
    }
    const items=content?.contains(active)&&['up','down'].includes(dir) ? all.filter(el=>content.contains(el)):all;
    const source=active.getBoundingClientRect();const sx=source.left+source.width/2,sy=source.top+source.height/2;
    if(dir==='left'||dir==='right')this.verticalX=null;
    const refX=this.verticalX??sx;
    const scored=items.filter(el=>el!==active).map(el=>{
      const r=el.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
      if(dir==='up'&&r.bottom>source.top+3||dir==='down'&&r.top<source.bottom-3)return null;
      const main=dir==='left'?sx-x:dir==='right'?x-sx:dir==='up'?sy-y:y-sy;
      if(main<3)return null;
      const cross=dir==='left'||dir==='right'?Math.abs(y-sy):Math.abs(x-refX);
      const overlap=dir==='left'||dir==='right'?Math.max(0,Math.min(source.bottom,r.bottom)-Math.max(source.top,r.top)):Math.max(0,Math.min(source.right,r.right)-Math.max(source.left,r.left));
      return {el,score:main+cross*(overlap>0?.12:2.6)};
    }).filter((a):a is {el:HTMLElement;score:number}=>!!a).sort((a,b)=>a.score-b.score);
    // A wide search field must win over a nearby button on the current row.
    if(dir==='up'||dir==='down'){
      const aligned=scored.filter(({el})=>{const r=el.getBoundingClientRect();return Math.min(source.right,r.right)-Math.max(source.left,r.left)>0;});
      if(aligned.length)scored.splice(0,scored.length,...aligned);
    }
    if(scored[0]){if((dir==='up'||dir==='down')&&this.verticalX===null)this.verticalX=sx;this.focus(scored[0].el);}
    else if(dir==='up'){
      // Headings and the hero are not focusable. The last Up must reveal them,
      // not stop on the highest button at the current scroll position.
      window.scrollTo({top:0,behavior:'auto' as ScrollBehavior});
      document.scrollingElement?.scrollTo({top:0,behavior:'auto' as ScrollBehavior});
      document.querySelector<HTMLElement>('.workspace')?.scrollTo({top:0,behavior:'auto' as ScrollBehavior});
      document.getElementById('view')?.scrollTo({top:0,behavior:'auto' as ScrollBehavior});
    }
  }
}
