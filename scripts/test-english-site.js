'use strict';
// No network, no Sheet/GAS mutation, no public data output. English data uses existing renderers.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {buildEnglishSite,assertEnglishReleaseGate}=require('./english-site'),locale=require('./english-locale');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const source={schema:1,hash:'synthetic',readAt:'2026-10-20T00:00:00Z',tabs:{
 GM:[{en:'Play on the manuals only, without using the pedals.',ja:'PRIVATE_JAPANESE',de:'Tasto Solo.',data:'M-8-t1-52-org&',準備状態:'保留'}],
 RW:[{en:'Softly',ja:'PRIVATE_JAPANESE',de:'Leise',Oper:'test',page:0,whom:'PRIVATE_TARGET',whom_en:'Singer, Chorus'},
     {en:'Hidden',ja:'PRIVATE_JAPANESE',de:'Hidden',Oper:'test',page:' \t',whom_en:'Singer'}],
 RS:[{en:'Gently',ja:'PRIVATE_JAPANESE',de:'Sanft',Oper:'test',page:'0',whom:'PRIVATE_TARGET',whom_en:''},{en:'End.',ja:'PRIVATE_JAPANESE',de:'Ende.',Oper:'test',page:3,whom:'',whom_en:''}],
 Notes:[{de:'alle als トレモロ音符 notirten Stellen',en:'Play gently; 柔らかく means softly.',ja:'PRIVATE_JAPANESE',source:'GM'},
        {de:'Klang Fis(の譜例)',en:'',ja:'PRIVATE_FALLBACK',source:'GM'}]
}};
const before=JSON.stringify(source),site=buildEnglishSite(root,source),files=site.files;
assert.equal(JSON.stringify(source),before,'Raw German and private source remain unchanged');
assert.equal(files['mahler-search-app/data/mahler.json'][0].ja,source.tabs.GM[0].en,'Held translations remain included');
assert.equal(files['mahler-search-app/data/richard_wagner.json'].length,1,'Whitespace page excluded; numeric zero retained');
assert.equal(files['mahler-search-app/data/richard_strauss.json'][0].page,'0');
assert.equal(files['mahler-search-app/data/richard_wagner.json'][0].whom,'Singer, Chorus');
assert.equal(site.stats.RS.missingTargetEnglish,1);
assert.equal(site.stats.RS.blankTargetRows,1);
assert.equal(files['mahler-search-app/data/richard_strauss.json'][1].whom,'');
assert.deepEqual(files['mahler-search-app/data/whom_list.json'].test,['Chorus','Singer','Target translation unavailable']);
assert(!JSON.stringify(files).includes('PRIVATE_'),'No Japanese data fallback');
const notes=files['mahler-search-app/data/dic_notes.json'];
assert.equal(notes[0][0],source.tabs.Notes[0].de,'German key stays stable');
assert.equal(notes[0][1],'Play gently; softly means softly.');
assert.equal(notes[1][1],'English translation is not yet available.');
assert.equal(locale.localizeText(notes[0][0]),'alle als [tremolo notes] notirten Stellen');
assert.equal(locale.localizeText(notes[1][0]),'Klang Fis( [musical example])');
assert.equal(locale.localizeText('音楽之友社'),'ONGAKU NO TOMO SHA CORP.');
assert.equal(locale.localizeText('全音楽譜出版社'),'Zen-On Music Co., Ltd.');
assert.throws(()=>assertEnglishReleaseGate(),/disabled/);
assert.throws(()=>assertEnglishReleaseGate({publishEnglish:true}),/disabled/);
assert.doesNotThrow(()=>assertEnglishReleaseGate({publishEnglish:true,englishReleaseApproved:true}));
new vm.Script(locale.browserSource());
// Translate the actual shared pages. Visible tags, identifiers, classes, field values, and CSS stay shared.
const pages=['index.html','privacy.html','license.html',...fs.readdirSync(path.join(root,'mahler-search-app')).filter(n=>n.endsWith('.html')&&!n.endsWith('_test.html')).map(n=>'mahler-search-app/'+n)];
const structure=html=>html.replace(/<!--[^]*?-->|<script\b[^]*?<\/script>|<style\b[^]*?<\/style>/gi,'').match(/<\/?[\w:-]+\b[^>]*>/g).map(tag=>tag.replace(/\b(?:lang|title|alt|placeholder|aria-label|content)=(['"])[^]*?\1/gi,'').replace(/\s+>/g,'>'));
let count=0;
for(const file of pages){const original=files[file]||read(file),translated=site.localizeHtml(original);
 assert.deepEqual(structure(translated),structure(original),file+': shared tag structure');
 assert(/<html\b[^>]*lang="en"/i.test(translated),file+': English document language');
 assert.deepEqual(translated.match(/<style\b[^]*?<\/style>/gi),original.match(/<style\b[^]*?<\/style>/gi),file+': identical inline CSS');
 const visible=translated.replace(/<!--[^]*?-->|<script\b[^]*?<\/script>|<style\b[^]*?<\/style>|<[^>]+>/gi,'');
 assert(!locale.JAPANESE.test(visible),file+': English visible text');
 const jsonld=[...translated.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([^]*?)<\/script>/gi)];
 for(const [,body]of jsonld)assert(!locale.JAPANESE.test(body),file+': English structured metadata');
 count++;
}
assert.equal(site.missing.size,0,'Every current page phrase has an explicit English translation');
const server=read('scripts/preview-english-site.js');assert(!server.includes('<aside'),'No replacement preview layout');
assert(!server.includes('Find English wording'),'No English reverse-search UI');
console.log('English site: named data, blank-page/held/fallback rules, stable German keys, official publishers, release gate and '+count+' shared page structures/CSS passed.');
