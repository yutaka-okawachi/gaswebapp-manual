const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const core = require('./sync/core');
const source = fs.readFileSync(path.join(__dirname, 'sync/main.js'), 'utf8');

async function scenario({ failCheck = false, failSnapshot = false, failPublish = false, failHeadAt = 0, sourceChanges = false, mode = 'Auto', blockResume = false, currentGas = false } = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gmt-sync-test-'));
    const events = [];
    let head = 'source-head';
    let changes = sourceChanges ? ['src/synthetic.js'] : [];
    let publishFailure = failPublish;
    let headChecks = 0;
    let resumeBlocked = false;
    const fakeRequire = name => {
        const stubs = {
            './core': { ...core, root: directory, run: () => '', git: (...args) => args[0] === 'rev-parse' ? head : '' },
            './logger': {
                c: {}, header: () => {}, success: () => {}, info: () => {},
                warn: () => {}, error: () => {}, wait: () => {}, sub: () => {}, finish: () => {}
            },
            './git': {
                preflight: () => { events.push('preflight'); return changes; },
                repoSlug: () => 'owner/repo', changed: () => changes,
                checkRemote: () => { events.push('remote'); return 'remote-head'; },
                commitChanges: () => { events.push('commit'); head += '-commit'; }
            },
            './gas': {
                configuration: () => ({ GAS_DEPLOY_URL: 'https://example.test' }), fingerprint: () => 'hash',
                prepareBuild: () => {}, inspect: async () => ({ sourceHash: currentGas ? 'hash' : 'old' }),
                ensureDeployment: async (settings, state, save) => { events.push('deploy'); state.gasHash = 'hash'; save(); },
                exportSnapshotForSource: async () => { events.push('snapshot'); return { sourceHash: 'hash' }; }
            },
            './gas-head': {
                preflight: async () => {
                    events.push('head-check');
                    headChecks++;
                    if (headChecks === failHeadAt || resumeBlocked) throw new Error('editor-only files');
                    return {};
                }
            },
            './artifacts': {
                previousData: () => ({}),
                validateSnapshot: () => { events.push('validate'); if (failSnapshot) throw new Error('bad snapshot'); return {}; },
                installSnapshot: () => { events.push('install'); },
                updateSitemap: () => {}, releaseManifest: () => ({ releaseId: 'release', hashes: {} }),
                formatJson: (file, value) => typeof value === 'string' ? value : JSON.stringify(value)
            },
            './publish': {
                token: () => 'secret', preflight: async () => 'https://example.test/',
                push: () => { events.push('push'); },
                verifyPages: async () => { events.push('verify'); if (publishFailure) { publishFailure = false; throw new Error('pending Pages'); } }
            },
            '../build-site': { build: () => { events.push('build'); } },
            '../check-local': { check: () => { events.push('tests'); if (failCheck) throw new Error('bad test'); } }
        };
        return Object.hasOwn(stubs, name) ? stubs[name] : require(name);
    };
    const exports = {};
    const context = vm.createContext({ require: fakeRequire, module: { exports }, exports, process,
        console: { log() {}, error() {} } });
    vm.runInContext(source, context);
    const main = context.module.exports.main;
    try {
        let failed = false, failure;
        try { await main(['--mode', mode]); } catch (error) { failed = true; failure = error; }
        if (mode === 'Check') {
            assert.ok(!failed, failure && failure.stack);
            assert.ok(events.includes('tests'));
            for (const stage of ['head-check', 'commit', 'deploy', 'snapshot', 'push']) assert.ok(!events.includes(stage), stage);
        } else if (failHeadAt) {
            assert.ok(failed);
            assert.ok(!events.includes('push'));
            if (failHeadAt === 1) for (const stage of ['commit', 'deploy', 'snapshot', 'install']) assert.ok(!events.includes(stage), stage);
            if (failHeadAt === 2) assert.equal(events.filter(event => event === 'commit').length, sourceChanges ? 1 : 0);
        } else if (failCheck) {
            assert.ok(failed);
            assert.ok(!events.includes('deploy') && !events.includes('push'));
        } else if (failSnapshot) {
            assert.ok(failed);
            assert.ok(!events.includes('install') && !events.includes('push'));
        } else if (failPublish) {
            assert.ok(failed);
            const before = events.length;
            resumeBlocked = blockResume;
            // After checkpoint commits the working tree is clean on resume.
            changes = [];
            if (blockResume) await assert.rejects(() => main(['--mode', 'Verify']), /editor-only/);
            else await main([]);
            const resume = events.slice(before);
            assert.ok(resume.includes('head-check'));
            if (blockResume) assert.ok(!resume.includes('push') && !resume.includes('verify'));
            else assert.ok(resume.includes('verify'));
            for (const stage of ['deploy', 'snapshot', 'install', 'commit']) assert.ok(!resume.includes(stage), stage);
        } else {
            assert.ok(!failed, failure && failure.stack);
            assert.ok(events.indexOf('tests') < events.indexOf('deploy'));
            assert.ok(events.indexOf('head-check') < events.indexOf('commit'));
            assert.ok(events.indexOf('validate') < events.indexOf('install'));
            assert.ok(events.indexOf('install') < events.indexOf('commit'));
            assert.ok(events.indexOf('commit') < events.indexOf('push'));
            assert.ok(events.indexOf('push') < events.indexOf('verify'));
        }
        const state = core.readJson(path.join(directory, '.sync-state/state.json'), {});
        assert.ok(!JSON.stringify(state).includes('secret'));
    } finally {
        const resolved = path.resolve(directory);
        assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('gmt-sync-test-'));
        fs.rmSync(resolved, { recursive: true, force: true });
    }
}
(async () => {
    await scenario();
    await scenario({ failCheck: true });
    await scenario({ failSnapshot: true });
    await scenario({ failPublish: true });
    await scenario({ failHeadAt: 1, sourceChanges: true });
    await scenario({ failHeadAt: 1, sourceChanges: true, currentGas: true });
    await scenario({ failHeadAt: 1, sourceChanges: true, currentGas: true, mode: 'Site' });
    await scenario({ failHeadAt: 2, sourceChanges: true });
    await scenario({ failHeadAt: 3 });
    await scenario({ failPublish: true, blockResume: true });
    await scenario({ mode: 'Check' });
    console.log('sync workflow ordering and failure recovery tests: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
