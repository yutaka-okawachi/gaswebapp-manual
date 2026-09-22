/**
 * 未登録語候補のGPT草案作成。
 *
 * APIキーとモデル名はScript PropertiesのOPENAI_API_KEY，
 * OPENAI_DRAFT_MODELに保存し，スプレッドシートやログへは出力しない。
 * この処理は実験用候補タブだけを更新し，本番Notesには書き込まない。
 */

const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
const GPT_DRAFT_PROPERTY_NAMES = Object.freeze({
  apiKey: 'OPENAI_API_KEY',
  model: 'OPENAI_DRAFT_MODEL'
});
const GPT_DRAFT_COLUMNS = Object.freeze({
  candidateId: 0,
  searchTerm: 1,
  normalizedTerm: 2,
  jevClassification: 7,
  confidence: 8,
  similarCandidates: 9,
  status: 10,
  adminMemo: 11,
  generationStatus: 12,
  rawDraft: 13,
  updatedAt: 15,
  headword: 16,
  partOfSpeech: 17,
  inflections: 18,
  translation: 19,
  description: 20,
  category: 21,
  similarTerms: 22,
  notes: 23,
  generatedAt: 24,
  model: 25,
  review: 26,
  reviewMemo: 27
});

function normalizeJapaneseDraftPunctuation(value) {
  return String(value == null ? '' : value).replace(/。/g, '．').replace(/、/g, '，');
}

function sanitizeGptDraftErrorMessage(error) {
  return normalizeJapaneseDraftPunctuation(
    String(error && error.message || error || '草案生成に失敗しました．')
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[REDACTED]')
      .replace(/\s+/g, ' ')
      .trim()
  ).slice(0, 500);
}

function buildGptDraftJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      headword: { type: 'string' },
      part_of_speech: { type: 'string' },
      inflections: { type: 'array', items: { type: 'string' } },
      translation: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string' },
      similar_terms: { type: 'array', items: { type: 'string' } },
      notes: { type: 'string' },
      uncertainties: { type: 'array', items: { type: 'string' } }
    },
    required: [
      'headword', 'part_of_speech', 'inflections', 'translation', 'description',
      'category', 'similar_terms', 'notes', 'uncertainties'
    ]
  };
}

function buildGptDraftRequest(candidate, model) {
  const source = {
    search_term: String(candidate.searchTerm || '').slice(0, 120),
    normalized_term: String(candidate.normalizedTerm || '').slice(0, 120),
    jev_classification: String(candidate.jevClassification || '').slice(0, 80),
    classification_confidence: candidate.confidence,
    similar_existing_candidates: String(candidate.similarCandidates || '').slice(0, 1000),
    administrator_memo: String(candidate.adminMemo || '').slice(0, 1000)
  };
  return {
    model: model,
    store: false,
    max_output_tokens: 1800,
    input: [
      {
        role: 'system',
        content:
          'あなたはドイツ語の音楽用語辞典の編集補助者です．与えられた候補について，' +
          '辞書登録前に人が確認するための草案だけを作成してください．根拠のない意味や出典を作らず，' +
          '判断できない点はuncertaintiesへ明記してください．日本語の句読点は必ず「．」「，」を使用してください．'
      },
      {
        role: 'user',
        content:
          '次の候補を検討し，指定されたJSON schemaどおりに回答してください．' +
          'headwordは登録候補となるドイツ語の基本形，inflectionsは保存すべき語形・別綴り，' +
          'translationは簡潔な日本語訳，descriptionは音楽上の用法説明です．\n' +
          JSON.stringify(source)
      }
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'german_music_term_draft',
        strict: true,
        schema: buildGptDraftJsonSchema()
      }
    }
  };
}

function extractOpenAiResponseText(response) {
  if (!response || typeof response !== 'object') throw new Error('OpenAI APIの応答形式が不正です．');
  if (response.status === 'incomplete') throw new Error('OpenAI APIの応答が途中で終了しました．');
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }

  const texts = [];
  const output = Array.isArray(response.output) ? response.output : [];
  output.forEach(item => {
    const content = Array.isArray(item && item.content) ? item.content : [];
    content.forEach(part => {
      if (part && part.type === 'refusal') throw new Error('OpenAI APIが草案生成を拒否しました．');
      if (part && part.type === 'output_text' && typeof part.text === 'string') texts.push(part.text);
    });
  });
  if (!texts.length) throw new Error('OpenAI APIの応答に草案本文がありません．');
  return texts.join('').trim();
}

function assertGptDraftString(value, name, maxLength, required) {
  if (typeof value !== 'string') throw new Error(name + 'が文字列ではありません．');
  if (required && !value.trim()) throw new Error(name + 'が空です．');
  if (value.length > maxLength) throw new Error(name + 'が長すぎます．');
}

function assertGptDraftStringArray(value, name, maxItems, maxItemLength) {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(name + 'の形式が不正です．');
  value.forEach(item => assertGptDraftString(item, name, maxItemLength, false));
}

function validateAndNormalizeGptDraft(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    throw new Error('GPT草案のJSON形式が不正です．');
  }
  assertGptDraftString(draft.headword, 'headword', 120, true);
  assertGptDraftString(draft.part_of_speech, 'part_of_speech', 80, false);
  assertGptDraftStringArray(draft.inflections, 'inflections', 20, 120);
  assertGptDraftString(draft.translation, 'translation', 500, true);
  assertGptDraftString(draft.description, 'description', 2000, false);
  assertGptDraftString(draft.category, 'category', 120, false);
  assertGptDraftStringArray(draft.similar_terms, 'similar_terms', 20, 120);
  assertGptDraftString(draft.notes, 'notes', 1000, false);
  assertGptDraftStringArray(draft.uncertainties, 'uncertainties', 20, 300);

  return {
    headword: draft.headword.trim(),
    part_of_speech: normalizeJapaneseDraftPunctuation(draft.part_of_speech.trim()),
    inflections: draft.inflections.map(item => item.trim()).filter(Boolean),
    translation: normalizeJapaneseDraftPunctuation(draft.translation.trim()),
    description: normalizeJapaneseDraftPunctuation(draft.description.trim()),
    category: normalizeJapaneseDraftPunctuation(draft.category.trim()),
    similar_terms: draft.similar_terms.map(item => item.trim()).filter(Boolean),
    notes: normalizeJapaneseDraftPunctuation(draft.notes.trim()),
    uncertainties: draft.uncertainties
      .map(item => normalizeJapaneseDraftPunctuation(item.trim()))
      .filter(Boolean)
  };
}

function parseGptDraftResponse(response) {
  let parsed;
  try {
    parsed = JSON.parse(extractOpenAiResponseText(response));
  } catch (error) {
    if (error && /OpenAI API/.test(error.message || '')) throw error;
    throw new Error('GPT草案のJSONを解析できませんでした．');
  }
  return validateAndNormalizeGptDraft(parsed);
}

function getGptDraftSettings() {
  const properties = PropertiesService.getScriptProperties();
  const apiKey = String(properties.getProperty(GPT_DRAFT_PROPERTY_NAMES.apiKey) || '').trim();
  const model = String(properties.getProperty(GPT_DRAFT_PROPERTY_NAMES.model) || '').trim();
  if (!apiKey) throw new Error('Script PropertiesにOPENAI_API_KEYが設定されていません．');
  if (!model) throw new Error('Script PropertiesにOPENAI_DRAFT_MODELが設定されていません．');
  return { apiKey: apiKey, model: model };
}

function safeOpenAiErrorMessage(responseCode, responseText) {
  let detail = '';
  try {
    const parsed = JSON.parse(responseText || '{}');
    detail = parsed && parsed.error && parsed.error.message ? String(parsed.error.message) : '';
  } catch (_error) {
    detail = '';
  }
  detail = sanitizeGptDraftErrorMessage(detail).slice(0, 300);
  return 'OpenAI APIエラー（' + responseCode + '）' + (detail ? '：' + detail : '．');
}

function callOpenAiDraftApi(candidate, settings) {
  const request = buildGptDraftRequest(candidate, settings.model);
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response;
    try {
      response = UrlFetchApp.fetch(OPENAI_RESPONSES_API_URL, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + settings.apiKey },
        payload: JSON.stringify(request),
        muteHttpExceptions: true
      });
    } catch (error) {
      lastError = error;
      if (attempt < 3) Utilities.sleep(attempt * 1000);
      continue;
    }

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    if (responseCode >= 200 && responseCode < 300) {
      let responseObject;
      try {
        responseObject = JSON.parse(responseText);
      } catch (_error) {
        throw new Error('OpenAI APIの応答JSONを解析できませんでした．');
      }
      return parseGptDraftResponse(responseObject);
    }
    lastError = new Error(safeOpenAiErrorMessage(responseCode, responseText));
    const retryable = responseCode === 429 || (responseCode >= 500 && responseCode < 600);
    if (!retryable) throw lastError;
    if (attempt < 3) Utilities.sleep(attempt * 1000);
  }
  throw lastError || new Error('OpenAI APIの呼出しに失敗しました．');
}

function gptDraftCandidateFromRow(row) {
  return {
    candidateId: String(row[GPT_DRAFT_COLUMNS.candidateId] || ''),
    searchTerm: String(row[GPT_DRAFT_COLUMNS.searchTerm] || ''),
    normalizedTerm: String(row[GPT_DRAFT_COLUMNS.normalizedTerm] || ''),
    jevClassification: String(row[GPT_DRAFT_COLUMNS.jevClassification] || ''),
    confidence: row[GPT_DRAFT_COLUMNS.confidence],
    similarCandidates: String(row[GPT_DRAFT_COLUMNS.similarCandidates] || ''),
    adminMemo: String(row[GPT_DRAFT_COLUMNS.adminMemo] || '')
  };
}

function validateGptDraftCandidateRow(row) {
  if (!row || row.length < UNREGISTERED_TERM_CANDIDATE_HEADERS.length) {
    throw new Error('候補行の列構成が一致しません．');
  }
  if (!String(row[GPT_DRAFT_COLUMNS.candidateId] || '').trim()) throw new Error('候補IDがありません．');
  if (row[GPT_DRAFT_COLUMNS.jevClassification] !== 'NEW_TERM_CANDIDATE') {
    throw new Error('Jev判定がNEW_TERM_CANDIDATEの行だけを処理できます．');
  }
  if (['登録済み', '見送り'].indexOf(row[GPT_DRAFT_COLUMNS.status]) !== -1) {
    throw new Error('登録済みまたは見送りの候補は処理できません．');
  }
  const requested = row[GPT_DRAFT_COLUMNS.status] === 'GPT草案待ち' ||
    ['作成待ち', '再作成待ち'].indexOf(row[GPT_DRAFT_COLUMNS.generationStatus]) !== -1 ||
    row[GPT_DRAFT_COLUMNS.review] === '再生成';
  if (!requested) throw new Error('状態を「GPT草案待ち」にしてから実行してください．');
  if (row[GPT_DRAFT_COLUMNS.review] === '承認') {
    throw new Error('承認済み草案は上書きできません．再生成する場合は草案確認を「再生成」に変更してください．');
  }
}

function buildGptDraftCompletedRow(row, draft, model, now) {
  const result = row.slice();
  const noteParts = [];
  if (draft.notes) noteParts.push(draft.notes);
  if (draft.uncertainties.length) noteParts.push('要確認：' + draft.uncertainties.join('，'));
  result[GPT_DRAFT_COLUMNS.status] = 'GPT草案確認中';
  result[GPT_DRAFT_COLUMNS.generationStatus] = '作成済み';
  result[GPT_DRAFT_COLUMNS.rawDraft] = JSON.stringify(draft, null, 2);
  result[GPT_DRAFT_COLUMNS.updatedAt] = now;
  result[GPT_DRAFT_COLUMNS.headword] = draft.headword;
  result[GPT_DRAFT_COLUMNS.partOfSpeech] = draft.part_of_speech;
  result[GPT_DRAFT_COLUMNS.inflections] = draft.inflections.join('，');
  result[GPT_DRAFT_COLUMNS.translation] = draft.translation;
  result[GPT_DRAFT_COLUMNS.description] = draft.description;
  result[GPT_DRAFT_COLUMNS.category] = draft.category;
  result[GPT_DRAFT_COLUMNS.similarTerms] = draft.similar_terms.join('，');
  result[GPT_DRAFT_COLUMNS.notes] = noteParts.join('／');
  result[GPT_DRAFT_COLUMNS.generatedAt] = now;
  result[GPT_DRAFT_COLUMNS.model] = model;
  result[GPT_DRAFT_COLUMNS.review] = '未確認';
  result[GPT_DRAFT_COLUMNS.reviewMemo] = '';
  return result;
}

function withGptDraftLock(callback) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('GPT草案の更新ロックを取得できませんでした．');
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function markGptDraftFailure(sheet, rowNumber, candidateId, error) {
  withGptDraftLock(() => {
    const row = sheet.getRange(rowNumber, 1, 1, UNREGISTERED_TERM_CANDIDATE_HEADERS.length).getValues()[0];
    if (String(row[GPT_DRAFT_COLUMNS.candidateId] || '') !== candidateId) return;
    row[GPT_DRAFT_COLUMNS.generationStatus] = '失敗';
    row[GPT_DRAFT_COLUMNS.updatedAt] = new Date();
    row[GPT_DRAFT_COLUMNS.reviewMemo] = sanitizeGptDraftErrorMessage(error);
    sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  });
}

function generateGptDraftForCandidateRow(rowNumber) {
  const settings = getGptDraftSettings();
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = requireSheetWithHeaders(
    spreadsheet,
    UNREGISTERED_TERM_CANDIDATE_SHEET_NAME,
    UNREGISTERED_TERM_CANDIDATE_HEADERS
  );
  if (!Number.isInteger(rowNumber) || rowNumber < 2) throw new Error('候補のデータ行を選択してください．');

  let candidate;
  withGptDraftLock(() => {
    const row = sheet.getRange(rowNumber, 1, 1, UNREGISTERED_TERM_CANDIDATE_HEADERS.length).getValues()[0];
    validateGptDraftCandidateRow(row);
    candidate = gptDraftCandidateFromRow(row);
    row[GPT_DRAFT_COLUMNS.generationStatus] = '生成中';
    row[GPT_DRAFT_COLUMNS.updatedAt] = new Date();
    sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
  });

  try {
    const draft = callOpenAiDraftApi(candidate, settings);
    withGptDraftLock(() => {
      const current = sheet.getRange(rowNumber, 1, 1, UNREGISTERED_TERM_CANDIDATE_HEADERS.length).getValues()[0];
      if (String(current[GPT_DRAFT_COLUMNS.candidateId] || '') !== candidate.candidateId) {
        throw new Error('処理中に候補行が変更されたため，保存を中止しました．');
      }
      const completed = buildGptDraftCompletedRow(current, draft, settings.model, new Date());
      sheet.getRange(rowNumber, 1, 1, completed.length).setValues([completed]);
    });
    return { candidateId: candidate.candidateId, headword: draft.headword, model: settings.model };
  } catch (error) {
    markGptDraftFailure(sheet, rowNumber, candidate.candidateId, error);
    throw error;
  }
}

function generateGptDraftForActiveCandidate() {
  const ui = SpreadsheetApp.getUi();
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getActiveSheet();
    if (!sheet || sheet.getName() !== UNREGISTERED_TERM_CANDIDATE_SHEET_NAME) {
      throw new Error('「' + UNREGISTERED_TERM_CANDIDATE_SHEET_NAME + '」で候補行を選択してください．');
    }
    const activeRange = sheet.getActiveRange();
    const rowNumber = activeRange && activeRange.getRow();
    if (!rowNumber || rowNumber < 2) throw new Error('候補のデータ行を選択してください．');
    const row = sheet.getRange(rowNumber, 1, 1, UNREGISTERED_TERM_CANDIDATE_HEADERS.length).getValues()[0];
    validateGptDraftCandidateRow(row);
    if (String(row[GPT_DRAFT_COLUMNS.rawDraft] || '').trim()) {
      const response = ui.alert(
        'GPT草案の再作成',
        'この行には既存の草案があります．上書きして再作成しますか？',
        ui.ButtonSet.YES_NO
      );
      if (response !== ui.Button.YES) return;
    }
    const result = generateGptDraftForCandidateRow(rowNumber);
    ui.alert('GPT草案を作成しました', '基本形：' + result.headword + '\n内容を確認し，必要に応じて修正してください．', ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('GPT草案を作成できませんでした', sanitizeGptDraftErrorMessage(error), ui.ButtonSet.OK);
  }
}

function showGptDraftSettings() {
  const ui = SpreadsheetApp.getUi();
  const properties = PropertiesService.getScriptProperties();
  const hasApiKey = Boolean(String(properties.getProperty(GPT_DRAFT_PROPERTY_NAMES.apiKey) || '').trim());
  const model = String(properties.getProperty(GPT_DRAFT_PROPERTY_NAMES.model) || '').trim();
  ui.alert(
    'GPT草案の設定',
    'OPENAI_API_KEY：' + (hasApiKey ? '設定済み' : '未設定') + '\n' +
    'OPENAI_DRAFT_MODEL：' + (model || '未設定') + '\n\n' +
    '値はApps Scriptの「プロジェクトの設定」→「スクリプト プロパティ」で設定してください．' +
    'APIキーの値はこの画面，スプレッドシート，ログには表示しません．',
    ui.ButtonSet.OK
  );
}
