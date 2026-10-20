'use strict';
// Shared dictionary/public columns only. Synthetic cells; no Google or paid API calls.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/sheet_column_layout.js'), 'utf8'), context);
let passed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { e.message = name + ': ' + e.message; throw e; } };
const schemas = { Notes: ['de', 'ja', 'source'], GM: ['de', 'de_normalized', 'ja', 'data'], RW: ['Oper', 'Aufzug', 'Szene', 'page', 'whom', 'de', 'de_normalized', 'ja'], RS: ['Oper', 'Aufzug', 'Szene', 'page', 'whom', 'de', 'de_normalized', 'ja'] };
function sheet(tab, mode) {
  let headers = schemas[tab].concat(['en', 'ja_old', 'whom_en', '根拠・未解決点', '準備状態', 'UNRELATED']);
  let values = headers.map(name => name === 'ja' ? '本番の日本語' : name === 'ja_old' ? '旧日本語' : name === '準備状態' ? '保留' : 'value:' + name);
  let notes = headers.map(name => 'note:' + name), formulas = headers.map(name => name === 'UNRELATED' ? '=1+1' : '');
  if (mode === 'reverse') { headers.reverse(); values.reverse(); notes.reverse(); formulas.reverse(); }
  if (mode === 'missing') headers[headers.indexOf('ja')] = 'renamed_ja';
  if (mode === 'duplicate') { headers.push('ja'); values.push('wrong'); notes.push(''); formulas.push(''); }
  const writes = []; let reads = 0;
  const result = { getName: () => tab, getLastColumn: () => headers.length, getRange: (r, c, n = 1, w = 1) => ({
    getDisplayValues: () => { const out = [(r === 1 ? headers : values).slice(c - 1, c - 1 + w).map(String)]; if (r === 2 && mode === 'race' && !reads++) headers.reverse(); return out; },
    getValues: () => [(r === 1 ? headers : values).slice(c - 1, c - 1 + w)],
    getFormulas: () => [(r === 1 ? headers.map(() => '') : formulas).slice(c - 1, c - 1 + w)],
    getNotes: () => [notes.slice(c - 1, c - 1 + w)],
    setValues: rows => { assert.equal(r, 2); assert.equal(n, 1); rows[0].forEach((value, i) => { writes.push(headers[c - 1 + i]); values[c - 1 + i] = value; }); }
  }) };
  return { sheet: result, headers, writes, values, notes, formulas, value: name => values[headers.indexOf(name)] };
}
for (const tab of Object.keys(schemas)) {
  for (const mode of ['original', 'reverse']) test(tab + ' reads active ja and preserves private columns: ' + mode, () => {
    const h = sheet(tab, mode), names = schemas[tab], beforeNotes = h.notes.slice(), beforeFormulas = h.formulas.slice();
    const got = context.namedSheetRead_(h.sheet, names, 2, 1, true);
    assert.equal(got.values[0][names.indexOf('ja')], '本番の日本語');
    context.namedSheetWriteRows_(h.sheet, ['de', 'ja'], 2, [['neu', '更新日本語']]);
    assert.equal(h.value('de'), 'neu'); assert.equal(h.value('ja'), '更新日本語');
    assert.equal(h.value('ja_old'), '旧日本語'); assert.equal(h.value('en'), 'value:en'); assert.equal(h.value('whom_en'), 'value:whom_en');
    assert.equal(h.value('準備状態'), '保留'); assert.equal(h.value('UNRELATED'), 'value:UNRELATED');
    assert.deepEqual(h.notes, beforeNotes); assert.deepEqual(h.formulas, beforeFormulas);
    assert.ok(h.writes.every(name => ['de', 'ja'].includes(name)));
  });
  for (const mode of ['missing', 'duplicate', 'race']) test(tab + ' invalid layout stops: ' + mode, () => {
    const h = sheet(tab, mode); assert.throws(() => context.namedSheetRead_(h.sheet, schemas[tab], 2, 1, true), /見出し|列構成/); assert.deepEqual(h.writes, []);
  });
}
test('named column labels cross Z safely', () => { assert.equal(context.namedSheetColumnLabel_(25), 'Z'); assert.equal(context.namedSheetColumnLabel_(26), 'AA'); });
console.log('Shared source column layout: ' + passed + ' scenarios passed (no network or production writes).');
