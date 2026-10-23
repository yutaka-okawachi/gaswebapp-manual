'use strict';
// One authenticated snapshot supplies both languages. Preparing a build has no writes or network calls.
const fs=require('fs'),path=require('path');
const core=require('./core'),artifacts=require('./artifacts'),{buildEnglishSite}=require('../english-site'),locale=require('../english-locale'),languages=require('../site-languages');
const policyFile='scripts/english-publication.json';
function publicationPolicy(directory=core.root){
 const value=JSON.parse(fs.readFileSync(path.join(directory,policyFile),'utf8'));
 if(!value||JSON.stringify(Object.keys(value).sort())!==JSON.stringify(['englishReleaseApproved','publishEnglish','schemaVersion'])||value.schemaVersion!==1||typeof value.publishEnglish!=='boolean'||typeof value.englishReleaseApproved!=='boolean'||value.publishEnglish!==value.englishReleaseApproved)throw Error('英語公開ゲートの設定が不正または片側だけ承認されています。');
 return value;
}

function publicationTicket(directory=core.root){const policy=publicationPolicy(directory);return {hash:core.sha256(fs.readFileSync(path.join(directory,policyFile),'utf8')),enabled:policy.publishEnglish};}
function assertPolicyUnchanged(ticket,directory=core.root){if(!ticket||publicationTicket(directory).hash!==ticket.hash)throw Error('確認後に英語公開ゲートが変更されました。送信・公開を停止します。');}

function englishEnabled(directory=core.root){return publicationPolicy(directory).publishEnglish;}
function assertPublicTree(directory=core.root){
 if(!englishEnabled(directory)&&fs.existsSync(path.join(directory,'en'))&&fs.readdirSync(path.join(directory,'en')).length)throw Error('英語公開ゲートが閉じています。公開位置 en/ にファイルがあるため同期を停止しました。');
}

function assertReleaseManifest(manifest,directory=core.root){
 if(!manifest||!manifest.hashes||typeof manifest.hashes!=='object'||Array.isArray(manifest.hashes)||!Object.keys(manifest.hashes).length)throw Error('公開記録のファイル一覧が不正です。');
 const enabled=englishEnabled(directory),dataPaths=new Set(artifacts.expectedPaths);
 for(const [file,hash]of Object.entries(manifest.hashes)){
  if(!/^[a-f0-9]{64}$/.test(hash)||file.includes('\\')||/[?%#:\x00-\x1f]/.test(file)||file.split('/').some(part=>!part||part==='..'||part.startsWith('.')))throw Error('公開記録に非公開または不正なパスがあります。');
  if(file.startsWith('en/')&&!enabled)throw Error('英語公開ゲートが閉じています。再開用公開記録に英語ファイルがあります。');
  const local=file.startsWith('en/')?file.slice(3):file;
  if(local.startsWith('mahler-search-app/data/')&&!dataPaths.has(local))throw Error('公開記録に想定外のデータファイルがあります。');
  if(!['index.html','license.html','privacy.html','robots.txt','sitemap.xml'].includes(local)&&!/^mahler-search-app\/[^]*\.(html|js|css|json)$/.test(local))throw Error('公開記録に許可外のファイルがあります。');
 }
}

function validateEnglishSource(snapshot){
 const source=snapshot.englishSource;
 if(!source||source.schema!==1||source.requestId!==snapshot.requestId||source.sourceHash!==snapshot.sourceHash||!source.tabs||typeof source.sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(source.sourceHash)||!Array.isArray(source.termMappings))throw Error('同一取得の英語入力がありません。対応するGASの反映と日英スナップショットが必要です。');
 const specs={GM:['de','de_normalized','ja','en','data'],RW:['Oper','Aufzug','Szene','page','whom','whom_en','de','de_normalized','ja','en'],RS:['Oper','Aufzug','Szene','page','whom','whom_en','de','de_normalized','ja','en'],Notes:['de','ja','en','source']};
 const names={GM:'mahler',RW:'richard_wagner',RS:'richard_strauss',Notes:'dic_notes'};
 for(const [tab,fields]of Object.entries(specs)){
  const rows=source.tabs[tab],japanese=snapshot.files['mahler-search-app/data/'+names[tab]+'.json'];
  if(!Array.isArray(rows)||rows.length!==japanese.length)throw Error('日英の元行数が一致しません: '+tab);
  for(const row of rows)if(!row||fields.some(key=>!Object.hasOwn(row,key))||Object.keys(row).some(key=>!fields.includes(key)&&key!=='__row'))throw Error('英語入力の見出しが不足または許可外です: '+tab);
  if(tab==='Notes'){
   const expected=japanese.map(r=>JSON.stringify([r[0],r[1],r[2]])).sort();
   const actual=rows.map(r=>JSON.stringify([r.de,r.ja,r.source])).sort();
   if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('日英の辞書原文・日本語・出典が一致しません。');
  }else for(let i=0;i<rows.length;i++)for(const key of fields.filter(k=>!['en','whom_en'].includes(k)))if(JSON.stringify(rows[i][key])!==JSON.stringify(japanese[i][key]))throw Error('日英の元行が一致しません: '+tab+':'+(i+2)+':'+key);
 }
 if(source.termMappings.some(row=>!Array.isArray(row)||row.length!==6))throw Error('同一取得の語形対応が不正です。');
 require('../synopsis-links').validateSource(source.synopsis);
 return source;
}
function publicTemplatePaths(directory){
 const result=['index.html','privacy.html','license.html'].filter(p=>fs.existsSync(path.join(directory,p)));
 function walk(relative){for(const entry of fs.readdirSync(path.join(directory,relative),{withFileTypes:true})){
  if(entry.name.startsWith('.'))continue;const file=relative+'/'+entry.name;
  if(entry.isDirectory()){if(file!=='mahler-search-app/data')walk(file);}
  else if(/\.(html|js|css)$/.test(file)&&!/_test\.html$/.test(file)&&!file.endsWith('/release.json'))result.push(file);
 }}walk('mahler-search-app');return result;
}
function prepare(snapshot,requestId,previous={},allowRemoval=false,options={}){
 const directory=options.root||core.root;
 const synopsis=require('../synopsis-links'),baseMetadata=synopsis.readBaseMetadata(core.root);
 const japanese=artifacts.validateSnapshot(snapshot,requestId,previous,allowRemoval),source=validateEnglishSource(snapshot);
 const projectedMetadata=synopsis.projectMetadata(baseMetadata,source.synopsis,'en');
 const site=buildEnglishSite(directory,source,{baseFiles:japanese}),english={};
 const values={...site.files,'mahler-search-app/data/abbr_list.json':japanese['mahler-search-app/data/abbr_list.json']};
 for(const file of new Set([...publicTemplatePaths(directory),...Object.keys(values)])){
  const value=Object.hasOwn(values,file)?values[file]:fs.readFileSync(path.join(directory,file));
  if(file.endsWith('.html')){
   // The mirror retains the shared body/CSS/operations. Relative links resolve within en/.
   const script=file.includes('/')?'js/english-locale.js':'mahler-search-app/js/english-locale.js';
   const template=/(?:rw|rs)_synopsis\.html$/.test(file)?synopsis.rewriteList(String(value),baseMetadata,projectedMetadata,'en'):String(value);
   const html=site.localizeHtml(template).replace(/<head([^>]*)>/i,'<head$1><script>window.__SITE_LANGUAGE__="en";</script><script src="'+script+'"></script>')
    .replaceAll('https://yutaka-okawachi.github.io/gaswebapp-manual/','https://yutaka-okawachi.github.io/gaswebapp-manual/en/');
   english['en/'+file]=languages.decorateHtml(html.replace(/\/en\/(favicon\.png|apple-touch-icon\.png|ogp\.png)/g,'/$1'),{language:'en',englishEnabled:true,file,targetAliases:languages.buildTargetAliases(source)});
  }else english['en/'+file]=Buffer.isBuffer(value)?value.toString('utf8'):value;
 }
 english['en/mahler-search-app/js/score_metadata.js']=synopsis.metadataScript(projectedMetadata);
 const synopsisVersion=core.sha256(core.normalizeText(english['en/mahler-search-app/js/score_metadata.js'])).slice(0,12);
 for(const file of Object.keys(english))if(file.endsWith('.html'))english[file]=english[file].replace(/(score_metadata\.js)(?:\?v=[^"']*)?(?=["'])/g,'$1?v='+synopsisVersion);
 english['en/mahler-search-app/js/english-locale.js']=locale.browserSource();
 english['en/mahler-search-app/js/site-language-switch.js']=languages.runtimeSource();
 artifacts.validateSnapshot({schemaVersion:1,requestId,files:values},requestId,{},false,'en');
 const sortedIndex=value=>JSON.stringify(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)));
 if(sortedIndex(values['mahler-search-app/data/dic_terms_index.json'])!==sortedIndex(japanese['mahler-search-app/data/dic_terms_index.json']))throw Error('日英の辞書ID・語形対応が一致しません。');
 const hashes=Object.fromEntries(Object.entries(english).sort(([a],[b])=>a.localeCompare(b)).map(([file,value])=>[file,core.sha256(serialize(file,value))]));
 const report={schemaVersion:1,requestId,sourceHash:snapshot.sourceHash,inputHash:core.sha256(JSON.stringify(source)),buildHash:core.sha256(JSON.stringify(hashes)),hashes,stats:site.stats,warnings:site.warnings,untranslated:[...site.missing]};
 return {japanese,english,report,snapshot};
}
function serialize(file,value){return Buffer.isBuffer(value)?value:artifacts.formatJson(file,value);}
function safeTarget(directory,relative){if(typeof relative!=='string'||relative.includes('\\')||relative.split('/').some(x=>!x||x==='.'||x==='..')||!relative.startsWith('en/'))throw Error('英語成果物のパスが不正です。');const target=path.resolve(directory,relative);if(!target.startsWith(path.resolve(directory)+path.sep))throw Error('英語成果物が保存先の外です。');for(let item=target;item!==path.dirname(item);item=path.dirname(item))if(fs.existsSync(item)&&fs.lstatSync(item).isSymbolicLink())throw Error('英語成果物の保存先にリンクがあります。');return target;}
function stage(prepared,options={}){
 const directory=options.root||core.root,policy=publicationPolicy(directory),ticket=publicationTicket(directory);assertPublicTree(directory);
 if(policy.publishEnglish&&prepared.report.untranslated.length)throw Error('英語公開用の未翻訳表示が残っています。');
 if(!/^[a-f0-9]{64}$/.test(prepared.report.buildHash))throw Error('英語ビルドIDが不正です。');
 const actualHashes=Object.fromEntries(Object.entries(prepared.english).sort(([a],[b])=>a.localeCompare(b)).map(([file,value])=>[file,core.sha256(serialize(file,value))]));
 if(JSON.stringify(actualHashes)!==JSON.stringify(prepared.report.hashes)||core.sha256(JSON.stringify(actualHashes))!==prepared.report.buildHash)throw Error('英語成果物が検証後に変更されています。');
 for(const warning of prepared.report.warnings||[])console.warn('WARNING: '+warning);
 const staging=path.join(directory,'.sync-state','english',prepared.report.buildHash);
 for(const file of Object.keys(prepared.english))safeTarget(staging,file);
 for(let item=staging;item!==path.dirname(item);item=path.dirname(item))if(fs.existsSync(item)&&fs.lstatSync(item).isSymbolicLink())throw Error('非公開ステージの保存先にリンクがあります。');fs.mkdirSync(staging,{recursive:true});
 for(const [file,value]of Object.entries(prepared.english)){const target=safeTarget(staging,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,serialize(file,value));}
 fs.writeFileSync(path.join(staging,'manifest.json'),JSON.stringify(prepared.report,null,2));
 const cache=path.join(directory,'.sync-state','english');core.atomicJson(path.join(cache,'snapshot.json'),prepared.snapshot);core.atomicJson(path.join(cache,'current.json'),prepared.report);
 assertPolicyUnchanged(ticket,directory);
 if(policy.publishEnglish)for(const [file,value]of Object.entries(prepared.english)){const target=safeTarget(directory,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,serialize(file,value));}
 return {directory:staging,publishedEnglish:policy.publishEnglish,buildHash:prepared.report.buildHash};
}
function refreshStage(options={}){
 const directory=options.root||core.root,file=path.join(directory,'.sync-state','english','snapshot.json');
 if(!fs.existsSync(file)){if(englishEnabled(directory))throw Error('英語公開用の同一取得キャッシュがありません。データ同期が必要です。');return null;}
 const snapshot=JSON.parse(fs.readFileSync(file,'utf8'));
 for(const [name,value]of Object.entries(snapshot.files)){
  if(name.endsWith('.html'))continue;
  const actual=fs.readFileSync(path.join(directory,name),'utf8');
  if(JSON.stringify(JSON.parse(actual))!==JSON.stringify(value))throw Error('日英キャッシュと日本語の公開データが一致しません。データ同期が必要です。');
 }
 return stage(prepare(snapshot,snapshot.requestId,{},false,{root:directory}),{root:directory});
}
module.exports={publicationTicket,assertPolicyUnchanged,publicationPolicy,englishEnabled,assertPublicTree,assertReleaseManifest,validateEnglishSource,prepare,stage,refreshStage};
