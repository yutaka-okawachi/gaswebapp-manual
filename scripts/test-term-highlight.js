const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repositoryRoot = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
const window = {
  addEventListener() {},
  appData: {},
  location: { pathname: '/mahler-search-app/terms_search.html', search: '' }
};
const context = vm.createContext({
  console,
  window,
  document: {},
  navigator: { userAgent: 'test' },
  URLSearchParams,
  fetch: async () => ({ ok: true }),
  setTimeout,
  clearTimeout
});

vm.runInContext(read('mahler-search-app/js/app.js'), context, {
  filename: 'mahler-search-app/js/app.js'
});

const termsHtml = read('mahler-search-app/terms_search.html');
const dictionaryPageHtml = read('mahler-search-app/dic.html');
const inlineScript = Array.from(termsHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi), match => match[1])
  .find(source => source.includes('Override/Define searchMahlerTermsLocal'));
assert.ok(inlineScript, 'GM 用語検索のインラインスクリプトが見つかること');
vm.runInContext(inlineScript, context, { filename: 'mahler-search-app/terms_search.html:inline' });

window.appData.dic_terms_index = [];

function search(query, de, matchMode) {
  window.appData.mahler = [{
    de,
    de_normalized: context.normalizeString(de),
    ja: 'テスト',
    data: 'x-a-1-1-vn'
  }];
  return window.searchMahlerTermsLocal(query, {}, matchMode);
}

function queryFromDictionaryLink(term) {
  const hrefs = Array.from(
    dictionaryPageHtml.matchAll(/href="(terms_search\.html\?[^"#]*source=dictionary_example[^"#]*)"/g),
    match => match[1]
  );
  const href = hrefs.find(candidate => new URL(candidate, 'https://example.test/').searchParams.get('q') === term);
  assert.ok(href, `用語集に ${term} の実例リンクがあること`);
  const params = new URL(href, 'https://example.test/').searchParams;
  assert.strictEqual(params.get('source'), 'dictionary_example');
  assert.ok(params.get('example_shards'));
  return params.get('q');
}

const periodTerms = ['N.B.', 'm.d.', 'm.Dpf.', 'm.s.'];
periodTerms.forEach(term => {
  const decoy = term.replace(/\./g, 'X');
  const de = `${decoy} / ${term}`;
  const expected = `<span style="color: red;">${term}</span>`;

  const directHtml = search(term, de);
  assert.ok(directHtml.includes(expected), `直接入力で ${term} を強調すること`);
  assert.ok(!directHtml.includes(`<span style="color: red;">${decoy}</span>`), `${term} のピリオドをワイルドカードにしないこと`);

  const dictionaryResultHtml = search(queryFromDictionaryLink(term), de);
  assert.ok(dictionaryResultHtml.includes(expected), `実例リンク経由で ${term} を強調すること`);
  assert.ok(!dictionaryResultHtml.includes(`<span style="color: red;">${decoy}</span>`), `実例リンク経由でも ${term} を完全一致で強調すること`);
});

[
  ['langsam', 'Sehr langsam', 'langsam'],
  ['daemp', 'Mit Dämpfer', 'Dämp']
].forEach(([query, de, highlighted]) => {
  const html = search(query, de);
  assert.ok(
    html.includes(`<span style="color: red;">${highlighted}</span>`),
    `${query} の従来の強調表示を保つこと`
  );
});

window.appData.richard_wagner = [{
  de: 'mXdX / m.d.',
  de_normalized: 'mxdx / m.d.',
  ja: 'テスト',
  page: '1',
  Oper: 'tristan'
}];
const genericHtml = window.searchRWTermsLocal('m.d.', {});
assert.ok(genericHtml.includes('<span style="color: red;">m.d.</span>'));
assert.ok(!genericHtml.includes('<span style="color: red;">mXdX</span>'));

[
  ['ab', 'ab', true],
  ['ab', 'ab,', true],
  ['ab', 'ab.', true],
  ['ab', 'Alle ab.', true],
  ['ab', 'Dämpfung ab!', true],
  ['ab', '(ab)', true],
  ['ab', 'abnehmen', false],
  ['ab', 'Labial', false]
].forEach(([query, de, shouldMatch]) => {
  const html = search(query, de, 'exact');
  assert.strictEqual(
    !html.includes('該当するデータが見つかりませんでした。'),
    shouldMatch,
    `完全一致: ${query} / ${de}`
  );
});

assert.ok(!search('ab', 'abnehmen', 'partial').includes('該当するデータが見つかりませんでした。'));

const exactHighlightHtml = search('ab', 'Alle ab, aber haben', 'exact');
assert.ok(exactHighlightHtml.includes('Alle <span style="color: red;">ab</span>, aber haben'));
assert.ok(!exactHighlightHtml.includes('<span style="color: red;">ab</span>er'));
assert.ok(!exactHighlightHtml.includes('h<span style="color: red;">ab</span>en'));

console.log('term highlight tests: OK');
