import {AfterViewInit,Component,ElementRef,OnDestroy,ViewChild,inject,output,signal} from '@angular/core';
import QRCode from 'qrcode';
import {StorageService} from '../core/storage.service';
import {RemoteService} from '../core/remote.service';
import {opticalBackup} from '../core/optical-backup';
import {DecimenV3Encoder} from '../core/optical/decimen-v3';
import {QrCodeComponent} from './qr-code.component';

@Component({selector:'app-optical-export',standalone:true,imports:[QrCodeComponent],templateUrl:'./optical-export.component.html',styleUrl:'./optical-export.component.scss'})
export class OpticalExportComponent implements AfterViewInit,OnDestroy{
 readonly closed=output<void>();private store=inject(StorageService);private remote=inject(RemoteService);
 @ViewChild('canvas') canvas?:ElementRef<HTMLCanvasElement>;
 readonly receiver='https://decimen.app/receive/';
 readonly streaming=signal(false);readonly paused=signal(false);readonly error=signal('');readonly size=signal(0);readonly frames=signal(0);readonly totalFrames=signal(0);
 private encoder:DecimenV3Encoder|null=null;private timer:ReturnType<typeof setTimeout>|undefined;private generation=0;
 ngAfterViewInit(){setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-optical-start]')));}
 start(){try{
  const payload=opticalBackup(this.store),id=(crypto.getRandomValues(new Uint16Array(1))[0]||1);
  this.encoder=new DecimenV3Encoder(payload,620,id);this.size.set(payload.length);this.totalFrames.set(this.encoder.k);this.frames.set(0);this.error.set('');this.paused.set(false);this.streaming.set(true);
  const generation=++this.generation;setTimeout(()=>{this.remote.focus(document.querySelector<HTMLElement>('[data-optical-pause]'));this.draw(generation);});
 }catch(e){this.error.set(e instanceof Error?e.message:'Impossibile preparare il backup.');}}
 private draw(generation:number){
  if(generation!==this.generation||!this.streaming()||this.paused()||!this.encoder)return;
  try{const canvas=this.canvas?.nativeElement,ctx=canvas?.getContext('2d');if(!canvas||!ctx)throw Error('Schermo QR non disponibile.');
   const qr=QRCode.create([{data:this.encoder.encodeNext().bytes,mode:'byte'} as unknown as QRCode.QRCodeSegment],{errorCorrectionLevel:'L',maskPattern:4});
   const margin=4,size=qr.modules.size,total=size+2*margin;canvas.width=total;canvas.height=total;ctx.fillStyle='#fff';ctx.fillRect(0,0,total,total);ctx.fillStyle='#000';
   for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(qr.modules.data[y*size+x])ctx.fillRect(x+margin,y+margin,1,1);
   this.frames.update(n=>n+1);this.timer=setTimeout(()=>this.draw(generation),150);
  }catch(e){this.error.set(e instanceof Error?e.message:'Impossibile mostrare il QR.');this.streaming.set(false);}
 }
 toggle(){if(!this.streaming())return;const paused=!this.paused();this.paused.set(paused);if(!paused)this.draw(this.generation);else clearTimeout(this.timer);}
 close(){this.stop();this.closed.emit();}
 private stop(){++this.generation;clearTimeout(this.timer);this.streaming.set(false);this.encoder=null;}
 ngOnDestroy(){this.stop();}
}
