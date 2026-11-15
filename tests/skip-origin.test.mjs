import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('src/app/core/skip-origin.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
test('player labels distinguish AniSkip, audio, calibrated and manual intervals',()=>{
 const origin=exports.skipOrigin;
 assert.equal(origin({start:3,end:93,source:'aniskip'}).mark,'A');
 assert.equal(origin({start:3,end:93,source:'aniskip'},true).mark,'A?');
 assert.equal(origin({start:40,end:130,source:'audio'}).mark,'AUD');
 assert.equal(origin({start:40,end:130,source:'audio'}).short,'Audio');
 assert.equal(origin({start:40,end:130,source:'fingerprint',basis:'aniskip'}).mark,'A+AUD');
 assert.equal(origin({start:40,end:130,source:'fingerprint',basis:'aniskip'}).short,'AniSkip + audio');
 assert.equal(origin({start:40,end:130,source:'aniskip'},false,true).mark,'A+AUD');
 assert.equal(origin({start:40,end:130,source:'local'},false,true).mark,'✎');
});
