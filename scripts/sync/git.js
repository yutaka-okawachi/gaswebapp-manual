const fs = require('fs');
const path = require('path');
const { root, run, git, sha256, normalizeText, ownsHash } = require('./core');
const exact = new Set(['.claspignore', '.gitignore', '_config.yml', '01_START_SUCCESSOR_SETUP.bat',
    '02_RUN_SYNC.bat', 'AGENTS.md', 'CHANGELOG.md', 'apple-touch-icon.png', 'favicon.png', 'favicon_original.png',
    'google34b939d4db375916.html', 'index.html', 'LICENSE', 'license.html', 'privacy.html',
    'ogp.png', 'README.md', 'robots.txt', 'sitemap.xml', 'sync-data.ps1']);
const prefixes = ['.agent/workflows/', '.github/workflows/', 'mahler-search-app/', 'manuals/', 'scripts/', 'src/', 'frontend/'];
function isAllowed(file) { return exact.has(file) || prefixes.some(prefix => file.startsWith(prefix)) || (file.startsWith('en/') && require('./bilingual').englishEnabled()); }
function isData(file) { return file.startsWith('en/') || file === 'mahler-search-app/dic.html' || file.startsWith('mahler-search-app/data/'); }
function parseStatus(text) {
    const records = text.split('\0');
    const files = [];
    for (let i = 0; i < records.length; i++) {
        if (!records[i]) continue;
        const status = records[i].slice(0, 2);
        files.push(records[i].slice(3));
        if (/[RC]/.test(status)) files.push(records[++i]);
    }
    return [...new Set(files)];
}
function changed() { return parseStatus(run('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'])); }
function preflight(ownedData = {}) {
    require('./bilingual').assertPublicTree();
    if (git('branch', '--show-current') !== 'main') throw new Error('main ブランチで実行してください。自動マージ・退避は行いません。');
    for (const name of ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD']) {
        if (fs.existsSync(path.resolve(root, git('rev-parse', '--git-path', name)))) throw new Error(`Git の未完了操作があります: ${name}`);
    }
    const files = changed();
    const outside = files.filter(file => !isAllowed(file));
    if (outside.length) throw new Error(`同期対象外の変更: ${outside.join(', ')}`);
    const generated = files.filter(file => isData(file) && (!ownedData[file] || !fs.existsSync(path.join(root, file)) ||
        !ownsHash(ownedData[file], sha256(normalizeText(fs.readFileSync(path.join(root, file), 'utf8'))))));
    if (generated.length) throw new Error(`生成物にローカル変更があります。変更を保存・確認してから再実行してください: ${generated.join(', ')}`);
    git('diff', '--check');
    git('diff', '--cached', '--check');
    git('var', 'GIT_AUTHOR_IDENT');
    return files;
}
function checkRemote() {
    git('fetch', 'origin', 'main');
    if (Number(git('rev-list', '--count', 'HEAD..origin/main')) > 0) {
        throw new Error('リモートに未取得の変更があります。変更を保存して git pull --rebase を行ってから再実行してください。');
    }
    return git('rev-parse', 'origin/main');
}
function fastForwardIfClean(deps = {}) {
    const getChanged = deps.changed || changed;
    const runGit = deps.git || git;
    if (getChanged().length > 0) return { updated: false, reason: 'dirty' };
    runGit('fetch', 'origin', 'main');
    const behind = Number(runGit('rev-list', '--count', 'HEAD..origin/main'));
    if (behind === 0) return { updated: false, reason: 'up-to-date' };
    const ahead = Number(runGit('rev-list', '--count', 'origin/main..HEAD'));
    if (ahead > 0) return { updated: false, reason: 'diverged', behind, ahead };
    const before = runGit('rev-parse', 'HEAD');
    runGit('merge', '--ff-only', 'origin/main');
    const after = runGit('rev-parse', 'HEAD');
    return { updated: before !== after, reason: 'fast-forwarded', behind, before, after };
}
function stopForEdit() {
    throw new Error('同期中にローカル変更を検出しました。変更は消さずに停止しました。作業ツリーとステージ済みの内容を確認してから sync-data を再実行してください。');
}
function fileProof(file, directory) {
    const target = path.join(directory, file);
    try {
        const stat = fs.lstatSync(target);
        if (stat.isSymbolicLink()) return ['link', fs.readlinkSync(target)];
        if (!stat.isFile()) stopForEdit();
        return [stat.mode & 0o111, sha256(fs.readFileSync(target))];
    } catch (error) {
        if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
        throw error;
    }
}
function captureCandidate({ runGit = git, getChanged = changed, directory = root } = {}) {
    const files = getChanged().slice().sort();
    if (files.some(file => !isAllowed(file))) throw new Error('公開直前に対象外の変更を検出しました。');
    const head = runGit('rev-parse', 'HEAD');
    if (runGit('branch', '--show-current') !== 'main') stopForEdit();
    return { head, index: runGit('write-tree'), files: files.map(file => [file, fileProof(file, directory)]) };
}
function sameFiles(candidate, observed) {
    return JSON.stringify(candidate.files) === JSON.stringify(observed.files);
}
function assertCandidate(candidate, options) {
    const observed = captureCandidate(options);
    if (candidate.head !== observed.head || candidate.index !== observed.index || !sameFiles(candidate, observed)) stopForEdit();
}
function assertCommitted(commit, { runGit = git, getChanged = changed } = {}) {
    if (runGit('branch', '--show-current') !== 'main' || runGit('rev-parse', 'HEAD') !== commit || getChanged().length) stopForEdit();
}
function commitChanges(message, candidate, options = {}) {
    const runGit = options.runGit || git;
    assertCandidate(candidate, options);
    const files = candidate.files.map(([file]) => file);
    if (!files.length) return candidate.head;
    runGit('--literal-pathspecs', 'add', '--', ...files);
    const staged = captureCandidate(options);
    if (staged.head !== candidate.head || !sameFiles(candidate, staged) ||
        runGit('diff', '--name-only', '-z', '--')) stopForEdit();
    runGit('commit', '-m', message);
    const commit = runGit('rev-parse', 'HEAD');
    if (runGit('rev-parse', commit + '^{tree}') !== staged.index ||
        runGit('rev-list', '--parents', '-n', '1', commit) !== commit + ' ' + candidate.head) stopForEdit();
    assertCommitted(commit, options);
    return commit;
}
function repoSlug() {
    const match = git('remote', 'get-url', 'origin').match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (!match) throw new Error('GitHub origin URL を確認してください。');
    return `${match[1]}/${match[2]}`;
}
module.exports = { isAllowed, isData, parseStatus, changed, preflight, checkRemote, fastForwardIfClean, captureCandidate, assertCandidate, assertCommitted, commitChanges, repoSlug };
