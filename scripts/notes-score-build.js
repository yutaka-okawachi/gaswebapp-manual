'use strict';
const fs=require('fs'),path=require('path');
const {prepare}=require('./prepare-notes-score-views');
function approved(directory=path.resolve(__dirname,'..')){
 const manifestFile=path.join(directory,'frontend','notes-score-views.json'),ledgerFile=path.join(directory,'scripts','notes-score-rights.json'),imageRoot=path.join(directory,'mahler-search-app','images','score-pages');
 if(!fs.existsSync(manifestFile)&&!fs.existsSync(ledgerFile)){
  if(fs.existsSync(imageRoot))throw Error('Score images require an explicit approved manifest');
  return {manifest:{schemaVersion:1,items:[]},ledger:{schemaVersion:1,records:[]}};
 }
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8')),ledger=JSON.parse(fs.readFileSync(ledgerFile,'utf8'));
 const prepared=prepare(manifest,ledger,directory,'public');
 const allowed=new Set(prepared.manifest.items.flatMap(item=>item.pages.flatMap(page=>[page.full,page.excerpt].filter(Boolean).map(asset=>asset.path))));
 function inspect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())inspect(file);
  else if(!allowed.has(path.relative(path.join(directory,'mahler-search-app'),file).split(path.sep).join('/')))throw Error('Unapproved file in public score images');
 }}
 if(fs.existsSync(imageRoot))inspect(imageRoot);
 return prepared;
}
function approvedAssets(directory){
 const result=new Map();
 for(const item of approved(directory).manifest.items)for(const page of item.pages)for(const asset of [page.full,page.excerpt].filter(Boolean)){
  const file='mahler-search-app/'+asset.path;
  if(result.has(file)&&result.get(file)!==asset.sha256)throw Error('Conflicting score image digest');
  result.set(file,asset.sha256);
 }
 return result;
}
function runtimeSource(directory){
 const prepared=approved(directory),config=JSON.stringify({manifest:prepared.manifest,ledger:prepared.ledger,mode:'public'}).replace(/</g,'\\u003c');
 return '(function(){if(typeof window==="undefined"||typeof document==="undefined")return;const script=document.currentScript;if(!script||!script.src)return;const source=new URL(script.src,location.href);if(source.origin!==location.origin)return;const config='+config+';config.assetBase=new URL(/\\/en\\/mahler-search-app\\/js\\/[^/]+$/.test(source.pathname)?"../../../mahler-search-app/":"../",source).href;window.__NOTES_SCORE_VIEW_CONFIG__=config;})();\n';
}
module.exports={approved,approvedAssets,runtimeSource};
