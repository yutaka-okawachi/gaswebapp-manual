const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repositoryRoot = path.resolve(__dirname, '..');
const generatorPath = path.join(repositoryRoot, 'src', 'generate_dic_html.js');
const generatorSource = fs.readFileSync(generatorPath, 'utf8');
const termsIndexPath = path.join(repositoryRoot, 'mahler-search-app', 'data', 'dic_terms_index.json');
const termsIndex = JSON.parse(fs.readFileSync(termsIndexPath, 'utf8'));
const dictionaryNotesPath = path.join(repositoryRoot, 'mahler-search-app', 'data', 'dic_notes.json');
const dictionaryNotes = JSON.parse(fs.readFileSync(dictionaryNotesPath, 'utf8'));
const context = vm.createContext({ console });

vm.runInContext(generatorSource, context, { filename: generatorPath });

const dictionaryData = [
  ['geteilt', '分かれて', '[B: 6]'],
  ['zusammen', '一緒に', '[RW: Oper ], [GM]'],
  ['mässig', '適度に', '[GM]'],
  ['mäßig', '適度に', '[GM]'],
  ['maessig 2', '予約済みIDとの衝突確認', '[GM]'],
  ['m.d.', '右手で', '[GM]'],
  ['m.Dpf.', 'ミュートをつけて', '[GM]'],
  ['N.B.', '注意せよ', '[GM]'],
  ['m.s.', '左手で', '[GM]'],
  ['unbekannt', '不明', '[UNKNOWN]']
];

const abbreviationData = [
  [1, '[RW] : Richard Wagner', ''],
  ['', '[RW: Oper]', 'Die Feen WWV 32'],
  ['', '', 'Parsifal WWV 111'],
  [2, '[B] : Anton Bruckner', ''],
  ['', '[B: 6]', 'Symphonie No.6'],
  [3, '[GM] : Gustav Mahler', '']
];

const html = context.generateDicHtml(dictionaryData, abbreviationData);
const generatedTermsIndex = context.generateDicTermsIndex(dictionaryData);

assert.strictEqual(generatedTermsIndex.geteilt, 'term-geteilt');
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(generatedTermsIndex['m-d'])),
  { id: 'term-m-d', original: 'm.d.' }
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(generatedTermsIndex['m-dpf'])),
  { id: 'term-m-dpf', original: 'm.Dpf.' }
);

const dottedAbbreviationIds = Object.keys(termsIndex)
  .filter(term => {
    const segments = term.split('-');
    return segments.length > 1 &&
      segments.some(segment => segment.length === 1) &&
      segments.every(segment => /^[a-z0-9]{1,3}$/i.test(segment));
  })
  .sort();
assert.deepStrictEqual(
  dottedAbbreviationIds,
  ['d-h', 'd-h-d-h', 'm-d', 'm-dpf', 'm-s', 'n-b', 'z-b']
);

const legacyGenerateTermPattern = normalizedTerm => normalizedTerm
  .split('ae').join('(?:ae|ä)')
  .split('oe').join('(?:oe|ö)')
  .split('ue').join('(?:ue|ü)')
  .split('ss').join('(?:ss|ß)')
  .split('-').join('[\\s\\-]?');
Object.keys(termsIndex)
  .filter(term => !dottedAbbreviationIds.includes(term))
  .forEach(term => {
    assert.strictEqual(
      context.generateTermPattern(term),
      legacyGenerateTermPattern(term),
      `non-abbreviation pattern changed for ${term}`
    );
  });

const dottedVariants = {
  'm-d': ['m.d.', 'm. d.', 'm-d', 'm d', 'md'],
  'm-dpf': ['m.Dpf.', 'm. Dpf.', 'm-Dpf', 'm Dpf', 'mDpf'],
  'm-s': ['m.s.', 'm. s.'],
  'n-b': ['N.B.', 'N. B.'],
  'z-b': ['z.B.', 'z. B.'],
  'd-h': ['d.h.', 'd. h.'],
  'd-h-d-h': ['D. H., d. H.']
};
Object.entries(dottedVariants).forEach(([term, variants]) => {
  const pattern = new RegExp(`^${context.generateTermPattern(term)}$`, 'i');
  variants.forEach(value => {
    assert.ok(pattern.test(value), `${term} pattern should match ${value}`);
  });
});
assert.strictEqual(new RegExp(`^${context.generateTermPattern('m-d')}$`, 'i').test('mad'), false);
assert.strictEqual(
  context.linkTermsInTranslation('m.d.', { 'm-d': 'term-m-d' }),
  '<a href="#term-m-d" class="term-link">m.d.</a>'
);
assert.strictEqual(
  context.linkTermsInTranslation('m.Dpf.', { 'm-dpf': 'term-m-dpf' }),
  '<a href="#term-m-dpf" class="term-link">m.Dpf.</a>'
);
assert.strictEqual(
  context.linkTermsInTranslation('N.B.', { 'n-b': 'term-n-b' }),
  '<a href="#term-n-b" class="term-link">N.B.</a>'
);
assert.strictEqual(
  context.linkTermsInTranslation('m.s.', { 'm-s': 'term-m-s' }),
  '<a href="#term-m-s" class="term-link">m.s.</a>'
);
assert.strictEqual(
  context.linkTermsInTranslation('m.d.', { 'm-d': generatedTermsIndex['m-d'] }),
  '<a href="#term-m-d" class="term-link">m.d.</a>'
);
const futureDottedIndex = context.generateDicTermsIndex([
  ['Dpf.ab.', '将来追加される未知の略記', '[GM]']
]);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(futureDottedIndex['dpf-ab'])),
  { id: 'term-dpf-ab', original: 'Dpf.ab.' }
);
assert.strictEqual(
  context.linkTermsInTranslation('Dpf.ab.', futureDottedIndex),
  '<a href="#term-dpf-ab" class="term-link">Dpf.ab.</a>'
);

const regeneratedTermsIndex = context.generateDicTermsIndex(dictionaryNotes);
dictionaryNotes.forEach(row => {
  const original = String(row[0] || '');
  const normalizedId = context.normalizeForId(original);
  if (!normalizedId || !regeneratedTermsIndex[normalizedId]) return;
  const entry = regeneratedTermsIndex[normalizedId];
  if (original.includes('.')) {
    assert.strictEqual(typeof entry, 'object', `dotted term should retain its spelling: ${original}`);
    const linked = context.linkTermsInTranslation(original, { [normalizedId]: entry });
    assert.ok(
      linked.includes(`href="#${entry.id}" class="term-link"`),
      `dotted term should link after regeneration: ${original}`
    );
  } else {
    assert.strictEqual(typeof entry, 'string', `ordinary term format changed: ${original}`);
  }
});
assert.strictEqual(
  context.linkTermsInTranslation('rasch.', { rasch: 'term-rasch' }),
  '<a href="#term-rasch" class="term-link">rasch</a>.'
);

assert.ok(html.includes('href="#abbr-b-6" class="abbr-link"'));
assert.ok(html.includes('href="#abbr-rw-oper" class="abbr-link"'));
assert.ok(html.includes('href="#abbr-gm" class="abbr-link"'));
assert.ok(html.includes('data-return-target="term-geteilt"'));
assert.strictEqual((html.match(/\sid="term-maessig"/g) || []).length, 1);
assert.strictEqual((html.match(/\sid="term-maessig-2"/g) || []).length, 1);
assert.strictEqual((html.match(/\sid="term-maessig-3"/g) || []).length, 1);
const generatedIds = Array.from(html.matchAll(/\sid="([^"]+)"/g), match => match[1]);
assert.strictEqual(new Set(generatedIds).size, generatedIds.length);
assert.ok(html.includes('<span class="source">[UNKNOWN]</span>'));
assert.strictEqual((html.match(/\sid="abbr-rw-oper"/g) || []).length, 1);
assert.strictEqual((html.match(/data-abbr-id="abbr-rw-oper"/g) || []).length, 2);
assert.ok(html.includes('id="abbr-gm" data-abbr-id="abbr-gm" tabindex="-1"'));
assert.ok(html.includes('id="abbrReturnPanel" class="abbr-return-panel" hidden'));
assert.ok(html.includes("dictionaryReturn"));
assert.ok(html.includes("targetElement.focus({ preventScroll: true })"));
assert.strictEqual(/\.abbr-return-panel\s*\{[^}]*position:\s*sticky/s.test(html), false);
assert.ok(html.includes('scrollTargetElement = returnPanel'));
assert.ok(html.includes('font-size: 0.9rem;'));
const examplePosition = html.indexOf('<div class="example-wrapper"', html.indexOf('term-zusammen'));
const sourcePosition = html.indexOf('<span class="source">', html.indexOf('term-zusammen'));
assert.ok(examplePosition > -1 && sourcePosition > examplePosition);

console.log('dictionary abbreviation link tests: OK');
