const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { root } = require('./sync/core');
const { validateSnapshot } = require('./sync/artifacts');
const headers = ['Oper', 'Aufzug', 'Szene', 'page', 'whom', 'de', 'de_normalized', 'ja'];
const sheets = {
    GM: [['de', 'de_normalized', 'ja', 'data'], ['langsam', 'langsam', 'ゆっくり', 'x-a-1-1-vn']],
    RS: [headers, ['test', '1', '1', '1', 'Alle', 'langsam', 'langsam', 'ゆっくり']],
    RW: [headers, ['test', '1', '1', '1', 'Alle', 'langsam', 'langsam', 'ゆっくり']],
    Notes: [['用語', '訳', '出典'], ['langsam', 'ゆっくり', '[GM], [RW], [RS]']],
    '略記一覧': [['番号', '略記', '説明'], ['', 'N.B.', '注意']],
    'RS幕構成': [['Oper', 'Aufzug', 'Szene', '日本語'], ['test', '1', '1', '場面']],
    'RW幕構成': [['Oper', 'Aufzug', 'Szene', '日本語'], ['test', '1', '1', '場面']],
    '楽譜情報': [['Oper', 'B', 'C', 'D', 'Publisher'], ['test', '', '', '', '出版社']]
};
let released = 0;
const context = vm.createContext({
    console, Logger: { log() {} }, SPREADSHEET_ID: 'fixture',
    CacheService: { getScriptCache: () => ({ remove() {} }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => released++ }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: name => sheets[name] ? { getDataRange: () => ({ getValues: () => sheets[name] }) } : null }) }
});
for (const file of ['asset_versions', 'sync_build', 'dictionary_example_shards', 'generate_dic_html', 'export_json']) {
    vm.runInContext(fs.readFileSync(path.join(root, `src/${file}.js`), 'utf8'), context);
}
const first = JSON.parse(JSON.stringify(context.exportAllDataToJson({ requestId: 'fixture' })));
validateSnapshot(first, 'fixture');
assert.strictEqual(first.files['mahler-search-app/data/richard_wagner.json'][0]['楽譜情報'], '出版社');
assert.strictEqual(first.files['mahler-search-app/data/richard_wagner.json'][0]['場面タイトル'], '場面');
assert.strictEqual(first.files['mahler-search-app/data/whom_list.json'].test[0], 'Alle');
const second = JSON.parse(JSON.stringify(context.exportAllDataToJson({ requestId: 'fixture' })));
assert.deepStrictEqual(second, first, 'Retrying the same read-only snapshot must be deterministic');
assert.strictEqual(released, 2);
assert.ok(!JSON.stringify(first).includes('githubToken'));
delete sheets.RW;
assert.throws(() => context.exportAllDataToJson({}), /必須シート/);
assert.strictEqual(released, 3);
console.log('GAS snapshot generation and local contract integration tests: OK');
