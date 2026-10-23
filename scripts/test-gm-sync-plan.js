'use strict';
const assert=require('assert/strict'),{plan}=require('./sync/main');
for(const file of ['scripts/english-site.js','scripts/gm-original-validation.js']){
 assert.equal(plan('Auto',[file],false).data,true,'English data generator changes require a fresh authenticated snapshot');
 assert.equal(plan('Auto',[file],false).deploy,false,'No unnecessary GAS deployment');
}
assert.equal(plan('Auto',['frontend/music-notation.js'],false).data,false,'Presentation-only updates retain existing cache path');
assert.equal(plan('Auto',[],false).data,true,'No-change ordinary sync still fetches fresh data');
assert.equal(plan('Auto',['src/export_json.js'],false).data,true);
assert.equal(plan('Auto',['manuals/BILINGUAL_SYNC.md'],false).data,false);
assert.equal(plan('Data',[],false).data,true);
assert.equal(plan('Site',['scripts/gm-original-validation.js'],false).data,false,'Explicit site-only mode remains explicit');
console.log('GM sync planning: fresh snapshot for English generators/validation, presentation-only and explicit modes preserved; no external calls.');
