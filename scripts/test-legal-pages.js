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
