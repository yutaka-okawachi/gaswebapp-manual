const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, URLSearchParams });
[
  'src/dictionary_example_shards.js',
  'src/generate_dic_html.js',
  'frontend/search-core.js'
].forEach(file => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context));

const dictionaryData = [
  ['nehmen', '取る．', '[GM]'],
  ['nimmt', '取って．', '[GM]'],
  ['stürzt', '突進する．', '[GM]'],
  ['Abstufungen', '段階的な変化．', '[GM]'],
  ['gewonnen', '得た．', '[GM]'],
  ['gewonnenen', '得られた．', '[GM]']
];
const mappingData = [
  ['nehmen', 'nimmt', '活用形', '対象外', '対象', '独立見出しあり'],
  ['stürzt', 'stürzen', '不定詞', '対象', '対象', ''],
  ['Abstufungen', 'Abstufung', '単数形', '対象', '対象', ''],
  ['gewonnenen', 'gewonnen', '過去分詞の基本形', '対象外', '対象', '独立見出しあり']
];

const termsIndex = context.generateDicTermsIndex(dictionaryData, mappingData);
assert.strictEqual(termsIndex.nimmt, 'term-nimmt', '独立見出し nimmt は nehmen へ転送しない');
assert.strictEqual(termsIndex.stuerzt.id, 'term-stuerzt', '本番見出し stürzt を保つ');
assert.strictEqual(termsIndex.stuerzen.id, 'term-stuerzt', '関連語形 stürzen は stürzt へ転送する');
assert.strictEqual(termsIndex.abstufung.id, 'term-abstufungen', '単数形 Abstufung は元の見出しへ転送する');
assert.strictEqual(context.getDictionaryTermResolution('Abstufung', termsIndex).category, 'INFLECTION');
assert.strictEqual(context.buildTermResolutionNotice('Abstufung', termsIndex, 1), '');
assert.strictEqual(context.buildTermResolutionNotice('stuerzen', termsIndex, 18), '');
assert.match(context.buildTermResolutionNotice('stuerzen', termsIndex, 18, true), /検索対象は見出しと登録済みの語形・別綴りに一致する実例．/);
assert.deepStrictEqual(Array.from(context.getDictionaryExampleSearchQueries('stuerzen', termsIndex, false)), ['stuerzen']);
context.window = { location: { search: '?q=st%C3%BCrzt&source=dictionary_example' } };
context.document = { getElementById: () => ({ hidden: false }) };
assert.strictEqual(context.isDictionaryExampleSearch('stuerzt'), true);
assert.strictEqual(context.isDictionaryExampleSearch('stuerzen'), false);
context.document = { getElementById: () => ({ hidden: true }) };
assert.strictEqual(context.isDictionaryExampleSearch('stuerzt'), false);
assert.strictEqual(context.getDictionaryTermResolution('tätig', {
  taetig: { id: 'term-thaetig', canonical: 'thätig', type: '現代綴り' }
}).category, 'ORTHOGRAPHIC_VARIANT');
assert.strictEqual(termsIndex.gewonnen, 'term-gewonnen', '独立見出し gewonnen を優先する');
assert.strictEqual(termsIndex.gewonnenen.id, 'term-gewonnenen', '独立見出し gewonnenen を保つ');
assert.deepStrictEqual(
  Array.from(termsIndex.nehmen.exampleVariants),
  ['nimmt'],
  '用語検索対象外でも実例検索対象には含める'
);

const exampleQueries = context.getDictionaryExampleSearchQueries('nehmen', termsIndex, true);
assert.deepStrictEqual(Array.from(exampleQueries), ['nehmen', 'nimmt']);
assert.strictEqual(context.getDictionaryTermResolution('nimmt', termsIndex), null);
assert.strictEqual(context.getDictionaryTermResolution('stürzen', termsIndex).canonical, 'stürzt');

const exampleData = context.buildDictionaryExampleShardFiles(dictionaryData, {
  mahler: [
    { de: 'Er nimmt den Takt.', de_normalized: 'er nimmt den takt' },
    { de: 'Plötzlich stürzt alles.', de_normalized: 'ploetzlich stuerzt alles' }
  ],
  wagner: [],
  strauss: []
}, mappingData);
assert.ok(context.getDictionaryExampleShardIds(exampleData.queryIndex, 'gm', 'nehmen').length > 0);
assert.ok(context.getDictionaryExampleShardIds(exampleData.queryIndex, 'gm', 'stürzt').length > 0);
const dictionaryHtml = context.generateDicHtml(dictionaryData, [], exampleData.queryIndex, mappingData);
assert.match(dictionaryHtml, /id="term-nehmen"/);
assert.match(dictionaryHtml, /id="term-abstufungen"/);
assert.match(dictionaryHtml, /id="term-gewonnenen"/);
assert.match(dictionaryHtml, /q=nehmen&amp;source=dictionary_example|q=nehmen&source=dictionary_example/);

console.log('Experimental dictionary preview tests passed.');
