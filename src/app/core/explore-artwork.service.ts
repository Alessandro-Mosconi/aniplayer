import {Injectable} from '@angular/core';
import {Anime} from './models';
import {ServiceEndpointsService,PUBLIC_SERVICE_DEFAULTS} from './service-endpoints.service';

const QUERY='query($mal:[Int],$ids:[Int]){byMal:Page(page:1,perPage:50){media(idMal_in:$mal,type:ANIME){id idMal format relations{edges{relationType node{type format}}} coverImage{extraLarge large}}} byId:Page(page:1,perPage:50){media(id_in:$ids,type:ANIME){id idMal format relations{edges{relationType node{type format}}} coverImage{extraLarge large}}}}';

/** Resolve only exact IDs, and keep the catalog image when AniList is unavailable. */
@Injectable({providedIn:'root'})
export class ExploreArtworkService {
 constructor(private endpoints:ServiceEndpointsService){}
 private cache=new Map<string,string>();
 private continuations=new Map<string,boolean>();
 private source='';
 private origin(){const value=this.endpoints?.origin('anilist')||PUBLIC_SERVICE_DEFAULTS.anilist;if(value!==this.source){this.cache.clear();this.continuations.clear();this.source=value;}return value;}
 private key(anime:Anime){return Number(anime.anilist_id)>0?'ani:'+Number(anime.anilist_id):Number(anime.mal_id)>0?'mal:'+Number(anime.mal_id):'';}
 get(anime:Anime){this.origin();return this.cache.get(this.key(anime))||'';}
 isContinuation(anime:Anime){this.origin();return this.continuations.get(this.key(anime))===true;}
 async prefetch(records:Anime[]){
  const origin=this.origin();
  const wanted=records.filter(a=>this.key(a)&&!this.continuations.has(this.key(a)));
  if(!wanted.length)return;
  const mal=[...new Set(wanted.filter(a=>!Number(a.anilist_id)&&Number(a.mal_id)>0).map(a=>Number(a.mal_id)))].slice(0,50);
  const ids=[...new Set(wanted.filter(a=>Number(a.anilist_id)>0).map(a=>Number(a.anilist_id)))].slice(0,50);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{
   const response=await fetch(origin,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:QUERY,variables:{mal,ids}}),signal:controller.signal});
   if(!response.ok)return;
   const result=await response.json();if(result.errors||this.origin()!==origin)return;
   const rows=[...(Array.isArray(result.data?.byMal?.media)?result.data.byMal.media:[]),...(Array.isArray(result.data?.byId?.media)?result.data.byId.media:[])];
   for(const anime of wanted){
    const id=Number(anime.anilist_id),malId=Number(anime.mal_id);
    const row=rows.find((item:any)=>(id>0?Number(item.id)===id:Number(item.idMal)===malId)&&(!id||!malId||!item.idMal||Number(item.idMal)===malId));
    if(row&&Array.isArray(row.relations?.edges)){const continuation=['TV','TV_SHORT','ONA'].includes(row.format)&&row.relations.edges.some((edge:any)=>edge?.relationType==='PREQUEL'&&edge.node?.type==='ANIME'&&['TV','TV_SHORT','ONA','MOVIE','SPECIAL'].includes(edge.node.format));this.continuations.set(this.key(anime),continuation);}
    const url=row?.coverImage?.extraLarge||row?.coverImage?.large;
    if(typeof url==='string'&&/^https:\/\//i.test(url))this.cache.set(this.key(anime),url);
   }
  }catch{/* The original poster remains available. */}finally{clearTimeout(timer);}
 }
}
