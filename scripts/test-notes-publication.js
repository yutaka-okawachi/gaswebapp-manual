'use strict';
// Synthetic services only. No credentials, network, Google writes, or publication.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const utilities = { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
  computeDigest: (_, text) => [...crypto.createHash('sha256').update(text).digest()] };
const c = vm.createContext({ Utilities: utilities });
for (const name of ['notes_publication_baseline', 'notes_publication']) vm.runInContext(fs.readFileSync(path.join(root, 'src', name + '.js'), 'utf8'), c);
let passed = 0;
function test(name, run) { try { run(); passed++; } catch (error) { error.message = name + ': ' + error.message; throw error; } }
const clone = value => JSON.parse(JSON.stringify(value));
const record = (values = {}, metadata = {}) => ({ number: 1000, values: { de: 'Saite', ja: '弦．', en: 'String.', source: '[GM]', ...values }, entryId: '', observationId: '', state: '', ...metadata });
function approved(values = {}) { const row = record(values, { entryId: 'notes-synthetic-1', observationId: 'observation-synthetic-1' }); row.state = 'approved:' + c.notesPublicationHash_(row.values); return row; }

test('immutable baseline has all 987 exact headwords, 980 public IDs and a pinned content fingerprint', () => {
  const baseline = vm.runInContext('NOTES_PUBLICATION_LEGACY_BASELINE', c);
  assert.equal(baseline.sourceCommit, '158b5fb0ba2f7979de2778aed313e018ec767db4');
  assert.equal(baseline.entries.length, 987); assert.equal(new Set(baseline.entries.map(row => row[0])).size, 980);
  assert(Object.isFrozen(baseline) && Object.isFrozen(baseline.entries) && baseline.entries.every(Object.isFrozen));
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(baseline.entries)).digest('hex');
  assert.equal(fingerprint, 'fc5fc5fd0fdbbdc5f675ea080ff67566d88117e65fbaf8102e024bca3faf256e');
  assert.equal(baseline.sha256, fingerprint);
  for (const [id, word] of baseline.entries) {
    assert.equal(c.notesPublicationPublicId_(word), id);
    assert(c.notesPublicationIsPublished_(record({ de: word })));
  }
});
test('new headwords and colliding new spellings never inherit legacy publication', () => {
  assert(!c.notesPublicationIsPublished_(record()));
  assert(!c.notesPublicationIsPublished_(record({ de: 'langsam!!!' })));
  assert.equal(c.notesPublicationPublicId_('langsam!!!'), c.notesPublicationPublicId_('langsam'));
  assert(c.notesPublicationIsPublished_(record({ de: ' langsam ' })));
  assert(!c.notesPublicationIsPublished_(record({ de: 'Langsam' })));
});
test('initial approval is required, and later complete edits remain public', () => {
  const row = approved(); assert(c.notesPublicationIsPublished_(row));
  for (const key of ['de', 'ja', 'en', 'source']) {
    const edit = clone(row); edit.values[key] += ' '; assert(c.notesPublicationIsPublished_(edit), key);
    assert(!c.notesPublicationIsPublished_(approved({ [key]: '' })), 'empty ' + key);
    assert(!c.notesPublicationIsPublished_(approved({ [key]: ' ' })), 'whitespace ' + key);
  }
  for (const state of ['', 'draft', 'writing', 'unknown', 'published', 'approved', row.state.toUpperCase(), row.state + ' ']) assert(!c.notesPublicationIsPublished_({ ...row, state }), state);
  assert(!c.notesPublicationIsPublished_({ ...row, entryId: '' }));
  assert(!c.notesPublicationIsPublished_(record({ de: 'langsam' }, { observationId: 'observation-present' })));
  assert(!c.notesPublicationIsPublished_(record({ de: 'langsam' }, { state: 'writing' })));
});
test('hash canonical order is exact cell text, including unicode, whitespace and line endings', () => {
  const v = { de: 'Saite', ja: '弦\n説明', en: 'String.', source: '[GM]' };
  const expected = crypto.createHash('sha256').update(JSON.stringify([v.de, v.ja, v.en, v.source])).digest('hex');
  assert.equal(c.notesPublicationHash_(v), expected);
  assert.notEqual(c.notesPublicationHash_(v), c.notesPublicationHash_({ ...v, ja: '弦\r\n説明' }));
  assert.notEqual(c.notesPublicationHash_({ ...v, de: 'ä' }), c.notesPublicationHash_({ ...v, de: 'a\u0308' }));
  assert.equal(c.notesPublicationHash_({ de: null }), c.notesPublicationHash_({ de: undefined, ja: '', en: '', source: '' }));
});

function sheetFixture(values) {
  const rows = clone(values), writes = [];
  let maxColumns = Math.max(...rows.map(row => row.length));
  const sheet = { getName: () => 'Notes', getLastColumn: () => Math.max(...rows.map(row => row.length)), getLastRow: () => rows.length,
    getMaxRows: () => 2000, getMaxColumns: () => maxColumns,
    insertColumnsAfter(after, count) { assert.equal(after, maxColumns); maxColumns += count; writes.push({ operation: 'insert', count }); },
    getDataRange: () => ({ getValues: () => rows.map(row => row.slice()) }),
    getRange(r, col, height = 1, width = 1) { return {
      getValues: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => rows[r + i - 1]?.[col + j - 1] ?? '')),
      canEdit: () => true, isPartOfMerge: () => false,
      setValues(data) { writes.push({ row: r, column: col, values: clone(data) }); for (let i = 0; i < height; i++) for (let j = 0; j < width; j++) rows[r + i - 1][col + j - 1] = data[i][j]; },
      setValue(value) { writes.push({ row: r, column: col, value }); rows[r - 1][col - 1] = value; }
    }; }
  };
  return { sheet, rows, writes };
}
test('read is pure and does not create metadata; optional legacy English column stays compatible', () => {
  const f = sheetFixture([['de', 'ja', 'source', 'other'], ['langsam', 'ゆっくり', '[GM]', 'KEEP']]);
  const before = JSON.stringify(f.rows), r = c.notesPublicationRead_(f.sheet);
  assert.equal(r.rows[0].number, 2); assert.equal(r.rows[0].values.en, ''); assert(c.notesPublicationIsPublished_(r.rows[0]));
  assert.equal(JSON.stringify(f.rows), before); assert.equal(f.writes.length, 0);
});
test('explicit metadata setup appends only missing headers once and never touches legacy cells', () => {
  const f = sheetFixture([['de', 'ja', 'en', 'source', 'existing-stat'], ['langsam', 'ゆっくり', 'Slowly', '[GM]', 'KEEP']]);
  const before = JSON.stringify(f.rows[1]);
  const result = c.notesPublicationEnsureColumns_(f.sheet); assert.equal(result.appended.length, 3); assert.equal(JSON.stringify(f.rows[1]), before);
  assert(c.notesPublicationIsPublished_(c.notesPublicationRead_(f.sheet).rows[0]));
  const count = f.writes.length; c.notesPublicationEnsureColumns_(f.sheet); assert.equal(f.writes.length, count);
  c.notesPublicationCell_(f.sheet, 2, 'publication_state').setValue('draft'); assert.equal(f.rows[1][6], 'draft');
  assert.throws(() => c.notesPublicationCell_(f.sheet, 1, 'publication_state'));
  assert.throws(() => c.notesPublicationCell_(f.sheet, 2, 'ja'));
});
test('header moves preserve values; duplicates and duplicate entry IDs fail closed', () => {
  const row = approved();
  const names = ['source', 'maintenance_observation_id', 'ja', 'publication_state', 'de', 'maintenance_id', 'en'];
  const cells = names.map(key => key === 'publication_state' ? row.state : key === 'maintenance_id' ? row.entryId : key === 'maintenance_observation_id' ? row.observationId : row.values[key]);
  const rows = c.notesPublicationRows_([names, cells]); assert(c.notesPublicationIsPublished_(rows[0]));
  assert.equal(JSON.stringify(rows[0].values), JSON.stringify(row.values));
  assert.throws(() => c.notesPublicationRows_([names.concat('publication_state'), cells]), /重複/);
  assert.throws(() => c.notesPublicationRows_([names, cells, cells]), /maintenance_id/);
  assert.throws(() => c.notesPublicationRows_([['de', 'source'], ['langsam', '[GM]']]), /必須列/);
});
test('mappings to private entries are excluded while missing-heading errors remain visible', () => {
  const old = record({ de: 'langsam' }), hidden = record(), collision = record({ de: 'langsam!!!' });
  const mappings = [['langsam', 'langsamer'], ['Saite', 'Saiten'], ['langsam!!!', 'unsafe_alias'], ['truly_missing', 'missing_alias']];
  assert.deepEqual(clone(c.notesPublicationFilterMappings_([old, hidden, collision], mappings)), [mappings[0], mappings[3]]);
  assert.deepEqual(clone(c.notesPublicationFilterMappings_([old, approved()], mappings.slice(0, 2))), mappings.slice(0, 2));
});

const fixture = path.join(__dirname, 'test-bilingual-sync.js');
const prefix = fs.readFileSync(fixture, 'utf8').split('const legacy=')[0];
const synthetic = vm.runInNewContext(prefix + ';({c,tables});', { require: createRequire(fixture), __dirname, console });
synthetic.c.Utilities = utilities;
const tables = synthetic.tables, gas = synthetic.c;
const originalBook = gas.SpreadsheetApp.openById();
gas.SpreadsheetApp.openById = () => ({ getSheetByName(name) {
  const sheet = originalBook.getSheetByName(name);
  return sheet && { ...sheet, getName: () => name, getLastRow: () => tables[name].length };
} });
gas.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'synthetic' }) };
vm.runInContext(fs.readFileSync(path.join(root, 'src', 'dashboard_analytics.js'), 'utf8'), gas);
tables.Notes[0].push('maintenance_id', 'publication_state', 'maintenance_observation_id');
// A complete new row without metadata remains private and creates a gap in public source row numbers.
tables.Notes.push(['GapUnpublished', 'PRIVATE_NOTES_GAP', 'PRIVATE_ENGLISH_GAP', '[GM]', '']);
tables.Notes.push(['Saite', 'PRIVATE_NOTES_DRAFT', 'PRIVATE_NOTES_ENGLISH_DRAFT', '[GM]', '', 'notes-synthetic-1', 'writing', 'observation-private']);
tables['語形対応'].push(['Saite', 'Saiten', '複数形', '対象', '対象', 'PRIVATE_MAPPING']);
const capture = () => clone(gas.exportAllDataToJson({ requestId: 'publication-fixture', includeEnglish: true }));
test('private Notes, source rows, aliases and metadata are absent from all 58 Japanese artifacts and English capture', () => {
  const snapshot = capture();
  assert.equal(Object.keys(snapshot.files).length, 58);
  assert.equal(snapshot.files['mahler-search-app/data/dic_notes.json'].length, 1);
  assert.equal(snapshot.englishSource.tabs.Notes.length, 1);
  assert.equal(snapshot.englishSource.termMappings.length, 1);
  assert(!/PRIVATE_|Saite|Saiten|maintenance_id|publication_state|observation-private/.test(JSON.stringify(snapshot)));
  assert(!gas.generateDicHtmlFromSpreadsheet().includes('PRIVATE_'));
  assert(!Object.hasOwn(gas.readDashboardTranslationMap(), 'saite'));
  assert(!Object.hasOwn(gas.readDashboardTranslationMap('en'), 'saite'));
  const prepared = require('./sync/bilingual').prepare(snapshot, snapshot.requestId);
  assert(!/PRIVATE_|Saite|Saiten|observation-private/.test(JSON.stringify(prepared.english)));
});
test('initial approval publishes both languages, and subsequent manual edits stay included', () => {
  const row = tables.Notes[3]; row[1] = '弦．'; row[2] = 'String.';
  row[6] = 'approved:' + gas.notesPublicationHash_({ de: row[0], ja: row[1], en: row[2], source: row[3] });
  let snapshot = capture(); assert.equal(snapshot.files['mahler-search-app/data/dic_notes.json'].length, 2);
  assert.equal(snapshot.englishSource.tabs.Notes[1].__row, 4);
  assert.equal(snapshot.englishSource.termMappings.length, 2);
  assert.equal(snapshot.files['mahler-search-app/data/dic_terms_index.json'].saiten.id, 'term-saite');
  assert.equal(gas.readDashboardTranslationMap().saite, '弦．');
  assert.equal(gas.readDashboardTranslationMap('en').saite, 'String.');
  row[1] += ' 手動修正．'; row[2] += ' Changed.'; snapshot = capture(); assert.equal(snapshot.files['mahler-search-app/data/dic_notes.json'].length, 2);
  assert.equal(snapshot.englishSource.tabs.Notes.length, 2); assert.equal(snapshot.englishSource.termMappings.length, 2);
  assert.equal(gas.readDashboardTranslationMap().saite, row[1]); assert.equal(gas.readDashboardTranslationMap('en').saite, row[2]);
});
console.log('Notes publication: ' + passed + ' scenarios passed; immutable 987-entry compatibility, initial approval and freely edited existing entries, draft exclusion across Japanese/English capture/HTML/aliases, moved columns and write-free reads. No external calls.');
