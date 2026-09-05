const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { root } = require('./sync/core');
const { parseStatus, isAllowed } = require('./sync/git');
const { expectedPaths, validateSnapshot, previousData } = require('./sync/artifacts');
const { deploymentState } = require('./sync/publish');
const { plan, options } = require('./sync/main');
const { publicPath, previewHtml } = require('./preview-site');

assert.deepStrictEqual(parseStatus(' M src/日本語.js\0R  src/new.js\0src/old.js\0?? privacy.html\0'), ['src/日本語.js', 'src/new.js', 'src/old.js', 'privacy.html']);
assert.ok(isAllowed('privacy.html') && isAllowed('license.html'));
assert.ok(!isAllowed('.env') && !isAllowed('output/private.json'));
assert.ok(plan('Auto', [], false).data);
assert.ok(!plan('Auto', ['index.html'], false).data);
assert.ok(plan('Auto', ['README.md'], false).documentsOnly);
assert.ok(plan('Auto', ['README.md'], true).deploy);
assert.throws(() => plan('Site', ['src/search_core.js'], true));
assert.strictEqual(options(['--message', 'literal $(secret) `text`']).message, 'literal $(secret) `text`');

const files = previousData();
files['mahler-search-app/dic.html'] = fs.readFileSync(path.join(root, 'mahler-search-app/dic.html'), 'utf8');
const snapshot = { schemaVersion: 1, requestId: 'test', files };
assert.strictEqual(Object.keys(validateSnapshot(snapshot, 'test')).length, 58);
assert.throws(() => validateSnapshot(snapshot, 'wrong'), /実行ID/);
const copy = () => JSON.parse(JSON.stringify(snapshot));
let bad = copy(); delete bad.files[expectedPaths[1]];
assert.throws(() => validateSnapshot(bad, 'test'), /不足/);
bad = copy(); bad.files['../.env'] = 'secret';
assert.throws(() => validateSnapshot(bad, 'test'), /想定外/);
bad = copy(); bad.files['mahler-search-app/data/richard_wagner.json'] = [];
assert.throws(() => validateSnapshot(bad, 'test'), /空データ/);
bad = copy(); bad.files['mahler-search-app/data/mahler.json'][0] = { de: 'x' };
assert.throws(() => validateSnapshot(bad, 'test'), /必須列/);
bad = copy(); const shard = Object.keys(bad.files).find(f => f.includes('/dictionary-examples/') && bad.files[f].length);
bad.files[shard][0].__exampleOrder = -1;
assert.throws(() => validateSnapshot(bad, 'test'), /参照不一致/);
const old = copy().files;
old['mahler-search-app/data/abbr_list.json'] = Array(100000).fill(['x']);
assert.throws(() => validateSnapshot(snapshot, 'test', old), /件数減少/);
validateSnapshot(snapshot, 'test', old, true);

assert.strictEqual(deploymentState([{ id: 1, name: 'pages build and deployment', head_sha: 'a', status: 'completed', conclusion: 'failure' }], [], 'a'), 'failure');
assert.strictEqual(deploymentState([{ id: 1, name: 'pages build and deployment', head_sha: 'old', status: 'completed', conclusion: 'success' }], [], 'a'), 'pending');
assert.strictEqual(deploymentState([], [{ commit: 'a', status: 'built' }], 'a'), 'success');
assert.strictEqual(deploymentState([{ id: 2, name: 'pages', head_sha: 'a', status: 'in_progress' }, { id: 1, name: 'pages', head_sha: 'a', status: 'completed', conclusion: 'success' }], [], 'a'), 'pending');
assert.strictEqual(publicPath('/.env'), null);
assert.strictEqual(publicPath('/src/web_trigger.js'), null);
assert.strictEqual(publicPath('/mahler-search-app/%2e%2e%5c.env'), null);
assert.ok(publicPath('/mahler-search-app/dic.html').endsWith('dic.html'));
assert.ok(previewHtml('<html><head></head><body></body></html>', 'test', true).includes('確認しました。この内容を公開する'));

let released = 0;
const context = vm.createContext({
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => released++ }) },
    CacheService: { getScriptCache: () => ({ remove() {} }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => null }) },
    SPREADSHEET_ID: 'test'
});
vm.runInContext(fs.readFileSync(path.join(root, 'src/export_json.js'), 'utf8'), context);
assert.throws(() => context.exportAllDataToJson({ requestId: 'test' }), /必須シート/);
assert.strictEqual(released, 1, 'Export errors must release the lock');
context.LockService.getScriptLock = () => ({ tryLock: () => false, releaseLock: () => released++ });
assert.throws(() => context.exportAllDataToJson({}), /実行中/);
assert.strictEqual(released, 1);
const shared = fs.readFileSync(path.join(root, 'src/search_core.js'), 'utf8');
vm.runInContext(shared, context);
assert.strictEqual(context.normalizeString(42), '');
const app = fs.readFileSync(path.join(root, 'mahler-search-app/js/app.js'), 'utf8');
for (const name of ['normalizeString', 'isTermWordCharacter', 'matchesTermQuery', 'normalizeForId', 'generateOriginalTermPattern', 'generateTermPattern', 'linkTermsInTranslation']) {
    assert.strictEqual((app.match(new RegExp('^function ' + name + '\\(', 'gm')) || []).length, 1, name);
}
console.log('sync safety, snapshot, publication and preview tests: OK');
