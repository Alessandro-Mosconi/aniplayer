import {Component,input,output} from '@angular/core';
@Component({selector:'app-tv-switch',standalone:true,template:`
 <button type="button" data-tv-click class="tv-switch" role="switch" [attr.aria-checked]="checked()" [attr.aria-label]="label()" [disabled]="disabled()" (click)="changed.emit(!checked())">
 <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span><span>{{label()}}</span><strong>{{checked()?'Attivo':'Disattivo'}}</strong></button>`,styles:[`
 :host{display:inline-block;max-width:100%}.tv-switch{display:flex;align-items:center;gap:16px;flex-wrap:wrap;text-align:left;max-width:100%;background:#182338;border:2px solid #66758c}.tv-switch strong{font-size:18px;color:#bec8da}.switch-track{display:inline-block;position:relative;width:62px;height:34px;border-radius:22px;background:#5b6577;flex:none;border:2px solid #b5bfce}.switch-thumb{position:absolute;left:3px;top:3px;width:24px;height:24px;border-radius:50%;background:white;transition:transform .15s}.tv-switch[aria-checked=true] .switch-track{background:#227c61;border-color:#9de9cb}.tv-switch[aria-checked=true] .switch-thumb{transform:translateX(28px)}.tv-switch[aria-checked=true] strong{color:#a5edce}.tv-switch:focus{outline:4px solid white;outline-offset:4px}
 :host(.menu-switch){display:block;width:100%;min-width:0}:host(.menu-switch) .tv-switch{box-sizing:border-box;width:100%;flex-wrap:nowrap;gap:10px;padding:8px 12px}:host(.menu-switch) .tv-switch>span:not(.switch-track){flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}:host(.menu-switch) .tv-switch strong{flex:none;white-space:nowrap}
 `]})
export class TvSwitchComponent {
 readonly label=input.required<string>();readonly checked=input(false);readonly disabled=input(false);readonly changed=output<boolean>();
}
