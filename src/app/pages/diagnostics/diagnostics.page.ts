import {Component} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PageBase} from '../../core/page-base';
import {cleanError} from '../../core/models';
import {FormsModule} from '@angular/forms';
@Component({selector:'app-diagnostics-page',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./diagnostics.page.html',styleUrl:'./diagnostics.page.scss'})
export class DiagnosticsPage extends PageBase {
  async changeDomain(){try{this.loading.set(true);await this.catalog.setDomain(this.domainField());this.error.set('Dominio verificato e salvato.');}catch(e){this.error.set(cleanError(e));}finally{this.loading.set(false);}}
  async testNetwork(){try{this.loading.set(true);const [unity,world]=await Promise.allSettled([this.catalog.session(),this.animeworld.checkConnection()]);this.error.set('AnimeUnity: '+(unity.status==='fulfilled'?'raggiungibile':cleanError(unity.reason))+'. AnimeWorld: '+(world.status==='fulfilled'&&world.value?'raggiungibile':this.animeworld.connectionError()||'non raggiungibile')+'.');}finally{this.loading.set(false);}}
}
