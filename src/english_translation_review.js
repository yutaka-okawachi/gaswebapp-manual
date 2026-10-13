/** Private, spreadsheet-bound English review UI. No public API route or export. */
const ENGLISH_REVIEW_HEADERS = [
  '確認ID', '元タブ', '最新照合', 'ドイツ語（作業開始時）', '日本語（作業開始時）',
  '英訳候補', '採否', '確認・修正メモ', '現在の日本語', '採用の有効性',
  '使用箇所・出典（開始時）', '元行（参考）', '照合先行（内部）',
  '作品（内部）', '幕（内部）', '場面（内部）', 'ページ（内部）', '指示対象（内部）', '作業開始日'
];
const ENGLISH_REVIEW_DECISIONS = ['未着手', '確認中', '要修正', '採用', '保留', '却下'];

function showEnglishTranslationReview() {
  englishReviewSheet_();
  const html = HtmlService.createHtmlOutputFromFile('english_translation_dialog')
    .setWidth(1240).setHeight(800);
  SpreadsheetApp.getUi().showModalDialog(html, '英訳作業');
}

/** Reference-only path used by the unified proposal dialog; no legacy/source writes. */
function getEnglishTranslationReference() {
  const data = englishReviewRead_();
  return { records: data.records, decisions: ENGLISH_REVIEW_DECISIONS.slice(), workbookKey: data.workbook.getId(), lastId: '' };
}

function englishReviewSheet_() {
  if (typeof notesEnglishLegacyGuard_ === 'function') notesEnglishLegacyGuard_();
  const workbook = SpreadsheetApp.getActiveSpreadsheet();
  if (!workbook) throw new Error('対象のスプレッドシート内から開いてください。');
  const sheet = workbook.getSheetByName('英訳確認');
  if (!sheet || sheet.getMaxColumns() < ENGLISH_REVIEW_HEADERS.length) {
    throw new Error('「英訳確認」タブの構成を確認してください。');
  }
  const headers = sheet.getRange(1, 1, 1, 19).getDisplayValues()[0];
  if (headers.some((value, index) => value !== ENGLISH_REVIEW_HEADERS[index])) {
    throw new Error('確認タブの列構成が変更されています。書込みを停止しました。');
  }
  if (sheet.getLastRow() > 20000) throw new Error('確認件数が上限を超えています。構成の見直しが必要です。');
  return { workbook: workbook, sheet: sheet };
}

function englishReviewSourceKey_(tab, row, snapshot) {
  if (snapshot) {
    if (tab === 'Notes') return JSON.stringify([row[3]]);
    if (tab === 'GM') return JSON.stringify([row[3], row[10]]);
    return JSON.stringify([row[3]].concat(row.slice(13, 18)));
  }
  if (tab === 'Notes') return JSON.stringify([row[0]]);
  if (tab === 'GM') return JSON.stringify([row[0], row[3]]);
  return JSON.stringify([row[5]].concat(row.slice(0, 5)));
}

function englishReviewSources_(workbook, tabs, selectedRows) {
  const sources = {};
  tabs.forEach(function (tab) {
    if (['Notes', 'GM', 'RW', 'RS'].indexOf(tab) < 0) throw new Error('対象外の元タブです。');
    const sheet = workbook.getSheetByName(tab);
    if (!sheet) throw new Error('元タブが見つかりません。');
    const width = tab === 'Notes' ? 3 : tab === 'GM' ? 4 : 14;
    const expected = tab === 'Notes' ? ['de', 'ja', 'source'] : tab === 'GM'
      ? ['de', 'de_normalized', 'ja', 'data']
      : ['Oper', 'Aufzug', 'Szene', 'page', 'whom', 'de', 'de_normalized', 'ja'];
    const header = sheet.getRange(1, 1, 1, width).getDisplayValues()[0];
    if (expected.some(function (v, i) { return v !== header[i]; })) {
      throw new Error('元タブの列構成が変更されています。書込みを停止しました。');
    }
    const index = Object.create(null); index.byRow = Object.create(null);
    const count = sheet.getLastRow() - 1;
    if (count > 30000) throw new Error('元タブの件数が上限を超えています。');
    const rowNumbers = selectedRows ? Array.from(new Set(selectedRows[tab] || [])).filter(function(n){return n>=2&&n<=count+1;}).sort(function(a,b){return a-b;}) : [];
    const groups=[];rowNumbers.forEach(function(n){const last=groups[groups.length-1];if(last&&last.first+last.count===n)last.count++;else groups.push({first:n,count:1});});
    const ranges = selectedRows ? groups.map(function (part) {
      return { range: sheet.getRange(part.first, 1, part.count, width), first: part.first };
    }) : count > 0 ? [{ range: sheet.getRange(2, 1, count, width), first: 2 }] : [];
    ranges.forEach(function (part) {
    const notes = part.range.getNotes ? part.range.getNotes() : [];
    part.range.getDisplayValues().forEach(function (row, i) {
      const de = row[tab === 'Notes' || tab === 'GM' ? 0 : 5];
      if (!de) return;
      const key = englishReviewSourceKey_(tab, row, false);
      if (!index[key]) index[key] = [];
      const item = { row: row, rowNumber: part.first + i, notes: notes[i] || [] };
      index[key].push(item); index.byRow[part.first + i] = item;
    });
    });
    sources[tab] = index;
  });
  return sources;
}

function englishReviewDigest_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(value), Utilities.Charset.UTF_8)
    .map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}

function englishReviewRead_() {
  const context = englishReviewSheet_();
  const count = Math.max(0, context.sheet.getLastRow() - 1);
  const range = count ? context.sheet.getRange(2, 1, count, 19) : null;
  const values = range ? range.getDisplayValues() : [];
  const formulas = range ? range.getFormulas() : [];
  const rows = values.map(function (row, index) { return { row: row, rowNumber: index + 2, formulas: formulas[index] }; })
    .filter(function (item) { return item.row[0]; });
  const tabs = rows.map(function (item) { return item.row[1]; }).filter(function (tab, index, array) { return array.indexOf(tab) === index; });
  const sources = englishReviewSources_(context.workbook, tabs);
  const auto = typeof englishReviewAutoInfo_ === 'function' ? englishReviewAutoInfo_(context) : null;
  const seen = Object.create(null);
  const records = rows.map(function (item) {
    const row = item.row, id = row[0], tab = row[1];
    if (!/^EN-\d{6}$/.test(id) || seen[id]) throw new Error('確認IDが不正または重複しています。書込みを停止しました。');
    seen[id] = true;
    const tracking = auto && auto.rows[item.rowNumber - 2];
    const tag = tracking && auto.tags[tracking[0]];
    const matches = tracking && tracking[0] ? tag && tag.id === id && tag.tab === tab && sources[tab].byRow[tag.rowNumber]
      ? [sources[tab].byRow[tag.rowNumber]] : [] : sources[tab][englishReviewSourceKey_(tab, row, true)] || [];
    const source = matches.length === 1 ? matches[0].row : null;
    const ja = source ? source[tab === 'Notes' ? 1 : tab === 'GM' ? 2 : 7] : '';
    const de = source ? source[tab === 'Notes' || tab === 'GM' ? 0 : 5] : row[3];
    const position = source ? (tab === 'Notes' ? source[2] : tab === 'GM' ? source[3] : JSON.stringify(source.slice(0, 5))) : row[10];
    const sourceSnapshot = source && typeof englishReviewSourceSnapshot_ === 'function' ? englishReviewSourceSnapshot_(tab,matches[0]) : '';
    const state = !source ? '要照合（原文・位置の変更／重複）' : sourceSnapshot.length > 45000 ? '原文控えの保存上限超過・要確認' : de !== row[3] ? '原文更新・再翻訳' : ja !== row[4]
      ? '日本語更新・再翻訳' : position !== row[10] ? '出典更新・再確認' : tracking && tracking[1] && tracking[1] !== sourceSnapshot ? '補足更新・再確認' : '一致';
    const decision = row[6] || '未着手';
    if (ENGLISH_REVIEW_DECISIONS.indexOf(decision) < 0) throw new Error('採否に未対応の値があります。');
    const validity = state !== '一致' || decision === '要修正' ? '再確認が必要' : decision !== '採用' ? '未採用'
      : row[5].trim() ? '有効（本番未反映）' : '英訳未入力';
    return {
      id: id, tab: tab, de: de, ja: ja, baselineJa: row[4], context: position,
      english: row[5], decision: decision, memo: row[7], state: state, validity: validity,
      needsReview: state !== '一致' || decision === '要修正',
      supplements: sourceSnapshot ? englishReviewSourceDetails_(tab,sourceSnapshot) : '',
      updateNotice: tracking && decision === '要修正' ? tracking[3] : '',
      previousJa: tracking && tracking[2] ? (JSON.parse(tracking[2]).row[tab === 'Notes' ? 1 : tab === 'GM' ? 2 : 7] || '') : '',
      revision: englishReviewDigest_([row, item.formulas, matches]),
      reviewRowRevision: englishReviewDigest_([row, item.formulas]),
      sourceRevision: englishReviewDigest_(matches), rowNumber: item.rowNumber
    };
  });
  return { workbook: context.workbook, sheet: context.sheet, records: records };
}

function getEnglishTranslationReview() {
  if (typeof englishReviewSyncSources_ === 'function') englishReviewSyncSources_(false);
  const data = englishReviewRead_();
  return { records: data.records, decisions: ENGLISH_REVIEW_DECISIONS.slice(), workbookKey: data.workbook.getId(),
    lastId: PropertiesService.getUserProperties().getProperty('ENGLISH_REVIEW_LAST_ID') || '' };
}

function rememberEnglishTranslationReview(id) {
  if (typeof id !== 'string' || !/^EN-\d{6}$/.test(id)) throw new Error('確認IDを確認してください。');
  const data = englishReviewSheet_();
  const count = data.sheet.getLastRow() - 1;
  if (count < 1 || !data.sheet.getRange(2, 1, count, 1).getDisplayValues().some(function (row) { return row[0] === id; })) {
    throw new Error('確認項目が見つかりません。');
  }
  PropertiesService.getUserProperties().setProperty('ENGLISH_REVIEW_LAST_ID', id);
  return true;
}

function englishReviewValidateSave_(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('保存内容を確認してください。');
  if (typeof request.id !== 'string' || !/^EN-\d{6}$/.test(request.id) ||
      typeof request.revision !== 'string' || !/^[a-f0-9]{64}$/.test(request.revision)) throw new Error('確認項目を読み直してください。');
  if (typeof request.english !== 'string' || request.english.length > 30000 ||
      typeof request.memo !== 'string' || request.memo.length > 20000 ||
      ENGLISH_REVIEW_DECISIONS.indexOf(request.decision) < 0) throw new Error('候補・メモの長さや採否を確認してください。');
  if (request.decision === '採用' && !request.english.trim()) throw new Error('英訳が空欄のため採用できません。');
}

function englishReviewWriteDraft_(sheet, rowNumber, values) {
  // Rich text keeps leading '=' literal; only the three editable cells are written.
  sheet.getRange(rowNumber, 6, 1, 3).setRichTextValues([values.map(function (text) {
    return SpreadsheetApp.newRichTextValue().setText(text).build();
  })]);
}

function saveEnglishTranslationReview(request) {
  englishReviewValidateSave_(request);
  if (typeof englishReviewSyncSources_ === 'function') englishReviewSyncSources_(false);
  const lock = LockService.getDocumentLock();
  if (!lock || !lock.tryLock(10000)) throw new Error('ほかの保存処理が実行中です。少し待って保存してください。');
  try {
    const before = englishReviewRead_();
    const record = before.records.filter(function (item) { return item.id === request.id; })[0];
    if (!record || record.revision !== request.revision) {
      throw new Error('原文または候補が別の画面で変更されました。入力内容を控えたまま、最新の内容を読み直してください。');
    }
    if (request.decision === '採用' && record.state !== '一致') throw new Error('原文の再確認が必要なため採用できません。');
    const target = before.sheet.getRange(record.rowNumber, 1, 1, 19);
    if (englishReviewDigest_([target.getDisplayValues()[0], target.getFormulas()[0]]) !== record.reviewRowRevision) {
      throw new Error('保存直前に確認タブが変更されました。最新の内容を読み直してください。');
    }
    englishReviewWriteDraft_(before.sheet, record.rowNumber, [request.english, request.decision, request.memo]);
    SpreadsheetApp.flush();
    const after = englishReviewRead_();
    const saved = after.records.filter(function (item) { return item.id === request.id; })[0];
    if (!saved || saved.english !== request.english || saved.decision !== request.decision || saved.memo !== request.memo) {
      throw new Error('保存中に確認タブが変更されました。最新の内容を読み直してください。');
    }
    let notice = '';
    if (saved.sourceRevision !== record.sourceRevision && saved.decision === '採用') {
      englishReviewWriteDraft_(after.sheet, saved.rowNumber, [request.english, '要修正', request.memo]);
      SpreadsheetApp.flush();
      saved.decision = '要修正'; saved.needsReview = true; saved.validity = '再確認が必要';
      // Return a fresh revision after downgrading; the original source is never written.
      const reread = englishReviewRead_().records.filter(function (item) { return item.id === request.id; })[0];
      after.records = after.records.map(function (item) { return item.id === request.id ? reread : item; });
      notice = '保存中に原文が更新されたため、採用を取り消して「要修正」にしました。候補は保持しています。';
    }
    PropertiesService.getUserProperties().setProperty('ENGLISH_REVIEW_LAST_ID', request.id);
    return { records: after.records, notice: notice, savedId: request.id };
  } finally { lock.releaseLock(); }
}

/** Human-selected, already saved candidates only; never generates or publishes English. */
function adoptEnglishTranslationReviewBatch(request) {
  if (!request || !Array.isArray(request.items) || !request.items.length || request.items.length > 50) {
    throw new Error('採用する項目を1〜50件選んでください。');
  }
  const seen = Object.create(null);
  request.items.forEach(function (item) {
    if (!item || typeof item.id !== 'string' || !/^EN-\d{6}$/.test(item.id) || seen[item.id] ||
        typeof item.revision !== 'string' || !/^[a-f0-9]{64}$/.test(item.revision)) {
      throw new Error('確認ID・版を確認し、一覧を読み直してください。');
    }
    seen[item.id] = true;
  });
  if (typeof englishReviewSyncSources_ === 'function') englishReviewSyncSources_(false);
  const lock = LockService.getDocumentLock();
  if (!lock || !lock.tryLock(10000)) throw new Error('ほかの保存処理が実行中です。少し待ってください。');
  try {
    const before = englishReviewRead_();
    const selected = request.items.map(function (item) {
      const record = before.records.filter(function (r) { return r.id === item.id; })[0];
      if (!record || record.revision !== item.revision) throw new Error('原文または候補が変更されました。採用せず停止しました。一覧を読み直してください。');
      if (record.decision !== '確認中' || record.state !== '一致' || record.needsReview || !record.english.trim()) {
        throw new Error(item.id + 'はまとめて採用できません。「確認中」で原文一致・英訳入力済みの項目を選んでください。');
      }
      return record;
    });
    selected.forEach(function (record) {
      const target = before.sheet.getRange(record.rowNumber, 1, 1, 19);
      if (englishReviewDigest_([target.getDisplayValues()[0], target.getFormulas()[0]]) !== record.reviewRowRevision) {
        throw new Error('採用直前に確認タブが変更されました。一覧を読み直してください。');
      }
    });
    // RangeList writes just G, retaining English, notes and unrelated decisions.
    let writeError = null;
    try {
      before.sheet.getRangeList(selected.map(function (r) { return 'G' + r.rowNumber; })).setValue('採用');
      SpreadsheetApp.flush();
    } catch (error) { writeError = error; }
    let after;
    try { after = englishReviewRead_(); }
    catch (_) { throw new Error('採用処理の成否を確認できません。一覧を読み直し、選んだ確認IDの採否を確認してください。自動では再実行しません。'); }
    const invalid = [];
    selected.forEach(function (record) {
      const saved = after.records.filter(function (r) { return r.id === record.id; })[0];
      if (writeError || !saved || saved.decision !== '採用' || saved.sourceRevision !== record.sourceRevision ||
          saved.state !== '一致' || saved.english !== record.english || saved.memo !== record.memo) {
        invalid.push(record.id);
        // Recheck identity before invalidating; never overwrite a shifted row or an explicit hold.
        if (saved && saved.decision === '採用') {
          const identity = after.sheet.getRange(saved.rowNumber, 1, 1, 7).getDisplayValues()[0];
          if (identity[0] === saved.id && identity[6] === '採用') {
            after.sheet.getRange(saved.rowNumber, 7, 1, 1).setRichTextValues([[SpreadsheetApp.newRichTextValue().setText('要修正').build()]]);
          }
        }
      }
    });
    SpreadsheetApp.flush();
    const fresh = englishReviewRead_();
    return { records: fresh.records, adoptedIds: selected.map(function (r) { return r.id; }).filter(function (id) {
      return invalid.indexOf(id) < 0 && fresh.records.some(function (r) { return r.id === id && r.decision === '採用' && r.validity === '有効（本番未反映）'; });
    }), notice: writeError ? '書込みが途中で失敗しました。選択項目の採用を有効にせず、書き込まれた項目は「要修正」に戻しました。再読込みして確認してください。'
      : invalid.length ? '保存中に変更を検出しました。再確認が必要な項目：' + invalid.join('、') + '。候補とメモは保持しています。' : '' };
  } finally { lock.releaseLock(); }
}
