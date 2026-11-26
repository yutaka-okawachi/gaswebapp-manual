'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { extractFunction } = require('./test-utils/extract-function');
const read = file => fs.readFileSync(file, 'utf8');
const authored = read('mahler-search-app/js/wagner_strauss.js');
const result = read('frontend/result-format.js');
const bundle = read('mahler-search-app/js/app.js');
const fixture = 'A < B & "C"';
const safe = 'A &lt; B &amp; &quot;C&quot;';
const context = extra => vm.createContext({
    URL, normalizeString: String, hasScorePage: row => row.page !== '',
    window: { appData: { dic_terms_index: {} } }, ...extra
});
for (const formatter of [result, bundle]) {
    const c = context({ SCORE_METADATA: { work: {
        publisher: fixture, imslp: 'http://example.test/old',
        synopsis: 'https://example.test/score?a=1&b=2'
    } } });
    const names = ['escapeHtml','escapeHtmlWithBreaks','safeScoreMetadataLink','getScoreEditionsHref',
        'formatPrintedScorePageNotice','formatGenericResults'];
    vm.runInContext(names.map(name => extractFunction(formatter, name)).join('\n'), c);
    c.linkTermsInTranslation = String;
    const html = c.formatGenericResults([{
        Oper: 'work', Aufzug: 1, Szene: 2, '場面タイトル': fixture, '楽譜情報': fixture,
        page: fixture, de: 'Original', ja: 'Translation', whom: fixture
    }]);
    assert(html.includes('>' + safe + '</h2>'));
    assert(html.includes('>p.' + safe + '</div>'));
    assert(html.includes('【' + safe + '】'));
    assert(html.includes('https://example.test/score?a=1&amp;b=2'));
    assert(!html.includes('http://example.test/old'));
    assert(!html.includes(fixture));
}

for (const language of ['ja','en']) {
    let type = 'scene';
    const summary = { innerHTML: '' }, wrapper = { innerHTML: '', appendChild(node) { this.child = node; },
        querySelectorAll: () => [], querySelector: () => null };
    const opera = { value: 'work', parentElement: { textContent: fixture } };
    const c = context({ window: { __SITE_LANGUAGE__: language }, adjustFloatingBarSpacing: () => {},
        document: {
            getElementById: id => id === 'scene-options-wrapper' ? wrapper : summary,
            querySelector: selector => selector.includes('search-type') ? { value: type } : opera,
            querySelectorAll: () => [{ value: fixture, parentElement: { textContent: fixture } }],
            createElement: () => ({ innerHTML: '' })
        }
    });
    vm.runInContext(extractFunction(result,'escapeHtml') + '\n' +
        ['buildSceneCheckboxes','updateSelectionSummary'].map(name => extractFunction(authored,name)).join('\n'),c);
    c.buildSceneCheckboxes('work', [{ value: fixture, text: fixture }, { value: '1-2', text: 'Normal' }]);
    assert(wrapper.child.innerHTML.includes('value="' + safe + '"> ' + safe));
    c.buildSceneCheckboxes('work', [{ value: '1-1', text: 'Single' }]);
    assert(wrapper.child.innerHTML.includes(language === 'en' ? 'Entire work' : '全一幕'));
    for (type of ['scene','whom']) {
        c.updateSelectionSummary();
        assert.equal(summary.innerHTML.split(safe).length-1,2);
        assert(!summary.innerHTML.includes(fixture));
    }
}
console.log('Opera search displays sheet values as text and keeps HTTPS score links.');
