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
const maintenanceFiles=['maintenance_model','morphology_survey_dialog','morphology_survey_review'].map(name=>({name,type:name.endsWith('_dialog')?'HTML':'SERVER_JS',source:'reviewed maintenance '+name+'\n'}));
const maintenanceHead=manifest(maintenanceFiles),maintenanceApproval={schemaVersion:1,id:'maintenance-menu-20261103',baselineCommit:'c'.repeat(40),baselineVersion:1689,projectHash:sha256('synthetic'),files:maintenanceHead.filter(f=>f.name!=='appsscript'&&f.name!=='main')};
const maintenanceContext={approval:[approval,maintenanceApproval],scriptId:'synthetic',version:1689};
test('both fixed manifests accept only the three reviewed maintenance modules after English retirement',()=>guard.assertSafe(local,maintenanceHead,maintenanceHead,false,maintenanceContext));
test('no maintenance manifest blocks its three missing modules',()=>assert.throws(()=>guard.assertSafe(local,maintenanceHead,maintenanceHead,false,{...maintenanceContext,approval}),/同期元にない/));
for(const[mode,mutate]of [
 ['wrong baseline',c=>c.approval[1].baselineVersion=1690],['wrong project',c=>c.scriptId='another'],
 ['unknown maintenance name',c=>c.approval[1].files[0].name='unreviewed'],['partial maintenance list',c=>c.approval[1].files.pop()],
 ['duplicate approval',c=>c.approval=[c.approval[1],c.approval[1]]],['too many approvals',c=>c.approval.push(c.approval[1])]
])test('maintenance '+mode+' remains blocked',()=>{const c=JSON.parse(JSON.stringify(maintenanceContext));mutate(c);assert.throws(()=>guard.assertSafe(local,maintenanceHead,maintenanceHead,false,c));});
test('maintenance HEAD edit and partial retirement remain blocked',()=>{
 const edited=maintenanceHead.map(f=>f.name==='maintenance_model'?{...f,hash:'d'.repeat(64)}:f);
 assert.throws(()=>guard.assertSafe(local,edited,maintenanceHead,false,maintenanceContext),/未確認/);
 assert.throws(()=>guard.assertSafe(local,manifest(maintenanceFiles.slice(1)),maintenanceHead,false,maintenanceContext),/構成/);
});
test('unknown fourth module and unrelated unmerged changes are never included in the allowance',()=>{
 assert.throws(()=>guard.assertSafe(local,manifest([...maintenanceFiles,{name:'private_unreviewed',type:'SERVER_JS',source:'x'}]),maintenanceHead,false,maintenanceContext),/private_unreviewed/);
 const edited=maintenanceHead.map(f=>f.name==='main'?{...f,hash:'d'.repeat(64)}:f);
 assert.throws(()=>guard.assertSafe(local,edited,maintenanceHead,false,maintenanceContext),/未統合/);
});
test('both maintenance remote copies already retired need no ongoing baseline exception',()=>guard.assertSafe(local,local,local,false,{...maintenanceContext,version:1690}));
const notesFiles=['notes_publication','notes_publication_baseline'].map(name=>({name,type:'SERVER_JS',source:'reviewed Notes retirement '+name+'\n'}));
const notesHead=manifest(notesFiles),notesApproval={schemaVersion:1,id:'notes-publication-20261105',baselineCommit:'e'.repeat(40),baselineVersion:1703,projectHash:sha256('synthetic'),files:notesHead.filter(f=>f.name!=='appsscript'&&f.name!=='main')};
const notesContext={approval:[approval,maintenanceApproval,notesApproval],scriptId:'synthetic',version:1703};
test('Notes retirement permits only the two exact reviewed 1703 modules',()=>guard.assertSafe(local,notesHead,notesHead,false,notesContext));
test('Notes deletion without its manifest remains blocked',()=>assert.throws(()=>guard.assertSafe(local,notesHead,notesHead,false,maintenanceContext),/同期元にない/));
for(const [name,mutate]of [
 ['version',c=>c.version=1704],['project',c=>c.scriptId='another'],['unknown file',c=>c.approval[2].files[0].name='unreviewed'],
 ['hash',c=>c.approval[2].files[0].hash='f'.repeat(64)],['incomplete pair',c=>c.approval[2].files.pop()],['fourth approval',c=>c.approval.push(c.approval[2])]
])test('Notes retirement rejects '+name,()=>{const c=JSON.parse(JSON.stringify(notesContext));mutate(c);assert.throws(()=>guard.assertSafe(local,notesHead,notesHead,false,c));});
test('Notes HEAD edit, unrelated deletion and partial local retirement stay blocked',()=>{
 assert.throws(()=>guard.assertSafe(local,notesHead.map(f=>f.name==='notes_publication'?{...f,hash:'f'.repeat(64)}:f),notesHead,false,notesContext),/未確認/);
 assert.throws(()=>guard.assertSafe(local,manifest([...notesFiles,{name:'unknown_extra',type:'SERVER_JS',source:'keep'}]),notesHead,false,notesContext),/unknown_extra/);
 assert.throws(()=>guard.assertSafe(manifest([notesFiles[0]]),notesHead,notesHead,false,notesContext),/部分的/);
});
test('retired Notes pair needs no continuing exception after deployment',()=>guard.assertSafe(local,local,local,false,{...notesContext,version:1704}));
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
  const maintenancePath=path.join(dir,'scripts/sync/maintenance-retirement-20261103.json');
  fs.writeFileSync(maintenancePath,JSON.stringify(maintenanceApproval));
  const maintenanceRemote=async()=>({files:maintenanceHead,published:maintenanceHead,version:1689,deploymentHash:'maintenance-fixed'});
  const maintenanceTicket=await guard.preflight({GAS_DEPLOY_URL:'unused'},{local:read,remote:maintenanceRemote});
  await guard.assertUnchanged(maintenanceTicket,{local:read,remote:maintenanceRemote});passed++;
  fs.writeFileSync(maintenancePath,JSON.stringify({...maintenanceApproval,baselineCommit:'d'.repeat(40)}));
  await assert.rejects(()=>guard.assertUnchanged(maintenanceTicket,{local:read,remote:maintenanceRemote}),/確認後/);passed++;
  fs.writeFileSync(maintenancePath,JSON.stringify(maintenanceApproval));
  await guard.verifyUpload(maintenanceTicket,{local:read,remote:async()=>({files:local,published:maintenanceHead,version:1689,deploymentHash:'maintenance-fixed'})});passed++;
  const notesPath=path.join(dir,'scripts/sync/notes-publication-retirement-20261105.json');
  fs.writeFileSync(notesPath,JSON.stringify(notesApproval));
  const notesRemote=async()=>({files:notesHead,published:notesHead,version:1703,deploymentHash:'notes-fixed'});
  const notesTicket=await guard.preflight({GAS_DEPLOY_URL:'unused'},{local:read,remote:notesRemote});
  await guard.assertUnchanged(notesTicket,{local:read,remote:notesRemote});passed++;
  fs.writeFileSync(notesPath,JSON.stringify({...notesApproval,baselineCommit:'f'.repeat(40)}));
  await assert.rejects(()=>guard.assertUnchanged(notesTicket,{local:read,remote:notesRemote}),/確認後/);passed++;
  fs.writeFileSync(notesPath,JSON.stringify(notesApproval));
  await guard.verifyUpload(notesTicket,{local:read,remote:async()=>({files:local,published:notesHead,version:1703,deploymentHash:'notes-fixed'})});passed++;
 }finally{const resolved=path.resolve(dir);assert(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('gmt-retirement-test-'));fs.rmSync(resolved,{recursive:true,force:true});}
 console.log('GAS retirement approval: '+passed+' cases passed; no generic deletion override, concurrent edits and incomplete removal blocked.');
}mainTest().catch(e=>{console.error(e);process.exitCode=1;});
