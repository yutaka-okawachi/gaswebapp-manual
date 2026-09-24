// Shared by the public browser bundle and its local tests. Edit this file only.

function normalizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .trim();
}

function isTermWordCharacter(character) {
  return typeof character === 'string' && character !== '' && /[\p{L}\p{N}]/u.test(character);
}

function matchesTermQuery(value, query, matchMode) {
  const normalizedValue = normalizeString(String(value || ''));
  const normalizedQuery = normalizeString(String(query || ''));
  if (!normalizedQuery) return false;
  if (matchMode !== 'exact') return normalizedValue.includes(normalizedQuery);

  let searchFrom = 0;
  while (searchFrom <= normalizedValue.length - normalizedQuery.length) {
    const matchIndex = normalizedValue.indexOf(normalizedQuery, searchFrom);
    if (matchIndex === -1) return false;
    const before = matchIndex > 0 ? normalizedValue.charAt(matchIndex - 1) : '';
    const afterIndex = matchIndex + normalizedQuery.length;
    const after = afterIndex < normalizedValue.length ? normalizedValue.charAt(afterIndex) : '';
    if (!isTermWordCharacter(before) && !isTermWordCharacter(after)) return true;
    searchFrom = matchIndex + 1;
  }
  return false;
}

function dictionaryTermIndexKey(value) {
  return normalizeString(String(value || ''))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function dictionaryTermEntryId(entry) {
  return typeof entry === 'string' ? entry : entry && entry.id;
}

function getDictionaryTermResolution(query, termsIndex) {
  const originalQuery = String(query || '').trim();
  const queryKey = dictionaryTermIndexKey(originalQuery);
  const entry = queryKey && termsIndex ? termsIndex[queryKey] : null;
  if (!entry || typeof entry !== 'object' || !entry.canonical) return null;

  const rawType = String(entry.type || '').trim();
  const upperType = rawType.toUpperCase();
  let category = 'ALIAS';
  if (
    /格変化形|複数形|単数形|単数主格|基本形|弱変化形|過去形|過去分詞|現在分詞|活用形|比較級|最上級|不定詞|命令形|語形/.test(rawType) ||
    upperType === 'INFLECTION'
  ) {
    category = 'INFLECTION';
  } else if (
    /旧綴り|現代綴り|別綴り|表記ゆれ|表記揺れ|異綴り/.test(rawType) ||
    upperType === 'ORTHOGRAPHIC_VARIANT'
  ) {
    category = 'ORTHOGRAPHIC_VARIANT';
  } else if (/誤入力|誤記/.test(rawType) || upperType === 'TYPO') {
    category = 'TYPO';
  }

  return {
    query: originalQuery,
    canonical: String(entry.canonical),
    type: rawType,
    category,
    id: dictionaryTermEntryId(entry)
  };
}

function escapeTermResolutionHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function isDictionaryExampleSearch(query) {
  if (typeof window === 'undefined' || typeof document === 'undefined' ||
      typeof document.getElementById !== 'function') return false;
  const params = new URLSearchParams(window.location.search);
  const notice = document.getElementById('dictionaryExampleAliasNotice');
  return params.get('source') === 'dictionary_example' &&
    Boolean(notice && !notice.hidden) &&
    normalizeString(String(query || '')) === normalizeString(String(params.get('q') || ''));
}

function buildTermResolutionNotice(query, termsIndex, resultCount, isDictionaryExample = false) {
  if (!isDictionaryExample) return '';
  const resolution = getDictionaryTermResolution(query, termsIndex);
  if (!resolution) return '';
  const escapedQuery = escapeTermResolutionHtml(resolution.query);
  const escapedCanonical = escapeTermResolutionHtml(resolution.canonical);
  if (resolution.category === 'TYPO') {
    if (Number(resultCount) !== 0) return '';
    return `<p class="term-resolution-notice term-resolution-suggestion">もしかして：<a href="?q=${encodeURIComponent(resolution.canonical)}">${escapedCanonical}</a></p>`;
  }
  const relation = resolution.category === 'INFLECTION'
    ? '語形'
    : resolution.category === 'ORTHOGRAPHIC_VARIANT' ? '別綴り' : '関連語形';
  return `<p class="term-resolution-notice">「${escapedQuery}」は見出し「${escapedCanonical}」の${relation}．検索対象は見出しと登録済みの語形・別綴りに一致する実例．</p>`;
}

function getDictionaryExampleSearchQueries(query, termsIndex, isDictionaryExample) {
  const originalQuery = String(query || '').trim();
  if (!originalQuery || !isDictionaryExample || !termsIndex) return originalQuery ? [originalQuery] : [];
  const queryKey = dictionaryTermIndexKey(originalQuery);
  const entry = queryKey && termsIndex[queryKey];
  const targetId = dictionaryTermEntryId(entry);
  if (!queryKey || !targetId) return [originalQuery];

  const queries = [originalQuery];
  Object.keys(termsIndex).forEach(key => {
    const candidate = termsIndex[key];
    if (dictionaryTermEntryId(candidate) !== targetId || !candidate || typeof candidate !== 'object') return;
    if (candidate.original) queries.push(String(candidate.original));
    if (Array.isArray(candidate.exampleVariants)) queries.push(...candidate.exampleVariants.map(String));
  });
  const seen = new Set();
  return queries.filter(candidate => {
    const normalized = normalizeString(candidate);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function matchesAnyTermQuery(value, queries, matchMode) {
  return (queries || []).some(query => matchesTermQuery(value, query, matchMode));
}

if (typeof window !== 'undefined') {
  window.getDictionaryTermResolution = getDictionaryTermResolution;
  window.buildTermResolutionNotice = buildTermResolutionNotice;
  window.isDictionaryExampleSearch = isDictionaryExampleSearch;
  window.getDictionaryExampleSearchQueries = getDictionaryExampleSearchQueries;
  window.matchesAnyTermQuery = matchesAnyTermQuery;
}
