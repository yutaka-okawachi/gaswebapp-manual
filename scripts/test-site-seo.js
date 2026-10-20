'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const seo = require('./site-seo'), root = path.resolve(__dirname, '..');
const raw = '<html><head><link rel="canonical" href="https://wrong.test/"></head><body>Content</body></html>';
for (const file of seo.pagePaths.map(file => file || 'index.html')) for (const language of ['ja', 'en']) {
    const result = seo.decorateHtml(raw, { file, language, englishEnabled: true });
    assert(result.includes('href="' + seo.canonicalUrl(file, language) + '"'));
    assert.equal((result.match(/rel="canonical"/g) || []).length, 1);
    for (const lang of ['ja', 'en']) assert(result.includes('hreflang="' + lang + '" href="' + seo.canonicalUrl(file, lang) + '"'));
    assert.equal(seo.decorateHtml(result, { file, language, englishEnabled: true }), result);
    const closed = seo.decorateHtml(result, { file, language: 'ja', englishEnabled: false });
    assert(!closed.includes('hreflang=')); assert(!closed.includes('/en/'));
}
for (const file of ['mahler-search-app/home.html', 'mahler-search-app/index.html']) {
    const result = seo.decorateHtml(raw, { file, language: 'en', englishEnabled: true });
    assert(result.includes('href="' + seo.siteUrl + 'en/"')); assert(!result.includes('rel="alternate"'));
}
const seed = '<?xml version="1.0"?><urlset>' + seo.pagePaths.map(file => '<url><loc>' + seo.siteUrl + file + '</loc><lastmod>2026-01-01</lastmod><priority>0.8</priority></url>').join('') + '</urlset>';
const changed = ['en/mahler-search-app/data/mahler.json', 'index.html'];
const result = seo.updateSitemap(seed, changed, '2026-10-20', true);
assert.equal((result.match(/<loc>/g) || []).length, 28);
for (const file of seo.pagePaths) assert(result.includes('<loc>' + seo.siteUrl + 'en/' + file + '</loc>'));
assert.equal(seo.updateSitemap(result, changed, '2026-10-20', true), result);
const tomorrow = seo.updateSitemap(result, ['en/mahler-search-app/data/mahler.json'], '2026-10-21', true);
assert(tomorrow.includes('<loc>' + seo.siteUrl + 'en/mahler-search-app/mahler.html</loc><lastmod>2026-10-21</lastmod>'));
assert(tomorrow.includes('<loc>' + seo.siteUrl + 'mahler-search-app/mahler.html</loc><lastmod>2026-01-01</lastmod>'));
const closed = seo.updateSitemap(seed, [], '2026-10-20', false);
assert.equal(closed, seed); assert(!closed.includes('/en/'));
assert.equal((seo.updateSitemap(result, [], '2026-10-20', false).match(/<loc>/g) || []).length, 14);
const actual = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
assert.equal((seo.updateSitemap(actual, [], '2026-10-20', true).match(/<loc>/g) || []).length, 28);
console.log('Bilingual SEO: 14 reciprocal canonical/hreflang pairs, redirect aliases, idempotent 28-URL sitemap, language-scoped data dates, closed publication gate and preserved Japanese entries passed.');
