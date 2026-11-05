/** Warn about new Notes items; existing edits and unavailable advisory state never block editing. */
const NOTES_ENTRY_GUARD_PREFIX = 'notes-entry-guard-v1:';
const NOTES_ENTRY_GUARD_LIMIT = 2500;
function notesEntryGuardContext_(book) {
  book = book || SpreadsheetApp.getActiveSpreadsheet();
  if (!book || PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') !== book.getId()) return null;
  const sheet = book.getSheetByName('Notes');
  return sheet ? { book: book, sheet: sheet, prefix: NOTES_ENTRY_GUARD_PREFIX + rowCompletionHash_(book.getId()) + ':' } : null;
}
function notesEntryGuardSnapshot_(sheet) {
  const count = Math.max(0, sheet.getLastRow() - 1);
  if (count > NOTES_ENTRY_GUARD_LIMIT) throw Error('Notes heading check limit');
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(namedSheetHeader_);
  const fields = ['de', 'ja', 'en', 'source'];
  if (header.includes('ja_old')) fields.push('ja_old');
  if (header.includes('maintenance_id')) fields.push('maintenance_id');
  const idIndex = fields.indexOf('maintenance_id');
  return namedSheetRead_(sheet, fields, 2, count).values.map(function (row) {
    const text = String(row[0] == null ? '' : row[0]), parts = row.slice(1, idIndex < 0 ? row.length : idIndex).map(String);
    const id = idIndex < 0 ? '' : String(row[idIndex] || '').trim(), occupied = parts.some(function (v) { return v.trim(); });
    if (!text.trim() && !occupied && !id) return null;
    // Compact identity hints are advisory; the complete state has a separate full checksum.
    return [text.trim() ? rowCompletionHash_(text.normalize('NFC')).slice(0, 24) : '',
      occupied ? rowCompletionHash_(parts).slice(0, 16) : '', id ? rowCompletionHash_(id.normalize('NFC')).slice(0, 16) : ''];
  });
}
function notesEntryGuardRead_(context) {
  const props = PropertiesService.getScriptProperties(), copies = [];
  ['a', 'b'].forEach(function (slot) {
    try {
      const raw = props.getProperty(context.prefix + slot + ':meta'); if (!raw) return;
      const meta = JSON.parse(raw);
      if (!Number.isSafeInteger(meta.revision) || meta.revision < 1 || !Number.isSafeInteger(meta.count) || meta.count < 1 || meta.count > 32) return;
      let text = ''; for (let i = 0; i < meta.count; i++) { const chunk = props.getProperty(context.prefix + slot + ':' + i); if (chunk === null) return; text += chunk; }
      if (rowCompletionHash_(text) !== meta.hash) return;
      const state = JSON.parse(text);
      function valid(r) {
        if (r === null) return true;
        if (!Array.isArray(r) || ![0, 1, 2].includes(r[1])) return false;
        if (r.length === 2) return /^[a-f0-9]{64}$/.test(r[0]);
        return r.length === 4 && /^(?:[a-f0-9]{24})?$/.test(r[0]) && /^(?:[a-f0-9]{16})?$/.test(r[2]) &&
          /^(?:[a-f0-9]{16})?$/.test(r[3]) && Boolean(r[0] || r[2] || r[3]);
      }
      if (state.sheetId !== context.sheet.getSheetId() || !Array.isArray(state.rows) || state.rows.length > NOTES_ENTRY_GUARD_LIMIT || !state.rows.every(valid)) return;
      copies.push({ slot: slot, revision: meta.revision, state: state });
    } catch (_) { /* Keep the other complete snapshot. */ }
  });
  copies.sort(function (a, b) { return b.revision - a.revision; }); return copies[0] || null;
}
function notesEntryGuardSave_(context, state) {
  const text = JSON.stringify(state);
  if (text.length > 190000) throw Error('Notes guard record too large');
  const prior = notesEntryGuardRead_(context), slot = prior && prior.slot === 'a' ? 'b' : 'a', prefix = context.prefix + slot + ':';
  const props = PropertiesService.getScriptProperties(), chunks = {};
  props.deleteProperty(prefix + 'meta');
  for (let i = 0; i < text.length; i += 6000) chunks[prefix + i / 6000] = text.slice(i, i + 6000);
  props.setProperties(chunks); props.setProperty(prefix + 'meta', JSON.stringify({
    revision: prior ? prior.revision + 1 : 1, count: Math.ceil(text.length / 6000), hash: rowCompletionHash_(text) }));
  const saved = notesEntryGuardRead_(context);
  if (!saved || rowCompletionHash_(saved.state) !== rowCompletionHash_(state)) throw Error('Notes guard save unconfirmed');
}
function notesEntryGuardLock_(action, scriptLockOwned) {
  const documentLock = typeof LockService.getDocumentLock === 'function' ? LockService.getDocumentLock() : null;
  const lock = documentLock || (scriptLockOwned ? null : LockService.getScriptLock());
  if (lock && !lock.tryLock(3000)) return false;
  try { return action(); } finally { if (lock) lock.releaseLock(); }
}
function notesEntryGuardClassify_(previous, current, editedRow, oldHash) {
  const prior = previous.map(function (r) { return r ? [r[0].slice(0, 24), r[1], r[2] || '', r[3] || ''] : null; });
  const result = current.map(function () { return null; }), used = new Set();
  function assign(i, j) { const c = current[i]; result[i] = [c[0], prior[j][1], c[1], c[2]]; used.add(j); }
  function find(test) { return prior.findIndex(function (p, j) { return p && !used.has(j) && test(p, j); }); }
  function pass(test, sameSlot) {
    current.forEach(function (c, i) {
      if (!c || result[i]) return;
      const j = sameSlot ? (prior[i] && !used.has(i) && test(prior[i], c) ? i : -1) : find(function (p) { return test(p, c); });
      if (j >= 0) assign(i, j);
    });
  }
  const editedIndex = editedRow - 2;
  if (oldHash && current[editedIndex]) {
    const h = oldHash.slice(0, 24), j = prior[editedIndex] && prior[editedIndex][0] === h ? editedIndex : find(function (p) { return p[0] === h; });
    if (j >= 0) assign(editedIndex, j);
  }
  pass(function (p, c) { return c[2] && p[3] === c[2]; }, true);
  const exact = function (p, c) { return p[0] === c[0] && p[2] === c[1] && p[3] === c[2]; };
  pass(exact, true); pass(exact, false);
  pass(function (p, c) { return c[0] && p[0] === c[0]; }, true);
  pass(function (p, c) { return c[2] && p[3] === c[2]; }, false);
  pass(function (p, c) { return c[0] && p[0] === c[0]; }, false);
  const oldBodies = {}, newBodies = {};
  prior.forEach(function (p, j) { if (p && p[2] && !used.has(j)) oldBodies[p[2]] = (oldBodies[p[2]] || 0) + 1; });
  current.forEach(function (c, i) { if (c && c[1] && !result[i]) newBodies[c[1]] = (newBodies[c[1]] || 0) + 1; });
  pass(function (p, c) { return c[1] && p[2] === c[1] && oldBodies[p[2]] === 1 && newBodies[c[1]] === 1; }, false);
  pass(function (p) { return !p[0] && Boolean(p[2] || p[3]); }, true);
  pass(function () { return true; }, true);
  return current.map(function (c, i) { return !c ? null : result[i] || [c[0], 0, c[1], c[2]]; });
}
function notesEntryGuardInitialize_() {
  try {
    const context = notesEntryGuardContext_(); if (!context) return false;
    return notesEntryGuardLock_(function () {
      const saved = notesEntryGuardRead_(context); if (saved && saved.state.version === 2) return true;
      const current = notesEntryGuardSnapshot_(context.sheet);
      const rows = saved ? notesEntryGuardClassify_(saved.state.rows, current) : current.map(function (c) { return c ? [c[0], 2, c[1], c[2]] : null; });
      if (saved) rows.forEach(function (r, i) { if (r && !r[0] && !saved.state.rows[i]) r[1] = 2; });
      notesEntryGuardSave_(context, { version: 2, sheetId: context.sheet.getSheetId(), rows: rows }); return true;
    }, false);
  } catch (_) { return false; }
}
function notesEntryGuardExisting_(book, sheet, number) {
  try {
    const context = notesEntryGuardContext_(book); if (!context || sheet.getSheetId() !== context.sheet.getSheetId()) return false;
    const saved = notesEntryGuardRead_(context); if (!saved) return true;
    const current = notesEntryGuardSnapshot_(sheet), row = notesEntryGuardClassify_(saved.state.rows, current)[number - 2];
    if (!row || row[1] === 2) return true;
    return Boolean(row[0] && saved.state.rows.some(function (r) { return r && r[1] === 2 && r[0].slice(0, 24) === row[0]; }));
  } catch (_) { return true; }
}
function notesEntryGuardRemember_(book, number, scriptLockOwned) {
  try {
    const context = notesEntryGuardContext_(book); if (!context) return false;
    return notesEntryGuardLock_(function () {
      const saved = notesEntryGuardRead_(context); if (!saved) return false;
      if (number < 2 || number > NOTES_ENTRY_GUARD_LIMIT + 1) return false;
      const current = notesEntryGuardSnapshot_(context.sheet), entry = current[number - 2];
      if (!entry || !entry[0]) return false;
      const rows = notesEntryGuardClassify_(saved.state.rows, current);
      rows[number - 2] = [entry[0], 2, entry[1], entry[2]];
      notesEntryGuardSave_(context, { version: 2, sheetId: context.sheet.getSheetId(), rows: rows }); return true;
    }, scriptLockOwned);
  } catch (_) { return false; }
}
function onEdit(event) {
  try {
    const range = event && event.range; if (!range) return;
    const sheet = range.getSheet(); if (!sheet || sheet.getName() !== 'Notes') return;
    const context = notesEntryGuardContext_(event.source); if (!context || sheet.getSheetId() !== context.sheet.getSheetId()) return;
    if (range.getRow() + range.getNumRows() - 1 < 2) return;
    const column = namedSheetColumns_(sheet, ['de']).positions[0] + 1;
    const headingEdited = range.getColumn() <= column && range.getColumn() + range.getNumColumns() - 1 >= column;
    const first = Math.max(2, range.getRow()), last = range.getRow() + range.getNumRows() - 1;
    notesEntryGuardLock_(function () {
      const saved = notesEntryGuardRead_(context); if (!saved) return true;
      const current = notesEntryGuardSnapshot_(sheet);
      const key = NOTES_ENTRY_GUARD_PREFIX + 'event:' + rowCompletionHash_([context.book.getId(), sheet.getSheetId(), first, last, headingEdited, current.slice(first - 2, last - 1), event.oldValue || '']);
      const cache = CacheService.getScriptCache(); if (cache.get(key)) return true;
      const oldHash = headingEdited && range.getNumRows() === 1 && range.getNumColumns() === 1 && String(event.oldValue || '').trim() ?
        rowCompletionHash_(String(event.oldValue).normalize('NFC')) : '';
      const rows = notesEntryGuardClassify_(saved.state.rows, current, first, oldHash), warnings = [];
      if (headingEdited) for (let number = first; number <= last && number - 2 < rows.length; number++) {
        const row = rows[number - 2]; if (row && row[0] && row[1] === 0) { warnings.push(number); row[1] = 1; }
      }
      notesEntryGuardSave_(context, { version: 2, sheetId: sheet.getSheetId(), rows: rows }); cache.put(key, '1', 60);
      if (warnings.length) context.book.toast('Notesの新しい見出しは日常保守の「項目の作成・補完」から登録してください．手入力した' +
        warnings.slice(0, 5).join('・') + '行' + (warnings.length > 5 ? 'ほか' : '') + 'の内容はそのまま残しています．これは警告であり，既存セルの編集や同期対象を制限しません．', 'Notesへの新規手入力', 10);
      return true;
    }, false);
  } catch (_) { /* Advisory only; never change a cell or call a paid service. */ }
}
