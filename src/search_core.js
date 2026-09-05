// Shared by GAS and the public browser bundle. Edit this file only.

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
