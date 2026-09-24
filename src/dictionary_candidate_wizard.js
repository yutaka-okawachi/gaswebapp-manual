/** 未登録語の対話画面．人の確認後にNotes・語形対応へ反映する． */
const CANDIDATE_WIZARD_OPENAI_URL = 'https://api.openai.com/v1/responses';

function candidateWizardFindObservation(id) {
  if (!/^observation-[a-f0-9]{24}$/.test(String(id || ''))) throw new Error('観測IDが不正です．');
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = requireSheetWithHeaders(spreadsheet,
    UNREGISTERED_RESULT_TERM_SHEET_NAME, UNREGISTERED_RESULT_TERM_HEADERS);
  const index = readSheetRows(sheet, UNREGISTERED_RESULT_TERM_HEADERS.length)
    .findIndex(row => String(row[0] || '') === id);
  if (index < 0) throw new Error('観測行が見つかりません．');
  const rowNumber = index + 2;
  return { spreadsheet, sheet, rowNumber,
    row: sheet.getRange(rowNumber, 1, 1, UNREGISTERED_RESULT_TERM_HEADERS.length).getValues()[0] };
}

function candidateWizardFindLinked(sheet, width, id) {
  const index = readSheetRows(sheet, width).findIndex(row => String(row[0] || '') === String(id || ''));
  return index < 0 ? null : { rowNumber: index + 2,
    row: sheet.getRange(index + 2, 1, 1, width).getValues()[0] };
}

function candidateWizardDraftDetails(raw) {
  try {
    const data = JSON.parse(String(raw || '{}'));
    const list = value => Array.isArray(value) ? value.join('，') : String(value || '');
    return { english: list(data.english_equivalents || data.english),
      italian: list(data.italian_equivalents || data.italian),
      musicExamples: list(data.music_examples || data.musicExamples),
      comment: String(data.comment || '') };
  } catch (_) { return { english: '', italian: '', musicExamples: '', comment: '' }; }
}

function candidateWizardBootstrap() {
  const sheet = requireSheetWithHeaders(SpreadsheetApp.getActiveSpreadsheet(),
    UNREGISTERED_RESULT_TERM_SHEET_NAME, UNREGISTERED_RESULT_TERM_HEADERS);
  const rows = readSheetRows(sheet, UNREGISTERED_RESULT_TERM_HEADERS.length);
  return rows.map(row => ({ id: String(row[0] || ''), term: String(row[1] || ''),
    status: String(row[8] || ''), count: Number(row[5]) || 0 }))
    .filter(item => item.id && item.term).reverse().slice(0, 100);
}

function candidateWizardState(id) {
  const found = candidateWizardFindObservation(id);
  const spreadsheet = found.spreadsheet;
  const observation = found.row;
  const reviews = requireSheetWithHeaders(spreadsheet, JEV_REVIEW_SHEET_NAME, JEV_REVIEW_HEADERS);
  const review = candidateWizardFindLinked(reviews, JEV_REVIEW_HEADERS.length, observation[9]);
  const candidates = requireSheetWithHeaders(spreadsheet,
    UNREGISTERED_TERM_CANDIDATE_SHEET_NAME, UNREGISTERED_TERM_CANDIDATE_HEADERS);
  const candidateId = dictionaryCandidateRecordId('candidate', normalizeObservedTerm(observation[2] || observation[1]));
  const candidate = candidateWizardFindLinked(candidates, UNREGISTERED_TERM_CANDIDATE_HEADERS.length, candidateId);
  const draftCandidate = candidate ? { id: candidateId, status: String(candidate.row[10] || ''),
    draftStatus: String(candidate.row[12] || ''), headword: String(candidate.row[16] || ''),
    partOfSpeech: String(candidate.row[17] || ''), inflections: String(candidate.row[18] || ''),
    translation: String(candidate.row[19] || ''), description: String(candidate.row[20] || ''),
    category: String(candidate.row[21] || ''), similar: String(candidate.row[22] || ''),
    notes: String(candidate.row[23] || ''), review: String(candidate.row[26] || ''),
    ...candidateWizardDraftDetails(candidate.row[13]) } : null;
  if (draftCandidate) draftCandidate.suggestedBody = candidateWizardSuggestedBody(draftCandidate);
  const notes = spreadsheet.getSheetByName(EXPERIMENTAL_NOTES_SHEET_NAME);
  const existingHeading = draftCandidate && notes && readSheetRows(notes, 1).some(row =>
    normalizeObservedTerm(row[0]) === normalizeObservedTerm(draftCandidate.headword));
  if (draftCandidate) draftCandidate.canReopen =
    draftCandidate.status === 'Notes反映済み' && !existingHeading;
  const props = PropertiesService.getScriptProperties();
  return {
    observation: { id, term: String(observation[1] || ''), normalized: String(observation[2] || ''),
      page: String(observation[6] || ''), count: Number(observation[5]) || 0,
      results: Number(observation[7]) || 0, status: String(observation[8] || '') },
    context: jevCandidateContext(spreadsheet, observation),
    review: review ? { id: String(review.row[0] || ''), category: String(review.row[6] || ''),
      headword: String(review.row[7] || ''), confidence: Number(review.row[9]) || 0,
      candidates: String(review.row[11] || ''), decision: String(review.row[12] || ''),
      memo: String(review.row[13] || '') } : null,
    candidate: draftCandidate,
    jevReady: Boolean(String(props.getProperty('TYPESAFE_API_KEY') || '').trim()),
    draftReady: Boolean(String(props.getProperty('OPENAI_API_KEY') || '').trim() &&
      String(props.getProperty('OPENAI_DRAFT_MODEL') || '').trim()),
    draftModel: String(props.getProperty('OPENAI_DRAFT_MODEL') || '').trim()
  };
}

function candidateWizardRunJev(id, confirmed) {
  if (confirmed !== true) throw new Error('Jevの課金確認が必要です．');
  const found = candidateWizardFindObservation(id);
  createJevReviewForObservation(found.rowNumber, id, true);
  return candidateWizardState(id);
}

function candidateWizardSafeText(value, label, max, required) {
  const result = String(value == null ? '' : value).normalize('NFC').trim();
  if ((required && !result) || result.length > max || /[\u0000-\u0008\u000b\u000e-\u001f]/.test(result) ||
      /^[=+@-]/.test(result)) throw new Error(label + 'を確認してください．');
  return result.replace(/。/g, '．').replace(/、/g, '，');
}

function candidateWizardSaveReview(id, decision, category, headword, memo) {
  if (['採用', '保留', '却下'].indexOf(decision) === -1) throw new Error('採否が不正です．');
  if (Object.keys(JEV_CANDIDATE_CATEGORIES).indexOf(category) === -1) throw new Error('分類が不正です．');
  if (decision === '採用' && category === 'UNCERTAIN') {
    throw new Error('判断保留の分類は採用できません．分類を選び直してください．');
  }
  const safeMemo = candidateWizardSafeText(memo, '確認メモ', 500, false);
  const safeHeadword = category === 'NEW_TERM_CANDIDATE' || category === 'UNCERTAIN' ? '' :
    candidateWizardSafeText(headword, '対応見出し', 120, true);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('判定の更新ロックを取得できませんでした．');
  try {
    const found = candidateWizardFindObservation(id);
    if (found.row[8] === '候補移送済み') throw new Error('移送済みの判定は変更できません．');
    const sheet = requireSheetWithHeaders(found.spreadsheet, JEV_REVIEW_SHEET_NAME, JEV_REVIEW_HEADERS);
    const linked = candidateWizardFindLinked(sheet, JEV_REVIEW_HEADERS.length, found.row[9]);
    if (!linked) throw new Error('Jev判定が見つかりません．');
    if (safeHeadword) {
      const notes = found.spreadsheet.getSheetByName(EXPERIMENTAL_NOTES_SHEET_NAME);
      if (!notes || !readSheetRows(notes, 1).some(row =>
          normalizeObservedTerm(row[0]) === normalizeObservedTerm(safeHeadword))) {
        throw new Error('対応見出しがNotesにありません．');
      }
    }
    const row = linked.row;
    const original = String(row[6] || '');
    const originalHeadword = String(row[7] || '');
    row[6] = category;
    row[7] = safeHeadword;
    row[8] = safeHeadword ? 'term-' + normalizeObservedTerm(safeHeadword)
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '';
    row[12] = decision;
    if (original !== category) row[9] = '';
    if (originalHeadword !== safeHeadword) row[10] = '';
    row[13] = (original !== category ? '人が分類を変更（Jev：' + original + '）．' : '') + safeMemo;
    sheet.getRange(linked.rowNumber, 1, 1, JEV_REVIEW_HEADERS.length).setValues([row]);
  } finally { lock.releaseLock(); }
  return candidateWizardState(id);
}

function candidateWizardPromote(id, confirmed) {
  if (confirmed !== true) throw new Error('候補移送の確認が必要です．');
  const found = candidateWizardFindObservation(id);
  if (!found.row[9]) throw new Error('Jev判定がありません．');
  const result = promoteApprovedDictionaryCandidateByReviewId(String(found.row[9]));
  return { result, state: candidateWizardState(id) };
}

function candidateWizardReopenExperimental(id, confirmed) {
  if (confirmed !== true) throw new Error('再開の確認が必要です．');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('実験再開のロックを取得できませんでした．');
  try {
    const found = candidateWizardFindObservation(id);
    const sheet = requireSheetWithHeaders(found.spreadsheet,
      UNREGISTERED_TERM_CANDIDATE_SHEET_NAME, UNREGISTERED_TERM_CANDIDATE_HEADERS);
    const candidateId = dictionaryCandidateRecordId('candidate', normalizeObservedTerm(found.row[2] || found.row[1]));
    const linked = candidateWizardFindLinked(sheet, UNREGISTERED_TERM_CANDIDATE_HEADERS.length, candidateId);
    if (!linked || linked.row[10] !== 'Notes反映済み') {
      throw new Error('再開できる登録済み候補がありません．');
    }
    const notes = found.spreadsheet.getSheetByName(EXPERIMENTAL_NOTES_SHEET_NAME);
    if (!notes) throw new Error('Notesがありません．');
    if (readSheetRows(notes, 1).some(row =>
        normalizeObservedTerm(row[0]) === normalizeObservedTerm(linked.row[16]))) {
      throw new Error('同じ見出しがNotesに残っています．削除を確認してください．');
    }
    sheet.getRange(linked.rowNumber, 11).setValue('GPT草案確認中');
    sheet.getRange(linked.rowNumber, 27).setValue('未確認');
    sheet.getRange(linked.rowNumber, 28).setValue(
      String(linked.row[27] || '') + '\nNotesの見出し削除を確認し，対話画面から再開．');
  } finally { lock.releaseLock(); }
  return candidateWizardState(id);
}

function candidateWizardSourceExample(found) {
  const page = String(found.row[6] || '');
  const source = page.indexOf('RW') !== -1 ? 'RW' : page.indexOf('RS') !== -1 ? 'RS' :
    page.indexOf('GM') !== -1 ? 'GM' : '';
  const sheet = source && found.spreadsheet.getSheetByName(source);
  if (!sheet || sheet.getLastRow() < 2) return { german: '', japanese: '', source: '' };
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const normalizedColumn = headers.indexOf('de_normalized') + 1;
  const deColumn = headers.indexOf('de') + 1;
  const jaColumn = headers.indexOf('ja') + 1;
  const lookupColumn = normalizedColumn || deColumn;
  if (!lookupColumn || !deColumn) return { german: '', japanese: '', source: '' };
  const lookup = normalizedColumn ? normalizeObservedTerm(found.row[2] || found.row[1]) : String(found.row[1] || '');
  const match = sheet.getRange(2, lookupColumn, sheet.getLastRow() - 1, 1)
    .createTextFinder(lookup).matchCase(false).findNext();
  if (!match) return { german: '', japanese: '', source: '' };
  return { german: String(sheet.getRange(match.getRow(), deColumn).getValue() || '').slice(0, 500),
    japanese: jaColumn ? String(sheet.getRange(match.getRow(), jaColumn).getValue() || '').slice(0, 500) : '',
    source };
}

function candidateWizardDraftSchema() {
  const properties = {
    headword: { type: 'string' }, part_of_speech: { type: 'string' },
    inflections: { type: 'array', items: { type: 'string' } },
    general_meanings: { type: 'array', items: { type: 'string' } },
    english_equivalents: { type: 'array', items: { type: 'string' } },
    italian_equivalents: { type: 'array', items: { type: 'string' } },
    music_examples: { type: 'array', items: { type: 'string' } },
    category: { type: 'string' },
    similar_terms: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' },
    uncertainties: { type: 'array', items: { type: 'string' } }
  };
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

function candidateWizardCreateDraft(id, confirmed) {
  if (confirmed !== true) throw new Error('OpenAI APIの課金確認が必要です．');
  const found = candidateWizardFindObservation(id);
  const sheet = requireSheetWithHeaders(found.spreadsheet,
    UNREGISTERED_TERM_CANDIDATE_SHEET_NAME, UNREGISTERED_TERM_CANDIDATE_HEADERS);
  const candidateId = dictionaryCandidateRecordId('candidate', normalizeObservedTerm(found.row[2] || found.row[1]));
  const linked = candidateWizardFindLinked(sheet, UNREGISTERED_TERM_CANDIDATE_HEADERS.length, candidateId);
  if (!linked || linked.row[7] !== 'NEW_TERM_CANDIDATE' || linked.row[10] === 'Notes反映済み') {
    throw new Error('未登録の新規用語候補を選択してください．');
  }
  if (linked.row[12] === '生成中' || linked.row[12] === '結果要確認') {
    throw new Error('前回のAPI呼出し結果を確認するまで再実行できません．');
  }
  const props = PropertiesService.getScriptProperties();
  const key = String(props.getProperty('OPENAI_API_KEY') || '').trim();
  const model = String(props.getProperty('OPENAI_DRAFT_MODEL') || '').trim();
  if (!key || !model) throw new Error('OPENAI_API_KEY または OPENAI_DRAFT_MODEL が未設定です．');
  const example = candidateWizardSourceExample(found);
  if (!example.german) throw new Error('ドイツ語の実例が取得できないため，課金前に停止しました．');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('草案の更新ロックを取得できませんでした．');
  try {
    const current = sheet.getRange(linked.rowNumber, 1, 1, UNREGISTERED_TERM_CANDIDATE_HEADERS.length).getValues()[0];
    if (current[0] !== candidateId || current[12] === '生成中' || current[12] === '結果要確認') {
      throw new Error('候補行が更新されました．APIは呼び出していません．');
    }
    sheet.getRange(linked.rowNumber, 13).setValue('生成中');
  } finally { lock.releaseLock(); }
  const request = {
    model, store: false, max_output_tokens: 1800,
    instructions: 'ドイツ語の音楽用語辞典の編集補助．実例と既存訳を踏まえ，確認用草案を作る．' +
      'general_meaningsは本質的に異なる意味だけを別要素にし，同義語は同じ要素にまとめる．' +
      'music_examplesは実例に適した訳例だけを書く．英語・イタリア語の対応語は確信できるものだけ示し，不明なら空配列にする．' +
      '格変化形や出典を推測で補わない．未確定事項はuncertaintiesに書き，本文のコメントは作らない．' +
      'part_of_speechは日本語で書く（例：女性名詞）．inflectionsの各要素は見出しとの関係や格・数を示す日本語の説明文にし，' +
      'ドイツ語の品詞名や語形だけの羅列にしない．確実な語形だけを記す．日本語句読点は「．」「，」を使う．',
    input: JSON.stringify({ search_term: found.row[1], german_example: example.german,
      japanese_example: example.japanese, corpus: example.source }),
    text: { format: { type: 'json_schema', name: 'german_music_term_draft',
      strict: true, schema: candidateWizardDraftSchema() } }
  };
  let response;
  try {
    response = UrlFetchApp.fetch(CANDIDATE_WIZARD_OPENAI_URL, {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + key },
      payload: JSON.stringify(request), muteHttpExceptions: true
    });
  } catch (_) {
    sheet.getRange(linked.rowNumber, 13).setValue('結果要確認');
    throw new Error('OpenAI APIの呼出し結果を確認できません．利用状況を確認するまで再実行しないでください．');
  }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    sheet.getRange(linked.rowNumber, 13).setValue('結果要確認');
    throw new Error('OpenAI APIがHTTP ' + response.getResponseCode() + 'を返しました．利用状況を確認してください．');
  }
  let draft;
  try {
    const data = JSON.parse(response.getContentText());
    if (data.status !== 'completed') throw new Error('完了していません．');
    const text = (data.output || []).flatMap(item => item.content || [])
      .filter(part => part.type === 'output_text').map(part => part.text).join('');
    draft = JSON.parse(text);
    candidateWizardSafeText(draft.headword, '見出し', 120, true);
    if (!Array.isArray(draft.general_meanings) || draft.general_meanings.length === 0) {
      throw new Error('一般的な意味がありません．');
    }
  } catch (_) {
    sheet.getRange(linked.rowNumber, 13).setValue('結果要確認');
    throw new Error('API応答から草案を確認できません．利用状況を確認するまで再実行しないでください．');
  }
  const fields = {
    headword: draft.headword, partOfSpeech: draft.part_of_speech,
    inflections: '',
    translation: draft.general_meanings.join('\n'), description: '', category: draft.category,
    similar: Array.isArray(draft.similar_terms) ? draft.similar_terms.join('，') : '',
    notes: [draft.notes, ...(Array.isArray(draft.uncertainties) ? draft.uncertainties : [])]
      .filter(Boolean).join('／'),
    english: draft.english_equivalents.join('，'), italian: draft.italian_equivalents.join('，'),
    musicExamples: draft.music_examples.join('\n'), comment: ''
  };
  try {
    fields.inflections = candidateWizardFormatInflections(draft.inflections);
    candidateWizardSaveDraft(id, fields, 'OpenAI API：' + model, JSON.stringify(draft));
  } catch (_) {
    sheet.getRange(linked.rowNumber, 13, 1, 2).setValues([['結果要確認', JSON.stringify(draft)]]);
    throw new Error('草案のセル反映に失敗しました．API応答はN列に保存しました．内容を確認してください．');
  }
  sheet.getRange(linked.rowNumber, 25, 1, 2).setValues([[new Date(), model]]);
  return candidateWizardState(id);
}

function candidateWizardSaveDraft(id, fields, provenance, raw) {
  const found = candidateWizardFindObservation(id);
  const sheet = requireSheetWithHeaders(found.spreadsheet,
    UNREGISTERED_TERM_CANDIDATE_SHEET_NAME, UNREGISTERED_TERM_CANDIDATE_HEADERS);
  const candidateId = dictionaryCandidateRecordId('candidate', normalizeObservedTerm(found.row[2] || found.row[1]));
  const linked = candidateWizardFindLinked(sheet, UNREGISTERED_TERM_CANDIDATE_HEADERS.length, candidateId);
  if (!linked || linked.row[7] !== 'NEW_TERM_CANDIDATE' || linked.row[10] === 'Notes反映済み') {
    throw new Error('編集可能な新規用語候補がありません．');
  }
  const names = ['headword', 'partOfSpeech', 'inflections', 'translation', 'description',
    'category', 'similar', 'notes'];
  const maxima = [120, 100, 500, 500, 2000, 120, 500, 1200];
  const values = names.map((name, i) => candidateWizardSafeText(fields && fields[name],
    name, maxima[i], name === 'headword' || name === 'translation'));
  candidateWizardValidateMorphology(values[1], values[2]);
  const details = {
    english: candidateWizardSafeText(fields && fields.english, '英語の類語', 500, false),
    italian: candidateWizardSafeText(fields && fields.italian, 'イタリア語の類語', 500, false),
    musicExamples: candidateWizardSafeText(fields && fields.musicExamples, '音楽用語としての訳例', 1500, false),
    comment: candidateWizardSafeText(fields && fields.comment, '任意のコメント', 1200, false)
  };
  if (/[\r\n]/.test(values[0])) throw new Error('見出しは1行で入力してください．');
  const notes = found.spreadsheet.getSheetByName(EXPERIMENTAL_NOTES_SHEET_NAME);
  if (!notes) throw new Error('Notesがありません．');
  if (readSheetRows(notes, 1).some(row => normalizeObservedTerm(row[0]) === normalizeObservedTerm(values[0]))) {
    throw new Error('同じ見出しがNotesにあります．');
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('草案の更新ロックを取得できませんでした．');
  try {
    const current = sheet.getRange(linked.rowNumber, 1, 1, UNREGISTERED_TERM_CANDIDATE_HEADERS.length).getValues()[0];
    if (current[0] !== candidateId || current[10] === 'Notes反映済み') {
      throw new Error('候補行が更新されました．');
    }
    sheet.getRange(linked.rowNumber, 17, 1, 8).setValues([values]);
    sheet.getRange(linked.rowNumber, 11).setValue('GPT草案確認中');
    sheet.getRange(linked.rowNumber, 13, 1, 2).setValues([[
      '作成済み', raw || JSON.stringify({ ...Object.fromEntries(names.map((name, i) => [name, values[i]])),
        ...details })
    ]]);
    sheet.getRange(linked.rowNumber, 27).setValue('未確認');
    sheet.getRange(linked.rowNumber, 12).setValue(
      candidateWizardSafeText(provenance || 'ダイアログで手動編集．API未使用．', '作成経路', 250, true));
  } finally { lock.releaseLock(); }
  return candidateWizardState(id);
}

function candidateWizardValidateMorphology(partOfSpeech, inflections) {
  const hasJapanese = value => /[\u3040-\u30ff\u3400-\u9fff]/.test(String(value || ''));
  if (partOfSpeech && !hasJapanese(partOfSpeech)) {
    throw new Error('品詞は日本語で記述してください（例：女性名詞）．');
  }
  if (inflections && !hasJapanese(inflections)) {
    throw new Error('語形・格変化は日本語の説明文で記述してください（例：Seite は女性名詞の単数主格）．');
  }
}

function candidateWizardFormatInflections(items) {
  if (!Array.isArray(items)) return '';
  const descriptions = items.map(value => String(value || '').trim()).filter(Boolean);
  for (const description of descriptions) candidateWizardValidateMorphology('', description);
  return descriptions.length
    ? descriptions.map(value => value.replace(/[．。]+$/, '')).join('．') + '．' : '';
}

function candidateWizardValidateBodyMorphology(body) {
  const lines = String(body || '').split(/\r?\n/);
  const meaningIndex = lines.findIndex(line => line.trim() === '【一般的な意味】');
  if (meaningIndex < 0) throw new Error('B列本文に【一般的な意味】がありません．');
  for (const line of lines.slice(1, meaningIndex)) {
    candidateWizardValidateMorphology('', line.trim());
  }
}

function candidateWizardSourceMarkers(spreadsheet, headword) {
  const target = normalizeObservedTerm(headword);
  if (!target) return [];
  const definitions = [
    ['RS', '[RS: Oper]'],
    ['RW', '[RW: Oper]'],
    ['GM', '[GM]']
  ];
  const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp('(^|[^a-z0-9])' + escapeRegExp(target) + '($|[^a-z0-9])', 'i');
  return definitions.filter(([sheetName]) => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return false;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const normalizedColumn = headers.indexOf('de_normalized') + 1;
    const deColumn = headers.indexOf('de') + 1;
    const column = normalizedColumn || deColumn;
    if (!column) return false;
    const values = sheet.getRange(2, column, sheet.getLastRow() - 1, 1).getValues();
    return values.some(row => pattern.test(normalizeObservedTerm(row[0])));
  }).map(([, marker]) => marker);
}

function candidateWizardSuggestedBody(candidate) {
  const meanings = String(candidate.translation || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const numbers = '①②③④⑤⑥⑦⑧⑨⑩';
  if (meanings.length > numbers.length) throw new Error('一般的な意味は10項目以内にしてください．');
  const numbered = meanings.map((line, i) => numbers[i] + ' ' +
    line.replace(/^[①-⑩]\s*/, '').replace(/[．。]+$/, '') + '．').join('\n');
  const music = String(candidate.musicExamples || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean)
    .map(x => '「' + x.replace(/^[「」]+|[「」]+$/g, '').replace(/[．。]+$/, '') + '」').join('，');
  const partOfSpeech = String(candidate.partOfSpeech || '').trim().replace(/[．。]+$/, '');
  const inflections = String(candidate.inflections || '').trim().replace(/[．。]+$/, '');
  const morphology = (inflections && partOfSpeech && inflections.includes(partOfSpeech)
    ? inflections : [partOfSpeech, inflections].filter(Boolean).join('．'));
  return '(≒ ' + candidate.english + ' / ' + candidate.italian + ')' +
    (morphology ? '\n' + morphology + '．' : '') +
    '\n【一般的な意味】\n' + numbered +
    '\n【音楽用語としての訳例】\n' + music +
    (candidate.comment ? '\n\n' + candidate.comment : '');
}

function candidateWizardRegisterExperimental(id, body, source, confirmed) {
  if (confirmed !== true) throw new Error('Notesへの登録確認が必要です．');
  const safeBody = candidateWizardSafeText(body, 'B列本文', 6000, true);
  const found = candidateWizardFindObservation(id);
  const sheet = requireSheetWithHeaders(found.spreadsheet,
    UNREGISTERED_TERM_CANDIDATE_SHEET_NAME, UNREGISTERED_TERM_CANDIDATE_HEADERS);
  const candidateId = dictionaryCandidateRecordId('candidate', normalizeObservedTerm(found.row[2] || found.row[1]));
  const linked = candidateWizardFindLinked(sheet, UNREGISTERED_TERM_CANDIDATE_HEADERS.length, candidateId);
  if (!linked || !linked.row[16] || !linked.row[19] || linked.row[10] === 'Notes反映済み') {
    throw new Error('登録できる確認済み草案がありません．');
  }
  const notes = found.spreadsheet.getSheetByName(EXPERIMENTAL_NOTES_SHEET_NAME);
  if (!notes) throw new Error('Notesがありません．');
  const headword = candidateWizardSafeText(linked.row[16], '見出し', 120, true);
  const sourceMarkers = candidateWizardSourceMarkers(found.spreadsheet, headword);
  if (!sourceMarkers.length) throw new Error('RS・RW・GMの実例から出典を確認できませんでした．登録を中止しました．');
  const safeSource = sourceMarkers.join(', ');
  const details = candidateWizardDraftDetails(linked.row[13]);
  if (!details.english || !details.italian || !details.musicExamples) {
    throw new Error('英語・イタリア語の類語と音楽用語としての訳例を確認してください．');
  }
  for (const heading of ['【一般的な意味】', '【音楽用語としての訳例】']) {
    if (!safeBody.includes(heading)) throw new Error('B列本文に' + heading + 'がありません．');
  }
  if (!safeBody.startsWith('(≒ ') || !/[①-⑩]/.test(safeBody) || !/「[^」]+」/.test(safeBody)) {
    throw new Error('B列本文の類語・番号付きの意味・音楽用語としての訳例を確認してください．');
  }
  candidateWizardValidateBodyMorphology(safeBody);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('辞書の更新ロックを取得できませんでした．');
  try {
    if (readSheetRows(notes, 1).some(row => normalizeObservedTerm(row[0]) === normalizeObservedTerm(headword))) {
      throw new Error('同じ見出しが既にあります．登録しません．');
    }
    const headings = readSheetRows(notes, 1);
    const insertionIndex = headings.findIndex(row =>
      headword.localeCompare(String(row[0] || ''), 'de', { sensitivity: 'base' }) < 0);
    const rowNumber = insertionIndex < 0 ? notes.getLastRow() + 1 : insertionIndex + 2;
    if (insertionIndex < 0) notes.getRange(rowNumber, 1, 1, 3).setValues([[headword, safeBody, safeSource]]);
    else {
      notes.insertRowBefore(rowNumber);
      notes.getRange(rowNumber, 1, 1, 3).setValues([[headword, safeBody, safeSource]]);
    }
    sheet.getRange(linked.rowNumber, 11).setValue('Notes反映済み');
    sheet.getRange(linked.rowNumber, 27, 1, 2).setValues([['確認済み',
      'ユーザーがダイアログで本文を確認．' + EXPERIMENTAL_NOTES_SHEET_NAME + '!A' + rowNumber + ':C' + rowNumber + ' に反映．']]);
    return { headword, rowNumber, state: candidateWizardState(id) };
  } finally { lock.releaseLock(); }
}

function showDictionaryCandidateWizard() {
  const html = HtmlService.createHtmlOutputFromFile('dictionary_candidate_dialog')
    .setWidth(700).setHeight(680);
  SpreadsheetApp.getUi().showModalDialog(html, '未登録語の確認');
}
