/**
 * 「実例を見る」用の検索データを分割して生成する純粋関数群。
 * 通常検索用の全量JSONは残し、辞書からの初回表示だけ小さい分割JSONを使う。
 */

const DICTIONARY_EXAMPLE_SHARD_COUNT = 16;

function normalizeDictionaryExampleTerm(value) {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .trim();
}

function getDictionaryExampleShardNumber(value) {
  const normalized = normalizeDictionaryExampleTerm(value);
  let hash = 2166136261;

  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) % DICTIONARY_EXAMPLE_SHARD_COUNT;
}

function matchesDictionaryExampleQuery(value, query, matchMode) {
  const normalizedValue = normalizeDictionaryExampleTerm(value);
  const normalizedQuery = normalizeDictionaryExampleTerm(query);
  if (!normalizedQuery) return false;
  if (matchMode !== 'exact') return normalizedValue.includes(normalizedQuery);

  let searchFrom = 0;
  while (searchFrom <= normalizedValue.length - normalizedQuery.length) {
    const matchIndex = normalizedValue.indexOf(normalizedQuery, searchFrom);
    if (matchIndex === -1) return false;
    const before = matchIndex > 0 ? normalizedValue.charAt(matchIndex - 1) : '';
    const afterIndex = matchIndex + normalizedQuery.length;
    const after = afterIndex < normalizedValue.length ? normalizedValue.charAt(afterIndex) : '';
    if (!/[a-z0-9]/i.test(before) && !/[a-z0-9]/i.test(after)) return true;
    searchFrom = matchIndex + 1;
  }
  return false;
}

function buildDictionaryExampleComposerShards(rows, queries, options) {
  const settings = options || {};
  const requirePage = Boolean(settings.requirePage);
  const shards = Array.from({ length: DICTIONARY_EXAMPLE_SHARD_COUNT }, () => []);
  const normalizedTermsByShard = Array.from(
    { length: DICTIONARY_EXAMPLE_SHARD_COUNT },
    () => new Set()
  );

  (rows || []).forEach((row, rowIndex) => {
    if (requirePage) {
      const page = row && row.page;
      if (page === null || page === undefined || String(page).trim() === '') return;
    }

    const normalizedTerm = normalizeDictionaryExampleTerm(
      row && (row.de_normalized || row.de)
    );
    if (!normalizedTerm) return;

    const shardNumber = getDictionaryExampleShardNumber(normalizedTerm);
    shards[shardNumber].push(Object.assign({ __exampleOrder: rowIndex }, row));
    normalizedTermsByShard[shardNumber].add(normalizedTerm);
  });

  const normalizedQuerySpecs = new Map();
  (queries || []).forEach(querySpec => {
    const query = querySpec && typeof querySpec === 'object' ? querySpec.query : querySpec;
    const variants = querySpec && typeof querySpec === 'object' ? querySpec.variants : [query];
    const normalizedQuery = normalizeDictionaryExampleTerm(query);
    if (!normalizedQuery) return;
    if (!normalizedQuerySpecs.has(normalizedQuery)) {
      normalizedQuerySpecs.set(normalizedQuery, {
        variants: new Set(),
        matchMode: querySpec && typeof querySpec === 'object' ? querySpec.matchMode : 'partial'
      });
    }
    (variants || []).map(normalizeDictionaryExampleTerm).filter(Boolean)
      .forEach(variant => normalizedQuerySpecs.get(normalizedQuery).variants.add(variant));
  });

  const queryIndex = {};
  normalizedQuerySpecs.forEach((querySpec, query) => {
      const shardNumbers = [];
      normalizedTermsByShard.forEach((terms, shardNumber) => {
        if (Array.from(terms).some(term => Array.from(querySpec.variants)
          .some(variant => matchesDictionaryExampleQuery(term, variant, querySpec.matchMode)))) {
          shardNumbers.push(shardNumber);
        }
      });
      queryIndex[query] = shardNumbers;
  });

  return { shards, queryIndex };
}

function buildDictionaryExampleShardFiles(dicData, composerData, aliasData) {
  const composerSettings = {
    gm: { marker: '[GM]', rows: composerData.mahler || [], requirePage: false },
    rw: { marker: '[RW: Oper]', rows: composerData.wagner || [], requirePage: true },
    rs: { marker: '[RS: Oper]', rows: composerData.strauss || [], requirePage: true }
  };
  const files = {};
  const queryIndex = {};
  const dictionaryKeys = new Set(
    (dicData || []).map(row => normalizeDictionaryExampleTerm(row && row[0])).filter(Boolean)
  );
  const aliasesByCanonical = {};

  (aliasData || []).forEach(row => {
    const alias = row && row[0];
    const canonical = row && row[1];
    const aliasKey = normalizeDictionaryExampleTerm(alias);
    const canonicalKey = normalizeDictionaryExampleTerm(canonical);
    if (!aliasKey || !canonicalKey || !dictionaryKeys.has(canonicalKey) || dictionaryKeys.has(aliasKey)) return;
    if (!aliasesByCanonical[canonicalKey]) aliasesByCanonical[canonicalKey] = [];
    aliasesByCanonical[canonicalKey].push(alias);
  });

  Object.keys(composerSettings).forEach(composer => {
    const settings = composerSettings[composer];
    const queries = (dicData || [])
      .filter(row => String((row && row[2]) || '').includes(settings.marker))
      .map(row => {
        const query = row && row[0];
        const queryKey = normalizeDictionaryExampleTerm(query);
        const aliases = aliasesByCanonical[queryKey] || [];
        return {
          query,
          variants: [query].concat(aliases),
          matchMode: aliases.length > 0 ? 'exact' : 'partial'
        };
      });
    const built = buildDictionaryExampleComposerShards(settings.rows, queries, settings);
    queryIndex[composer] = built.queryIndex;

    built.shards.forEach((rows, shardNumber) => {
      const suffix = String(shardNumber).padStart(2, '0');
      files[`mahler-search-app/data/dictionary-examples/${composer}-${suffix}.json`] = rows;
    });
  });

  return { files, queryIndex };
}

function getDictionaryExampleShardIds(queryIndex, composer, query) {
  const normalizedQuery = normalizeDictionaryExampleTerm(query);
  const composerIndex = queryIndex && queryIndex[composer];
  const shardIds = composerIndex && composerIndex[normalizedQuery];
  return Array.isArray(shardIds) ? shardIds : [];
}
