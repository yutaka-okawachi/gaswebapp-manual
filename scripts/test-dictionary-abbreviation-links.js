const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repositoryRoot = path.resolve(__dirname, '..');
const generatorPath = path.join(repositoryRoot, 'src', 'generate_dic_html.js');
const generatorSource = fs.readFileSync(generatorPath, 'utf8');
const context = vm.createContext({ console });

vm.runInContext(generatorSource, context, { filename: generatorPath });

const dictionaryData = [
  ['geteilt', '分かれて', '[B: 6]'],
  ['zusammen', '一緒に', '[RW: Oper ], [GM]'],
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

assert.ok(html.includes('href="#abbr-b-6" class="abbr-link"'));
assert.ok(html.includes('href="#abbr-rw-oper" class="abbr-link"'));
assert.ok(html.includes('href="#abbr-gm" class="abbr-link"'));
assert.ok(html.includes('data-return-target="term-geteilt"'));
assert.ok(html.includes('<span class="source">[UNKNOWN]</span>'));
assert.strictEqual((html.match(/\sid="abbr-rw-oper"/g) || []).length, 1);
assert.strictEqual((html.match(/data-abbr-id="abbr-rw-oper"/g) || []).length, 2);
assert.ok(html.includes('id="abbr-gm" data-abbr-id="abbr-gm" tabindex="-1"'));
assert.ok(html.includes('id="abbrReturnPanel" class="abbr-return-panel" hidden'));
assert.ok(html.includes("dictionaryReturn"));
assert.ok(html.includes("targetElement.focus({ preventScroll: true })"));
assert.strictEqual(/\.abbr-return-panel\s*\{[^}]*position:\s*sticky/s.test(html), false);
assert.ok(html.includes('scrollTargetElement = returnPanel'));
assert.ok(html.includes('font-size: 0.94rem;'));

console.log('dictionary abbreviation link tests: OK');
