/** 観測済みの1語だけを，明示操作と課金確認後にJevへ送る． */
const JEV_CANDIDATE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const JEV_CANDIDATE_CATEGORIES = Object.freeze({
  INFLECTION: 'A grammatically valid inflected or conjugated form of a candidate headword.',
  ORTHOGRAPHIC_VARIANT: 'A historical or alternate spelling of a candidate headword.',
  TYPO: 'An unintended misspelling of a candidate headword.',
  NEW_TERM_CANDIDATE: 'A plausible German music term not represented by the candidate headwords.',
  UNCERTAIN: 'The evidence is insufficient or ambiguous.'
});

function jevCandidateDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
    }
    for (let j = 0; j < current.length; j++) previous[j] = current[j];
  }
  return previous[right.length];
}

function jevCandidateHeadwords(notesRows, term) {
  const normalized = normalizeObservedTerm(term);
  return notesRows.map(row => {
    const headword = String(row[0] || '').normalize('NFC').trim();
    const key = normalizeObservedTerm(headword);
    return {
      headword,
      dictionaryId: 'term-' + key.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      translation: String(row[1] || '').slice(0, 240),
      source: String(row[2] || '').slice(0, 120),
      distance: jevCandidateDistance(normalized, key)
    };
  }).filter(item => item.headword)
    .sort((a, b) => a.distance - b.distance || a.headword.localeCompare(b.headword, 'de'))
    .slice(0, 5).map((item, index) => Object.assign({ option: 'candidate_' + (index + 1) }, item));
}

function buildJevCandidateRequest(term, context, candidates) {
  const criteria = { no_match: 'None of the listed headwords is the intended match.' };
  candidates.forEach(item => {
    criteria[item.option] = {
      headword: item.headword,
      translation: item.translation,
      source: item.source,
      normalized_edit_distance: item.distance
    };
  });
  return {
    model: 'jev-latest',
    state: {
      observed_form: term,
      normalized_form: normalizeObservedTerm(term),
      german_context: context,
      candidate_headwords: candidates.map(item => ({
        option: item.option,
        headword: item.headword,
        translation: item.translation,
        source: item.source,
        normalized_edit_distance: item.distance
      }))
    },
    questions: {
      category: {
        type: 'choice',
        instructions: 'Classify the relationship between the observed German form and the candidate dictionary headwords. Choose UNCERTAIN when evidence is insufficient.',
        criteria: JEV_CANDIDATE_CATEGORIES
      },
      target: {
        type: 'choice',
        instructions: 'Which candidate headword, if any, is the intended dictionary headword in this context?',
        criteria
      }
    }
  };
}

function validateJevCandidateChoice(answer, allowed) {
  if (!answer || answer.type !== 'choice' || allowed.indexOf(answer.choice) === -1 ||
      !Number.isFinite(answer.confidence) || answer.confidence < 0 || answer.confidence > 1) {
    throw new Error('Jevの回答形式が不正です．観測行を再実行する前に利用状況を確認してください．');
  }
  return answer;
}

function jevCandidateContext(spreadsheet, observation) {
  const page = String(observation[6] || '');
  const source = page.indexOf('RW') !== -1 ? 'RW' : page.indexOf('RS') !== -1 ? 'RS' :
    page.indexOf('GM') !== -1 ? 'GM' : '';
  const sheet = source && spreadsheet.getSheetByName(source);
  if (!sheet || sheet.getLastRow() < 2) return '';
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const deColumn = headers.indexOf('de') + 1;
  if (!deColumn) return '';
  const normalizedColumn = headers.indexOf('de_normalized') + 1;
  const lookupColumn = normalizedColumn || deColumn;
  const term = normalizedColumn
    ? normalizeObservedTerm(observation[2] || observation[1])
    : String(observation[1] || '');
  const range = sheet.getRange(2, lookupColumn, sheet.getLastRow() - 1, 1);
  const match = range.createTextFinder(term).matchCase(false).findNext();
  return match ? String(sheet.getRange(match.getRow(), deColumn).getValue() || '').slice(0, 500) : '';
}

function jevCandidateSheetText(value) {
  const text = String(value || '');
  return /^[=+@-]/.test(text) ? "'" + text : text;
}

function callJevForCandidate(request, apiKey) {
  const response = UrlFetchApp.fetch(JEV_CANDIDATE_ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(request),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Jev APIがHTTP ' + response.getResponseCode() + 'を返しました．');
  }
  let result;
  try { result = JSON.parse(response.getContentText()); }
  catch (_) { throw new Error('Jevの応答を読み取れませんでした．'); }
  const answers = result && result.answers;
  const category = validateJevCandidateChoice(answers && answers.category,
    Object.keys(JEV_CANDIDATE_CATEGORIES));
  const target = validateJevCandidateChoice(answers && answers.target,
    ['no_match'].concat(request.state.candidate_headwords.map(item => item.option)));
  return { category, target };
}

function createJevReviewForObservation(rowNumber, expectedObservationId, confirmedCharge) {
  if (confirmedCharge !== true) throw new Error('Jevの課金確認が必要です．');
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!Number.isInteger(rowNumber) || rowNumber < 2) throw new Error('有効な観測行を選択してください．');
  const apiKey = String(PropertiesService.getScriptProperties().getProperty('TYPESAFE_API_KEY') || '').trim();
  if (!apiKey) throw new Error('TYPESAFE_API_KEY が未設定です．');
    const observations = requireSheetWithHeaders(spreadsheet,
      UNREGISTERED_RESULT_TERM_SHEET_NAME, UNREGISTERED_RESULT_TERM_HEADERS);
    const reviews = requireSheetWithHeaders(spreadsheet, JEV_REVIEW_SHEET_NAME, JEV_REVIEW_HEADERS);
    const notes = spreadsheet.getSheetByName(EXPERIMENTAL_NOTES_SHEET_NAME);
    if (!notes) throw new Error('必要なタブがありません：' + EXPERIMENTAL_NOTES_SHEET_NAME);
    const observation = observations.getRange(rowNumber, 1, 1, UNREGISTERED_RESULT_TERM_HEADERS.length).getValues()[0];
    if (String(observation[0] || '') !== String(expectedObservationId || '')) {
      throw new Error('選択した観測行が更新されました．Jevは呼び出していません．');
    }
    const term = String(observation[1] || '').normalize('NFC').trim();
    const normalized = normalizeObservedTerm(term);
    if (!term || term.length > 120 || !normalized || /^[=+@-]/.test(term) ||
        /[\u0000-\u001f]/.test(term) || !Number.isFinite(Number(observation[7])) ||
        Number(observation[7]) < 1 || !String(observation[0] || '')) {
      throw new Error('選択した行は有効な観測ではありません．');
    }
    if (String(observation[8] || '') !== '未判定' || String(observation[9] || '')) {
      throw new Error('この行は未判定ではありません．重複課金を防ぐため再実行しません．');
    }
    const reviewId = dictionaryCandidateRecordId('jev', observation[0]);
    const existing = readSheetRows(reviews, JEV_REVIEW_HEADERS.length);
    if (existing.some(row => String(row[0] || '') === reviewId ||
        (row[4] === 'Jev' && row[5] === 'ADVISORY' && normalizeObservedTerm(row[3]) === normalized))) {
      throw new Error('同じ語形のJev判定が既にあります．判定タブを確認してください．');
    }
    const mapping = requireSheetWithHeaders(spreadsheet,
      EXPERIMENTAL_TERM_MAPPING_SHEET_NAME, EXPERIMENTAL_TERM_MAPPING_HEADERS);
    const notesRows = readSheetRows(notes, 3);
    if (notesRows.some(row => normalizeObservedTerm(row[0]) === normalized) ||
        readSheetRows(mapping, 2).some(row => normalizeObservedTerm(row[1]) === normalized)) {
      throw new Error('この語形は辞書に登録済みです．判定の前に観測行を確認してください．');
    }
    const candidates = jevCandidateHeadwords(notesRows, term);
    const context = jevCandidateContext(spreadsheet, observation);
    if (!context) {
      throw new Error('実例の文脈を取得できませんでした．費用が発生するJev判定は実行しません．');
    }
    const request = buildJevCandidateRequest(term, context, candidates);
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error('判定の更新ロックを取得できませんでした．');
    try {
      const current = observations.getRange(rowNumber, 1, 1, UNREGISTERED_RESULT_TERM_HEADERS.length).getValues()[0];
      if (String(current[0]) !== String(observation[0]) || current[8] !== '未判定' || current[9] ||
          readSheetRows(reviews, JEV_REVIEW_HEADERS.length).some(row =>
            String(row[0]) === reviewId ||
            (row[4] === 'Jev' && row[5] === 'ADVISORY' && normalizeObservedTerm(row[3]) === normalized))) {
        throw new Error('確認中に観測行が更新されました．Jevは呼び出していません．');
      }
      observations.getRange(rowNumber, 9).setValue('Jev判定待ち');
    } finally { lock.releaseLock(); }

    let answer;
    try { answer = callJevForCandidate(request, apiKey); }
    catch (error) {
      observations.getRange(rowNumber, 11).setValue('Jev呼出しの成否を確認してください：' +
        String(error && error.message || error).slice(0, 180));
      throw error;
    }
    const selected = candidates.find(item => item.option === answer.target.choice);
    if (!lock.tryLock(10000)) throw new Error('判定の保存ロックを取得できませんでした．');
    try {
      if (readSheetRows(reviews, 1).some(row => String(row[0]) === reviewId)) {
        throw new Error('同じ判定IDが既に保存されています．');
      }
      reviews.appendRow([
        reviewId, term, jevCandidateSheetText(context), normalized, 'Jev', 'ADVISORY', answer.category.choice,
        selected ? selected.headword : '', selected ? selected.dictionaryId : '',
        answer.category.confidence, answer.target.confidence,
        candidates.map(item => item.option + ': ' + item.headword + '（距離 ' + item.distance + '）').join(' / '),
        '未確認', '', new Date()
      ]);
      observations.getRange(rowNumber, 9, 1, 3).setValues([['Jev判定済み', reviewId, '']]);
    } finally { lock.releaseLock(); }
    return { reviewId, term };
}

function createJevReviewForSelectedObservationFromMenu() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const selection = spreadsheet.getActiveRange();
  const sheet = spreadsheet.getActiveSheet();
  if (sheet.getName() !== UNREGISTERED_RESULT_TERM_SHEET_NAME || !selection ||
      selection.getNumRows() !== 1 || selection.getRow() < 2) {
    ui.alert('対象行を選択してください',
      '「検索結果未登録語」で，判定する語の行を1行だけ選択してください．', ui.ButtonSet.OK);
    return;
  }
  try {
    const observationId = String(sheet.getRange(selection.getRow(), 1).getValue() || '');
    const term = String(sheet.getRange(selection.getRow(), 2).getValue() || '');
    if (ui.alert('Jev判定を作成',
      '「' + term + '」をJevで1回判定します．API課金が発生する可能性があります．実行しますか．',
      ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    createJevReviewForObservation(selection.getRow(), observationId, true);
    ui.alert('判定を保存しました',
      '「Jev判定」の新しい行を確認し，M列で採否を判断してください．この段階ではNotesと語形対応は変更していません．',
      ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('判定を完了できませんでした', String(error && error.message || error), ui.ButtonSet.OK);
  }
}
