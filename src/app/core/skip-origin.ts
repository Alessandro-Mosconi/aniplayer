import type {IntroWindow} from './intro.service';

/** Compact player labels with accessible descriptions. */
export function skipOrigin(interval:IntroWindow|null|undefined,provisional=false,aligned=false){
 if(!interval)return {mark:'',short:'',label:'Intervallo non disponibile'};
 if(interval.source==='local')return {mark:'✎',short:'Manuale',label:'Intervallo manuale'};
 if(aligned||interval.basis==='aniskip')return {mark:'A+AUD',short:'AniSkip + audio',label:'AniSkip verificato con audio'};
 if(interval.source==='audio'||interval.source==='fingerprint')return {mark:'AUD',short:'Audio',label:'Intervallo rilevato con audio'};
 return {mark:provisional?'A?':'A',short:provisional?'AniSkip?':'AniSkip',label:provisional?'Proposta AniSkip da verificare':'Intervallo AniSkip'};
}
