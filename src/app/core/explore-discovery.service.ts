import {Injectable} from '@angular/core';
import {Anime,CatalogFilters} from './models';
import {CatalogService} from './catalog.service';
import {AnimeWorldService} from './animeworld.service';
import {MalLibraryService} from './mal-library.service';
import {ExplorationService} from './exploration.service';
import {ServiceEndpointsService} from './service-endpoints.service';

const QUERY=`query($year:Int,$page:Int,$search:String){Page(page:$page,perPage:30){media(type:ANIME,seasonYear:$year,search:$search,sort:POPULARITY_DESC,isAdult:false){id idMal format status seasonYear title{romaji english} relations{edges{relationType node{type format}}}}}}`;

/** Pick AniList candidates, then require matching catalog and playable source identities. */
@Injectable({providedIn:'root'})
export class ExploreDiscoveryService {
 constructor(private endpoints:ServiceEndpointsService,private catalog:CatalogService,private world:AnimeWorldService,private library:MalLibraryService,private exploration:ExplorationService){}
 private same(a:Anime,row:any){const ani=Number(a.anilist_id),mal=Number(a.mal_id);return ani>0?ani===Number(row.id)&&(!mal||!row.idMal||mal===Number(row.idMal)):mal>0&&mal===Number(row.idMal);}
 async page(filters:CatalogFilters):Promise<{records:Anime[];hasMore:boolean}>{
  const year=filters.year?Number(filters.year):filters.title?null:1970+Math.floor(Math.random()*(new Date().getFullYear()-1969));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);let rows:any[];
  try{const response=await fetch(this.endpoints.origin('anilist'),{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({query:QUERY,variables:{year,page:filters.title||year&&year<2000?1:1+Math.floor(Math.random()*2),search:filters.title||null}}),signal:controller.signal});
   if(!response.ok)throw Error('AniList non disponibile');const body=await response.json();if(body.errors||!Array.isArray(body.data?.Page?.media))throw Error('Risposta AniList non valida');rows=body.data.Page.media;
  }finally{clearTimeout(timer);}
  // Shuffle within the selected page before checking availability.
  for(let i=rows.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}
  const candidates=rows.filter(row=>!(['TV','TV_SHORT','ONA'].includes(row.format)&&row.relations?.edges?.some((e:any)=>e.relationType==='PREQUEL'&&e.node?.type==='ANIME'&&['TV','TV_SHORT','ONA','MOVIE','SPECIAL'].includes(e.node.format)))).slice(0,4);
  const checked=await Promise.all(candidates.map(row=>this.find(row,filters)));
  return {records:checked.filter((a):a is Anime=>!!a).slice(0,3),hasMore:true};
 }
 async playable(anime:Anime){const matches=await this.world.match(anime);return matches.matches.some(d=>Number(d.anime.dub)===Number(anime.dub)&&d.episodes.some(e=>e.public!==0));}
 private async find(row:any,filters:CatalogFilters):Promise<Anime|null>{
  for(const title of [...new Set([row.title?.romaji,row.title?.english].filter((value:unknown):value is string=>typeof value==='string'&&!!value.trim()))]){
   const query:CatalogFilters={title,type:filters.type,year:filters.year,status:filters.status,season:filters.season,genres:filters.genres,dubbed:filters.dubbed};
   for(let offset=0;offset<60;offset+=30){
    const page=await this.catalog.catalog(query,offset);const candidates=page.records.filter(a=>this.same(a,row));
    for(const anime of candidates){
     if(filters.minScore&&(!(Number(anime.score)>0)||Number(anime.score)<Number(filters.minScore)))continue;
     const progress=this.library.progress(anime);if(filters.watch==='never'&&progress.watched>0||filters.watch==='unwatched'&&progress.remaining<=0||!this.exploration.matches(anime,filters.explored))continue;
     let excluded=false;for(const genre of filters.excludedGenres||[]){for(let start=0;;start+=30){const match=await this.catalog.catalog({title,genres:[genre]},start);if(match.records.some(a=>String(a.id)===String(anime.id))){excluded=true;break;}if(!match.records.length||start+match.records.length>=match.tot)break;}if(excluded)break;}if(excluded)continue;
     if(await this.playable(anime))return anime;
    }
    if(!page.records.length||offset+page.records.length>=page.tot)break;
   }
  }
  return null;
 }
}
