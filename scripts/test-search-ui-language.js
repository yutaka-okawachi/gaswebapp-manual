'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { extractFunction } = require('./test-utils/extract-function');

const mahlerSource = fs.readFileSync('mahler-search-app/mahler.html', 'utf8');
const sharedSource = fs.readFileSync('frontend/search.js', 'utf8');
const operaSource = fs.readFileSync('mahler-search-app/js/wagner_strauss.js', 'utf8');
const japanese = /[ぁ-ゖァ-ヺ一-龯]/;
const sentence = 'For the editions used, see ';
const scoreLink = /href="other\.html#score-mahler" target="_blank" rel="noopener noreferrer"/;
const fixture = { de: 'mit Dämpfer', ja: 'with mute', data: 'gm-1-1-22-fl' };

async function checkMahlerEntryPoint() {
    const results = { innerHTML: '' };
    const button = { disabled: false };
    const selection = { works: [], instruments: [], orchestra: 'on' };
    const window = { __SITE_LANGUAGE__: 'en' };
    const scheduled = [];
    let rendered = 0;
    const context = vm.createContext({
        window,
        document: {
            getElementById: () => results,
            querySelector: selector => selector.startsWith('#floating-bar') ? button : { value: selection.orchestra }
        },
        getSelectedWorks: () => selection.works,
        getSelectedInstruments: () => selection.instruments,
        focusResultsPanel() {},
        setTimeout(callback) { scheduled.push(callback); },
        currentSearchId: 0,
        currentSearchResults: [],
        currentSearchIndex: 0,
        searchObserver: null,
        console: { error() {} },
        IntersectionObserver: class { disconnect() {} },
        loadMoreSearchResults() { rendered++; }
    });
    for (const name of ['search', 'cancelSearch', 'renderSearchResults']) {
        vm.runInContext(extractFunction(mahlerSource, name), context);
    }
    vm.runInContext(extractFunction(sharedSource, 'buildMahlerScoreInfoBanner'), context);

    context.search();
    assert.match(results.innerHTML, /Select a work\./);
    selection.works = ['ALL'];
    selection.orchestra = 'off';
    context.search();
    assert.match(results.innerHTML, /Select at least one instrument\./);
    assert.equal(scheduled.length, 0);
    selection.orchestra = 'on';
    context.search();
    assert.match(results.innerHTML, /Searching…/);
    await scheduled.shift()();
    assert.match(results.innerHTML, /Search is unavailable.*Reload the page/);
    assert.equal(button.disabled, false);

    window.searchMahlerDataLocal = async () => { throw new Error('テスト: do not show raw error'); };
    context.search();
    await scheduled.shift()();
    assert.match(results.innerHTML, /Search failed\. Please try again\./);
    assert(!japanese.test(results.innerHTML));

    window.searchMahlerDataLocal = async () => [];
    context.search();
    await scheduled.shift()();
    assert.match(results.innerHTML, /No matching entries found\./);
    assert(!results.innerHTML.includes('score-info-banner'));

    window.searchMahlerDataLocal = async () => [{ ...fixture, count: 1, locs: [] }];
    context.search();
    await scheduled.shift()();
    assert.match(results.innerHTML, />1 entry</);
    assert(results.innerHTML.includes(sentence));
    assert.match(results.innerHTML, scoreLink);
    assert.match(results.innerHTML, />Mahler score information ↗<\/a>\.<\/div>/);
    assert(!japanese.test(results.innerHTML));
    assert.equal(rendered, 1);
    context.search();
    context.cancelSearch();
    await scheduled.shift()();
    assert.match(results.innerHTML, /Search cancelled\./);
    assert.equal(rendered, 1, 'Cancelled fixture may not overwrite the UI');

    window.__SITE_LANGUAGE__ = 'ja';
    context.search();
    await scheduled.shift()();
    assert.match(results.innerHTML, />1件見つかりました．</);
    assert.match(results.innerHTML, /使用楽譜の一覧は，<a /);
    assert.match(results.innerHTML, /楽譜情報\(Score information\) ↗<\/a> を参照．/);
    assert.match(results.innerHTML, scoreLink);
}

function checkSharedFallback() {
    const context = vm.createContext({
        window: { __SITE_LANGUAGE__: 'en', appData: { mahler: [fixture] } },
        linkTermsInTranslation: value => value,
        formatGmTranslation: value => value,
        escapeHtml: value => value,
        console: { error() {} }
    });
    vm.runInContext(sharedSource, context);
    let html = context.window.searchMahlerDataLocal(['ALL'], ['fl'], true);
    assert(html.includes(sentence));
    assert.match(html, scoreLink);
    assert.match(html, /mit Dämpfer/);
    assert.match(html, /with mute/);
    assert.match(html, />1 entry<\/div>/);
    assert.match(html, /\(1 entry\)/);
    html = context.window.searchMahlerDataLocal(['ALL'], ['ob'], false);
    assert.match(html, /No matching entries found\./);
    assert(!html.includes('score-info-banner'));
    context.window.appData.mahler = null;
    assert.match(context.window.searchMahlerDataLocal(['ALL'], ['fl'], true), /Search data has not loaded\./);
}

function checkOperaSummary(language, title, mode) {
    const summary = { innerHTML: '' };
    const selected = { opera: null, mode: null };
    const context = vm.createContext({
        window: { __SITE_LANGUAGE__: language },
        document: {
            getElementById: id => id === 'page-input' ? { value: '45 & 46' } : summary,
            querySelector: selector => selector.includes('"opera"') ? selected.opera : selected.mode,
            querySelectorAll: selector => selector.includes('-scene') ? [{ parentElement: { textContent: 'Act 2, Scene 1' } }] : [{ value: 'Alberich' }]
        },
        adjustFloatingBarSpacing() {},
        escapeHtml: value => value.replace(/&/g, '&amp;')
    });
    vm.runInContext(extractFunction(operaSource, 'updateSelectionSummary'), context);
    context.updateSelectionSummary();
    assert.match(summary.innerHTML, language === 'en' ? /Selected work:[\s\S]*>None</ : /選んだ作品：[\s\S]*>なし</);
    selected.opera = { value: 'test', parentElement: { textContent: title } };
    selected.mode = { value: mode };
    context.updateSelectionSummary();
    const labels = language === 'en'
        ? { scene: 'Selected scenes:', whom: 'Selected targets:', page: 'Pages entered:' }
        : { scene: '選んだ場面：', whom: '選んだ指示対象：', page: '入力したページ：' };
    assert(summary.innerHTML.includes(title));
    assert(summary.innerHTML.includes(labels[mode]));
    for (const [otherMode, label] of Object.entries(labels)) {
        if (otherMode !== mode) assert(!summary.innerHTML.includes(label));
    }
    assert(summary.innerHTML.includes({scene:'Act 2, Scene 1',whom:'Alberich',page:'45 &amp; 46'}[mode]));
    if (language === 'en') assert(!japanese.test(summary.innerHTML));
}

checkMahlerEntryPoint().then(() => {
    checkSharedFallback();
    for (const language of ['en', 'ja']) {
        for (const title of ['Parsifal', 'Intermezzo']) {
            for (const mode of ['scene', 'whom', 'page']) checkOperaSummary(language, title, mode);
        }
    }
    console.log('Search UI language: GM fixture success, errors, empty, cancellation, shared fallback, and RW/RS selection summaries without the DOM translator passed.');
}).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
