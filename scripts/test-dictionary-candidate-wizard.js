const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/dictionary_candidate_wizard.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src/dictionary_candidate_dialog.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/appsscript.json'), 'utf8'));
const context = { console, JEV_CANDIDATE_CATEGORIES: {
  INFLECTION: '', ORTHOGRAPHIC_VARIANT: '', TYPO: '', NEW_TERM_CANDIDATE: '', UNCERTAIN: ''
} };
vm.createContext(context);
vm.runInContext(source, context);

assert.throws(() => context.candidateWizardRunJev('observation-abc', false), /課金確認/);
assert.throws(() => context.candidateWizardCreateDraft('observation-abc', false), /課金確認/);
assert.throws(() => context.candidateWizardPromote('observation-abc', false), /移送の確認/);
assert.throws(() => context.candidateWizardReopenExperimental('observation-abc', false), /再開の確認/);
assert.throws(() => context.candidateWizardRegisterExperimental('observation-abc', '', '', false), /登録確認/);
assert.throws(() => context.candidateWizardSaveReview('', '採用', 'UNCERTAIN', '', ''), /判断保留/);
assert.throws(() => context.candidateWizardSafeText('=IMPORTXML("https://example.com")', '見出し', 120, true), /見出し/);
assert.strictEqual(context.candidateWizardSafeText('喧騒、騒ぎ。', '訳語', 120, true), '喧騒，騒ぎ．');
assert.strictEqual(context.candidateWizardDraftSchema().required.length, 11);
const body = context.candidateWizardSuggestedBody({ english: 'side, page', italian: 'lato, pagina',
  inflections: 'Seite は名詞の原形．', translation: '側，脇\nページ',
  musicExamples: '舞台の脇で\n楽譜の105ページ', comment: '' });
assert.ok(body.startsWith('(≒ side, page / lato, pagina)\nSeite は名詞の原形．'));
assert.ok(body.includes('① 側，脇．\n② ページ．'));
assert.ok(body.includes('【音楽用語としての訳例】\n「舞台の脇で」，「楽譜の105ページ」'));
assert.ok(!body.includes('未確認'));
const nounBody = context.candidateWizardSuggestedBody({ english: 'side', italian: 'lato',
  partOfSpeech: '女性名詞',
  inflections: 'Seite は女性名詞の単数主格（die Seite）．単数属格は der Seite，複数主格は die Seiten．',
  translation: '側', musicExamples: '一方から', comment: '' });
assert.ok(nounBody.includes('\nSeite は女性名詞の単数主格（die Seite）．単数属格は der Seite，複数主格は die Seiten．\n'));
assert.ok(!nounBody.includes('女性名詞．Seite'));
assert.throws(() => context.candidateWizardValidateMorphology('Substantiv，feminin', ''), /品詞は日本語/);
assert.throws(() => context.candidateWizardValidateMorphology('', 'die Seite，der Seite，die Seiten'), /語形・格変化/);
assert.doesNotThrow(() => context.candidateWizardValidateMorphology('女性名詞', 'Seite は女性名詞の単数主格．'));
assert.strictEqual(context.candidateWizardFormatInflections([
  'Seite は女性名詞の単数主格．', '単数属格は der Seite．', '複数主格は die Seiten．'
]), 'Seite は女性名詞の単数主格．単数属格は der Seite．複数主格は die Seiten．');
assert.throws(() => context.candidateWizardFormatInflections(['die Seite', 'der Seite']), /語形・格変化/);
assert.throws(() => context.candidateWizardValidateBodyMorphology(
  '(≒ side / lato)\nSubstantiv，feminin．die Seite，der Seite，die Seiten\n【一般的な意味】\n① 側．'), /語形・格変化/);
assert.doesNotThrow(() => context.candidateWizardValidateBodyMorphology(nounBody));
assert.strictEqual(context.candidateWizardDraftDetails(JSON.stringify({
  english: 'side', italian: 'lato', musicExamples: '舞台の脇で', comment: ''
})).italian, 'lato');
assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/script.container.ui'));

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.strictEqual(scripts.length, 1);
new vm.Script(scripts[0][1], { filename: 'dictionary_candidate_dialog.html' });
for (const label of ['Jevで判定する', 'この1件だけを移送する', 'この候補の編集を再開する',
  'OpenAI APIで草案を作る',
  '英語の類語', 'イタリア語の類語', '音楽用語としての訳例',
  'この内容でNotesに登録する']) assert.ok(html.includes(label));

assert.ok(source.includes('notes.insertRowBefore(rowNumber)'));

console.log('辞書候補ダイアログ：構文・確認ゲート OK');

function draftHarness() {
  const row = Array(28).fill('');
  row[0] = 'candidate-test'; row[7] = 'NEW_TERM_CANDIDATE'; row[10] = '候補';
  const sheet = { getRange(_row, column, _height = 1, width = 1) {
    return { getValues: () => [row.slice(column - 1, column - 1 + width)],
      setValue: value => { row[column - 1] = value; },
      setValues: values => { row.splice(column - 1, values[0].length, ...values[0]); } };
  } };
  const h = vm.createContext({ console, UNREGISTERED_TERM_CANDIDATE_SHEET_NAME: '候補',
    UNREGISTERED_TERM_CANDIDATE_HEADERS: Array(28), fetches: 0,
    normalizeObservedTerm: value => value,
    dictionaryCandidateRecordId: () => 'candidate-test',
    requireSheetWithHeaders: () => sheet,
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test-placeholder' }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    UrlFetchApp: { fetch() { h.fetches++; return h.response(); } }
  });
  vm.runInContext(source, h);
  h.candidateWizardFindObservation = () => ({ row: ['', 'vorklingend', 'vorklingend'], spreadsheet: {} });
  h.candidateWizardFindLinked = () => ({ rowNumber: 10, row: row.slice() });
  h.candidateWizardSourceExample = () => ({ german: 'vorklingend' });
  h.candidateWizardState = () => ({ observation: {}, candidate: { draftStatus: row[12] } });
  return { h, row };
}

function testDraftFailuresAndRecovery() {
  const locked = draftHarness();
  locked.h.LockService.getScriptLock = () => ({ tryLock: () => false });
  assert.throws(() => locked.h.candidateWizardCreateDraft('test', true), /更新ロック/);
  assert.strictEqual(locked.h.fetches, 0, 'lock failure occurs before the paid request');
  assert.strictEqual(locked.row[12], '');
  for (const scenario of [
    { response: () => { throw Error('sensitive transport details'); }, stage: 'transport' },
    { status: 401, body: '{"error":{"message":"sensitive provider details"}}', stage: 'http' },
    { status: 200, body: '{"status":"incomplete","incomplete_details":{"reason":"max_output_tokens"}}', stage: 'incomplete' },
    { status: 200, body: 'invalid JSON', stage: 'response' },
    { status: 200, body: '{"status":"completed","output":[]}', stage: 'response' }
  ]) {
    const { h, row } = draftHarness();
    row[13] = '{"english":"previous draft"}';
    h.response = scenario.response || (() => ({ getResponseCode: () => scenario.status,
      getContentText: () => scenario.body }));
    assert.throws(() => h.candidateWizardCreateDraft('test', true), /OpenAI/);
    assert.strictEqual(row[12], '結果要確認');
    const saved = JSON.parse(row[13]);
    assert.strictEqual(saved._draftFailure.stage, scenario.stage);
    assert.strictEqual(saved.english, 'previous draft');
    assert.ok(!row[13].includes('sensitive'));
    if (scenario.stage === 'incomplete') assert.match(h.candidateWizardDraftDetails(row[13]).draftFailure, /上限/);
    assert.throws(() => h.candidateWizardCreateDraft('test', true), /再実行できません/);
    assert.strictEqual(h.fetches, 1, 'failure must block repeated paid calls');
    const savedRaw = row[13];
    assert.throws(() => h.candidateWizardPrepareDraftRetry('test', false), /確認が必要/);
    h.candidateWizardPrepareDraftRetry('test', true);
    assert.strictEqual(row[12], '再生成待ち');
    assert.strictEqual(row[13], savedRaw, 'preparing retry must preserve previous data');
    assert.strictEqual(h.fetches, 1, 'preparing retry must not call the API');
    assert.throws(() => h.candidateWizardPrepareDraftRetry('test', true), /結果要確認/);
    row[12] = '生成中';
    assert.throws(() => h.candidateWizardPrepareDraftRetry('test', true), /結果要確認/);
    row[12] = '結果要確認'; row[10] = 'Notes反映済み';
    assert.throws(() => h.candidateWizardPrepareDraftRetry('test', true), /結果要確認/);
  }
  const draft = { headword: 'vorklingend', part_of_speech: '現在分詞', inflections: ['現在分詞．'],
    general_meanings: ['際立って響く'], english_equivalents: ['prominent'], italian_equivalents: [],
    music_examples: ['際立たせて'], category: '奏法', similar_terms: [], notes: '', uncertainties: [] };
  for (const saveFails of [false, true]) {
    const { h, row } = draftHarness();
    h.response = () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({
      status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(draft) }] }]
    }) });
    h.candidateWizardSaveDraft = (_id, fields) => {
      if (saveFails) throw Error('save failed');
      assert.strictEqual(fields.headword, draft.headword); row[12] = '作成済み';
    };
    if (saveFails) {
      assert.throws(() => h.candidateWizardCreateDraft('test', true), /N列/);
      assert.strictEqual(JSON.parse(row[13]).headword, draft.headword);
      assert.strictEqual(JSON.parse(row[13])._draftFailure.stage, 'save');
    } else assert.strictEqual(h.candidateWizardCreateDraft('test', true).candidate.draftStatus, '作成済み');
    assert.strictEqual(h.fetches, 1);
  }
}

async function testDraftDialogFeedback() {
  const elements = Object.fromEntries([...html.matchAll(/<([a-z]+)\b[^>]*\bid="([^"]+)"/g)]
    .map(([, tag, id]) => [id, { tag, value: '', textContent: '', disabled: false,
      hidden: false, style: {}, setAttribute() {}, scrollIntoView() { this.scrolled = true; },
      append(option) { if (!this.value) this.value = option.value; }, replaceChildren() { this.value = ''; } }]));
  let serverState = { observation: { id: 'test', term: 'vorklingend', status: '候補移送済み' },
    review: { category: 'NEW_TERM_CANDIDATE', decision: '採用' },
    candidate: { draftStatus: '', status: '候補', headword: '' }, draftReady: true };
  let rejectGeneration;
  let fetches = 0;
  let failState = false;
  const rpc = async name => {
    if (name === 'candidateWizardBootstrap') return [{ id: 'test', term: 'vorklingend' }];
    if (name === 'candidateWizardState') {
      if (failState) throw Error('state unavailable');
      return structuredClone(serverState);
    }
    if (name === 'candidateWizardCreateDraft') {
      fetches++;
      return new Promise((_resolve, reject) => { rejectGeneration = reject; });
    }
    throw Error('Unexpected call: ' + name);
  };
  const dom = vm.createContext({ console,
    document: { getElementById: id => elements[id], createElement: () => ({}),
      querySelectorAll: () => Object.values(elements).filter(el => ['button', 'input', 'select', 'textarea'].includes(el.tag)) },
    google: { script: { get run() {
      let success, failure;
      const runner = new Proxy({}, { get(_target, name) {
        if (name === 'withSuccessHandler') return fn => { success = fn; return runner; };
        if (name === 'withFailureHandler') return fn => { failure = fn; return runner; };
        return () => { Promise.resolve().then(() => rpc(name)).then(success, failure); };
      } });
      return runner;
    } } }
  });
  vm.runInContext(scripts[0][1], dom);
  const tick = () => new Promise(resolve => setImmediate(resolve));
  await tick();
  elements.translation.value = '未保存の入力';
  const click = elements.runDraft.onclick();
  elements.confirmYes.onclick();
  await tick();
  assert.strictEqual(elements.runDraft.disabled, true);
  assert.strictEqual(elements.observation.disabled, true);
  assert.match(elements.draftMessage.textContent, /処理中/);
  await elements.runDraft.onclick();
  assert.strictEqual(fetches, 1);
  serverState.candidate.draftStatus = '結果要確認';
  rejectGeneration(Error('OpenAI API error'));
  await click;
  assert.match(elements.draftMessage.textContent, /API error/);
  assert.strictEqual(elements.draftMessage.scrolled, true);
  assert.strictEqual(elements.runDraft.disabled, true);
  assert.strictEqual(elements.prepareDraftRetry.hidden, false);
  assert.strictEqual(elements.translation.value, '未保存の入力', 'failure refresh must retain unsaved edits');
  assert.strictEqual(elements.refreshDraft.disabled, false);
  await elements.runDraft.onclick();
  assert.strictEqual(fetches, 1);
  failState = true;
  await elements.refreshDraft.onclick();
  assert.match(elements.draftStatus.textContent, /最新の状態を取得できません/);
  assert.strictEqual(elements.prepareDraftRetry.disabled, true);
  failState = false;
  serverState.candidate = { draftStatus: '作成済み', status: 'GPT草案確認中', headword: 'vorklingend',
    translation: '際立って響く', english: 'prominent', italian: 'in rilievo', musicExamples: '際立たせて' };
  await elements.refreshDraft.onclick();
  assert.strictEqual(elements.draftHeadword.value, 'vorklingend');
  assert.strictEqual(elements.runDraft.disabled, false);
  assert.strictEqual(fetches, 1, 'status refresh must not generate');
}

testDraftFailuresAndRecovery();
testDraftDialogFeedback().then(() => console.log('草案：失敗理由保存・再課金防止・状態再取得・画面表示 OK'))
  .catch(error => { console.error(error); process.exitCode = 1; });
