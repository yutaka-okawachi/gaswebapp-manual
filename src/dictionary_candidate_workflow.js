/**
 * 本番用の辞書候補ワークフロー．
 *
 * 公開検索からは，検索結果が1件以上あり，かつ辞書見出し・登録済み語形に
 * 一致しない検索語だけを観測する．Jev判定後も自動採用せず，人が
 * 「採用」にした行だけを候補タブへ移す．新規見出しは対話画面で確認後に
 * Notesへ，関連語形は確認後に語形対応へ反映する．
 */

const UNREGISTERED_RESULT_TERM_SHEET_NAME = '検索結果未登録語';
const UNREGISTERED_TERM_CANDIDATE_SHEET_NAME = '未登録語候補';
const JEV_REVIEW_SHEET_NAME = 'Jev判定';
const EXPERIMENTAL_TERM_MAPPING_SHEET_NAME = '語形対応';
const EXPERIMENTAL_NOTES_SHEET_NAME = 'Notes';

const UNREGISTERED_RESULT_TERM_HEADERS = [
  '観測ID', '検索語', '正規化語形', '初回検索日時', '最終検索日時',
  '検索回数', '検索ページ', '最大検索結果件数', '処理状態', 'Jev判定ID', '備考'
];
const JEV_REVIEW_HEADERS = [
  '判定ID', '入力語形', '文脈', '正規化語形', '判定経路', '処理状態',
  '分類', '対応見出し', '対応見出しID', '分類確信度', '対応確信度',
  '候補一覧', '人による確認', '確認メモ', '生成日時'
];
const EXPERIMENTAL_TERM_MAPPING_HEADERS = [
  '見出し', '関連語形', '語形区分', '用語検索', '実例検索', '補足'
];
const UNREGISTERED_TERM_CANDIDATE_HEADERS = [
  '候補ID', '検索語', '正規化語形', '初回検索日時', '最終検索日時',
  '検索回数', '検索ページ', 'Jev判定', '分類確信度', '類似する既存語候補',
  '状態', '管理者メモ', 'GPT草案状態', 'GPT草案', '元判定ID', '更新日時',
  '草案基本形', '草案品詞', '草案語形・変化形', '草案訳語', '草案説明', '草案分類',
  '草案類似語', '草案備考', 'GPT生成日時', 'GPTモデル', '草案確認', '草案修正メモ'
];
const ALLOWED_UNREGISTERED_RESULT_TERM_PAGES = Object.freeze([
  'terms_search.html', 'rs_terms_search.html', 'rw_terms_search.html'
]);
const RELATED_FORM_JEV_CATEGORIES = Object.freeze({
  INFLECTION: '語形変化（要分類）',
  ORTHOGRAPHIC_VARIANT: '別綴り',
  TYPO: '誤記候補'
});

function normalizeObservedTerm(value) {
  return String(value || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .trim();
}

function dictionarySourceCorpus(spreadsheet) {
  const definitions = [
    ['RS', '[RS: Oper]'],
    ['RW', '[RW: Oper]'],
    ['GM', '[GM]']
  ];
  return definitions.map(([sheetName, marker]) => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return { marker, values: [] };
    const layout = namedSheetColumns_(sheet, ['de', 'de_normalized']);
    const values = sheet.getRange(2, layout.positions[1] + 1, sheet.getLastRow() - 1, 1).getValues()
      .map(row => normalizeObservedTerm(row[0])).filter(Boolean);
    namedSheetAssertLayout_(sheet, layout);
    return { marker, values };
  });
}

function dictionarySourceMarkersFromCorpus(corpus, term) {
  const target = normalizeObservedTerm(term);
  if (!target) return [];
  const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp('(^|[^a-z0-9])' + escapeRegExp(target) + '($|[^a-z0-9])', 'i');
  return corpus.filter(item => item.values.some(value => pattern.test(value)))
    .map(item => item.marker);
}

function dictionarySourceMarkers(spreadsheet, term) {
  return dictionarySourceMarkersFromCorpus(dictionarySourceCorpus(spreadsheet), term);
}

function mergeDictionarySourceMarkers(existing, markers) {
  const current = String(existing || '').split(',').map(value => value.trim()).filter(Boolean);
  const canonical = value => value.replace(/\s+\]/g, ']');
  const seen = new Set(current.map(canonical));
  markers.forEach(marker => {
    if (!seen.has(canonical(marker))) {
      current.push(marker);
      seen.add(canonical(marker));
    }
  });
  return current.join(', ');
}

function updateNotesSourceMarkersForHeadword(spreadsheet, notesSheet, headword, markers) {
  if (!markers.length) return false;
  const rows = readSheetRows(notesSheet, 3);
  const rowIndex = rows.findIndex(row => normalizeObservedTerm(row[0]) === normalizeObservedTerm(headword));
  if (rowIndex < 0) return false;
  const current = String(rows[rowIndex][2] || '');
  const merged = mergeDictionarySourceMarkers(current, markers);
  if (merged === current) return false;
  namedSheetCell_(notesSheet, ['de', 'ja', 'source'], rowIndex + 2, 2).setValue(merged);
  return true;
}

function refreshDictionarySourceMarkersForMappings() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const notesSheet = requireSheetWithHeaders(
    spreadsheet,
    EXPERIMENTAL_NOTES_SHEET_NAME,
    ['de', 'ja', 'source']
  );
  const mappingSheet = requireSheetWithHeaders(spreadsheet, EXPERIMENTAL_TERM_MAPPING_SHEET_NAME, EXPERIMENTAL_TERM_MAPPING_HEADERS);
  const rows = readSheetRows(mappingSheet, EXPERIMENTAL_TERM_MAPPING_HEADERS.length);
  const notesRows = readSheetRows(notesSheet, 3);
  const notesIndex = new Map();
  notesRows.forEach((row, index) => {
    const normalized = normalizeObservedTerm(row[0]);
    if (normalized && !notesIndex.has(normalized)) notesIndex.set(normalized, index);
  });
  const sources = notesRows.map(row => String(row[2] || ''));
  const corpus = dictionarySourceCorpus(spreadsheet);
  const mappingKeys = new Set();
  const mappingHeadwords = new Set();
  const updatedRows = new Set();
  let mappingsWithExamples = 0;
  rows.forEach(row => {
    const headword = String(row[0] || '').trim();
    const relatedForm = String(row[1] || '').trim();
    if (!headword || !relatedForm) return;
    mappingHeadwords.add(normalizeObservedTerm(headword));
    const key = normalizeObservedTerm(headword) + '\u0000' + normalizeObservedTerm(relatedForm);
    if (mappingKeys.has(key)) return;
    mappingKeys.add(key);
    const markers = dictionarySourceMarkersFromCorpus(corpus, relatedForm);
    if (markers.length) mappingsWithExamples += 1;
    const notesRowIndex = notesIndex.get(normalizeObservedTerm(headword));
    if (notesRowIndex === undefined || !markers.length) return;
    const merged = mergeDictionarySourceMarkers(sources[notesRowIndex], markers);
    if (merged !== sources[notesRowIndex]) {
      sources[notesRowIndex] = merged;
      updatedRows.add(notesRowIndex);
    }
  });
  if (updatedRows.size) {
    const layout = namedSheetColumns_(notesSheet, ['source']);
    namedSheetAssertLayout_(notesSheet, layout);
    notesSheet.getRange(2, layout.positions[0] + 1, sources.length, 1).setValues(sources.map(value => [value]));
  }
  return { mappingsChecked: rows.length, headingsChecked: mappingHeadwords.size, mappingsWithExamples, notesUpdated: updatedRows.size };
}

function refreshDictionarySourceMarkersForMappingsFromMenu() {
  const ui = SpreadsheetApp.getUi();
  try {
    const result = refreshDictionarySourceMarkersForMappings();
    ui.alert('語形対応の出典調査完了',
      '語形対応行：' + result.mappingsChecked + '件\n' +
      '見出し確認：' + result.headingsChecked + '件\n' +
      '関連語形の実例を確認できた対応：' + result.mappingsWithExamples + '件\n' +
      'NotesのC列更新：' + result.notesUpdated + '件\n\n' +
      '既存の記載と同じ出典は重複追記していません．', ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('出典調査に失敗しました', String(error && error.message || error), ui.ButtonSet.OK);
  }
}

function requireSheetWithHeaders(spreadsheet, sheetName, requiredHeaders) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('必要なタブがありません：' + sheetName);
  if (sheetName === 'Notes') { namedSheetColumns_(sheet, requiredHeaders); return sheet; }
  const actual = sheet.getRange(1, 1, 1, requiredHeaders.length).getValues()[0];
  requiredHeaders.forEach((header, index) => {
    if (actual[index] !== header) {
      throw new Error(sheetName + ' の列構成が一致しません：' + header);
    }
  });
  return sheet;
}

function readSheetRows(sheet, width) {
  if (typeof sheet.getName === 'function' && sheet.getName() === 'Notes') {
    return namedSheetRead_(sheet, ['de', 'ja', 'source'].slice(0, width), 2, Math.max(0, sheet.getLastRow() - 1)).values;
  }
  return sheet.getLastRow() >= 2
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues()
    : [];
}
