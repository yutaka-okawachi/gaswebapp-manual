'use strict';
const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const guard=require('./sync/gas-head'),policy=require('./sync/retirement-policy'),{sha256}=require('./sync/core');
const app={name:'appsscript',type:'JSON',source:'{}'},main={name:'main',type:'SERVER_JS',source:'main'};
const retired=policy.names.map(name=>({name,type:name.endsWith('_dialog')?'HTML':'SERVER_JS',source:'reviewed '+name+'\n'}));
const manifest=items=>guard.manifest([app,main,...items]),local=manifest([]),head=manifest(retired);
const approval={schemaVersion:1,id:'english-workflow-20261020',baselineCommit:'a'.repeat(40),baselineVersion:1668,projectHash:sha256('synthetic'),files:head.filter(f=>policy.names.includes(f.name))};
const context={approval,scriptId:'synthetic',version:1668},copy=()=>JSON.parse(JSON.stringify(context));let passed=0;
function test(name,fn){try{fn();passed++;}catch(e){e.message=name+': '+e.message;throw e;}}
test('no manifest still blocks all 22 deletions',()=>assert.throws(()=>guard.assertSafe(local,head,head),/同期元にない/));
test('exact project/version/name/type/hash set permits only the reviewed retirement',()=>assert.doesNotThrow(()=>guard.assertSafe(local,head,head,false,context)));
test('unknown 23rd deletion remains blocked',()=>assert.throws(()=>guard.assertSafe(local,manifest([...retired,{name:'unreviewed',type:'SERVER_JS',source:'x'}]),head,false,context),/同期元にないHEADファイル: unreviewed/));
test('edited retired HEAD file blocks even with approved published content',()=>{const changed=JSON.parse(JSON.stringify(head));changed.find(f=>f.name===policy.names[0]).hash='b'.repeat(64);assert.throws(()=>guard.assertSafe(local,changed,head,false,context),/未確認の変更/);});
test('edited published file blocks',()=>{const changed=JSON.parse(JSON.stringify(head));changed.find(f=>f.name===policy.names[0]).hash='b'.repeat(64);assert.throws(()=>guard.assertSafe(local,head,changed,false,context),/未確認の変更/);});
for(const [name,mutate]of [
 ['wrong project',c=>c.scriptId='other'],['wrong version',c=>c.version=1669],['extra manifest key',c=>c.approval.allowAny=true],['missing file',c=>c.approval.files.pop()],['duplicate file',c=>c.approval.files[1]={...c.approval.files[0]}],['unknown name',c=>c.approval.files[0].name='unreviewed'],['wrong type',c=>c.approval.files[0].type='HTML'],['wrong hash',c=>c.approval.files[0].hash='0'],['wrong baseline commit',c=>c.approval.baselineCommit='branch'],['wrong baseline version',c=>c.approval.baselineVersion=1669]
])test(name,()=>{const bad=copy();mutate(bad);assert.throws(()=>guard.assertSafe(local,head,head,false,bad));});
test('partial local retirement blocks',()=>assert.throws(()=>guard.assertSafe(manifest([retired[0]]),head,head,false,context),/部分的/));
test('partial remote HEAD retirement blocks',()=>assert.throws(()=>guard.assertSafe(local,manifest(retired.slice(1)),head,false,context),/構成/));
test('already removed HEAD with old pinned deployment is safe',()=>guard.assertSafe(local,local,head,false,context));
test('both remote copies retired no longer need a baseline deletion exception',()=>guard.assertSafe(local,local,local,false,{...context,version:1669}));
test('unrelated unmerged change still blocks',()=>{const edited=head.map(f=>f.name==='main'?{...f,hash:'b'.repeat(64)}:f);assert.throws(()=>guard.assertSafe(local,edited,head,false,context),/未統合変更/);});
async function mainTest(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gmt-retirement-test-'));
 try{
  fs.mkdirSync(path.join(dir,'src'));fs.mkdirSync(path.join(dir,'scripts/sync'),{recursive:true});
  fs.writeFileSync(path.join(dir,'.clasp.json'),JSON.stringify({scriptId:'synthetic',rootDir:'src'}));fs.writeFileSync(path.join(dir,'src/appsscript.json'),'{}');fs.writeFileSync(path.join(dir,'src/main.js'),'main');
  const file=path.join(dir,'scripts/sync/english-retirement-20261020.json');fs.writeFileSync(file,JSON.stringify(approval));
  const read=()=>guard.localSnapshot({root:dir,status:()=>JSON.stringify({filesToPush:['src/appsscript.json','src/main.js']})});
  const remote=async()=>({files:head,published:head,version:1668,deploymentHash:'fixed'});
  const ticket=await guard.preflight({GAS_DEPLOY_URL:'unused'},{local:read,remote});
  await guard.assertUnchanged(ticket,{local:read,remote});passed++;
  const changed={...approval,baselineCommit:'b'.repeat(40)};fs.writeFileSync(file,JSON.stringify(changed));
  await assert.rejects(()=>guard.assertUnchanged(ticket,{local:read,remote}),/確認後/);passed++;
  fs.writeFileSync(file,JSON.stringify(approval));await guard.verifyUpload(ticket,{local:read,remote:async()=>({files:local,published:head,version:1668,deploymentHash:'fixed'})});passed++;
  await assert.rejects(()=>guard.verifyUpload(ticket,{local:read,remote:async()=>({files:manifest([retired[0]]),published:head,version:1668,deploymentHash:'fixed'})}),/読戻し/);passed++;
 }finally{const resolved=path.resolve(dir);assert(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('gmt-retirement-test-'));fs.rmSync(resolved,{recursive:true,force:true});}
 console.log('GAS retirement approval: '+passed+' cases passed; no generic deletion override, concurrent edits and incomplete removal blocked.');
}mainTest().catch(e=>{console.error(e);process.exitCode=1;});
