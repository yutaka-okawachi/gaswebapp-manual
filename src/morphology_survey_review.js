/** 一括調査の高確信度語形を1件ずつ確認し，採用分だけ語形対応へ移す． */
const MORPHOLOGY_SURVEY_PREFIX = '語形対応_一括調査_';
const MORPHOLOGY_SURVEY_BATCH_LIMIT = 10;
const MORPHOLOGY_SURVEY_HEADERS = [
  '調査ID', 'Notes見出し', 'Notes行', '調査区分', '関連語形', '実例行数',
  '実例位置', '実例文脈', 'Jev関係', 'Jev文法区分', 'Jev確信度',
  '確認区分', '別のNotes見出し', '現行語形区分', '現行用語検索',
  '現行実例検索', '現行補足', '人の採否', '人のメモ', 'Jev実モデル', '抽出根拠'
];

function morphologySurveySheet(spreadsheet, sheetId) {
  const sheet = spreadsheet.getSheets().find(item => item.getSheetId() === Number(sheetId));
  if (!sheet || !sheet.getName().startsWith(MORPHOLOGY_SURVEY_PREFIX)) {
    throw new Error('対象の一括調査タブが見つかりません．');
  }
  const actual = sheet.getRange(1, 1, 1, MORPHOLOGY_SURVEY_HEADERS.length).getValues()[0];
  MORPHOLOGY_SURVEY_HEADERS.forEach((header, index) => {
    if (actual[index] !== header) throw new Error(sheet.getName() + ' の列構成が一致しません：' + header);
  });
  return sheet;
}

function morphologySurveyConfidence(value) {
  const number = Number(String(value || '').replace('%', ''));
  return number > 1 ? number / 100 : number;
}

function morphologySurveyEligible(row) {
  return Boolean(String(row[0] || '').trim() && String(row[1] || '').trim() &&
    String(row[4] || '').trim() && Number(row[5]) > 0 &&
    /\[INFLECTION\]/.test(String(row[8] || '')) &&
    morphologySurveyConfidence(row[10]) >= 0.9 &&
    !String(row[17] || '').trim());
}

function morphologySurveyPairKey(headword, form) {
  return normalizeObservedTerm(headword) + '\u0000' + normalizeObservedTerm(form);
}

function morphologySurveyBootstrap() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = spreadsheet.getSheets().filter(sheet =>
    sheet.getName().startsWith(MORPHOLOGY_SURVEY_PREFIX))
    .sort((left, right) => right.getName().localeCompare(left.getName(), 'ja'));
  if (!sheets.length) throw new Error('語形対応の一括調査タブがありません．');
  const active = spreadsheet.getActiveSheet();
  return {
    sheets: sheets.map(sheet => ({ id: sheet.getSheetId(), name: sheet.getName() })),
    selectedId: sheets.some(sheet => sheet.getSheetId() === active.getSheetId())
      ? active.getSheetId() : sheets[0].getSheetId()
  };
}

function morphologySurveyState(sheetId) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = morphologySurveySheet(spreadsheet, sheetId);
  const mapping = requireSheetWithHeaders(spreadsheet,
    EXPERIMENTAL_TERM_MAPPING_SHEET_NAME, EXPERIMENTAL_TERM_MAPPING_HEADERS);
  const pairs = new Set(readSheetRows(mapping, 2).map(row =>
    morphologySurveyPairKey(row[0], row[1])));
  const rows = readSheetRows(sheet, MORPHOLOGY_SURVEY_HEADERS.length);
  const candidates = rows.filter(morphologySurveyEligible);
  const row = candidates[0];
  return {
    sheetId: sheet.getSheetId(), sheetName: sheet.getName(),
    remaining: candidates.length,
    candidate: row ? {
      id: String(row[0]), headword: String(row[1]), form: String(row[4]),
      examples: Number(row[5]), source: String(row[6] || ''),
      context: String(row[7] || ''), relation: String(row[8] || ''),
      grammar: String(row[9] || ''), confidence: morphologySurveyConfidence(row[10]),
      otherHeadword: String(row[12] || ''),
      registered: pairs.has(morphologySurveyPairKey(row[1], row[4]))
    } : null
  };
}

function morphologySurveySafeText(value, maxLength, label, required) {
  const text = String(value || '').normalize('NFC').trim();
  if ((required && !text) || text.length > maxLength || /^[=+@-]/.test(text)) {
    throw new Error(label + 'が空欄，長すぎる，または不正な文字で始まります．');
  }
  return text;
}

/** 採用，保留，却下，または既存対応行の整理を行う．各呼出しでIDと条件を再確認する． */
function morphologySurveyDecide(sheetId, surveyId, decision, fields) {
  if (!['採用', '保留', '却下', '登録済み行を整理'].includes(decision)) {
    throw new Error('不正な操作です．');
  }
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = morphologySurveySheet(spreadsheet, sheetId);
  // 大量の実例走査は共有ロックの外で行う．書込み直前にIDと語形を再検証する．
  const initial = morphologySurveyFindRow_(sheet, surveyId);
  const markers = decision === '採用' ? dictionarySourceMarkers(spreadsheet, initial.row[4]) : [];
  const lock = LockService.getScriptLock();
  // busyは書込み前だけ返す．通信エラーや書込み後の例外は自動再送させない．
  if (!lock.tryLock(30000)) return { busy: true };
  try {
    const current = morphologySurveyFindRow_(sheet, surveyId);
    const row = current.row;
    if (String(row[1]) !== String(initial.row[1]) || String(row[4]) !== String(initial.row[4])) {
      throw new Error('対象行が変更されたため，画面を更新してください．');
    }
    const mapping = requireSheetWithHeaders(spreadsheet,
      EXPERIMENTAL_TERM_MAPPING_SHEET_NAME, EXPERIMENTAL_TERM_MAPPING_HEADERS);
    const key = morphologySurveyPairKey(row[1], row[4]);
    const registered = readSheetRows(mapping, 2).some(item =>
      morphologySurveyPairKey(item[0], item[1]) === key);
    const sheetRow = current.sheetRow;
    if (decision === '登録済み行を整理') {
      if (!registered) throw new Error('語形対応に登録されていません．画面を更新してください．');
      sheet.deleteRow(sheetRow);
    } else if (decision !== '採用') {
      const memo = morphologySurveySafeText(fields && fields.memo, 500, '確認メモ', false);
      sheet.getRange(sheetRow, 18, 1, 2).setValues([[decision, memo]]);
    } else {
      if (registered) throw new Error('既に語形対応に登録されています．画面を更新してください．');
      const notes = requireSheetWithHeaders(spreadsheet,
        EXPERIMENTAL_NOTES_SHEET_NAME, ['de', 'ja', 'source']);
      const headword = morphologySurveySafeText(row[1], 120, '見出し', true);
      const form = morphologySurveySafeText(row[4], 120, '関連語形', true);
      const notesHeadwords = new Set(readSheetRows(notes, 1).map(item =>
        normalizeObservedTerm(item[0])).filter(Boolean));
      if (!notesHeadwords.has(normalizeObservedTerm(headword))) {
        throw new Error('見出しがNotesにありません．登録しません．');
      }
      const category = morphologySurveySafeText(fields && fields.category, 120, '語形区分', true);
      const memo = morphologySurveySafeText(fields && fields.memo, 500, '補足', false);
      const termSearch = notesHeadwords.has(normalizeObservedTerm(form)) &&
        normalizeObservedTerm(form) !== normalizeObservedTerm(headword) ? '対象外' : '対象';
      const supplement = ['一括調査ID：' + String(row[0]).trim(), memo].filter(Boolean).join(' ');
      mapping.appendRow([headword, form, category, termSearch, '対象', supplement]);
      updateNotesSourceMarkersForHeadword(spreadsheet, notes, headword, markers);
      SpreadsheetApp.flush();
      sheet.deleteRow(sheetRow);
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  // 次の候補を読み込む間は，ほかの登録処理を待たせない．
  return morphologySurveyState(sheetId);
}

function morphologySurveyFindRow_(sheet, surveyId) {
  const index = readSheetRows(sheet, 1).findIndex(row => String(row[0]) === String(surveyId));
  const row = index < 0 ? null : sheet.getRange(index + 2, 1, 1, MORPHOLOGY_SURVEY_HEADERS.length).getValues()[0];
  if (!row || !morphologySurveyEligible(row)) {
    throw new Error('対象行が変更されたため，画面を更新してください．');
  }
  return { row, sheetRow: index + 2 };
}

/** R列に1が入力された行を語形対応へ移す．単純トリガーと再処理メニューで共有する． */
function onEdit(e) {
  const range = e && e.range;
  if (!range || range.getColumn() > 18 || range.getLastColumn() < 18) return;
  const sheet = range.getSheet();
  if (!sheet.getName().startsWith(MORPHOLOGY_SURVEY_PREFIX)) return;
  const firstRow = Math.max(2, range.getRow());
  const lastRow = range.getLastRow();
  if (firstRow > lastRow) return;
  const values = sheet.getRange(firstRow, 18, lastRow - firstRow + 1, 1).getValues();
  if (!values.some(row => morphologySurveyIsApproved_(row[0]))) return;
  const ids = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, 1).getValues()
    .filter((row, index) => morphologySurveyIsApproved_(values[index][0]))
    .map(row => String(row[0] || '').trim()).filter(Boolean);
  const result = morphologySurveyProcessApprovedRows_(sheet, ids);
  morphologySurveyToast_(result);
}

function morphologySurveyIsApproved_(value) {
  return value === 1 || String(value || '').trim() === '1';
}

/** メニューからR列の承認済み行を再処理する． */
function morphologySurveyProcessMarkedRowsFromMenu() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getActiveSheet();
  if (!sheet.getName().startsWith(MORPHOLOGY_SURVEY_PREFIX)) {
    spreadsheet.toast('一括調査タブを開いてから実行してください．', '語形対応', 8);
    return;
  }
  morphologySurveyToast_(morphologySurveyProcessApprovedRows_(sheet));
}

function morphologySurveyToast_(result) {
  let message = '登録・整理：' + result.completed + '件';
  if (result.remaining) message += '／未処理：' + result.remaining + '件';
  if (result.errors.length) message += '／エラー：' + result.errors.slice(0, 3).join('；');
  SpreadsheetApp.getActiveSpreadsheet().toast(message, '語形対応', 10);
}

function morphologySurveyProcessApprovedRows_(sheet, requestedIds) {
  morphologySurveySheet(SpreadsheetApp.getActiveSpreadsheet(), sheet.getSheetId());
  const rows = readSheetRows(sheet, MORPHOLOGY_SURVEY_HEADERS.length);
  const allIds = requestedIds || rows.filter(row => morphologySurveyIsApproved_(row[17]))
    .map(row => String(row[0] || '').trim()).filter(Boolean);
  const ids = allIds.slice(0, MORPHOLOGY_SURVEY_BATCH_LIMIT);
  if (!ids.length) return { completed: 0, remaining: 0, errors: [] };
  const corpus = dictionarySourceCorpus(SpreadsheetApp.getActiveSpreadsheet());
  const result = { completed: 0, remaining: allIds.length, errors: [] };
  ids.forEach(id => {
    try {
      if (morphologySurveyTransferApprovedRow_(sheet, id, corpus)) result.completed++;
    } catch (error) {
      result.errors.push(id + '：' + (error && error.message || String(error)));
    }
  });
  result.remaining = Math.max(0, allIds.length - result.completed);
  return result;
}

function morphologySurveyTransferApprovedRow_(sheet, surveyId, corpus) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const initial = morphologySurveyFindApprovedRow_(sheet, surveyId);
  const row = initial.row;
  const headword = morphologySurveySafeText(row[1], 120, '見出し', true);
  const form = morphologySurveySafeText(row[4], 120, '関連語形', true);
  const markers = dictionarySourceMarkersFromCorpus(corpus, form);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('辞書の更新中です．R列の「1」は残しましたので，メニューから再処理してください．');
  try {
    const current = morphologySurveyFindApprovedRow_(sheet, surveyId);
    const currentRow = current.row;
    if (String(currentRow[1]) !== String(row[1]) || String(currentRow[4]) !== String(row[4])) {
      throw new Error('対象行が変更されたため登録しません．');
    }
    const mapping = requireSheetWithHeaders(spreadsheet,
      EXPERIMENTAL_TERM_MAPPING_SHEET_NAME, EXPERIMENTAL_TERM_MAPPING_HEADERS);
    const key = morphologySurveyPairKey(headword, form);
    const registered = readSheetRows(mapping, 2).some(item =>
      morphologySurveyPairKey(item[0], item[1]) === key);
    const notes = requireSheetWithHeaders(spreadsheet,
      EXPERIMENTAL_NOTES_SHEET_NAME, ['de', 'ja', 'source']);
    const notesHeadwords = new Set(readSheetRows(notes, 1).map(item =>
      normalizeObservedTerm(item[0])).filter(Boolean));
    if (!notesHeadwords.has(normalizeObservedTerm(headword))) {
      throw new Error('見出しがNotesにありません．行を残しました．');
    }
    if (!registered) {
      if (!(Number(currentRow[5]) > 0)) throw new Error('実例がないため登録しません．');
      const category = String(currentRow[9] || '').trim() || '語形変化（要分類）';
      const safeCategory = morphologySurveySafeText(category, 120, '語形区分', true);
      const memo = morphologySurveySafeText(currentRow[18], 500, '人のメモ', false);
      const termSearch = notesHeadwords.has(normalizeObservedTerm(form)) &&
        normalizeObservedTerm(form) !== normalizeObservedTerm(headword) ? '対象外' : '対象';
      const supplement = ['一括調査ID：' + String(currentRow[0]).trim(), memo].filter(Boolean).join(' ');
      mapping.appendRow([headword, form, safeCategory, termSearch, '対象', supplement]);
      SpreadsheetApp.flush();
    }
    updateNotesSourceMarkersForHeadword(spreadsheet, notes, headword, markers);
    SpreadsheetApp.flush();
    sheet.deleteRow(current.sheetRow);
    SpreadsheetApp.flush();
    return true;
  } finally {
    lock.releaseLock();
  }
}

function morphologySurveyFindApprovedRow_(sheet, surveyId) {
  const index = readSheetRows(sheet, 1).findIndex(row => String(row[0]) === String(surveyId));
  const row = index < 0 ? null : sheet.getRange(index + 2, 1, 1, MORPHOLOGY_SURVEY_HEADERS.length).getValues()[0];
  if (!row || !morphologySurveyIsApproved_(row[17])) {
    throw new Error('R列の承認が見つからないため処理しません．');
  }
  return { row, sheetRow: index + 2 };
}

function showMorphologySurveyReview() {
  const html = HtmlService.createHtmlOutputFromFile('morphology_survey_dialog')
    .setWidth(720).setHeight(680);
  SpreadsheetApp.getUi().showModalDialog(html, '一括調査の語形対応を確認');
}
