const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const core = require('./sync/core');
const source = fs.readFileSync(path.join(__dirname, 'sync/main.js'), 'utf8');

async function scenario({ failCheck = false, failSnapshot = false, failPublish = false, failHeadAt = 0, sourceChanges = false, mode = 'Auto', blockResume = false, currentGas = false, blockEnglishResume = false, failGateAt = 0 } = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gmt-sync-test-'));
    fs.mkdirSync(path.join(directory, 'scripts'));
    fs.writeFileSync(path.join(directory, 'scripts/english-publication.json'), JSON.stringify({schemaVersion:1,publishEnglish:false,englishReleaseApproved:false}));
    const events = [];
    let head = 'source-head';
    let changes = sourceChanges ? ['src/synthetic.js'] : [];
    let publishFailure = failPublish;
    let headChecks = 0;
    let resumeBlocked = false;
    let gateChecks = 0;
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
                expectedPaths: [], previousData: () => ({}),
                validateSnapshot: () => { events.push('validate'); if (failSnapshot) throw new Error('bad snapshot'); return {}; },
                installSnapshot: () => { events.push('install'); },
                updateSitemap: () => {}, releaseManifest: () => ({ releaseId: 'release', hashes: { 'index.html': 'a'.repeat(64) } }),
                formatJson: (file, value) => typeof value === 'string' ? value : JSON.stringify(value)
            },
            './bilingual': {
                publicationTicket: () => ({}), assertPolicyUnchanged: () => { gateChecks++; if (gateChecks === failGateAt) throw new Error('gate changed'); }, assertPublicTree: () => {}, assertReleaseManifest: manifest => { events.push('gate-manifest-check'); require('./sync/bilingual').assertReleaseManifest(manifest, directory); }, englishEnabled: () => false,
                prepare: (snapshot, requestId, previous, allow) => { events.push('english-build'); return { japanese: stubs['./artifacts'].validateSnapshot(snapshot, requestId, previous, allow), english: {} }; },
                stage: () => { events.push('english-stage'); return { publishedEnglish: false }; },
                refreshStage: () => { events.push('english-refresh'); }
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
        } else if (failGateAt) {
            assert.ok(failed); assert.ok(!events.includes('push'));
            if (failGateAt === 1) assert.ok(!events.includes('commit') && !events.includes('deploy'));
            if (failGateAt === 2) assert.ok(!events.includes('english-stage') && !events.includes('install'));
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
            if (blockEnglishResume) {
                const file=path.join(directory,'.sync-state/state.json'), receipt=core.readJson(file);receipt.pending.manifest.hashes['en/index.html']='a'.repeat(64);core.atomicJson(file,receipt);
                await assert.rejects(() => main(['--mode','Verify']), /英語公開ゲート/);
            } else if (blockResume) await assert.rejects(() => main(['--mode', 'Verify']), /editor-only/);
            else await main([]);
            const resume = events.slice(before);
            if (!blockEnglishResume) assert.ok(resume.includes('head-check'));
            if (blockResume || blockEnglishResume) assert.ok(!resume.includes('push') && !resume.includes('verify'));
            else assert.ok(resume.includes('verify'));
            for (const stage of ['deploy', 'snapshot', 'install', 'commit']) assert.ok(!resume.includes(stage), stage);
        } else {
            assert.ok(!failed, failure && failure.stack);
            if (currentGas && mode === 'Site') {
                assert.ok(!events.includes('deploy') && !events.includes('snapshot'));
                assert.ok(events.includes('english-refresh'));
                assert.equal(events.filter(event => event === 'build').length, 2, 'Site release regenerates Japanese dictionary navigation');
            } else assert.ok(events.indexOf('tests') < events.indexOf('deploy'));
            assert.ok(events.indexOf('head-check') < events.indexOf('commit'));
            if (!(currentGas && mode === 'Site')) {
                assert.ok(events.indexOf('validate') < events.indexOf('english-stage'));
                assert.ok(events.indexOf('english-stage') < events.indexOf('install'));
                assert.ok(events.indexOf('install') < events.indexOf('commit'));
            }
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
    await scenario({ currentGas: true, sourceChanges: true, mode: 'Site' });
    await scenario({ failPublish: true, blockEnglishResume: true });
    for (const failGateAt of [1,2,3,4]) await scenario({ failGateAt });
    console.log('sync workflow ordering and failure recovery tests: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
