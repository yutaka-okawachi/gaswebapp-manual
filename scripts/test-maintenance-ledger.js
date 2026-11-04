'use strict';
// Spreadsheet/service simulation only. Every network and production registration is a test failure.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
let passed = 0;
function test(name, fn) { try { fn(); passed++; } catch (e) { e.message = name + ': ' + e.message; throw e; } }
const plain = v => JSON.parse(JSON.stringify(v));
function fixture() {
  const sheets = new Map(), properties = new Map(), h = { sheets, properties, writes: 0, fetches: 0, next: 10, fail: null, propertyFailure: '', locks: 0 };
  function hook(where, sheet) { if (h.fail) h.fail(where, sheet); }
  const clone = value => value instanceof Date ? new Date(value) : Array.isArray(value) ? value.map(clone) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clone(v)])) : value;
  function table(name, headers, rows = []) {
    const sheet = { name, data: [headers.slice(), ...rows.map(clone)], id: h.next++, hidden: false, formulas: [], validations: [], maxRows: 1000, maxColumns: headers.length || 26,
      getName() { return this.name; }, getSheetId() { return this.id; }, getParent() { return book; },
      getLastRow() { return this.data.length; }, getLastColumn() { return Math.max(...this.data.map(r => r.length)); }, getMaxRows() { return this.maxRows; }, getMaxColumns() { return this.maxColumns; },
      insertRowsAfter(_, count) { h.writes++; this.maxRows += count; },
      getRange(row, col, height = 1, width = 1) {
        const range = { getValues: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => clone(sheet.data[row + i - 1]?.[col + j - 1] ?? ''))),
          getFormulas: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => sheet.formulas[row + i - 1]?.[col + j - 1] || '')),
          getDataValidations: () => Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>{const v=sheet.validations[row+i-1]?.[col+j-1];return v?{getCriteriaType:()=>v.type,getCriteriaValues:()=>v.args,getAllowInvalid:()=>v.allowInvalid,getHelpText:()=>v.help}:null;})),
          getValue: () => range.getValues()[0][0],
          setValues(values) { hook('beforeWrite', sheet); h.writes++; for (let i = 0; i < height; i++) { while (sheet.data.length < row + i) sheet.data.push([]); for (let j = 0; j < width; j++) { let v = values[i][j]; if (typeof v === 'string' && /^'[=+@-]/.test(v)) v = v.slice(1); sheet.data[row + i - 1][col + j - 1] = clone(v); } } hook('afterWrite', sheet); return range; },
          setValue(value) { return range.setValues([[value]]); } };
        return range;
      }, appendRow(row) { return this.getRange(this.data.length + 1, 1, 1, row.length).setValues([row]); },
      copyTo() { h.writes++; const copied = table('Copy_' + this.id, this.data[0], this.data.slice(1)); copied.formulas = clone(this.formulas); copied.validations=clone(this.validations);copied.maxRows=this.maxRows;copied.maxColumns=this.maxColumns; hook('copy', copied); return copied; },
      setName(value) { sheets.delete(this.name); this.name = value; sheets.set(value, this); h.writes++; return this; },
      hideSheet() { this.hidden = true; h.writes++; return this; }
    }; sheets.set(name, sheet); return sheet;
  }
  const book = { getId: () => 'test-book', getSheetByName: name => sheets.get(name) || null, insertSheet: name => { h.writes++; return table(name, []); } };
  h.book = book; h.table = table;
  const c = vm.createContext({ console, Date, Set, Map, JSON, Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (_, s) => [...crypto.createHash('sha256').update(String(s)).digest()] },
    SpreadsheetApp: { getActiveSpreadsheet: () => book, flush() { hook('flush'); } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => properties.get(k) || (k === 'TYPESAFE_API_KEY' ? 'test-only' : null), setProperty(k, v) { if (h.propertyFailure === 'before') throw Error('property write failed'); properties.set(k, v); h.writes++; if (h.propertyFailure === 'after') throw Error('property outcome unknown'); } }) },
    LockService: { getScriptLock: () => ({ tryLock() { assert.equal(h.locks, 0); h.locks++; return true; }, releaseLock() { h.locks--; } }) },
    UrlFetchApp: { fetch() { h.fetches++; throw Error('NETWORK FORBIDDEN'); } },
    namedSheetRead_: (sheet, fields, start, count) => ({ values: sheet.getRange(start, 1, count, fields.length).getValues() }),
    sheetLiteralValue_: v => typeof v === 'string' && /^[=+@-]/.test(v) ? "'" + v : v,
    maintenanceStylePunctuation_: v => v,
    rowCompletionError_: message => Error(message)
  });
  for (const name of ['dictionary_candidate_workflow.js', 'dictionary_candidate_wizard.js', 'jev_candidate_review.js', 'maintenance_workbench.js', 'maintenance_ledger.js']) vm.runInContext(fs.readFileSync(path.join(root, 'src', name), 'utf8'), c, { filename: name });
  h.c = c; h.defs = c.maintenanceLedgerDefinitions_();
  const obs = (id, term, status = '未判定', review = '') => [id, term, term.toLowerCase(), new Date('2026-09-01T00:00:00Z'), '', 1, '用語から検索 (GM)', 1, status, review, ''];
  const review = (id, term, category, headword, decision) => [id, term, 'Original context ' + term, term.toLowerCase(), 'Jev', 'ADVISORY', category, headword, '', 0.8, 0.7, 'original candidates', decision, '', new Date('2026-09-02T00:00:00Z')];
  const candidate = (id, term, reviewId, experiment = false) => { const r = Array(28).fill(''); Object.assign(r, { 0: id, 1: term, 2: term.toLowerCase(), 10: experiment ? 'GPT草案確認中' : 'Notes反映済み', 11: experiment ? '実験行．本番Notesへ登録しない．' : '', 12: '作成済み', 13: '{"text":"original draft"}', 14: reviewId, 16: term, 26: experiment ? '未確認' : '確認済み' }); return r; };
  h.obs = obs; h.review = review; h.candidate = candidate;
  // 132 observations, 23 reviews, 10 candidates; include orphan history, pending and mismatched transfers.
  const obsRows = Array.from({ length: 132 }, (_, i) => obs('observation-' + (i + 1).toString(16).padStart(24, '0'), 'word ' + i));
  const reviewRows = Array.from({ length: 23 }, (_, i) => review('review-' + i, 'word ' + i, 'INFLECTION', 'base ' + i, '採用'));
  reviewRows[0] = review('held-orphan', 'markiren', 'TYPO', 'markieren', '保留');
  reviewRows[1] = review('held-orphan-2', 'zartfließend', 'NEW_TERM_CANDIDATE', '', '保留');
  reviewRows[2] = review('pending-linked', 'ein gefangener', 'NEW_TERM_CANDIDATE', '', '未確認');
  reviewRows[3] = review('pending-linked-2', 'staerk', 'ORTHOGRAPHIC_VARIANT', 'stark', '未確認');
  for (let i = 2; i < 23; i++) { obsRows[i][1] = reviewRows[i][1]; obsRows[i][2] = reviewRows[i][3]; obsRows[i][8] = i < 4 ? 'Jev判定済み' : '候補移送済み'; obsRows[i][9] = reviewRows[i][0]; }
  const candidateRows = Array.from({ length: 10 }, (_, i) => candidate(i === 0 ? 'test-gpt-experiment' : 'candidate-' + i, i === 0 ? 'hingebungsvoll' : 'new ' + i, i === 0 ? 'STEP11-MANUAL-TEST' : 'review-' + (i + 3), i === 0));
  for (let i = 1; i < 10; i++) { reviewRows[i + 3][6] = 'NEW_TERM_CANDIDATE'; reviewRows[i + 3][7] = ''; }
  const mapRows = reviewRows.filter((r, i) => i >= 13 && i !== 21 && i !== 22).map(r => [r[7], r[1], '別綴り', '対象', '対象', '']);
  h.legacy = h.defs.map((d, i) => table(d.name, d.headers, [obsRows, reviewRows, candidateRows][i]));
  h.rule=()=>({type:'VALUE_IN_LIST',args:[['未確認','採用','保留'],true],allowInvalid:false,help:'Choose a reviewed state'});
  h.legacy.forEach((s,i)=>{if(i===2)return;for(let row=1;row<s.data.length;row++){s.validations[row]=[];s.validations[row][i===0?8:12]=h.rule();}});
  h.mapping = table('語形対応', ['見出し', '関連語形', '語形区分', '用語検索', '実例検索', '補足'], mapRows);
  h.notes = table('Notes', ['de', 'ja', 'source'], [...reviewRows.map(r => r[7]).filter(Boolean), ...candidateRows.slice(1).map(r => r[16])].map(s => [s, '', '']));
  h.plan = () => c.maintenanceLedgerPlanMigration(); h.migrate = () => { const p = h.plan(); return c.maintenanceLedgerMigrate(p.planHash, true); };
  h.view = kind => { const d = h.defs.find(d => d.kind === kind); return c.requireSheetWithHeaders(book, d.name, d.headers); };
  h.raw = kind => h.legacy[h.defs.findIndex(d => d.kind === kind)];
  h.records = () => c.maintenanceLedgerRecords_(sheets.get('保守管理台帳'));
  h.finish = () => { assert.equal(h.fetches, 0); assert.equal(h.locks, 0); };
  return h;
}
test('read-only plan retains 165 distinct records, orphan history and experiment; no writes', () => {
  const h = fixture(), before = h.writes, p = h.plan(); assert.deepEqual(plain(p.plan.sources.map(s => s.count)), [132, 23, 10]);
  assert(p.plan.issues.some(i => i.type === 'experiment')); assert(p.plan.issues.some(i => i.type === 'unlinked_history')); assert.equal(p.plan.issues.filter(i => i.type === 'transfer_mismatch').length, 2);
  assert.equal(h.writes, before); h.finish();
});
test('migration backs up every original and activates only after all records match', () => {
  const h = fixture(), original = h.legacy.map(s => plain(s.data)), result = h.migrate(); assert.equal(result.status, 'activated'); assert.equal(h.records().length, 165);
  h.defs.forEach((d, i) => { const rows = h.records().filter(r => r.kind === d.kind).map(r => plain(r.row)); assert.deepEqual(rows, original[i].slice(1)); assert.deepEqual(plain(h.legacy[i].data), original[i]); assert.equal(h.legacy[i].hidden, false); });
  assert.equal(result.receipt.backups.length, 3); result.receipt.backups.forEach(b => { assert.equal(h.sheets.get(b.name).hidden, true); }); h.finish();
});
test('same-plan retry after activation is a read-only verification', () => { const h = fixture(), p = h.plan(); h.c.maintenanceLedgerMigrate(p.planHash, true); const before = h.writes; assert.equal(h.c.maintenanceLedgerMigrate(p.planHash, true).status, 'already_active'); assert.equal(h.writes, before); h.finish(); });
test('different-plan retry and absent explicit confirmation are rejected', () => { const h = fixture(); assert.throws(() => h.c.maintenanceLedgerMigrate(h.plan().planHash, false), /明示承認/); h.migrate(); assert.throws(() => h.c.maintenanceLedgerMigrate('f'.repeat(64), true), /別の移行計画/); h.finish(); });
for (const variant of ['duplicate', 'blank', 'formula', 'extra', 'oversize']) test('migration refuses ' + variant + ' without any writes', () => {
  const h = fixture(), s = h.raw('review');
  if (variant === 'duplicate') s.data[2][0] = s.data[1][0]; if (variant === 'blank') s.data[1][0] = ''; if (variant === 'formula') s.formulas[1] = ['=1']; if (variant === 'extra') s.data[1].push('unmapped'); if (variant === 'oversize') s.data[1][2] = 'x'.repeat(45001);
  assert.throws(h.plan); assert.equal(h.writes, 0); h.finish();
});
test('confirmation hash protects changes after planning', () => { const h = fixture(), p = h.plan(); h.raw('observation').data[1][5]++; assert.throws(() => h.c.maintenanceLedgerMigrate(p.planHash, true), /元データ/); assert.equal(h.writes, 0); h.finish(); });
test('broken observation link blocks migration instead of dropping a reference', () => { const h = fixture(); h.raw('observation').data[1][9] = 'missing'; assert.throws(h.plan, /参照切れ/); assert.equal(h.writes, 0); });
test('ambiguous observation link blocks migration', () => { const h = fixture(); h.raw('observation').data[1][9] = 'review-5'; assert.throws(h.plan, /重複/); });
test('backup mismatch leaves originals authoritative and blocks blind retries', () => {
  const h = fixture(), p = h.plan(); h.fail = (where, s) => { if (where === 'copy') s.data[1][1] = 'damaged'; };
  assert.throws(() => h.c.maintenanceLedgerMigrate(p.planHash, true), /バックアップ/); assert.equal(h.properties.size, 0); assert.equal(h.view('review').getName(), h.raw('review').getName());
  h.fail = null; assert.throws(() => h.c.maintenanceLedgerMigrate(p.planHash, true), /未完了/); h.finish();
});
test('unknown bulk write outcome stays inactive and is never blindly replayed', () => {
  const h = fixture(), p = h.plan(); h.fail = (where, s) => { if (where === 'afterWrite' && s.name === '保守管理台帳' && s.data.length > 1) throw Error('unknown write outcome'); };
  assert.throws(() => h.c.maintenanceLedgerMigrate(p.planHash, true), /unknown/); h.fail = null; assert.equal(h.properties.size, 0); const count = h.records().length;
  assert.throws(() => h.c.maintenanceLedgerMigrate(p.planHash, true), /未完了/); assert.equal(h.records().length, count); h.finish();
});
for (const when of ['before', 'after']) test('activation ' + when + '-write failure cannot duplicate records', () => {
  const h = fixture(), p = h.plan(); h.propertyFailure = when; assert.throws(() => h.c.maintenanceLedgerMigrate(p.planHash, true)); h.propertyFailure = '';
  if (when === 'after') assert.equal(h.c.maintenanceLedgerMigrate(p.planHash, true).status, 'already_active'); else assert.throws(() => h.c.maintenanceLedgerMigrate(p.planHash, true), /未完了/);
  assert.equal(h.records().length, 165); h.finish();
});
test('active mode never falls back to originals if target disappears or becomes corrupt', () => { for (const damage of ['missing', 'hash', 'header', 'id', 'protection', 'duplicate']) { const h = fixture(); h.migrate(); const s = h.sheets.get('保守管理台帳'); if (damage === 'missing') h.sheets.delete(s.name); if (damage === 'hash') s.data[1][6] += ' '; if (damage === 'header') s.data[0][0] = 'bad'; if (damage === 'id') s.data[1][1] = 'bad'; if (damage === 'protection') s.data[1][5] = 'bad'; if (damage === 'duplicate') s.data.push(s.data[1].slice()); assert.throws(() => h.view('observation')); h.finish(); } });
test('adapter updates by record ID after physical rows are reordered', () => { const h = fixture(); h.migrate(); const view = h.view('observation'), id = view.getRange(2, 1).getValue(); const s = h.sheets.get('保守管理台帳'); s.data.splice(1, s.data.length - 1, ...s.data.slice(1).reverse()); view.getRange(2, 9).setValue('Jev判定待ち'); const updated = h.records().find(r => r.id === id); assert.equal(updated.row[8], 'Jev判定待ち'); assert.equal(h.records().filter(r => r.row[8] === 'Jev判定待ち').length, 1); h.finish(); });
test('stale ID snapshot cannot overwrite another writer', () => { const h = fixture(); h.migrate(); const a = h.view('observation'), b = h.view('observation'); b.getRange(2, 6).setValue(8); assert.throws(() => a.getRange(2, 6).setValue(9), /更新/); assert.equal(b.getRange(2, 6).getValue(), 8); h.finish(); });
test('sequential partial writes update the same revision and preserve dates/formula-like text', () => { const h = fixture(); h.migrate(); const s = h.view('observation'); s.getRange(2, 9).setValue('Jev判定待ち'); s.getRange(2, 11).setValue("'=do not evaluate"); s.getRange(2, 6).setValue(7); assert.equal(s.getRange(2, 11).getValue(), '=do not evaluate'); assert(s.getRange(2, 4).getValue() instanceof Date); assert.equal(s.getRange(2, 6).getValue(), 7); h.finish(); });
test('adapter rejects ID mutation and duplicate append', () => { const h = fixture(); h.migrate(); const s = h.view('observation'), row = s.getRange(2, 1, 1, 11).getValues()[0]; assert.throws(() => s.appendRow(row), /同じ記録ID/); assert.throws(() => s.getRange(2, 1).setValue('other'), /変更できません/); h.finish(); });
test('adapter supports observation append and business state lookup without legacy tabs', () => { const h = fixture(); h.migrate(); h.legacy.forEach(s => h.sheets.delete(s.name)); const s = h.view('observation'), row = h.obs('observation-' + 'f'.repeat(24), 'brand new'); s.appendRow(row); const found = h.c.candidateWizardFindObservation(row[0]); assert.equal(found.row[1], 'brand new'); assert.equal(s.getLastRow(), 134); h.finish(); });
test('latest-100 cutoff no longer hides older pending observations', () => { const h = fixture(); h.migrate(); const rows = h.c.candidateWizardBootstrap(); assert.equal(rows.length, 132); assert(rows.some(r => r.term === 'ein gefangener')); h.finish(); });
test('history exposes orphan reviews, original draft and experiment without paid APIs', () => { const h = fixture(); h.migrate(); const before = h.writes, s = h.c.maintenanceLedgerHistory(); assert.equal(s.reviews.length, 23); assert.equal(s.candidates.length, 10); assert(s.reviews.some(r => r.id === 'held-orphan')); assert(s.candidates.find(r => r.term === 'hingebungsvoll').experimental); assert.equal(h.writes, before); h.finish(); });
test('orphan review can be explicitly held by ID, with full evidence retained', () => { const h = fixture(); h.migrate(); const before = h.c.maintenanceLedgerHistory().reviews.find(r => r.id === 'held-orphan'); h.c.maintenanceLedgerSaveReview(before.id, before.hash, '保留', before.category, before.headword, 'human checked'); const after = h.c.maintenanceLedgerHistory().reviews.find(r => r.id === before.id); assert.equal(after.memo, 'human checked'); assert.equal(after.context, before.context); assert.equal(after.candidates, before.candidates); assert.equal(after.decision, '保留'); h.finish(); });
test('review approval still requires fresh hash and valid classification; moved reviews immutable', () => { const h = fixture(); h.migrate(); const state = h.c.maintenanceLedgerHistory(), pending = state.reviews.find(r => r.id === 'pending-linked'), moved = state.reviews.find(r => r.id === 'review-5'); assert.throws(() => h.c.maintenanceLedgerSaveReview(pending.id, 'f'.repeat(64), '保留', 'NEW_TERM_CANDIDATE', '', ''), /判定が変わり/); assert.throws(() => h.c.maintenanceLedgerSaveReview(pending.id, pending.hash, '採用', 'UNCERTAIN', '', ''), /採否/); assert.throws(() => h.c.maintenanceLedgerSaveReview(moved.id, moved.hash, '却下', moved.category, moved.headword, ''), /移送済み/); h.finish(); });
test('transfer mismatch cannot be automatically re-promoted, including bulk preflight', () => { const h = fixture(); h.migrate(); const before = h.writes; assert.throws(() => h.c.promoteApprovedDictionaryCandidateByReviewId('review-21'), /不一致|一致しません/); assert.throws(() => h.c.promoteApprovedDictionaryCandidates(), /不一致|一致しません/); assert.equal(h.writes, before); h.finish(); });
test('experimental candidate cannot enter production Notes even when reachable by a normal ID', () => { const h = fixture(); const o = h.raw('observation').data[1], id = h.c.dictionaryCandidateRecordId('candidate', o[2]); const candidate = h.raw('candidate').data[1]; candidate[0] = id; h.migrate(); const before = h.writes; assert.throws(() => h.c.candidateWizardRegisterExperimental(o[0], 'reviewed body', '', true), /実験草案/); assert.equal(h.writes, before); h.finish(); });
test('existing review still prevents duplicate Jev call after migration and physical reorder', () => { const h = fixture(); h.migrate(); const observation = h.raw('observation').data[3]; const found = h.c.candidateWizardFindObservation(observation[0]); assert.throws(() => h.c.createJevReviewForObservation(found.rowNumber, observation[0], true), /未判定ではありません/); h.finish(); });
test('unlinked same-term historical review also prevents duplicate Jev call', () => { const h = fixture(); const o = h.raw('observation').data[1]; o[1] = 'markiren'; o[2] = 'markiren'; h.migrate(); const found = h.c.candidateWizardFindObservation(o[0]); assert.throws(() => h.c.createJevReviewForObservation(found.rowNumber, o[0], true), /既にあります/); h.finish(); });
test('uncertain paid-call state remains protected and cannot be retried', () => { const h = fixture(); const o = h.raw('observation').data[1]; h.migrate(); h.view('observation').getRange(2, 9).setValue('Jev判定待ち'); h.view('observation').getRange(2, 11).setValue('outcome unknown'); const found = h.c.candidateWizardFindObservation(o[0]); assert(h.c.maintenanceLedgerHistory().issues.some(i => i.type === 'no_retry')); assert.throws(() => h.c.createJevReviewForObservation(found.rowNumber, o[0], true), /未判定ではありません/); h.finish(); });
test('unified Notes guard still detects existing accepted alias and old draft after legacy removal', () => { const h = fixture(); h.migrate(); h.legacy.forEach(s => h.sheets.delete(s.name)); const found = h.c.candidateWizardFindObservation(h.raw('observation').data[14][0]); assert.throws(() => h.c.maintenanceNotesOldWork_(found), /既存見出しへの判定/); h.finish(); });
test('saved old draft remains protected by ID when original tabs are absent', () => { const h = fixture(), o = h.raw('observation').data[1]; h.raw('candidate').data[2][0] = h.c.dictionaryCandidateRecordId('candidate', o[2]); h.migrate(); h.legacy.forEach(s => h.sheets.delete(s.name)); assert.throws(() => h.c.maintenanceNotesOldWork_(h.c.candidateWizardFindObservation(o[0])), /旧候補台帳/); h.finish(); });
test('duplicate Notes headwords do not count as a verified transfer', () => { const h = fixture(), headword = h.raw('candidate').data[2][16]; h.notes.data.push([headword, '', '']); h.migrate(); assert(h.c.maintenanceLedgerHistory().issues.some(i => i.id === 'review-4' && i.type === 'transfer_mismatch')); h.finish(); });
test('legacy storage stays usable before migration; no ledger is created just by viewing history', () => { const h = fixture(), s = h.view('observation'); assert.equal(s.getName(), h.raw('observation').getName()); h.c.maintenanceLedgerHistory(); assert.equal(h.sheets.has('保守管理台帳'), false); assert.equal(h.writes, 0); h.finish(); });
test('history UI parses, renders evidence as text, and has no paid API action', () => { const html = fs.readFileSync(path.join(root, 'src', 'maintenance_ledger_dialog.html'), 'utf8'); new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]); assert(!html.includes('innerHTML')); assert(!/candidateWizardRunJev|candidateWizardCreateDraft|maintenanceNotesRun/.test(html)); assert(html.includes('maintenanceLedgerSaveReview')); assert(html.includes('r.hash')); });
test('legacy in-flight requests block migration before any backup or state change', () => { for (const kind of ['observation', 'candidate']) { const h = fixture(); if (kind === 'observation') h.raw(kind).data[1][8] = 'Jev判定待ち'; else h.raw(kind).data[2][12] = '生成中'; const p = h.plan(); assert(p.plan.issues.some(i => i.blocksMigration)); assert.throws(() => h.c.maintenanceLedgerMigrate(p.planHash, true), /API実行中/); assert.equal(h.writes, 0); h.finish(); } });
for (const failed of [false, true]) test('Jev business workflow through unified storage: ' + (failed ? 'unknown result blocks retry' : 'success appends once'), () => {
  const h = fixture(); h.migrate(); const o = h.raw('observation').data[1], found = h.c.candidateWizardFindObservation(o[0]); let calls = 0;
  h.c.jevCandidateContext = () => 'original context'; h.c.jevCandidateHeadwords = () => [{ option: 'candidate_1', headword: 'base', dictionaryId: 'base-id', distance: 1 }];
  h.c.callJevForCandidate = () => { calls++; if (failed) throw Error('simulated unknown response'); return { category: { choice: 'NEW_TERM_CANDIDATE', confidence: 0.8 }, target: { choice: 'candidate_1', confidence: 0.7 } }; };
  if (failed) assert.throws(() => h.c.createJevReviewForObservation(found.rowNumber, o[0], true), /unknown/);
  else { h.c.createJevReviewForObservation(found.rowNumber, o[0], true); assert.equal(h.c.maintenanceLedgerHistory().reviews.length, 24); }
  const after = h.c.candidateWizardFindObservation(o[0]); assert.equal(after.row[8], failed ? 'Jev判定待ち' : 'Jev判定済み');
  assert.throws(() => h.c.createJevReviewForObservation(after.rowNumber, o[0], true), /未判定ではありません/); assert.equal(calls, 1); h.finish();
});
test('pre-activation handler cannot write its old Sheet handle after activation', () => { const h = fixture(), old = h.view('observation'), id = old.getRange(2, 1).getValue(); h.migrate(); const before = h.writes; assert.throws(() => old.getRange(2, 9).setValue('Jev判定待ち'), /切り替わり/); assert.throws(() => old.appendRow(h.obs('other', 'other')), /切り替わり/); assert.equal(h.writes, before); assert.equal(h.c.candidateWizardFindObservation(id).row[8], '未判定'); h.finish(); });
test('activation during Jev preflight aborts before the simulated paid call', () => { const h = fixture(), o = h.raw('observation').data[1], found = h.c.candidateWizardFindObservation(o[0]); h.c.jevCandidateContext = () => { h.migrate(); return 'original context'; }; h.c.callJevForCandidate = () => { throw Error('PAID CALL MUST NOT RUN'); }; assert.throws(() => h.c.createJevReviewForObservation(found.rowNumber, o[0], true), /切り替わり/); assert.equal(h.c.candidateWizardFindObservation(o[0]).row[8], '未判定'); h.finish(); });
test('a preflight view sees another request append before duplicate recheck without moving existing IDs', () => {
  const h = fixture(); h.migrate(); const older = h.view('review'), first = older.getRange(2, 1).getValue(), newer = h.view('review');
  newer.appendRow(h.review('new-concurrent-review', 'unique', 'INFLECTION', 'base', '未確認'));
  const rows = h.c.readSheetRows(older, 15); assert.equal(rows.length, 24); assert(rows.some(r => r[0] === 'new-concurrent-review')); assert.equal(older.getRange(2, 1).getValue(), first); h.finish();
});
test('all 155 validation rules and their metadata survive backup; originals stay unchanged', () => {
  const h=fixture(), p=h.plan(); assert.deepEqual(plain(p.plan.sources.map(s=>s.validation.count)),[132,23,0]);
  const before=h.legacy.map(s=>plain(s.validations)), result=h.c.maintenanceLedgerMigrate(p.planHash,true);
  result.receipt.backups.forEach((b,i)=>{assert.deepEqual(plain(h.sheets.get(b.name).validations),before[i]);assert.deepEqual(plain(h.legacy[i].validations),before[i]);});h.finish();
});
test('validation change during confirmation stops before creating any staging or backup', () => {
  const h=fixture(),p=h.plan();h.raw('review').validations[1][12].allowInvalid=true;
  assert.throws(()=>h.c.maintenanceLedgerMigrate(p.planHash,true),/元データ/);assert.equal(h.writes,0);h.finish();
});
for(const field of ['type','args','allowInvalid','help','position']) test('backup validation mismatch blocks activation: '+field,()=>{
  const h=fixture(),p=h.plan();h.fail=(where,s)=>{if(where!=='copy')return;const rule=s.validations[1][8];
    if(field==='position'){s.validations[1][7]=rule;s.validations[1][8]=null;}else rule[field]=field==='type'?'TEXT_CONTAINS':field==='args'?[['other'],false]:field==='allowInvalid'?true:'changed';};
  assert.throws(()=>h.c.maintenanceLedgerMigrate(p.planHash,true),/入力規則/);assert.equal(h.properties.size,0);assert(h.legacy.every(s=>!s.hidden));
  h.fail=null;assert.throws(()=>h.c.maintenanceLedgerMigrate(p.planHash,true),/未完了/);h.finish();
});
test('blank future-entry validation is backed up and included in the plan',()=>{
  const h=fixture(),s=h.raw('observation');s.validations[999]=[];s.validations[999][8]=h.rule();
  const p=h.plan();assert.equal(p.plan.sources[0].validation.count,133);const x=h.c.maintenanceLedgerMigrate(p.planHash,true);
  assert(h.sheets.get(x.receipt.backups[0].name).validations[999][8]);h.finish();
});
test('unavailable validation read fails closed without writes',()=>{
  const h=fixture(),original=h.raw('review').getRange;h.raw('review').getRange=function(...args){const r=original.apply(this,args);r.getDataValidations=()=>{throw Error('validation unavailable');};return r;};
  assert.throws(h.plan,/validation unavailable/);assert.equal(h.writes,0);h.finish();
});
test('date criteria preserve exact dates and range criteria preserve own-sheet semantics',()=>{
  const h=fixture(),a=h.raw('observation'),b=h.table('other',h.defs[0].headers);
  for(const s of [a,b]) {s.validations=[];s.validations[1]=[];s.validations[1][0]={type:'DATE_BETWEEN',args:[new Date('2026-01-01Z'),new Date('2026-12-31Z')],allowInvalid:false,help:'exact dates'};s.validations[2]=[];s.validations[2][0]={type:'VALUE_IN_RANGE',args:[{getSheet:()=>s,getA1Notation:()=>'A2:A3'},true],allowInvalid:false,help:''};}
  assert.equal(h.c.maintenanceLedgerValidation_(a).hash,h.c.maintenanceLedgerValidation_(b).hash);b.validations[1][0].args[0]=new Date('2026-01-02Z');
  assert.notEqual(h.c.maintenanceLedgerValidation_(a).hash,h.c.maintenanceLedgerValidation_(b).hash);h.finish();
});
test('old receipt without validation evidence remains readable after activation',()=>{
  const h=fixture();h.migrate();const receipt=JSON.parse(h.properties.get('MAINTENANCE_LEDGER_ACTIVE_V1'));
  receipt.sources.forEach(s=>delete s.validation);receipt.backups.forEach(s=>delete s.validation);h.properties.set('MAINTENANCE_LEDGER_ACTIVE_V1',JSON.stringify(receipt));
  assert.equal(h.c.maintenanceLedgerHistory().active,true);assert(h.legacy.every(s=>!s.hidden));h.finish();
});
for (const removed of ['originals', 'backups', 'both']) test('active business operations never access removed ' + removed, () => {
  const h = fixture(), receipt = h.migrate().receipt, activation = h.properties.get('MAINTENANCE_LEDGER_ACTIVE_V1');
  const names = new Set(h.legacy.map(s => s.name).concat(receipt.backups.map(s => s.name)));
  if (removed !== 'backups') h.legacy.forEach(s => h.sheets.delete(s.name));
  if (removed !== 'originals') receipt.backups.forEach(s => h.sheets.delete(s.name));
  const getSheet = h.book.getSheetByName;
  h.book.getSheetByName = name => { if (names.has(name)) throw Error('PHYSICAL LEGACY ACCESS FORBIDDEN'); return getSheet(name); };
  const before = h.writes, state = h.c.maintenanceLedgerHistory();
  assert.equal(state.active, true); assert.deepEqual(plain(state.counts.map(c => c.count)), [132, 23, 10]);
  assert.equal(state.reviews.filter(r => r.decision === '保留').length, 2);
  assert.equal(state.reviews.filter(r => r.decision === '未確認').length, 2);
  assert(state.candidates.find(r => r.term === 'hingebungsvoll').experimental);
  assert.equal(h.c.candidateWizardBootstrap().length, 132); assert.equal(h.writes, before);
  const reviewed = h.raw('observation').data[3], found = h.c.candidateWizardFindObservation(reviewed[0]);
  assert.throws(() => h.c.createJevReviewForObservation(found.rowNumber, reviewed[0], true), /未判定ではありません/);
  assert.throws(() => h.c.maintenanceNotesOldWork_(h.c.candidateWizardFindObservation(h.raw('observation').data[14][0])), /既存見出しへの判定/);
  const held = state.reviews.find(r => r.id === 'held-orphan');
  h.c.maintenanceLedgerSaveReview(held.id, held.hash, '保留', held.category, held.headword, 'verified by ID after cleanup');
  const saved = h.c.maintenanceLedgerHistory().reviews.find(r => r.id === held.id);
  assert.equal(saved.memo, 'verified by ID after cleanup'); assert.equal(saved.context, held.context); assert.equal(saved.candidates, held.candidates);
  assert.equal(h.properties.get('MAINTENANCE_LEDGER_ACTIVE_V1'), activation); assert.equal(h.records().length, 165); h.finish();
});
for (const damage of ['missing', 'hash']) test('cleanup never enables fallback or replay when ledger is ' + damage, () => {
  const h = fixture(), receipt = h.migrate().receipt, activation = h.properties.get('MAINTENANCE_LEDGER_ACTIVE_V1');
  h.legacy.forEach(s => h.sheets.delete(s.name)); receipt.backups.forEach(s => h.sheets.delete(s.name));
  const ledger = h.sheets.get('保守管理台帳'); if (damage === 'missing') h.sheets.delete(ledger.name); else ledger.data[1][6] += ' ';
  const before = h.writes; assert.throws(() => h.c.candidateWizardBootstrap()); assert.throws(() => h.c.maintenanceLedgerHistory());
  assert.throws(() => h.c.maintenanceLedgerMigrate(receipt.planHash, true)); assert.equal(h.writes, before);
  assert.equal(h.properties.get('MAINTENANCE_LEDGER_ACTIVE_V1'), activation); h.finish();
});
function menuFixture(reply='YES') {
  const h=fixture();h.alerts=[];h.menus=[];h.confirmHook=null;
  const ui={ButtonSet:{OK:'OK',YES_NO:'YES_NO'},Button:{YES:'YES',NO:'NO'},
    alert(title,message,buttons){h.alerts.push({title,message,buttons});if(buttons==='YES_NO'&&h.confirmHook)h.confirmHook();return buttons==='YES_NO'?reply:'OK';},
    createMenu(name){const menu={name,items:[]};h.menus.push(menu);const builder={addItem(label,handler){menu.items.push({label,handler});return builder;},addSeparator(){return builder;},addToUi(){}};return builder;}};
  h.c.SpreadsheetApp.getUi=()=>ui;h.c.rowCompletionBook_=()=>h.book;h.c.addSheetRowNavigationMenu_=()=>{};
  h.book.getName=()=> 'Synthetic ledger source';
  vm.runInContext(fs.readFileSync(path.join(root,'src/setup_credentials.js'),'utf8'),h.c);
  h.c.onOpen();const entry=h.menus.find(m=>m.name.includes('日常保守')).items.find(i=>i.label==='管理台帳への移行を確認');
  assert(entry);h.open=()=>h.c[entry.handler]();return h;
}
test('bound-sheet menu opens a real 165-record plan and migrates once after explicit Yes',()=>{
  const h=menuFixture(),x=h.open();assert.equal(x.status,'activated');assert.equal(h.records().length,165);const prompt=h.alerts.find(a=>a.buttons==='YES_NO');
  assert(prompt.message.includes('観測 132件（入力規則132セル）'));assert(prompt.message.includes('未確認'));assert(prompt.message.includes('実験草案'));assert(prompt.message.includes(h.plan().planHash));
  assert(h.legacy.every(s=>!s.hidden));const before=h.writes;assert.equal(h.open().status,'already_active');assert.equal(h.writes,before);h.finish();
});
test('active migration menu never reads removed source or backup tabs or replays migration', () => {
  const h = menuFixture(), receipt = h.migrate().receipt;
  h.legacy.forEach(s => h.sheets.delete(s.name)); receipt.backups.forEach(s => h.sheets.delete(s.name));
  h.c.maintenanceLedgerPlanMigration = () => { throw Error('MIGRATION PLAN MUST NOT RUN'); };
  h.c.maintenanceLedgerMigrate = () => { throw Error('MIGRATION MUST NOT RUN'); };
  const before = h.writes; assert.equal(h.open().status, 'already_active'); assert.equal(h.writes, before);
  assert(h.alerts.at(-1).message.includes('移行を重ねて実行していません')); h.finish();
});
test('owner cancels the menu confirmation with zero sheet or property writes',()=>{const h=menuFixture('NO');assert.equal(h.open().status,'cancelled');assert.equal(h.writes,0);h.finish();});
for(const change of ['values','validation']) test('menu confirmation protects concurrent '+change+' changes',()=>{
  const h=menuFixture();h.confirmHook=()=>{if(change==='values')h.raw('observation').data[1][5]++;else h.raw('review').validations[1][12].help='changed during prompt';};
  assert.throws(h.open,/元データ/);assert.equal(h.writes,0);assert(h.alerts.at(-1).message.includes('再度の移行'));h.finish();
});
test('menu in-flight protection, unfinished staging and wrong registered book never migrate',()=>{
  for(const kind of ['inflight','unfinished','wrong']){const h=menuFixture();if(kind==='inflight')h.raw('observation').data[1][8]='Jev判定待ち';
  if(kind==='unfinished')h.table('保守管理台帳',[]);if(kind==='wrong')h.c.rowCompletionBook_=()=>{throw Error('wrong registered book');};
  if(kind==='wrong')assert.throws(h.open,/wrong registered/);else assert.equal(h.open().status,kind==='inflight'?'blocked':'unfinished');assert.equal(h.writes,0);h.finish();}
});
test('menu backup validation failure remains visibly unfinished and never retries writes',()=>{
  const h=menuFixture();h.fail=(where,s)=>{if(where==='copy')s.validations=[];};assert.throws(h.open,/入力規則/);
  assert.equal(h.properties.size,0);const before=h.writes;h.fail=null;assert.equal(h.open().status,'unfinished');assert.equal(h.writes,before);h.finish();
});

console.log('maintenance-ledger: ' + passed + ' scenarios passed; zero network calls');
