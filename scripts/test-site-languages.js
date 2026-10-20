'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm'),languages=require('./site-languages');
const root=path.resolve(__dirname,'..');
for(const lang of ['ja','en'])for(const from of ['','/ja','/en']){const current='http://localhost:4178'+from+'/mahler-search-app/rs_terms_search.html?q=vollendet&admin=1#results';const url=new URL(languages.switchLanguageUrl(current,lang,{local:true}));assert.equal(url.pathname,'/'+lang+'/mahler-search-app/rs_terms_search.html');assert.equal(url.search,'');assert.equal(url.hash,'');}
assert.equal(new URL(languages.switchLanguageUrl('https://example.test/gaswebapp-manual/en/mahler-search-app/dic.html#term-langsam','ja',{basePath:'/gaswebapp-manual'})).pathname,'/gaswebapp-manual/mahler-search-app/dic.html');
const raw='<html lang="ja"><head></head><body><h1>Title</h1></body></html>';
assert.equal(languages.decorateHtml(raw,{language:'ja',englishEnabled:false,file:'index.html'}),require('./site-legal').decorateHtml(raw,{language:'ja',file:'index.html'}));
const localized=languages.decorateHtml(raw,{language:'en',local:true,file:'index.html'});assert(localized.includes('>Japanese</a>'));assert(localized.includes('>English</a>'));assert.equal((localized.match(/data-language-switch /g)||[]).length,1);assert.equal(languages.decorateHtml(localized,{language:'en',local:true,file:'index.html'}),localized);
for(const name of ['rw_synopsis','rs_synopsis']){const source=fs.readFileSync(path.join(root,'mahler-search-app',name+'.html'),'utf8');const result=languages.decorateHtml(source,{language:'en',local:true,file:'mahler-search-app/'+name+'.html'});assert(result.includes('Available in Japanese only.'));const urls=value=>[...value.matchAll(/href="(https:\/\/drive.google.com[^\"]+)"/g)].map(m=>m[1]);assert.deepEqual(urls(result),urls(source));}
const other=fs.readFileSync(path.join(root,'mahler-search-app/other.html'),'utf8');const annotated=languages.decorateHtml(other,{language:'en',local:true,file:'mahler-search-app/other.html'});assert(annotated.includes('data-japanese-only="essay"'));assert(annotated.includes('Available in Japanese only.'));
const aliases=languages.buildTargetAliases({tabs:{RW:[{Oper:'work',whom:'人物',whom_en:'Character'},{Oper:'work',whom:'曖昧',whom_en:'A'},{Oper:'work',whom:'曖昧',whom_en:'B'},{Oper:'work',whom:'甲,乙',whom_en:'C,D'}],RS:[]}});assert.equal(aliases.ja.work['人物'],'Character');assert.equal(aliases.en.work.Character,'人物');assert(!aliases.ja.work['曖昧']);assert(!aliases.ja.work['甲']);
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const decoratedHome=languages.decorateHtml(home,{language:'en',local:true,file:'index.html'});
assert(/<header[^>]*class="main-header"[^>]*>\s*<!-- language-ui:start --><div[^>]*data-language-switch/.test(decoratedHome),'Home language switch is static inside the visible title header');
assert(decoratedHome.includes('href="/ja/index.html"'));
assert(decoratedHome.includes('href="/en/index.html"'));
assert.equal(languages.decorateHtml(decoratedHome,{language:'en',local:true,file:'index.html'}),decoratedHome);
for(const language of ['ja','en']){
 const result=languages.decorateHtml(raw,{language,local:true,file:'index.html'});
 assert(result.includes('>Japanese</a>'));
 assert(result.includes('>English</a>'));
 assert(!result.includes('>日本語</a>'));
 assert(result.includes('aria-label="Language: Japanese / English"'));
 assert(result.includes('hreflang="ja"'));
}
for(const file of ['mahler-search-app/mahler.html','mahler-search-app/dic.html','mahler-search-app/terms_search.html']){
 const source=fs.readFileSync(path.join(root,file),'utf8'),result=languages.decorateHtml(source,{language:'en',local:true,file});
 assert(/<div[^>]*class="container"[^>]*>\s*<!-- language-ui:start --><div[^>]*data-language-switch/.test(result),'Switch belongs to the title content container: '+file);
}
const legal=languages.decorateHtml(fs.readFileSync(path.join(root,'license.html'),'utf8'),{language:'en',local:true,file:'license.html'});
assert(/<main[^>]*class="legal-page-main"[^>]*>\s*<!-- language-ui:start --><div[^>]*data-language-switch/.test(legal));
let longUrl='https://example.test/gaswebapp-manual/mahler-search-app/mahler.html?q='+('a'.repeat(12000))+'&ui='+encodeURIComponent(JSON.stringify({checks:Array(100).fill({value:'交響曲',checked:true})}))+'#results';
for(let i=0;i<20;i++){longUrl=languages.switchLanguageUrl(longUrl,i%2?'ja':'en',{basePath:'/gaswebapp-manual'});const clean=new URL(longUrl);assert.equal(clean.search,'');assert.equal(clean.hash,'');assert(clean.href.length<150);}
assert(!languages.runtimeSource().includes('searchParams.set'));assert(!languages.runtimeSource().includes('input[type=checkbox]'));assert(!languages.runtimeSource().includes('localStorage'));
new vm.Script(languages.runtimeSource());
assert.equal(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('data-language-switch'),require('./sync/bilingual').englishEnabled(),'Public Japanese navigation follows the explicit release policy');
console.log('Language UI: local/public counterpart paths, clean initial URLs, no state serialization, title-container placement, publication gate, English-language switch labels, Japanese-only resource links and conservative target mapping passed.');
