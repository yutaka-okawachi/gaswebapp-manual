const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { root, git, run, atomicJson, readJson, sha256, normalizeText } = require('./core');
const repository = require('./git');
const gas = require('./gas');
const artifacts = require('./artifacts');
const publication = require('./publish');
const { build } = require('../build-site');
const { check } = require('../check-local');
const { startPreview } = require('../preview-site');
const directory = path.join(root, '.sync-state');
function options(args) {
    const result = { mode: 'Auto', message: '自動同期アップデート', allowRemoval: false };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--mode') result.mode = args[++i];
        else if (args[i] === '--message') result.message = args[++i];
        else if (args[i] === '--allow-data-removal') result.allowRemoval = true;
        else throw new Error(`Unknown argument: ${args[i]}`);
    }
    if (!['Auto', 'Data', 'Site', 'All', 'Check', 'Verify'].includes(result.mode)) throw new Error('Invalid mode');
    return result;
}
function plan(mode, files, gasChanged) {
    const documentsOnly = files.length > 0 && files.every(file => /^(manuals\/|README\.md$|CHANGELOG\.md$)/.test(file));
    if (mode === 'Site' && gasChanged) throw new Error('GAS に未反映の変更があります。通常の sync-data を実行してください。');
    return {
        deploy: mode !== 'Site' && gasChanged,
        data: ['All', 'Data'].includes(mode) || (mode === 'Auto' && (gasChanged || files.length === 0 || files.some(file => file.startsWith('src/')))),
        documentsOnly: documentsOnly && !gasChanged
    };
}
function lock() {
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, 'lock.json');
    if (fs.existsSync(file)) {
        const old = readJson(file);
        try { process.kill(old.pid, 0); throw new Error('別の sync-data が実行中です。'); }
        catch (e) { if (e.code !== 'ESRCH') throw e; }
        fs.unlinkSync(file);
    }
    const fd = fs.openSync(file, 'wx');
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid }));
    fs.closeSync(fd);
    return () => fs.unlinkSync(file);
}
async function verify(state, settings, credential, slug, save) {
    const receipt = state.pending;
    if (!receipt || !receipt.commit) throw new Error('再開可能な公開記録がありません。通常の sync-data を実行してください。');
    if (git('rev-parse', 'HEAD') !== receipt.commit) throw new Error('未完了の公開後に HEAD が変更されています。先に元の公開コミットの確認が必要です。');
    if (!receipt.approved) {
        console.log('画面を確認し、プレビュー内の公開ボタンを押してください。中断する場合は Ctrl+C。');
        const preview = await startPreview({ approval: true, open: true });
        await preview.approved;
        await preview.close();
        if (repository.changed().length || git('rev-parse', 'HEAD') !== receipt.commit) throw new Error('プレビュー中にファイルが変更されました。再確認が必要です。');
        receipt.approved = true;
        save();
    }
    publication.push(); // An interrupted push can safely be retried without a new commit.
    console.log('最終コミットの Pages 公開と全公開ファイルを確認します。');
    await publication.verifyPages(slug, receipt.commit, credential, receipt.baseUrl, receipt.manifest);
    if (!receipt.documentsOnly) {
        process.stdout.write(run(process.platform === 'win32' ? 'powershell.exe' : 'pwsh',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/verify-dashboard.ps1', '-BaseUrl', settings.GAS_DEPLOY_URL]));
    }
    state.lastSuccess = { commit: receipt.commit, releaseId: receipt.manifest.releaseId, gasHash: state.gasHash, verifiedAt: new Date().toISOString() };
    delete state.pending;
    delete state.ownedData;
    save();
    console.log('完了: GitHub Pages の公開内容を確認しました。' + (receipt.documentsOnly ? '' : ' ダッシュボード API も正常です。'));
}
async function main(args = process.argv.slice(2)) {
    const opt = options(args);
    const release = lock();
    try {
        const stateFile = path.join(directory, 'state.json');
        const state = readJson(stateFile, {});
        const save = () => atomicJson(stateFile, state);
        console.log('事前確認を開始します。');
        const sourceFiles = repository.preflight(state.ownedData || {});
        if (opt.mode !== 'Check' && state.pending && !state.pending.approved &&
            (sourceFiles.length || git('rev-parse', 'HEAD') !== state.pending.commit)) {
            delete state.pending; // An edited preview must be rebuilt and approved again.
            save();
        }
        if (opt.mode === 'Verify' || (opt.mode !== 'Check' && state.pending && state.pending.commit)) {
            return await verify(state, gas.configuration(), publication.token(), repository.repoSlug(), save);
        }
        if (fs.existsSync(path.join(root, '.env'))) run(process.execPath, ['src/update_env.js']);
        build();
        gas.prepareBuild();
        check();
        if (opt.mode === 'Check') { console.log('確認のみ完了しました。本番への変更はありません。'); return; }
        const settings = gas.configuration();
        const credential = publication.token();
        const slug = repository.repoSlug();
        const baseUrl = await publication.preflight(slug, credential);
        const remote = repository.checkRemote();
        const unpushed = git('diff', '--name-only', 'origin/main', 'HEAD').split('\n').filter(Boolean);
        const files = [...new Set([...sourceFiles, ...unpushed])];
        const observedGas = await gas.inspect(settings);
        const selected = plan(opt.mode, files, !observedGas || observedGas.sourceHash !== gas.fingerprint());
        // Save a source checkpoint before mutating the live GAS deployment.
        repository.commitChanges(opt.message);
        if (selected.deploy && state.gasApproval !== gas.fingerprint()) {
            console.log('GAS更新前に現在のデータで画面を確認してください。最新データ取得後にも公開前確認を行います。');
            const expectedHead = git('rev-parse', 'HEAD');
            const preview = await startPreview({ approval: true, open: true, phase: 'prepare' });
            await preview.approved;
            await preview.close();
            if (repository.changed().length || git('rev-parse', 'HEAD') !== expectedHead) throw new Error('確認中にソースが変更されました。再実行してください。');
            state.gasApproval = gas.fingerprint();
            save();
        }
        if (!selected.documentsOnly && opt.mode !== 'Site') await gas.ensureDeployment(settings, state, save, observedGas);
        if (selected.data) {
            console.log('スプレッドシートからデータを取得・検証します。');
            const requestId = crypto.randomUUID();
            const snapshot = await gas.exportSnapshot(settings, requestId);
            if (snapshot.sourceHash !== gas.fingerprint()) throw new Error('GAS 生成元とローカルソースが一致しません。');
            const values = artifacts.validateSnapshot(snapshot, requestId, artifacts.previousData(), opt.allowRemoval);
            // A receipt allows safe recovery from interruption while installing files.
            state.ownedData = Object.fromEntries(Object.entries(values).map(([file, value]) =>
                [file, sha256(normalizeText(typeof value === 'string' ? value : JSON.stringify(value)))]));
            save();
            artifacts.installSnapshot(values);
        }
        const allChanged = [...new Set([...files, ...repository.changed()])];
        artifacts.updateSitemap(allChanged);
        const manifest = artifacts.releaseManifest();
        repository.commitChanges('Sync: validated data and site artifacts');
        // No automatic rebase after deployment: another writer must never be silently merged.
        if (repository.checkRemote() !== remote) throw new Error('同期中にリモートが変更されました。公開を停止しました。');
        state.pending = { commit: git('rev-parse', 'HEAD'), baseUrl, manifest, documentsOnly: selected.documentsOnly };
        save();
        await verify(state, settings, credential, slug, save);
    } finally { release(); }
}
if (require.main === module) main().catch(error => { console.error(`[未完了] ${error.message}`); process.exitCode = 1; });
module.exports = { options, plan, main };
