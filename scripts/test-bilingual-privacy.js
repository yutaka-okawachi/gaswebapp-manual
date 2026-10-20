'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),artifacts=require('./sync/artifacts'),git=require('./sync/git'),bilingual=require('./sync/bilingual'),{publicPath}=require('./preview-site');
const secret='synthetic-administrator-token',marker='ENGLISH_PRIVATE_SENTINEL',requestId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',logs=[];let exportCount=0;
const c=vm.createContext({Logger:{log:message=>logs.push(String(message))},PropertiesService:{getScriptProperties:()=>({getProperty:name=>name==='GAS_SECRET_TOKEN'?secret:'synthetic'})},HtmlService:{createHtmlOutput:html=>({html,setTitle(){return this;}})},handleDashboardAnalyticsRequest:()=>({json:{status:'success',aggregate:{total:0}}}),handleUnregisteredResultTermObservation:()=>({json:{status:'success'}})});
for(const f of ['mahler_server','web_trigger'])vm.runInContext(fs.readFileSync(path.join(root,'src',f+'.js'),'utf8'),c);
c.createJsonResponse=(json,status=200)=>({json:JSON.parse(JSON.stringify(json)),status});
c.handleSearchNotification=()=>({json:{status:'success'}});
c.exportAllDataToJson=options=>{exportCount++;return {schemaVersion:1,requestId:options.requestId,files:{japanese:'日本語'},...(options.includeEnglish?{englishSource:{tabs:{GM:[{en:marker}]}}}:{})};};
const post=data=>c.doPost({postData:{contents:JSON.stringify(data)}}),noLeak=value=>assert(!JSON.stringify(value).includes(marker));
for(const token of [undefined,'wrong',null,{},0]){const response=post({action:'exportSnapshot',requestId,includeEnglish:true,...(token===undefined?{}:{token})});assert.equal(response.status,401);noLeak(response);}
for(const params of [{},{action:'exportSnapshot',includeEnglish:'true',requestId},{token:'wrong',action:'exportSnapshot',requestId,includeEnglish:'true'}])noLeak(c.doGet({parameter:params}));
assert.equal(exportCount,0,'Unauthenticated routes never invoke the exporter');
for(const method of ['get','post']){const data={api:'dashboard',action:'exportSnapshot',includeEnglish:true,requestId};noLeak(method==='get'?c.doGet({parameter:data}):post(data));}
assert.equal(exportCount,0);
const japanese=post({token:secret,action:'exportSnapshot',requestId});noLeak(japanese);
const english=post({token:secret,action:'exportSnapshot',requestId,includeEnglish:true});assert(JSON.stringify(english).includes(marker));assert.equal(exportCount,2);
for(const includeEnglish of ['true',1,false])noLeak(post({token:secret,action:'exportSnapshot',requestId,includeEnglish}));
noLeak(c.doGet({parameter:{token:secret,action:'exportSnapshot',requestId,includeEnglish:'true'}}));
assert(!logs.join('\n').includes(secret)&&!logs.join('\n').includes(marker));
assert.equal(bilingual.englishEnabled(),false);bilingual.assertPublicTree();
for(const file of ['en/index.html','.sync-state/english/snapshot.json','mahler-search-app/data/english-source.json','scripts/english-source.json'])assert.throws(()=>bilingual.assertReleaseManifest({hashes:{[file]:'a'.repeat(64)}}));
assert.doesNotThrow(()=>bilingual.assertReleaseManifest({hashes:{'index.html':'a'.repeat(64)}}));
for(const file of ['.sync-state/english/snapshot.json','.sync-state/english/current.json','en/index.html','en/mahler-search-app/data/mahler.json'])assert.equal(git.isAllowed(file),false,file);
assert(git.isData('mahler-search-app/data/english-source.json'),'An accidental raw source under data is treated as generated and rejected without an ownership record');
assert(artifacts.publicFiles().every(file=>!file.startsWith('en/')&&!file.startsWith('.sync-state/')));
for(const url of ['/.sync-state/english/snapshot.json','/scripts/english-publication.json','/en/mahler-search-app/data/mahler.json'])assert.equal(publicPath(url),null);
const files=artifacts.previousData();files['mahler-search-app/dic.html']=fs.readFileSync(path.join(root,'mahler-search-app/dic.html'),'utf8');
for(const field of ['en','whom_en','ja_old','準備状態']){const snapshot={schemaVersion:1,requestId,files:JSON.parse(JSON.stringify(files))};snapshot.files['mahler-search-app/data/mahler.json'][0][field]=marker;assert.throws(()=>artifacts.validateSnapshot(snapshot,requestId),/許可外/);}
const unexpected={schemaVersion:1,requestId,files:{...files,'mahler-search-app/data/english-source.json':{en:marker}}};assert.throws(()=>artifacts.validateSnapshot(unexpected,requestId),/想定外/);
console.log('Bilingual privacy: unauthenticated GET/POST/dashboard routes, explicit admin opt-in, logs, Japanese row schema, Git allowlist, manifest and private paths passed; no external API calls.');
