'use strict';
// Recovery never commits, pushes, deploys, or resumes a pending publication.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const core = require('./core');
const cacheFiles = ['.sync-state/english/snapshot.json', '.sync-state/english/current.json'];
const stateFile = '.sync-state/state.json';

function safePath(directory, relative) {
    if (typeof relative !== 'string' || /[\\:\x00-\x1f]/.test(relative) || relative.split('/').some(p => !p || p === '.' || p === '..'))
        throw new Error('復旧用のパスが不正です。');
    const base = path.resolve(directory), target = path.resolve(base, relative);
    if (!target.startsWith(base + path.sep)) throw new Error('復旧用のパスが保存先の外です。');
    for (let p = target; ; p = path.dirname(p)) {
        try { if (fs.lstatSync(p).isSymbolicLink()) throw new Error('復旧対象にリンクがあります。'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (p === path.dirname(p)) break;
    }
    return target;
}
function digest(directory, relative) {
    const file = safePath(directory, relative);
    return fs.existsSync(file) ? core.sha256(fs.readFileSync(file)) : null;
}
function inputFiles() {
    const files = core.run('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
    for (const file of files) {
        safePath(core.root, file);
        if (/^(?:\.env(?:\.|$)|\.clasp.*\.json$|\.git\/|\.sync-state\/)/.test(file))
            throw new Error('非公開設定がGitの入力一覧に含まれています。復旧を停止しました。');
    }
    return [...new Set(files)].sort();
}
function capture(directory, files) {
    return Object.fromEntries(files.map(file => [file, digest(directory, file)]));
}
function assertHashes(directory, hashes) {
    for (const [file, hash] of Object.entries(hashes)) if (digest(directory, file) !== hash)
        throw new Error('復旧の検証中にファイルが変更されました: ' + file);
}
function gitCheckpoint() {
    return JSON.stringify([core.git('branch', '--show-current'), core.git('rev-parse', 'HEAD'), core.run('git', ['diff', '--cached', '--binary'])]);
}
function gitIdentity() {
    return JSON.stringify([gitCheckpoint(), core.run('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'])]);
}
function readSnapshot(file, expectedHash) {
    const bytes = fs.readFileSync(file);
    if (core.sha256(bytes) !== expectedHash) throw new Error('復旧スナップショットが変更されました。');
    return JSON.parse(bytes.toString('utf8'));
}
function copyInputs(directory, workspace, hashes) {
    for (const [file, hash] of Object.entries(hashes)) {
        if (hash === null) continue;
        const bytes = fs.readFileSync(safePath(directory, file));
        if (core.sha256(bytes) !== hash) throw new Error('復旧コピー中に入力が変更されました: ' + file);
        const target = safePath(workspace, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, bytes);
    }
}

// Executed in a separate Node process whose core.root is the isolated workspace.
function validateWorkspace(snapshot, allowRemoval = false) {
    const artifacts = require('./artifacts'), bilingual = require('./bilingual');
    const { build } = require('../build-site');
    if (snapshot.sourceHash !== require('./gas').fingerprint()) throw new Error('復旧スナップショットのソースが不一致です。');
    const ticket = bilingual.publicationTicket();
    build({ bilingualSource: snapshot.englishSource });
    require('./gas').prepareBuild();
    const prepared = bilingual.prepare(snapshot, snapshot.requestId, artifacts.previousData(), allowRemoval);
    bilingual.assertPolicyUnchanged(ticket);
    bilingual.stage(prepared);
    artifacts.installSnapshot(prepared.japanese);
    build({ includeDictionary: true, bilingualSource: snapshot.englishSource });
    require('../check-local').check();
    bilingual.assertPolicyUnchanged(ticket);
    const files = [...artifacts.publicFiles(), 'src/sync_build.js'];
    const hashes = capture(core.root, [...files, ...cacheFiles]);
    if (Object.values(hashes).some(value => value === null)) throw new Error('復旧成果物が不足しています。');
    return { schemaVersion: 1, requestId: snapshot.requestId, sourceHash: snapshot.sourceHash, hashes,
        ownedPaths: files.filter(file => require('./git').isData(file)) };
}

function replace(file, bytes) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = file + '.recovery-' + crypto.randomUUID();
    try { fs.writeFileSync(temporary, bytes); fs.renameSync(temporary, file); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
// Multi-file installation is journaled and rollback-capable, not globally atomic.
function install(directory, workspace, report, baseline, recoveryDirectory, options = {}) {
    assertHashes(directory, baseline);
    assertHashes(workspace, report.hashes);
    const values = Object.fromEntries(Object.entries(report.hashes).map(([file, hash]) => {
        const bytes = fs.readFileSync(safePath(workspace, file));
        if (core.sha256(bytes) !== hash) throw new Error('検証済みの復旧成果物が変更されました: ' + file);
        return [file, bytes];
    }));
    const state = core.readJson(safePath(directory, stateFile), {});
    state.ownedData = Object.fromEntries(Object.entries(values).filter(([file]) => require('./git').isData(file))
        .map(([file, bytes]) => [file, core.sha256(core.normalizeText(bytes.toString('utf8')))]));
    delete state.pending;
    values[stateFile] = Buffer.from(JSON.stringify(state, null, 2));
    const changes = Object.keys(values).filter(file => digest(directory, file) !== core.sha256(values[file]));
    for (const file of changes) {
        if (!Object.hasOwn(baseline, file)) throw new Error('復旧対象の変更前記録がありません: ' + file);
        if (digest(directory, file) !== baseline[file]) throw new Error('復旧直前にファイルが変更されました: ' + file);
    }
    const backup = path.join(recoveryDirectory, 'backup'), journalFile = path.join(recoveryDirectory, 'install.json');
    const originals = {};
    for (const file of changes) {
        const target = safePath(directory, file);
        originals[file] = fs.existsSync(target) ? fs.readFileSync(target) : null;
        if (originals[file] !== null) {
            const saved = safePath(backup, file); fs.mkdirSync(path.dirname(saved), { recursive: true }); fs.writeFileSync(saved, originals[file]);
        }
    }
    const journal = { schemaVersion: 1, status: 'installing', files: changes, previousHashes: Object.fromEntries(changes.map(f => [f, baseline[f]])), installed: [] };
    core.atomicJson(journalFile, journal);
    const write = options.replace || replace;
    const unchangedInputs = Object.fromEntries(Object.entries(baseline).filter(([file]) => !Object.hasOwn(values, file)));
    const assertContext = () => { assertHashes(directory, unchangedInputs); if (options.assertContext) options.assertContext(); };
    try {
        assertContext();
        for (const file of changes) {
            if (digest(directory, file) !== baseline[file]) throw new Error('復旧中にファイルが変更されました: ' + file);
            journal.installed.push(file); // Include a write that throws after changing its target.
            core.atomicJson(journalFile, journal);
            write(safePath(directory, file), values[file]);
        }
        assertHashes(directory, Object.fromEntries(Object.entries(values).map(([f, b]) => [f, core.sha256(b)])));
        assertContext();
        journal.status = 'installed'; core.atomicJson(journalFile, journal);
    } catch (error) {
        const failed = [];
        for (const file of [...journal.installed].reverse()) {
            try {
                const current = digest(directory, file);
                if (current === baseline[file]) continue;
                // Never overwrite an unrelated concurrent edit while rolling back.
                if (current !== core.sha256(values[file])) throw new Error('concurrent edit');
                const target = safePath(directory, file);
                if (originals[file] === null) fs.unlinkSync(target);
                else (options.restore || replace)(target, originals[file]);
            } catch (_) { failed.push(file); }
        }
        journal.status = failed.length ? 'rollback-incomplete' : 'rolled-back'; journal.failed = failed;
        core.atomicJson(journalFile, journal);
        if (failed.length) throw new Error('復旧の巻戻しが未完了です。backup と install.json を保持しました: ' + failed.join(', '));
        throw error;
    }
    return changes;
}

async function recover(options = {}) {
    const gas = require('./gas'), bilingual = require('./bilingual');
    const files = inputFiles(), initial = capture(core.root, [...files, ...cacheFiles, stateFile]);
    const identity = gitIdentity(), checkpoint = gitCheckpoint(), ticket = bilingual.publicationTicket(), sourceHash = gas.fingerprint();
    const requestId = crypto.randomUUID();
    const directory = safePath(core.root, '.sync-state/recovery/' + requestId), workspace = path.join(directory, 'workspace');
    fs.mkdirSync(workspace, { recursive: true });
    copyInputs(core.root, workspace, capture(core.root, files));
    console.log('復旧: 公開先を変更せず、現在のGASから最新データを取得します。');
    const snapshot = await gas.exportSnapshotForSource(gas.configuration(), requestId, sourceHash);
    // Validate request identity before writing or executing the staged snapshot.
    require('./artifacts').validateSnapshot(snapshot, requestId, require('./artifacts').previousData(), options.allowRemoval);
    bilingual.validateEnglishSource(snapshot);
    core.atomicJson(path.join(directory, 'snapshot.json'), snapshot);
    const snapshotHash = digest(directory, 'snapshot.json');
    console.log('復旧: 最新データを隔離コピーへ取り込み、既存の全検査を実行します。');
    const code = "const fs=require('fs'),r=require('./scripts/sync/recovery');const result=r.validateWorkspace(r.readSnapshot('../snapshot.json',process.argv[2]),process.argv[1]==='true');fs.writeFileSync('../validated.json',JSON.stringify(result,null,2));";
    let output;
    try { output = core.run(process.execPath, ['-e', code, String(!!options.allowRemoval), snapshotHash], { cwd: workspace }); }
    catch (error) {
        fs.writeFileSync(path.join(directory, 'validation-failure.log'), error.message);
        throw new Error('隔離コピーの検証に失敗しました。ローカルの公開ファイルと同期記録は変更していません。確認先: ' + path.relative(core.root, directory) + '\n' + error.message.slice(0, 1200));
    }
    fs.writeFileSync(path.join(directory, 'validation.log'), output);
    process.stdout.write(output);
    assertHashes(directory, { 'snapshot.json': snapshotHash });
    const report = core.readJson(path.join(directory, 'validated.json'));
    if (!report || report.schemaVersion !== 1 || report.requestId !== requestId || report.sourceHash !== sourceHash) throw new Error('復旧の検証記録が一致しません。');
    const allowed = new Set([...require('./artifacts').publicFiles(), 'src/sync_build.js', ...cacheFiles]);
    if (!report.hashes || JSON.stringify(Object.keys(report.hashes).sort()) !== JSON.stringify([...allowed].sort()))
        throw new Error('復旧成果物の不足または許可外のパスがあります。');
    assertHashes(workspace, report.hashes);
    if (gitIdentity() !== identity || JSON.stringify(inputFiles()) !== JSON.stringify(files)) throw new Error('復旧の検証中にGitの状態が変更されました。');
    assertHashes(core.root, initial); bilingual.assertPolicyUnchanged(ticket);
    const baseline = { ...initial };
    for (const file of Object.keys(report.hashes)) if (!Object.hasOwn(baseline, file)) baseline[file] = null;
    assertHashes(core.root, baseline);
    if (!options.applyRecovery) {
        console.log('復旧検証に成功しました。ローカルへの反映・commit・push・deploy はしていません。反映する場合は -Mode Recover -ApplyRecovery を実行してください。');
        return { applied: false, directory, report };
    }
    const changed = install(core.root, workspace, report, baseline, directory, { assertContext() {
        if (gitCheckpoint() !== checkpoint || JSON.stringify(inputFiles()) !== JSON.stringify(files))
            throw new Error('復旧の反映中にGitの状態が変更されました。');
    } });
    console.log('復旧完了: 検証済みのローカル成果物を反映しました。commit・push・deploy はしていません。');
    return { applied: true, directory, changed, report };
}
module.exports = { readSnapshot, safePath, digest, capture, assertHashes, copyInputs, validateWorkspace, replace, install, recover };
