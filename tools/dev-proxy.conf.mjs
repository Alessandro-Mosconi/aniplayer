// Angular/Vite development server only. No open proxy or TLS bypass.
export const devTargets={
 animeunity:'https://www.animeunity.co',
 animeworld:'https://www.animeworld.ac',
 malapi:'https://api.myanimelist.net',
 maloauth:'https://myanimelist.net',
 aniskip:'https://api.aniskip.com',
 anilist:'https://graphql.anilist.co'
};
export function localProxyUrl(value){
 const url=new URL(value),entry=Object.entries(devTargets).find(([,origin])=>origin===url.origin);
 return entry?'/__aniplayer_dev/'+entry[0]+url.pathname+url.search:null;
}
export function createDevProxy(targets=devTargets){
 return Object.fromEntries(Object.entries(targets).map(([name,target])=>{
  const prefix='/__aniplayer_dev/'+name;
  return ['^'+prefix+'(?:/|$)',{
   target,changeOrigin:true,secure:true,proxyTimeout:25000,timeout:30000,
   cookieDomainRewrite:'',cookiePathRewrite:prefix+'/',
   rewrite:path=>path.slice(prefix.length)||'/',
   configure(proxy){
    proxy.on('proxyReq',request=>{
     request.setHeader('Origin',target);
     request.setHeader('Referer',target+(name==='animeunity'?'/archivio':'/'));
    });
    proxy.on('proxyRes',response=>{
     response.headers['x-aniplayer-upstream-url']=new URL(response.req?.path||'/',target).href;
     response.headers['cache-control']='no-store';
     const cookies=response.headers['set-cookie'];
     if(cookies)response.headers['set-cookie']=cookies.map(cookie=>cookie.replace(/;\s*Secure\b/gi,'').replace(/;\s*SameSite=None\b/gi,'; SameSite=Lax'));
     if(response.headers.location){
      const next=new URL(response.headers.location,target);
      const destination=Object.entries(targets).find(([,origin])=>origin===next.origin);
      if(destination)response.headers.location='/__aniplayer_dev/'+destination[0]+next.pathname+next.search;
     }
    });
   }
  }];
 }));
}
export default createDevProxy();
