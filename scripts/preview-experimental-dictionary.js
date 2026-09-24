const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { root } = require('./sync/core');
const { startPreview } = require('./preview-site');

const DEFAULT_SOURCE = path.join(root, 'tmp', 'experimental-dictionary-source.json');

function readSource(sourcePath) {
  const payload = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const dictionaryData = Array.isArray(payload.dictionaryData) ? payload.dictionaryData : [];
  const mappingData = Array.isArray(payload.mappingData) ? payload.mappingData : [];
  if (dictionaryData.length === 0) throw new Error('Notes_正規化テストのデータがありません．');
  if (mappingData.length === 0) throw new Error('辞書語形・検索対応_実験のデータがありません．');
  return { dictionaryData, mappingData };
}

function summarize(mappingData) {
  const pairs = new Set();
  const headings = new Set();
  let termTargets = 0;
  let termExcluded = 0;
  let exampleTargets = 0;

  mappingData.forEach(row => {
    const heading = String(row && row[0] || '').trim();
    const related = String(row && row[1] || '').trim();
    if (heading) headings.add(heading);
    if (heading && related) pairs.add(`${heading}\u0000${related}`);
    if (String(row && row[3] || '').trim() === '対象') termTargets += 1;
    if (String(row && row[3] || '').trim() === '対象外') termExcluded += 1;
    if (String(row && row[4] || '').trim() === '対象') exampleTargets += 1;
  });

  return {
    mappings: mappingData.length,
    headings: headings.size,
    termTargets,
    termExcluded,
    exampleTargets,
    duplicatePairs: mappingData.length - pairs.size
  };
}

function validateIndependentHeadings(dictionaryData, mappingData) {
  const context = vm.createContext({ console });
  vm.runInContext(
    fs.readFileSync(path.join(root, 'src', 'generate_dic_html.js'), 'utf8'),
    context
  );
  const index = context.generateDicTermsIndex(dictionaryData, mappingData);
  const failures = [];
  mappingData.filter(row => String(row && row[3] || '').trim() === '対象外').forEach(row => {
    const heading = String(row[0] || '').trim();
    const related = String(row[1] || '').trim();
    const relatedKey = context.normalizeForId(related);
    const expectedId = `term-${relatedKey}`;
    const entry = index[relatedKey];
    const actualId = typeof entry === 'string' ? entry : entry && entry.id;
    if (actualId !== expectedId) failures.push(`${related} → ${actualId || '未登録'}（期待値：${expectedId}）`);

    const headingEntry = index[context.normalizeForId(heading)];
    const variants = headingEntry && typeof headingEntry === 'object' && Array.isArray(headingEntry.exampleVariants)
      ? headingEntry.exampleVariants
      : [];
    if (!variants.some(value => context.normalizeForId(value) === relatedKey)) {
      failures.push(`${heading} の実例検索対象に ${related} が含まれていません．`);
    }
  });
  if (failures.length > 0) throw new Error(`独立見出しの検証に失敗しました：\n${failures.join('\n')}`);
}

async function main() {
  const sourceArgument = process.argv.find(argument => argument.startsWith('--source='));
  const sourcePath = sourceArgument
    ? path.resolve(root, sourceArgument.slice('--source='.length))
    : DEFAULT_SOURCE;
  const { dictionaryData, mappingData } = readSource(sourcePath);
  const summary = summarize(mappingData);
  validateIndependentHeadings(dictionaryData, mappingData);

  console.log('実験辞書データ検証：');
  console.log(`  Notes_正規化テスト：${dictionaryData.length}行`);
  console.log(`  語形対応：${summary.mappings}件`);
  console.log(`  見出し：${summary.headings}件`);
  console.log(`  用語検索対象：${summary.termTargets}件`);
  console.log(`  用語検索対象外：${summary.termExcluded}件`);
  console.log(`  実例検索対象：${summary.exampleTargets}件`);
  console.log(`  見出しと関連語形の組合せ重複：${summary.duplicatePairs}件`);

  const preview = await startPreview({ dictionaryData, mappingData });
  const dictionaryUrl = new URL('mahler-search-app/dic.html', preview.url).href;
  console.log(`実験用語集：${dictionaryUrl}`);
  console.log('Ctrl+C で終了します．');

  const close = async () => {
    await preview.close();
    process.exit(0);
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { readSource, summarize, validateIndependentHeadings };
