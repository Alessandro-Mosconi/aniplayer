export interface Profile {id:string;name:string;avatar:string;}
export const DICEBEAR_AVATAR=/^(?:dicebear:(adventurer|bottts)|dicebear10:([a-z][a-z0-9-]{0,63})):([a-zA-Z0-9_-]{1,64})$/;
export function normalizeAvatarStyles(value:unknown):string[]{return Array.isArray(value)?[...new Set(value.filter((s):s is string=>typeof s==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(s)))].sort():[];}
export const PROFILE_KEYS=new Set(['favorites','history','hiddenFromContinue','seen','settings','watchEvents','watchCoverage','seenResets','explored','episodeUpdates','malSession','malDisconnected','malData','malAutoUpdate','malClient','malOAuth','malOutbox','malDataCleared','malPublicData']);
export const DEFAULT_PROFILE:Profile={id:'default',name:'Il mio profilo',avatar:'generated:0'};
export function profileKey(id:string,key:string){return PROFILE_KEYS.has(key)&&id!=='default'?'profile.'+id+'.'+key:key;}
export function profileName(name:string,profiles:Profile[],id?:string){
 const value=name.normalize('NFKC').trim().replace(/\s+/g,' ');
 if(!value||value.length>32)throw Error('Il nome deve contenere da 1 a 32 caratteri.');
 if(profiles.some(p=>p.id!==id&&p.name.normalize('NFKC').toLocaleLowerCase('it')===value.toLocaleLowerCase('it')))throw Error('Questo nome è già usato da un altro profilo.');
 return value;
}
const NAME_FRIENDS=['Ninja','Ramen','Panda','Fox','Dragon','Mochi','Robot','Bird','Cat','Cloud','Star','Otter','Toast','Sushi','Tanuki','Comet','Dolphin','Moon','Kitsune','Koala'];
const NAME_TRAITS=['Sleepy','Flying','Crispy','Cosmic','Lucky','Dancing','Sunny','Mighty','Magic','Happy','Curious','Fuzzy','Turbo','Silly','Sparkly','Swift','Dreamy','Bubbly','Jolly','Sneaky'];
export function tinyToolsProfileName(data:unknown,profiles:Profile[]):string|null{
 const values=(data as {data?:unknown})?.data;if(!Array.isArray(values))return null;
 for(const raw of values){if(typeof raw!=='string'||raw.length>64||!/^[a-z]+(?:[-_ ][a-z]+)+$/i.test(raw))continue;
  const name=raw.split(/[-_ ]+/).map(word=>word[0].toUpperCase()+word.slice(1).toLowerCase()).join('');
  try{return profileName(name,profiles);}catch{continue;}
 }
 return null;
}
export function randomProfileName(profiles:Profile[],random:()=>number=Math.random){
 const used=new Set(profiles.map(p=>p.name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('it')));
 const total=NAME_FRIENDS.length*NAME_TRAITS.length,start=Math.floor(random()*total)%total;
 for(let offset=0;offset<total;offset++){const n=(start+offset)%total,name=NAME_TRAITS[n%NAME_TRAITS.length]+NAME_FRIENDS[Math.floor(n/NAME_TRAITS.length)];if(!used.has(name.toLocaleLowerCase('it')))return name;}
 let suffix=2;while(used.has(('SleepyNinja'+suffix).toLocaleLowerCase('it')))suffix++;return 'SleepyNinja'+suffix;
}
export function randomProfileAvatar(styles:readonly string[],random:()=>number=Math.random){
 const choices=styles.length?styles:['adventurer'];const style=choices[Math.floor(random()*choices.length)]||'adventurer';
 const seed=Math.floor(random()*0x100000000).toString(36)+'-'+Math.floor(random()*0x100000000).toString(36);
 return 'dicebear10:'+style+':random-'+seed;
}
export function avatarUrl(avatar:string){
 const match=avatar.match(DICEBEAR_AVATAR);
 if(match)return 'https://api.dicebear.com/'+(match[1]?'9.x/':'10.x/')+(match[1]||match[2])+'/svg?seed='+encodeURIComponent(match[3])+'&size=160'+(match[1]?'&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf':'');
 if(!avatar.startsWith('generated:'))return /^https:\/\/cdn\.myanimelist\.net\//.test(avatar)?avatar:'';
 const n=Number(avatar.slice(10))||0,colors=['#8c9ffb','#e99ac0','#82d8b1','#f0bd79','#ae91ed','#75c7df'];
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="30" fill="${colors[n%colors.length]}"/><path d="M25 72L33 20L65 43Q80 35 95 43L127 20L135 72V111Q80 160 25 111Z" fill="#18243b"/><ellipse cx="58" cy="83" rx="${n%2?7:10}" ry="12" fill="white"/><ellipse cx="102" cy="83" rx="${n%2?7:10}" ry="12" fill="white"/><path d="M66 112Q80 ${n%3?128:104} 94 112" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/></svg>`;
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
