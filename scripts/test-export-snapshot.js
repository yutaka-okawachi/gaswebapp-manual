const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { root } = require('./sync/core');
const { validateSnapshot } = require('./sync/artifacts');
const headers = ['Oper', 'Aufzug', 'Szene', 'page', 'whom', 'de', 'de_normalized', 'ja'];
const sheets = {
    GM: [['de', 'de_normalized', 'ja', 'data'], ['langsam', 'langsam', 'ゆっくり', 'x-a-1-1-vn']],
    RS: [headers,
        ['test', '1', '1', '1', 'Alle', 'langsam', 'langsam', 'ゆっくり'],
        ['test', '1', '1', '2', 'Alle', 'stürzt herein', 'stuerzt herein', '駆け込む']],
    RW: [headers,
        ['test', '1', '1', '1', 'Alle', 'langsam', 'langsam', 'ゆっくり'],
        ['test', '1', '1', '2', 'Alle', 'stürzt herein', 'stuerzt herein', '駆け込む']],
    Notes: [
        ['用語', '訳', '出典'],
        ['langsam', 'ゆっくり', '[GM], [RW], [RS]'],
        ['stürzen', '急落する，突進する', '[RW: Oper], [RS: Oper]'],
        ['markieren', '印をつける，強調する', '[RS: Held]']
    ],
    'Notes_正規化テスト': [
        ['de', 'ja', 'source'],
        ['stürzen', '急落する，突進する', '[RW: Oper], [RS: Oper]'],
        ['markieren', '印をつける，強調する', '[RS: Held]']
    ],
    '語形対応_正規化テスト': [
        ['語形・別綴り', '正規見出し', '種別', '備考'],
        ['stürzt', 'stürzen', '活用形', ''],
        ['markiert', 'markieren', '過去分詞', '']
    ],
    '語形対応': [
        ['語形・別綴り', '正規見出し', '種別', '備考'],
        ['stürzt', 'stürzen', '活用形', ''],
        ['markiert', 'markieren', '過去分詞', '']
    ],
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
for (const file of ['sync_build', 'dictionary_example_shards', 'generate_dic_html', 'export_json']) {
    vm.runInContext(fs.readFileSync(path.join(root, `src/${file}.js`), 'utf8'), context);
}
const first = JSON.parse(JSON.stringify(context.exportAllDataToJson({ requestId: 'fixture' })));
validateSnapshot(first, 'fixture');
assert.strictEqual(first.files['mahler-search-app/data/richard_wagner.json'][0]['楽譜情報'], '出版社');
assert.strictEqual(first.files['mahler-search-app/data/richard_wagner.json'][0]['場面タイトル'], '場面');
assert.strictEqual(first.files['mahler-search-app/data/whom_list.json'].test[0], 'Alle');
assert.strictEqual((first.files['mahler-search-app/dic.html'].match(/<script src="js\/analytics\.js"><\/script>/g) || []).length, 1,
    'GAS must emit one cache-neutral analytics script; build-site adds its public version locally');
const second = JSON.parse(JSON.stringify(context.exportAllDataToJson({ requestId: 'fixture' })));
assert.deepStrictEqual(second, first, 'Retrying the same read-only snapshot must be deterministic');
assert.strictEqual(released, 2);
assert.ok(!JSON.stringify(first).includes('githubToken'));
assert.deepStrictEqual(first.files['mahler-search-app/data/dic_notes.json'][0], ['langsam', 'ゆっくり', '[GM], [RW], [RS]']);
assert.deepStrictEqual(
    first.files['mahler-search-app/data/dic_terms_index.json'].stuerzt,
    { id: 'term-stuerzen', original: 'stürzt', canonical: 'stürzen', type: '活用形' }
);

const normalizationTest = JSON.parse(JSON.stringify(context.exportAllDataToJson({
    requestId: 'normalization-test',
    dictionarySource: 'normalizationTest'
})));
validateSnapshot(normalizationTest, 'normalization-test');
assert.deepStrictEqual(
    normalizationTest.files['mahler-search-app/data/dic_notes.json']
        .find(row => row[0] === 'stürzen'),
    ['stürzen', '急落する，突進する', '[RW: Oper], [RS: Oper]']
);
assert.deepStrictEqual(
    normalizationTest.files['mahler-search-app/data/dic_terms_index.json'].stuerzt,
    { id: 'term-stuerzen', original: 'stürzt', canonical: 'stürzen', type: '活用形' }
);
assert.ok(normalizationTest.files['mahler-search-app/dic.html'].includes('q=st%C3%BCrzen'));
assert.ok(Object.entries(normalizationTest.files)
    .filter(([name]) => /dictionary-examples\/(rw|rs)-\d{2}\.json$/.test(name))
    .some(([, rows]) => rows.some(row => row.de === 'stürzt herein')),
    'Normalization test aliases must select the matching composer shard');
assert.strictEqual(released, 3);

assert.throws(
    () => context.exportAllDataToJson({ requestId: 'bad-source', dictionarySource: 'unexpected' }),
    /未対応の辞書データ元/
);
assert.strictEqual(released, 4);
delete sheets['語形対応'];
assert.throws(() => context.exportAllDataToJson({}), /語形対応シートが欠落しています: 語形対応/);
assert.strictEqual(released, 5);
delete sheets.RW;
assert.throws(() => context.exportAllDataToJson({}), /必須シート/);
assert.strictEqual(released, 6);
console.log('GAS snapshot generation and local contract integration tests: OK');
