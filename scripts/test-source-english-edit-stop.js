'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function extract(source, name) {
  const marker = 'function ' + name + '(';
  const start = source.indexOf(marker);
  assert.ok(start >= 0, 'Missing function: ' + name);
  assert.equal(source.indexOf(marker, start + marker.length), -1, 'Duplicate function: ' + name);
  const next = /\nfunction [A-Za-z0-9_]+\(/.exec(source.slice(start));
  return source.slice(start, next ? start + next.index : source.length);
}

function runEditStopTests(workflow, legacy, options = {}) {
  let passed = 0;
  const run = (name, test) => { try { test(); passed++; } catch (e) { e.message = name + ': ' + e.message; throw e; } };
  const sourceEdit = extract(workflow, 'sourceEnglishEdited_');
  const legacyEdit = extract(legacy, 'englishTranslationSourceEdited');
  const installedEdit = extract(workflow, 'handleSourceEnglishEdit');
  function event(tab, first = 2, last = first, column = 1, lastColumn = column) {
    const sheet = {getName: () => tab, getSheetId: () => 123, getLastRow: () => 25, getMaxColumns: () => 20};
    const range = {getSheet: () => sheet, getRow: () => first, getLastRow: () => last,
      getColumn: () => column, getLastColumn: () => lastColumn};
    return {range, source: {getId: () => 'test-book'}};
  }
  for (const tab of ['RW', 'RS', 'GM']) {
    for (const span of [[2,2,1,1], [453,453,6,6], [2,25,1,15], [1,1,1,15]]) {
      for (const entry of ['sourceEnglishEdited_', 'englishTranslationSourceEdited', 'handleSourceEnglishEdit']) {
        run(tab + ' ' + entry + ' ' + span.join(','), () => {
          const calls = [];
          const blocked = name => () => { calls.push(name); throw new Error('Unexpected side effect: ' + name); };
          const e = event(tab, ...span);
          // A stopped event needs only its sheet name, never row contents or old review tabs.
          for (const key of ['getRow','getLastRow','getColumn','getLastColumn']) e.range[key] = blocked(key);
          e.source.getSheetByName = blocked('old review read');
          e.source.toast = blocked('toast');
          const sandbox = {e, sourceEnglishAdapter_: blocked('adapter'), notesEnglishLock_: blocked('lock'),
            sourceEnglishContext_: blocked('context'), sourceEnglishCapture_: blocked('capture'),
            sourceEnglishSave_: blocked('ledger write'), englishReviewSyncSources_: blocked('old review sync'),
            PropertiesService: {getScriptProperties: blocked('properties')},
            SpreadsheetApp: {getActiveSpreadsheet: blocked('spreadsheet')},
            UrlFetchApp: {fetch: blocked('paid API')},
            notesEnglishBook_: () => e.source, sourceEnglishDirect_: () => true};
          if (entry === 'handleSourceEnglishEdit') e.triggerUid = 'test-edit-trigger';
          vm.createContext(sandbox);
          vm.runInContext(sourceEdit + '\n' + legacyEdit + '\n' + installedEdit, sandbox);
          const result = sandbox[entry](e);
          assert.equal(result, entry === 'handleSourceEnglishEdit' ? undefined : false);
          assert.deepEqual(calls, []);
        });
      }
    }
  }
  run('Notes retains capture and cancellation on source edits', () => {
    for (const draft of [true, false]) {
      const e = event('Notes', 2, 2, draft ? 4 : 2);
      const adapter = {width:9, draft:3, english:5, de:0, ja:1, source:2, status:8};
      const ctx = {adapter, book:e.source, sheet:e.range.getSheet()};
      const calls = [];
      const sandbox = {sourceEnglishAdapter_: () => adapter, notesEnglishLock_: f => f(),
        sourceEnglishColumns_: () => ({positions:Array.from({length:9},(_,i)=>i)}),
        sourceEnglishContext_: () => ctx, sourceEnglishControls_: () => [], sourceEnglishIndex_: () => ({}),
        sourceEnglishCapture_: (c, controls, index, row, flags) => calls.push({row, ...flags})};
      vm.createContext(sandbox); vm.runInContext(sourceEdit, sandbox);
      assert.equal(sandbox.sourceEnglishEdited_(e), true);
      assert.deepEqual(calls, [{row:2, draftEdit:draft, cancel:!draft, explicit:false}]);
    }
  });
  run('Notes legacy route retains its previous behavior', () => {
    const e = event('Notes', 2, 2, 2);
    const calls = [];
    e.source.getSheetByName = name => { assert.equal(name, '英訳確認'); return {}; };
    const sandbox = {namedSheetColumns_: () => ({positions:[0,1,2]}), englishReviewSyncSources_: (initialize, tab) => calls.push([initialize, tab])};
    vm.createContext(sandbox); vm.runInContext(legacyEdit, sandbox);
    assert.equal(sandbox.englishTranslationSourceEdited(e), !!options.legacyActive);
    assert.deepEqual(calls, options.legacyActive ? [[false, 'Notes']] : []);
  });
  for (const tab of ['RW','RS','GM','Notes']) {
    run(tab + ' explicit selection still captures and processes only selected rows', () => {
      const e = event(tab, 2, 3);
      const book = {...e.source, getActiveRange: () => e.range, toast: () => {}};
      const ctx = {book, sheet:e.range.getSheet()}, captures = [], processed = [];
      const expected = {written:2, held:0, pending:0};
      const sandbox = {SpreadsheetApp:{getActiveSpreadsheet: () => book}, notesEnglishLock_: f => f(),
        sourceEnglishAdapter_: () => ({width:15}), sourceEnglishContext_: () => ctx,
        sourceEnglishColumns_: () => ({positions:Array.from({length:15},(_,i)=>i)}),
        PropertiesService:{getScriptProperties: () => ({getProperty: () => 'mock-key'})}, NOTES_ENGLISH_API_KEY:'mock-key-property',
        notesEnglishApiConfig_: () => ({tested:true, testedKeyHash:'mock-hash'}), notesEnglishHash_: () => 'mock-hash',
        sourceEnglishControls_: () => [], sourceEnglishIndex_: () => ({}),
        sourceEnglishCapture_: (c, controls, index, row, flags) => {
          captures.push({row, ...flags}); return {id:tab + '-' + row};
        }, sourceEnglishProcess_: (ids, target) => { processed.push([Array.from(ids), target]); return expected; },
        sourceEnglishProcessMessage_: () => 'mock-result'};
      vm.createContext(sandbox); vm.runInContext(extract(workflow, 'regenerateSourceEnglishSelection'), sandbox);
      assert.equal(sandbox.regenerateSourceEnglishSelection(), expected);
      assert.deepEqual(captures, [2,3].map(row => ({row, explicit:true, draftEdit:false, cancel:false})));
      assert.deepEqual(processed, [[[tab + '-2', tab + '-3'], tab]]);
    });
  }
  run('Missing events remain harmless', () => {
    const sandbox = {}; vm.createContext(sandbox); vm.runInContext(sourceEdit + '\n' + legacyEdit, sandbox);
    assert.equal(sandbox.sourceEnglishEdited_(), false);
    assert.equal(sandbox.englishTranslationSourceEdited(), false);
  });
  if (options.onEdit && options.notesEntry) {
    for (const tab of ['RW','RS','GM']) for (const owns of [true, false]) {
      run(tab + ' simple onEdit does not sync English; Notes ownership ' + owns, () => {
        const calls = [], e = event(tab, 453, 453, 6);
        const blocked = name => () => { calls.push(name); throw new Error(name); };
        e.source.getSheetByName = blocked('old review access');
        e.source.toast = blocked('toast');
        const sandbox = {sourceEnglishAdapter_: () => ({}), sourceEnglishDirect_: () => true,
          legacyEnglishBindingsRetired_: () => true, notesEnglishOwns_: () => owns,
          englishRetranslationEdited_: () => false, englishNativeProposalEdited: () => false,
          notesEnglishLock_: blocked('lock'), englishReviewSyncSources_: blocked('old sync')};
        vm.createContext(sandbox);
        vm.runInContext([sourceEdit, legacyEdit, extract(options.notesEntry,'notesEnglishEdited_'), extract(options.onEdit,'onEdit')].join('\n'), sandbox);
        sandbox.onEdit(e);
        assert.deepEqual(calls, []);
      });
    }
    run('Unrelated onEdit approval processing still runs', () => {
      const e = event('survey', 2, 2, 18), calls = [];
      const sheet = e.range.getSheet();
      sheet.getRange = (row, col) => ({getValues: () => col === 18 ? [[1]] : [['test-row-id']]});
      const sandbox = {notesEnglishEdited_: () => false, englishRetranslationEdited_: () => false,
        englishNativeProposalEdited: () => false, morphologySurveyIsSurveySheet_: () => true,
        morphologySurveyIsApproved_: value => value === 1,
        morphologySurveyProcessApprovedRows_: (s, ids) => { calls.push(Array.from(ids)); return {completed:1}; },
        morphologySurveyToast_: result => calls.push(result.completed)};
      vm.createContext(sandbox); vm.runInContext(legacyEdit + '\n' + extract(options.onEdit,'onEdit'), sandbox);
      sandbox.onEdit(e);
      assert.deepEqual(calls, [['test-row-id'], 1]);
    });
  }
  return {passed, networkCalls:0, productionWrites:0};
}

module.exports = {runEditStopTests, extract};
if (require.main === module) {
  const read = file => fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
  console.log('Source English Edit Stop: ' + runEditStopTests(read('source_english_workflow.js'), read('english_translation_sync.js'),
    {legacyActive:true, onEdit:read('morphology_survey_review.js'), notesEntry:read('notes_english_workflow.js')}).passed + ' scenarios passed.');
}
