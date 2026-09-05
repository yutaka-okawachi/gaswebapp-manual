const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const core = require('./sync/core');
const source = fs.readFileSync(path.join(__dirname, 'sync/main.js'), 'utf8');

async function scenario({ failCheck = false, failSnapshot = false, failPublish = false, editDuringPreview = false } = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gmt-sync-test-'));
    const events = [];
    let head = 'source-head';
    let changes = [];
    let publishFailure = failPublish;
    const fakeRequire = name => {
        const stubs = {
            './core': { ...core, root: directory, run: () => '', git: (...args) => args[0] === 'rev-parse' ? head : '' },
            './git': {
                preflight: () => { events.push('preflight'); return changes; },
                repoSlug: () => 'owner/repo', changed: () => changes,
                checkRemote: () => { events.push('remote'); return 'remote-head'; },
                commitChanges: () => { events.push('commit'); head += '-commit'; }
            },
            './gas': {
                configuration: () => ({ GAS_DEPLOY_URL: 'https://example.test' }), fingerprint: () => 'hash',
                prepareBuild: () => {}, inspect: async () => ({ sourceHash: 'old' }),
                ensureDeployment: async (settings, state, save) => { events.push('deploy'); state.gasHash = 'hash'; save(); },
                exportSnapshot: async () => { events.push('snapshot'); return { sourceHash: 'hash' }; }
            },
            './artifacts': {
                previousData: () => ({}),
                validateSnapshot: () => { events.push('validate'); if (failSnapshot) throw new Error('bad snapshot'); return {}; },
                installSnapshot: () => { events.push('install'); },
                updateSitemap: () => {}, releaseManifest: () => ({ releaseId: 'release', hashes: {} })
            },
            './publish': {
                token: () => 'secret', preflight: async () => 'https://example.test/',
                push: () => { events.push('push'); },
                verifyPages: async () => { events.push('verify'); if (publishFailure) { publishFailure = false; throw new Error('pending Pages'); } }
            },
            '../build-site': { build: () => { events.push('build'); } },
            '../check-local': { check: () => { events.push('tests'); if (failCheck) throw new Error('bad test'); } },
            '../preview-site': { startPreview: async ({ phase }) => {
                events.push(phase === 'prepare' ? 'prepare-approval' : 'publish-approval');
                if (editDuringPreview) changes = ['index.html'];
                return { approved: Promise.resolve(), close: async () => {} };
            } }
        };
        return Object.hasOwn(stubs, name) ? stubs[name] : require(name);
    };
    const exports = {};
    const context = vm.createContext({ require: fakeRequire, module: { exports }, exports, process,
        console: { log() {}, error() {} } });
    vm.runInContext(source, context);
    const main = context.module.exports.main;
    try {
        let failed = false;
        try { await main([]); } catch (_) { failed = true; }
        if (failCheck) {
            assert.ok(failed);
            assert.ok(!events.includes('deploy') && !events.includes('push'));
        } else if (failSnapshot) {
            assert.ok(failed);
            assert.ok(!events.includes('install') && !events.includes('push'));
        } else if (editDuringPreview) {
            assert.ok(failed);
            assert.ok(!events.includes('deploy') && !events.includes('push'));
        } else if (failPublish) {
            assert.ok(failed);
            const before = events.length;
            await main([]);
            const resume = events.slice(before);
            assert.ok(resume.includes('verify'));
            for (const stage of ['deploy', 'snapshot', 'install', 'commit', 'publish-approval']) assert.ok(!resume.includes(stage), stage);
        } else {
            assert.ok(!failed);
            assert.ok(events.indexOf('tests') < events.indexOf('deploy'));
            assert.ok(events.indexOf('prepare-approval') < events.indexOf('deploy'));
            assert.ok(events.indexOf('validate') < events.indexOf('install'));
            assert.ok(events.indexOf('publish-approval') < events.indexOf('push'));
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
    await scenario({ editDuringPreview: true });
    console.log('sync workflow ordering and failure recovery tests: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
