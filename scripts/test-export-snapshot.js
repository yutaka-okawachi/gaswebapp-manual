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
    Notes: [['de', 'ja', 'source'], ['langsam', 'ゆっくり', '[GM], [RW], [RS]']],
    '語形対応': [['見出し', '関連語形', '語形区分', '用語検索', '実例検索', '補足'], ['langsam', 'langsamer', '比較級', '対象', '対象', '']],
    '略記一覧': [['番号', '略記', '説明'], ['', 'N.B.', '注意']],
    'RS幕構成': [['Oper', 'Aufzug', 'Szene', '日本語', '作品名'], ['test', '1', '1', '場面', 'Test Op.1']],
    'RW幕構成': [['Oper', 'Aufzug', 'Szene', '日本語', '作品名'], ['test', '1', '1', '場面', 'Test Op.1']],
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
assert.strictEqual(first.files['mahler-search-app/data/dic_terms_index.json'].langsamer.id, 'term-langsam');
assert.strictEqual((first.files['mahler-search-app/dic.html'].match(/<script src="js\/analytics\.js"><\/script>/g) || []).length, 1,
    'GAS must emit one cache-neutral analytics script; build-site adds its public version locally');
const second = JSON.parse(JSON.stringify(context.exportAllDataToJson({ requestId: 'fixture' })));
assert.deepStrictEqual(second, first, 'Retrying the same read-only snapshot must be deterministic');
assert.strictEqual(released, 2);
assert.ok(!JSON.stringify(first).includes('githubToken'));

// 列を並べ替えても（見出し名で読むため）生成結果は完全に同じになること
const original = JSON.parse(JSON.stringify(sheets));
const positional = new Set(['略記一覧']);
const sceneSheets = new Set(['RS幕構成', 'RW幕構成']);
for (const name of Object.keys(sheets)) {
    if (positional.has(name)) continue;
    // 幕構成は見出し付きの追加列も書き出すため、無関係な列の追加は幕構成以外で確認する
    sheets[name] = sheets[name].map((row, i) => {
        const reversed = [...row].reverse();
        return sceneSheets.has(name) ? reversed : [i === 0 ? 'メモ' : 'x', ...reversed];
    });
}
const reordered = JSON.parse(JSON.stringify(context.exportAllDataToJson({ requestId: 'fixture' })));
assert.deepStrictEqual(reordered.files, first.files, 'Reordering columns must not change generated files');
assert.deepStrictEqual(Object.keys(reordered.files['mahler-search-app/data/rs_scenes.json'][0]),
    ['Oper', 'Aufzug', 'Szene', '日本語', '作品名']);

// 必須見出しの欠落・重複は公開前に停止すること
const restore = () => Object.keys(original).forEach(name => { sheets[name] = JSON.parse(JSON.stringify(original[name])); });
for (const [name, header] of [['GM', 'data'], ['Notes', 'source'], ['RS', 'Szene'], ['語形対応', '実例検索'], ['RW幕構成', '日本語'], ['楽譜情報', 'Publisher']]) {
    restore();
    sheets[name][0] = sheets[name][0].map(h => h === header ? h + '_renamed' : h);
    assert.throws(() => context.exportAllDataToJson({}), new RegExp('必須列が不足しています: ' + name + ':' + header));
    restore();
    sheets[name] = sheets[name].map(row => [...row, row[sheets[name][0].indexOf(header)]]);
    assert.throws(() => context.exportAllDataToJson({}), new RegExp('列名が重複しています: ' + name + ':' + header));
}
restore();
sheets['RS幕構成'] = sheets['RS幕構成'].map((row, i) => [...row, i === 0 ? '作品名' : 'dup']);
assert.throws(() => context.exportAllDataToJson({}), /列名が重複しています: RS幕構成:作品名/);
restore();
// Japanese promotion is independent of approval labels. Old Japanese and English remain private.
for (const mode of ['held', 'empty']) {
    restore();
    for (const tab of ['GM', 'RW', 'RS', 'Notes']) {
        const data = sheets[tab], jaIndex = data[0].indexOf('ja');
        data[0][jaIndex] = 'ja_old';
        data[0].push('ja', 'en', 'whom_en', '準備状態');
        data[1][jaIndex] = 'PRIVATE_OLD_JAPANESE';
        data[1].push(mode === 'empty' ? '' : '昇格した日本語', 'PRIVATE_ENGLISH', 'PRIVATE_TARGET_ENGLISH', '保留');
    }
    const promoted = context.exportAllDataToJson({ requestId: 'fixture' });
    for (const [tab, file] of [['GM', 'mahler'], ['RW', 'richard_wagner'], ['RS', 'richard_strauss'], ['Notes', 'dic_notes']]) {
        const row = promoted.files['mahler-search-app/data/' + file + '.json'][0];
        assert.strictEqual(tab === 'Notes' ? row[1] : row.ja, mode === 'empty' ? '' : '昇格した日本語');
    }
    assert.ok(!JSON.stringify(promoted.files).includes('PRIVATE_'));
}
restore();

released = 0;

delete sheets.RW;
assert.throws(() => context.exportAllDataToJson({}), /必須シート/);
assert.strictEqual(released, 1);
console.log('GAS snapshot generation and local contract integration tests: OK');
