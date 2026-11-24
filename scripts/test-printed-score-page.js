'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { extractFunction } = require('./test-utils/extract-function');
const { localizeHtml } = require('./english-locale');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const bundle = read('mahler-search-app/js/app.js');
const shared = read('mahler-search-app/js/wagner_strauss.js');
const help = {
  ja: '使用楽譜の印刷ページ番号を半角で入力する．pdfの通算ページ番号ではないことに注意．',
  en: 'Scores used: Enter the printed page number for the edition listed, not the page number shown by the PDF viewer.'
};
const notes = {
  ja: '「p.」は使用楽譜の印刷ページ番号を示す．pdfの通算ページ番号ではないことに注意．',
  en: '“p.” refers to the page number printed on the score used for this site, not the PDF viewer’s page number.'
};
const anchor = '#scores-used';
const nestedHref = 'other.html' + anchor;
const rootHref = 'mahler-search-app/' + nestedHref;
const textOnly = html => html.replace(/<[^>]+>/g, '');
for (const html of [read('mahler-search-app/other.html'), localizeHtml(read('mahler-search-app/other.html'))]) {
  assert.match(html, /<details\b[^>]*id="scores-used"[^>]*\bopen>/);
}
function expectInput(html, id, href) {
  const pattern = new RegExp('<input[^>]+id="'+id+'"[^>]+aria-describedby="'+id+'-help"[^>]+placeholder="[^"]+">');
  assert.match(html, pattern);
  for (const lang of ['ja', 'en']) {
    const rendered = lang === 'en' ? localizeHtml(html) : html;
    assert.match(rendered, new RegExp('<p id="'+id+'-help"[^>]*>'));
    assert(textOnly(rendered).includes(help[lang]));
    assert(rendered.includes(`<a href="${href}">${lang==='en'?'Scores used':'使用楽譜'}</a>`));
    if (lang === 'en') assert(!textOnly(rendered).includes(help.ja));
  }
}

for (const [composer, id] of [['Wagner', 'wagner-page-input'], ['Strauss', 'page-input']]) {
  expectInput(read('mahler-search-app/richard_'+composer.toLowerCase()+'.html'), 'page-input', nestedHref);
  const container = { innerHTML: '' };
  const func = 'renderRichard'+composer+'Search';
  const location = { pathname: '/gaswebapp-manual/index.html' };
  const context = vm.createContext({ window: { location }, attachRichardWagnerEventHandlers() {}, attachRichardStraussEventHandlers() {} });
  vm.runInContext(extractFunction(bundle, 'getScoreEditionsHref') + '\n' + extractFunction(bundle, func), context);
  for (const prefix of ['/gaswebapp-manual/', '/gaswebapp-manual/en/']) {
    location.pathname = prefix + 'index.html';
    assert.equal(new URL(context.getScoreEditionsHref(), 'https://example.test'+location.pathname).pathname, prefix+'mahler-search-app/other.html');
    context[func](container);
    expectInput(container.innerHTML, id, rootHref);
    location.pathname = prefix + 'mahler-search-app/index.html';
    assert.equal(new URL(context.getScoreEditionsHref(), 'https://example.test'+location.pathname).pathname, prefix+'mahler-search-app/other.html');
    context[func](container);
    expectInput(container.innerHTML, id, nestedHref);
  }
}

for (const [title, oper, workKey, page, otherPage, termFn] of [
  ['Richard Wagner', 'parsifal', 'richard_wagner', 475, 472, 'searchRWTermsLocal'],
  ['Richard Strauss', 'intermezzo', 'richard_strauss', 103, 104, 'searchRSTermsLocal']
]) {
  for (const lang of ['ja', 'en']) {
    const rows = [1, 2].map(n => ({ Oper: oper, Aufzug: 3, Szene: 1, page, whom: 'Singer', de: 'vorne '+n, ja: 'forward', '場面タイトル': 'Act III' }));
    const pageField = { value: String(page) };
    const legacyResults = { innerHTML: '' };
    let html = '';
    let scene = 'all';
    const window = { __SITE_LANGUAGE__: lang, location: { pathname: '/gaswebapp-manual/'+(lang==='en'?'en/':'')+'mahler-search-app/'+workKey+'.html' }, appData: { [workKey]: rows, dic_terms_index: {} } };
    const c = vm.createContext({
      window, console,
      document: {
        title,
        querySelector: () => ({ value: oper }),
        querySelectorAll: selector => selector.includes('-scene') ? [{ value: scene, parentElement: { textContent: 'Act III' } }] :
          selector.includes('-whom') ? [{ value: 'Singer' }] : [],
        getElementById: id => id === 'results' ? legacyResults : pageField
      },
      currentSearchId: 0,
      setTimeout: f => f(),
      setResults: out => { html = out; },
      injectMottlNote: s => s,
      escapeHtml: String,
      escapeHtmlWithBreaks: String,
      linkTermsInTranslation: String,
      isDictionaryExampleSearch: () => false,
      getDictionaryExampleSearchQueries: query => [query],
      matchesAnyTermQuery: (de, queries) => queries.some(q => de.includes(q)),
      createTermHighlightRegexForQueries: () => /(vorne)/g,
      buildTermResolutionNotice: () => ''
    });
    const funcs = ['hasScorePage', 'getScoreEditionsHref', 'formatPrintedScorePageNotice', 'formatGenericResults', 'parsePageInput', 'normalizeString', 'normalizeTermSearchText', 'searchGenericTermsLocal'];
    vm.runInContext(funcs.map(f => extractFunction(bundle,f)).join('\n'),c);
    for (const handler of ['searchByScene','searchByPage','searchByWhom']) vm.runInContext(extractFunction(shared,handler),c);
    for (const key of ['searchRWTermsLocal','searchRSTermsLocal']) {
      const assignment = bundle.match(new RegExp('window\\.'+key+' = function \\([^]*?\\n};'));
      assert(assignment,key);
      vm.runInContext(assignment[0],c);
    }

    const expectResults = () => {
      assert.equal((html.match(/class="printed-score-page-note"/g)||[]).length, 1);
      const text = textOnly(html);
      assert(text.includes(notes[lang]));
      assert(!text.includes(notes[lang==='en'?'ja':'en']));
      assert(html.includes(`<a href="${nestedHref}">${lang==='en'?'score used for this site':'使用楽譜'}</a>`));
      assert.equal((html.match(new RegExp('p\\.'+page+'\\b','g'))||[]).length, 2);
      assert(text.indexOf(notes[lang])<text.indexOf('p.'+page));
    };

    c.searchByScene(); expectResults(); // Entire selected work
    scene = '3-1'; c.searchByScene(); expectResults(); // One scene
    c.searchByPage(); expectResults();
    c.searchByWhom(); expectResults();
    for (const mode of ['Scene', 'Page']) {
      const legacyFn = 'search'+title.replace(' ', '')+'By'+mode;
      vm.runInContext(extractFunction(bundle, legacyFn), c);
      c[legacyFn]();
      html = legacyResults.innerHTML;
      expectResults();
    }
    html = window[termFn]('vorne', {}, 'partial'); expectResults();

    pageField.value = String(otherPage);
    c.searchByPage();
    assert(!html.includes('printed-score-page-note')); // Parsifal’s reference PDF opens at 472, but the printed page is 475.
    html = window[termFn]('zzz', {}, 'partial');
    assert(!html.includes('printed-score-page-note'));
    assert(!c.formatGenericResults([{...rows[0],page:''}]).includes('printed-score-page-note'));
  }
}
console.log('Printed score pages: input hints in JA/EN for static and shared RW/RS forms; one note in real work, scene, page, target and term result paths; no note for empty results.');
