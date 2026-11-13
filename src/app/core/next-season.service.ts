import {Injectable} from '@angular/core';
import {Anime,Detail,Episode} from './models';
import {AnimeWorldService} from './animeworld.service';
import {CatalogService} from './catalog.service';
import {ServiceEndpointsService} from './service-endpoints.service';

export interface NextSeason {detail:Detail;episode:Episode;versions:Detail[];}
export interface AdjacentSeasons {previous:Anime|null;next:Anime|null;}
const FIELDS='id idMal status episodes relations{edges{relationType node{id idMal type format status title{romaji english}}}}';

/** Only use a single, explicitly related sequel with a verified catalog identity. */
@Injectable({providedIn:'root'})
export class NextSeasonService {
 constructor(private endpoints:ServiceEndpointsService,private catalog:CatalogService,private animeworld:AnimeWorldService){}
 private async media(anime:Anime):Promise<any>{
  const id=Number(anime.anilist_id)||null,mal=Number(anime.mal_id)||null;if(!id&&!mal)return null;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  let media:any;
  try{
   const query=id?'query($id:Int){Media(id:$id,type:ANIME){'+FIELDS+'}}':'query($mal:Int){Media(idMal:$mal,type:ANIME){'+FIELDS+'}}';
   const response=await fetch(this.endpoints.origin('anilist'),{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query,variables:id?{id}:{mal}}),signal:controller.signal});
   if(!response.ok)return null;
   const body=await response.json();if(body.errors)return null;media=body.data?.Media;
  }catch{return null;}finally{clearTimeout(timer);}
  if(!media||id&&Number(media.id)!==id||mal&&Number(media.idMal)>0&&Number(media.idMal)!==mal)return null;
  return media;
 }
 private matchesIdentity(item:Anime,node:any){
  const comparable=[Number(item.anilist_id)>0?[Number(item.anilist_id),Number(node.id)]:null,Number(item.mal_id)>0&&Number(node.idMal)>0?[Number(item.mal_id),Number(node.idMal)]:null].filter((pair):pair is number[]=>!!pair);
  return comparable.length>0&&comparable.every(pair=>pair[0]===pair[1]);
 }
 private async catalogRecord(current:Detail,node:any):Promise<Anime|null>{
  let record=current.related.find(item=>this.matchesIdentity(item,node));
  if(!record){
   const anime=current.anime,names=[node.title?.romaji,node.title?.english,anime.title,anime.title_eng,anime.title_it].filter((title:unknown):title is string=>typeof title==='string'&&!!title.trim());
   const titles=[...new Set(names.flatMap(title=>[title,title.replace(/\s+(?:season|part)\s+\d+.*$/i,'').trim()]).filter(title=>title.length>=3))];
   for(const title of titles){for(let offset=0;offset<90;offset+=30){const page=await this.catalog.catalog({title},offset);record=page.records.find(item=>this.matchesIdentity(item,node));if(record||!page.records.length||offset+page.records.length>=page.tot)break;}if(record)break;}
  }
  return record&&String(record.id)!==String(current.anime.id)?record:null;
 }
 async adjacent(current:Detail):Promise<AdjacentSeasons>{
  const media=await this.media(current.anime);if(!media)return {previous:null,next:null};
  const edges=Array.isArray(media.relations?.edges)?media.relations.edges:[];
  const node=(relation:string)=>{const found=edges.filter((edge:any)=>edge?.relationType===relation&&edge.node?.type==='ANIME'&&['TV','TV_SHORT','ONA','MOVIE','SPECIAL'].includes(edge.node.format)&&['FINISHED','RELEASING'].includes(edge.node.status)&&Number(edge.node.id)>0);return found.length===1?found[0].node:null;};
  const previous=node('PREQUEL'),next=node('SEQUEL');
  const results=await Promise.allSettled([previous?this.catalogRecord(current,previous):Promise.resolve(null),next?this.catalogRecord(current,next):Promise.resolve(null)]);
  return {previous:results[0].status==='fulfilled'?results[0].value:null,next:results[1].status==='fulfilled'?results[1].value:null};
 }
 async resolve(current:Detail,episode:Episode):Promise<NextSeason|null>{
  const anime=current.anime;if(!Number.isFinite(Number(episode.number))||Number(episode.number)<=0)return null;
  const media=await this.media(anime);if(!media||media.status!=='FINISHED')return null;
  if(Number(media.episodes)>0&&Number(episode.number)<Number(media.episodes))return null;
  const edges=Array.isArray(media.relations?.edges)?media.relations.edges:[];
  const candidates=edges.filter((edge:any)=>edge?.relationType==='SEQUEL'&&edge.node?.type==='ANIME'&&['TV','TV_SHORT','ONA'].includes(edge.node.format)&&['FINISHED','RELEASING'].includes(edge.node.status)&&Number(edge.node.id)>0);
  if(candidates.length!==1)return null;
  const sequel=candidates[0].node;
  const record=await this.catalogRecord(current,sequel);if(!record)return null;
  const [catalogResult,worldResult]=await Promise.allSettled([this.catalog.detail(record),this.animeworld.match(record)]);
  if(worldResult.status!=='fulfilled')return null;
  const playable=worldResult.value.matches.filter(match=>match.anime.awSlug&&match.episodes.some(item=>Number(item.number)===1&&item.public!==0));
  const checked=await Promise.allSettled(playable.map(async match=>({match,page:await this.animeworld.page(match.anime)})));
  const versions:Detail[]=[];
  for(const result of checked)if(result.status==='fulfilled'&&this.matchesIdentity({id:result.value.match.anime.id,mal_id:result.value.page.mal_id,anilist_id:result.value.page.anilist_id},sequel))versions.push(result.value.match);
  const selected=versions.find(match=>Number(match.anime.dub)===Number(anime.dub))||versions[0];
  if(!selected)return null;
  const catalogDetail=catalogResult.status==='fulfilled'?catalogResult.value:null;
  const detail:Detail={...selected,anime:{...record,...catalogDetail?.anime,...selected.anime},related:catalogDetail?.related||[]};
  return {detail,episode:detail.episodes.find(item=>Number(item.number)===1&&item.public!==0)!,versions};
 }
}
