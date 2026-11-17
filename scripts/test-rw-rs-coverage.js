'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const locale = require('./english-locale');
const root = path.resolve(__dirname, '..');
const japanese = "※声楽に関する指示と舞台指示（ト書きを含む）はすべて収録している．オーケストラへの指示のうち，";
const english = "All vocal and stage directions, including written stage actions, are included. ";
for (const composer of ['wagner', 'strauss']) {
 const page = fs.readFileSync(path.join(root, 'mahler-search-app/richard_' + composer + '.html'), 'utf8');
 const paragraph = page.match(new RegExp('<p class="page-description">※声楽に関する指示[^]*?</p>'));
 assert(paragraph, composer + ': coverage note exists');
 assert(paragraph[0].startsWith('<p class="page-description">' + japanese), composer + ': approved Japanese wording');
 assert(!page.includes('※主に歌唱・舞台指示を収録し'), composer + ': old wording removed');
 const missing = new Set();
 const translated = locale.localizeHtml(paragraph[0], missing);
 assert(translated.startsWith('<p class="page-description">' + english), composer + ': equivalent English coverage and omission policy');
 assert.equal(missing.size, 0, composer + ': no untranslated text');
 assert.equal((paragraph[0].match(/href="dic.html"/g)||[]).length,1,composer+': one dictionary link per coverage note');
 assert(!translated.includes('Gustav Mahler search page'), composer+': no obsolete Mahler guidance');
 if (composer === 'strauss') {
  assert(paragraph[0].includes('管弦楽曲の用語はここでは検索できないので，これらについても<a href="dic.html">ドイツ語の音楽用語集</a>を参照．'));
  assert(translated.includes('Terms from orchestral works cannot be searched here; consult the <a href="dic.html">German Music Terms Dictionary</a> for these as well.'));
 }
}
console.log('RW/RS coverage: approved Japanese wording, matching English translation, and Strauss dictionary link passed.');
