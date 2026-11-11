import {Component} from '@angular/core';
@Component({selector:'app-loading-dots',standalone:true,template:'<span class="dots" aria-hidden="true"><span>...</span></span>',styles:[`
 :host{display:inline-block;vertical-align:baseline}.dots{font-family:monospace;display:inline-block;width:3ch;text-align:left;vertical-align:bottom}.dots>span{display:block;overflow:hidden;white-space:nowrap;width:1ch;animation:loading-dots 1.8s step-end infinite}
 @keyframes loading-dots{0%,32%{width:1ch}33%,65%{width:2ch}66%,100%{width:3ch}}
 @media(prefers-reduced-motion:reduce){.dots>span{animation:none;width:3ch}}
 `]})
export class LoadingDotsComponent {}
