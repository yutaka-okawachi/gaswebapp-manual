// Shared by the public browser bundle and its local tests. Edit this file only.

// A real zero is a page value; null, missing, empty and whitespace-only cells are not.
function hasScorePage(row) {
  return row.page !== null && row.page !== undefined && String(row.page).trim() !== '';
}

function normalizeString(str) {
  if (typeof str !== 'string') return '';
  return (typeof scoreExampleSearchText==='function'?scoreExampleSearchText(str):str)
    .replace(/\[\[score:[a-z][a-z0-9-]{0,95}\]\]/gi, '')
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

// Search-only forms: canonical de/de_normalized and dictionary IDs remain untouched.
// Text inputs remove CR/LF on assignment. Keep both whitespace and legacy joined forms
// so an older datalist value still matches the original multiline source.
function normalizeTermSearchText(value) {
  return normalizeString(String(value ?? '')).replace(/\s+/gu, ' ').trim();
}
function termSearchTextVariants(value) {
  const original = normalizeString(String(value ?? ''));
  const spaced = normalizeTermSearchText(original);
  const joined = normalizeTermSearchText(original.replace(/[ \t]*[\r\n\u2028\u2029]+[ \t]*/g, ''));
  return spaced === joined ? [spaced] : [spaced, joined];
}
function matchesTermQuery(value, query, matchMode) {
  for (const normalizedValue of termSearchTextVariants(value)) {
    for (const normalizedQuery of termSearchTextVariants(query)) {
      if (!normalizedQuery) continue;
      if (matchMode !== 'exact') {
        if (normalizedValue.includes(normalizedQuery)) return true;
        continue;
      }
      let searchFrom = 0;
      while (searchFrom <= normalizedValue.length - normalizedQuery.length) {
        const matchIndex = normalizedValue.indexOf(normalizedQuery, searchFrom);
        if (matchIndex === -1) break;
        const before = matchIndex > 0 ? normalizedValue.charAt(matchIndex - 1) : '';
        const afterIndex = matchIndex + normalizedQuery.length;
        const after = afterIndex < normalizedValue.length ? normalizedValue.charAt(afterIndex) : '';
        if (!isTermWordCharacter(before) && !isTermWordCharacter(after)) return true;
        searchFrom = matchIndex + 1;
      }
    }
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
    normalizeTermSearchText(query) === normalizeTermSearchText(params.get('q'));
}

function buildTermResolutionNotice(query, termsIndex, resultCount, isDictionaryExample = false) {
  if (!isDictionaryExample) return '';
  const resolution = getDictionaryTermResolution(query, termsIndex);
  if (!resolution) return '';
  const escapedQuery = escapeTermResolutionHtml(resolution.query);
  const escapedCanonical = escapeTermResolutionHtml(resolution.canonical);
  if (resolution.category === 'TYPO') {
    if (Number(resultCount) !== 0) return '';
    return `<p class="term-resolution-notice term-resolution-suggestion">${typeof window !== 'undefined' && window.__SITE_LANGUAGE__ === 'en' ? 'Did you mean: ' : 'もしかして：'}<a href="?q=${encodeURIComponent(resolution.canonical)}">${escapedCanonical}</a></p>`;
  }
  if (typeof window !== 'undefined' && window.__SITE_LANGUAGE__ === 'en') {
    const relation = resolution.category === 'INFLECTION' ? 'an inflected form' : resolution.category === 'ORTHOGRAPHIC_VARIANT' ? 'an alternative spelling' : 'a related form';
    return `<p class="term-resolution-notice">“${escapedQuery}” is ${relation} of “${escapedCanonical}”. Examples are matched against the headword and its registered forms and alternative spellings.</p>`;
  }
  const relation = resolution.category === 'INFLECTION'
    ? '語形'
    : resolution.category === 'ORTHOGRAPHIC_VARIANT' ? '別綴り' : '関連語形';
  return `<p class="term-resolution-notice">「${escapedQuery}」は見出し「${escapedCanonical}」の${relation}．検索対象は見出しと登録済みの語形・別綴りに一致する実例．</p>`;
}

function dictionaryExampleVariantCategory(type) {
  const rawType = String(type || '').trim();
  const upperType = rawType.toUpperCase();
  if (
    /格変化形|複数形|単数形|単数主格|基本形|弱変化形|過去形|過去分詞|現在分詞|活用形|比較級|最上級|不定詞|命令形|語形/.test(rawType) ||
    upperType === 'INFLECTION'
  ) return 'INFLECTION';
  if (
    /旧綴り|現代綴り|別綴り|表記ゆれ|表記揺れ|異綴り/.test(rawType) ||
    upperType === 'ORTHOGRAPHIC_VARIANT'
  ) return 'ORTHOGRAPHIC_VARIANT';
  return 'RELATED';
}

function buildDictionaryExampleAliasNotice(query, termsIndex) {
  const originalQuery = String(query || '').trim();
  const queryKey = dictionaryTermIndexKey(originalQuery);
  const entry = queryKey && termsIndex ? termsIndex[queryKey] : null;
  const targetId = dictionaryTermEntryId(entry);
  if (!originalQuery || !targetId) return '';

  let canonicalEntry = entry;
  let canonical = entry && typeof entry === 'object' && entry.canonical
    ? String(entry.canonical) : originalQuery;
  Object.keys(termsIndex).some(key => {
    const candidate = termsIndex[key];
    if (dictionaryTermEntryId(candidate) !== targetId || !candidate || typeof candidate !== 'object' ||
        !Array.isArray(candidate.exampleVariantDetails)) return false;
    canonicalEntry = candidate;
    if (candidate.canonical) canonical = String(candidate.canonical);
    return true;
  });

  const details = canonicalEntry && Array.isArray(canonicalEntry.exampleVariantDetails)
    ? canonicalEntry.exampleVariantDetails : [];
  const seen = new Set([normalizeString(originalQuery)]);
  const variants = details.filter(item => {
    const normalized = normalizeString(item && item.form);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
  if (!variants.length) return '';

  const categories = new Set(variants.map(item => dictionaryExampleVariantCategory(item.type)));
  const relation = categories.size === 1 && categories.has('INFLECTION')
    ? '語形変化'
    : categories.size === 1 && categories.has('ORTHOGRAPHIC_VARIANT')
      ? '別綴り'
      : '関連語形・別綴り';
  // 呼び出し側は textContent に設定するため、ここではHTMLエスケープしない。
  const forms = variants.map(item => `「${String(item.form || '')}」`).join('，');
  if (typeof window !== 'undefined' && window.__SITE_LANGUAGE__ === 'en') {
    const singular = variants.length === 1;
    const relationEnglish = categories.size === 1 && categories.has('INFLECTION') ? (singular ? 'an inflected form' : 'inflected forms') : categories.size === 1 && categories.has('ORTHOGRAPHIC_VARIANT') ? (singular ? 'an alternative spelling' : 'alternative spellings') : (singular ? 'a related form or alternative spelling' : 'related forms or alternative spellings');
    const formsEnglish = variants.map(item => '“' + String(item.form || '') + '”').join(', ');
    return `${formsEnglish} ${variants.length === 1 ? 'is' : 'are'} also included in this search as ${relationEnglish} registered under the headword “${canonical}”.`;
  }
  return `${forms}も，見出し「${canonical}」に登録された${relation}として検索対象としている．`;
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
  window.normalizeTermSearchText = normalizeTermSearchText;
  window.getDictionaryTermResolution = getDictionaryTermResolution;
  window.buildTermResolutionNotice = buildTermResolutionNotice;
  window.buildDictionaryExampleAliasNotice = buildDictionaryExampleAliasNotice;
  window.isDictionaryExampleSearch = isDictionaryExampleSearch;
  window.getDictionaryExampleSearchQueries = getDictionaryExampleSearchQueries;
  window.matchesAnyTermQuery = matchesAnyTermQuery;
}
