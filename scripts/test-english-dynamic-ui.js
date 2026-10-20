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
console.log('Dynamic English UI: real abnehmen alias, relation categories, loading text and singular/plural counts passed. Browser mode DOM coverage is recorded separately.');
