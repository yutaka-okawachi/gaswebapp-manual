const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { root, ownsHash, nextOwnedHash, atomicFile } = require('./sync/core');
const { parseStatus, isAllowed, fastForwardIfClean } = require('./sync/git');
const { expectedPaths, validateSnapshot, previousData, formatJson } = require('./sync/artifacts');
const { deploymentState, validationState } = require('./sync/publish');
const { plan, options } = require('./sync/main');
const { publicPath, previewHtml } = require('./preview-site');

assert.deepStrictEqual(parseStatus(' M src/日本語.js\0R  src/new.js\0src/old.js\0?? privacy.html\0'), ['src/日本語.js', 'src/new.js', 'src/old.js', 'privacy.html']);
assert.ok(isAllowed('privacy.html') && isAllowed('license.html') && isAllowed('AGENTS.md'));
assert.ok(!isAllowed('.env') && !isAllowed('output/private.json'));
assert.ok(plan('Auto', [], false).data);
assert.equal(nextOwnedHash('completed', 'completed'), 'completed', 'Keep previously installed dictionary while staging');
assert.deepEqual(nextOwnedHash(['completed', 'aborted'], 'completed', 'retry'), ['completed', 'retry']);
assert.deepEqual(nextOwnedHash(['completed', 'retry'], 'retry', 'latest'), ['retry', 'latest']);
assert.equal(nextOwnedHash('completed', 'manual edit', 'latest'), 'latest');
assert.ok(ownsHash(['retry', 'latest'], 'retry') && ownsHash(['retry', 'latest'], 'latest'));
assert.ok(!ownsHash(['retry', 'latest'], 'manual edit'));
assert.ok(plan('Auto', ['index.html'], false).data);
assert.ok(plan('Auto', ['README.md'], false).documentsOnly);
assert.ok(plan('Auto', ['AGENTS.md'], false).documentsOnly);
assert.ok(plan('Auto', ['README.md'], true).deploy);
assert.throws(() => plan('Site', ['src/web_trigger.js'], true));
assert.strictEqual(plan('Auto', ['frontend/search-core.js'], false).deploy, false);
assert.strictEqual(plan('Auto', ['frontend/search-core.js'], false).data, true);
assert.ok(!fs.existsSync(path.join(root, 'src/asset_versions.js')), 'Public asset versions must not be part of GAS source');
assert.ok(!fs.readFileSync(path.join(root, 'scripts/build-site.js'), 'utf8').includes("writeIfChanged('src/asset_versions.js'"));
assert.strictEqual(options(['--message', 'literal $(secret) `text`']).message, 'literal $(secret) `text`');
assert.strictEqual(options([]).yes, false);
assert.strictEqual(options(['--yes']).yes, true);
assert.deepStrictEqual([...fs.readFileSync(path.join(root, 'sync-data.ps1')).slice(0, 3)], [0xef, 0xbb, 0xbf], 'sync-data.ps1 must keep UTF-8 BOM for Windows PowerShell 5.1');

// formatJson 仕様テスト
const rsSample = [{ Oper: 'guntram', page: 16 }, { Oper: 'guntram', page: 17 }];
const rsFormatted = formatJson('mahler-search-app/data/richard_strauss.json', rsSample);
assert.strictEqual(rsFormatted, '[\n  {"Oper":"guntram","page":16},\n  {"Oper":"guntram","page":17}\n]\n');
assert.deepStrictEqual(JSON.parse(rsFormatted), rsSample);
assert.strictEqual(formatJson('mahler-search-app/data/mahler.json', []), '[]\n');
const whomSample = { guntram: ['Orchester'] };
const whomFormatted = formatJson('mahler-search-app/data/whom_list.json', whomSample);
assert.strictEqual(whomFormatted, JSON.stringify(whomSample, null, 2) + '\n');
assert.deepStrictEqual(JSON.parse(whomFormatted), whomSample);
assert.strictEqual(formatJson('mahler-search-app/dic.html', '<html></html>'), '<html></html>');

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
const validationRun = { id: 1, name: 'Validate site and sync', path: '.github/workflows/normalize-admin-optout.yml', event: 'push',
    head_sha: 'a', status: 'completed', conclusion: 'success' };
assert.strictEqual(validationState([validationRun], 'a'), 'success');
assert.strictEqual(validationState([validationRun], 'other'), 'pending');
assert.strictEqual(validationState([{ ...validationRun, event: 'pull_request' }], 'a'), 'pending');
assert.strictEqual(validationState([{ ...validationRun, path: 'another.yml' }], 'a'), 'pending');
assert.strictEqual(validationState([validationRun, { ...validationRun, id: 2, status: 'in_progress' }], 'a'), 'pending');
assert.strictEqual(validationState([{ ...validationRun, conclusion: 'failure' }], 'a'), 'failure');
assert.strictEqual(publicPath('/.env'), null);
assert.strictEqual(publicPath('/src/web_trigger.js'), null);
assert.strictEqual(publicPath('/mahler-search-app/%2e%2e%5c.env'), null);
assert.ok(publicPath('/mahler-search-app/dic.html').endsWith('dic.html'));
assert.ok(previewHtml('<html><head></head><body></body></html>', 'test', true).includes('確認しました。この内容を公開する'));
let released = 0;
const context = vm.createContext({
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => released++ }) },
    CacheService: { getScriptCache: () => ({ removeAll() {} }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => null }) },
    SPREADSHEET_ID: 'test'
});
vm.runInContext(fs.readFileSync(path.join(root, 'src/export_json.js'), 'utf8'), context);
assert.throws(() => context.exportAllDataToJson({ requestId: 'test' }), /必須シート/);
assert.strictEqual(released, 1, 'Export errors must release the lock');
context.LockService.getScriptLock = () => ({ tryLock: () => false, releaseLock: () => released++ });
assert.throws(() => context.exportAllDataToJson({}), /実行中/);
assert.strictEqual(released, 1);
const shared = fs.readFileSync(path.join(root, 'frontend/search-core.js'), 'utf8');
vm.runInContext(shared, context);
assert.strictEqual(context.normalizeString(42), '');
const app = fs.readFileSync(path.join(root, 'mahler-search-app/js/app.js'), 'utf8');
for (const name of ['normalizeString', 'isTermWordCharacter', 'matchesTermQuery', 'normalizeForId', 'generateOriginalTermPattern', 'generateTermPattern', 'linkTermsInTranslation']) {
    assert.strictEqual((app.match(new RegExp('^function ' + name + '\\(', 'gm')) || []).length, 1, name);
}

// fastForwardIfClean 仕様テスト（一時リポジトリ）
{
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gmt-ff-test-'));
    try {
        const gitIn = (...args) => execFileSync('git', args, { cwd: tmp, encoding: 'utf8' }).trim();
        gitIn('init', '-b', 'main');
        gitIn('config', 'user.name', 'Test');
        gitIn('config', 'user.email', 'test@example.com');
        const localFile = path.join(tmp, 'a.txt');
        const scratch = path.join(tmp, 'scratch');
        atomicFile(localFile, 'old', scratch);
        atomicFile(localFile, 'v1\n', scratch);
        assert.equal(fs.readFileSync(localFile, 'utf8'), 'v1\n');
        assert.deepEqual(fs.readdirSync(scratch), [], 'Atomic overwrite leaves no staged files');
        gitIn('add', '.');
        gitIn('commit', '-m', 'init');
        const c1 = gitIn('rev-parse', 'HEAD');

        gitIn('checkout', '-b', 'remote-sim');
        fs.writeFileSync(path.join(tmp, 'b.txt'), 'v2\n', 'utf8');
        gitIn('add', '.');
        gitIn('commit', '-m', 'remote 1');
        const c2 = gitIn('rev-parse', 'HEAD');

        fs.writeFileSync(path.join(tmp, 'c.txt'), 'v3\n', 'utf8');
        gitIn('add', '.');
        gitIn('commit', '-m', 'remote 2');
        const c3 = gitIn('rev-parse', 'HEAD');

        gitIn('checkout', 'main');
        gitIn('update-ref', 'refs/remotes/origin/main', c1);

        let fetchCalls = 0;
        const runGit = (...args) => {
            if (args[0] === 'fetch') {
                assert.deepStrictEqual(args, ['fetch', 'origin', 'main']);
                fetchCalls++;
                return '';
            }
            return gitIn(...args);
        };
        const localChanged = () => parseStatus(execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: tmp, encoding: 'utf8' }));

        assert.deepStrictEqual(fastForwardIfClean({ git: runGit, changed: localChanged }), { updated: false, reason: 'up-to-date' });
        assert.strictEqual(fetchCalls, 1);

        gitIn('update-ref', 'refs/remotes/origin/main', c2);
        const ffRes = fastForwardIfClean({ git: runGit, changed: localChanged });
        assert.strictEqual(ffRes.updated, true);
        assert.strictEqual(ffRes.reason, 'fast-forwarded');
        assert.strictEqual(ffRes.behind, 1);
        assert.strictEqual(gitIn('rev-parse', 'HEAD'), c2);
        assert.strictEqual(fetchCalls, 2);

        gitIn('update-ref', 'refs/remotes/origin/main', c3);
        fs.writeFileSync(path.join(tmp, 'dirty.txt'), 'uncommitted\n', 'utf8');
        const dirtyRes = fastForwardIfClean({ git: runGit, changed: localChanged });
        assert.deepStrictEqual(dirtyRes, { updated: false, reason: 'dirty' });
        assert.strictEqual(fetchCalls, 2);
        assert.strictEqual(fs.existsSync(path.join(tmp, 'dirty.txt')), true);
        assert.strictEqual(gitIn('rev-parse', 'HEAD'), c2);
        fs.unlinkSync(path.join(tmp, 'dirty.txt'));

        fs.writeFileSync(path.join(tmp, 'local.txt'), 'local commit\n', 'utf8');
        gitIn('add', '.');
        gitIn('commit', '-m', 'local commit');
        const divergedHead = gitIn('rev-parse', 'HEAD');
        const divRes = fastForwardIfClean({ git: runGit, changed: localChanged });
        assert.strictEqual(divRes.updated, false);
        assert.strictEqual(divRes.reason, 'diverged');
        assert.strictEqual(divRes.behind, 1);
        assert.strictEqual(divRes.ahead, 1);
        assert.strictEqual(fs.existsSync(path.join(tmp, 'local.txt')), true);
        assert.strictEqual(gitIn('rev-parse', 'HEAD'), divergedHead);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}
console.log('sync safety, snapshot, publication and preview tests: OK');
