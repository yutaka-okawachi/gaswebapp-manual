const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `${name} should exist`);
  const openBrace = source.indexOf('{', start);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${name} closing brace was not found`);
}

function extractFunctionExpression(source, start) {
  const openBrace = source.indexOf('{', start);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error('function expression closing brace was not found');
}

const serverSource = read('src/mahler_server.js');
const serverContext = {};
vm.createContext(serverContext);
vm.runInContext([
  extractFunction(serverSource, 'normalizeString'),
  extractFunction(serverSource, 'isTermWordCharacter'),
  extractFunction(serverSource, 'matchesTermQuery')
].join('\n'), serverContext);

const cases = [
  ['ab', 'ab', 'exact', true],
  ['ab,', 'ab', 'exact', true],
  ['ab.', 'ab', 'exact', true],
  ['Alle ab.', 'ab', 'exact', true],
  ['Dämpfung ab!', 'ab', 'exact', true],
  ['(ab)', 'ab', 'exact', true],
  ['ab-nehmen', 'ab', 'exact', true],
  ['abnehmen', 'ab', 'exact', false],
  ['abdämpfen', 'ab', 'exact', false],
  ['Labial', 'ab', 'exact', false],
  ['Alle ab.', 'ab', 'partial', true],
  ['abnehmen', 'ab', 'partial', true],
  ['Labial', 'ab', 'partial', true],
  ['Dämpfer ab', 'daempfer', 'exact', true],
  ['Dämpfer ab', 'dämpfer', 'exact', true],
  ['große Kraft', 'grosse', 'exact', true]
];

cases.forEach(([value, query, mode, expected]) => {
  assert.strictEqual(
    serverContext.matchesTermQuery(value, query, mode),
    expected,
    `${mode}: ${JSON.stringify(query)} against ${JSON.stringify(value)}`
  );
});

const commonScripts = read('src/common_scripts.html');
const clientContext = { window: {} };
vm.createContext(clientContext);
const clientAssignmentStart = commonScripts.indexOf('window.matchesTermQuery = function');
assert.notStrictEqual(clientAssignmentStart, -1, 'client matchesTermQuery should exist');
const clientFunctionStart = commonScripts.indexOf('function', clientAssignmentStart);
const clientFunctionSource = extractFunctionExpression(commonScripts, clientFunctionStart);
vm.runInContext([
  extractFunction(commonScripts, 'isTermWordCharacter'),
  `window.matchesTermQuery = ${clientFunctionSource};`
].join('\n'), clientContext);

cases.forEach(([value, query, mode, expected]) => {
  const normalizedValue = serverContext.normalizeString(value);
  const normalizedQuery = serverContext.normalizeString(query);
  assert.strictEqual(
    clientContext.window.matchesTermQuery(normalizedValue, normalizedQuery, mode),
    expected,
    `client ${mode}: ${JSON.stringify(query)} against ${JSON.stringify(value)}`
  );
});

const publicAppSource = read('mahler-search-app/js/app.js');
const publicAppContext = {};
vm.createContext(publicAppContext);
vm.runInContext([
  extractFunction(publicAppSource, 'normalizeString'),
  extractFunction(publicAppSource, 'isTermWordCharacter'),
  extractFunction(publicAppSource, 'matchesTermQuery')
].join('\n'), publicAppContext);

cases.forEach(([value, query, mode, expected]) => {
  assert.strictEqual(
    publicAppContext.matchesTermQuery(value, query, mode),
    expected,
    `public app ${mode}: ${JSON.stringify(query)} against ${JSON.stringify(value)}`
  );
});

[
  ['src/rw_terms_search.html', 'searchRWTerms'],
  ['src/terms_search.html', 'searchByTerm'],
  ['src/rs_terms_search.html', 'searchRSTerms']
].forEach(([relativePath, serverFunction]) => {
  const page = read(relativePath);
  assert.match(page, /name="termMatchMode" value="partial" checked/);
  assert.match(page, /name="termMatchMode" value="exact"/);
  assert.match(page, /window\.matchesTermQuery\(entry\.normalized, normalizedInput, matchMode\)/);
  assert.ok(page.includes(`.${serverFunction}(query, matchMode)`));
  const inlineScripts = Array.from(page.matchAll(/<script>([\s\S]*?)<\/script>/g), match => match[1]);
  assert.strictEqual(inlineScripts.length, 1, `${relativePath} should have one executable inline script`);
  const parseableScript = inlineScripts[0].replace(/<\?=[\s\S]*?\?>/g, '');
  assert.doesNotThrow(() => new vm.Script(parseableScript), `${relativePath} inline script should parse`);
});

[
  ['mahler-search-app/rw_terms_search.html', 'searchRWTermsLocal'],
  ['mahler-search-app/terms_search.html', 'searchMahlerTermsLocal'],
  ['mahler-search-app/rs_terms_search.html', 'searchRSTermsLocal']
].forEach(([relativePath, localFunction]) => {
  const page = read(relativePath);
  assert.match(page, /name="termMatchMode" value="partial" checked/);
  assert.match(page, /name="termMatchMode" value="exact"/);
  assert.match(page, /window\.matchesTermQuery\(entry\.normalized, normalizedInput, matchMode\)/);
  assert.ok(page.includes(`${localFunction}(query, resultMeta, matchMode)`));
  assert.ok(page.includes('js/app.js?v=16'));
});

const syncSource = read('sync-data.ps1');
const generatedOutputBlock = syncSource.slice(
  syncSource.indexOf('$generatedOutputPaths = @('),
  syncSource.indexOf('$syncAllowedExactPaths = @(')
);
['terms_search.html', 'rw_terms_search.html', 'rs_terms_search.html', 'js/app.js', 'css/common.css'].forEach(file => {
  assert.ok(!generatedOutputBlock.includes(file), `${file} must not be reset as generated output by sync-data.ps1`);
});
assert.ok(syncSource.includes('"mahler-search-app/"'), 'sync-data.ps1 should commit the public page source files');

console.log('Term search match-mode tests passed.');
