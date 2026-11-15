import {alignSkip} from './skip-alignment';
type Row=Record<string,any>;
type Skip={aniskip:Row[];calcolato?:Row;manuale?:Row;allineamento?:Row;stato_calcolo?:string};
type Episode={numero:string;id?:string|number;durata_secondi?:number;salti:Record<string,Skip>};
type Series={identita:Row;episodi:Episode[]};
const object=(value:any):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const segment=(episode:Episode,name:string):Skip=>episode.salti[name]??={aniskip:[]};
const interval=(row:Row)=>Number.isFinite(row.start)&&Number.isFinite(row.end)&&row.start>=0&&row.end>row.start;

/** Readable index uses only saved data; original stores are exported separately. */
export function buildMetadata(data:Record<string,any>){
 const entries=new Map<string,{series:Series;episodes:Map<string,Episode>}>(),lastDetection=new Map<Skip,number>();
 const group=(id:Row)=>{const slug=String(id.slug||''),dub=id.audio==='dub'?'dub':'sub',key=slug?'slug:'+slug+'|'+dub:id.mal_id?'mal:'+id.mal_id:'anime:'+String(id.id||'sconosciuto');
  let item=entries.get(key);if(!item){item={series:{identita:{...id},episodi:[]},episodes:new Map()};entries.set(key,item);}else for(const [k,v] of Object.entries(id))if(v!==undefined&&v!==null&&v!=='')item.series.identita[k]=v;return item;};
 const episode=(item:ReturnType<typeof group>,number:any):Episode=>{const num=String(number??'');let result=item.episodes.get(num);if(!result){result={numero:num,salti:{}};item.episodes.set(num,result);item.series.episodi.push(result);}return result;};
 const fromKey=(key:string)=>{const parts=key.split('|');if(parts.length<4)return null;return {slug:parts[1],audio:parts[2]==='1'?'dub':'sub',number:parts.slice(3).join('|')};};
 for(const value of Object.values(object(object(data.introPrefetch).series))){const row=object(value),anime=object(row.anime);if(!anime.awSlug&&!anime.slug)continue;
  const item=group({id:anime.id,mal_id:anime.mal_id,anilist_id:anime.anilist_id,titolo:anime.title_eng||anime.title,slug:anime.awSlug||anime.slug,audio:Number(anime.dub)?'dub':'sub'});
  for(const ep of Array.isArray(row.episodes)?row.episodes:[]){if(ep?.number==null)continue;const e=episode(item,ep.number);e.id=ep.id;const job=object(object(row.jobs)[String(ep.number)]);if(job.state)segment(e,'sigla_iniziale').stato_calcolo=({ready:'pronto','not-found':'non_trovato',error:'errore',disabled:'disattivato'} as Row)[job.state]||String(job.state);}
 }
 for(const collection of ['introPrepared','introDetections','endingDetections'])for(const [key,value] of Object.entries(object(data[collection]))){const parsed=fromKey(key),row=object(value);if(!parsed)continue;const meta=object(row.series);
  const item=group({id:meta.id,mal_id:meta.mal_id,anilist_id:meta.anilist_id,slug:parsed.slug,audio:parsed.audio}),ep=episode(item,row.episode??parsed.number),name=collection==='endingDetections'?'sigla_finale':'sigla_iniziale',skip=segment(ep,name);
  if(Number.isFinite(row.duration))ep.durata_secondi=row.duration;
  const updated=Number(row.updated)||0;if(updated<(lastDetection.get(skip)??-1))continue;
  if(row.state==='not-found'){lastDetection.set(skip,updated);delete skip.calcolato;skip.stato_calcolo='non_trovato';continue;}
  if(interval(row)){lastDetection.set(skip,updated);skip.calcolato={inizio:row.start,fine:row.end,origine:row.lengthSource==='AniSkip'?'audio_con_durata_aniskip':'audio',metodo:row.method||row.source||null,aggiornato:row.updated??null};skip.stato_calcolo='trovato';}
 }
 for(const collection of ['introCorrections','skipSegments'])for(const [key,value] of Object.entries(object(data[collection]))){const parts=key.split('|'),row=object(value);if(parts.length<5)continue;
  const [identity,provider,slug,audio,num,kind]=parts,mal=identity.startsWith('mal:')?Number(identity.slice(4)):undefined,id=identity.startsWith('anime:')?identity.slice(6):undefined;
  const item=group({id,mal_id:mal,provider,slug,audio}),ep=episode(item,num),name=collection==='introCorrections'?'sigla_iniziale':({recap:'riassunto',ending:'sigla_finale',prologue:'intro_narrativa'} as Row)[kind];if(!name)continue;
  if(Number.isFinite(row.duration))ep.durata_secondi=row.duration;
  if(row.disabled||interval(row))segment(ep,name).manuale={...(interval(row)?{inizio:row.start,fine:row.end}:{}),disattivato:row.disabled===true,aggiornato:row.updated??null};
 }
 for(const [key,value] of Object.entries(object(data.skipTimesCache))){const [malText,num]=key.split(':'),mal=Number(malText),row=object(value);if(!Number.isSafeInteger(mal)||!num)continue;
  const matching=[...entries.values()].filter(item=>Number(item.series.identita.mal_id)===mal);const targets=matching.length?matching:[group({mal_id:mal})];
  for(const item of targets){const ep=episode(item,num);for(const entry of Array.isArray(row.rows)?row.rows:[]){const name=({op:'sigla_iniziale',ed:'sigla_finale',recap:'riassunto'} as Row)[entry?.skipType],start=entry?.interval?.startTime,end=entry?.interval?.endTime;if(!name||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)continue;
   segment(ep,name).aniskip.push({inizio:start,fine:end,durata_episodio:entry.episodeLength??null,aggiornato:row.time??null});
  }}
 }
 for(const item of entries.values())for(const ep of item.series.episodi){
  const opening=ep.salti['sigla_iniziale']?.calcolato,duration=ep.durata_secondi,mal=Number(item.series.identita.mal_id),cached=object(object(data.skipTimesCache)[mal+':'+ep.numero]);
  if(!opening||!Number.isFinite(duration)||!Array.isArray(cached.rows))continue;
  for(const [name,kind] of [['riassunto','recap'],['sigla_finale','ed']] as const){const skip=ep.salti[name];if(!skip)continue;
   const result=alignSkip({mal,number:Number(ep.numero),duration:duration!,key:''},kind,cached.rows,{start:opening.inizio,end:opening.fine,source:'audio'});
   if(result.state==='aligned'&&result.interval)skip.allineamento={inizio:result.interval.start,fine:result.interval.end,origine:'aniskip_allineato_audio',offset_secondi:result.offset,nota:'Ricalcolato dai dati disponibili al momento dell’esportazione.'};
  }
 }
 const series=[...entries.values()].map(item=>item.series);for(const item of series)item.episodi.sort((a,b)=>Number(a.numero)-Number(b.numero));
 return series;
}
