'use strict';
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm'),
  crypto = require('node:crypto');

const notesWorkflowSrc = fs.readFileSync(path.join(__dirname, '../src/notes_english_workflow.js'), 'utf8');
const workflowSrc = fs.readFileSync(path.join(__dirname, '../src/source_english_workflow.js'), 'utf8');
const apiSrc = fs.readFileSync(path.join(__dirname, '../src/source_english_api.js'), 'utf8');
const notesApiSrc = fs.readFileSync(path.join(__dirname, '../src/notes_english_api.js'), 'utf8');

const c = vm.createContext({
  console,
  Date,
  Set,
  Map,
  NOTES_ENGLISH_META: 'NOTES_ENGLISH_ROW_V1',
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    getUuid: () => crypto.randomUUID(),
    computeDigest: (_a, s) => Array.from(crypto.createHash('sha256').update(s).digest()),
    newBlob: s => ({ getBytes: () => Array.from(Buffer.from(s, 'utf8')) })
  },
  SpreadsheetApp: {
    DeveloperMetadataVisibility: { DOCUMENT: 'DOCUMENT' }
  }
});

vm.runInContext(notesWorkflowSrc, c);
vm.runInContext(notesApiSrc, c);
vm.runInContext(workflowSrc, c);
vm.runInContext(apiSrc, c);

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log('ok ' + name);
}

// Test 1: Adapter schema definitions
test('adapters: Notes, GM, RW, RS definitions and width', () => {
  const notes = c.sourceEnglishAdapter_('Notes');
  assert.equal(notes.width, 9);
  assert.equal(notes.de, 0);
  assert.equal(notes.ja, 1);
  assert.equal(notes.draft, 3);
  assert.equal(notes.english, 5);
  assert.equal(notes.evidence, 7);
  assert.equal(notes.status, 8);
  assert.equal(notes.metadata, 'NOTES_ENGLISH_ROW_V1');

  const gm = c.sourceEnglishAdapter_('GM');
  assert.equal(gm.width, 10);
  assert.equal(gm.de, 0);
  assert.equal(gm.ja, 2);
  assert.equal(gm.draft, 4);
  assert.equal(gm.english, 6);
  assert.equal(gm.evidence, 8);
  assert.equal(gm.status, 9);
  assert.equal(gm.metadata, 'GM_ENGLISH_ROW_V1');

  const rw = c.sourceEnglishAdapter_('RW');
  assert.equal(rw.width, 15);
  assert.equal(rw.source, 0);
  assert.equal(rw.de, 5);
  assert.equal(rw.ja, 7);
  assert.equal(rw.draft, 9);
  assert.equal(rw.changes, 10);
  assert.equal(rw.english, 11);
  assert.equal(rw.italian, 12);
  assert.equal(rw.evidence, 13);
  assert.equal(rw.status, 14);
  assert.equal(rw.metadata, 'RW_ENGLISH_ROW_V1');

  const rs = c.sourceEnglishAdapter_('RS');
  assert.equal(rs.width, 15);
  assert.equal(rs.source, 0);
  assert.equal(rs.de, 5);
  assert.equal(rs.ja, 7);
  assert.equal(rs.draft, 9);
  assert.equal(rs.changes, 10);
  assert.equal(rs.english, 11);
  assert.equal(rs.italian, 12);
  assert.equal(rs.evidence, 13);
  assert.equal(rs.status, 14);
  assert.equal(rs.metadata, 'RS_ENGLISH_ROW_V1');
});

// Test 2: sourceEnglishSnapshot_ fallback behavior
test('snapshot: GM fallback when draft and status are empty', () => {
  const mockSheet = {
    getRange: (_row, _col, _numRows, _numCols) => ({
      getDisplayValues: () => [['allegro', 'allegro', '速く', 'data1', '', '', '', '', '', '']],
      getNotes: () => [Array(10).fill('')],
      getFormulas: () => [Array(10).fill('')]
    })
  };
  const ctx = { adapter: c.sourceEnglishAdapter_('GM'), sheet: mockSheet };
  const snap = c.sourceEnglishSnapshot_(ctx, 2);
  assert.equal(snap.eligible, true);
  assert.equal(snap.manualEligible, true);
});

test('snapshot: RW fallback when draft and status are empty', () => {
  const values = Array(15).fill('');
  values[0] = 'Score A';
  values[5] = 'adagio';
  values[7] = 'ゆるやかに';
  const mockSheet = {
    getRange: (_row, _col, _numRows, _numCols) => ({
      getDisplayValues: () => [values],
      getNotes: () => [Array(15).fill('')],
      getFormulas: () => [Array(15).fill('')]
    })
  };
  const ctx = { adapter: c.sourceEnglishAdapter_('RW'), sheet: mockSheet };
  const snap = c.sourceEnglishSnapshot_(ctx, 2);
  assert.equal(snap.eligible, true);
  assert.equal(snap.manualEligible, true);
});

test('snapshot: Notes requires draft (strict backward compatibility)', () => {
  const values = Array(9).fill('');
  values[0] = 'sanft';
  values[1] = '柔らかく';
  values[8] = '確認待ち';
  // draft (index 3) is empty
  const mockSheet = {
    getRange: (_row, _col, _numRows, _numCols) => ({
      getDisplayValues: () => [values],
      getNotes: () => [Array(9).fill('')],
      getFormulas: () => [Array(9).fill('')]
    })
  };
  const ctx = { adapter: c.sourceEnglishAdapter_('Notes'), sheet: mockSheet };
  const snap = c.sourceEnglishSnapshot_(ctx, 2);
  assert.equal(snap.eligible, false);
});

// Test 3: Haushofmeister character count & token estimate
test('estimate: Haushofmeister 7006 Japanese characters succeeds within 192 KiB and 16384 tokens', () => {
  const haushofmeisterText = '元執事'.repeat(2335) + '侍'; // 7006 characters
  assert.equal(haushofmeisterText.length, 7006);

  const payload = c.notesEnglishApiPayload_({
    values: ['Haushofmeister', haushofmeisterText, 'Der Rosenkavalier', haushofmeisterText, '', '', '', '']
  });
  assert.equal(payload.max_output_tokens, 16384);

  const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8').length;
  // ~42 KB, well below 192 KiB (196,608 bytes)
  assert(payloadBytes > 40000 && payloadBytes < 196608);

  const est = c.notesEnglishApiEstimate_(payload);
  assert(est.inputBound > payloadBytes);
  assert(est.micro > 0);
  assert(Number.isSafeInteger(est.micro));
});

test('estimate: exceeds 192 KiB throws cleanly without silent truncation', () => {
  const hugeText = 'あ'.repeat(66000); // 198,000 bytes
  const payload = c.notesEnglishApiPayload_({
    values: ['huge', hugeText, '', hugeText, '', '', '', '']
  });
  assert.throws(() => c.notesEnglishApiEstimate_(payload), /192 KiB/);
});

// Test 4: sourceEnglishControls_ multi-tab ledger coexistence
test('controls: multi-tab coexistence in shared ledger', () => {
  const H = 'a'.repeat(64);
  const notesId = 'NE-11111111-1111-1111-1111-111111111111';
  const gmId = 'NE-22222222-2222-2222-2222-222222222222';
  const notesCtrl = {
    schema: 2, mode: 'direct-english-v2', id: notesId, sourceTab: 'Notes', sheetId: 10,
    revision: 1, at: 1800000000000, status: 'BASE', reason: 'INIT',
    inputHash: H, jaHash: H, fHash: H, sourceHash: H, reviewed: false
  };
  const gmCtrl = {
    schema: 2, mode: 'direct-english-v2', id: gmId, sourceTab: 'GM', sheetId: 20,
    revision: 1, at: 1800000000000, status: 'BASE', reason: 'INIT',
    inputHash: H, jaHash: H, fHash: H, sourceHash: H, reviewed: false
  };

  const createMockLedger = (records) => ({
    getLastRow: () => records.length + 2,
    getRange: (_r, _c, n, _w) => ({
      getDisplayValues: () => records.slice(0, n).map(r => [JSON.stringify(r)]),
      getFormulas: () => Array(n).fill([''])
    })
  });

  const ledger = createMockLedger([notesCtrl, gmCtrl]);

  // Context for GM
  const gmCtx = {
    adapter: c.sourceEnglishAdapter_('GM'),
    sheet: { getSheetId: () => 20 },
    ledger: ledger
  };
  const gmResult = c.sourceEnglishControls_(gmCtx);
  assert.equal(Boolean(gmResult[gmId]), true, 'GM control found');
  assert.equal(Boolean(gmResult[notesId]), false, 'Notes control filtered out for GM context');
  assert.equal(gmResult[gmId].row, 4);

  // Context for Notes
  const notesCtx = {
    adapter: c.sourceEnglishAdapter_('Notes'),
    sheet: { getSheetId: () => 10 },
    ledger: ledger
  };
  const notesResult = c.sourceEnglishControls_(notesCtx);
  assert.equal(Boolean(notesResult[notesId]), true, 'Notes control found');
  assert.equal(Boolean(notesResult[gmId]), false, 'GM control filtered out for Notes context');
  assert.equal(notesResult[notesId].row, 3);

  // Rejection when ID is duplicated across records
  const dupLedger = createMockLedger([notesCtrl, Object.assign({}, gmCtrl, { id: notesId })]);
  assert.throws(() => c.sourceEnglishControls_({
    adapter: c.sourceEnglishAdapter_('GM'),
    sheet: { getSheetId: () => 20 },
    ledger: dupLedger
  }), /翻訳制御記録が不正です。/);

  // Rejection when sheetId does not match current sheet
  const badSheetLedger = createMockLedger([Object.assign({}, gmCtrl, { sheetId: 999 })]);
  assert.throws(() => c.sourceEnglishControls_({
    adapter: c.sourceEnglishAdapter_('GM'),
    sheet: { getSheetId: () => 20 },
    ledger: badSheetLedger
  }), /翻訳制御記録が不正です。/);

  // Rejection when sourceTab is invalid
  const badTabLedger = createMockLedger([Object.assign({}, gmCtrl, { sourceTab: 'InvalidTab' })]);
  assert.throws(() => c.sourceEnglishControls_({
    adapter: c.sourceEnglishAdapter_('GM'),
    sheet: { getSheetId: () => 20 },
    ledger: badTabLedger
  }), /翻訳制御記録が不正です。/);
});

console.log(`Source English Adapters: ${passed} scenarios passed.`);
