import {Component,input} from '@angular/core';
@Component({selector:'app-player-icon',standalone:true,template:`
 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
 @switch(name()){
  @case('play'){<path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/>}
  @case('pause'){<path d="M8 5v14M16 5v14" stroke-width="3"/>}
  @case('previous'){<path d="M5 5v14"/><path d="m19 5-11 7 11 7Z" fill="currentColor" stroke="none"/>}
  @case('next'){<path d="M19 5v14"/><path d="m5 5 11 7-11 7Z" fill="currentColor" stroke="none"/>}
  @case('back'){<path d="M4 9a8 8 0 1 1 0 7M4 4v5h5"/><text x="12" y="15.5" text-anchor="middle" fill="currentColor" stroke="none" font-size="8" font-family="Arial">30</text>}
  @case('forward'){<path d="M20 9a8 8 0 1 0 0 7M20 4v5h-5"/><text x="12" y="15.5" text-anchor="middle" fill="currentColor" stroke="none" font-size="8" font-family="Arial">30</text>}
  @case('pip'){<rect x="3" y="5" width="18" height="14" rx="2"/><rect x="12" y="12" width="6" height="4" fill="currentColor" stroke="none"/>}
  @case('close'){<path d="m6 6 12 12M18 6 6 18"/>}
 }
 </svg>`,styles:[`:host{display:inline-flex;width:26px;height:26px;flex:none;pointer-events:none}svg{width:100%;height:100%}`]})
export class PlayerIconComponent {readonly name=input.required<'play'|'pause'|'previous'|'next'|'back'|'forward'|'pip'|'close'>();}
