import {Injectable,computed,signal} from '@angular/core';
import {Anime} from './models';
import {StorageService} from './storage.service';
export interface Exploration {anime:Anime;feedback:'like'|'dislike'|'neutral';viewedAt:number;}
@Injectable({providedIn:'root'})
export class ExplorationService {
 readonly records=signal<Record<string,Exploration>>(this.storage.read<Record<string,Exploration>>('explored',{})||{});
 readonly recent=computed(()=>Object.values(this.records()).sort((a,b)=>b.viewedAt-a.viewedAt));
 readonly stats=computed(()=>({total:this.recent().length,liked:this.recent().filter(r=>r.feedback==='like').length,disliked:this.recent().filter(r=>r.feedback==='dislike').length,neutral:this.recent().filter(r=>r.feedback==='neutral').length}));
 constructor(private storage:StorageService){}
 key(anime:Anime){return Number(anime.mal_id)>0?'mal:'+anime.mal_id:(anime.provider||'animeunity')+':'+anime.id;}
 get(anime:Anime){return this.records()[this.key(anime)];}
 mark(anime:Anime,feedback?:Exploration['feedback']){const key=this.key(anime),old=this.records()[key];const next={...this.records(),[key]:{anime,feedback:feedback||old?.feedback||'neutral',viewedAt:Date.now()}};if(!this.storage.write('explored',next))throw Error('Impossibile salvare la scelta sulla TV.');this.records.set(next);}
 matches(anime:Anime,filter:string|undefined){const record=this.get(anime);return !filter||filter==='all'||filter==='seen'&&!!record||filter==='never'&&!record||filter==='like'&&record?.feedback==='like'||filter==='dislike'&&record?.feedback==='dislike';}
 fingerprint(){return JSON.stringify(Object.entries(this.records()).map(([key,r])=>[key,r.feedback]));}
 restore(anime:Anime,record:Exploration|undefined){const next={...this.records()};if(record)next[this.key(anime)]=record;else delete next[this.key(anime)];this.persist(next);}
 resetFeedback(anime:Anime){const record=this.get(anime);if(record)this.restore(anime,{...record,feedback:'neutral'});}
 clearFeedback(feedback:'like'|'dislike'){const next={...this.records()};for(const key of Object.keys(next))if(next[key].feedback===feedback)next[key]={...next[key],feedback:'neutral'};this.persist(next);}
 private persist(next:Record<string,Exploration>){if(!this.storage.write('explored',next))throw Error('Impossibile salvare le modifiche sulla TV.');this.records.set(next);}
 clear(){if(!this.storage.write('explored',{}))throw Error('Impossibile eliminare le scelte salvate.');this.records.set({});}
}
