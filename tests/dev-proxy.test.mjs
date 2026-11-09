import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createDevProxy,devTargets,localProxyUrl} from '../tools/dev-proxy.conf.mjs';

test('Development proxy uses fixed origins, verifies TLS and namespaces cookies',()=>{
 assert.equal(localProxyUrl('https://www.animeunity.co/archivio?page=2'),'/__aniplayer_dev/animeunity/archivio?page=2');
 assert.equal(localProxyUrl('https://unrelated.example/api'),null);assert.equal(localProxyUrl('http://www.animeunity.co/'),null);
 const proxy=createDevProxy();assert.equal(Object.keys(proxy).length,Object.keys(devTargets).length);
 const config=proxy['^/__aniplayer_dev/animeunity(?:/|$)'];assert.equal(config.secure,true);assert.equal(config.changeOrigin,true);assert.equal(config.cookieDomainRewrite,'');assert.equal(config.cookiePathRewrite,'/__aniplayer_dev/animeunity/');assert.equal(config.rewrite('/__aniplayer_dev/animeunity/archivio/get-animes'),'/archivio/get-animes');
 const handlers={};config.configure({on:(name,callback)=>handlers[name]=callback});const headers={};handlers.proxyReq({setHeader:(key,value)=>headers[key]=value});assert.equal(headers.Origin,'https://www.animeunity.co');assert.equal(headers.Referer,'https://www.animeunity.co/archivio');
 const response={req:{path:'/archivio'},headers:{'set-cookie':['session=test; Secure; HttpOnly; SameSite=None'],location:'https://www.animeunity.co/anime/1'}};handlers.proxyRes(response);assert.equal(response.headers['x-aniplayer-upstream-url'],'https://www.animeunity.co/archivio');assert.equal(response.headers.location,'/__aniplayer_dev/animeunity/anime/1');assert.doesNotMatch(response.headers['set-cookie'][0],/Secure/);assert.match(response.headers['set-cookie'][0],/HttpOnly/);
});
test('Development fetch preserves CSRF, POST body, Range and canonical upstream response URL',async()=>{
 const calls=[],window={fetch:async(...args)=>{calls.push(args);return new Response('test',{status:206,headers:{'x-aniplayer-upstream-url':'https://www.animeunity.co/archivio/get-animes','Content-Range':'bytes 0-3/4'}});}};
 vm.runInNewContext(readFileSync('src/assets/dev-fetch.js','utf8'),{window,Request,Response,Headers,URL,Object});
 const response=await window.fetch('https://www.animeunity.co/archivio/get-animes',{method:'POST',body:'{"title":"test"}',headers:{'X-CSRF-TOKEN':'test-csrf',Range:'bytes=0-3'},credentials:'include'});
 assert.equal(calls[0][0],'/__aniplayer_dev/animeunity/archivio/get-animes');assert.equal(calls[0][1].body,'{"title":"test"}');assert.equal(calls[0][1].headers.get('X-CSRF-TOKEN'),'test-csrf');assert.equal(calls[0][1].headers.get('Range'),'bytes=0-3');assert.equal(calls[0][1].credentials,'include');assert.equal(response.url,'https://www.animeunity.co/archivio/get-animes');assert.equal(response.status,206);assert.equal(await response.text(),'test');
 await window.fetch('https://cdn.example/episode.mp4');assert.equal(calls[1][0],'https://cdn.example/episode.mp4');
});
test('Production entry does not load development proxy and native fetch is not overridden',()=>{
 assert.doesNotMatch(readFileSync('src/index.html','utf8'),/dev-fetch/);assert.match(readFileSync('src/index.dev.html','utf8'),/assets\/dev-fetch\.js/);
 const config=JSON.parse(readFileSync('angular.json'));assert.equal(config.projects.aniplayer.architect.serve.options.proxyConfig,'tools/dev-proxy.conf.mjs');assert.equal(config.projects.aniplayer.architect.build.configurations.development.index,'src/index.dev.html');
 const original=()=>{};const window={AniPlayerNative:{},fetch:original};vm.runInNewContext(readFileSync('src/assets/dev-fetch.js','utf8'),{window});assert.equal(window.fetch,original);
});
