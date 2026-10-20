const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..');
const analytics = fs.readFileSync(
  path.join(repositoryRoot, 'mahler-search-app', 'js', 'analytics.js'),
  'utf8'
);
const commonCss = fs.readFileSync(
  path.join(repositoryRoot, 'mahler-search-app', 'css', 'common.css'),
  'utf8'
);
const sitemap = fs.readFileSync(path.join(repositoryRoot, 'sitemap.xml'), 'utf8');

assert.ok(analytics.includes("footer.className = 'site-legal-footer'"));
assert.ok(analytics.includes("privacyLink.textContent = 'プライバシーポリシー'"));
assert.ok(analytics.includes("licenseLink.textContent = 'ライセンス・利用条件'"));
assert.ok(analytics.includes("copyright.textContent = '© 2014–2026 Yutaka Okawachi'"));
assert.ok(commonCss.includes('.site-legal-footer'));

[
  ['privacy.html', 'プライバシーポリシー'],
  ['license.html', 'ライセンス・利用条件']
].forEach(([fileName, heading]) => {
  const html = fs.readFileSync(path.join(repositoryRoot, fileName), 'utf8');
  assert.ok(html.includes(`<h1>${heading}</h1>`));
  assert.ok(html.includes('class="legal-page"'));
  assert.ok(html.includes('mahler-search-app/js/analytics.js'));
  assert.ok(sitemap.includes(`/gaswebapp-manual/${fileName}`));
});

const privacy = fs.readFileSync(path.join(repositoryRoot, 'privacy.html'), 'utf8');
assert.ok(privacy.includes('検索傾向を長期的に比較し'));
assert.strictEqual(privacy.includes('12か月'), false);
assert.strictEqual(privacy.includes('検索履歴は削除'), false);

console.log('legal page tests: OK');

// A static footer remains available when analytics is disabled or JavaScript is off.
const legal=require('./site-legal');
for(const language of ['ja','en'])for(const file of ['index.html','mahler-search-app/rs_terms_search.html']){
 const raw='<html><body><h1>Unchanged body</h1><a href="https://creativecommons.org/licenses/by-nc/4.0/deed.ja">CC</a></body></html>';
 const result=legal.decorateHtml(raw,{language,file}),prefix=file.includes('/')?'../':'';
 assert(result.includes('<h1>Unchanged body</h1>'));
 assert(result.includes('href="'+prefix+'privacy.html"'));
 assert(result.includes('href="'+prefix+'license.html"'));
 assert(result.includes(language==='en'?'Privacy policy':'プライバシーポリシー'));
 assert(result.includes(language==='en'?'deed.en':'deed.ja'));
 assert(!/<script|fetch\(|sendSearchNotification|gtag\(/.test(result));
 assert.strictEqual(legal.decorateHtml(result,{language,file}),result);
}
for(const [from,to] of Object.entries(legal.officialEnglishLinks)){
 const raw='<html><body><a href="'+from+'">Same reference</a></body></html>';
 assert(legal.decorateHtml(raw,{language:'en',file:'privacy.html'}).includes('href="'+to+'"'));
 assert(legal.decorateHtml(raw,{language:'ja',file:'privacy.html'}).includes('href="'+from+'"'));
}
console.log('Static legal footer: independent of telemetry/JavaScript, idempotent, relative language paths and English-only official references passed.');
