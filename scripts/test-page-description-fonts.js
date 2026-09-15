const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const commonCss = read('mahler-search-app/css/common.css');
assert.match(
    commonCss,
    /\.page-description\s*\{\s*font-family:\s*var\(--font-sans\);\s*\}/,
    'page descriptions should use the shared sans-serif font stack'
);
assert.match(
    commonCss,
    /#results\s*\{[^}]*font-family:\s*'Lora',/s,
    'search results should retain the Lora-first font stack'
);
assert.match(
    commonCss,
    /#termInput,[\s\S]*?font-family:\s*var\(--font-serif\)\s*!important;/,
    'term input should retain the Lora-first font stack'
);
assert.match(
    commonCss,
    /\.big-label,\s*\.big-label-instruments,\s*label,/,
    'work and instrument section labels should share the sans-serif UI font'
);
assert.match(commonCss, /--sidebar-width:\s*220px;/);
assert.match(commonCss, /\.sidebar\s*\{[^}]*width:\s*var\(--sidebar-width\);/s);
assert.match(commonCss, /\.page-wrapper\s*\{[^}]*margin-left:\s*var\(--sidebar-width\);/s);
assert.match(commonCss, /#floating-bar\s*\{[^}]*left:\s*var\(--sidebar-width\)\s*!important;[^}]*width:\s*calc\(100% - var\(--sidebar-width\)\)\s*!important;/s);

const topPage = read('index.html');
assert.match(topPage, /\.subtitle\s*\{[^}]*font-family:\s*var\(--font-sans\);/s);
assert.match(topPage, /class="subtitle page-description"/);
assert.strictEqual(
    (topPage.match(/<p class="page-description"/g) || []).length,
    4,
    'all four HOME card descriptions should use the page-description font'
);

[
    'mahler-search-app/mahler.html',
    'mahler-search-app/richard_wagner.html',
    'mahler-search-app/richard_strauss.html'
].forEach(relativePath => {
    const page = read(relativePath);
    assert.match(page, /<p class="page-description">/);
});

[
    'mahler-search-app/terms_search.html',
    'mahler-search-app/rw_terms_search.html',
    'mahler-search-app/rs_terms_search.html'
].forEach(relativePath => {
    const page = read(relativePath);
    assert.match(page, /class="search-intro page-description"/);
    assert.match(page, /class="search-usage page-description"/);
    assert.match(page, /class="search-input-guide page-description"/);
    assert.match(page, /<div id="results"><\/div>/);
});

console.log('Page description font tests passed.');
