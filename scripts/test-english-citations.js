'use strict';
const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const locale=require('./english-locale'),citations=require('./english-approved-citations.json'),{englishValue}=require('./english-site');
const browser=vm.createContext({window:{alert(){}},document:{documentElement:{},addEventListener(){}},MutationObserver:class{observe(){}},queueMicrotask(){},NodeFilter:{SHOW_TEXT:4}});
vm.runInContext(locale.browserSource(),browser);
for(const citation of citations){
 const input='The approved Japanese translation is '+citation+'.',missing=new Set();
 assert.equal(englishValue(input,missing),input);assert.equal(missing.size,0);
 assert.equal(browser.localizeText(input,undefined,true),input);
 assert(!locale.JAPANESE.test(locale.localizeText(input)),'General UI keeps existing localization rather than preserving Japanese citations');
 assert(!locale.JAPANESE.test(locale.localizeHtml('<img alt="'+citation.replaceAll('"','&quot;')+'">',missing)),'Attributes retain existing localization and do not preserve Japanese citations');
}
for(const input of ['「これは翻訳されていない日本語本文です。」 (a)','“a” (これは翻訳されていない日本語本文です。)','Return to “未翻訳の日本語本文\n改行を含む”','これは未翻訳の本文です。','English introduction followed by 未翻訳の本文。','「未訳」','「未訳」 (日本語の説明)','「未訳」 (123)','The translation is “quietly” (未知の訳語).','The approved translation is “静かに” (“quietly”), but 未訳の本文 remains.']){
 for(const allow of [false,true]){const missing=new Set();assert.equal(locale.localizeText(input,missing,allow),'English text is not yet available for this note.');assert.equal(missing.size,1);assert.equal(browser.localizeText(input,undefined,allow),'English text is not yet available for this note.');}
 const missing=new Set();englishValue(input,missing);assert(missing.size>0,'Publication must still reject unreviewed Japanese');
}
assert(locale.localizeHtml('<img alt="「これは未翻訳本文です。」 (a)">').includes('alt="English text is not yet available for this note."'));
// An unchanged quotation must not re-trigger the characterData observer forever.
const tasks=[],events={},values=['English explanation: “静かに” (“quietly”).','検索','Return to “日本語を含む見出し”'];let writes=0,observer;
const nodes=values.map((value,i)=>({parentElement:{tagName:'DD',closest(selector){return selector==='.translation'&&i===0||selector==='#abbrReturnLabel'&&i===2?{}:null;}},get nodeValue(){return value;},set nodeValue(next){writes++;value=next;observer();}}));
const dom=vm.createContext({window:{alert(){}},document:{documentElement:{querySelectorAll:()=>[]},addEventListener(name,fn){events[name]=fn;},createTreeWalker(){let n=-1;return {nextNode(){return ++n<nodes.length;},get currentNode(){return nodes[n];}};}},MutationObserver:class{constructor(fn){observer=fn;}observe(){}},queueMicrotask(fn){tasks.push(fn);},NodeFilter:{SHOW_TEXT:4}});
vm.runInContext(locale.browserSource(),dom);events.DOMContentLoaded();let cycles=0;while(tasks.length){assert(++cycles<4,'Observer must settle');tasks.shift()();}
assert.equal(writes,1);assert.equal(nodes[0].nodeValue,values[0]);assert.equal(nodes[1].nodeValue,'Search');assert.equal(nodes[2].nodeValue,values[2]);assert.equal(dom.window.__ENGLISH_PREVIEW_MISSING__.size,0);
console.log('English reviewed citations: '+citations.length+' exact bilingual pairs preserved; arbitrary Japanese, misleading glosses, attributes and non-navigation return text rejected in Node/browser; DOM observer settles without repeated writes.');
