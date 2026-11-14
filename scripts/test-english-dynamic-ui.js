'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict'),locale=require('./english-locale');
const root=path.resolve(__dirname,'..'),context=vm.createContext({window:{__SITE_LANGUAGE__:'en'},URLSearchParams});
vm.runInContext(fs.readFileSync(root+'/frontend/search-core.js','utf8'),context);
const index=JSON.parse(fs.readFileSync(root+'/mahler-search-app/data/dic_terms_index.json','utf8'));
const notice=context.buildDictionaryExampleAliasNotice('abnehmen',index);
assert(notice.includes('abnehmend')&&notice.includes('abnehmen')&&notice.includes('also included'));assert(!locale.JAPANESE.test(notice));assert(!notice.includes('English text is not yet available'));
for(const count of [0,1,2,11]){assert.equal(locale.localizeText(count+'件ありました。'),count+(count===1?' entry':' entries'));assert.equal(locale.localizeText('('+count+'件)'), '('+count+(count===1?' entry':' entries')+')');}
assert.equal(locale.localizeText('検索データを読み込んでいます・・・'),'Loading search data…');
for(const type of ['INFLECTION','ORTHOGRAPHIC_VARIANT','RELATED','TYPO']){const terms={related:{id:'term-canonical',canonical:'canonical',type}};for(const count of [0,1]){const result=context.buildTermResolutionNotice('related',terms,count,true);assert(!locale.JAPANESE.test(result));assert(!result.includes('English text is not yet available'));}}
for(const text of ['管理者モード：解析・検索記録 OFF','管理者モード：解析・通知・検索履歴 OFF\n未登録語候補のみ ON']){
 const translated=locale.localizeText(text);assert(translated.startsWith('Admin mode:'));assert(!locale.JAPANESE.test(translated));assert(!translated.includes('English text is not yet available'));
}
assert.equal(locale.localizeText('選択した作品：'),'Selected works:');assert.equal(locale.localizeText('選択した楽器：'),'Selected instruments:');
context.window.__SITE_LANGUAGE__='ja';assert(locale.JAPANESE.test(context.buildDictionaryExampleAliasNotice('abnehmen',index)),'Japanese explanation preserved');
// Exercise the actual dynamic Japanese navigation label, before browser localization.
const {extractFunction}=require('./test-utils/extract-function');
const panel={hidden:true,attributes:{},setAttribute(name,value){this.attributes[name]=value;}},label={textContent:''};
let inserted=null;
const targetElement={parentNode:{insertBefore(element,target){inserted={element,target};}}};
const navigation=vm.createContext({document:{getElementById:id=>({abbrReturnPanel:panel,abbrReturnLabel:label})[id]},hideAbbreviationReturnPanel(){throw Error('Unexpected invalid navigation context');}});
vm.runInContext(extractFunction(fs.readFileSync(root+'/src/generate_dic_html.js','utf8'),'showAbbreviationReturnPanel'),navigation);
const browser=vm.createContext({window:{alert(){}},document:{documentElement:{},addEventListener(){}},MutationObserver:class{observe(){}},queueMicrotask(){},NodeFilter:{SHOW_TEXT:4}});
vm.runInContext(locale.browserSource(),browser);
const headwords=['Ein Stab aus einem Glockenspiel (Klang Fis , ebenso notiert)','mäßig','m.d.','alle als トレモロ音符 notirten Stellen','A &amp; B &lt;C&gt;','„leise“','first line\nsecond line'];
for(const headword of headwords){
 const termId='term-original-headword',missing=new Set(),expected='Return to “'+headword+'”';
 assert.equal(navigation.showAbbreviationReturnPanel(targetElement,{termId,termLabel:headword}),panel);
 const japanese='「'+headword+'」に戻る';assert.equal(label.textContent,japanese,'Japanese label remains unchanged');
 assert.equal(panel.attributes['data-return-target'],termId);assert.equal(panel.hidden,false);assert.equal(inserted.element,panel);assert.equal(inserted.target,targetElement);
 assert.equal(locale.localizeText(label.textContent,missing),expected);assert.equal(missing.size,0,'Navigation must not create a missing Notes entry');
 assert.equal(browser.localizeText(label.textContent,browser.window.__ENGLISH_PREVIEW_MISSING__),expected);
 assert.equal(browser.window.__ENGLISH_PREVIEW_MISSING__.size,0);assert.equal(label.textContent,japanese,'Localization does not mutate the Japanese source label');
 for(const whitespace of [[' ','\t'],['\n  ',' \n']]){
  const input=whitespace[0]+japanese+whitespace[1],translated=whitespace[0]+expected+whitespace[1];assert.equal(locale.localizeText(input,missing),translated);assert.equal(browser.localizeText(input),translated);
 }
}
navigation.showAbbreviationReturnPanel(targetElement,{termId:'term-original-headword',termLabel:''});
assert.equal(label.textContent,'元の見出し語に戻る');assert.equal(locale.localizeText(label.textContent),'Return to the original headword');assert.equal(browser.localizeText(label.textContent),'Return to the original headword');assert.equal(panel.attributes['data-return-target'],'term-original-headword');
for(const source of ['未翻訳の本文がここにあります。','「見出し」に戻るではない本文']){
 const missing=new Set();assert.equal(locale.localizeText(source,missing),'English text is not yet available for this note.');assert(missing.has(source));assert.equal(browser.localizeText(source),'English text is not yet available for this note.');
}
// The runtime-injected score note uses the same translation in Node and the browser.
const operaSource=fs.readFileSync(root+'/mahler-search-app/js/wagner_strauss.js','utf8'),opera=vm.createContext({});
vm.runInContext(extractFunction(operaSource,'injectMottlNote'),opera);
const mottlHtml=opera.injectMottlNote('<div class="score-info-banner">Score information</div><div class="scene-header">Prelude</div>','tristan');
const mottlNote='Felix Mottl による指示も含む',mottlEnglish='Includes directions by Felix Mottl.';
assert(mottlHtml.includes(mottlNote));
assert.equal(locale.localizeText(mottlNote),mottlEnglish);assert.equal(browser.localizeText(mottlNote),mottlEnglish);
const localizedMottl=locale.localizeHtml(mottlHtml);
assert(localizedMottl.indexOf(mottlEnglish)>localizedMottl.indexOf('Score information'));
assert(localizedMottl.indexOf(mottlEnglish)<localizedMottl.indexOf('Prelude'));

// Exercise the shared checkbox builder with every published RW/RS target list.
function checkTargets(language,work,options){
 const group={innerHTML:''},listeners=[],wrapper={innerHTML:'',appendChild(child){assert.equal(child,group);},querySelectorAll(){return options.map(()=>({addEventListener(event,listener){listeners.push([event,listener]);}}));}};
 const targets=vm.createContext({window:{__SITE_LANGUAGE__:language,appData:{whom_list:{[work]:options}}},document:{getElementById:()=>wrapper,createElement:()=>group},normalizeString:value=>value,updateSelectionSummary(){}});
 vm.runInContext(extractFunction(operaSource,'buildWhomCheckboxes'),targets);targets.buildWhomCheckboxes(work);
 const priority=language==='en'?['Orchestra','Stage directions']:['Orchester','舞台指示'];
 const first=priority.filter(value=>options.includes(value)),rest=options.filter(value=>!priority.includes(value));
 const rendered=[...group.innerHTML.matchAll(/value="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(rendered,[...first,...rest],language+'/'+work+': priority order with original search values');
 assert.equal((group.innerHTML.match(/<hr\b/g)||[]).length,first.length&&rest.length?1:0);
 if(first.length&&rest.length){assert(group.innerHTML.indexOf('<hr')>group.innerHTML.indexOf('value="'+first.at(-1)+'"'));assert(group.innerHTML.indexOf('<hr')<group.innerHTML.indexOf('value="'+rest[0]+'"'));}
 assert.equal(listeners.length,options.length,'All checkboxes update the summary');
 for(const [event,listener]of listeners){assert.equal(event,'change');assert.equal(listener,targets.updateSelectionSummary);}
}
for(const language of ['ja','en']){
 const lists=JSON.parse(fs.readFileSync(root+(language==='en'?'/en':'')+'/mahler-search-app/data/whom_list.json','utf8'));
 for(const [work,options]of Object.entries(lists))checkTargets(language,work,options);
 const priority=language==='en'?['Orchestra','Stage directions']:['Orchester','舞台指示'];
 for(const options of [['Singer'],[priority[1],'Singer'],[...priority].reverse()])checkTargets(language,'test',options);
}
console.log('Dynamic English UI: navigation, counts, Mottl note localization/placement and all Japanese/English RW/RS target groups, separators, search values and change listeners passed.');
