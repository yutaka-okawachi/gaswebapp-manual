/** Current Notes values and registration retry identifiers. No publication gate or allowlist. */
const NOTES_REGISTRATION_HEADERS = Object.freeze(['maintenance_id', 'maintenance_observation_id']);
function notesRegistrationString_(value) { return value === null || value === undefined ? '' : String(value); }
function notesRegistrationHash_(values) {
  // Hash exact cell text, including whitespace and line endings. No source/body normalization.
  const text = JSON.stringify(['de', 'ja', 'en', 'source'].map(function (key) { return notesRegistrationString_(values[key]); }));
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}
function notesRegistrationColumns_(header) {
  const names = header.map(function (value) { return notesRegistrationString_(value).normalize('NFC').trim(); });
  const columns = {};
  ['de', 'ja', 'en', 'source'].concat(NOTES_REGISTRATION_HEADERS).forEach(function (name) {
    const index = names.indexOf(name);
    if (index >= 0 && names.indexOf(name, index + 1) >= 0) throw new Error('Notesの列名が重複しています: ' + name);
    if (index < 0 && ['de', 'ja', 'source'].includes(name)) throw new Error('Notesの必須列がありません: ' + name);
    columns[name] = index;
  });
  return columns;
}
function notesSheetRows_(values) {
  // Sheet content is authoritative. Publication metadata is deliberately never inspected here.
  if (!Array.isArray(values) || !values.length) throw new Error('Notesの見出しを確認できません．');
  const names = values[0].map(notesRegistrationString_), columns = {};
  ['de', 'ja', 'en', 'source'].forEach(function (name) {
    const positions = names.map(function (value) { return value.normalize('NFC').trim(); });
    const index = positions.indexOf(name);
    if (index >= 0 && positions.indexOf(name, index + 1) >= 0) throw new Error('Notesの列名が重複しています: ' + name);
    if (index < 0 && name !== 'en') throw new Error('Notesの必須列がありません: ' + name);
    columns[name] = index;
  });
  return values.slice(1).map(function (cells, index) {
    const row = { number: index + 2, values: {} };
    ['de', 'ja', 'en', 'source'].forEach(function (name) { row.values[name] = columns[name] < 0 ? '' : notesRegistrationString_(cells[columns[name]]); });
    return row;
  });
}
function notesRegistrationRows_(values) {
  const columns = notesRegistrationColumns_(values[0]);
  return notesSheetRows_(values).map(function (row) {
    const cells = values[row.number - 1];
    row.entryId = columns.maintenance_id < 0 ? '' : notesRegistrationString_(cells[columns.maintenance_id]);
    row.observationId = columns.maintenance_observation_id < 0 ? '' : notesRegistrationString_(cells[columns.maintenance_observation_id]);
    return row;
  });
}
function notesRegistrationRead_(sheet) {
  if (!sheet || sheet.getName() !== 'Notes') throw new Error('Notesを選択してください．');
  return { rows: notesRegistrationRows_(sheet.getDataRange().getValues()) };
}
function notesRegistrationHeader_(sheet) {
  if (!sheet || sheet.getName() !== 'Notes') throw new Error('Notesを選択してください．');
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}
function notesRegistrationEnsureColumns_(sheet) {
  // Caller owns the script lock and has an explicit maintenance UI action. Never called by export.
  const header = notesRegistrationHeader_(sheet), columns = notesRegistrationColumns_(header);
  const missing = NOTES_REGISTRATION_HEADERS.filter(function (name) { return columns[name] < 0; });
  if (missing.length) {
    const last = sheet.getLastColumn();
    if (typeof sheet.getMaxColumns === 'function' && sheet.getMaxColumns() < last + missing.length) {
      const max = sheet.getMaxColumns(); sheet.insertColumnsAfter(max, last + missing.length - max);
    }
    const range = sheet.getRange(1, last + 1, 1, missing.length);
    if ((typeof range.canEdit === 'function' && !range.canEdit()) ||
        (typeof range.isPartOfMerge === 'function' && range.isPartOfMerge())) throw new Error('Notesの登録再開用見出しを追加できません．');
    range.setValues([missing]);
  }
  return { columns: notesRegistrationColumns_(notesRegistrationHeader_(sheet)), appended: missing };
}
function notesRegistrationCell_(sheet, rowNumber, headerName) {
  if (!NOTES_REGISTRATION_HEADERS.includes(headerName) || !Number.isSafeInteger(rowNumber) || rowNumber < 2 ||
      (typeof sheet.getMaxRows === 'function' && rowNumber > sheet.getMaxRows())) throw new Error('Notesの登録再開用セル指定が不正です．');
  const columns = notesRegistrationColumns_(notesRegistrationHeader_(sheet));
  if (columns[headerName] < 0) throw new Error('Notesの登録再開用列がありません．');
  return sheet.getRange(rowNumber, columns[headerName] + 1);
}
