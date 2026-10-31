'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),os=require('os'),crypto=require('crypto');
const model=require('../frontend/notes-score-model'),{prepare}=require('./prepare-notes-score-views');
const hash='a'.repeat(64),sourceHash='b'.repeat(64),url='https://example.org/score.pdf#page=1';
const image={path:'images/score-pages/test-edition/page-1.png',width:1000,height:1400,sha256:hash};
const item={id:'test-heading-edition',match:{heading:'flüchtig',source:'[GM], [RW: Oper]'},title:{ja:'試験',en:'Test'},credit:{ja:'試験資料の出典',en:'Source of test score'},rightsRecordId:'test-rights',pages:[{id:'opening',pdfUrl:url,printedPage:'3',sourcePdfSha256:sourceHash,full:image,excerpt:null},{id:'scherzo',pdfUrl:'https://example.org/score.pdf#page=126',printedPage:'128',sourcePdfSha256:sourceHash,full:{...image,path:'images/score-pages/test-edition/page-126.png'},excerpt:null}]};
const manifest={schemaVersion:1,items:[item]},ledger={schemaVersion:1,records:[{id:'test-rights',referenceId:item.id,reviewStatus:'private-preview-approved',privatePreviewApproved:true,publicReleaseApproved:false,sourcePdfSha256:sourceHash,pdfUrls:[url,item.pages[1].pdfUrl],assetSha256:[hash]}]};
const clone=x=>JSON.parse(JSON.stringify(x));
const before=JSON.stringify({manifest,ledger}),registry=model.registry(manifest,ledger,{mode:'private-preview'});
assert.equal(registry.size,1);assert.equal(model.registry(manifest,ledger).size,0,'Private GO never authorizes publication');
assert.equal(registry.match('flu\u0308chtig',' [GM], [RW: Oper] ',url).index,0);
assert.equal(registry.match('flüchtig','[GM], [RW: Oper]',item.pages[1].pdfUrl).index,1);
for(const [heading,source,href]of [['flüchtig','[GM]',url],['flüchtig extra',item.match.source,url],['flüchtig',item.match.source,'https://example.org/another.pdf#page=1'],['flüchtig',item.match.source,'https://example.org/score.pdf#page=2']])assert.equal(registry.match(heading,source,href),null);
for(const rows of [[['other','[GM]'],['flüchtig',item.match.source]],[['inserted','[GM]'],['flüchtig',item.match.source],['other','[GM]']]])for(const row of rows)assert.equal(!!registry.match(row[0],row[1],url),row[0]==='flüchtig','No physical row dependency');
const released=clone(ledger);released.records[0].reviewStatus='public-approved';released.records[0].publicReleaseApproved=true;assert.equal(model.registry(manifest,released).size,1);
const noCredit=clone(manifest);delete noCredit.items[0].credit;assert.throws(()=>model.registry(noCredit,released),/credit/);
for(const status of ['GO','approved','pending','blocked','unknown']){const l=clone(ledger);l.records[0].reviewStatus=status;assert.equal(model.registry(manifest,l,{mode:'private-preview'}).size,0);assert.equal(model.registry(manifest,l).size,0);}
let invalid=0;
const reject=mutate=>{const m=clone(manifest),l=clone(ledger);mutate(m,l);assert.throws(()=>model.registry(m,l,{mode:'private-preview'}));invalid++;};
for(const bad of ['../escape.png','/images/score-pages/test-edition/a.png','https://example.org/a.png','data:image/png,a','images/score-pages/test-edition/a.svg','images/score-pages/test-edition/%2e%2e.png','images/score-pages/test-edition/a.png?x=1','images/score-pages/test-edition/a\\b.png'])reject(m=>m.items[0].pages[0].full.path=bad);
for(const bad of [0,-1,20001,Infinity,1.5,'1000'])reject(m=>m.items[0].pages[0].full.width=bad);
for(const bad of ['javascript:alert(1)','http://example.org/a.pdf#page=1','https://u:p@example.org/a.pdf#page=1','https://example.org/a.pdf#page=0','https://example.org/a.pdf','https://example.org/a.pdf#page=1&x=2'])reject(m=>m.items[0].pages[0].pdfUrl=bad);
reject(m=>m.items.push(clone(m.items[0])));
reject(m=>m.items[0].pages.push(clone(m.items[0].pages[0])));
reject(m=>m.items[0].pages[0].sourcePdfSha256='c'.repeat(64));
reject((m,l)=>l.records[0].assetSha256=[]);
reject((m,l)=>l.records.push(clone(l.records[0])));
assert.equal(model.assetUrl(image,'https://site.test/project/mahler-search-app/','https://site.test'),'https://site.test/project/mahler-search-app/'+image.path+'?v='+hash);
for(const base of ['https://other.test/','file:///tmp/','https://u:p@site.test/','https://site.test/base?x=1','https://site.test/base'])assert.throws(()=>model.assetUrl(image,base,'https://site.test'));
assert.equal(JSON.stringify({manifest,ledger}),before,'Validation is read-only');
// The preparer verifies bytes/dimensions and emits no unapproved rights record.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'notes-score-'));
try{
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR6kAAAAASUVORK5CYII=','base64'),digest=crypto.createHash('sha256').update(bytes).digest('hex');
 const m=clone(manifest),l=clone(ledger);m.items[0].pages=[m.items[0].pages[0]];m.items[0].pages[0].full={...image,width:1,height:1,sha256:digest};l.records[0].assetSha256=[digest];
 const file=path.join(dir,'mahler-search-app',image.path);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
 assert.equal(prepare(m,l,dir).manifest.items.length,0);assert.equal(prepare(m,l,dir,'private-preview').manifest.items.length,1);
 const build=require('./notes-score-build');assert.throws(()=>build.approved(dir),/explicit approved manifest/);
 fs.mkdirSync(path.join(dir,'frontend'));fs.mkdirSync(path.join(dir,'scripts'));fs.writeFileSync(path.join(dir,'frontend/notes-score-views.json'),JSON.stringify(m));fs.writeFileSync(path.join(dir,'scripts/notes-score-rights.json'),JSON.stringify(l));assert.throws(()=>build.approved(dir),/Unapproved file/);
 l.records[0].reviewStatus='public-approved';l.records[0].publicReleaseApproved=true;fs.writeFileSync(path.join(dir,'scripts/notes-score-rights.json'),JSON.stringify(l));assert.equal(build.approved(dir).manifest.items.length,1);
 fs.writeFileSync(path.join(dir,'scripts/english-publication.json'),JSON.stringify({schemaVersion:1,publishEnglish:false,englishReleaseApproved:false}));
 const binaryPath='mahler-search-app/'+m.items[0].pages[0].full.path,bilingual=require('./sync/bilingual');
 bilingual.assertReleaseManifest({hashes:{[binaryPath]:digest}},dir);assert.throws(()=>bilingual.assertReleaseManifest({hashes:{[binaryPath]:'0'.repeat(64)}},dir));
 fs.appendFileSync(file,'changed');assert.throws(()=>prepare(m,l,dir,'private-preview'),/digest/);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
const context=vm.createContext({});for(const name of ['dictionary_notation','generate_dic_html'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),context);
const notes=[['flüchtig','[PDF 1頁]('+url+')',item.match.source],['Other','No score','[GM]']];
const render=rows=>context.generateDicListHtml(rows,context.generateDicTermsIndex(rows),{},null,'ja');
const first=render(notes.map(r=>r.slice())),second=render(notes.slice().reverse().map(r=>r.slice()));
assert.equal(first,second);assert(first.includes('data-notes-heading="flüchtig"'));assert(first.includes('data-notes-source="[GM], [RW: Oper]"'));
assert(first.includes('href="'+url+'"'));assert(!first.includes('notes-score-open'),'Server retains ordinary links; only explicitly approved client registry enhances them');
const evil=render([['"><img src=x onerror=alert(1)>','Text','[GM]']]);assert(!evil.includes('<img src=x'));assert(evil.includes('&quot;&gt;&lt;img'));
const publicBuild=require('./notes-score-build'),publicPrepared=publicBuild.approved(),assets=publicBuild.approvedAssets();
assert.equal(publicPrepared.manifest.items.length,0);assert.equal(publicPrepared.ledger.records.length,0);assert.equal(assets.size,0);
assert.equal(model.registry(publicPrepared.manifest,publicPrepared.ledger).size,0);assert.equal(model.registry(publicPrepared.manifest,publicPrepared.ledger).match(item.match.heading,item.match.source,url),null);
const bilingual=require('./sync/bilingual');
assert.throws(()=>bilingual.assertReleaseManifest({hashes:{'mahler-search-app/images/score-pages/unreviewed/page-1.png':hash}}));
const version=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../mahler-search-app/js/notes-score-viewer.js'),'utf8').replace(/\r\n/g,'\n')).digest('hex').slice(0,12),root=path.resolve(__dirname,'..');
for(const original of ['<script defer src="js/notes-score-viewer.js"></script>','<script defer src="js/notes-score-viewer.js?v=old"></script>']){const updated=bilingual.versionScoreViewer(original,root);assert(updated.includes('notes-score-viewer.js?v='+version+'"'));assert.equal(bilingual.versionScoreViewer(updated,root),updated);}
for(const prefix of ['','en/']){const sandbox=vm.createContext({window:{},document:{currentScript:{src:'https://site.test/project/'+prefix+'mahler-search-app/js/notes-score-viewer.js?v=1'}},location:{href:'https://site.test/project/'+prefix+'mahler-search-app/dic.html',origin:'https://site.test'},URL});vm.runInContext(publicBuild.runtimeSource(),sandbox);assert.equal(sandbox.window.__NOTES_SCORE_VIEW_CONFIG__.mode,'public');assert.equal(sandbox.window.__NOTES_SCORE_VIEW_CONFIG__.assetBase,'https://site.test/project/mahler-search-app/');assert.equal(sandbox.window.__NOTES_SCORE_VIEW_CONFIG__.manifest.items.length,0);assert.equal(sandbox.window.__NOTES_SCORE_VIEW_CONFIG__.ledger.records.length,0);}
console.log('Notes score viewer model: '+invalid+' malformed/ambiguous cases, private/public separation, provenance, same-origin image paths, exact stable context, reorder safety, digest gate and escaped static integration passed.');
