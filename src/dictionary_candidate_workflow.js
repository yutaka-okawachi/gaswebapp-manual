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
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const normalizedColumn = headers.indexOf('de_normalized') + 1;
    const deColumn = headers.indexOf('de') + 1;
    const column = normalizedColumn || deColumn;
    if (!column) return { marker, values: [] };
    const values = sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getValues()
      .map(row => normalizeObservedTerm(row[0])).filter(Boolean);
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
  notesSheet.getRange(rowIndex + 2, 3).setValue(merged);
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
    notesSheet.getRange(2, 3, sources.length, 1).setValues(sources.map(value => [value]));
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
  const actual = sheet.getRange(1, 1, 1, requiredHeaders.length).getValues()[0];
  requiredHeaders.forEach((header, index) => {
    if (actual[index] !== header) {
      throw new Error(sheetName + ' の列構成が一致しません：' + header);
    }
  });
  return sheet;
}

function dictionaryCandidateRecordId(prefix, value) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(value || ''),
    Utilities.Charset.UTF_8
  );
  const hex = bytes.map(item => (item + 256).toString(16).slice(-2)).join('');
  return prefix + '-' + hex.slice(0, 24);
}

function mergeObservationPages(currentValue, newValue) {
  const pages = String(currentValue || '').split('，').map(value => value.trim()).filter(Boolean);
  if (newValue && pages.indexOf(newValue) === -1) pages.push(newValue);
  return pages.join('，');
}

function sanitizeUnregisteredResultTermObservation(data) {
  const term = String(data && data.term || '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const page = String(data && data.page || '').trim();
  const eventId = String(data && data.eventId || '').trim();
  const resultCount = Number(data && data.resultCount);
  if (!term || term.length > 120) throw new Error('検索語が空か，長すぎます．');
  if (ALLOWED_UNREGISTERED_RESULT_TERM_PAGES.indexOf(page) === -1) {
    throw new Error('対象外の検索ページです．');
  }
  if (!Number.isInteger(resultCount) || resultCount <= 0 || resultCount > 1000000) {
    throw new Error('1件以上の有効な検索結果件数が必要です．');
  }
  if (!/^[a-f0-9-]{16,80}$/i.test(eventId)) throw new Error('観測イベントIDが不正です．');
  const normalized = normalizeObservedTerm(term);
  if (!normalized) throw new Error('正規化後の検索語が空です．');
  return { term, normalized, page, resultCount, eventId };
}

function handleUnregisteredResultTermObservation(data) {
  try {
    const observation = sanitizeUnregisteredResultTermObservation(data);
    const result = recordUnregisteredResultTermObservation(observation);
    return createJsonResponse(Object.assign({ status: 'success' }, result));
  } catch (error) {
    Logger.log('handleUnregisteredResultTermObservation error: ' + error.toString());
    return createJsonResponse({ status: 'error', error: error.toString() }, 400);
  }
}

function recordUnregisteredResultTermObservation(observation) {
  const pageTitle = pageNameMap[observation.page];
  const cache = CacheService.getScriptCache();
  const cacheKey = 'unregistered-result-term-event-' +
    dictionaryCandidateRecordId('event', observation.eventId);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('検索結果未登録語の更新ロックを取得できませんでした．');

  try {
    if (cache.get(cacheKey)) return { recorded: false, duplicate: true };
    const sheet = requireSheetWithHeaders(
      SpreadsheetApp.getActiveSpreadsheet(),
      UNREGISTERED_RESULT_TERM_SHEET_NAME,
      UNREGISTERED_RESULT_TERM_HEADERS
    );
    const now = new Date();
    const lastRow = sheet.getLastRow();
    let targetRow = 0;
    if (lastRow >= 2) {
      const normalizedValues = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
      const matchIndex = normalizedValues.findIndex(row => String(row[0] || '') === observation.normalized);
      if (matchIndex >= 0) targetRow = matchIndex + 2;
    }

    if (targetRow) {
      const row = sheet.getRange(targetRow, 1, 1, UNREGISTERED_RESULT_TERM_HEADERS.length).getValues()[0];
      row[4] = now;
      row[5] = Math.max(0, Number(row[5]) || 0) + 1;
      row[6] = mergeObservationPages(row[6], pageTitle);
      row[7] = Math.max(0, Number(row[7]) || 0, observation.resultCount);
      sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow([
        dictionaryCandidateRecordId('observation', observation.normalized),
        observation.term,
        observation.normalized,
        now,
        now,
        1,
        pageTitle,
        observation.resultCount,
        '未判定',
        '',
        ''
      ]);
    }
    cache.put(cacheKey, '1', 5);
    return { recorded: true, duplicate: false };
  } finally {
    lock.releaseLock();
  }
}

function readSheetRows(sheet, width) {
  return sheet.getLastRow() >= 2
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues()
    : [];
}

function appendApprovedRelatedForm(review, mappingSheet, notesHeadwords, existingPairs) {
  const headword = String(review[7] || '').normalize('NFC').trim();
  const relatedForm = String(review[1] || '').normalize('NFC').trim();
  const category = String(review[6] || '').trim();
  const normalizedHeadword = normalizeObservedTerm(headword);
  const normalizedRelatedForm = normalizeObservedTerm(relatedForm);
  if (!headword || !relatedForm || !RELATED_FORM_JEV_CATEGORIES[category]) return 'skipped';
  if (!notesHeadwords.has(normalizedHeadword)) return 'skipped';

  const pairKey = normalizedHeadword + '\u0000' + normalizedRelatedForm;
  if (existingPairs.has(pairKey)) return 'duplicate';
  const termSearch = notesHeadwords.has(normalizedRelatedForm) && normalizedRelatedForm !== normalizedHeadword
    ? '対象外'
    : '対象';
  const memo = String(review[13] || '').trim();
  const noteParts = ['Jev判定ID：' + String(review[0] || '').trim()];
  if (category === 'INFLECTION') noteParts.push('具体的な語形区分は人が確認する．');
  if (memo) noteParts.push(memo.replace(/。/g, '．').replace(/、/g, '，'));
  mappingSheet.appendRow([
    headword,
    relatedForm,
    RELATED_FORM_JEV_CATEGORIES[category],
    termSearch,
    '対象',
    noteParts.join(' ')
  ]);
  if (typeof mappingSheet.getParent === 'function') {
    const spreadsheet = mappingSheet.getParent();
    const notesSheet = spreadsheet.getSheetByName(EXPERIMENTAL_NOTES_SHEET_NAME);
    if (notesSheet) {
      updateNotesSourceMarkersForHeadword(
        spreadsheet,
        notesSheet,
        headword,
        dictionarySourceMarkers(spreadsheet, relatedForm)
      );
    }
  }
  existingPairs.add(pairKey);
  return 'inserted';
}

function appendApprovedNewTermCandidate(review, observationByNormalized, candidateSheet, candidateByNormalized) {
  const normalized = normalizeObservedTerm(review[3] || review[1]);
  const observed = observationByNormalized.get(normalized);
  if (!normalized || !observed) return 'skipped';
  const now = new Date();
  const existing = candidateByNormalized.get(normalized);
  if (existing) {
    const row = existing.row.slice();
    row[1] = observed.row[1];
    row[2] = normalized;
    row[3] = observed.row[3];
    row[4] = observed.row[4];
    row[5] = observed.row[5];
    row[6] = observed.row[6];
    row[7] = 'NEW_TERM_CANDIDATE';
    row[8] = review[9];
    row[9] = review[11];
    row[14] = review[0];
    row[15] = now;
    candidateSheet.getRange(existing.sheetRow, 1, 1, row.length).setValues([row]);
  } else {
    const row = [
      dictionaryCandidateRecordId('candidate', normalized), observed.row[1], normalized,
      observed.row[3], observed.row[4], observed.row[5], observed.row[6],
      'NEW_TERM_CANDIDATE', review[9], review[11], '候補', '', '未作成', '',
      review[0], now, '', '', '', '', '', '', '', '', '', '', '未確認', ''
    ];
    candidateSheet.appendRow(row);
    candidateByNormalized.set(normalized, { row, sheetRow: candidateSheet.getLastRow() });
  }
  observed.row[8] = '候補移送済み';
  observed.row[9] = review[0];
  observed.sheet.getRange(observed.sheetRow, 1, 1, observed.row.length).setValues([observed.row]);
  return existing ? 'updated' : 'inserted';
}

function promoteApprovedDictionaryCandidates() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('辞書候補の更新ロックを取得できませんでした．');
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const observationSheet = requireSheetWithHeaders(
      spreadsheet, UNREGISTERED_RESULT_TERM_SHEET_NAME, UNREGISTERED_RESULT_TERM_HEADERS
    );
    const reviewSheet = requireSheetWithHeaders(spreadsheet, JEV_REVIEW_SHEET_NAME, JEV_REVIEW_HEADERS);
    const mappingSheet = requireSheetWithHeaders(
      spreadsheet, EXPERIMENTAL_TERM_MAPPING_SHEET_NAME, EXPERIMENTAL_TERM_MAPPING_HEADERS
    );
    const candidateSheet = requireSheetWithHeaders(
      spreadsheet, UNREGISTERED_TERM_CANDIDATE_SHEET_NAME, UNREGISTERED_TERM_CANDIDATE_HEADERS
    );
    const notesSheet = spreadsheet.getSheetByName(EXPERIMENTAL_NOTES_SHEET_NAME);
    if (!notesSheet) throw new Error('必要なタブがありません：' + EXPERIMENTAL_NOTES_SHEET_NAME);

    const notesHeadwords = new Set(
      readSheetRows(notesSheet, 1).map(row => normalizeObservedTerm(row[0])).filter(Boolean)
    );
    const mappingRows = readSheetRows(mappingSheet, EXPERIMENTAL_TERM_MAPPING_HEADERS.length);
    const existingPairs = new Set(mappingRows.map(row =>
      normalizeObservedTerm(row[0]) + '\u0000' + normalizeObservedTerm(row[1])
    ));
    const observationRows = readSheetRows(observationSheet, UNREGISTERED_RESULT_TERM_HEADERS.length);
    const observationByNormalized = new Map();
    observationRows.forEach((row, index) => {
      const normalized = normalizeObservedTerm(row[2] || row[1]);
      if (normalized && !observationByNormalized.has(normalized)) {
        observationByNormalized.set(normalized, { row, sheetRow: index + 2, sheet: observationSheet });
      }
    });
    const candidateRows = readSheetRows(candidateSheet, UNREGISTERED_TERM_CANDIDATE_HEADERS.length);
    const candidateByNormalized = new Map();
    candidateRows.forEach((row, index) => {
      const normalized = normalizeObservedTerm(row[2] || row[1]);
      if (normalized && !candidateByNormalized.has(normalized)) {
        candidateByNormalized.set(normalized, { row, sheetRow: index + 2 });
      }
    });

    const result = {
      relatedFormsInserted: 0,
      relatedFormsDuplicate: 0,
      newTermsInserted: 0,
      newTermsUpdated: 0,
      skipped: 0
    };
    readSheetRows(reviewSheet, JEV_REVIEW_HEADERS.length).forEach(review => {
      if (review[4] !== 'Jev' || review[5] !== 'ADVISORY' || review[12] !== '採用') return;
      if (review[6] === 'NEW_TERM_CANDIDATE') {
        const status = appendApprovedNewTermCandidate(
          review, observationByNormalized, candidateSheet, candidateByNormalized
        );
        if (status === 'inserted') result.newTermsInserted += 1;
        else if (status === 'updated') result.newTermsUpdated += 1;
        else result.skipped += 1;
        return;
      }
      const status = appendApprovedRelatedForm(
        review, mappingSheet, notesHeadwords, existingPairs
      );
      if (status === 'inserted') result.relatedFormsInserted += 1;
      else if (status === 'duplicate') result.relatedFormsDuplicate += 1;
      else result.skipped += 1;
    });
    return result;
  } finally {
    lock.releaseLock();
  }
}

/** ダイアログで確認した1件だけを移送する．既存の一括メニューは変更しない． */
function promoteApprovedDictionaryCandidateByReviewId(reviewId) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('辞書候補の更新ロックを取得できませんでした．');
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const observationSheet = requireSheetWithHeaders(spreadsheet,
      UNREGISTERED_RESULT_TERM_SHEET_NAME, UNREGISTERED_RESULT_TERM_HEADERS);
    const reviewSheet = requireSheetWithHeaders(spreadsheet, JEV_REVIEW_SHEET_NAME, JEV_REVIEW_HEADERS);
    const mappingSheet = requireSheetWithHeaders(spreadsheet,
      EXPERIMENTAL_TERM_MAPPING_SHEET_NAME, EXPERIMENTAL_TERM_MAPPING_HEADERS);
    const candidateSheet = requireSheetWithHeaders(spreadsheet,
      UNREGISTERED_TERM_CANDIDATE_SHEET_NAME, UNREGISTERED_TERM_CANDIDATE_HEADERS);
    const notesSheet = spreadsheet.getSheetByName(EXPERIMENTAL_NOTES_SHEET_NAME);
    if (!notesSheet) throw new Error('Notesがありません．');
    const review = readSheetRows(reviewSheet, JEV_REVIEW_HEADERS.length)
      .find(row => String(row[0] || '') === String(reviewId || ''));
    if (!review || review[4] !== 'Jev' || review[5] !== 'ADVISORY' || review[12] !== '採用') {
      throw new Error('人が採用したJev判定を1件選択してください．');
    }
    if (review[6] === 'NEW_TERM_CANDIDATE') {
      const normalized = normalizeObservedTerm(review[3] || review[1]);
      const observationRows = readSheetRows(observationSheet, UNREGISTERED_RESULT_TERM_HEADERS.length);
      const observationIndex = observationRows.findIndex(row =>
        normalizeObservedTerm(row[2] || row[1]) === normalized && String(row[9] || '') === reviewId);
      if (observationIndex < 0) throw new Error('対応する観測行が見つかりません．');
      const candidateRows = readSheetRows(candidateSheet, UNREGISTERED_TERM_CANDIDATE_HEADERS.length);
      const candidateIndex = candidateRows.findIndex(row => normalizeObservedTerm(row[2] || row[1]) === normalized);
      if (candidateIndex >= 0 && candidateRows[candidateIndex][10] === 'Notes反映済み') {
        return { status: 'duplicate', destination: UNREGISTERED_TERM_CANDIDATE_SHEET_NAME };
      }
      const byNormalized = new Map();
      if (candidateIndex >= 0) byNormalized.set(normalized,
        { row: candidateRows[candidateIndex], sheetRow: candidateIndex + 2 });
      const observationByNormalized = new Map([[normalized, {
        row: observationRows[observationIndex], sheetRow: observationIndex + 2, sheet: observationSheet
      }]]);
      const status = appendApprovedNewTermCandidate(review, observationByNormalized,
        candidateSheet, byNormalized);
      return { status, destination: UNREGISTERED_TERM_CANDIDATE_SHEET_NAME };
    }
    const notesHeadwords = new Set(readSheetRows(notesSheet, 1)
      .map(row => normalizeObservedTerm(row[0])).filter(Boolean));
    const pairs = new Set(readSheetRows(mappingSheet, 2).map(row =>
      normalizeObservedTerm(row[0]) + '\u0000' + normalizeObservedTerm(row[1])));
    const status = appendApprovedRelatedForm(review, mappingSheet, notesHeadwords, pairs);
    if (status === 'skipped') throw new Error('対応見出しがNotesにないか，分類が対象外です．');
    const observationRows = readSheetRows(observationSheet, UNREGISTERED_RESULT_TERM_HEADERS.length);
    const observationIndex = observationRows.findIndex(row => String(row[9] || '') === reviewId);
    if (observationIndex >= 0) observationSheet.getRange(observationIndex + 2, 9).setValue('候補移送済み');
    return { status, destination: EXPERIMENTAL_TERM_MAPPING_SHEET_NAME };
  } finally { lock.releaseLock(); }
}

function promoteApprovedDictionaryCandidatesFromMenu() {
  const ui = SpreadsheetApp.getUi();
  try {
    const result = promoteApprovedDictionaryCandidates();
    ui.alert(
      '辞書候補の反映完了',
      '関連語形の追加：' + result.relatedFormsInserted + '件\n' +
      '関連語形の重複：' + result.relatedFormsDuplicate + '件\n' +
      '新規用語候補の追加：' + result.newTermsInserted + '件\n' +
      '新規用語候補の更新：' + result.newTermsUpdated + '件\n' +
      '要確認：' + result.skipped + '件\n\n' +
      '新規見出しは未登録語候補で確認後にNotesへ登録します．関連語形は語形対応へ反映済みです．公開サイトへの反映にはsync-dataが必要です．',
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('反映できませんでした', String(error && error.message || error), ui.ButtonSet.OK);
  }
}
