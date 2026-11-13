export type AudioKind = 'dub'|'sub'|'auto';
export type Page = 'home'|'catalog'|'favorites'|'history'|'settings'|'detail';
export interface Anime {
 id: string|number; slug?: string; awSlug?: string; provider?: 'animeworld'|'animeunity';
 title?: string; title_eng?: string; title_it?: string; title_original?: string;
 imageurl?: string; imageurl_cover?: string; date?: string; releaseDate?: string; season?: string; type?: string; status?: string;
 lastEpisode?:string; lastEpisodeId?:string|number; lastEpisodeDate?:string;
 score?: number|string; dub?: boolean|number; episodes_count?: number; real_episodes_count?: number;
 plot?: string; genres?: string|string[]; mal_id?: number; anilist_id?: number;
}
export interface Episode {id:string|number; number:string; malNumber?:number; token?:string; public?:number; title?:string;}
export interface Detail {anime:Anime; episodes:Episode[]; related:Anime[]; count:number;}
export interface PlaybackState {playing:boolean;position:number;duration:number;opened:boolean;buffering:boolean;title:string;episode:number;error:string;}
export interface SavedProgress {anime:Anime;episode:Episode;position:number;duration:number;completed:boolean;updated:number;}
export interface CatalogFilters {title?:string;type?:string|number|false;status?:string|number|false;genres?:number[]|false;excludedGenres?:number[];year?:number|false;season?:string|false;order?:string|false;dubbed?:boolean|number|false;minScore?:number|false;watch?:'all'|'never'|'unwatched';explored?:'all'|'never'|'seen'|'like'|'dislike';randomSeed?:number;}
export const animeTitle=(a:Anime)=>a.title_eng||a.title_it||a.title||'Titolo non disponibile';
export const animeImage=(a:Anime)=>a.imageurl_cover||a.imageurl||'';
export function cleanError(e:unknown){return e instanceof Error?e.message:String(e);}
