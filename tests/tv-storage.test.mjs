import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluate,readBackup,waitForStorage} from '../tools/tv-storage.mjs';

class DebugSocket extends EventTarget{
 constructor(responses){super();this.responses=responses;this.requests=[];}
 send(raw){const request=JSON.parse(raw);this.requests.push(request);const response=this.responses.shift();queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({id:request.id,...response})})));}
}
test('TV backup retries transient CDP startup errors and empty storage',async()=>{
 const ws=new DebugSocket([{error:{message:'Execution context was destroyed'}},{result:{result:{value:'{}'}}},{result:{result:{value:JSON.stringify({'autv.profiles':'[]','autv.activeProfile':'"default"'})}}}]);
 const data=await readBackup(ws,{attempts:3,delay:0});assert.equal(Object.keys(data).length,2);assert.equal(ws.requests.length,3);assert.notEqual(ws.requests[0].id,ws.requests[1].id);
});
test('TV backup refuses empty or unrelated data rather than overwriting an existing backup',async()=>{
 const ws=new DebugSocket([{result:{result:{value:'{}'}}},{result:{result:{value:'{"other":"value"}'}}}]);
 await assert.rejects(readBackup(ws,{attempts:2,delay:0}),/backup vuoto/);
});
test('CDP failures include the actual error without serializing application data',async()=>{
 const ws=new DebugSocket([{result:{exceptionDetails:{exception:{description:'SecurityError: storage unavailable\nstack'}}}}]);
 await assert.rejects(evaluate(ws,'test'),/SecurityError: storage unavailable/);
});
test('Restore waits until storage is accessible without requiring existing keys',async()=>{
 const ws=new DebugSocket([{error:{message:'Execution context was destroyed'}},{result:{result:{value:false}}},{result:{result:{value:true}}}]);
 await waitForStorage(ws,{attempts:3,delay:0});assert.equal(ws.requests.length,3);
});
