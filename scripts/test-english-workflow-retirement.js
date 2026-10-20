'use strict';
// Retirement contract: shared menus, dictionary edit handling and source parsing remain usable.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..'), read = file => fs.readFileSync(path.join(root, file), 'utf8');
const retired = [
  'english_review_metadata_auto.js', 'english_review_metadata_export.js', 'english_review_metadata_notes.js', 'english_review_metadata_notes_deadline.js', 'english_review_metadata_notes_recovery.js', 'english_review_metadata_resume.js',
  'english_translation_dialog.html', 'english_translation_review.js', 'english_translation_sync.js',
  'japanese_english_draft_binding.js', 'japanese_english_existing_review.js', 'japanese_english_manual_batch.js', 'japanese_english_mobile_review.js', 'japanese_english_proposals.js', 'japanese_english_retranslation.js', 'japanese_english_sheet_review.js',
  'legacy_english_binding_cleanup.js', 'notes_english_api.js', 'notes_english_dialog.html', 'notes_english_workflow.js', 'source_english_api.js', 'source_english_workflow.js'
];
for (const file of retired) assert.equal(fs.existsSync(path.join(root, 'src', file)), false, file);
const remaining = fs.readdirSync(path.join(root, 'src')).filter(file => file.endsWith('.js') && !['manage_deploy.js', 'update_env.js'].includes(file));
const sources = remaining.map(file => read('src/' + file)).join('\n');
new vm.Script(sources);
assert.doesNotMatch(sources, /\b(?:notesEnglish|sourceEnglish|englishReview|englishNative|englishProposal|englishRetranslation|englishMetadata|englishMobile|legacyEnglish|japaneseEnglish)\w*\s*\(/);
assert.doesNotMatch(sources, /ScriptApp\.(?:newTrigger|deleteTrigger|getProjectTriggers)\s*\(/);
const menus = [], entries = [];
const c = vm.createContext({ SpreadsheetApp: { getUi: () => ({ createMenu(name) { menus.push(name); const menu = { addItem(label, handler) { entries.push({ label, handler }); return menu; }, addToUi() { return menu; } }; return menu; } }) }, addSheetRowNavigationMenu_: () => menus.push('行へ移動') });
vm.runInContext(read('src/setup_credentials.js'), c); c.onOpen();
assert.deepEqual(menus, ['行へ移動', '🔧 データ同期', '📊 検索履歴グラフ', '📚 辞書候補']);
for (const item of entries) assert.match(sources, new RegExp('function\\s+' + item.handler + '\\s*\\('), item.handler);
assert.ok(entries.some(item => item.handler === 'showDictionaryCandidateWizard'));
assert.ok(entries.some(item => item.handler === 'updateSearchHistoryCharts'));
vm.runInContext(read('src/morphology_survey_review.js'), c);
for (const tab of ['RW', 'RS', 'GM', 'Notes']) c.onEdit({ range: { getColumn: () => 1, getLastColumn: () => 20, getSheet: () => ({ getName: () => tab }) } });
let processed = 0, toasted = 0;
c.morphologySurveyIsSurveySheet_ = () => true;
c.morphologySurveyProcessApprovedRows_ = (sheet, ids) => { assert.deepEqual(Array.from(ids), ['synthetic']); processed++; return {}; };
c.morphologySurveyToast_ = () => { toasted++; };
c.onEdit({ range: { getColumn: () => 18, getLastColumn: () => 18, getRow: () => 2, getLastRow: () => 2, getSheet: () => ({ getRange: (r, col) => ({ getValues: () => [[col === 18 ? 1 : 'synthetic']] }) }) } });
assert.equal(processed, 1); assert.equal(toasted, 1);
assert.match(read('scripts/sync/gas-head.js'), /const missing = head\.filter\(file => !l\.has\(file\.name\)\)/, 'Remote deletion guard stays in place');
console.log('English workflow retirement: 22 modules absent; shared menus, dictionary onEdit, source syntax and deployment guard passed.');
