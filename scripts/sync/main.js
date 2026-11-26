const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { root, git, run, atomicJson, readJson, sha256, normalizeText, nextOwnedHash } = require('./core');
const repository = require('./git');
const gas = require('./gas');
const editorHead = require('./gas-head');
const artifacts = require('./artifacts');
const bilingual = require('./bilingual');
const publication = require('./publish');
const logger = require('./logger');
const timing = require('./timing');
const { dashboardVerificationRequired, receiptNeedsDashboard, dashboardSettingsHash, dashboardCheckFresh } = require('./dashboard-policy');
const { build } = require('../build-site');
const { check } = require('../check-local');
const directory = path.join(root, '.sync-state');
const dictionaryPath = 'mahler-search-app/dic.html';
const releasePath = 'mahler-search-app/release.json';
function journalHash(file, prior, planned) {
    const target = path.join(root, file);
    const current = prior && fs.existsSync(target) ? sha256(normalizeText(fs.readFileSync(target, 'utf8'))) : null;
    return nextOwnedHash(prior, current, planned);
}
const dashboardSeconds = '(?:na|[0-9]{1,8}\\.[0-9]{1,9})';
const dashboardTelemetryLine = new RegExp(
    '^DASHBOARD_CHECK (?:preflight=missing_token|period=(?:7|30|90|180)' +
    ' result=(?:ok|timeout|curl_error|unauthorized|http_error|invalid_response|check_error)' +
    ' phase=(?:redirect_chain|before_http|http_response|after_response_headers|unknown)' +
    ' curl=(?:na|[0-9]{1,3}) http=(?:na|[0-9]{3}) redirects=(?:na|[0-9]{1,3})' +
    ['dns', 'connect', 'tls', 'ttfb', 'redirect', 'total'].map(key => ` ${key}_s=${dashboardSeconds}`).join('') + ')$'
);

function options(args) {
    const result = { mode: 'Auto', message: '自動同期アップデート', allowRemoval: false, yes: false, verifyDashboard: false };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--mode') result.mode = args[++i];
        else if (args[i] === '--message') result.message = args[++i];
        else if (args[i] === '--allow-data-removal') result.allowRemoval = true;
        else if (args[i] === '--apply-recovery') result.applyRecovery = true;
        else if (args[i] === '--yes') result.yes = true;
        else if (args[i] === '--verify-dashboard') result.verifyDashboard = true;
        else throw new Error(`Unknown argument: ${args[i]}`);
    }
    if (!['Auto', 'Data', 'Site', 'All', 'Check', 'Verify', 'Recover'].includes(result.mode)) throw new Error('Invalid mode');
    if (result.applyRecovery && result.mode !== 'Recover') throw new Error('--apply-recovery requires Recover mode');
    if (result.verifyDashboard && ['Check', 'Recover'].includes(result.mode)) throw new Error('--verify-dashboard requires a publishing or Verify mode');
    return result;
}

function plan(mode, files, gasChanged) {
    const documentsOnly = files.length > 0 && files.every(file => /^(manuals\/|README\.md$|CHANGELOG\.md$|AGENTS\.md$)/.test(file));
    if (mode === 'Site' && gasChanged) throw new Error('GAS に未反映の変更があります。通常の sync-data を実行してください。');
    return {
        deploy: mode !== 'Site' && gasChanged,
        data: ['Auto', 'Data', 'All'].includes(mode),
        documentsOnly: documentsOnly && !gasChanged
    };
}

function unlinkSafe(file) {
    try { fs.unlinkSync(file); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
}

function lock() {
    fs.mkdirSync(directory, { recursive: true });
    const file = path.join(directory, 'lock.json');
    if (fs.existsSync(file)) {
        const old = readJson(file);
        try { process.kill(old.pid, 0); throw new Error('別の sync-data が実行中です。'); }
        catch (e) { if (e.code !== 'ESRCH') throw e; }
        unlinkSafe(file);
    }
    const fd = fs.openSync(file, 'wx');
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid }));
    fs.closeSync(fd);
    return () => unlinkSafe(file);
}

function logFileList(title, fileList, limit = 20) {
    logger.info(`${title} (${fileList.length}件):`);
    for (const file of fileList.slice(0, limit)) console.log(`    - ${file}`);
    if (fileList.length > limit) console.log(`    …ほか ${fileList.length - limit} 件`);
}

function promptYesNo(question) {
    const readline = require('readline');
    return new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, answer => {
            rl.close();
            resolve(/^(?:y|yes)$/i.test(String(answer || '').trim()));
        });
    });
}

async function verify(state, settings, credential, slug, save, gateTicket, continueData = false, forceDashboard = false) {
    bilingual.assertPolicyUnchanged(gateTicket);
    bilingual.assertPublicTree();
    const receipt = state.pending;
    if (!receipt || !receipt.commit) throw new Error('再開可能な公開記録がありません。通常の sync-data を実行してください。');
    const settingsHash = dashboardSettingsHash(settings);
    const needsDashboard = forceDashboard || receiptNeedsDashboard(receipt) || !dashboardCheckFresh(state.dashboardCheck, settingsHash);
    bilingual.assertReleaseManifest(receipt.manifest);
    if (git('rev-parse', 'HEAD') !== receipt.commit) throw new Error('未完了の公開後に HEAD が変更されています。先に元の公開コミットの確認が必要です。');

    // Verify/resume must not bypass the editor-only change check before a push.
    await timing.measure('gas-head-push', () => editorHead.preflight(settings));

    logger.header(6, 7, 'GitHub への送信');
    logger.info(`コミット ${receipt.commit.slice(0, 7)} を GitHub (origin/main) へ送信中…`);
    timing.measure('push', () => publication.push()); // An interrupted push can safely be retried without a new commit.
    logger.success('GitHub リモートへのプッシュが完了しました。');

    logger.header(7, 7, needsDashboard ? "GitHub Pages 公開確認 & ダッシュボード API 検査" : "GitHub Pages 公開確認");
    logger.info('最終コミットの Pages 公開と全公開ファイルを確認します。');
    await timing.measure('pages-verify', () => publication.verifyPages(slug, receipt.commit, credential, receipt.baseUrl, receipt.manifest));
    logger.success('GitHub Pages への全公開ファイル反映を確認しました。');

    if (needsDashboard) {
        logger.info('管理者ダッシュボード API の応答を検査中…');
        process.stdout.write(timing.measure('dashboard-verify', () => run(process.platform === 'win32' ? 'powershell.exe' : 'pwsh',
            ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/verify-dashboard.ps1', '-BaseUrl', settings.GAS_DEPLOY_URL],
            {
                env: { ...process.env, DASHBOARD_API_TOKEN: settings.DASHBOARD_API_TOKEN },
                redactError: true,
                redactedFailure: 'dashboard verification incomplete',
                safeStdoutPattern: dashboardTelemetryLine
            })));
        logger.success('ダッシュボード API 正常性確認 (7/30/90/180日)');
        // Only actual API success advances this record; Pages success is separate.
        state.dashboardCheck = { commit: receipt.commit, verifiedAt: new Date().toISOString(), settingsHash };
    } else {
        logger.info("ダッシュボード関連の変更がないため、API 検査は省略します。");
    }

    state.lastSuccess = { commit: receipt.commit, releaseId: receipt.manifest.releaseId, gasHash: state.gasHash, verifiedAt: new Date().toISOString() };
    delete state.pending;
    delete state.ownedData;
    save();
    if (continueData) logger.info('保留していた公開確認が完了しました。続けて最新シートの取得へ進みます。');
    else logger.finish('同期完了: GitHub Pages の公開内容を確認しました。' + (!needsDashboard ? '' : ' ダッシュボード API も正常です。'));
}

async function main(args = process.argv.slice(2), hooks = {}) {
    const opt = options(args);
    const gateTicket = bilingual.publicationTicket();
    bilingual.assertPublicTree();
    const release = lock();
    let outcome = 'success';
    try {
        timing.start(opt.mode);
        const stateFile = path.join(directory, 'state.json');
        const state = readJson(stateFile, {});
        const save = () => atomicJson(stateFile, state);
        const recordGeneratedWrite = (file, text) => {
            state.ownedData ||= {};
            state.ownedData[file] = journalHash(file, state.ownedData[file], sha256(normalizeText(text)));
            save();
        };

        logger.header(1, 7, '事前確認と環境検証');
        logger.info('Git 作業ツリーと実行前条件を検査中…');
        let sourceFiles = repository.preflight(state.ownedData || {});
        logger.success(`事前確認完了 (ブランチ: main, 検出変更: ${sourceFiles.length ? sourceFiles.length + '件' : 'なし'})`);

        if (opt.mode === 'Recover') {
            await require('./recovery').recover(opt);
            return;
        }

        if (['Auto', 'Data', 'All', 'Site'].includes(opt.mode) && sourceFiles.length > 0) {
            logFileList('未コミットの変更', sourceFiles);
            logger.warn('このまま続行すると、上記の未コミット変更も本番へコミット・公開されます。');
            if (!opt.yes && (typeof hooks.confirm === 'function' || hooks.interactive === true)) {
                let approved;
                if (typeof hooks.confirm === 'function') {
                    approved = await hooks.confirm(sourceFiles, opt);
                } else if (!process.stdin.isTTY) {
                    throw new Error('未コミットの変更があります。対話端末で確認するか、内容を確認済みであれば -Yes を指定して再実行してください。');
                } else {
                    approved = await promptYesNo('  未コミットの変更を含めて同期を続行しますか？ [y/N]: ');
                }
                if (!approved) throw new Error('ユーザー確認により同期を中止しました。本番への変更はありません。');
            }
        }

        if (opt.mode !== 'Check' && state.pending &&
            (sourceFiles.length || git('rev-parse', 'HEAD') !== state.pending.commit)) {
            delete state.pending;
            save();
        }
        if (opt.mode === 'Verify' || (opt.mode !== 'Check' && state.pending && state.pending.commit)) {
            logger.info('未完了の公開記録が見つかりました。確認工程を再開します。');
            const resumeCommit = state.pending && state.pending.commit;
            const continueData = ['Auto', 'Data', 'All'].includes(opt.mode);
            await timing.measure('resume-verify', () => verify(state, gas.configuration(), publication.token(),
                repository.repoSlug(), save, gateTicket, continueData, opt.verifyDashboard));
            if (!continueData) return;
            bilingual.assertPolicyUnchanged(gateTicket);
            if (git('rev-parse', 'HEAD') !== resumeCommit || repository.changed().length)
                throw new Error('公開確認の再開中にローカル変更がありました。変更を保持して停止しました。最新取得を改めて実行してください。');
            sourceFiles = repository.preflight(state.ownedData || {});
            logger.header(1, 7, '最新データ同期の事前確認');
        }

        if (['Auto', 'Data', 'All', 'Site'].includes(opt.mode) && sourceFiles.length === 0 &&
            typeof repository.fastForwardIfClean === 'function') {
            const synced = repository.fastForwardIfClean();
            if (synced && synced.updated) {
                logger.info(`リモート (origin/main) の未取得コミット ${synced.behind} 件を安全に取り込みました (${synced.before.slice(0, 7)} → ${synced.after.slice(0, 7)})。`);
                sourceFiles = repository.preflight(state.ownedData || {});
            }
        }

        if (fs.existsSync(path.join(root, '.env'))) {
            run(process.execPath, ['src/update_env.js']);
            logger.sub('環境変数を同期しました (.env)');
        }

        logger.header(2, 7, 'サイト組み立てとローカル検証');
        timing.measure('build', () => build());
        timing.measure('gas-build', () => gas.prepareBuild());
        logger.sub('ブラウザ用スクリプトおよび GAS 用定義を生成');
        if (opt.mode === 'Check') {
            timing.measure('checks', () => check());
            logger.finish('確認モード完了: 本番への変更はありません。');
            return;
        }

        logger.header(3, 7, '変更検知と同期計画の策定');
        const settings = gas.configuration();
        const credential = publication.token();
        const slug = repository.repoSlug();
        const baseUrl = await timing.measure('github-preflight', () => publication.preflight(slug, credential));
        const remote = timing.measure('remote-check', () => repository.checkRemote());
        const unpushed = git('diff', '--name-only', 'origin/main', 'HEAD').split('\n').filter(Boolean);
        const files = [...new Set([...sourceFiles, ...unpushed])];
        const observedGas = await timing.measure('gas-inspect', () => gas.inspect(settings));
        const gasChanged = !observedGas || observedGas.sourceHash !== gas.fingerprint();
        const selected = plan(opt.mode, files, gasChanged);
        // A changed GAS deployment still needs the full safety checks before it touches production.
        if (selected.deploy) timing.measure('checks-before-gas', () => check());

        // Check editor HEAD as well as the published hash, before any commit.
        const headCheck = await timing.measure('gas-head-before', () => editorHead.preflight(settings));

        logger.info(`同期モード: ${opt.mode} (GAS更新: ${selected.deploy ? '要' : '不要'}, データ取得: ${selected.data ? '要' : '不要'})`);
        const pendingCommitFiles = repository.changed();
        if (pendingCommitFiles.length) logFileList('今回コミットするローカル変更', pendingCommitFiles);
        if (unpushed.length) logFileList('未送信のローカルコミット差分', unpushed);
        bilingual.assertPolicyUnchanged(gateTicket);
        // Save a source checkpoint before mutating the live GAS deployment.
        if (selected.deploy && repository.changed().length) {
            repository.commitChanges(opt.message);
            logger.success(`ソース変更のチェックポイントコミットを作成: "${opt.message}"`);
        }

        logger.header(4, 7, 'GAS デプロイの確認・更新');
        if (selected.deploy) {
            logger.info('GAS ソースの変更を検出しました。デプロイ準備を進めます。');
            state.gasApproval = gas.fingerprint();
            save();
            await timing.measure('gas-ensure', () => gas.ensureDeployment(settings, state, save, observedGas, headCheck));
            logger.success('GAS 固定デプロイの更新と反映を確認しました。');
        } else {
            logger.info('GAS ソースの変更はありません（デプロイ更新をスキップ）。');
            if (!selected.documentsOnly && opt.mode !== 'Site') {
                await timing.measure('gas-ensure', () => gas.ensureDeployment(settings, state, save, observedGas, headCheck));
            }
        }

        logger.header(5, 7, 'スプレッドシートからのデータ取得と整合性検証');
        if (selected.data) {
            logger.info('Google スプレッドシートから最新データを取得中…');
            const requestId = crypto.randomUUID();
            const snapshot = await timing.measure('snapshot-fetch', () => gas.exportSnapshotForSource(settings, requestId, gas.fingerprint()));
            logger.success('スナップショットを受信しました。データ整合性を検証中…');
            const prepared = timing.measure('english-prepare', () => bilingual.prepare(snapshot, requestId, artifacts.previousData(), opt.allowRemoval));
            const values = prepared.japanese;
            bilingual.assertPolicyUnchanged(gateTicket);
            const { [dictionaryPath]: dictionaryHtml, ...dataFiles } = values;
            const publicValues = bilingual.englishEnabled() ? { ...dataFiles, ...prepared.english } : dataFiles;
            logger.sub(`検証合格: 全 ${Object.keys(values).length} ファイル (辞書・実例48分割シャード整合)`);
            const prior = state.ownedData || {};
            const planned = Object.fromEntries(Object.entries(publicValues).map(([file, value]) =>
                [file, sha256(normalizeText(artifacts.formatJson(file, value)))]));
            state.ownedData = Object.fromEntries(Object.entries({
                ...planned, [dictionaryPath]: undefined, [releasePath]: undefined
            }).map(([file, hash]) => [file, journalHash(file, prior[file], hash)]));
            save();
            const englishStage = timing.measure('english-stage', () => bilingual.stage(prepared));
            logger.sub('英語成果物を同一取得から生成: ' + (englishStage.publishedEnglish ? '承認済み公開対象' : '非公開ステージのみ'));
            timing.measure('data-install', () => artifacts.installSnapshot(dataFiles));
            // Install only the final, asset-versioned dictionary; don't overwrite it with raw GAS HTML.
            timing.measure('final-build', () => build({
                includeDictionary: true, bilingualSource: snapshot.englishSource, dictionaryHtml,
                beforeDictionaryWrite: html => recordGeneratedWrite(dictionaryPath, html)
            }));
            logger.success('ローカルデータファイルを最新スナップショットで更新しました。');
        } else {
            logger.info('データ更新はスキップされました。');
            if (!selected.documentsOnly) {
                // Dictionary navigation is generated too, including browser-only releases.
                timing.measure('cached-build', () => build({ includeDictionary: true }));
                const staged = timing.measure('cached-english', () => bilingual.refreshStage());
                const generated = [...artifacts.expectedPaths];
                if (staged && staged.publishedEnglish) {
                    const report = readJson(path.join(staged.directory, 'manifest.json'));
                    generated.push(...Object.keys(report.hashes));
                }
                state.ownedData = {
                    [releasePath]: state.ownedData?.[releasePath],
                    ...Object.fromEntries(generated.map(file =>
                        [file, sha256(normalizeText(fs.readFileSync(path.join(root, file), 'utf8')))]))
                };
                save();
            }
        }

        const allChanged = [...new Set([...files, ...repository.changed()])];
        artifacts.updateSitemap(allChanged);
        logger.sub('sitemap.xml を更新');
        const manifest = timing.measure('release-manifest', () => artifacts.releaseManifest({ beforeWrite: recordGeneratedWrite }));
        logger.sub(`公開マニフェスト release.json を生成 (Release ID: ${manifest.releaseId.slice(0, 8)})`);

        // Validate the latest generated files, not just the previous checkout's data.
        timing.measure('checks-final', () => check());

        const artifactCommitMsg = opt.message && opt.message !== '自動同期アップデート'
            ? `同期: ${opt.message} (データおよびサイト成果物の検証・反映)`
            : '同期: データおよびサイト成果物の検証・反映';
        await timing.measure('gas-head-commit', () => editorHead.preflight(settings));
        bilingual.assertPolicyUnchanged(gateTicket);
        if (repository.changed().length) {
            repository.commitChanges(artifactCommitMsg);
            logger.success(`成果物をコミットしました: "${artifactCommitMsg}"`);
        }

        // No automatic rebase after deployment: another writer must never be silently merged.
        if (timing.measure('remote-check', () => repository.checkRemote()) !== remote) throw new Error('同期中にリモートが変更されました。公開を停止しました。');
        const receiptCommit = git('rev-parse', 'HEAD');
        const dashboardRequired = opt.verifyDashboard ||
            !dashboardCheckFresh(state.dashboardCheck, dashboardSettingsHash(settings)) ||
            dashboardVerificationRequired(state.lastSuccess, receiptCommit, remote, git);
        if (receiptCommit === remote && !repository.changed().length && !dashboardRequired &&
            state.lastSuccess?.commit === receiptCommit && state.lastSuccess.releaseId === manifest.releaseId &&
            state.lastSuccess.gasHash === state.gasHash) {
            delete state.ownedData;
            save();
            logger.finish('最新状態を確認しました。公開済みの内容に変更がないため、再送信・再公開は行いません。');
            return;
        }
        state.pending = { commit: receiptCommit, baseUrl, manifest, documentsOnly: selected.documentsOnly, dashboardRequired };
        save();
        await verify(state, settings, credential, slug, save, gateTicket, false, opt.verifyDashboard);
    } catch (error) { outcome = 'failure'; throw error; }
    finally { try { timing.end(outcome); } finally { release(); } }
}

if (require.main === module) main(process.argv.slice(2), { interactive: true }).catch(error => { console.error(`[未完了] 同期処理が停止しました。\n詳細（原文を含む）: ${error.message}`); process.exitCode = 1; });
module.exports = { options, plan, main };
