import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('src/assets/platform-runtime.js','utf8');
function runtime(native){
 const scripts=[],local=[],listeners={};
 const window={AniPlayerNative:native,fetch:async(...args)=>{local.push(args);return new Response('local');}};
 const context={window,navigator:{userAgent:'Android'},document:{activeElement:null,addEventListener:(name,fn)=>listeners[name]=fn,createElement:()=>({}),head:{appendChild:script=>scripts.push(script)}},location:{origin:'https://appassets.androidplatform.net'},Map,URL,Request,Response,Uint8Array,atob,DOMException,setTimeout,clearTimeout};
 vm.runInNewContext(source,context);return {window,local,scripts,listeners,context};
}
test('Android network bridge preserves binary Range responses, credentials and response URL',async()=>{
 let args;const fixture=runtime({cancelRequest(){},request(...request){args=request;queueMicrotask(()=>fixture.window.__aniPlayerNativeResponse(request[0],{status:206,url:'https://media.example/episode.mp4',headers:{'Content-Range':'bytes 0-2/100'},body:Buffer.from([0,128,255]).toString('base64')}));}});
 const response=await fixture.window.fetch('https://media.example/episode.mp4',{headers:{Range:'bytes=0-2'},credentials:'include'});
 assert.equal(response.status,206);assert.equal(response.url,'https://media.example/episode.mp4');assert.equal(response.headers.get('Content-Range'),'bytes 0-2/100');assert.deepEqual([...new Uint8Array(await response.arrayBuffer())],[0,128,255]);assert.equal(JSON.parse(args[3]).range,'bytes=0-2');assert.equal(args[5],true);
 await fixture.window.fetch('https://appassets.androidplatform.net/assets/main.js');assert.equal(fixture.local.length,1);
});
test('Android network bridge forwards request body and cancels pending requests',async()=>{
 const calls=[],cancelled=[];const fixture=runtime({request:(...args)=>calls.push(args),cancelRequest:id=>cancelled.push(id)});
 const controller=new AbortController();const promise=fixture.window.fetch('https://api.example/token',{method:'POST',body:'code=test',signal:controller.signal});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(calls[0][2],'POST');assert.equal(calls[0][4],'code=test');controller.abort();await assert.rejects(promise,error=>error.name==='AbortError');assert.deepEqual(cancelled,[calls[0][0]]);
 await assert.rejects(fixture.window.fetch('ftp://example.test/data'),/Protocollo/);
});
test('Non-Samsung web builds do not request the Samsung SDK',()=>{
 assert.equal(runtime(undefined).scripts.length,0);
 const fixture=runtime(undefined);fixture.context.window.tizen={};vm.runInNewContext(source,fixture.context);assert.equal(fixture.scripts.length,1);assert.equal(fixture.scripts[0].src,'$WEBAPIS/webapis/webapis.js');
});

test('Android network bridge reassembles chunked binary responses without changing bytes',async()=>{
 const bytes=Buffer.alloc(200000,237),encoded=bytes.toString('base64');let requestId;const fixture=runtime({cancelRequest(){},request(id){requestId=id;}});const job=fixture.window.fetch('https://media.example/audio.mp4');await new Promise(resolve=>setTimeout(resolve,0));
 fixture.window.__aniPlayerNativeChunk(requestId,encoded.slice(0,131072),false,null);fixture.window.__aniPlayerNativeChunk(requestId,encoded.slice(131072),true,{status:206,url:'https://media.example/audio.mp4',headers:{}});
 const response=await job;assert.equal(Buffer.compare(Buffer.from(await response.arrayBuffer()),bytes),0);
});

test('Android TV high-density screens scale the complete 1920px UI into the visible area',()=>{
 const fixture=runtime(undefined);let content='';fixture.context.window.AniPlayerNative={};fixture.context.window.screen={width:960};fixture.context.document.querySelector=()=>({setAttribute:(key,value)=>content=value});vm.runInNewContext(source,fixture.context);assert.match(content,/width=1920,initial-scale=0\.5/);
});
