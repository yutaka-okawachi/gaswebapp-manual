'use strict';
const assert=require('assert/strict'),{plan}=require('./sync/main');
for(const file of ['scripts/english-site.js','scripts/gm-original-validation.js','frontend/notation-contexts.js']){
 assert.equal(plan('Auto',[file],false).data,true,'English data generator changes require a fresh authenticated snapshot');
 assert.equal(plan('Auto',[file],false).deploy,false,'No unnecessary GAS deployment');
}
assert.equal(plan('Auto',['frontend/music-notation.js'],false).data,true,'Auto reads the online sheet even with a presentation-only change');
assert.equal(plan('Auto',[],false).data,true,'No-change ordinary sync still fetches fresh data');
assert.equal(plan('Auto',['src/export_json.js'],false).data,true);
assert.equal(plan('Auto',['manuals/BILINGUAL_SYNC.md'],false).data,true);
assert.equal(plan('Data',[],false).data,true);
assert.equal(plan('Site',['scripts/gm-original-validation.js'],false).data,false,'Explicit site-only mode remains explicit');
console.log('Sync planning: Auto always fetches, explicit Site does not; no external calls.');
