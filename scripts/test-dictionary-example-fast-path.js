const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repositoryRoot = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
const context = vm.createContext({ console });

vm.runInContext(read('src/dictionary_example_shards.js'), context, {
  filename: 'src/dictionary_example_shards.js'
});
vm.runInContext(read('src/generate_dic_html.js'), context, {
  filename: 'src/generate_dic_html.js'
});

const dataDirectory = path.join(repositoryRoot, 'mahler-search-app', 'data');
const dictionaryData = JSON.parse(fs.readFileSync(path.join(dataDirectory, 'dic_notes.json'), 'utf8'));
const composerData = {
  mahler: JSON.parse(fs.readFileSync(path.join(dataDirectory, 'mahler.json'), 'utf8')),
  wagner: JSON.parse(fs.readFileSync(path.join(dataDirectory, 'richard_wagner.json'), 'utf8')),
  strauss: JSON.parse(fs.readFileSync(path.join(dataDirectory, 'richard_strauss.json'), 'utf8'))
};
const built = context.buildDictionaryExampleShardFiles(dictionaryData, composerData);

assert.strictEqual(Object.keys(built.files).length, 48);
assert.deepStrictEqual(
  Object.keys(built.queryIndex).sort(),
  ['gm', 'rs', 'rw']
);

const fullDictionaryHtml = context.generateDicHtml(dictionaryData, [], built.queryIndex);
const generatedExampleLinks = Array.from(
  fullDictionaryHtml.matchAll(/href="([^"]+source=dictionary_example[^"]*)"/g),
  match => match[1]
);
assert.ok(generatedExampleLinks.length > 0);
assert.strictEqual(
  generatedExampleLinks.filter(href => !href.includes('example_shards=')).length,
  0,
  '検索結果がない実例リンクを生成しないこと'
);

const composerSpecs = {
  gm: { rows: composerData.mahler, requirePage: false },
  rw: { rows: composerData.wagner, requirePage: true },
  rs: { rows: composerData.strauss, requirePage: true }
};

Object.entries(composerSpecs).forEach(([composer, spec]) => {
  Object.entries(built.queryIndex[composer]).forEach(([query, shardIds]) => {
    const selectedRows = shardIds
      .flatMap(shardId => {
        const suffix = String(shardId).padStart(2, '0');
        return built.files[`mahler-search-app/data/dictionary-examples/${composer}-${suffix}.json`];
      })
      .sort((a, b) => a.__exampleOrder - b.__exampleOrder)
      .filter(row => context.normalizeDictionaryExampleTerm(row.de_normalized || row.de).includes(query))
      .map(row => {
        const copy = { ...row };
        delete copy.__exampleOrder;
        return copy;
      });
    const expectedRows = spec.rows.filter(row => {
      const pageExists = row.page !== null && row.page !== undefined && String(row.page).trim() !== '';
      return (!spec.requirePage || pageExists) &&
        context.normalizeDictionaryExampleTerm(row.de_normalized || row.de).includes(query);
    });
    assert.strictEqual(
      JSON.stringify(selectedRows),
      JSON.stringify(expectedRows),
      `${composer}:${query}`
    );
  });
});

const sampleDictionary = [['zusammen', '一緒に', '[GM], [RW: Oper], [RS: Oper]']];
const sampleBuilt = context.buildDictionaryExampleShardFiles(sampleDictionary, composerData);
const html = context.generateDicHtml(sampleDictionary, [], sampleBuilt.queryIndex);
assert.match(html, /terms_search\.html\?q=zusammen&source=dictionary_example&example_shards=/);
assert.match(html, /rw_terms_search\.html\?q=zusammen&source=dictionary_example&example_shards=/);
assert.match(html, /rs_terms_search\.html\?q=zusammen&source=dictionary_example&example_shards=/);
assert.ok(html.includes("prefetchDictionaryExamples(row)"));
assert.ok(html.includes("data/dictionary-examples/"));

const appSource = read('mahler-search-app/js/app.js');
const syncSource = read('sync-data.ps1');
assert.ok(appSource.includes('window.loadDictionaryExampleData'));
assert.ok(appSource.includes('window.hydrateDictionaryExampleData'));
assert.ok(appSource.includes("Promise.all(shardRequests)"));
assert.ok(syncSource.includes('$dictionaryExampleFiles.Count -ne 48'));
assert.ok(syncSource.includes('$composerFiles.Count -ne 16'));
assert.ok(syncSource.includes('function Get-GitHubCredentialToken'));
assert.ok(syncSource.includes('githubToken = $githubCredentialToken'));
assert.ok(syncSource.includes('Invoke-RestMethod -Method Post'));
assert.ok(read('src/web_trigger.js').includes("exportAllDataToJson({ githubToken: params.githubToken || '' })"));
assert.ok(read('src/export_json.js').includes('pushToGitHub(files, commitMessage, exportOptions.githubToken)'));

['terms_search.html', 'rw_terms_search.html', 'rs_terms_search.html'].forEach(fileName => {
  const source = read(`mahler-search-app/${fileName}`);
  assert.ok(source.includes('await loadDictionaryExampleData('), fileName);
  assert.ok(source.includes('hydrateDictionaryExampleData('), fileName);
  assert.ok(source.includes('js/app.js?v=15'), fileName);
});

console.log('dictionary example fast path tests: OK');
