const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const calls = [];
let fail = false;
const context = vm.createContext({
    window: { appData: {} }, console: { warn() {} }, URLSearchParams,
    fetch: async url => {
        calls.push(url);
        if (fail) throw new Error('offline');
        return { ok: true, json: async () => url.includes('dic_terms_index') ? {} : [] };
    }
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../frontend/data-loader.js'), 'utf8'), context);
(async () => {
    await Promise.all([context.loadData('rw_terms_search'), context.loadData('rw_terms_search')]);
    assert.strictEqual(calls.length, 2, 'Concurrent loads share the same requests');
    await context.loadData('rw_terms_search');
    assert.strictEqual(calls.length, 2, 'Loaded data is reused');
    fail = true;
    await assert.rejects(context.loadData('terms_search'));
    fail = false;
    await context.loadData('terms_search');
    assert.ok(context.window.appData.mahler, 'Failed requests can be retried');
    for (const search of ['', '&example_shards=', '&example_shards=,', '&example_shards=2,', '&example_shards=16', '&example_shards=+']) {
        context.window.location = { search: '?q=vorne&source=dictionary_example' + search };
        const before = calls.length;
        assert.strictEqual(await context.window.loadDictionaryExampleData('rw_terms_search', 'vorne'), false);
        assert.strictEqual(calls.length, before, 'Legacy or invalid links trigger the ordinary full-data path without reading any shard');
    }
    context.window.location = { search: '?q=vorne&source=dictionary_example&example_shards=0,15,0' };
    const start = calls.length;
    assert.strictEqual(await context.window.loadDictionaryExampleData('rw_terms_search', 'vorne'), true);
    assert.deepStrictEqual(calls.slice(start), ['data/dictionary-examples/rw-00.json', 'data/dictionary-examples/rw-15.json']);
    console.log('parallel data loading, retry, and legacy example link tests: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
