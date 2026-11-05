/** Private runtime ledger; activation marker and immutable IDs remain required after migration. */
const MAINTENANCE_LEDGER_NAME_ = '保守管理台帳';
const MAINTENANCE_LEDGER_ACTIVE_ = 'MAINTENANCE_LEDGER_ACTIVE_V1';
const MAINTENANCE_LEDGER_HEADERS_ = ['種別', '記録ID', '観測ID', '判定ID', '候補ID', '保護状態', '内容JSON', '内容ハッシュ', '更新日時'];

function maintenanceLedgerDefinitions_() {
  return [
    { kind: 'observation', name: UNREGISTERED_RESULT_TERM_SHEET_NAME, headers: UNREGISTERED_RESULT_TERM_HEADERS },
    { kind: 'review', name: JEV_REVIEW_SHEET_NAME, headers: JEV_REVIEW_HEADERS },
    { kind: 'candidate', name: UNREGISTERED_TERM_CANDIDATE_SHEET_NAME, headers: UNREGISTERED_TERM_CANDIDATE_HEADERS }
  ];
}
function maintenanceLedgerHash_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function maintenanceLedgerEncode_(row) {
  return JSON.stringify(row.map(function (v) {
    if (Object.prototype.toString.call(v) === '[object Date]') {
      if (!Number.isFinite(v.getTime())) throw new Error('台帳の日付が不正です．');
      return { date: v.toISOString() };
    }
    if (!['string', 'number', 'boolean'].includes(typeof v) || (typeof v === 'number' && !Number.isFinite(v))) {
      throw new Error('台帳に未対応の値があります．移行していません．');
    }
    return v;
  }));
}
function maintenanceLedgerDecode_(raw, width) {
  const row = JSON.parse(raw);
  if (!Array.isArray(row) || row.length !== width) throw new Error('台帳の内容・列数が不正です．');
  const values = row.map(function (v) {
    if (v && typeof v === 'object' && Object.keys(v).length === 1 && typeof v.date === 'string') {
      const date = new Date(v.date);
      if (!Number.isFinite(date.getTime()) || date.toISOString() !== v.date) throw new Error('台帳の日付が不正です．');
      return date;
    }
    return v;
  });
  if (maintenanceLedgerEncode_(values) !== raw) throw new Error('台帳の形式が一致しません．');
  return values;
}
function maintenanceLedgerExperimental_(row) {
  return /^test[-_]/i.test(String(row[0] || '')) || /(?:MANUAL[-_]TEST|STEP\d+[-_]TEST)/i.test(String(row[14] || '')) ||
    /本番Notesへ登録しない|実験行/.test(String(row[11] || ''));
}
function maintenanceLedgerAssertCandidateProduction_(row) {
  if (maintenanceLedgerExperimental_(row)) throw new Error('実験草案は本番Notesへ登録できません．履歴として保持します．');
}
function maintenanceLedgerFlags_(kind, row) {
  if (kind === 'candidate' && maintenanceLedgerExperimental_(row)) return '実験・本番登録禁止';
  if (kind === 'review' && ['未確認', '保留'].includes(row[12])) return row[12];
  if (kind === 'observation' && row[8] === 'Jev判定待ち') return '実行結果確認・再送禁止';
  if (kind === 'candidate' && ['生成中', '結果要確認'].includes(row[12])) return '実行結果確認・再送禁止';
  return '';
}
function maintenanceLedgerRecord_(kind, row) {
  const raw = maintenanceLedgerEncode_(row);
  if (!String(row[0] || '').trim() || raw.length > 45000) throw new Error('台帳IDまたは1セルの保存上限を確認してください．');
  return [kind, String(row[0]), kind === 'observation' ? String(row[0]) : '',
    kind === 'review' ? String(row[0]) : String(kind === 'candidate' ? row[14] || '' : row[9] || ''),
    kind === 'candidate' ? String(row[0]) : '', maintenanceLedgerFlags_(kind, row), raw,
    maintenanceLedgerHash_(raw), new Date().toISOString()];
}
function maintenanceLedgerPhysical_(book) {
  const token = PropertiesService.getScriptProperties().getProperty(MAINTENANCE_LEDGER_ACTIVE_);
  if (!token) return null;
  let active;
  try { active = JSON.parse(token); } catch (_) { throw new Error('管理台帳の有効化情報が不正です．旧台帳へ戻して再実行しません．'); }
  const sheet = book.getSheetByName(MAINTENANCE_LEDGER_NAME_);
  if (active.book !== book.getId() || !sheet || active.sheet !== sheet.getSheetId() || active.version !== 1) {
    throw new Error('有効な管理台帳を確認できません．重複処理を避けるため停止しました．');
  }
  const headers = sheet.getRange(1, 1, 1, MAINTENANCE_LEDGER_HEADERS_.length).getValues()[0];
  if (JSON.stringify(headers) !== JSON.stringify(MAINTENANCE_LEDGER_HEADERS_)) throw new Error('管理台帳の列が変わっています．');
  return sheet;
}
function maintenanceLedgerRecords_(sheet) {
  const definitions = maintenanceLedgerDefinitions_(), seen = new Set();
  if (sheet.getLastRow() > 10001) throw new Error('管理台帳の読み取り上限を超えています．記録を省略せず停止しました．');
  const data = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, MAINTENANCE_LEDGER_HEADERS_.length).getValues();
  return data.map(function (cells, index) {
    const definition = definitions.find(function (d) { return d.kind === cells[0]; });
    const key = String(cells[0]) + ':' + String(cells[1]);
    if (!definition || seen.has(key) || maintenanceLedgerHash_(cells[6]) !== cells[7]) throw new Error('管理台帳の種別・ID・内容ハッシュを確認してください．');
    seen.add(key);
    const row = maintenanceLedgerDecode_(String(cells[6]), definition.headers.length);
    const expected = maintenanceLedgerRecord_(definition.kind, row);
    if (expected.slice(0, 6).some(function (v, i) { return cells[i] !== v; })) throw new Error('管理台帳のID・保護状態が内容と一致しません．');
    return { kind: definition.kind, id: String(row[0]), row: row, hash: String(cells[7]), number: index + 2 };
  });
}
/** Legacy-compatible view. Physical row numbers are never retained for subsequent reads/writes. */
function maintenanceLedgerLegacySheet_(book, name, headers) {
  const definition = maintenanceLedgerDefinitions_().find(function (d) { return d.name === name; });
  if (!definition) return null;
  const physical = maintenanceLedgerPhysical_(book);
  if (!physical) return null;
  if (JSON.stringify(headers) !== JSON.stringify(definition.headers)) throw new Error('管理台帳の要求列が一致しません．');
  const snapshot = maintenanceLedgerRecords_(physical).filter(function (r) { return r.kind === definition.kind; });
  let physicalSize = physical.getLastRow();
  function current(id) {
    const record = maintenanceLedgerRecords_(physical).find(function (r) { return r.kind === definition.kind && r.id === id; });
    if (!record) throw new Error('管理台帳の記録IDが見つかりません．');
    return record;
  }
  const view = {
    _maintenanceLedgerActive: true,
    getName: function () { return name; }, getParent: function () { return book; },
    getLastRow: function () {
      if (physical.getLastRow() !== physicalSize) {
        const known = new Set(snapshot.map(function (r) { return r.id; }));
        maintenanceLedgerRecords_(physical).filter(function (r) { return r.kind === definition.kind && !known.has(r.id); })
          .forEach(function (r) { snapshot.push(r); });
        physicalSize = physical.getLastRow();
      }
      return snapshot.length + 1;
    },
    appendRow: function (input) {
      const row = input.map(maintenanceLedgerUnliteral_);
      const encoded = maintenanceLedgerRecord_(definition.kind, row);
      if (maintenanceLedgerRecords_(physical).some(function (r) { return r.kind === definition.kind && r.id === String(row[0]); })) throw new Error('同じ記録IDが既にあります．再送していません．');
      if (row.length !== headers.length) throw new Error('管理台帳の追加列数が不正です．');
      physical.appendRow(encoded.map(sheetLiteralValue_));
      const saved = current(String(row[0]));
      if (saved.hash !== encoded[7]) throw new Error('台帳の保存結果を確認できません．自動再送しません．');
      snapshot.push(saved);
      return view;
    },
    getRange: function (start, column, height, width) {
      height = height === undefined ? 1 : height; width = width === undefined ? 1 : width;
      if (![start, column, height, width].every(Number.isInteger) || start < 1 || column < 1 || height < 1 || width < 1 || column + width - 1 > headers.length || start + height - 1 > snapshot.length + 1) throw new Error('管理台帳の範囲が不正です．');
      const references = start === 1 ? [] : snapshot.slice(start - 2, start - 2 + height);
      function values() {
        if (start === 1) {
          if (height !== 1) throw new Error('管理台帳の見出しは単独で読み取ってください．');
          return [headers.slice(column - 1, column - 1 + width)];
        }
        const fresh = new Map(maintenanceLedgerRecords_(physical).filter(function (r) { return r.kind === definition.kind; }).map(function (r) { return [r.id, r]; }));
        return references.map(function (r) {
          if (!fresh.has(r.id)) throw new Error('管理台帳の記録IDが見つかりません．');
          return fresh.get(r.id).row.slice(column - 1, column - 1 + width);
        });
      }
      const range = {
        getValues: values, getValue: function () { return values()[0][0]; },
        setValues: function (input) {
          if (start === 1 || height !== 1 || !Array.isArray(input) || input.length !== 1 || input[0].length !== width) throw new Error('管理台帳はIDを指定した1記録ずつ更新してください．');
          const reference = references[0], fresh = current(reference.id);
          if (fresh.hash !== reference.hash) throw new Error('確認後に管理台帳が更新されました．上書き・再送していません．');
          const row = fresh.row.slice(); input[0].forEach(function (v, i) { row[column - 1 + i] = maintenanceLedgerUnliteral_(v); });
          if (String(row[0]) !== reference.id) throw new Error('記録IDは変更できません．');
          const encoded = maintenanceLedgerRecord_(definition.kind, row);
          // Resolve once more immediately before the write, allowing physical tab reordering.
          const target = current(reference.id);
          if (target.hash !== fresh.hash) throw new Error('保存前に管理台帳が更新されました．');
          physical.getRange(target.number, 1, 1, encoded.length).setValues([encoded.map(sheetLiteralValue_)]);
          const saved = current(reference.id);
          if (saved.hash !== encoded[7]) throw new Error('台帳の保存結果が不明です．自動再送しません．');
          reference.hash = saved.hash; reference.row = saved.row;
          return range;
        },
        setValue: function (value) { if (width !== 1) throw new Error('単一セルを指定してください．'); return range.setValues([[value]]); }
      };
      return range;
    }
  };
  return view;
}
function maintenanceLedgerUnliteral_(v) { return typeof v === 'string' && /^'[\s\u0000-\u001f]*[=+@-]/.test(v) ? v.slice(1) : v; }
function maintenanceLedgerOptionalSheet_(book, name, headers) {
  return maintenanceLedgerLegacySheet_(book, name, headers) || book.getSheetByName(name);
}
function maintenanceLedgerAssertCurrentView_(book, sheet) {
  if (Boolean(maintenanceLedgerPhysical_(book)) !== Boolean(sheet._maintenanceLedgerActive)) throw new Error('処理中に管理台帳の保存先が切り替わりました．APIや保存を再送せず，状態を確認してください．');
}
/** Reject writes from a request that started before activation and resumes afterwards. */
function maintenanceLedgerGuardLegacy_(book, sheet) {
  if (!maintenanceLedgerDefinitions_().some(function (d) { return d.name === sheet.getName(); })) return sheet;
  const guarded = { getName: function () { return sheet.getName(); }, getParent: function () { return book; },
    getLastRow: function () { return sheet.getLastRow(); },
    appendRow: function (row) { maintenanceLedgerAssertCurrentView_(book, guarded); sheet.appendRow(row); return guarded; },
    getRange: function (r, c, n, w) {
      const range = sheet.getRange(r, c, n === undefined ? 1 : n, w === undefined ? 1 : w);
      const wrapper = { getValues: function () { return range.getValues(); }, getValue: function () { return range.getValue(); },
        setValues: function (values) { maintenanceLedgerAssertCurrentView_(book, guarded); range.setValues(values); return wrapper; },
        setValue: function (value) { maintenanceLedgerAssertCurrentView_(book, guarded); range.setValue(value); return wrapper; } };
      return wrapper;
    } };
  return guarded;
}
function maintenanceLedgerReadLegacy_(book, definition) {
  const sheet = book.getSheetByName(definition.name);
  if (!sheet) throw new Error('移行元タブがありません：' + definition.name);
  if (sheet.getLastRow() > 10001) throw new Error('移行元の読み取り上限を超えています：' + definition.name);
  if (sheet.getLastColumn() > definition.headers.length) throw new Error('移行元に未対応の追加列があります：' + definition.name);
  const data = sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), definition.headers.length).getValues();
  if (JSON.stringify(data[0]) !== JSON.stringify(definition.headers)) throw new Error('移行元の列が一致しません：' + definition.name);
  const formulas = sheet.getRange(1, 1, data.length, definition.headers.length).getFormulas();
  if (formulas.some(function (r) { return r.some(Boolean); })) throw new Error('移行元に数式があります．値へ変換せず停止しました：' + definition.name);
  const rows = data.slice(1).filter(function (r) { return r.some(function (v) { return v !== ''; }); });
  const seen = new Set(); rows.forEach(function (r) {
    if (!String(r[0] || '').trim() || seen.has(String(r[0]))) throw new Error('移行元IDの空欄・重複があります：' + definition.name);
    seen.add(String(r[0]));
  });
  return { definition: definition, sheet: sheet, rows: rows, hash: maintenanceLedgerHash_(JSON.stringify(data.map(maintenanceLedgerEncode_))) };
}
function maintenanceLedgerData_(book) {
  const active = maintenanceLedgerPhysical_(book);
  if (active) return maintenanceLedgerRecords_(active);
  return maintenanceLedgerDefinitions_().reduce(function (records, d) {
    return records.concat(maintenanceLedgerReadLegacy_(book, d).rows.map(function (row) { return { kind: d.kind, id: String(row[0]), row: row, hash: maintenanceLedgerHash_(maintenanceLedgerEncode_(row)) }; }));
  }, []);
}
function maintenanceLedgerIssues_(book, records) {
  const observations = records.filter(function (r) { return r.kind === 'observation'; });
  const reviews = records.filter(function (r) { return r.kind === 'review'; });
  const candidates = records.filter(function (r) { return r.kind === 'candidate'; });
  const mapping = book.getSheetByName(EXPERIMENTAL_TERM_MAPPING_SHEET_NAME), notes = book.getSheetByName('Notes');
  if (!mapping || !notes) throw new Error('移送先のNotes・語形対応を確認できません．');
  const pairs = readSheetRows(mapping, 2), headwords = readSheetRows(notes, 1).map(function (r) { return normalizeObservedTerm(r[0]); });
  const issues = [], reviewIds = new Set(reviews.map(function (r) { return r.id; }));
  observations.forEach(function (o) {
    if (o.row[9] && !reviewIds.has(String(o.row[9]))) issues.push({ type: 'missing_review', id: o.id, term: o.row[1] });
    if (o.row[8] === 'Jev判定待ち') issues.push({ type: 'no_retry', id: o.id, term: o.row[1], blocksMigration: true });
  });
  reviews.forEach(function (r) {
    const linked = observations.filter(function (o) { return String(o.row[9]) === r.id; });
    if (!linked.length) issues.push({ type: 'unlinked_history', id: r.id, term: r.row[1] });
    if (linked.length > 1) issues.push({ type: 'ambiguous_link', id: r.id, term: r.row[1] });
    if (r.row[12] !== '採用' || !linked.some(function (o) { return o.row[8] === '候補移送済み'; })) return;
    const transferred = r.row[6] === 'NEW_TERM_CANDIDATE' ? candidates.some(function (c) {
      return String(c.row[14]) === r.id && !maintenanceLedgerExperimental_(c.row) &&
        (c.row[10] !== 'Notes反映済み' || headwords.filter(function (h) { return h === normalizeObservedTerm(c.row[16]); }).length === 1);
    }) : pairs.some(function (p) { return normalizeObservedTerm(p[0]) === normalizeObservedTerm(r.row[7]) && normalizeObservedTerm(p[1]) === normalizeObservedTerm(r.row[1]); });
    if (!transferred) issues.push({ type: 'transfer_mismatch', id: r.id, term: r.row[1] });
  });
  candidates.forEach(function (c) {
    if (maintenanceLedgerExperimental_(c.row)) issues.push({ type: 'experiment', id: c.id, term: c.row[1] });
    else if (c.row[14] && !reviewIds.has(String(c.row[14]))) issues.push({ type: 'missing_review', id: c.id, term: c.row[1] });
    if (['生成中', '結果要確認'].includes(c.row[12])) issues.push({ type: 'no_retry', id: c.id, term: c.row[1], blocksMigration: c.row[12] === '生成中' });
  });
  return issues;
}
function maintenanceLedgerAssertTransfer_(book, reviewId) {
  const ids = Array.isArray(reviewId) ? reviewId.map(String) : [String(reviewId)];
  if (maintenanceLedgerIssues_(book, maintenanceLedgerData_(book)).some(function (i) {
    return (ids.includes(i.id) && ['transfer_mismatch', 'ambiguous_link'].includes(i.type)) || i.type === 'missing_review';
  })) throw new Error('移送済み記録と現在の移送先が一致しません．再移送せず，人による照合を先に行ってください．');
}
function maintenanceLedgerHistory() {
  const book = SpreadsheetApp.getActiveSpreadsheet(), records = maintenanceLedgerData_(book);
  return { active: Boolean(maintenanceLedgerPhysical_(book)), issues: maintenanceLedgerIssues_(book, records),
    counts: maintenanceLedgerDefinitions_().map(function (d) { return { kind: d.kind, count: records.filter(function (r) { return r.kind === d.kind; }).length }; }),
    reviews: records.filter(function (r) { return r.kind === 'review'; }).map(function (r) {
      return { id: r.id, term: r.row[1], context: r.row[2], category: r.row[6], headword: r.row[7], candidates: r.row[11], decision: r.row[12], memo: r.row[13], hash: r.hash };
    }), candidates: records.filter(function (r) { return r.kind === 'candidate'; }).map(function (r) {
      return { id: r.id, term: r.row[1], status: r.row[10], draftStatus: r.row[12], draft: r.row[13], experimental: maintenanceLedgerExperimental_(r.row), review: r.row[26], memo: r.row[11] };
    }) };
}
/** Human review by immutable review ID, also for historical reviews with no observation. */
function maintenanceLedgerSaveReview(reviewId, expectedHash, decision, category, headword, memo) {
  if (!['採用', '保留', '却下'].includes(decision) || !Object.prototype.hasOwnProperty.call(JEV_CANDIDATE_CATEGORIES, category) || (decision === '採用' && category === 'UNCERTAIN')) throw new Error('採否・分類を確認してください．');
  const safeHeadword = ['NEW_TERM_CANDIDATE', 'UNCERTAIN'].includes(category) ? '' : candidateWizardSafeText(headword, '対応見出し', 120, true);
  const safeMemo = candidateWizardSafeText(memo, '確認メモ', 500, false), lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('判定の更新ロックを取得できませんでした．');
  try {
    const book = SpreadsheetApp.getActiveSpreadsheet(), records = maintenanceLedgerData_(book);
    const record = records.find(function (r) { return r.kind === 'review' && r.id === String(reviewId); });
    if (!record || record.hash !== expectedHash) throw new Error('確認後に判定が変わりました．保存していません．');
    if (records.some(function (r) { return r.kind === 'observation' && String(r.row[9]) === String(reviewId) && r.row[8] === '候補移送済み'; })) throw new Error('移送済みの判定は変更できません．移送先との照合を先に行ってください．');
    if (safeHeadword && !readSheetRows(book.getSheetByName('Notes'), 1).some(function (r) { return normalizeObservedTerm(r[0]) === normalizeObservedTerm(safeHeadword); })) throw new Error('対応見出しがNotesにありません．');
    const sheet = requireSheetWithHeaders(book, JEV_REVIEW_SHEET_NAME, JEV_REVIEW_HEADERS), found = candidateWizardFindLinked(sheet, JEV_REVIEW_HEADERS.length, String(reviewId));
    if (!found || maintenanceLedgerHash_(maintenanceLedgerEncode_(found.row)) !== expectedHash || found.row[4] !== 'Jev' || found.row[5] !== 'ADVISORY') throw new Error('保存前に判定の内容・経路が変わりました．保存していません．');
    const row = found.row.slice(), oldCategory = row[6];
    if (row[6] !== category) row[9] = '';
    if (row[7] !== safeHeadword) row[10] = '';
    row[6] = category; row[7] = safeHeadword;
    row[8] = safeHeadword ? 'term-' + normalizeObservedTerm(safeHeadword).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '';
    row[12] = decision; row[13] = (oldCategory !== category ? '人が分類を変更（Jev：' + oldCategory + '）．' : '') + safeMemo;
    sheet.getRange(found.rowNumber, 1, 1, row.length).setValues([row.map(sheetLiteralValue_)]);
    return { saved: reviewId };
  } finally { lock.releaseLock(); }
}
function showMaintenanceLedgerHistory() {
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('maintenance_ledger_dialog').setWidth(780).setHeight(720), '保守の判定・履歴');
}
