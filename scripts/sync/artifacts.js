const fs = require('fs');
const path = require('path');
const { root, sha256, normalizeText, writeIfChanged } = require('./core');
const base = 'mahler-search-app/';
const jsonNames = ['mahler', 'richard_strauss', 'richard_wagner', 'rs_scenes', 'rw_scenes',
    'dic_notes', 'abbr_list', 'dic_terms_index', 'whom_list'];
const expectedPaths = [base + 'dic.html', ...jsonNames.map(n => `${base}data/${n}.json`),
    ...['gm', 'rw', 'rs'].flatMap(c => Array.from({ length: 16 }, (_, n) => `${base}data/dictionary-examples/${c}-${String(n).padStart(2, '0')}.json`))];
function validateSnapshot(snapshot, requestId, previous = {}, allowRemoval = false) {
    if (snapshot.schemaVersion !== 1 || snapshot.requestId !== requestId || !snapshot.files) throw new Error('生成結果の実行ID・形式が不一致です。');
    const files = snapshot.files;
    if (JSON.stringify(Object.keys(files).sort()) !== JSON.stringify([...expectedPaths].sort())) throw new Error('生成ファイルの不足・想定外のパスがあります。');
    if (typeof files[base + 'dic.html'] !== 'string' || !/<html[\s>]/i.test(files[base + 'dic.html']) || !files[base + 'dic.html'].includes('</html>')) throw new Error('辞書HTMLが不完全です。');
    for (const file of expectedPaths.filter(p => p.endsWith('.json'))) {
        const value = files[file];
        const objectType = /\/(dic_terms_index|whom_list)\.json$/.test(file);
        if (objectType ? (!value || typeof value !== 'object' || Array.isArray(value)) : !Array.isArray(value)) throw new Error(`データ形式が不正: ${file}`);
        const count = Object.keys(value).length;
        const oldCount = previous[file] ? Object.keys(previous[file]).length : 0;
        if (!file.includes('/dictionary-examples/') && !allowRemoval && (count === 0 || (oldCount > 0 && count < oldCount * 0.7))) throw new Error(`空データまたは30%超の件数減少: ${file} (${oldCount} → ${count})。意図した削除には -AllowDataRemoval を指定してください。`);
        if (/\/(mahler|richard_wagner|richard_strauss)\.json$/.test(file)) {
            const keys = file.endsWith('/mahler.json') ? ['de', 'ja', 'data'] : ['Oper', 'de', 'ja', 'page'];
            if (value.some(row => !row || keys.some(key => !Object.hasOwn(row, key)))) throw new Error(`検索データの必須列が不足: ${file}`);
        }
    }
    // Validate shard contents against the full data and preserve source row ordering.
    for (const [composer, full] of Object.entries({ gm: 'mahler', rw: 'richard_wagner', rs: 'richard_strauss' })) {
        const rows = files[`${base}data/${full}.json`];
        for (let n = 0; n < 16; n++) {
            const shard = files[`${base}data/dictionary-examples/${composer}-${String(n).padStart(2, '0')}.json`];
            for (const row of shard) {
                const { __exampleOrder: order, ...actual } = row;
                if (!Number.isInteger(order) || !rows[order] || JSON.stringify(actual) !== JSON.stringify(rows[order])) throw new Error(`実例データの参照不一致: ${composer}-${n}`);
            }
        }
    }
    return files;
}
function previousData() {
    const result = {};
    for (const file of expectedPaths.filter(p => p.endsWith('.json'))) {
        if (fs.existsSync(path.join(root, file))) result[file] = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    }
    return result;
}
function installSnapshot(files) {
    // Called only after the entire snapshot has passed validation.
    return Object.entries(files).filter(([file, value]) => writeIfChanged(file,
        typeof value === 'string' ? value : JSON.stringify(value))).map(([file]) => file);
}
function updateSitemap(changed, today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })) {
    const mapping = {
        'mahler.json': ['mahler.html', 'terms_search.html'],
        'richard_wagner.json': ['richard_wagner.html', 'rw_terms_search.html'],
        'richard_strauss.json': ['richard_strauss.html', 'rs_terms_search.html'],
        'rw_scenes.json': ['richard_wagner.html', 'rw_synopsis.html'],
        'rs_scenes.json': ['richard_strauss.html', 'rs_synopsis.html'],
        'dic_notes.json': ['dic.html'], 'abbr_list.json': ['dic.html'], 'dic_terms_index.json': ['dic.html']
    };
    const targets = new Set();
    for (const file of changed) {
        if (file === 'index.html') targets.add('');
        else if (file.endsWith('.html') && !file.startsWith('src/')) targets.add(file);
        else if (file.startsWith(base + 'data/')) for (const page of mapping[path.basename(file)] || []) targets.add(base + page);
    }
    const file = 'sitemap.xml';
    const xml = fs.readFileSync(path.join(root, file), 'utf8');
    const next = xml.replace(/<url>[\s\S]*?<\/url>/g, block => {
        const loc = block.match(/<loc>([^<]+)<\/loc>/);
        if (!loc) return block;
        const sitePath = new URL(loc[1]).pathname.replace(/^\/gaswebapp-manual\//, '');
        return targets.has(sitePath) ? block.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${today}</lastmod>`) : block;
    });
    writeIfChanged(file, next);
}
function publicFiles() {
    const files = ['index.html', 'license.html', 'privacy.html', 'sitemap.xml', 'robots.txt'];
    function walk(dir) {
        for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
            const file = dir + '/' + entry.name;
            if (entry.isDirectory()) walk(file);
            else if (/\.(html|js|css|json)$/.test(file) && !/_test\.html$/.test(file) && file !== base + 'release.json') files.push(file);
        }
    }
    walk('mahler-search-app');
    return files.sort();
}
function releaseManifest() {
    const hashes = {};
    for (const file of publicFiles()) hashes[file] = sha256(normalizeText(fs.readFileSync(path.join(root, file), 'utf8')));
    const releaseId = sha256(JSON.stringify(hashes));
    const manifest = { schemaVersion: 1, releaseId, hashes };
    writeIfChanged(base + 'release.json', JSON.stringify(manifest));
    return manifest;
}
module.exports = { expectedPaths, validateSnapshot, previousData, installSnapshot, updateSitemap, releaseManifest };
