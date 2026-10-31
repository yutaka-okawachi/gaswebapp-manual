'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const locale = require('./english-locale');
const context = vm.createContext({});
for (const file of ['dictionary_notation', 'generate_dic_html']) {
    vm.runInContext(read('src/' + file + '.js'), context);
}
const allNotes = JSON.parse(read('mahler-search-app/data/dic_notes.json'));
const notes = [allNotes[0], allNotes.find(row => /\[\[score:/.test(row[1])), allNotes.find(row => /https?:/.test(row[1]))].filter(Boolean);
const abbr = JSON.parse(read('mahler-search-app/data/abbr_list.json'));
const before = JSON.stringify(notes);
const ids = html => [...html.matchAll(/<div class="row" id="([^"]+)"/g)].map(match => match[1]);
const references = html => [...html.matchAll(/<a class="dictionary-reference-link"[^>]*>[\s\S]*?<\/a>/g)].map(match => match[0]);
const fixture = [['langsam', '[総譜114頁（PDF 118頁）](https://example.org/score.pdf#page=118)\n[画像](https://example.org/page.png)', '[GM]']];
const fixtureBefore = JSON.stringify(fixture);
for (const language of ['ja', 'en']) {
    const html = context.generateDicHtml(notes.map(row => row.slice()), abbr, null, null, { language });
    const missing = new Set();
    const output = language === 'en' ? locale.localizeHtml(html, missing) : html;
    const guide = output.match(/<div class="page-description dictionary-score-help">([\s\S]*?)<\/div>/);
    assert(guide, 'Each language has page guidance');
    assert.equal((output.match(/class="page-description dictionary-score-help"/g) || []).length, 1);
    assert(output.indexOf(guide[0]) < output.indexOf('<div id="listContainer">'));
    assert.match(guide[1], /<details>\s*<summary>[^<]+<\/summary>/);
    assert(!/<a\b|<script\b|<img\b|tabindex=|role=|onclick=|<details\s+[^>]*\bopen\b/i.test(guide[1]), 'Native closed details needs no script, request or custom keyboard role');
    if (language === 'en') {
        assert(!/[\u3040-\u30ff\u3400-\u9fff]/.test(guide[1]));
        assert.match(guide[1], /counts pages from the start of the file/);
        assert.match(guide[1], /printed page labels/);
        assert.match(guide[1], /varies by device, browser, and PDF viewer/);
        assert(!guide[1].includes('not yet available'));
    } else {
        assert.match(guide[1], /ファイル先頭から数えたページ/);
        assert.match(guide[1], /ページラベルが印刷頁/);
    }
    assert.match(output, /\.dictionary-score-help\s*\{[^}]*overflow-wrap:\s*anywhere/);
    const list = context.generateDicListHtml(notes.map(row => row.slice()), context.generateDicTermsIndex(notes), context.generateAbbreviationIndex(abbr), null, language);
    assert.deepEqual(ids(html), ids(list), 'All dictionary anchors retain their generated identity and order');
    assert.equal(ids(html).length, notes.length);
    assert.deepEqual(references(html), references(list), 'The guide does not rewrite reference URLs or labels');
    const sample = context.generateDicListHtml(fixture.map(row => row.slice()), context.generateDicTermsIndex(fixture), {}, null, language);
    assert.equal((sample.match(/総譜114頁（PDF 118頁）/g) || []).length, 1, 'Sheet page labels appear once');
    assert(sample.includes('href="https://example.org/score.pdf#page=118"'));
    assert(sample.includes('href="https://example.org/page.png"'));
}
assert.equal(JSON.stringify(notes), before);
assert.equal(JSON.stringify(fixture), fixtureBefore);
console.log('Notes PDF guide: JA/EN, native details, wrapping, unchanged labels/URLs and sample anchors passed.');
