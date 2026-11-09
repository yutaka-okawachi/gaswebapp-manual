'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const locale = require('./english-locale');
const root = path.resolve(__dirname, '..');
const japanese = "※声楽に関する指示と舞台指示（ト書きを含む）はすべて収録している．オーケストラへの指示のうち，Gustav Mahler の検索ページで意味を確認できそうなものは省略している．";
const english = "All vocal and stage directions, including written stage actions, are included. Orchestral directions are omitted if their meanings can likely be clarified using the Gustav Mahler search page.";
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
 if (composer === 'strauss') {
  assert(paragraph[0].includes('管弦楽曲の用語は<a href="dic.html">ドイツ語の音楽用語集</a>に掲載．'));
  assert(translated.includes('Terms from orchestral works appear in the <a href="dic.html">German Music Terms Dictionary</a> section.'));
 }
}
console.log('RW/RS coverage: approved Japanese wording, matching English translation, and Strauss dictionary link passed.');
