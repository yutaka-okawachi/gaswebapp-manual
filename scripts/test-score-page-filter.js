'use strict';
// Exercise the real scene/page/term search handlers and generated public bundle with synthetic rows.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), read = file => fs.readFileSync(path.join(root, file), 'utf8');
function extract(source, name) {
  const start = source.indexOf('function ' + name + '('); assert.notEqual(start, -1, name);
  const open = source.indexOf('{', start); let depth = 0;
  for (let i = open; i < source.length; i++) { if (source[i] === '{') depth++; if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1); }
  throw Error('Unclosed function: ' + name);
}
const source = ['frontend/search-core.js', 'frontend/wagner-view.js', 'frontend/strauss-view.js', 'frontend/result-format.js', 'frontend/search.js'].map(read).join('\n');
const blank = [undefined, null, '', ' ', '\t\r\n', '\u3000', '\u00a0'];
const present = [0, '0', 12, ' 12 '];
const rows = blank.concat(present).map((page, i) => ({ id: i, page, Oper: 'work', Aufzug: '1', Szene: '2', de: 'term' + i, de_normalized: 'term' + i, ja: 'JA-' + i, 準備状態: '保留' }));
const expected = rows.slice(blank.length).map(row => row.id);
let passed = 0;
for (const [label, text] of [['frontend', source], ['generated public bundle', read('mahler-search-app/js/app.js')]]) {
  let captured, selection = 'all'; const result = { innerHTML: '' };
  const c = vm.createContext({ window: { appData: { richard_wagner: rows, richard_strauss: rows, dic_terms_index: {} } },
    document: { querySelector: () => ({ value: 'work' }), querySelectorAll: () => [{ value: selection }], getElementById: id => id === 'results' ? result : { value: '0,12' } },
    setTimeout: fn => fn(), formatGenericResults: data => { captured = Array.from(data, row => row.id); return 'synthetic'; },
    isDictionaryExampleSearch: () => false, getDictionaryExampleSearchQueries: query => [query],
    matchesAnyTermQuery: (value, queries) => queries.some(query => value.includes(query)),
    buildTermResolutionNotice: () => '', createTermHighlightRegexForQueries: () => /term/g,
    linkTermsInTranslation: value => value, escapeHtml: String, escapeHtmlWithBreaks: String
  });
  const names = ['hasScorePage', 'normalizeString', 'normalizeTermSearchText', 'parsePageInput', 'searchRichardWagnerByScene', 'searchRichardStraussByScene', 'searchRichardWagnerByPage', 'searchRichardStraussByPage', 'searchGenericTermsLocal'];
  vm.runInContext(names.map(name => extract(text, name)).join('\n'), c);
  for (const value of blank) { assert.equal(c.hasScorePage({ page: value }), false, label + ': blank ' + JSON.stringify(value)); passed++; }
  for (const value of present) { assert.equal(c.hasScorePage({ page: value }), true, label + ': present ' + JSON.stringify(value)); passed++; }
  for (const fn of ['searchRichardWagnerByScene', 'searchRichardStraussByScene']) {
    for (selection of ['all', '1-2']) { c[fn](); assert.deepEqual(captured, expected, label + ': ' + fn + ' ' + selection); passed++; }
  }
  for (const fn of ['searchRichardWagnerByPage', 'searchRichardStraussByPage']) { c[fn](); assert.deepEqual(captured, expected, label + ': ' + fn); passed++; }
  for (const key of ['richard_wagner', 'richard_strauss']) {
    const meta = {}, html = c.searchGenericTermsLocal('term', key, 'RW', meta, 'partial');
    assert.equal(meta.resultCount, expected.length);
    for (const row of rows) assert.equal(html.includes('JA-' + row.id + '</dd>'), expected.includes(row.id), label + ': term row ' + row.id);
    passed++;
  }
  const start = text.indexOf('window.getGenericTermsListLocal = function'); assert.notEqual(start, -1);
  vm.runInContext(text.slice(start, text.indexOf('\n};', start) + 3), c);
  for (const key of ['richard_wagner', 'richard_strauss']) { assert.deepEqual(Array.from(c.window.getGenericTermsListLocal(key), item => item.original), rows.slice(blank.length).map(row => row.de)); passed++; }
}
// GAS dictionary example shards follow the same blank-page semantics, including a real zero.
const gas = vm.createContext({}); vm.runInContext(read('src/dictionary_example_shards.js'), gas);
const shards = gas.buildDictionaryExampleComposerShards(rows, ['term'], { requirePage: true });
assert.deepEqual(Array.from(shards.shards).flat().map(row => row.id).sort((a, b) => a - b), expected); passed++;

// The authored work/scene pages have their own handlers in addition to app.js.
for (const composer of ['richard_wagner', 'richard_strauss']) {
  let captured;
  const c = vm.createContext({ currentSearchId: 0, window: { appData: { [composer]: rows.map(row => ({ ...row, whom: 'Target' })) } },
    document: { title: composer === 'richard_wagner' ? 'Richard Wagner' : 'Richard Strauss',
      querySelector: () => ({ value: 'work' }),
      querySelectorAll: selector => selector.includes('btn-search') ? [] : [{ value: selector.includes('-whom') ? 'Target' : 'all', parentElement: { textContent: 'All' } }],
      getElementById: () => ({ value: '0,12' }) },
    setTimeout: fn => fn(), setResults: () => {}, injectMottlNote: html => html,
    formatGenericResults: data => { captured = Array.from(data, row => row.id); return 'synthetic'; }
  });
  vm.runInContext(['hasScorePage', 'normalizeString', 'parsePageInput'].map(name => extract(source, name)).join('\n') + '\n' +
    ['searchByScene', 'searchByPage', 'searchByWhom'].map(name => extract(read('mahler-search-app/js/wagner_strauss.js'), name)).join('\n'), c);
  for (const name of ['searchByScene', 'searchByPage', 'searchByWhom']) { c[name](); assert.deepEqual(captured, expected, composer + ': authored ' + name); passed++; }
}

console.log('Score page filters: ' + passed + ' scenarios passed; blanks excluded, zero retained, approval labels ignored.');
