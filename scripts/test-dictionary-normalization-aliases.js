const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { dictionaryData, aliasData } = require('./fixtures/dictionary-normalization');

const repositoryRoot = path.resolve(__dirname, '..');
const generatorPath = path.join(repositoryRoot, 'src', 'generate_dic_html.js');
const searchCorePath = path.join(repositoryRoot, 'frontend', 'search-core.js');
const frontendPath = path.join(repositoryRoot, 'frontend', 'result-format.js');

const generatorContext = vm.createContext({ console });
vm.runInContext(fs.readFileSync(generatorPath, 'utf8'), generatorContext, {
  filename: generatorPath
});

const expectedTargets = new Map(aliasData.map(row => [row[0], `term-${generatorContext.normalizeForId(row[1])}`]));
const termsIndex = generatorContext.generateDicTermsIndex(dictionaryData, aliasData);

assert.strictEqual(dictionaryData.length, 10);
assert.strictEqual(aliasData.length, 12);

aliasData.forEach(([alias, canonical, type]) => {
  const aliasKey = generatorContext.normalizeForId(alias);
  const entry = termsIndex[aliasKey];
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(entry)),
    { id: expectedTargets.get(alias), original: alias, canonical, type },
    `${alias} should point to its canonical headword`
  );

  const linked = generatorContext.linkTermsInTranslation(alias, termsIndex);
  assert.strictEqual(
    linked,
    `<a href="#${expectedTargets.get(alias)}" class="term-link">${alias}</a>`,
    `${alias} should remain visible while linking to its canonical headword`
  );
});

dictionaryData.forEach(([canonical]) => {
  const canonicalKey = generatorContext.normalizeForId(canonical);
  assert.strictEqual(
    termsIndex[canonicalKey],
    `term-${canonicalKey}`,
    `${canonical} should retain the direct headword entry`
  );
});

const collisionIndex = generatorContext.generateDicTermsIndex(
  [
    ['markieren', '', ''],
    ['markiert', '', '']
  ],
  [['markiert', 'markieren', '過去分詞', '']]
);
assert.strictEqual(
  collisionIndex.markiert,
  'term-markiert',
  'an exact headword must take priority over an alias with the same key'
);

const missingTargetIndex = generatorContext.generateDicTermsIndex(
  [['markieren', '', '']],
  [['unbekannte Form', 'nicht vorhanden', '試験', '']]
);
assert.strictEqual(
  missingTargetIndex['unbekannte-form'],
  undefined,
  'an alias whose canonical headword is missing must not be registered'
);

const html = generatorContext.generateDicHtml(dictionaryData, [], undefined, aliasData);
aliasData.forEach(([alias]) => {
  assert.ok(
    html.includes(`<a href="#${expectedTargets.get(alias)}" class="term-link">${alias}</a>`),
    `generated dictionary HTML should preserve and link ${alias}`
  );
});

const frontendContext = vm.createContext({ console, window: {} });
vm.runInContext(fs.readFileSync(searchCorePath, 'utf8'), frontendContext, {
  filename: searchCorePath
});
vm.runInContext(fs.readFileSync(frontendPath, 'utf8'), frontendContext, {
  filename: frontendPath
});
aliasData.forEach(([alias]) => {
  assert.strictEqual(
    frontendContext.window.linkTermsInTranslation(alias, termsIndex),
    `<a href="dic.html#${expectedTargets.get(alias)}" class="term-link">${alias}</a>`,
    `search results should preserve and link ${alias}`
  );
});

assert.deepStrictEqual(
  JSON.parse(JSON.stringify(
    frontendContext.window.getDictionaryExampleSearchQueries('markieren', termsIndex, true)
  )),
  ['markieren', 'markiert', 'marcirt', 'markirt'],
  'dictionary example searches should expand a canonical headword to its registered forms'
);
assert.strictEqual(
  frontendContext.window.buildTermResolutionNotice('stürzt', termsIndex, 1),
  '<p class="term-resolution-notice">「stürzt」は「stürzen」の語形として検索している．</p>'
);
assert.strictEqual(
  frontendContext.window.buildTermResolutionNotice('marcirt', termsIndex, 1),
  '<p class="term-resolution-notice">「marcirt」は「markieren」の別綴りとして検索している．</p>'
);
assert.strictEqual(
  frontendContext.window.buildTermResolutionNotice('markieren', termsIndex, 1),
  '',
  'a canonical headword should not show a resolution notice'
);

const typoIndex = generatorContext.generateDicTermsIndex(
  [['markieren', '', '']],
  [['markiren', 'markieren', '誤入力', '']]
);
assert.strictEqual(
  frontendContext.window.buildTermResolutionNotice('markiren', typoIndex, 0),
  '<p class="term-resolution-notice term-resolution-suggestion">もしかして：<a href="?q=markieren">markieren</a></p>'
);
assert.strictEqual(
  frontendContext.window.buildTermResolutionNotice('markiren', typoIndex, 1),
  '',
  'a typo suggestion should appear only when there are no results'
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(
    frontendContext.window.getDictionaryExampleSearchQueries('markieren', termsIndex, false)
  )),
  ['markieren'],
  'ordinary searches should retain their existing single-query behavior'
);
assert.ok(
  frontendContext.window.matchesAnyTermQuery(
    'sehr markiert',
    frontendContext.window.getDictionaryExampleSearchQueries('markieren', termsIndex, true)
  ),
  'a registered form should match a canonical dictionary example query'
);

console.log('dictionary normalization alias tests: OK');
