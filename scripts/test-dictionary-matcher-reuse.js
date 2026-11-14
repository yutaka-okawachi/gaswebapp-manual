'use strict';
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const source = fs.readFileSync('src/generate_dic_html.js', 'utf8');
const c = vm.createContext({});
vm.runInContext(source, c);
const index = { lang: 'term-lang', breit: 'term-breit', 'z-b': {id:'term-z-b', original:'z.B.'} };
const matchers = c.prepareTermMatchers(index);
for (const text of ['lang lang; breit', 'langsam und breit', 'z.B. lang', '<script>lang</script>', '', 'LANG']) {
  const fresh = c.linkTermsInTranslation(text, index);
  assert.equal(c.linkTermsInTranslation(text, index, matchers), fresh);
  assert.equal(c.linkTermsInTranslation(text, index, matchers), fresh, 'global regex state must reset');
}
const row = ['lang', 'lang breit', '[GM]'];
const a = c.generateDicHtml([row], [], null, [], {language:'ja'});
const b = c.generateDicHtml([row, ['breit','breit','[GM]']], [], null, [], {language:'ja'});
assert(!a.includes('href="#term-breit" class="term-link"'));
assert(b.includes('href="#term-breit" class="term-link"'));
assert.equal(c.generateDicHtml([row], [], null, [], {language:'ja'}), a, 'no cross-build stale matcher cache');
assert.equal(c.linkTermsInTranslation('lang', {lang:'new-id'}), '<a href="#new-id" class="term-link">lang</a>');
console.log('Dictionary matcher reuse: reset, repeated calls, fallback API, cross-build isolation and updated index passed.');
