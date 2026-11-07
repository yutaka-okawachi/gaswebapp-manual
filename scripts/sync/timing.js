'use strict';
// Only code-owned names, clocks and status are recorded; never payloads or errors.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {performance}=require('perf_hooks'),{root}=require('./core');
const modes=new Set(['Auto','Data','All','Site','Check','Verify','Local']);
const tasks=new Set(['run','build','gas-build','checks','syntax-checks','github-preflight','remote-check',
 'gas-inspect','gas-head-before','gas-ensure','snapshot-fetch','english-prepare','english-stage',
 'data-install','final-build','cached-build','cached-english','release-manifest','gas-head-commit',
 'gas-head-push','push','pages-verify','dashboard-verify','resume-verify']);
function assertName(name){
 if(!tasks.has(name)&&!/^stage-[1-7]$/.test(name)&&!/^test:test-[a-z0-9_-]+\.(?:js|ps1)$/.test(name))
  throw Error('Invalid timing task name');
}
function createRecorder(options){
 if(!modes.has(options.mode))throw Error('Invalid timing mode');
 const now=options.now||(()=>new Date()),clock=options.clock||(()=>performance.now());
 const output=options.output||(line=>console.log(line)),runId=crypto.randomUUID();
 const say=line=>{try{output(line);}catch(_){/* Logging cannot change operation outcome. */}};
 const file=path.join(options.root||root,'.sync-state','timings',runId+'.jsonl');
 let writing=true,sequence=0,currentStage=null,closed=false,directoryReady=false;
 const write=options.write||(entry=>{if(!directoryReady){fs.mkdirSync(path.dirname(file),{recursive:true});directoryReady=true;}fs.appendFileSync(file,JSON.stringify(entry)+'\n','utf8');});
 function emit(event,name,extra={}){
  const entry={schemaVersion:1,runId,sequence:++sequence,mode:options.mode,at:now().toISOString(),event,name,...extra};
  if(writing)try{write(entry);}catch(_){writing=false;say('[time] Timing file unavailable; operation continues.');}
  say('[time] '+entry.at+' '+name+' '+event+(event==='end'?' '+entry.status+' '+(entry.elapsedMs/1000).toFixed(3)+'s':''));
 }
 function begin(name){assertName(name);const token={name,start:clock()};emit('start',name);return token;}
 function end(token,status){emit('end',token.name,{status,elapsedMs:Math.max(0,Math.round((clock()-token.start)*1000)/1000)});}
 const run=begin('run');
 function measure(name,action){
  const token=begin(name);
  try{
   const value=action();
   if(value&&typeof value.then==='function')return Promise.resolve(value).then(
    result=>{end(token,'success');return result;},error=>{end(token,'failure');throw error;});
   end(token,'success');return value;
  }catch(error){end(token,'failure');throw error;}
 }
 function stage(step){assertName('stage-'+step);if(currentStage)end(currentStage,'success');currentStage=begin('stage-'+step);}
 function close(status){if(closed)return;if(!['success','failure'].includes(status))throw Error('Invalid timing status');closed=true;if(currentStage)end(currentStage,status);end(run,status);}
 return {measure,stage,close,file};
}
let active=null;
function start(mode,options={}){if(active)throw Error('A timing session is already active');active=createRecorder({...options,mode});}
function end(status){const recorder=active;active=null;if(recorder)recorder.close(status);}
function measure(name,action){return active?active.measure(name,action):action();}
function stage(step){if(active)active.stage(step);}
module.exports={createRecorder,start,end,measure,stage};

