const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const file of ['frontend/search-core.js', 'frontend/spelling-suggestions.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
}
const headings = ['gestrichen', 'mäßig', 'schön', 'schon', 'fordern', 'Quelle', 'gezogen', 'Gesellen'].map(x => [x]);
const get = (q, index = {}, data = []) => Array.from(ctx.getSpellingSuggestions(q, headings, index, data));
assert.deepStrictEqual(get('gestrihcen'), ['gestrichen']);
assert.deepStrictEqual(get('gesrtichen'), ['gestrichen']);
assert.deepStrictEqual(get('gestrichen'), []);
for (const q of ['mäßig', 'maessig', 'ma\u0308ßig', '', 'an', 'mit', '12345', '日本語', 'two words']) assert.deepStrictEqual(get(q), []);
assert.strictEqual(ctx.normalizeString('ma\u0308ßig'), 'maessig');
assert.strictEqual(ctx.normalizeString('Quelle'), 'quelle');
assert(ctx.matchesTermQuery('mäßig', 'ma\u0308ßig', 'exact'));
assert.deepStrictEqual(get('gestrihcen', { gestrihcen: 'some-approved-form' }), []);
assert.deepStrictEqual(get('gestrihcen', {}, [{ de: 'Gestrihcen', page: '' }]), []);
assert.deepStrictEqual(get('fordern'), []);
assert.deepStrictEqual(get('Gesellen'), []);
assert(!get('schon').includes('schön'));
for (const name of ['terms_search', 'rw_terms_search', 'rs_terms_search']) {
    const html = fs.readFileSync(path.join(root, 'mahler-search-app', name + '.html'), 'utf8');
    assert(html.includes('ドイツ語の特殊文字（ä・ö・ü・ß）はそのまま入力できる．以下の代替表記でも検索できる．'));
    assert(html.includes('window.showSpellingSuggestions(query, resultMeta,'));
    assert(html.includes('resultsDiv, search)'));
    const { extractFunction } = require('./test-utils/extract-function');
    const inline = {}; vm.createContext(inline);
    vm.runInContext(extractFunction(html, 'normalizeString'), inline);
    for (const value of ['ma\u0308ßig', 'mäßig', '𝅘𝅥', '𝅗𝅥', 'Quelle']) {
        assert.strictEqual(inline.normalizeString(value), ctx.normalizeString(value), name + ': ' + value);
    }
}
const source = fs.readFileSync(path.join(root, 'frontend/spelling-suggestions.js'), 'utf8');
assert(!/sendSearchNotification|trackSearchResults|sendBeacon|localStorage|sessionStorage|\.innerHTML\s*=/.test(source));
assert(source.includes('resultMeta.resultCount !== 0'));
assert(source.includes('isDictionaryExampleSearch(query)'));
assert(source.includes('root.contains(marker)'));
assert(source.includes("button.textContent = term"));
console.log('Spelling suggestion / NFC / integration guards: PASS');

(async () => {
    class Element {
        constructor() { this.children = []; this.listeners = {}; this.value = ''; }
        appendChild(x) { x.parent = this; this.children.push(x); }
        contains(x) { return this.children.includes(x); }
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
        setAttribute() {}
        addEventListener(name, f) { this.listeners[name] = f; }
        removeEventListener(name, f) { if (this.listeners[name] === f) delete this.listeners[name]; }
    }
    const input = new Element(), mode = new Element(), panel = new Element();
    let count = 0, resolveLoad;
    ctx.document = { documentElement: { lang: 'en' }, getElementById: () => input,
        querySelector: () => mode, querySelectorAll: () => [mode], createElement: () => new Element() };
    ctx.window.appData = { dic_notes: headings, dic_terms_index: {}, mahler: [] };
    ctx.isDictionaryExampleSearch = () => false;
    ctx.loadData = () => Promise.resolve();
    input.value = 'gestrihcen';
    await ctx.window.showSpellingSuggestions(input.value, { resultCount: 0 }, 'mahler', panel, () => count++);
    assert.equal(panel.children[0].children[0].textContent, 'Did you mean? ');
    panel.children[0].children[1].listeners.click();
    assert.equal(input.value, 'gestrichen'); assert.equal(count, 1);
    input.value = 'gestrihcen';
    ctx.loadData = () => new Promise(resolve => resolveLoad = resolve);
    const pending = ctx.window.showSpellingSuggestions(input.value, { resultCount: 0 }, 'mahler', panel, () => count++);
    input.value = 'other'; input.listeners.input(); resolveLoad(); await pending;
    assert.equal(panel.children.length, 0); assert.equal(count, 1);
    ctx.loadData = () => Promise.reject(Error('offline'));
    input.value = 'gestrihcen';
    await ctx.window.showSpellingSuggestions(input.value, { resultCount: 0 }, 'mahler', panel, () => count++);
    assert.equal(panel.children.length, 0);
    console.log('Spelling suggestion click, stale-input, language and load-error behavior: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });

for (const [native, alternate] of [['Dämpfer','Daempfer'],['zurückhalten','zurueckhalten'],['Flöte','Floete'],['fließend','fliessend']]) {
  for (const mode of ['exact','partial']) {
    assert(ctx.matchesTermQuery(native, alternate, mode), native + ': ' + mode);
    assert(ctx.matchesTermQuery(alternate, native, mode), alternate + ': ' + mode);
  }
}
const phrases = JSON.parse(fs.readFileSync(path.join(root, 'scripts/english-phrases.json'), 'utf8'));
assert.strictEqual(phrases['ドイツ語の特殊文字（ä・ö・ü・ß）はそのまま入力できる．以下の代替表記でも検索できる．'], 'You can enter German special characters (ä, ö, ü, ß) directly, or use the conventional equivalents below:');
console.log('PASS: bilingual input guidance and all four native / alternative spelling pairs');

assert(ctx.matchesTermQuery('Mit Dämpfer', 'Daempfer', 'exact'));
assert(!ctx.matchesTermQuery('Dämpfern', 'Daempfer', 'exact'));
assert(ctx.matchesTermQuery('Dämpfern', 'Daempfer', 'partial'));
assert(!ctx.matchesTermQuery('mäßig', 'massig', 'exact'));
console.log('PASS: whole-word exact / substring partial / non-equivalent plain vowels');
