import {LoadingDotsComponent} from '../../components/loading-dots.component';
import {TvSwitchComponent} from '../../components/tv-switch.component';
import {Component,inject,signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PageBase} from '../../core/page-base';
import {cleanError} from '../../core/models';
import {FormsModule} from '@angular/forms';
import {QrCodeComponent} from '../../components/qr-code.component';
import {MAL_MANUAL_REDIRECT} from '../../core/mal.service';
import {MalPhoneRelayService} from '../../core/mal-phone-relay.service';
import {MalPublicService} from '../../core/mal-public.service';
@Component({selector:'app-mal-page',standalone:true,imports:[LoadingDotsComponent,TvSwitchComponent,CommonModule,FormsModule,QrCodeComponent],templateUrl:'./mal.page.html',styleUrl:'./mal.page.scss'})
export class MalPage extends PageBase {
  readonly manualRedirect=MAL_MANUAL_REDIRECT;
  readonly phoneRelay=inject(MalPhoneRelayService);
  readonly publicMal=inject(MalPublicService);
  readonly mode=signal<'public'|'account'>(this.nav.route().filters?.['malMode']==='account'?'account':'public');
  readonly publicUsername=signal(this.publicMal.username()||this.mal.session()?.user?.name||'');
  readonly advanced=signal(false);
  readonly setupMessage=signal('');
  readonly reauthorize=signal(false);
  constructor(){super();if(!this.phoneRelay.address())this.phoneRelay.address.set(this.storage.read('malRelayAddress',''));}
  setMode(mode:'public'|'account'){this.mode.set(mode);if(mode==='public'&&!this.publicUsername())this.publicUsername.set(this.mal.session()?.user?.name||'');}
  async importPublic(){await this.publicMal.importUsername(this.publicUsername());setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-focus="mal-public-result"]')));}
  async startPhoneRelay(){try{this.malRedirect.set(this.manualRedirect);this.mal.configure(this.malClient(),this.malRedirect());this.error.set('');await this.phoneRelay.start();this.storage.write('malRelayAddress',this.phoneRelay.address());setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-focus="mal-relay-qr"]')));}catch{this.error.set(this.phoneRelay.status()||'Indirizzo PC non valido. Usa quello mostrato dal comando npm run mal:relay.');}}
  configureMal(){try{this.mal.configure(this.malClient(),this.malRedirect());this.setupMessage.set('Configurazione salvata.');this.error.set('');}catch(e){this.error.set(cleanError(e));}}
  beginMal(){try{this.mal.configure(this.malClient(),this.malRedirect());this.mal.begin();}catch(e){this.error.set(cleanError(e));}}
  resumeMal(){try{this.mal.configure(this.malClient(),this.malRedirect());this.mal.begin(true);}catch(e){this.error.set(cleanError(e));}}
  phoneMal(){try{this.phoneRelay.stop();this.mal.configure(this.malClient(),this.malRedirect());this.mal.begin(false,false);this.error.set('');setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-focus="mal-phone-qr"]')));}catch(e){this.error.set(cleanError(e));}}
  manualPhoneMal(){this.malRedirect.set(this.manualRedirect);this.phoneMal();}
  async completeMal(){
    this.error.set('');
    try{await this.mal.complete(this.malCallback());this.malCallback.set('');}
    catch(e){this.error.set(cleanError(e));}
    finally{setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-focus="mal-connection-result"]')));}
  }
  async syncMal(){try{await this.mal.sync();}catch(e){this.error.set(cleanError(e));}}
  async reconnectMal(){this.error.set('');try{await this.mal.reconnect();this.reauthorize.set(false);}catch{}finally{setTimeout(()=>this.remote.focus(document.querySelector<HTMLElement>('[data-focus="mal-connection-result"]')));}}
  clearMalDownloads(){this.mal.clearDownloaded();this.publicMal.clearDownloaded();}
  forgetMal(){this.phoneRelay.stop();this.mal.forgetAccount();this.reauthorize.set(false);this.malCallback.set('');}
}
