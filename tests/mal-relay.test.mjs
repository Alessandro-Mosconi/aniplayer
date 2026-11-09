import test from 'node:test';
import assert from 'node:assert/strict';
import {createRelay} from '../tools/mal-phone-relay.mjs';
test('Phone relay transfers a long callback intact, validates state and consumes it once',async()=>{
 const server=createRelay();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const state='s'.repeat(64),code='def50200'+'a'.repeat(6000),redirect='http://127.0.0.1:8765/callback';
  const authorizationUrl='https://myanimelist.net/v1/oauth2/authorize?'+new URLSearchParams({client_id:'a'.repeat(32),response_type:'code',redirect_uri:redirect,state,code_challenge:'c'.repeat(64)});
  const paired=await fetch(base+'/pair',{method:'POST',body:new URLSearchParams({authorizationUrl})});assert.equal(paired.status,200);
  const pair=await paired.json();assert.match(pair.phonePath,/^\/p\/[a-f0-9]{48}$/);assert.notEqual(pair.phonePath.split('/').pop(),pair.pollPath.split('/').pop());
  const phone=await fetch(base+pair.phonePath);assert.equal(phone.status,200);assert.match(await phone.text(),/Invia alla TV/);
  let result=await fetch(base+pair.pollPath).then(r=>r.json());assert.equal(result.callback,null);
  const wrong=await fetch(base+pair.phonePath+'/callback',{method:'POST',body:new URLSearchParams({callback:redirect+'?code='+code+'&state=wrong'})});assert.equal(wrong.status,400);
  const callback=redirect+'?code='+code+'&state='+state;
  const submitted=await fetch(base+pair.phonePath+'/callback',{method:'POST',body:new URLSearchParams({callback})});assert.equal(submitted.status,200);
  result=await fetch(base+pair.pollPath).then(r=>r.json());assert.equal(result.callback,callback);
  const consumed=await fetch(base+pair.pollPath);assert.equal(consumed.status,410);
  const rejected=await fetch(base+'/pair',{method:'POST',body:new URLSearchParams({authorizationUrl:'https://example.com/authorize?state=x&code_challenge=y'})});assert.equal(rejected.status,400);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
