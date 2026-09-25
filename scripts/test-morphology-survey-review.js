const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('src/morphology_survey_dialog.html');
const browserScript = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(browserScript);
new vm.Script(browserScript[1]);
assert.ok(read('src/setup_credentials.js').includes(
  ".addItem('一括調査の語形対応を確認', 'showMorphologySurveyReview')"));

class Sheet {
  constructor(name, id, rows) { this.name = name; this.id = id; this.rows = rows; }
  getName() { return this.name; }
  getSheetId() { return this.id; }
  getLastRow() { return this.rows.length; }
  getRange(row, col, height, width) {
    return {
      getValues: () => this.rows.slice(row - 1, row - 1 + height)
        .map(item => item.slice(col - 1, col - 1 + width)),
      setValues: values => {
        values.forEach((item, index) => item.forEach((value, offset) => {
          this.rows[row - 1 + index][col - 1 + offset] = value;
        }));
      }
    };
  }
  appendRow(row) { this.rows.push(row); }
  deleteRow(row) { this.rows.splice(row - 1, 1); }
}

const surveyHeaders = [
  '調査ID', 'Notes見出し', 'Notes行', '調査区分', '関連語形', '実例行数',
  '実例位置', '実例文脈', 'Jev関係', 'Jev文法区分', 'Jev確信度',
  '確認区分', '別のNotes見出し', '現行語形区分', '現行用語検索',
  '現行実例検索', '現行補足', '人の採否', '人のメモ', 'Jev実モデル', '抽出根拠'
];
const candidate = (id, form, confidence) => [id, 'ziehen', 12, '新規候補', form, 1,
  'RS!F23', 'Er zieht.', '語形変化 [INFLECTION]', '活用形', confidence,
  '新規：確認候補', '', '', '', '', '', '', '', 'jev-1.13.0', '実例'];
const survey = new Sheet('語形対応_一括調査_20260925', 123,
  [surveyHeaders, candidate('a', 'zieht', 0.95), candidate('b', 'zog', 0.91),
    candidate('c', 'ziehen', 0.89)]);
const mapping = new Sheet('語形対応', 456,
  [['見出し', '関連語形', '語形区分', '用語検索', '実例検索', '補足']]);
const notes = new Sheet('Notes', 789, [['de', 'ja', 'source'], ['ziehen', '', '']]);
const sheets = [survey, mapping, notes];
const spreadsheet = {
  getSheets: () => sheets,
  getSheetByName: name => sheets.find(sheet => sheet.name === name),
  getActiveSheet: () => survey
};
let released = 0;
let locked = false;
let denyLock = false;
const context = {
  console,
  sourceUpdates: 0,
  SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, flush() {} },
  LockService: { getScriptLock: () => ({
    tryLock: wait => { assert.strictEqual(wait, 30000); locked = !denyLock; return locked; },
    releaseLock: () => { released++; locked = false; }
  }) }
};
vm.createContext(context);
vm.runInContext(read('src/dictionary_candidate_workflow.js'), context);
vm.runInContext(read('src/morphology_survey_review.js'), context);
vm.runInContext('dictionarySourceMarkers = () => ["[RS: Oper]"];' +
  'updateNotesSourceMarkersForHeadword = () => { sourceUpdates++; };', context);
context.dictionarySourceMarkers = () => {
  assert.strictEqual(locked, false, '実例検索はロック外で実行する');
  return ['[RS: Oper]'];
};
const originalState = context.morphologySurveyState;
context.morphologySurveyState = id => {
  assert.strictEqual(locked, false, '次候補の読込前にロックを解放する');
  return originalState(id);
};

assert.strictEqual(context.morphologySurveyState(123).remaining, 2);
denyLock = true;
assert.strictEqual(context.morphologySurveyDecide(123, 'a', '採用',
  { category: '現在形', memo: '' }).busy, true);
assert.strictEqual(mapping.rows.length, 1, 'ロック失敗時は登録しない');
assert.strictEqual(survey.rows.length, 4, 'ロック失敗時は調査行を残す');
assert.strictEqual(context.sourceUpdates, 0);
denyLock = false;
let state = context.morphologySurveyDecide(123, 'a', '採用',
  { category: '現在形', memo: '確認済み' });
assert.strictEqual(mapping.rows.length, 2);
assert.deepStrictEqual(Array.from(mapping.rows[1]),
  ['ziehen', 'zieht', '現在形', '対象', '対象', '一括調査ID：a 確認済み']);
assert.strictEqual(survey.rows.some(row => row[0] === 'a'), false);
assert.strictEqual(state.remaining, 1);
assert.strictEqual(context.sourceUpdates, 1);
state = context.morphologySurveyDecide(123, 'b', '保留', { memo: '再確認' });
assert.strictEqual(survey.rows[1][17], '保留');
assert.strictEqual(survey.rows[1][18], '再確認');
assert.strictEqual(state.remaining, 0);
assert.strictEqual(released, 2);
assert.throws(() => context.morphologySurveyDecide(123, 'c', '採用',
  { category: '過去形', memo: '' }), /対象行が変更された/);
survey.rows.push(candidate('d', 'zieht', 0.97));
state = context.morphologySurveyState(123);
assert.strictEqual(state.candidate.registered, true);
assert.throws(() => context.morphologySurveyDecide(123, 'd', '採用',
  { category: '現在形', memo: '' }), /既に語形対応に登録/);
state = context.morphologySurveyDecide(123, 'd', '登録済み行を整理', {});
assert.strictEqual(state.remaining, 0);
assert.strictEqual(mapping.rows.length, 2);
assert.strictEqual(survey.rows.some(row => row[0] === 'd'), false);
console.log('一括調査の語形対応確認テストに成功しました。');
