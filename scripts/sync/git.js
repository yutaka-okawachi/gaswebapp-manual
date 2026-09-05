const fs = require('fs');
const path = require('path');
const { root, run, git, sha256, normalizeText } = require('./core');
const exact = new Set(['.claspignore', '.gitignore', '_config.yml', '01_START_SUCCESSOR_SETUP.bat',
    '02_RUN_SYNC.bat', 'CHANGELOG.md', 'apple-touch-icon.png', 'favicon.png', 'favicon_original.png',
    'google34b939d4db375916.html', 'index.html', 'LICENSE', 'license.html', 'privacy.html',
    'ogp.png', 'README.md', 'robots.txt', 'sitemap.xml', 'sync-data.ps1']);
const prefixes = ['.agent/workflows/', '.github/workflows/', 'mahler-search-app/', 'manuals/', 'scripts/', 'src/', 'frontend/'];
function isAllowed(file) { return exact.has(file) || prefixes.some(prefix => file.startsWith(prefix)); }
function isData(file) { return file === 'mahler-search-app/dic.html' || file.startsWith('mahler-search-app/data/'); }
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
    if (git('branch', '--show-current') !== 'main') throw new Error('main ブランチで実行してください。自動マージ・退避は行いません。');
    for (const name of ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD']) {
        if (fs.existsSync(path.resolve(root, git('rev-parse', '--git-path', name)))) throw new Error(`Git の未完了操作があります: ${name}`);
    }
    const files = changed();
    const outside = files.filter(file => !isAllowed(file));
    if (outside.length) throw new Error(`同期対象外の変更: ${outside.join(', ')}`);
    const generated = files.filter(file => isData(file) && (!ownedData[file] || !fs.existsSync(path.join(root, file)) ||
        sha256(normalizeText(fs.readFileSync(path.join(root, file), 'utf8'))) !== ownedData[file]));
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
function commitChanges(message) {
    const files = changed();
    if (!files.length) return;
    if (files.some(file => !isAllowed(file))) throw new Error('公開直前に対象外の変更を検出しました。');
    git('add', '--', ...files);
    git('commit', '-m', message);
}
function repoSlug() {
    const match = git('remote', 'get-url', 'origin').match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (!match) throw new Error('GitHub origin URL を確認してください。');
    return `${match[1]}/${match[2]}`;
}
module.exports = { isAllowed, isData, parseStatus, changed, preflight, checkRemote, commitChanges, repoSlug };
