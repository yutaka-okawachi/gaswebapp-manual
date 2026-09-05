const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const vm = require('vm');
const { root, run } = require('./sync/core');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function publicPath(url) {
    const pathname = decodeURIComponent(new URL(url, 'http://127.0.0.1').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (relative.includes('\\') || relative.split('/').some(part => part === '..' || part.startsWith('.'))) return null;
    if (!['index.html', 'privacy.html', 'license.html', 'favicon.png', 'apple-touch-icon.png', 'ogp.png', 'robots.txt', 'sitemap.xml'].includes(relative) && !relative.startsWith('mahler-search-app/')) return null;
    const resolved = path.resolve(root, relative);
    return resolved.startsWith(root + path.sep) ? resolved : null;
}
function previewHtml(html, token, approval, phase = 'publish') {
    const notice = `<aside style="position:relative;z-index:1;margin:12px;padding:16px;border:2px solid #8a6500;border-radius:8px;background:#fff7db;color:#242424;font:16px/1.6 sans-serif"><strong>公開前プレビュー</strong> — アクセス計測・検索通知は送信されません。<br><a href="/">トップ</a> · <a href="/mahler-search-app/dic.html">用語集</a> · <a href="/mahler-search-app/terms_search.html">GM用語検索</a> · <a href="/mahler-search-app/rw_terms_search.html">RW用語検索</a> · <a href="/mahler-search-app/rs_terms_search.html">RS用語検索</a>${approval ? `<form method="post" action="/__approve"><input type="hidden" name="token" value="${token}"><button style="margin-top:12px;padding:10px 18px" type="submit">確認しました。この内容を公開する</button></form>` : '<br>この確認画面から本番へ公開することはありません。'}</aside>`;
    const optout = `<script>try {localStorage.setItem('gmt_admin_device_optout','1');} catch(e) {} window.__LOCAL_PREVIEW__=true;</script>`;
    const phasedNotice = phase === 'prepare' ? notice.replace('確認しました。この内容を公開する', '確認しました。GAS更新と最新データの取得に進む').replace('公開前プレビュー</strong>', 'GAS更新前のプレビュー</strong> — 現在保存されているデータを表示しています。最新データ取得後にもう一度確認できます。') : notice;
    return html.replace(/<head([^>]*)>/i, '<head$1>' + optout).replace(/<body([^>]*)>/i, '<body$1>' + phasedNotice);
}
async function startPreview({ approval = false, open = false, phase = 'publish' } = {}) {
    const token = crypto.randomBytes(24).toString('hex');
    let approve;
    const approved = new Promise(resolve => { approve = resolve; });
    let dictionaryHtml;
    if (!approval || phase === 'prepare') {
        const context = vm.createContext({ console });
        for (const file of ['src/asset_versions.js', 'src/dictionary_example_shards.js', 'src/generate_dic_html.js']) {
            vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
        }
        const data = name => JSON.parse(fs.readFileSync(path.join(root, 'mahler-search-app/data', name + '.json'), 'utf8'));
        const notes = data('dic_notes');
        const examples = context.buildDictionaryExampleShardFiles(notes, { mahler: data('mahler'), wagner: data('richard_wagner'), strauss: data('richard_strauss') });
        dictionaryHtml = context.generateDicHtml(notes, data('abbr_list'), examples.queryIndex);
    }
    const server = http.createServer(async (req, res) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'");
        if (req.method === 'POST' && req.url === '/__approve' && approval) {
            let body = '';
            for await (const chunk of req) { body += chunk; if (body.length > 1024) { res.writeHead(413); res.end(); return; } }
            if (new URLSearchParams(body).get('token') !== token || req.headers.origin !== `http://127.0.0.1:${server.address().port}`) { res.writeHead(403); res.end(); return; }
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(phase === 'prepare' ? '<p>GAS更新と最新データの取得を開始しました。次のプレビューをお待ちください。</p>' : '<p>公開を開始しました。sync-data の完了表示をご確認ください。</p>');
            approve();
            return;
        }
        let file;
        try { file = publicPath(req.url); } catch (_) { /* malformed URL */ }
        if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
        const realFile = fs.realpathSync(file);
        if (!realFile.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
        const extension = path.extname(file);
        res.setHeader('Content-Type', mime[extension] || 'application/octet-stream');
        const data = dictionaryHtml && file === path.join(root, 'mahler-search-app/dic.html') ? Buffer.from(dictionaryHtml) : fs.readFileSync(file);
        res.end(extension === '.html' ? previewHtml(data.toString('utf8'), token, approval, phase) : data);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/?admin=1`;
    console.log(`公開前プレビュー: ${url}`);
    if (open && process.platform === 'win32') {
        try { run('powershell.exe', ['-NoProfile', '-Command', `Start-Process '${url}' -WindowStyle Hidden`]); }
        catch (_) { console.log('上のURLをブラウザーで開いてください。'); }
    }
    return { url, approved, close: () => new Promise(resolve => server.close(resolve)) };
}
if (require.main === module) startPreview({ open: process.argv.includes('--open') }).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { publicPath, previewHtml, startPreview };
