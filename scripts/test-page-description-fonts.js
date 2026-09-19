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
assert.match(
    topPage,
    /<ul class="page-description"[^>]*>[\s\S]*?<li>Sigfrid Karg-Elert<\/li>/,
    'the dictionary composer list should match the HOME description font'
);
assert.match(
    topPage,
    /Richard Wagner（リヒャルト・ワーグナー），Gustav Mahler（グスタフ・マーラー），Richard Strauss（リヒャルト・シュトラウス）/,
    'HOME description should use the full composer names'
);
assert.match(
    topPage,
    /収録した<a href="mahler-search-app\/dic\.html">ドイツ語の音楽用語集<\/a>も参照可能．/,
    'HOME description should link to the dictionary without Japanese quotation marks'
);
assert.match(
    topPage,
    /\.global-note\s*\{[^}]*font-family:\s*var\(--font-sans\);/s,
    'HOME warning notes should match the description font'
);

[
    'mahler-search-app/mahler.html',
    'mahler-search-app/richard_wagner.html',
    'mahler-search-app/richard_strauss.html',
    'mahler-search-app/dic.html'
].forEach(relativePath => {
    const page = read(relativePath);
    assert.match(page, /<p class="page-description"/);
});

assert.match(
    read('src/generate_dic_html.js'),
    /<p class="page-description"/,
    'dic generator template should include page-description class'
);
assert.match(
    read('src/generate_dic_html.js'),
    /スコアで確認したドイツ語の一般的な意味，音楽用語としての訳例・コメント・出典を一覧で確認可能．/,
    'dic generator template should include the revised dictionary description'
);
assert.match(
    read('src/generate_dic_html.js'),
    /※「実例を見る」は，Richard Strauss についてはオペラのみ対応．/,
    'dic generator template should retain the Richard Strauss example limitation'
);

assert.match(
    read('mahler-search-app/dic.html'),
    /\.info-notice\s*\{[^}]*font-family:\s*var\(--font-sans\);/s,
    'dictionary info-notice should use sans-serif font stack'
);
assert.match(
    read('src/generate_dic_html.js'),
    /\.info-notice\s*\{[^}]*font-family:\s*var\(--font-sans\);/s,
    'dictionary generator info-notice should use sans-serif font stack'
);

[
    'mahler-search-app/terms_search.html',
    'mahler-search-app/rw_terms_search.html',
    'mahler-search-app/rs_terms_search.html'
].forEach(relativePath => {
    const page = read(relativePath);
    assert.match(page, /class="search-intro page-description"/);
    assert.doesNotMatch(page, /class="search-usage page-description"/);
    assert.match(page, /class="search-input-guide page-description"/);
    assert.match(page, /<div id="results"><\/div>/);
    assert.match(page, /class="search-intro page-description">.*?検索可能．.*?検索すると，.*?<\/p>/);
    assert.doesNotMatch(page, /検索できます/);
    assert.doesNotMatch(page, /「検索」を押すと/);
    assert.match(page, /<a href="dic\.html">ドイツ語の音楽用語集<\/a>/);
    assert.doesNotMatch(page, /<a href="dic\.html"[^>]*target="_blank"/);
});

[
    'mahler-search-app/rw_synopsis.html',
    'mahler-search-app/rs_synopsis.html'
].forEach(relativePath => {
    const page = read(relativePath);
    assert.match(page, /<h1 class="synopsis-page-title">[\s\S]*?<\/h1>\s*<p class="page-description">.*?別タブで表示．<\/p>/);
});

[
    'mahler-search-app/mahler.html',
    'mahler-search-app/richard_wagner.html',
    'mahler-search-app/richard_strauss.html'
].forEach(relativePath => {
    const page = read(relativePath);
    assert.match(page, /<a href="dic\.html">ドイツ語の音楽用語集<\/a>/);
    assert.doesNotMatch(page, /font-size:\s*1\.2rem/);
    assert.doesNotMatch(page, /<a href="dic\.html"[^>]*target="_blank"/);
});

assert.match(
    commonCss,
    /\.page-description a,\s*\.search-usage a\s*\{[^}]*color:\s*var\(--button-bg\);[^}]*text-decoration:\s*none;/s,
    'page description links should match HOME breadcrumb link style'
);

[
    'mahler-search-app/richard_wagner.html',
    'mahler-search-app/richard_strauss.html'
].forEach(relativePath => {
    const page = read(relativePath);
    assert.doesNotMatch(page, /条件を指定して検索/, 'RW/RS descriptions should not contain 条件を指定して検索');
});

const otherPage = read('mahler-search-app/other.html');
assert.match(otherPage, /id="score-mahler"/, 'other.html should have score-mahler id anchor');

const mahlerPage = read('mahler-search-app/mahler.html');
assert.match(mahlerPage, /score-info-banner/, 'mahler.html should render score-info-banner');
assert.match(mahlerPage, /other\.html#score-mahler/, 'mahler.html should link to other.html#score-mahler');
assert.match(mahlerPage, /楽譜情報\(Score information\)/, 'mahler.html should contain score information link text');
assert.match(mahlerPage, /使用楽譜の一覧は，<a href="other\.html#score-mahler"[^>]*>楽譜情報\(Score information\) ↗<\/a> を参照．/, 'mahler.html score info banner text should use を参照． with Japanese comma/period');

console.log('Page description font tests passed.');
