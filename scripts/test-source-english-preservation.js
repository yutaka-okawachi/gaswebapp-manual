// Preserve existing HEAD entry points; no live services, data or trigger changes.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'src', name), 'utf8');
const names = fs.readdirSync(path.join(root, 'src')).filter(name => name.endsWith('.js') && !['manage_deploy.js', 'update_env.js'].includes(name));
const sources = names.map(read).join('\n');
const definitions = [...sources.matchAll(/^function\s*\*?\s+(\w+)\s*\(/gm)].map(match => match[1]);
let count = 0;
function test(name, run) { run(); count++; }
test('whole GAS project compiles', () => new vm.Script(sources));
test('whole project initializes without sheet or network access', () => {
  const context = vm.createContext({ PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'synthetic' }) } });
  vm.runInContext(sources, context);
});
test('preserved helpers do not shadow callback definitions', () => assert.deepEqual(definitions.filter((name, i) => definitions.indexOf(name) !== i), []));
test('all English function calls resolve', () => {
  const calls = [...sources.matchAll(/\b((?:notesEnglish|sourceEnglish|english[A-Z]|legacyEnglish|japaneseEnglish)\w*)\s*\(/g)].map(match => match[1]);
  assert.deepEqual([...new Set(calls)].filter(name => !definitions.includes(name)), []);
});
test('existing editor and timer callback names are retained', () => {
  for (const name of ['refreshEnglishReviewMetadataAutomatically', 'handleJapaneseEnglishMobileEdit', 'processJapaneseEnglishMobileQueue', 'englishTranslationSourceEdited',
    'notesEnglishAutomaticTick', 'reconcileNotesEnglishWorkflow', 'showEnglishTranslationReview', 'showNotesEnglishWorkflow', 'reviewJapaneseEnglishBatch',
    'regenerateSourceEnglishSelection', 'showSourceEnglishStatus']) assert(definitions.includes(name), name);
});
test('every menu points to an existing function', () => {
  for (const file of ['setup_credentials.js', 'sheet_row_navigation.js']) {
    const callbacks = [...read(file).matchAll(/\.addItem\([^,]+,\s*'([^']+)'/g)].map(match => match[1]);
    for (const name of callbacks) assert(definitions.includes(name), name);
  }
});
test('old screens remain bound dialogs with valid scripts', () => {
  for (const name of ['english_translation_dialog.html', 'notes_english_dialog.html']) {
    for (const match of read(name).matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  }
});
test('automatic enable remains inert with no paid dispatch', () => {
  const context = vm.createContext({ SpreadsheetApp: { getActiveSpreadsheet: () => ({ toast() {} }) } });
  const source = read('source_english_workflow.js');
  const { extract } = require('./test-source-english-edit-stop');
  vm.runInContext(extract(source, 'enableSourceEnglishAutomatic'), context);
  assert.equal(context.enableSourceEnglishAutomatic().stoppedReason, 'MANUAL_ONLY');
});
test('old Notes UI remains guarded after direct workflow ownership', () => {
  const context = vm.createContext({});
  vm.runInContext(read('notes_english_workflow.js'), context);
  context.notesEnglishOwns_ = () => true;
  assert.throws(() => context.notesEnglishLegacyGuard_(), /旧2タブの更新を止め/);
});
test('GAS public GET never exposes review templates', () => {
  const context = vm.createContext({ PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'synthetic' }) } });
  vm.runInContext(read('mahler_server.js'), context);
  context.createPublicSiteRedirect_ = () => 'public-redirect';
  for (const page of ['english_translation_dialog', 'notes_english_dialog', 'japanese_english_proposals']) assert.equal(context.doGet({ parameter: { page } }), 'public-redirect');
});
test('GAS authenticated router does not dispatch arbitrary English functions', () => {
  const { extract } = require('./test-source-english-edit-stop');
  const context = vm.createContext({ SECRET_TOKEN: 'synthetic', createJsonResponse: value => value });
  vm.runInContext(extract(read('web_trigger.js'), 'handleRequest'), context);
  for (const action of ['showEnglishTranslationReview', 'saveJapaneseEnglishProposal', 'regenerateSourceEnglishSelection']) {
    const result = context.handleRequest({ token: 'synthetic', action });
    assert.equal(result.status, 'error');
  }
});
console.log('Source English preservation: ' + count + ' scenarios passed.');
