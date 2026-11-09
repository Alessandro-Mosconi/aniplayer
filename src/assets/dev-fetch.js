/* Included by index.dev.html only; production TV packages use index.html. */
(function(){
 if(window.AniPlayerNative)return;
 var targets={'https://www.animeunity.co':'animeunity','https://www.animeworld.ac':'animeworld','https://api.myanimelist.net':'malapi','https://myanimelist.net':'maloauth','https://api.aniskip.com':'aniskip','https://graphql.anilist.co':'anilist'};
 var direct=window.fetch.bind(window);
 window.fetch=async function(input,init){
  var request=new Request(input,init),url=new URL(request.url),target=targets[url.origin];
  if(!target)return direct(input,init);
  var headers=new Headers(request.headers);headers.delete('origin');headers.delete('referer');
  var options={method:request.method,headers:headers,credentials:request.credentials,cache:request.cache,redirect:request.redirect,signal:request.signal};
  if(request.method!=='GET'&&request.method!=='HEAD')options.body=await request.text();
  var response=await direct('/__aniplayer_dev/'+target+url.pathname+url.search,options);
  var upstream=response.headers.get('x-aniplayer-upstream-url');
  if(upstream)Object.defineProperty(response,'url',{value:upstream});
  return response;
 };
})();
