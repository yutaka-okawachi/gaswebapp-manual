'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function runNavigationTests(navigation, setup) {
  const results = [];
  function test(name, fn) { fn(); results.push(name); }
  function fixture(options = {}) {
    const violations = [], prompts = [], alerts = [], moves = [], menus = new Map();
    const state = { tab: 'Other', cell: 'B7', textReads: 0, sheetLookups: 0 };
    const rows = { RW: 5743, RS: 5785, GM: 4810, Notes: 1989 };
    const sheets = {};
    function strict(object) {
      return new Proxy(object, { get(target, key) {
        if (key in target) return target[key];
        violations.push(String(key)); throw Error('Unexpected service access');
      } });
    }
    function sheet(name, id, maxRows) {
      const record = { id, maxRows, hidden: false };
      record.api = strict({
        getSheetId: () => record.id,
        getMaxRows: () => record.maxRows,
        isSheetHidden: () => record.hidden,
        getRange: (row, col, height, width) => {
          if (options.rangeError) throw Error('Range disappeared');
          assert(row >= 1 && row <= record.maxRows);
          assert.deepEqual([col, height, width], [1, 1, 1]);
          return { name, row, col };
        }
      });
      return record;
    }
    Object.entries(rows).forEach(([name, count], i) => { sheets[name] = sheet(name, i + 10, count); });
    if (options.missing) delete sheets[options.missing];
    if (options.hidden) sheets[options.hidden].hidden = true;
    const responses = (options.responses || [{ text: options.text === undefined ? '1200' : options.text, button: options.button || 'OK' }]).slice();
    const ui = strict({
      Button: { OK: 'OK', CANCEL: 'CANCEL', CLOSE: 'CLOSE' }, ButtonSet: { OK_CANCEL: 'OK_CANCEL' },
      alert: message => alerts.push(message),
      prompt: (title, message, buttons) => {
        assert.equal(buttons, 'OK_CANCEL'); prompts.push({ title, message });
        const answer = responses.shift(); assert(answer, 'No repeated prompt on invalid input');
        if (options.duringPrompt) options.duringPrompt(sheets);
        return {
          getSelectedButton: () => answer.button,
          getResponseText: () => { state.textReads++; return answer.text; }
        };
      },
      createMenu: title => {
        const entries = [];
        const menu = {
          addItem: (label, callback) => { entries.push([label, callback]); return menu; },
          addToUi: () => { menus.set(title, entries); return menu; }
        };
        return menu;
      }
    });
    const book = strict({
      getSheetByName: name => { state.sheetLookups++; return sheets[name] ? sheets[name].api : null; },
      setActiveSheet: target => {
        const name = Object.keys(sheets).find(name => sheets[name].api === target);
        assert(name); state.tab = name; moves.push(['sheet', name]);
      },
      setActiveRange: cell => {
        assert.equal(state.tab, cell.name); state.cell = 'A' + cell.row; moves.push(['cell', cell.name, state.cell]);
      }
    });
    const forbidden = strict({});
    const context = vm.createContext({
      SpreadsheetApp: strict({ getUi: () => ui, getActiveSpreadsheet: () => options.noBook ? null : book }),
      UrlFetchApp: forbidden, ScriptApp: forbidden, PropertiesService: forbidden, LockService: forbidden, HtmlService: forbidden
    });
    vm.runInContext(navigation + '\n' + setup, context);
    return { context, prompts, alerts, moves, menus, state, violations };
  }
  function unchanged(f) {
    assert.deepEqual([f.state.tab, f.state.cell], ['Other', 'B7']);
    assert.deepEqual(f.moves, []); assert.deepEqual(f.violations, []);
  }
  const callbacks = [['RW', 'goToRwRow'], ['RS', 'goToRsRow'], ['GM', 'goToGmRow'], ['Notes', 'goToNotesRow']];
  test('onOpen registers four navigation callbacks and preserves existing menus', () => {
    const f = fixture(); f.context.onOpen();
    assert.deepEqual(f.menus.get('指定行へ移動'), callbacks);
    const old = fixture();
    vm.runInContext(setup.replace('  addSheetRowNavigationMenu_(ui);\r\n', '').replace('  addSheetRowNavigationMenu_(ui);\n', ''), old.context);
    old.context.onOpen();
    assert.deepEqual([...f.menus].filter(([name]) => name !== '指定行へ移動'), [...old.menus]);
    assert.equal(f.prompts.length, 0); assert.equal(f.state.sheetLookups, 0); unchanged(f);
  });
  test('repeated onOpen keeps one navigation menu', () => {
    const f = fixture(); f.context.onOpen(); f.context.onOpen();
    assert.equal([...f.menus.keys()].filter(n => n === '指定行へ移動').length, 1);
    assert.equal(f.menus.get('指定行へ移動').length, 4); unchanged(f);
  });
  for (const [name, callback] of callbacks) {
    test(name + ' menu callback selects the requested A cell with one prompt', () => {
      const f = fixture(); f.context[callback]();
      assert.deepEqual([f.state.tab, f.state.cell], [name, 'A1200']);
      assert.equal(f.prompts.length, 1); assert(f.prompts[0].title.includes(name));
      assert.equal(f.alerts.length, 0); assert.deepEqual(f.violations, []);
    });
  }
  for (const [text, cell] of [['1', 'A1'], ['4810', 'A4810'], [' 0012 ', 'A12']]) {
    test('accept existing row boundary or whitespace: ' + text, () => {
      const f = fixture({ text }); f.context.goToGmRow();
      assert.deepEqual([f.state.tab, f.state.cell], ['GM', cell]); assert.deepEqual(f.violations, []);
    });
  }
  for (const text of ['', '   ', '0', '-1', '1.5', '1.0', '+12', '1e3', '0x10', '1,200', 'A12', '=12', '１２', 'NaN', 'Infinity', '9007199254740992', '1'.repeat(1000), null]) {
    test('reject invalid input: ' + String(text).slice(0, 30), () => {
      const f = fixture({ text }); f.context.goToGmRow();
      unchanged(f); assert.equal(f.alerts.length, 1); assert.equal(f.prompts.length, 1);
    });
  }
  test('reject a row beyond the existing grid without adding rows', () => {
    const f = fixture({ text: '4811' }); f.context.goToGmRow(); unchanged(f);
    assert(f.alerts[0].includes('1〜4810'));
  });
  for (const button of ['CANCEL', 'CLOSE']) test(button + ' does not read input or move', () => {
    const f = fixture({ button }); f.context.goToGmRow(); unchanged(f);
    assert.equal(f.alerts.length, 0); assert.equal(f.state.textReads, 0);
  });
  for (const options of [{ missing: 'GM' }, { hidden: 'GM' }, { noBook: true }]) test('unavailable destination: ' + JSON.stringify(options), () => {
    const f = fixture(options); f.context.goToGmRow(); unchanged(f);
    assert.equal(f.prompts.length, 0); assert.equal(f.alerts.length, 1);
  });
  test('unknown tab cannot be used as a navigation destination', () => {
    const f = fixture(); f.context.sheetRowNavigation_('Other'); unchanged(f);
    assert.equal(f.state.sheetLookups, 0); assert.equal(f.prompts.length, 0);
  });
  for (const [name, change] of [
    ['deleted', s => { delete s.GM; }],
    ['replaced', s => { s.GM.id = 999; }],
    ['hidden', s => { s.GM.hidden = true; }],
    ['rows removed', s => { s.GM.maxRows = 100; }]
  ]) test('recheck after prompt: ' + name, () => {
    const f = fixture({ duringPrompt: change }); f.context.goToGmRow(); unchanged(f);
    assert.equal(f.alerts.length, 1);
  });
  test('range failure is handled before changing the active tab', () => {
    const f = fixture({ rangeError: true }); f.context.goToGmRow(); unchanged(f);
    assert.equal(f.alerts.length, 1);
  });
  test('repeated moves and cancellation retain only the last successful position', () => {
    const f = fixture({ responses: [
      { text: '100', button: 'OK' }, { text: '200', button: 'CANCEL' },
      { text: '-1', button: 'OK' }, { text: '200', button: 'OK' }, { text: '', button: 'CLOSE' }
    ] });
    f.context.goToRwRow(); f.context.goToRsRow(); f.context.goToGmRow();
    assert.deepEqual([f.state.tab, f.state.cell], ['RW', 'A100']);
    f.context.goToNotesRow(); f.context.goToGmRow();
    assert.deepEqual([f.state.tab, f.state.cell], ['Notes', 'A200']);
    assert.equal(f.moves.filter(m => m[0] === 'cell').length, 2); assert.deepEqual(f.violations, []);
  });
  return { passed: results.length, tests: results, externalApiCalls: 0, sheetDataReads: 0, sheetDataWrites: 0 };
}

module.exports = { runNavigationTests };
if (require.main === module) {
  const src = path.join(__dirname, '../src');
  console.log(JSON.stringify(runNavigationTests(
    fs.readFileSync(path.join(src, 'sheet_row_navigation.js'), 'utf8'),
    fs.readFileSync(path.join(src, 'setup_credentials.js'), 'utf8')
  ), null, 2));
}
