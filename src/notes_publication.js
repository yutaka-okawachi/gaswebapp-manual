/** Notes publication gate. Reads never create metadata or change a cell. */
const NOTES_PUBLICATION_HEADERS = Object.freeze(['maintenance_id', 'publication_state', 'maintenance_observation_id']);
function notesPublicationString_(value) { return value === null || value === undefined ? '' : String(value); }
function notesPublicationHeadword_(value) { return notesPublicationString_(value).normalize('NFC').trim(); }
function notesPublicationPublicId_(value) {
  return notesPublicationString_(value).replace(/\[\[score:[a-z][a-z0-9-]{0,95}\]\]/gi, '').toLowerCase().trim()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function notesPublicationHash_(values) {
  // Hash exact cell text, including whitespace and line endings. No source/body normalization.
  const text = JSON.stringify(['de', 'ja', 'en', 'source'].map(function (key) { return notesPublicationString_(values[key]); }));
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}
function notesPublicationIsPublished_(row) {
  if (!row || !row.values || !notesPublicationHeadword_(row.values.de)) return false;
  const state = notesPublicationString_(row.state), entryId = notesPublicationString_(row.entryId);
  const observationId = notesPublicationString_(row.observationId);
  if (!state && !entryId && !observationId) {
    const word = notesPublicationHeadword_(row.values.de), id = notesPublicationPublicId_(row.values.de);
    return NOTES_PUBLICATION_LEGACY_BASELINE.entries.some(function (entry) { return entry[0] === id && entry[1] === word; });
  }
  if (!/^[a-zA-Z0-9:_-]{1,160}$/.test(entryId) || !/^approved:[a-f0-9]{64}$/.test(state)) return false;
  if (['de', 'ja', 'en', 'source'].some(function (key) { return !notesPublicationString_(row.values[key]).trim(); })) return false;
  // Approval belongs to the registered entry. Later manual body edits remain publishable.
  // New writing/draft entries still fail the approved-state and completeness guards above.
  return true;
}
function notesPublicationColumns_(header) {
  const names = header.map(function (value) { return notesPublicationString_(value).normalize('NFC').trim(); });
  const columns = {};
  ['de', 'ja', 'en', 'source'].concat(NOTES_PUBLICATION_HEADERS).forEach(function (name) {
    const index = names.indexOf(name);
    if (index >= 0 && names.indexOf(name, index + 1) >= 0) throw new Error('Notesの列名が重複しています: ' + name);
    if (index < 0 && ['de', 'ja', 'source'].includes(name)) throw new Error('Notesの必須列がありません: ' + name);
    columns[name] = index;
  });
  return columns;
}
function notesPublicationRows_(values) {
  if (!Array.isArray(values) || !values.length) throw new Error('Notesの見出しを確認できません．');
  const columns = notesPublicationColumns_(values[0]), ids = new Set();
  return values.slice(1).map(function (cells, index) {
    const value = function (name) { return columns[name] < 0 ? '' : notesPublicationString_(cells[columns[name]]); };
    const row = { number: index + 2, values: {}, entryId: value('maintenance_id'),
      observationId: value('maintenance_observation_id'), state: value('publication_state') };
    ['de', 'ja', 'en', 'source'].forEach(function (name) { row.values[name] = value(name); });
    if (row.entryId) {
      if (ids.has(row.entryId)) throw new Error('Notesのmaintenance_idが重複しています．');
      ids.add(row.entryId);
    }
    return row;
  });
}
function notesPublicationRead_(sheet) {
  if (!sheet || sheet.getName() !== 'Notes') throw new Error('Notesを選択してください．');
  return { rows: notesPublicationRows_(sheet.getDataRange().getValues()) };
}
function notesPublicationFilterMappings_(rows, mappings) {
  const published = rows.filter(notesPublicationIsPublished_);
  const allIds = new Set(rows.map(function (row) { return notesPublicationPublicId_(row.values.de); }).filter(Boolean));
  const publicIds = new Set(published.map(function (row) { return notesPublicationPublicId_(row.values.de); }));
  const publicWords = new Set(published.map(function (row) { return notesPublicationHeadword_(row.values.de); }));
  const privateIds = new Set(rows.filter(function (row) { return !notesPublicationIsPublished_(row); })
    .map(function (row) { return notesPublicationPublicId_(row.values.de); }).filter(Boolean));
  return mappings.filter(function (mapping) {
    const word = notesPublicationHeadword_(mapping[0]), id = notesPublicationPublicId_(mapping[0]);
    // Missing-headword errors still belong to the existing mapping validator. Hide known drafts only.
    if (!allIds.has(id)) return true;
    if (!publicIds.has(id)) return false;
    return !privateIds.has(id) || publicWords.has(word);
  });
}
function notesPublicationHeader_(sheet) {
  if (!sheet || sheet.getName() !== 'Notes') throw new Error('Notesを選択してください．');
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}
function notesPublicationEnsureColumns_(sheet) {
  // Caller owns the script lock and has an explicit maintenance UI action. Never called by export.
  const header = notesPublicationHeader_(sheet), columns = notesPublicationColumns_(header);
  const missing = NOTES_PUBLICATION_HEADERS.filter(function (name) { return columns[name] < 0; });
  if (missing.length) {
    const last = sheet.getLastColumn();
    if (typeof sheet.getMaxColumns === 'function' && sheet.getMaxColumns() < last + missing.length) {
      const max = sheet.getMaxColumns(); sheet.insertColumnsAfter(max, last + missing.length - max);
    }
    const range = sheet.getRange(1, last + 1, 1, missing.length);
    if ((typeof range.canEdit === 'function' && !range.canEdit()) ||
        (typeof range.isPartOfMerge === 'function' && range.isPartOfMerge())) throw new Error('Notesの公開管理見出しを追加できません．');
    range.setValues([missing]);
  }
  return { columns: notesPublicationColumns_(notesPublicationHeader_(sheet)), appended: missing };
}
function notesPublicationCell_(sheet, rowNumber, headerName) {
  if (!NOTES_PUBLICATION_HEADERS.includes(headerName) || !Number.isSafeInteger(rowNumber) || rowNumber < 2 ||
      (typeof sheet.getMaxRows === 'function' && rowNumber > sheet.getMaxRows())) throw new Error('Notesの公開管理セル指定が不正です．');
  const columns = notesPublicationColumns_(notesPublicationHeader_(sheet));
  if (columns[headerName] < 0) throw new Error('Notesの公開管理列がありません．');
  return sheet.getRange(rowNumber, columns[headerName] + 1);
}
