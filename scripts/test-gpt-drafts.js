const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src', 'gpt_drafts.js'), 'utf8');
const menuSource = fs.readFileSync(path.join(root, 'src', 'setup_credentials.js'), 'utf8');
const headers = [
  '候補ID', '検索語', '正規化語形', '初回検索日時', '最終検索日時',
  '検索回数', '検索ページ', 'Jev判定', '分類確信度', '類似する既存語候補',
  '状態', '管理者メモ', 'GPT草案状態', 'GPT草案', '元判定ID', '更新日時',
  '草案基本形', '草案品詞', '草案語形・変化形', '草案訳語', '草案説明', '草案分類',
  '草案類似語', '草案備考', 'GPT生成日時', 'GPTモデル', '草案確認', '草案修正メモ'
];
const context = {
  console,
  JSON,
  Object,
  String,
  Boolean,
  Number,
  Error,
  Date,
  Array,
  UNREGISTERED_TERM_CANDIDATE_HEADERS: headers,
  UNREGISTERED_TERM_CANDIDATE_SHEET_NAME: '未登録語候補_正規化テスト'
};
vm.createContext(context);
vm.runInContext(source + `\nthis.testExports = {
  normalizeJapaneseDraftPunctuation,
  sanitizeGptDraftErrorMessage,
  buildGptDraftRequest,
  extractOpenAiResponseText,
  validateAndNormalizeGptDraft,
  parseGptDraftResponse,
  safeOpenAiErrorMessage,
  callOpenAiDraftApi,
  validateGptDraftCandidateRow,
  buildGptDraftCompletedRow
};`, context);

const api = context.testExports;
const candidate = {
  searchTerm: 'zartfließend',
  normalizedTerm: 'zartfliessend',
  jevClassification: 'NEW_TERM_CANDIDATE',
  confidence: 0.89,
  similarCandidates: 'zart fließend',
  adminMemo: '譜例を確認する。'
};
const request = JSON.parse(JSON.stringify(api.buildGptDraftRequest(candidate, 'configured-model')));
assert.strictEqual(request.model, 'configured-model');
assert.strictEqual(request.store, false);
assert.strictEqual(request.text.format.type, 'json_schema');
assert.strictEqual(request.text.format.strict, true);
assert.strictEqual(request.text.format.schema.additionalProperties, false);
assert.ok(request.input[1].content.includes('zartfließend'));
assert.strictEqual(JSON.stringify(request).includes('OPENAI_API_KEY'), false);
assert.strictEqual(JSON.stringify(request).includes('Bearer '), false);

const rawDraft = {
  headword: 'zartfließend',
  part_of_speech: '形容詞。副詞的にも用いる',
  inflections: ['zart fließend'],
  translation: 'やさしく、流れるように。',
  description: '音楽の流れを保つ。',
  category: '発想標語',
  similar_terms: ['zart', 'fließend'],
  notes: '綴りを確認する。',
  uncertainties: ['用例数が少ない。']
};
const parsed = api.parseGptDraftResponse({
  output: [{ content: [{ type: 'output_text', text: JSON.stringify(rawDraft) }] }]
});
assert.strictEqual(parsed.translation, 'やさしく，流れるように．');
assert.strictEqual(parsed.description, '音楽の流れを保つ．');
assert.strictEqual(api.extractOpenAiResponseText({ output_text: '{"ok":true}' }), '{"ok":true}');
assert.throws(() => api.validateAndNormalizeGptDraft({}), /headword/);
assert.throws(() => api.extractOpenAiResponseText({ output: [] }), /草案本文/);
assert.strictEqual(
  api.safeOpenAiErrorMessage(400, JSON.stringify({ error: { message: '入力が不正です。' } })),
  'OpenAI APIエラー（400）：入力が不正です．'
);
assert.strictEqual(
  api.sanitizeGptDraftErrorMessage(new Error('失敗 Bearer secret-token sk-abcdefgh12345678。')),
  '失敗 Bearer [REDACTED] [REDACTED]．'
);

let failedFetchCount = 0;
const retrySleeps = [];
context.UrlFetchApp = {
  fetch: () => {
    failedFetchCount += 1;
    throw new Error('network timeout');
  }
};
context.Utilities = { sleep: milliseconds => retrySleeps.push(milliseconds) };
assert.throws(
  () => api.callOpenAiDraftApi(candidate, { model: 'configured-model', apiKey: 'test-api-key' }),
  /network timeout/
);
assert.strictEqual(failedFetchCount, 3);
assert.deepStrictEqual(retrySleeps, [1000, 2000]);

const row = new Array(headers.length).fill('');
row[0] = 'candidate-1';
row[1] = 'zartfließend';
row[2] = 'zartfliessend';
row[7] = 'NEW_TERM_CANDIDATE';
row[10] = 'GPT草案待ち';
row[12] = '未作成';
row[26] = '未確認';
api.validateGptDraftCandidateRow(row);
const now = new Date('2026-09-22T00:00:00Z');
const completed = api.buildGptDraftCompletedRow(row, parsed, 'configured-model', now);
assert.strictEqual(completed.length, 28);
assert.strictEqual(completed[10], 'GPT草案確認中');
assert.strictEqual(completed[12], '作成済み');
assert.strictEqual(completed[16], 'zartfließend');
assert.strictEqual(completed[19], 'やさしく，流れるように．');
assert.strictEqual(completed[23], '綴りを確認する．／要確認：用例数が少ない．');
assert.strictEqual(completed[25], 'configured-model');
assert.strictEqual(completed[26], '未確認');

const rejected = row.slice();
rejected[10] = '登録済み';
assert.throws(() => api.validateGptDraftCandidateRow(rejected), /登録済み/);
const approved = row.slice();
approved[26] = '承認';
assert.throws(() => api.validateGptDraftCandidateRow(approved), /承認済み/);

assert.ok(menuSource.includes("createMenu('📝 GPT草案')"));
assert.ok(menuSource.includes("addItem('選択行の草案を作成', 'generateGptDraftForActiveCandidate')"));
assert.strictEqual(source.includes("getSheetByName('Notes')"), false);
assert.strictEqual(source.includes("appendRow"), false);

console.log('GPT草案作成のテストに成功しました。');
