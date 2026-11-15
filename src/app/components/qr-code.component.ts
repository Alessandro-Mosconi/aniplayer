import {AfterViewInit,Component,ElementRef,Input,OnChanges,ViewChild,signal} from '@angular/core';
declare const QRCode:{new(element:HTMLElement,options:{text:string;width:number;height:number;colorDark:string;colorLight:string;correctLevel:number}):unknown;CorrectLevel:{M:number}};

@Component({selector:'app-qr-code',standalone:true,template:'<div #code class="qr-code" role="img" [attr.aria-label]="label"></div>@if(error()){<p role="alert">{{error()}}</p>}',styles:['.qr-code{display:inline-block;background:#fff;padding:24px;border-radius:8px;line-height:0;max-width:100%;box-sizing:border-box}:host ::ng-deep .qr-code img,:host ::ng-deep .qr-code canvas{max-width:100%;height:auto}']})
export class QrCodeComponent implements AfterViewInit,OnChanges {
 @Input({required:true}) value='';
 @Input() label='QR per autorizzare AniPlayer su MyAnimeList';
 @ViewChild('code') private code?:ElementRef<HTMLElement>;
 readonly error=signal('');
 ngAfterViewInit(){this.draw();}
 ngOnChanges(){this.draw();}
 private draw(){
  if(!this.code)return;
  this.code.nativeElement.replaceChildren();this.error.set('');
  if(!this.value)return;
  try{new QRCode(this.code.nativeElement,{text:this.value,width:360,height:360,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});}
  catch{this.error.set('QR non disponibile: usa il link mostrato nella pagina.');}
 }
}
