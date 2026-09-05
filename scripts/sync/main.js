const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { root, git, run, atomicJson, readJson, sha256, normalizeText } = require('./core');
const repository = require('./git');
const gas = require('./gas');
const artifacts = require('./artifacts');
const publication = require('./publish');
const logger = require('./logger');
const { build } = require('../build-site');
const { check } = require('../check-local');
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

    logger.header(6, 7, 'GitHub への送信');
    logger.info(`コミット ${receipt.commit.slice(0, 7)} を GitHub (origin/main) へ送信中…`);
    publication.push(); // An interrupted push can safely be retried without a new commit.
    logger.success('GitHub リモートへのプッシュが完了しました。');

    logger.header(7, 7, 'GitHub Pages 公開確認 & ダッシュボード API 検査');
    logger.info('最終コミットの Pages 公開と全公開ファイルを確認します。');
    await publication.verifyPages(slug, receipt.commit, credential, receipt.baseUrl, receipt.manifest);
    logger.success('GitHub Pages への全公開ファイル反映を確認しました。');

    if (!receipt.documentsOnly) {
        logger.info('管理者ダッシュボード API の応答を検査中…');
        process.stdout.write(run(process.platform === 'win32' ? 'powershell.exe' : 'pwsh',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/verify-dashboard.ps1', '-BaseUrl', settings.GAS_DEPLOY_URL]));
        logger.success('ダッシュボード API 正常性確認 (7/30/90日)');
    }

    state.lastSuccess = { commit: receipt.commit, releaseId: receipt.manifest.releaseId, gasHash: state.gasHash, verifiedAt: new Date().toISOString() };
    delete state.pending;
    delete state.ownedData;
    save();
    logger.finish('同期完了: GitHub Pages の公開内容を確認しました。' + (receipt.documentsOnly ? '' : ' ダッシュボード API も正常です。'));
}

async function main(args = process.argv.slice(2)) {
    const opt = options(args);
    const release = lock();
    try {
        const stateFile = path.join(directory, 'state.json');
        const state = readJson(stateFile, {});
        const save = () => atomicJson(stateFile, state);

        logger.header(1, 7, '事前確認と環境検証');
        logger.info('Git 作業ツリーと実行前条件を検査中…');
        const sourceFiles = repository.preflight(state.ownedData || {});
        logger.success(`事前確認完了 (ブランチ: main, 検出変更: ${sourceFiles.length ? sourceFiles.length + '件' : 'なし'})`);

        if (opt.mode !== 'Check' && state.pending &&
            (sourceFiles.length || git('rev-parse', 'HEAD') !== state.pending.commit)) {
            delete state.pending;
            save();
        }
        if (opt.mode === 'Verify' || (opt.mode !== 'Check' && state.pending && state.pending.commit)) {
            logger.info('未完了の公開記録が見つかりました。確認工程を再開します。');
            return await verify(state, gas.configuration(), publication.token(), repository.repoSlug(), save);
        }

        if (fs.existsSync(path.join(root, '.env'))) {
            run(process.execPath, ['src/update_env.js']);
            logger.sub('環境変数を同期しました (.env)');
        }

        logger.header(2, 7, 'サイト組み立てとローカル検証');
        build();
        gas.prepareBuild();
        logger.sub('ブラウザ用スクリプトおよび GAS 用定義を生成');
        check();

        if (opt.mode === 'Check') {
            logger.finish('確認モード完了: 本番への変更はありません。');
            return;
        }

        logger.header(3, 7, '変更検知と同期計画の策定');
        const settings = gas.configuration();
        const credential = publication.token();
        const slug = repository.repoSlug();
        const baseUrl = await publication.preflight(slug, credential);
        const remote = repository.checkRemote();
        const unpushed = git('diff', '--name-only', 'origin/main', 'HEAD').split('\n').filter(Boolean);
        const files = [...new Set([...sourceFiles, ...unpushed])];
        const observedGas = await gas.inspect(settings);
        const gasChanged = !observedGas || observedGas.sourceHash !== gas.fingerprint();
        const selected = plan(opt.mode, files, gasChanged);

        logger.info(`同期モード: ${opt.mode} (GAS更新: ${selected.deploy ? '要' : '不要'}, データ取得: ${selected.data ? '要' : '不要'})`);

        // Save a source checkpoint before mutating the live GAS deployment.
        if (repository.changed().length) {
            repository.commitChanges(opt.message);
            logger.success(`ソース変更のチェックポイントコミットを作成: "${opt.message}"`);
        }

        logger.header(4, 7, 'GAS デプロイの確認・更新');
        if (selected.deploy) {
            logger.info('GAS ソースの変更を検出しました。デプロイ準備を進めます。');
            state.gasApproval = gas.fingerprint();
            save();
            await gas.ensureDeployment(settings, state, save, observedGas);
            logger.success('GAS 固定デプロイの更新と反映を確認しました。');
        } else {
            logger.info('GAS ソースの変更はありません（デプロイ更新をスキップ）。');
            if (!selected.documentsOnly && opt.mode !== 'Site') {
                await gas.ensureDeployment(settings, state, save, observedGas);
            }
        }

        logger.header(5, 7, 'スプレッドシートからのデータ取得と整合性検証');
        if (selected.data) {
            logger.info('Google スプレッドシートから最新データを取得中…');
            const requestId = crypto.randomUUID();
            const snapshot = await gas.exportSnapshot(settings, requestId);
            if (snapshot.sourceHash !== gas.fingerprint()) throw new Error('GAS 生成元とローカルソースが一致しません。');
            logger.success('スナップショットを受信しました。データ整合性を検証中…');
            const values = artifacts.validateSnapshot(snapshot, requestId, artifacts.previousData(), opt.allowRemoval);
            logger.sub(`検証合格: 全 ${Object.keys(values).length} ファイル (辞書・実例48分割シャード整合)`);
            state.ownedData = Object.fromEntries(Object.entries(values).map(([file, value]) =>
                [file, sha256(normalizeText(typeof value === 'string' ? value : JSON.stringify(value)))]));
            save();
            artifacts.installSnapshot(values);
            logger.success('ローカルデータファイルを最新スナップショットで更新しました。');
        } else {
            logger.info('データ更新はスキップされました。');
        }

        const allChanged = [...new Set([...files, ...repository.changed()])];
        artifacts.updateSitemap(allChanged);
        logger.sub('sitemap.xml を更新');
        const manifest = artifacts.releaseManifest();
        logger.sub(`公開マニフェスト release.json を生成 (Release ID: ${manifest.releaseId.slice(0, 8)})`);

        const artifactCommitMsg = opt.message && opt.message !== '自動同期アップデート'
            ? `同期: ${opt.message} (データおよびサイト成果物の検証・反映)`
            : '同期: データおよびサイト成果物の検証・反映';
        repository.commitChanges(artifactCommitMsg);
        logger.success(`成果物をコミットしました: "${artifactCommitMsg}"`);

        // No automatic rebase after deployment: another writer must never be silently merged.
        if (repository.checkRemote() !== remote) throw new Error('同期中にリモートが変更されました。公開を停止しました。');
        state.pending = { commit: git('rev-parse', 'HEAD'), baseUrl, manifest, documentsOnly: selected.documentsOnly };
        save();
        await verify(state, settings, credential, slug, save);
    } finally { release(); }
}

if (require.main === module) main().catch(error => { console.error(`[未完了] ${error.message}`); process.exitCode = 1; });
module.exports = { options, plan, main };
