'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const {root}=require('./sync/core'),synopsis=require('./synopsis-links'),{build}=require('./build-site');
const base=synopsis.readBaseMetadata(root),unique=new Map();
for(const [work,meta]of Object.entries(base))if(meta.synopsis&&!unique.has(synopsis.pdfId(meta.synopsis)))unique.set(synopsis.pdfId(meta.synopsis),{work,ja:meta.synopsis,en:''});
const source={schema:1,rows:[...unique.values()]};
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gmt-synopsis-repro-'));
try{
 const file=path.join(directory,'mahler-search-app/js/score_metadata.js');fs.mkdirSync(path.dirname(file),{recursive:true});
 const changed=JSON.parse(JSON.stringify(source));changed.rows[0].ja='https://drive.google.com/file/d/new_approved_japanese_pdf/view';
 const projected=synopsis.projectMetadata(base,changed,'ja');fs.writeFileSync(file,synopsis.metadataScript(projected));
 assert.deepEqual(synopsis.japaneseBuildMetadata(directory,base,undefined),projected,'A clean checkout preserves newer approved B links');
 assert.deepEqual(synopsis.japaneseBuildMetadata(directory,base,changed),projected,'Authenticated snapshot and public projection agree');
 assert.deepEqual(synopsis.japaneseBuildMetadata(directory,base,source),base,'A new authenticated read can replace the old B projection');
 const revised=JSON.parse(JSON.stringify(base));revised[source.rows[0].work].publisher='Revised publisher';const newer=synopsis.japaneseBuildMetadata(directory,revised,undefined);assert.equal(newer[source.rows[0].work].publisher,'Revised publisher');assert.equal(newer[source.rows[0].work].synopsis,changed.rows[0].ja);
 fs.writeFileSync(file,synopsis.metadataScript({...projected,[source.rows[0].work]:{...projected[source.rows[0].work],synopsis:'javascript:alert(1)'}}));assert.throws(()=>synopsis.japaneseBuildMetadata(directory,base,undefined));
}finally{assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(directory).startsWith('gmt-synopsis-repro-'));fs.rmSync(directory,{recursive:true,force:true});}
// Exercise the real build repeatedly. Generated public artifacts must be identical
// with an authenticated source and with its private cache entirely unavailable.
const originalWrite=fs.writeFileSync,originalExists=fs.existsSync;
try{
 fs.writeFileSync=()=>{throw Error('Reproducible build attempted to rewrite a public artifact');};
 build({bilingualSource:{synopsis:source}});
 fs.existsSync=function(file){return path.resolve(String(file))===path.resolve(root,'.sync-state/english/snapshot.json')?false:originalExists.call(this,file);};
 build();build();
}finally{fs.writeFileSync=originalWrite;fs.existsSync=originalExists;}
console.log('Synopsis reproducibility: real cached/cold builds are identical and idempotent; newer B links retained, current score fields applied, authenticated refresh respected and unsafe links rejected. No network or public writes.');
