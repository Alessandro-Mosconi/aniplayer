import {StorageService} from './storage.service';
import {fileContainer} from './optical/decimen-v3';
import {buildMetadata} from './metadata-export';

// These keys are shared between profiles and contain skip metadata only.
export const OPTICAL_BACKUP_KEYS=['introDetections','introPrepared','introFingerprints','introPrefetch','introCorrections','angularIntroCorrections','skipSegments','skipTimesCache','aniskipAvailability','endingDetections','endingFingerprints'] as const;
export function opticalBackup(store:Pick<StorageService,'read'>):Uint8Array{
 const data:Record<string,unknown>={};for(const key of OPTICAL_BACKUP_KEYS)data[key]=store.read(key,{});
 const bytes=new TextEncoder().encode(JSON.stringify({formato:'aniplayer-metadati',versione:2,esportato_il:new Date().toISOString(),unita_tempi:'secondi',serie:buildMetadata(data),dati_originali:data}));
 const payload=fileContainer(bytes);
 if(payload.length>32*1024*1024)throw Error('Il backup è troppo grande per la trasmissione.');
 return payload;
}
