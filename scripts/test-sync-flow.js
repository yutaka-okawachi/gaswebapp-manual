const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const core = require('./sync/core');
const dashboardPolicy = require('./sync/dashboard-policy');
const source = fs.readFileSync(path.join(__dirname, 'sync/main.js'), 'utf8');

async function scenario({ failCheck = false, failSnapshot = false, failPublish = false, failHeadAt = 0, sourceChanges = false, mode = 'Auto', args = ['--mode', mode], blockResume = false, currentGas = false, blockEnglishResume = false, failGateAt = 0, resumeMode = 'Verify', failResumePublish = false, freshCheckFail = false, freshSnapshotFail = false, resumeMutation = '', pendingDocumentsOnly = false, dashboardRequired = true, configChanged = false, staleDashboard = false, forceDashboard = false, confirm = null, fastForward = null, expectAbort = false, removeLockInVerify = false } = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gmt-sync-test-'));
    fs.mkdirSync(path.join(directory, 'scripts'));
    fs.writeFileSync(path.join(directory, 'scripts/english-publication.json'), JSON.stringify({schemaVersion:1,publishEnglish:false,englishReleaseApproved:false}));
    const events = [];
    const mockSettings = { GAS_DEPLOY_URL: 'https://example.test', GAS_SECRET_TOKEN: 'fake-admin-token',
        DASHBOARD_API_TOKEN: 't'.repeat(32) };
    const settingsHash = dashboardPolicy.dashboardSettingsHash(mockSettings);
    const stateFile = path.join(directory, '.sync-state/state.json');
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    core.atomicJson(stateFile, { dashboardCheck: { commit: '0'.repeat(40),
        verifiedAt: new Date(Date.now() - (staleDashboard ? 8 * 86400000 : 0)).toISOString(),
        settingsHash: configChanged ? '0'.repeat(64) : settingsHash } });
    const expectedApi = dashboardRequired || configChanged || staleDashboard || forceDashboard;
    let head = 'source-head';
    let changes = sourceChanges ? ['src/synthetic.js'] : [];
    let publishFailure = failPublish;
    let headChecks = 0;
    let resumeBlocked = false;
    let gateChecks = 0;
    let checkFailure = failCheck, snapshotFailure = failSnapshot, armedMutation = '';
    let sheetText = 'old sheet text';
    const installedText = [];
    const fakeRequire = name => {
        const stubs = {
            './core': { ...core, root: directory, run: () => { events.push('api'); return ''; }, git: (...args) => args[0] === 'rev-parse' ? head : '' },
            './dashboard-policy': { ...dashboardPolicy, dashboardVerificationRequired: () => { events.push('dashboard-policy'); return dashboardRequired; } },
            './timing': { start() {}, end() {}, measure: (name, action) => action() },
            './logger': {
                c: {}, header: () => {}, success: () => {}, info: () => {},
                warn: () => {}, error: () => {}, wait: () => {}, sub: () => {}, finish: () => { events.push('finish'); }
            },
            './git': {
                preflight: () => { events.push('preflight'); return changes; },
                repoSlug: () => 'owner/repo', changed: () => changes,
                checkRemote: () => { events.push('remote'); return 'remote-head'; },
                ...(fastForward ? { fastForwardIfClean: () => { events.push('fast-forward'); return fastForward(); } } : {}),
                commitChanges: () => { events.push('commit'); head += '-commit'; }
            },
            './gas': {
                configuration: () => mockSettings, fingerprint: () => 'hash',
                prepareBuild: () => {}, inspect: async () => ({ sourceHash: currentGas ? 'hash' : 'old' }),
                ensureDeployment: async (settings, state, save) => { events.push('deploy'); state.gasHash = 'hash'; save(); },
                exportSnapshotForSource: async () => { events.push('snapshot'); return { sourceHash: 'hash', sheetText }; }
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
                validateSnapshot: snapshot => { events.push('validate'); if (snapshotFailure) throw new Error('bad snapshot'); return { notes: snapshot.sheetText }; },
                installSnapshot: values => { events.push('install'); installedText.push(values.notes); },
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
                verifyPages: async () => { events.push('verify'); if (removeLockInVerify) { const lockPath = path.join(directory, '.sync-state/lock.json'); if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath); } if (publishFailure) { publishFailure = false; throw new Error('pending Pages'); } if (armedMutation === 'head') head += '-user-change'; if (armedMutation === 'files') changes = ['README.md']; armedMutation = ''; }
            },
            '../build-site': { build: () => { events.push('build'); } },
            '../check-local': { check: () => { events.push('tests'); if (checkFailure) throw new Error('bad test'); } }
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
        try { await main(forceDashboard ? [...args, '--verify-dashboard'] : args, confirm ? { confirm } : {}); } catch (error) { failed = true; failure = error; }
        if (expectAbort) {
            assert.ok(failed && /ユーザー確認により同期を中止/.test(failure && failure.message));
            for (const stage of ['tests', 'commit', 'deploy', 'push']) assert.ok(!events.includes(stage), stage);
            assert.ok(!fs.existsSync(path.join(directory, '.sync-state/lock.json')));
        } else if (mode === 'Check') {
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
            sheetText = 'edited while publication was pending';
            checkFailure = freshCheckFail; snapshotFailure = freshSnapshotFail;
            armedMutation = resumeMutation;
            if (failResumePublish) publishFailure = true;
            if (pendingDocumentsOnly) {
                const f = path.join(directory, '.sync-state/state.json'), receipt = core.readJson(f);
                receipt.pending.documentsOnly = true; delete receipt.pending.dashboardRequired; core.atomicJson(f, receipt);
            }
            if (blockEnglishResume) {
                const file=path.join(directory,'.sync-state/state.json'), receipt=core.readJson(file);receipt.pending.manifest.hashes['en/index.html']='a'.repeat(64);core.atomicJson(file,receipt);
                await assert.rejects(() => main(['--mode','Verify']), /英語公開ゲート/);
            } else if (blockResume) await assert.rejects(() => main(['--mode', 'Verify']), /editor-only/);
            else if (failResumePublish) await assert.rejects(() => main(['--mode', resumeMode]), /pending Pages/);
            else if (resumeMutation) await assert.rejects(() => main(['--mode', resumeMode]), /ローカル変更/);
            else if (freshCheckFail) await assert.rejects(() => main(['--mode', resumeMode]), /bad test/);
            else if (freshSnapshotFail) await assert.rejects(() => main(['--mode', resumeMode]), /bad snapshot/);
            else await main(['--mode', resumeMode]);
            const resume = events.slice(before);
            if (resumeMode === 'Check') {
                assert(resume.includes('tests'));
                for (const stage of ['head-check', 'snapshot', 'push', 'verify']) assert(!resume.includes(stage));
                assert(core.readJson(path.join(directory, '.sync-state/state.json')).pending);
            } else {
                if (!blockEnglishResume) assert.ok(resume.includes('head-check'));
                if (blockResume || blockEnglishResume) assert.ok(!resume.includes('push') && !resume.includes('verify'));
                else assert.ok(resume.includes('verify'));
                const expectedFinish = !(blockResume || blockEnglishResume || failResumePublish || resumeMutation || freshCheckFail || freshSnapshotFail);
                assert.equal(resume.filter(e => e === 'finish').length, expectedFinish ? 1 : 0, 'No completion message before fresh sync completes');
                const continueFresh = ['Auto', 'Data', 'All'].includes(resumeMode) &&
                    !blockResume && !blockEnglishResume && !failResumePublish && !resumeMutation;
                if (continueFresh) {
                    assert(resume.indexOf('verify') < resume.indexOf('tests'), 'Prior publication completes before fresh checks');
                    if (freshCheckFail) assert(!resume.includes('snapshot'));
                    else assert(resume.indexOf('tests') < resume.indexOf('snapshot'));
                    if (freshCheckFail || freshSnapshotFail) {
                        assert(!resume.includes('install') && !resume.includes('commit'));
                        assert.equal(resume.filter(e => e === 'push').length, 1);
                    } else {
                        assert.equal(resume.filter(e => e === 'snapshot').length, 1);
                        assert.equal(installedText.at(-1), 'edited while publication was pending');
                        assert(resume.indexOf('snapshot') < resume.lastIndexOf('commit'));
                        assert(resume.lastIndexOf('commit') < resume.lastIndexOf('push'));
                        assert.equal(resume.filter(e => e === 'push').length, 2);
                        assert.equal(resume.filter(e => e === 'api').length, expectedApi ? (pendingDocumentsOnly ? 1 : 2) : 0);
                    }
                    assert(!core.readJson(path.join(directory, '.sync-state/state.json')).pending);
                } else {
                    for (const stage of ['deploy', 'snapshot', 'install', 'commit']) assert.ok(!resume.includes(stage), stage);
                    if (failResumePublish) assert(core.readJson(path.join(directory, '.sync-state/state.json')).pending);
                    if (resumeMutation === 'files') assert.deepEqual(changes, ['README.md']);
                    if (resumeMutation === 'head') assert(head.endsWith('-user-change'));
                }
            }
            assert(!fs.existsSync(path.join(directory, '.sync-state/lock.json')), 'Every outcome releases the sync lock');
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
                assert.ok(events.indexOf('install') < events.lastIndexOf('commit'));
            }
            assert.ok(events.lastIndexOf('commit') < events.indexOf('push'));
            assert.ok(events.indexOf('push') < events.indexOf('verify'));
            assert.equal(events.filter(e => e === 'api').length, expectedApi ? 1 : 0);
        }
        const state = core.readJson(path.join(directory, '.sync-state/state.json'), {});
        assert.ok(!JSON.stringify(state).includes('secret'));
        return { events, failure };
    } finally {
        const resolved = path.resolve(directory);
        assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('gmt-sync-test-'));
        fs.rmSync(resolved, { recursive: true, force: true });
    }
}
(async () => {
    const baseline = '1'.repeat(40), candidate = '2'.repeat(40), remote = '3'.repeat(40);
    const verified = { commit: baseline, releaseId: 'release', verifiedAt: '2026-11-20T00:00:00.000Z' };
    const calls = [];
    const mockGit = paths => (...args) => { calls.push(args); return args[0] === 'diff' ? paths : ''; };
    assert.equal(dashboardPolicy.dashboardVerificationRequired(verified, candidate, remote, mockGit('src/sync_build.js\0en/mahler-search-app/data/dic_notes.json\0')), false);
    assert.deepEqual(calls, [['merge-base','--is-ancestor',baseline,remote],['merge-base','--is-ancestor',baseline,candidate],['diff','--name-only','--no-renames','-z',baseline,candidate,'--']]);
    assert.equal(dashboardPolicy.dashboardVerificationRequired(verified, candidate, remote, mockGit('src/web_trigger.js\0')), true, 'Deletions must be classified by old path');
    for (const filename of ['scripts/sync/main.js', 'scripts/sync/dashboard-policy.js', 'scripts/sync/core.js',
        'scripts/sync/gas-head.js', 'src/new_api_handler.js', 'sync-data.ps1']) {
        assert.equal(dashboardPolicy.dashboardVerificationRequired(verified, candidate, remote, mockGit(filename + '\0')),
            true, filename + ' must trigger API verification');
    }
    assert.equal(dashboardPolicy.isDashboardDependency('src/sync_build.js'), false);
    const currentSettings = { GAS_DEPLOY_URL: 'https://example.test', GAS_SECRET_TOKEN: 'admin',
        DASHBOARD_API_TOKEN: 't'.repeat(32) };
    const hash = dashboardPolicy.dashboardSettingsHash(currentSettings);
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.notEqual(hash, dashboardPolicy.dashboardSettingsHash({ ...currentSettings, DASHBOARD_API_TOKEN: 'u'.repeat(32) }));
    const now = Date.parse('2026-11-21T00:00:00.000Z');
    const check = { verifiedAt: '2026-11-20T00:00:00.000Z', settingsHash: hash };
    assert.equal(dashboardPolicy.dashboardCheckFresh(check, hash, now), true);
    assert.equal(dashboardPolicy.dashboardCheckFresh(check, '0'.repeat(64), now), false);
    assert.equal(dashboardPolicy.dashboardCheckFresh(check, hash, now + 8 * 86400000), false);
    assert.equal(dashboardPolicy.dashboardCheckFresh(null, hash, now), false);
    assert.equal(dashboardPolicy.dashboardVerificationRequired(null, candidate, remote, mockGit('')), true);
    assert.equal(dashboardPolicy.dashboardVerificationRequired(verified, candidate, remote, () => { throw new Error('cannot prove ancestry'); }), true);
    assert.equal(dashboardPolicy.dashboardVerificationRequired(verified, candidate, remote, mockGit('bad-output')), true);
    assert.equal(dashboardPolicy.receiptNeedsDashboard({ documentsOnly: true, dashboardRequired: true }), true);
    assert.equal(dashboardPolicy.receiptNeedsDashboard({ documentsOnly: false, dashboardRequired: false }), false);
    assert.equal(dashboardPolicy.receiptNeedsDashboard({ documentsOnly: true }), false);
    assert.equal(dashboardPolicy.receiptNeedsDashboard({ documentsOnly: false }), true);
    await scenario();
    await scenario({ dashboardRequired: false });
    await scenario({ dashboardRequired: false, configChanged: true });
    await scenario({ dashboardRequired: false, staleDashboard: true });
    await scenario({ dashboardRequired: false, forceDashboard: true });
    const skipped = await scenario({ failPublish: true, currentGas: true, resumeMode: 'Verify', dashboardRequired: false });
    assert.equal(skipped.events.filter(e => e === 'dashboard-policy').length, 1, 'Resume uses persisted decision');
    assert.equal(skipped.events.filter(e => e === 'verify').length, 2, 'Pages check still runs');
    assert.ok(!skipped.events.includes('api'));
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
    assert.equal(require('./sync/main').options(['--mode', 'Data', '--verify-dashboard']).verifyDashboard, true);
    assert.throws(() => require('./sync/main').options(['--mode', 'Check', '--verify-dashboard']),
        /requires a publishing or Verify mode/);
    await scenario({ currentGas: true, sourceChanges: true, mode: 'Site' });
    await scenario({ failPublish: true, blockEnglishResume: true });
    for (const failGateAt of [1,2,3,4]) await scenario({ failGateAt });
    for (const resumeMode of ['Auto', 'Data', 'All', 'Site', 'Verify', 'Check'])
        await scenario({ failPublish: true, currentGas: true, resumeMode });
    for (const resumeMode of ['Auto', 'Data', 'All']) {
        await scenario({ failPublish: true, currentGas: true, resumeMode, failResumePublish: true });
        await scenario({ failPublish: true, currentGas: true, resumeMode, freshCheckFail: true });
        await scenario({ failPublish: true, currentGas: true, resumeMode, freshSnapshotFail: true });
        for (const resumeMutation of ['files', 'head'])
            await scenario({ failPublish: true, currentGas: true, resumeMode, resumeMutation });
    }
    await scenario({ failPublish: true, currentGas: true, resumeMode: 'Auto', pendingDocumentsOnly: true });

    let confirmCalls = 0;
    await scenario({ sourceChanges: true, expectAbort: true, confirm: async () => { confirmCalls++; return false; } });
    assert.strictEqual(confirmCalls, 1);

    confirmCalls = 0;
    await scenario({ sourceChanges: true, confirm: async () => { confirmCalls++; return true; } });
    assert.strictEqual(confirmCalls, 1);

    confirmCalls = 0;
    await scenario({ sourceChanges: true, args: ['--mode', 'Auto', '--yes'], confirm: async () => { confirmCalls++; return false; } });
    assert.strictEqual(confirmCalls, 0);

    confirmCalls = 0;
    await scenario({ sourceChanges: false, confirm: async () => { confirmCalls++; return false; } });
    assert.strictEqual(confirmCalls, 0);

    confirmCalls = 0;
    await scenario({ mode: 'Check', sourceChanges: true, confirm: async () => { confirmCalls++; return false; } });
    assert.strictEqual(confirmCalls, 0);

    const ffResult = await scenario({
        sourceChanges: false,
        fastForward: () => ({ updated: true, reason: 'fast-forwarded', behind: 1, before: '1111111', after: '2222222' })
    });
    assert.ok(ffResult.events.indexOf('fast-forward') !== -1);
    assert.ok(ffResult.events.indexOf('fast-forward') < ffResult.events.indexOf('build'));
    assert.ok(ffResult.events.indexOf('fast-forward') < ffResult.events.indexOf('tests'));
    assert.strictEqual(ffResult.events.filter(e => e === 'preflight').length, 2);

    const dirtyFfResult = await scenario({
        sourceChanges: true,
        fastForward: () => ({ updated: true, reason: 'fast-forwarded', behind: 1, before: '1111111', after: '2222222' })
    });
    assert.ok(!dirtyFfResult.events.includes('fast-forward'));

    await scenario({ removeLockInVerify: true });

    console.log('sync workflow ordering and failure recovery tests: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
