/** GM/Notes only. Native sheet sort; no other-tab scan, link migration, helper tab or API request. */
const MAINTENANCE_SORT_PREFIX = 'maintenance-sort-v1:';
const MAINTENANCE_SORT_NORMALIZED = '=ARRAYFORMULA(IF(A2:A="","",SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(LOWER(A2:A),"ä","ae"),"ö","oe"),"ü","ue"),"ß","ss")))';
function maintenanceSortKey_(book) { return MAINTENANCE_SORT_PREFIX + rowCompletionHash_(book.getId()); }
function maintenanceSortAssertIdle_(book) {
  if (PropertiesService.getScriptProperties().getProperty(maintenanceSortKey_(book))) throw rowCompletionError_('前回の並べ替えが処理中または結果未確認です．状態を確認するまで再実行しないでください．');
}
function maintenanceSortBag_(values, notes, normalized) {
  return rowCompletionHash_(values.map(function (row, i) {
    const copy = row.slice(); if (normalized) copy[1] = '';
    return JSON.stringify([copy, notes[i]]);
  }).sort());
}
function maintenanceSortHeaderFormulas_(formulas) {
  formulas[0].forEach(function (formula) {
    if (!formula) return;
    const compact = formula.replace(/\s/g, '');
    if (!/^=COUNTA\(\$?([A-Z]+)\$?2:\$?\1\)$/i.test(compact) &&
        !/^=COUNTIF\(\$?([A-Z]+)\$?2:\$?\1,(?:"(?:[^"]|"")*"|-?[0-9.]+)\)$/i.test(compact) &&
        !/^=\$?[A-Z]+\$?1\/\$?[A-Z]+\$?1$/i.test(compact)) throw rowCompletionError_('未対応の見出し数式があります．');
  });
  return formulas;
}
function maintenanceSortSheet_(sheet) {
  if (!sheet) throw rowCompletionError_('GM・Notesの両タブが必要です．');
  const height = sheet.getLastRow(), width = sheet.getMaxColumns();
  if (height < 1 || height > 10000 || width > 100) throw rowCompletionError_('本文範囲を確認できません．');
  const header = sheet.getRange(1, 1, 1, width), headerNames = header.getDisplayValues()[0];
  if (headerNames[0] !== 'de') throw rowCompletionError_('A列がdeのGM・Notesだけを並べ替えます．');
  const preparationColumn = sheet.getName() === 'Notes' ? headerNames.indexOf('準備状態') + 1 : 0;
  if (sheet.getName() === 'Notes' && (!preparationColumn || headerNames.filter(function (name) { return name === '準備状態'; }).length !== 1)) throw rowCompletionError_('Notesの準備状態列を確認できません．');
  const headerFormulas = maintenanceSortHeaderFormulas_(header.getFormulas());
  const body = height > 1 ? sheet.getRange(2, 1, height - 1, width) : null;
  if (!header.canEdit() || header.isPartOfMerge() || body && (!body.canEdit() || body.isPartOfMerge())) throw rowCompletionError_('保護または結合セルがあります．');
  const values = body ? body.getValues() : [], notes = body ? body.getNotes() : [], formulas = body ? body.getFormulas() : [];
  let normalized = '';
  formulas.forEach(function (row, r) { row.forEach(function (formula, c) {
    if (!formula) return;
    if (sheet.getName() === 'GM' && r === 0 && c === 1 && headerNames[1] === 'de_normalized' &&
        formula.replace(/\s/g, '') === MAINTENANCE_SORT_NORMALIZED.replace(/\s/g, '')) { normalized = formula; return; }
    throw rowCompletionError_('本文に未対応の数式があります：' + sheet.getName() + ' ' + (r + 2) + '行．');
  }); });
  if (normalized) {
    const derived = sheet.getRange(2, 2, sheet.getMaxRows() - 1, 1);
    if (!derived.canEdit() || derived.isPartOfMerge()) throw rowCompletionError_('GMの正規化列が保護または結合されています．');
    values.forEach(function (row) {
      const expected = String(row[0]).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
      if (String(row[1]) !== expected) throw rowCompletionError_('GMの正規化列と原文が一致しません．');
    });
  }
  return { sheet: sheet, height: height, width: width, body: body, normalized: normalized, preparationColumn: preparationColumn, headerFormulas: headerFormulas,
    source: rowCompletionHash_([values, notes, formulas]), bag: maintenanceSortBag_(values, notes, normalized) };
}
function maintenanceSortPlan_(book) {
  maintenanceSortAssertIdle_(book);
  // Sorting moves complete rows. Pending proposals and API reservations remain intact.
  return ['GM', 'Notes'].map(function (name) { return maintenanceSortSheet_(book.getSheetByName(name)); });
}
function maintenanceSortApproveNotes_(plan) {
  if (plan.sheet.getName() !== 'Notes' || !plan.body) return;
  const sheet = plan.sheet, count = plan.height - 1, column = plan.preparationColumn;
  const header = sheet.getRange(1, 1, 1, plan.width).getDisplayValues()[0];
  if (header[column - 1] !== '準備状態' || header.filter(function (name) { return name === '準備状態'; }).length !== 1) throw rowCompletionError_('Notesの準備状態列が変わりました．');
  const words = sheet.getRange(2, 1, count, 1).getValues(), range = sheet.getRange(2, column, count, 1), before = range.getValues();
  const expected = before.map(function (row, i) { return [String(words[i][0]).trim() ? '承認' : row[0]]; });
  for (let start = 0; start < count;) {
    if (expected[start][0] === before[start][0]) { start++; continue; }
    let end = start + 1;
    while (end < count && expected[end][0] !== before[end][0]) end++;
    sheet.getRange(start + 2, column, end - start, 1).setValues(expected.slice(start, end));
    start = end;
  }
  SpreadsheetApp.flush();
  if (JSON.stringify(range.getValues()) !== JSON.stringify(expected)) throw rowCompletionError_('Notesの準備状態の保存結果を確認できません．');
}
function maintenanceSortOne_(plan) {
  const sheet = plan.sheet, current = maintenanceSortSheet_(sheet);
  if (current.source !== plan.source || JSON.stringify(current.headerFormulas) !== JSON.stringify(plan.headerFormulas)) throw rowCompletionError_('並べ替え直前に内容が編集されました．');
  if (!plan.body) return;
  const derived = plan.normalized ? sheet.getRange(2, 2, sheet.getMaxRows() - 1, 1) : null;
  try {
    if (derived) { derived.clearContent(); SpreadsheetApp.flush(); }
    plan.body.sort({ column: 1, ascending: true });
  } finally {
    // Restore even when sorting throws. clearContent preserves cell formatting and validation.
    if (derived) { derived.clearContent(); sheet.getRange(2, 2).setFormula(plan.normalized); }
    plan.headerFormulas[0].forEach(function (formula, c) { if (formula) sheet.getRange(1, c + 1).setFormula(formula); });
    SpreadsheetApp.flush();
  }
  const after = maintenanceSortSheet_(sheet);
  if (after.height !== plan.height || after.width !== plan.width || after.bag !== plan.bag || after.normalized !== plan.normalized || after.preparationColumn !== plan.preparationColumn ||
      JSON.stringify(after.headerFormulas) !== JSON.stringify(plan.headerFormulas)) throw rowCompletionError_('並べ替え後のデータと数式の一致を確認できません．');
  maintenanceSortApproveNotes_(plan);
}
function maintenanceSortRun_() {
  return rowCompletionLock_(function () {
    const book = SpreadsheetApp.getActiveSpreadsheet(), props = PropertiesService.getScriptProperties();
    if (!book || props.getProperty('SPREADSHEET_ID') !== book.getId()) throw rowCompletionError_('登録済みのデータ元シートから実行してください．');
    const plans = maintenanceSortPlan_(book), key = maintenanceSortKey_(book), record = { status: 'sorting', startedAt: Date.now(), completed: [] };
    props.setProperty(key, JSON.stringify(record));
    try {
      plans.forEach(function (plan) {
        record.active = plan.sheet.getName(); props.setProperty(key, JSON.stringify(record));
        maintenanceSortOne_(plan); record.completed.push(record.active); props.setProperty(key, JSON.stringify(record));
      });
      props.deleteProperty(key);
      return 'GM・NotesをそれぞれA列の昇順（A→Z）に並べ替え，Notesの準備状態を承認にしました．';
    } catch (error) {
      record.status = 'uncertain'; props.setProperty(key, JSON.stringify(record));
      throw rowCompletionError_('並べ替えを中断しました（確認済み：' + (record.completed.join('・') || 'なし') + '）．' + error.message + ' 自動再実行はしていません．');
    }
  });
}
function sortMaintenanceRows() {
  const ui = SpreadsheetApp.getUi();
  try { ui.alert(maintenanceSortRun_()); } catch (error) { ui.alert(error.message); }
}
function maintenanceSortReadiness_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book || PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') !== book.getId()) throw rowCompletionError_('登録済みのデータ元シートから確認してください．');
  const plans = maintenanceSortPlan_(book);
  return { status: 'ready', sheets: plans.map(function (p) { return { name: p.sheet.getName(), rows: p.height - 1, normalizedArray: Boolean(p.normalized) }; }), sorted: false, dataWritten: false };
}
function checkMaintenanceSortReadiness() { const result = maintenanceSortReadiness_(); console.log(JSON.stringify(result)); return result; }
