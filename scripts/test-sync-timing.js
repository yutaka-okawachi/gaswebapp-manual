'use strict';
const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const timing=require('./sync/timing');
(async()=>{
 const secret='SENSITIVE_TOKEN_AND_NOTES_BODY',entries=[],output=[];let ticks=0;
 const r=timing.createRecorder({mode:'Auto',clock:()=>ticks++,now:()=>new Date('2026-11-06T00:00:00Z'),
  write:entry=>entries.push(entry),output:line=>output.push(line)});
 r.stage(1);
 assert.equal(r.measure('snapshot-fetch',()=>secret),secret);
 const failure=Error(secret);
 assert.throws(()=>r.measure('english-prepare',()=>{throw failure;}),error=>error===failure);
 assert.equal(await r.measure('pages-verify',async()=>secret),secret);
 await assert.rejects(r.measure('gas-inspect',async()=>{throw failure;}),error=>error===failure);
 let called=false;
 assert.throws(()=>r.measure(secret,()=>{called=true;}),/Invalid timing/);assert(!called);
 assert.throws(()=>r.stage(8),/Invalid timing/);
 r.stage(7);r.close('failure');const count=entries.length;r.close('failure');assert.equal(entries.length,count);
 for(const e of entries){
  assert.deepEqual(Object.keys(e).sort(),(e.event==='end'?
   ['schemaVersion','runId','sequence','mode','at','event','name','status','elapsedMs']:
   ['schemaVersion','runId','sequence','mode','at','event','name']).sort());
  assert(!JSON.stringify(e).includes(secret));
  if(e.event==='end')assert(Number.isFinite(e.elapsedMs)&&e.elapsedMs>=0);
 }
 assert(!output.join('\n').includes(secret));
 assert.equal(entries.filter(e=>e.name==='stage-1'&&e.event==='end')[0].status,'success');
 assert.equal(entries.at(-1).name,'run');assert.equal(entries.at(-1).status,'failure');
 assert.equal(entries.filter(e=>e.event==='end'&&['english-prepare','gas-inspect'].includes(e.name)&&e.status==='failure').length,2);
 const broken=timing.createRecorder({mode:'Local',write(){throw Error(secret);},output:line=>output.push(line)});
 assert.equal(broken.measure('build',()=>42),42);broken.close('success');assert(!output.join('\n').includes(secret));
 const silent=timing.createRecorder({mode:'Local',write(){},output(){throw Error(secret);}});
 assert.equal(silent.measure('checks',()=>7),7);silent.close('success');
 assert.throws(()=>timing.createRecorder({mode:secret}),/Invalid timing mode/);
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gmt-timing-test-'));
 try{
  timing.start('Local',{root:directory,output(){}});
  timing.stage(1);assert.equal(timing.measure('test:test-sync.js',()=>17),17);timing.end('success');
  const folder=path.join(directory,'.sync-state/timings'),files=fs.readdirSync(folder);
  assert.equal(files.length,1);
  const rows=fs.readFileSync(path.join(folder,files[0]),'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(rows.at(-1).status,'success');assert(rows.some(e=>e.name==='test:test-sync.js'));
  assert.equal(require('./sync/git').isAllowed('.sync-state/timings/'+files[0]),false);
  assert.equal(timing.measure('build',()=>9),9);
 }finally{
  timing.end('failure');const resolved=path.resolve(directory);
  assert(resolved.startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(resolved).startsWith('gmt-timing-test-'));
  fs.rmSync(resolved,{recursive:true,force:true});
 }
 // Exercise the real local-check loop with synthetic process/filesystem adapters.
 const vm=require('vm'),commands=[],checkEntries=[];
 const filename=path.join(__dirname,'check-local.js'),moduleObject={exports:{}};
 let failCommand=false;
 const fakeRequire=name=>({
  fs:{readdirSync:dir=>path.basename(dir)==='scripts'?['test-b.js','not-a-test.js','test-a.js']:['syntax.js'],
      readFileSync:()=> 'const validSyntax = 1;'},
  path,vm,
  './sync/core':{root:'fixture',run:(command,args)=>{commands.push(args);if(failCommand)throw failure;return 'fixture output';}},
  './sync/timing':timing
 }[name]);
 const fixture=vm.createContext({require:fakeRequire,module:moduleObject,process:{platform:'win32',execPath:'node',stdout:{write(){}}},console:{log(){}}});
 vm.runInContext(fs.readFileSync(filename,'utf8'),fixture);
 timing.start('Local',{write:entry=>checkEntries.push(entry),output(){}});
 moduleObject.exports.check();timing.end('success');
 assert.deepEqual(commands.map(args=>args.at(-1)),['scripts/test-a.js','scripts/test-b.js','scripts/test-dashboard-api-check.ps1']);
 assert.deepEqual(checkEntries.filter(e=>e.event==='end'&&e.name.startsWith('test:')).map(e=>e.name),
  ['test:test-a.js','test:test-b.js','test:test-dashboard-api-check.ps1']);
 failCommand=true;timing.start('Local',{write:entry=>checkEntries.push(entry),output(){}});
 try{assert.throws(()=>moduleObject.exports.check(),error=>error===failure);}finally{timing.end('failure');}
 assert(!JSON.stringify(checkEntries).includes(secret));
 assert(checkEntries.some(e=>e.name==='test:test-a.js'&&e.status==='failure'));
 console.log('Sync timing: fixed metadata only, synchronous/asynchronous failure identity, safe I/O failure, phase boundaries, private JSONL and no payload/credential leakage passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});

