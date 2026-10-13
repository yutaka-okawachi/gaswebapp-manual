/** Private source tracking. Original cell values and column positions are never changed. */
const ENGLISH_REVIEW_AUTO_HEADERS = ['元行ID（内部）', '最新原文控え（内部）', '前回原文控え（内部）', '更新内容（内部）', '更新日時（内部）'];
const ENGLISH_REVIEW_METADATA_KEY = 'ENGLISH_REVIEW_SOURCE';

function englishReviewAutoLayout_(sheet, initialize) {
  if (sheet.getMaxColumns() < 24) {
    if (!initialize) return false;
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 24 - sheet.getMaxColumns());
  }
  const header = sheet.getRange(1, 20, 1, 5).getDisplayValues()[0];
  if (header.every(function (v) { return !v; })) {
    if (!initialize) return false;
    englishReviewAutoWrite_(sheet, 1, 20, ENGLISH_REVIEW_AUTO_HEADERS);
    sheet.hideColumns(20, 5);
    return true;
  }
  if (header.some(function (v, i) { return v !== ENGLISH_REVIEW_AUTO_HEADERS[i]; })) {
    throw new Error('英訳確認の更新管理列が変更されています。自動更新を停止しました。');
  }
  return true;
}

function englishReviewAutoWrite_(sheet, row, column, values) {
  sheet.getRange(row, column, 1, values.length).setRichTextValues([values.map(function (value) {
    return SpreadsheetApp.newRichTextValue().setText(String(value)).build();
  })]);
}

function englishReviewAutoInfo_(context, includeSnapshotRows) {
  if (!englishReviewAutoLayout_(context.sheet, false)) return null;
  const count = Math.max(0, context.sheet.getLastRow() - 1);
  const rows = count && includeSnapshotRows !== false ? context.sheet.getRange(2, 20, count, 5).getDisplayValues() : [];
  const tags = Object.create(null);
  context.workbook.createDeveloperMetadataFinder().withKey(ENGLISH_REVIEW_METADATA_KEY).find().forEach(function (tag) {
    const location = tag.getLocation().getRow();
    if (location) tags[String(tag.getId())] = { id: tag.getValue(), tab: location.getSheet().getName(), rowNumber: location.getRow() };
  });
  return { rows: rows, tags: tags };
}

function englishReviewSourceSnapshot_(tab, source) {
  const row = source.row.slice(), notes = (source.notes || row.map(function () { return ''; })).slice();
  // Normalization/check flags do not change the text to translate.
  (tab === 'GM' ? [1] : tab === 'RW' || tab === 'RS' ? [6, 12] : []).forEach(function (i) { row[i] = ''; notes[i] = ''; });
  return JSON.stringify({ row: row, notes: notes });
}

function englishReviewSourceDetails_(tab, snapshot) {
  if (!snapshot) return '';
  const data = JSON.parse(snapshot), labels = {8:'ja2',9:'ja3',10:'comment',11:'comment2',13:'note'}, lines = [];
  if (tab === 'RW' || tab === 'RS') Object.keys(labels).forEach(function (i) {
    if (data.row[i]) lines.push(labels[i] + '：' + data.row[i]);
  });
  (data.notes || []).forEach(function (note, i) { if (note) lines.push('セルのメモ（' + (i + 1) + '列目）：' + note); });
  return lines.join('\n');
}

function englishReviewSyncSources_(initialize, onlyTab) {
  const context = englishReviewSheet_();
  const lock = LockService.getDocumentLock();
  if (!lock || !lock.tryLock(onlyTab ? 1000 : 10000)) throw new Error('保存処理が実行中です。原文の自動更新は次の読込みで再確認します。');
  try {
    if (!englishReviewAutoLayout_(context.sheet, initialize)) return;
    const count = Math.max(0, context.sheet.getLastRow() - 1);
    if (!count) return;
    const rows = context.sheet.getRange(2, 1, count, 24).getDisplayValues();
    const mappingFormulas = context.sheet.getRange(2, 13, count, 1).getFormulas();
    const selected = rows.filter(function (r) { return r[0] && (!onlyTab || r[1] === onlyTab); });
    if (!selected.length) return;
    const tabs = selected.map(function (r) { return r[1]; }).filter(function (v,i,a) { return a.indexOf(v) === i; });
    const sources = englishReviewSources_(context.workbook, tabs);
    const info = englishReviewAutoInfo_(context), seen = Object.create(null);
    rows.forEach(function (row, i) {
      if (!row[0]) return;
      if (!/^EN-\d{6}$/.test(row[0]) || seen[row[0]]) throw new Error('確認IDが不正または重複しています。');
      seen[row[0]] = true;
    });
    rows.forEach(function (row, i) {
      const id = row[0], tab = row[1], reviewRow = i + 2;
      if (!id || (onlyTab && tab !== onlyTab)) return;
      let tag = info.tags[row[19]], source = null, metadataId = row[19];
      if (metadataId) {
        if (tag && tag.id === id && tag.tab === tab) source = sources[tab].byRow[tag.rowNumber];
      } else {
        const matches = sources[tab][englishReviewSourceKey_(tab, row, true)] || [];
        if (matches.length === 1) {
          source = matches[0];
          const original = context.workbook.getSheetByName(tab);
          let added = original.createDeveloperMetadataFinder().withKey(ENGLISH_REVIEW_METADATA_KEY).withValue(id).find();
          if (!added.length) {
            original.getRange(source.rowNumber + ':' + source.rowNumber).addDeveloperMetadata(ENGLISH_REVIEW_METADATA_KEY, id, SpreadsheetApp.DeveloperMetadataVisibility.DOCUMENT);
            added = original.createDeveloperMetadataFinder().withKey(ENGLISH_REVIEW_METADATA_KEY).withValue(id).find();
          }
          if (added.length !== 1) throw new Error('元行の識別情報が重複しています。対応を確認してください。');
          if (added[0].getLocation().getRow().getRow() !== source.rowNumber) throw new Error('元行の識別情報の対応を確認してください。');
          metadataId = String(added[0].getId());
        }
      }
      if (!source || !source.row[tab === 'RW' || tab === 'RS' ? 5 : 0]) {
        if (row[6] !== '要修正') englishReviewAutoWrite_(context.sheet, reviewRow, 7, ['要修正']);
        context.sheet.getRange(reviewRow, 13, 1, 1).setValues([[0]]);
        if (row[22] !== '元項目の削除・対応先不明') englishReviewAutoWrite_(context.sheet, reviewRow, 23, ['元項目の削除・対応先不明', new Date().toISOString()]);
        return;
      }
      const snapshot = englishReviewSourceSnapshot_(tab, source), raw = source.row;
      if (snapshot.length > 45000) {
        englishReviewAutoWrite_(context.sheet, reviewRow, 7, ['要修正']);
        if (row[22] !== '原文の控えが保存上限を超えています。対応を確認してください。') englishReviewAutoWrite_(context.sheet, reviewRow, 23, ['原文の控えが保存上限を超えています。対応を確認してください。',new Date().toISOString()]);
        return;
      }
      const de = raw[tab === 'RW' || tab === 'RS' ? 5 : 0], ja = raw[tab === 'Notes' ? 1 : tab === 'GM' ? 2 : 7];
      const position = tab === 'Notes' ? raw[2] : tab === 'GM' ? raw[3] : JSON.stringify(raw.slice(0,5));
      const changed = row[20] ? row[20] !== snapshot : de !== row[3] || ja !== row[4] || position !== row[10];
      if (changed) {
        const timestamp = new Date().toISOString();
        // Invalidate adoption BEFORE replacing the baseline. A partial failure stays closed.
        englishReviewAutoWrite_(context.sheet, reviewRow, 7, ['要修正']);
        englishReviewAutoWrite_(context.sheet, reviewRow, 23, ['原文・日本語・補足の更新を検出。英訳候補を再確認してください。', timestamp]);
        const oldSource = tab === 'Notes' ? [row[3],row[4],row[10]] : tab === 'GM' ? [row[3],'',row[4],row[10]] : row.slice(13,18).concat([row[3],'',row[4]]);
        const previous = row[20] || JSON.stringify({row:oldSource,notes:[]});
        englishReviewAutoWrite_(context.sheet, reviewRow, 22, [previous]);
        englishReviewAutoWrite_(context.sheet, reviewRow, 4, [de,ja]);
        englishReviewAutoWrite_(context.sheet, reviewRow, 11, [position]);
        if (tab === 'RW' || tab === 'RS') englishReviewAutoWrite_(context.sheet, reviewRow, 14, raw.slice(0,5));
        const memo = row[7] + '\n\n原文自動更新（' + timestamp + '）：最新の原文・日本語・補足へ更新し、採否を要修正に戻しました。英訳候補は修正用に保持しています。';
        if (memo.length <= 20000) englishReviewAutoWrite_(context.sheet, reviewRow, 8, [memo]);
      }
      if (changed || !row[20]) englishReviewAutoWrite_(context.sheet, reviewRow, 20, [metadataId,snapshot]);
      else if (row[19] !== metadataId) englishReviewAutoWrite_(context.sheet, reviewRow, 20, [metadataId]);
      // The row tag follows insertion, whole-row sorting and movement; never match a replacement row by spelling.
      if (row[12] !== String(source.rowNumber) || mappingFormulas[i][0]) {
        context.sheet.getRange(reviewRow, 13, 1, 1).setValues([[source.rowNumber]]);
      }
    });
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
}

function englishTranslationSourceEdited(e) {
  const range = e && e.range;
  if (!range) return false;
  const tab = range.getSheet().getName();
  if (['RW','RS','GM'].includes(tab)) return false;
  const columns = tab === 'Notes' ? [1,2,3] : tab === 'GM' ? [1,3,4] : tab === 'RW' || tab === 'RS' ? [1,2,3,4,5,6,8,9,10,11,12,14] : [];
  if (!columns.some(function (c) { return c >= range.getColumn() && c <= range.getLastColumn(); }) || range.getLastRow() < 2) return false;
  if (!e.source.getSheetByName('英訳確認')) return true;
  try { englishReviewSyncSources_(false, tab); }
  catch (_) { e.source.toast('英訳確認の自動更新を完了できませんでした。確認画面で最新の内容を読み直してください。', '英訳作業', 8); }
  return true;
}
