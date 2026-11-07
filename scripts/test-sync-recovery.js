'use strict';
const assert = require('assert/strict'), fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm');
const core = require('./sync/core'), recovery = require('./sync/recovery');
const { options } = require('./sync/main');
assert.equal(options(['--mode', 'Recover']).mode, 'Recover');
assert.equal(options(['--mode', 'Recover', '--apply-recovery']).applyRecovery, true);
for (const mode of ['Auto', 'Data', 'All', 'Site', 'Check', 'Verify'])
    assert.throws(() => options(['--mode', mode, '--apply-recovery']), /requires Recover/);
require('./sync/timing').createRecorder({ mode: 'Recover', write() {}, output() {} }).close('success');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gmt-recovery-test-'));
const write = (root, file, value) => { const target = path.join(root, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value); };
const stateFile = '.sync-state/state.json';
function fixture(name) {
    const live = path.join(directory, name, 'live'), stage = path.join(directory, name, 'stage'), journal = path.join(directory, name, 'journal');
    fs.mkdirSync(journal, { recursive: true });
    const old = { 'frontend/input.js': 'source', 'mahler-search-app/data/dic_notes.json': 'old notes', 'en/mahler-search-app/dic.html': 'old english', '.sync-state/english/snapshot.json': 'old cache', [stateFile]: JSON.stringify({ pending: { commit: 'keep-until-success' }, gasHash: 'keep' }) };
    const next = { 'mahler-search-app/data/dic_notes.json': 'new notes', 'en/mahler-search-app/dic.html': 'new english', '.sync-state/english/snapshot.json': 'new cache', 'mahler-search-app/js/new.js': 'new generated' };
    for (const [f, value] of Object.entries(old)) write(live, f, value);
    for (const [f, value] of Object.entries(next)) write(stage, f, value);
    write(stage, stateFile, JSON.stringify({ ownedData: { sample: 'hash' }, gasHash: 'keep' }));
    const hashes = recovery.capture(stage, Object.keys(next)), report = { hashes };
    const baseline = recovery.capture(live, [...Object.keys(next), ...Object.keys(old)]);
    return { live, stage, journal, old, next, report, baseline };
}
function unchanged(f) { for (const [file, value] of Object.entries(f.old)) assert.equal(fs.readFileSync(path.join(f.live, file), 'utf8'), value); assert(!fs.existsSync(path.join(f.live, 'mahler-search-app/js/new.js'))); }
async function route(apply, fail) {
    const root = path.join(directory, 'route-' + apply + '-' + fail); fs.mkdirSync(root, { recursive: true });
    const original = { pending: { commit: 'must-not-resume' }, ownedData: {}, gasHash: 'preserve' };
    write(root, stateFile, JSON.stringify(original));
    write(root, '.env', 'must-not-read');
    let calls = 0;
    const forbidden = () => { throw new Error('unexpected normal-sync action'); };
    const stubs = {
        './core': { ...core, root, run: forbidden, git: forbidden },
        './git': { preflight: () => [], changed: forbidden }, './gas': {}, './gas-head': {}, './artifacts': {},
        './bilingual': { publicationTicket: () => ({}), assertPublicTree() {} }, './publish': {},
        './timing': { start() {}, end() {} }, './logger': { header() {}, info() {}, success() {} },
        '../build-site': { build: forbidden }, '../check-local': { check: forbidden },
        './recovery': { recover: async opt => { calls++; assert.equal(!!opt.applyRecovery, apply); if (fail) throw Error('staged failure'); } }
    };
    const moduleObject = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'sync/main.js'), 'utf8'), { require: n => stubs[n] || require(n), module: moduleObject, process, console });
    const args = ['--mode', 'Recover', ...(apply ? ['--apply-recovery'] : [])];
    if (fail) await assert.rejects(moduleObject.exports.main(args), /staged failure/); else await moduleObject.exports.main(args);
    assert.equal(calls, 1); assert.deepEqual(core.readJson(path.join(root, stateFile)), original);
    assert(!fs.existsSync(path.join(root, '.sync-state/lock.json')));
}
(async () => {
    try {
        for (const value of ['../escape', '/escape', 'a/../b', 'a\\b', 'C:/escape', 'a//b', './a']) assert.throws(() => recovery.safePath(directory, value));
        let f = fixture('copy');
        const inputs = recovery.capture(f.live, Object.keys(f.old)); recovery.copyInputs(f.live, f.stage, inputs);
        recovery.assertHashes(f.stage, inputs); unchanged(f);
        write(f.live, 'mahler-search-app/data/dic_notes.json', 'edited during copy');
        assert.throws(() => recovery.copyInputs(f.live, f.stage, inputs), /変更/);
        f = fixture('tamper-stage'); write(f.stage, 'en/mahler-search-app/dic.html', 'tampered');
        assert.throws(() => recovery.install(f.live, f.stage, f.report, f.baseline, f.journal), /変更/); unchanged(f);
        f = fixture('tamper-between-reads');
        const originalRead = fs.readFileSync, target = path.join(f.stage, 'mahler-search-app/data/dic_notes.json'); let stageReads = 0;
        try {
            fs.readFileSync = function(file, ...args) {
                if (path.resolve(String(file)) === target && ++stageReads === 2) fs.writeFileSync(target, 'changed after hash check');
                return originalRead.call(this, file, ...args);
            };
            assert.throws(() => recovery.install(f.live, f.stage, f.report, f.baseline, f.journal), /変更/);
        } finally { fs.readFileSync = originalRead; }
        unchanged(f);
        for (const changed of ['mahler-search-app/data/dic_notes.json', '.sync-state/english/snapshot.json', stateFile]) {
            f = fixture('concurrent-' + changed.replace(/[^a-z]/g, ''));
            write(f.live, changed, 'user edit');
            assert.throws(() => recovery.install(f.live, f.stage, f.report, f.baseline, f.journal), /変更/);
            assert.equal(fs.readFileSync(path.join(f.live, changed), 'utf8'), 'user edit');
            assert(!fs.existsSync(path.join(f.journal, 'install.json')));
        }
        for (const afterWrite of [false, true]) {
            f = fixture('rollback-' + afterWrite); let count = 0;
            assert.throws(() => recovery.install(f.live, f.stage, f.report, f.baseline, f.journal, { replace(file, bytes) {
                count++; if (count === 3 && !afterWrite) throw Error('injected disk failure');
                recovery.replace(file, bytes); if (count === 3) throw Error('injected disk failure');
            } }), /injected/);
            unchanged(f); assert.equal(core.readJson(path.join(f.journal, 'install.json')).status, 'rolled-back');
        }
        f = fixture('rollback-new-file'); let count = 0;
        assert.throws(() => recovery.install(f.live, f.stage, f.report, f.baseline, f.journal, { replace(file, bytes) {
            recovery.replace(file, bytes); if (++count === 4) throw Error('new file failure');
        } }), /new file failure/); unchanged(f);
        f = fixture('rollback-incomplete'); count = 0;
        assert.throws(() => recovery.install(f.live, f.stage, f.report, f.baseline, f.journal, {
            replace(file, bytes) { if (++count === 2) throw Error('disk failure'); recovery.replace(file, bytes); },
            restore() { throw Error('restore failure'); }
        }), /巻戻しが未完了/);
        assert.equal(core.readJson(path.join(f.journal, 'install.json')).status, 'rollback-incomplete');
        assert(fs.existsSync(path.join(f.journal, 'backup/mahler-search-app/data/dic_notes.json')));
        f = fixture('source-during-install'); count = 0;
        assert.throws(() => recovery.install(f.live, f.stage, f.report, f.baseline, f.journal, { replace(file, bytes) {
            recovery.replace(file, bytes); if (++count === 1) write(f.live, 'frontend/input.js', 'concurrent source edit');
        } }), /変更/);
        assert.equal(fs.readFileSync(path.join(f.live, 'frontend/input.js'), 'utf8'), 'concurrent source edit');
        f.old['frontend/input.js'] = 'concurrent source edit'; unchanged(f);
        f = fixture('git-during-install'); let contextChecks = 0;
        assert.throws(() => recovery.install(f.live, f.stage, f.report, f.baseline, f.journal, { assertContext() {
            if (++contextChecks === 2) throw Error('Git changed');
        } }), /Git changed/); unchanged(f);
        const snapshotFile = path.join(directory, 'snapshot.json'); fs.writeFileSync(snapshotFile, '{"requestId":"valid"}');
        const snapshotHash = core.sha256(fs.readFileSync(snapshotFile));
        assert.equal(recovery.readSnapshot(snapshotFile, snapshotHash).requestId, 'valid');
        fs.writeFileSync(snapshotFile, '{"requestId":"tampered"}');
        assert.throws(() => recovery.readSnapshot(snapshotFile, snapshotHash), /変更/);
        f = fixture('success');
        const changed = recovery.install(f.live, f.stage, f.report, f.baseline, f.journal);
        assert.equal(changed.length, 5); recovery.assertHashes(f.live, f.report.hashes);
        assert.deepEqual(core.readJson(path.join(f.live, stateFile)), { ownedData: { 'mahler-search-app/data/dic_notes.json': core.sha256('new notes'), 'en/mahler-search-app/dic.html': core.sha256('new english') }, gasHash: 'keep' });
        assert.equal(core.readJson(path.join(f.journal, 'install.json')).status, 'installed');
        for (const apply of [false, true]) for (const fail of [false, true]) await route(apply, fail);
        console.log('Recovery: isolated copies, path guards, staged tamper/live cache-state conflicts, rollback before/after writes, new-file rollback, retained incomplete rollback, successful install, default/apply routing, pending preservation and lock release passed.');
    } finally {
        const resolved = path.resolve(directory);
        assert(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('gmt-recovery-test-'));
        fs.rmSync(resolved, { recursive: true, force: true });
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
