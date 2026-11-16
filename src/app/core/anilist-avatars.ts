export type AnimeSort='POPULARITY_DESC'|'SCORE_DESC'|'TRENDING_DESC'|'FAVOURITES_DESC';
export interface AniAvatar {id:number;name:string;image:string;anime:string;animeId:number;}
export interface AniMedia {id:number;links:number[];characterPage:number;hasMoreCharacters:boolean;}
export interface AniCatalog {items:AniAvatar[];page:number;hasNext:boolean;media:AniMedia[];}
export const ANILIST_IMAGE=/^https:\/\/s4\.anilist\.co\/file\/anilistcdn\/character\/[^?#\s]+$/;
async function request(query:string,variables:object,signal:AbortSignal){
 const response=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'omit',signal,body:JSON.stringify({query,variables})});
 if(response.status===429){const retry=response.headers.get('Retry-After');throw Error('Limite AniList raggiunto. Riprova '+(retry?'tra '+retry+' secondi.':'tra poco.'));}
 if(!response.ok)throw Error('AniList non disponibile (HTTP '+response.status+').');
 const body=await response.json();if(body.errors?.length||!body.data)throw Error('Risposta AniList non valida. Riprova.');return body.data;
}
function addCharacters(items:AniAvatar[], nodes:any[], id:number, anime:string){const ids=new Set(items.map(item=>item.id));for(const character of nodes||[]){const image=character.image?.large;if(!ids.has(character.id)&&typeof image==='string'&&ANILIST_IMAGE.test(image)){ids.add(character.id);items.push({animeId:id,id:character.id,name:character.name?.full||'Personaggio',image,anime});}}}
export async function fetchAniCatalog(options:{sort:AnimeSort;search:string},previous:AniCatalog|null,signal:AbortSignal):Promise<AniCatalog>{
 const query=`query ($page: Int, $sort: [MediaSort], $search: String) { Page(page: $page, perPage: 10) { pageInfo { hasNextPage } media(type: ANIME, sort: $sort, search: $search) { id title { romaji english } relations { edges { relationType node { id } } } characters(page: 1, perPage: 25, sort: FAVOURITES_DESC) { pageInfo { hasNextPage } nodes { id name { full } image { large } } } } } }`;
 const data=await request(query,{page:(previous?.page||0)+1,sort:options.sort,search:options.search||null},signal);const page=data.Page;if(!page)throw Error('Risposta AniList non valida. Riprova.');
 const media=(previous?.media||[]).map(item=>({...item,links:[...item.links]}));const items=[...(previous?.items||[])];
 for(const anime of page.media||[]){const links=(anime.relations?.edges||[]).filter((edge:any)=>['PREQUEL','SEQUEL','PARENT','SIDE_STORY','SPIN_OFF','ALTERNATIVE','SUMMARY','COMPILATION'].includes(edge.relationType)).map((edge:any)=>edge.node?.id).filter((id:unknown):id is number=>typeof id==='number');const related=media.find(old=>old.id===anime.id||old.links.includes(anime.id)||links.includes(old.id)||links.some((id:number)=>old.links.includes(id)));if(related){related.links=[...new Set([...related.links,anime.id,...links])];continue;}
 const name=anime.title?.english||anime.title?.romaji||'Anime';const before=items.length;addCharacters(items,anime.characters?.nodes,anime.id,name);if(items.length>before)media.push({id:anime.id,links,characterPage:1,hasMoreCharacters:!!anime.characters?.pageInfo?.hasNextPage});}
 return {items,media,page:(previous?.page||0)+1,hasNext:!!page.pageInfo?.hasNextPage};
}
export async function fetchAniCharacters(catalog:AniCatalog,id:number,signal:AbortSignal):Promise<AniCatalog>{
 const media=catalog.media.find(item=>item.id===id);if(!media||!media.hasMoreCharacters)return catalog;
 const query=`query ($id: Int, $page: Int) { Media(id: $id, type: ANIME) { characters(page: $page, perPage: 25, sort: FAVOURITES_DESC) { pageInfo { hasNextPage } nodes { id name { full } image { large } } } } }`;
 const data=await request(query,{id,page:media.characterPage+1},signal);const characters=data.Media?.characters;if(!characters)throw Error('Risposta AniList non valida. Riprova.');const items=[...catalog.items];addCharacters(items,characters.nodes,id,items.find(item=>item.animeId===id)?.anime||'Anime');return {...catalog,items,media:catalog.media.map(item=>item.id===id?{...item,characterPage:item.characterPage+1,hasMoreCharacters:!!characters.pageInfo?.hasNextPage}:item)};
}
export interface DetailCharacters {id:number;title:string;items:AniAvatar[];page:number;hasNext:boolean;}
export async function fetchDetailCharacters(options:{id?:number;malId?:number;title:string},previous:DetailCharacters|null,signal:AbortSignal):Promise<DetailCharacters>{
 const query=`query ($id: Int, $malId: Int, $search: String, $page: Int) { Media(id: $id, idMal: $malId, search: $search, type: ANIME) { id title { romaji english native } characters(page: $page, perPage: 25, sort: FAVOURITES_DESC) { pageInfo { hasNextPage } nodes { id name { full } image { large } } } } }`;
 const id=previous?.id||options.id||undefined;const malId=id?undefined:options.malId||undefined;const search=id||malId?undefined:options.title;
 const data=await request(query,{id,malId,search,page:(previous?.page||0)+1},signal);const anime=data.Media;if(!anime?.characters)throw Error('Personaggi non disponibili per questa serie.');
 if(search){const normalize=(value:string)=>value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');const wanted=normalize(search);if(![anime.title?.romaji,anime.title?.english,anime.title?.native].some((title:unknown)=>typeof title==='string'&&normalize(title)===wanted))throw Error('Non è stato possibile identificare con certezza la serie su AniList.');}
 const title=anime.title?.english||anime.title?.romaji||options.title;const items=[...(previous?.items||[])];addCharacters(items,anime.characters.nodes,anime.id,title);return {id:anime.id,title,items,page:(previous?.page||0)+1,hasNext:!!anime.characters.pageInfo?.hasNextPage};
}
