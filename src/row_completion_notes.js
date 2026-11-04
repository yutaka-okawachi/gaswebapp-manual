/** Notes-only evidence gathering. Never fetch arbitrary URLs or modify source rows. */
function rowCompletionNewNotes_(row) {
  const v = row.snapshot.values;
  return row.tab === 'Notes' && !v.ja && !v.en && maintenanceStyleProfile_('Notes', v) === 'dictionary';
}
function rowCompletionNotesFormatHeadings_(row, field, text, plain) {
  const support = row.notesSupport;
  if (!['ja', 'en'].includes(field) || !rowCompletionNewNotes_(row) || !support ||
      support.kind !== 'new_dictionary_proposal' || !Array.isArray(support.examples) || !Array.isArray(support.usageIds)) return text;
  const labels = { '[GM]': 'GM', '[RW: Oper]': 'RW: Oper', '[RS: Oper]': 'RS: Oper' };
  const sources = rowCompletionProtected_(row.snapshot.values.source);
  const permitted = Object.keys(labels).filter(function (marker) {
    const tab = labels[marker].slice(0, 2);
    return sources.includes(marker) && !String(row.snapshot.values.de).includes(marker) && support.examples.some(function (example) {
      return example && example.tab === tab && new RegExp('^' + tab + ':[1-9][0-9]*$').test(example.id) && support.usageIds.includes(example.id);
    });
  });
  const section = field === 'ja' ? '【音楽用語としての訳例】' : '【Musical translation examples】';
  let musical = false, fence = null;
  const seen = new Set();
  return text.split('\n').map(function (line) {
    const heading = line.trim(), delimiter = heading.match(/^(`{3,}|~{3,})/);
    if (delimiter) {
      if (!fence) fence = delimiter[1];
      else if (delimiter[1][0] === fence[0] && delimiter[1].length >= fence.length && heading === delimiter[1]) fence = null;
      return line;
    }
    if (fence) return line;
    if (/^【[^】]+】$/.test(heading)) musical = heading === section;
    const marker = permitted.find(function (item) { return heading === item || heading === labels[item]; });
    if (!musical || !marker || seen.has(marker)) return line;
    // A verified source group heading is formatting, not an invented reference.
    // Validation uses a plain comparison copy; the approved text itself is preserved.
    seen.add(marker);
    return line.replace(heading, plain === true ? labels[marker] : marker);
  }).join('\n');
}
function rowCompletionNotesMatch_(headword) {
  const word = String(headword).normalize('NFKC').trim().toLowerCase();
  if (!/^[a-zäöüß][a-zäöüß -]{1,79}$/.test(word)) return null;
  // Exact word/phrase and simple noun plurals, including hyphenated string names.
  // No fuzzy match: Saite must never select Seite.
  const forms = [word, word + 'n', word + 'en', word + 's', word + 'es'];
  const escaped = forms.map(function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
  return new RegExp('(^|[^a-zäöüß])(?:' + escaped.join('|') + ')(?=$|[^a-zäöüß])', 'i');
}
function rowCompletionNotesUsages_(book, values) {
  const match = rowCompletionNotesMatch_(values.de), examples = [], scanned = [];
  if (!match) return { examples: examples, scanned: scanned };
  ['GM', 'RW', 'RS'].forEach(function (tab) {
    const permitted = tab === 'GM' ? /\[GM\]/.test(values.source) : new RegExp('\\[' + tab + ':\\s*Oper\\]').test(values.source);
    const sheet = permitted && book.getSheetByName(tab);
    if (!sheet) return;
    const fields = ROW_COMPLETION_FIELDS[tab], count = Math.min(6000, Math.max(0, sheet.getLastRow() - 1));
    const result = namedSheetRead_(sheet, fields, 2, count).values, seen = new Set(), candidates = [];
    result.forEach(function (cells, index) {
      const v = {}; fields.forEach(function (field, i) { v[field] = String(cells[i] === undefined ? '' : cells[i]); });
      if (!match.test(v.de) || !v.ja.trim() || !v.en.trim() || seen.has(v.de)) return;
      if (v.de.length + v.ja.length + v.en.length > 1500 || /https?:|\S+@\S+|\[\[score:|<\/?[a-z]/i.test(v.de + v.ja + v.en)) return;
      const location = tab === 'GM' ? v.data.split('&').filter(Boolean).slice(0, 2).join('&') :
        [v.Oper, v.Aufzug, v.Szene, v.page, v.whom].filter(Boolean).join(' / ');
      if (!location || location.length > 240) return;
      seen.add(v.de);
      candidates.push({ id: tab + ':' + (index + 2), tab: tab, de: v.de, ja: v.ja, en: v.en, location: location,
        purpose: 'adopted_usage_for_this_headword', original_document_fetched: false });
    });
    // One short direction plus one richer usage, rather than several A/B/G string duplicates.
    candidates.sort(function (a, b) { return a.de.length - b.de.length; });
    const selected = candidates.length ? [candidates[0]] : [];
    if (candidates.length > 1) selected.push(candidates[candidates.length - 1]);
    selected.forEach(function (example) { examples.push(example); });
    scanned.push({ tab: tab, rows: count, truncated: sheet.getLastRow() - 1 > count, matching_adopted_rows: candidates.length });
  });
  // Bound both prompt and private record size. Preserve complete examples; never truncate a quote.
  while (JSON.stringify(examples).length > 6500) examples.pop();
  return { examples: examples, scanned: scanned };
}
function rowCompletionNotesSupportSchema_(context) {
  const ids = context.domain.usage_examples.map(function (example) { return example.id; });
  return { type: 'object', additionalProperties: false, required: ['english', 'italian', 'rationale', 'usage_ids'], properties: {
    english: { type: 'string' }, italian: { type: 'string' }, rationale: { type: 'string' },
    usage_ids: { type: 'array', items: ids.length ? { type: 'string', enum: ids } : { type: 'string' } }
  } };
}
function rowCompletionNotesList_(value) {
  if (typeof value !== 'string' || value.length > 200 || /[\r\n\[\]{}<>:／]|https?:|[\u0000-\u001f]/.test(value) ||
      maintenanceStyleForeignList_(value) !== value || value.split(', ').some(function (term) { return term.length > 70; })) {
    throw rowCompletionError_('対応語案の形式・長さを確認してください．');
  }
  return value;
}
function rowCompletionNotesSupport_(value, context) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(['english', 'italian', 'rationale', 'usage_ids'].sort()) ||
      typeof value.rationale !== 'string' || !value.rationale.trim() || value.rationale.length > 800 ||
      /https?:|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.rationale) ||
      !Array.isArray(value.usage_ids) || value.usage_ids.length > 6 || new Set(value.usage_ids).size !== value.usage_ids.length ||
      value.usage_ids.some(function (id) { return !context.domain.usage_examples.some(function (example) { return example.id === id; }); })) {
    throw rowCompletionError_('Notesの根拠説明・実例参照を確認できません．');
  }
  return { english: rowCompletionNotesList_(value.english), italian: rowCompletionNotesList_(value.italian),
    rationale: value.rationale, usageIds: value.usage_ids, examples: context.domain.usage_examples,
    kind: 'new_dictionary_proposal', humanReviewed: false };
}
function rowCompletionNotesKnown_(row) {
  if (rowCompletionNewNotes_(row) && row.notesSupport && row.notesSupport.kind === 'new_dictionary_proposal') {
    return { english: row.notesSupport.english, italian: row.notesSupport.italian };
  }
  return maintenanceStyleKnown_(row.snapshot.values.ja, row.snapshot.values.en);
}
function rowCompletionReviewNotes_(row, fields) {
  // Corrections to newly proposed equivalents are allowed only at the explicit human Apply step.
  // An existing body/annotation/catalogue never acquires this exception.
  if (!rowCompletionNewNotes_(row) || !row.notesSupport) return row;
  const reviewed = JSON.parse(JSON.stringify(row)), terms = maintenanceStyleEquivalents_(fields.ja || '');
  reviewed.notesSupport.english = rowCompletionNotesList_(terms.english);
  reviewed.notesSupport.italian = rowCompletionNotesList_(terms.italian);
  reviewed.notesSupport.humanReviewed = true;
  return reviewed;
}
