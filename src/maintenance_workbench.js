/** Unified maintenance. Confirm complete content before one Notes row write. */
function maintenanceNotesSource_(book, term, purpose) {
  const normalized = normalizeObservedTerm(term), preferred = String(term).trim().normalize('NFC');
  if (!/^[a-z0-9][a-z0-9 -]{1,119}$/.test(normalized)) throw rowCompletionError_('原文の語・句を確認できません．Notesは追加していません．');
  const formsToFind = [normalized, normalized + 'n', normalized + 'en', normalized + 's', normalized + 'es'];
  const boundary = '[^\\p{L}\\p{M}\\p{N}]';
  const pattern = new RegExp('(^|' + boundary + ')(?:' + formsToFind.map(function (form) { return form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')($|' + boundary + ')', 'iu');
  const proof = [], forms = [], markers = [];
  [['RS', '[RS: Oper]'], ['RW', '[RW: Oper]'], ['GM', '[GM]']].forEach(function (definition) {
    const tab = definition[0], sheet = book.getSheetByName(tab);
    if (!sheet || sheet.getLastRow() < 2) return;
    if (sheet.getLastRow() > 6001) throw rowCompletionError_('出典調査の上限を超えています．不確かな出典でNotesを追加しません．');
    const fields = tab === 'GM' ? ['de', 'data'] : ['de', 'Oper', 'Aufzug', 'Szene', 'page', 'whom'];
    const rows = namedSheetRead_(sheet, fields, 2, sheet.getLastRow() - 1).values;
    let selected = null;
    rows.forEach(function (values, index) {
      if (!pattern.test(normalizeObservedTerm(values[0]))) return;
      if (tab === 'GM') {
        if (!String(values[1] || '').trim() || /^(?:不明|未確認|未定|[?？-]+)$/.test(String(values[1]).trim())) return;
      } else if (!String(values[1] || '').trim() || !/^(?:0|[1-9][0-9]{0,5})$/.test(String(values[4]).trim())) return;
      const original = String(values[0]);
      const location = tab === 'GM' ? String(values[1] || '').split('&').filter(Boolean).slice(0, 2).join('&') :
        values.slice(1).map(String).filter(Boolean).join(' / ');
      if (!location || original.length > 6000 || location.length > 240) return;
      const tokens = Array.from(original.matchAll(/[\p{L}\p{M}]+/gu)), rowForms = [];
      for (let i = 0; i < tokens.length; i++) {
        for (let n = 1; n <= 10 && i + n <= tokens.length; n++) {
          const last = tokens[i + n - 1], candidate = original.slice(tokens[i].index, last.index + last[0].length);
          if (normalizeObservedTerm(candidate) === normalized) { rowForms.push(candidate); break; }
        }
      }
      rowForms.forEach(function (form) { forms.push(form); });
      // Inspect every eligible row: a suffix-only hit must not hide a later base form.
      // Prefer the actual requested spelling, then another case of the base form.
      const rank = rowForms.some(function (form) { return form.normalize('NFC') === preferred; }) ? 2 : rowForms.length ? 1 : 0;
      if (!selected || rank > selected.rank) selected = { values: values, index: index, original: original, location: location, rank: rank };
    });
    if (!selected || (purpose === 'alias' && selected.rank === 0)) return;
    markers.push(definition[1]);
    proof.push({ tab: tab, sheetId: sheet.getSheetId(), number: selected.index + 2, fields: fields,
      hash: rowCompletionHash_(selected.values), german: selected.original.slice(0, 1200), location: selected.location });
  });
  if (!proof.length) throw rowCompletionError_('実例と使用箇所から出典を特定できません．Notesは追加していません．');
  if (!forms.length) throw rowCompletionError_('入力した形そのものを原文で確認できません．見出しを推測せず，語形対応で確認してください．');
  const unique = Array.from(new Set(forms.map(function (form) { return form.normalize('NFC'); })));
  if (purpose !== 'alias' && new Set(unique.map(function (form) { return form.toLowerCase(); })).size > 1) throw rowCompletionError_('原綴りが複数あります．Notesは追加せず，語形対応で確認してください．');
  const headword = purpose === 'alias' ? preferred : unique.find(function (form) { return form === preferred; }) || unique[0];
  return { de: headword, source: markers.join(', '), proof: proof };
}
function maintenanceNotesVerifySource_(book, plan) {
  plan.proof.forEach(function (item) {
    const sheet = book.getSheetByName(item.tab);
    if (!sheet || sheet.getSheetId() !== item.sheetId) throw rowCompletionError_('出典の対象タブが変わりました．下書きの状態を確認してください．');
    if (rowCompletionHash_(namedSheetRead_(sheet, item.fields, item.number, 1).values[0]) === item.hash) return;
    // A sort can change the position, but never substitute different source text or context.
    if (sheet.getLastRow() > 10000) throw rowCompletionError_('出典の照合範囲を確認できません．');
    const rows = namedSheetRead_(sheet, item.fields, 2, Math.max(0, sheet.getLastRow() - 1)).values;
    const matches = [];
    rows.forEach(function (values, index) { if (rowCompletionHash_(values) === item.hash) matches.push(index + 2); });
    if (matches.length !== 1) throw rowCompletionError_('出典の原文・使用箇所が変わったか，一意に照合できません．下書きの状態を確認してください．');
    item.number = matches[0];
  });
}
function showMaintenanceWorkbench() {
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('direct_maintenance_dialog').setWidth(780).setHeight(720), '用語を調べて登録');
}
function showMaintenanceAliases() { return showMaintenanceWorkbench(); }
