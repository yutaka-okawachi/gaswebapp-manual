/** Resolve source columns by meaning; never fall back to a guessed column number. */
const SOURCE_SHEET_COLUMN_NAMES = Object.freeze({
  Notes: ['de', 'ja', 'source', '現在の日本語（修正案）', '修正点', '改訂英訳候補', 'イタリア語の比較', '根拠・未解決点', '準備状態'],
  GM: ['de', 'de_normalized', 'ja', 'data', '現在の日本語（修正案）', '修正点', '改訂英訳候補', 'イタリア語の比較', '根拠・未解決点', '準備状態'],
  RW: ['Oper', 'Aufzug', 'Szene', 'page', 'whom', 'de', 'de_normalized', 'ja', 'whom_en', '現在の日本語（修正案）', '修正点', '改訂英訳候補', 'イタリア語の比較', '根拠・未解決点', '準備状態'],
  RS: ['Oper', 'Aufzug', 'Szene', 'page', 'whom', 'de', 'de_normalized', 'ja', 'whom_en', '現在の日本語（修正案）', '修正点', '改訂英訳候補', 'イタリア語の比較', '根拠・未解決点', '準備状態']
});
function namedSheetHeader_(value) { return String(value == null ? '' : value).normalize('NFC').trim(); }
function namedSheetColumns_(sheet, names) {
  const width = sheet.getLastColumn();
  if (!Number.isSafeInteger(width) || width < 1 || width > 1000) throw new Error('列の範囲を確認できません。読み書きを停止しました。');
  const range = sheet.getRange(1, 1, 1, width);
  const header = range.getDisplayValues()[0].map(namedSheetHeader_);
  const formulas = range.getFormulas()[0];
  const positions = names.map(function (name) {
    const aliases = name === '改訂英訳候補' ? ['改訂英訳候補', 'en'] : [name];
    const matches = header.map(function (h, i) { return aliases.includes(h) ? i : -1; }).filter(function (i) { return i >= 0; });
    if (!matches.length) throw new Error('必須見出しがありません: ' + sheet.getName() + ':' + aliases.join(' / '));
    if (matches.length !== 1) throw new Error('見出しが重複・競合しています: ' + sheet.getName() + ':' + aliases.join(' / '));
    if (formulas[matches[0]]) throw new Error('見出しの数式は使用できません: ' + sheet.getName() + ':' + name);
    return matches[0];
  });
  return { names: names.slice(), positions: positions, width: Math.max.apply(null, positions) + 1,
    signature: JSON.stringify(positions.map(function (p) { return [p, header[p]]; })) };
}
function namedSheetAssertLayout_(sheet, layout) {
  if (namedSheetColumns_(sheet, layout.names).signature !== layout.signature) throw new Error('処理中に列構成が変わりました。読み書きを停止しました。');
}
function namedSheetRead_(sheet, names, row, count, details) {
  const layout = namedSheetColumns_(sheet, names);
  if (!count) return { layout: layout, values: [], notes: [], formulas: [] };
  const range = sheet.getRange(row, 1, count, layout.width);
  function arrange(rows) { return rows.map(function (r) { return layout.positions.map(function (p) { return r[p] == null ? '' : r[p]; }); }); }
  const result = { layout: layout, values: arrange(details === true ? range.getDisplayValues() : range.getValues()) };
  if (details) { result.notes = arrange(range.getNotes()); result.formulas = arrange(range.getFormulas()); }
  namedSheetAssertLayout_(sheet, layout);
  return result;
}
function namedSheetCell_(sheet, names, row, index) {
  const layout = namedSheetColumns_(sheet, names);
  if (!Number.isSafeInteger(index) || index < 0 || index >= names.length) throw new Error('書込み先の項目を確認できません。');
  namedSheetAssertLayout_(sheet, layout);
  return sheet.getRange(row, layout.positions[index] + 1, 1, 1);
}
function sourceSheetNames_(sheet, width) {
  const names = SOURCE_SHEET_COLUMN_NAMES[sheet.getName()];
  if (!names || width > names.length) throw new Error('元シートの項目を確認できません。');
  return names.slice(0, width);
}
function sourceEnglishColumns_(ctx) { return namedSheetColumns_(ctx.sheet, sourceSheetNames_(ctx.sheet, ctx.adapter.width)); }
function sourceEnglishCell_(ctx, row, index, snapshot) {
  const fresh = sourceEnglishSnapshot_(ctx, row);
  if (snapshot && fresh.inputHash !== snapshot.inputHash) throw new Error('書込み直前に対象内容が変わりました。再送せず確認してください。');
  namedSheetAssertLayout_(ctx.sheet, fresh.layout);
  return ctx.sheet.getRange(row, fresh.layout.positions[index] + 1, 1, 1);
}
function namedSheetColumnLabel_(position) {
  let label = ''; for (let n = position + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label;
  return label;
}
function namedSheetWriteRows_(sheet, names, row, rows) {
  const layout = namedSheetColumns_(sheet, names);
  if (rows.some(function (r) { return !Array.isArray(r) || r.length !== names.length; })) throw new Error('書込み項目数が一致しません。');
  // Separate named columns preserve every unrelated cell, including review columns.
  for (let i = 0; i < names.length;) {
    let end = i + 1;
    while (end < names.length && layout.positions[end] === layout.positions[end - 1] + 1) end++;
    namedSheetAssertLayout_(sheet, layout);
    sheet.getRange(row, layout.positions[i] + 1, rows.length, end - i).setValues(rows.map(function (r) { return r.slice(i, end); }));
    i = end;
  }
  namedSheetAssertLayout_(sheet, layout);
}
