import {Anime,CatalogFilters,Episode} from './models';

export const UNITY_ORIGIN='https://animeunity.cx';
const genres=['Action','Adventure','Avant Garde','Boys Love','Comedy','Demons','Drama','Ecchi','Fantasy','Game','Girls Love','Gore','Gourmet','Harem','Hentai','Historical','Horror','Isekai','Josei','Kids','Mahou Shoujo','Martial Arts','Mecha','Military','Music','Mystery','Parody','Police','Psychological','Racing','Reincarnation','Romance','Samurai','School','Sci-fi','Seinen','Shoujo','Shounen','Slice of Life','Space','Sports','Super Power','Supernatural','Survival','Thriller','Vampire'];
export const UNITY_GENRES=genres.map((name,index)=>({id:index+1,name}));
const season:Record<string,string>={winter:'Inverno',spring:'Primavera',summer:'Estate',fall:'Autunno'};
const status:Record<string,string>={ongoing:'In Corso',completed:'Terminato',upcoming:'In Uscita',dropped:'Droppato'};
const type:Record<string,string>={tv:'TV',tv_short:'TV Short',movie:'Movie',ova:'OVA',ona:'ONA',special:'Special'};
export function unityAnime(row:any,language?:'ita'|'jpn'):Anime|null{
 if(!Number.isSafeInteger(Number(row?.id))||!row?.slug||!row?.title)return null;
 const variants=Array.isArray(row.variants)?row.variants:[],languages=variants.map((v:any)=>v.language).filter((v:any)=>typeof v==='string');
 const chosen=language||(languages.includes('jpn')?'jpn':languages.includes('ita')?'ita':'jpn'),variant=variants.find((v:any)=>v.language===chosen),dub=chosen==='ita';
 return {id:dub?String(row.id)+'-dub':Number(row.id),unityId:Number(row.id),unityLanguages:languages,slug:String(row.slug),provider:'animeunity',title:String(row.title),title_it:row.title_it||undefined,title_original:row.title_ja||undefined,
  imageurl:row.images?.poster||'',imageurl_cover:row.images?.banner||row.images?.cover||row.images?.poster||'',date:row.year?String(row.year):undefined,season:season[row.season]||row.season||undefined,type:type[row.type]||row.type||undefined,status:status[variant?.status||row.default_status]||row.default_status||undefined,
  score:row.score??undefined,dub:Number(dub),episodes_count:Number(variant?.episodes_count)||Number(row.total_episodes)||0,real_episodes_count:Number(variant?.episodes_count)||0,plot:row.plot||undefined,genres:Array.isArray(row.genres)?row.genres:undefined,mal_id:Number(row.mal_id)||undefined,anilist_id:Number(row.anilist_id)||undefined,visite:Number(row.views)||0};
}
export function unityQuery(filters:CatalogFilters,page:number){
 const p=new URLSearchParams();p.set('page',String(page));p.set('per_page','30');if(filters.title)p.set('query',filters.title);
 const sorts:Record<string,string>={'Lista A-Z':'title_az','Lista Z-A':'title_za','Popolarità':'members','Valutazione':'score',score_asc:'score_asc',popularity_asc:'members_asc'};
 if(filters.order&&sorts[String(filters.order)])p.set('sort_by',sorts[String(filters.order)]);
 if(filters.type)p.set('type',String(filters.type).toLowerCase().replace(/\s+/g,'_'));
 if(filters.status){const val=Object.keys(status).find(k=>status[k]===filters.status);if(val)p.set('status',val);}
 if(filters.season){const val=Object.keys(season).find(k=>season[k]===filters.season||k===String(filters.season).toLowerCase());if(val)p.set('season',val);}
 if(filters.year){p.set('year_from',String(filters.year));p.set('year_to',String(filters.year));}
 if(filters.dubbed===1||filters.dubbed===true)p.set('language','ita');else if(filters.dubbed===0)p.set('language','jpn');
 for(const id of filters.genres||[])p.append('genres[]',String(id));return p.toString();
}
export function unityEpisodes(rows:any[],dub:boolean):Episode[]{return rows.filter(row=>row?.id&&row.number!=null).map(row=>({id:row.id,number:String(row.number),public:Array.isArray(row.videos)&&row.videos.some((v:any)=>v?.language===(dub?'ita':'jpn')&&!v.is_hidden)?1:0}));}
