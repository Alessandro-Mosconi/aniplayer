import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync('src/app/core/continue-watching.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
const should=exports.shouldContinueWatching;
const progress=(overrides={})=>({anime:{id:1},episode:{id:12,number:'12'},position:1400,duration:1440,completed:true,updated:1,...overrides});
test('finished available episodes leave the strip but return when a new episode appears',()=>{
 const row=progress({availableThrough:12});assert.equal(should(row),false);assert.equal(should(row,13),true);
 assert.equal(should(progress({availableThrough:13})),true);
 assert.equal(should(progress({availableThrough:12,completed:false})),true);
});
test('older records use reliable metadata and unknown totals remain visible',()=>{
 assert.equal(should(progress({anime:{id:1,episodes_count:12}})),false);
 assert.equal(should(progress({anime:{id:1,episodes_count:24}})),true);
 assert.equal(should(progress({anime:{id:1,status:'airing',episodes_count:24,lastEpisode:'12'}})),false);
 assert.equal(should(progress()),true);
 assert.equal(should(progress({episode:{id:1,number:'special'}})),true);
});
test('the actual playable episode snapshot overrides a future season total',()=>{
 assert.equal(should(progress({anime:{id:1,episodes_count:24},availableThrough:12})),false);
 assert.equal(should(progress({anime:{id:1,episodes_count:24},availableThrough:12}),13),true);
});
test('a finished last episode does not hide earlier unwatched episodes',()=>{
 const episodes=[{id:1,number:'1'},{id:2,number:'2'},{id:3,number:'3'}],row=progress({episode:episodes[2],availableThrough:3,availableEpisodes:episodes});
 assert.equal(should(row,0,episode=>episode.id===1),true);
 assert.equal(should(row,0,()=>true),false);
 assert.equal(should(row,4,()=>true),true);
});
