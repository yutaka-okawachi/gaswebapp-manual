'use strict';
const fs=require('fs'),cp=require('child_process'),assert=require('assert/strict');
const {snapshot}=require('./test-bilingual-sync'),{dryRun}=require('./dry-run-bilingual');
const restore=[],blocked=()=>{throw Error('dry-run attempted a side effect');};
for(const [object,names]of [[fs,['writeFileSync','appendFileSync','mkdirSync','renameSync','unlinkSync','rmSync']],[cp,['spawnSync','spawn','execFileSync','execSync']]])for(const name of names){const original=object[name];restore.push(()=>object[name]=original);object[name]=blocked;}
const originalFetch=global.fetch;global.fetch=blocked;
try{const report=dryRun(snapshot);assert.equal(report.writes,0);assert.equal(report.networkCalls,0);assert.equal(report.gitCalls,0);assert.equal(report.deploymentCalls,0);assert.equal(report.japaneseFiles,58);assert(report.englishFiles>=58);assert.equal(report.englishPublicationEnabled,require('./sync/bilingual').englishEnabled());assert(report.plannedEnglishDestination.startsWith('.sync-state/english/'));}finally{for(const fn of restore)fn();global.fetch=originalFetch;}
console.log('Explicit bilingual dry-run: filesystem mutation, network and process/Git calls forbidden and not attempted.');
