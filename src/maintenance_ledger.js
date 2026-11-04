/** One private ledger; legacy tabs remain intact until backup verification and activation. */
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
/** Fingerprint every validation, including empty future-entry cells. Never rewrite a rule. */
function maintenanceLedgerValidation_(sheet) {
  const rows = sheet.getMaxRows(), columns = sheet.getMaxColumns();
  if (![rows, columns].every(Number.isSafeInteger) || rows < 1 || columns < 1 || rows * columns > 1000000) throw new Error('入力規則の照合範囲を確認できません．');
  function argument(value) {
    if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (Object.prototype.toString.call(value) === '[object Date]' && Number.isFinite(value.getTime())) return { date: value.toISOString() };
    if (Array.isArray(value)) return value.map(argument);
    if (value && typeof value.getSheet === 'function' && typeof value.getA1Notation === 'function') {
      const source = value.getSheet();
      return { book: source.getParent().getId(), sheet: source.getSheetId() === sheet.getSheetId() ? 'self' : source.getSheetId(), range: value.getA1Notation() };
    }
    throw new Error('入力規則の条件を照合できません．');
  }
  const rules = sheet.getRange(1, 1, rows, columns).getDataValidations(), entries = [];
  if (rules.length !== rows || rules.some(function (row) { return row.length !== columns; })) throw new Error('入力規則の読取範囲が一致しません．');
  rules.forEach(function (row, r) {
    row.forEach(function (rule, c) {
      if (!rule) return;
      entries.push([r + 1, c + 1, String(rule.getCriteriaType()), rule.getCriteriaValues().map(argument), rule.getAllowInvalid(), rule.getHelpText() || '']);
    });
  });
  return { rows: rows, columns: columns, count: entries.length, hash: maintenanceLedgerHash_(JSON.stringify(entries)) };
}
function maintenanceLedgerSameValidation_(left, right) {
  return Boolean(left && right && left.rows === right.rows && left.columns === right.columns && left.count === right.count && left.hash === right.hash);
}

function maintenanceLedgerMigrationPlan_(book) {
  const sources = maintenanceLedgerDefinitions_().map(function (d) { return maintenanceLedgerReadLegacy_(book, d); });
  const records = sources.reduce(function (all, s) { return all.concat(s.rows.map(function (r) { return maintenanceLedgerRecord_(s.definition.kind, r); })); }, []);
  if (records.length > 10000) throw new Error('統合後の記録数が上限を超えます．移行していません．');
  const data = records.map(function (r) { const d = maintenanceLedgerDefinitions_().find(function (v) { return v.kind === r[0]; }); return { kind: r[0], id: r[1], row: maintenanceLedgerDecode_(r[6], d.headers.length), hash: r[7] }; });
  const issues = maintenanceLedgerIssues_(book, data);
  if (issues.some(function (i) { return ['missing_review', 'ambiguous_link'].includes(i.type); })) throw new Error('記録IDの参照切れ・重複があります．移行せず修復案を確認してください．');
  const summary = sources.map(function (s) {
    s.validation = maintenanceLedgerValidation_(s.sheet);
    return { kind: s.definition.kind, sheet: s.sheet.getSheetId(), count: s.rows.length, hash: s.hash, validation: s.validation };
  });
  const plan = { version: 1, book: book.getId(), sources: summary, issues: issues,
    pendingObservations: data.filter(function (r) { return r.kind === 'observation' && r.row[8] === '未判定'; }).length };
  return { hash: maintenanceLedgerHash_(JSON.stringify(plan)), plan: plan, records: records, sources: sources };
}
/** Read only. Review this hash/counts/issues before separately authorizing migration. */
function maintenanceLedgerPlanMigration() {
  const prepared = maintenanceLedgerMigrationPlan_(SpreadsheetApp.getActiveSpreadsheet());
  return { planHash: prepared.hash, plan: prepared.plan };
}
/** Never invokes paid APIs, Notes registration, export, tab deletion, or automatic retries. */
function maintenanceLedgerMigrate(expectedPlanHash, confirmed) {
  if (confirmed !== true || !/^[a-f0-9]{64}$/.test(String(expectedPlanHash || ''))) throw new Error('確認した移行計画と明示承認が必要です．');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('移行ロックを取得できませんでした．');
  try {
    const book = SpreadsheetApp.getActiveSpreadsheet(), properties = PropertiesService.getScriptProperties();
    const active = maintenanceLedgerPhysical_(book);
    if (active) {
      maintenanceLedgerRecords_(active);
      const receipt = JSON.parse(properties.getProperty(MAINTENANCE_LEDGER_ACTIVE_));
      if (receipt.planHash !== expectedPlanHash) throw new Error('別の移行計画で有効化されています．');
      return { status: 'already_active', receipt: receipt };
    }
    if (book.getSheetByName(MAINTENANCE_LEDGER_NAME_)) throw new Error('未完了の管理台帳があります．旧台帳は維持しています．状態を調査するまで再移行しません．');
    const prepared = maintenanceLedgerMigrationPlan_(book);
    if (prepared.hash !== expectedPlanHash) throw new Error('計画確認後に元データ・移送先が変わりました．移行していません．');
    if (prepared.plan.issues.some(function (i) { return i.blocksMigration; })) throw new Error('旧台帳にAPI実行中または結果不明の記録があります．利用状況・保存結果を確認するまで移行・再送しません．');
    // Create the staging marker before copying: any interruption is visible and blocks blind retries.
    const target = book.insertSheet(MAINTENANCE_LEDGER_NAME_);
    target.getRange(1, 1, 1, MAINTENANCE_LEDGER_HEADERS_.length).setValues([MAINTENANCE_LEDGER_HEADERS_]);
    const backups = [];
    prepared.sources.forEach(function (s) {
      const copied = s.sheet.copyTo(book);
      copied.setName('保守控_' + s.definition.kind + '_' + copied.getSheetId());
      const definition = { kind: s.definition.kind, name: copied.getName(), headers: s.definition.headers };
      if (maintenanceLedgerReadLegacy_(book, definition).hash !== s.hash) throw new Error('バックアップの照合に失敗しました．旧台帳は維持しています．');
      const validation = maintenanceLedgerValidation_(copied);
      if (!maintenanceLedgerSameValidation_(s.validation, validation)) throw new Error('バックアップの入力規則が一致しません．有効化せず，元タブを維持しています．');
      copied.hideSheet(); backups.push({ name: copied.getName(), sheet: copied.getSheetId(), kind: s.definition.kind, hash: s.hash, validation: validation });
    });
    if (prepared.records.length + 1 > target.getMaxRows()) target.insertRowsAfter(target.getMaxRows(), prepared.records.length + 1 - target.getMaxRows());
    if (prepared.records.length) target.getRange(2, 1, prepared.records.length, MAINTENANCE_LEDGER_HEADERS_.length).setValues(prepared.records.map(function (r) { return r.map(sheetLiteralValue_); }));
    SpreadsheetApp.flush();
    const saved = maintenanceLedgerRecords_(target);
    if (saved.length !== prepared.records.length || saved.some(function (r, i) { return r.kind !== prepared.records[i][0] || r.id !== prepared.records[i][1] || r.hash !== prepared.records[i][7]; })) throw new Error('移行後の全件照合に失敗しました．有効化していません．');
    if (maintenanceLedgerMigrationPlan_(book).hash !== expectedPlanHash) throw new Error('移行中に元データが変わりました．有効化していません．');
    const receipt = { version: 1, book: book.getId(), sheet: target.getSheetId(), planHash: prepared.hash, backups: backups, sources: prepared.plan.sources, activatedAt: new Date().toISOString() };
    properties.setProperty(MAINTENANCE_LEDGER_ACTIVE_, JSON.stringify(receipt));
    // A failed activation result must be inspected; a retry only verifies this same receipt.
    maintenanceLedgerPhysical_(book);
    return { status: 'activated', receipt: receipt, issues: prepared.plan.issues };
  } finally { lock.releaseLock(); }
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

/** Owner-operated bound-sheet confirmation. Never exposed as an execution-API fallback. */
function confirmMaintenanceLedgerMigrationFromSheet() {
  const book = rowCompletionBook_(), ui = SpreadsheetApp.getUi();
  try {
    const active = maintenanceLedgerPhysical_(book);
    if (active) {
      maintenanceLedgerRecords_(active);
      ui.alert('管理台帳は有効化済みです．', '「保守の判定・履歴を確認」で現在の記録を確認してください．移行を重ねて実行していません．', ui.ButtonSet.OK);
      return { status: 'already_active' };
    }
    if (book.getSheetByName(MAINTENANCE_LEDGER_NAME_)) {
      ui.alert('未完了の管理台帳があります．', '旧台帳は維持しています．保存状態を照合するまで移行を繰り返さないでください．', ui.ButtonSet.OK);
      return { status: 'unfinished' };
    }
    const prepared = maintenanceLedgerPlanMigration(), plan = prepared.plan;
    const history = maintenanceLedgerHistory();
    if (plan.book !== book.getId()) throw new Error('登録済みデータ元と移行計画が一致しません．');
    if (plan.issues.some(function (i) { return i.blocksMigration; })) {
      ui.alert('移行を開始していません．', '実行中または結果不明の記録があります．利用状況と保存結果を確認してください．APIを再送していません．', ui.ButtonSet.OK);
      return { status: 'blocked' };
    }
    const labels = { observation: '観測', review: '判定', candidate: '旧候補' };
    const issueLabels = { unlinked_history: '未連結の履歴を保持', transfer_mismatch: '移送先と不一致・再移送を停止', experiment: '実験草案・本番登録禁止', no_retry: '結果要確認・再送禁止' };
    const pending = history.reviews.filter(function (r) { return ['未確認', '保留'].includes(r.decision); });
    const text = '対象：' + book.getName() + '\n' + plan.sources.map(function (s) { return labels[s.kind] + ' ' + s.count + '件（入力規則' + s.validation.count + 'セル）'; }).join('／') +
      '\n計画ID：' + prepared.planHash + '\n未判定の観測：' + plan.pendingObservations + '件\n\n保留・未確認の採否，原文と草案全文を保持します．\n' + pending.map(function (r) { return r.term + '：' + r.decision; }).join('\n') +
      '\n' + plan.issues.map(function (i) { return i.term + '：' + (issueLabels[i.type] || i.type); }).join('\n') +
      '\n\n移行中は元3タブを直接編集・並べ替えしないでください．元3タブを複製し，値・日付・入力規則を照合してから，全記録のID・内容が一致した管理台帳を有効化します．元タブは残します．\nJev・OpenAIの実行，Notes登録，サイト同期，タブ削除は行いません．\n\nこの計画で移行を開始しますか？';
    // No lock is held across the user prompt. The backend rechecks this exact plan under lock.
    if (ui.alert('バックアップ付きの管理台帳移行', text, ui.ButtonSet.YES_NO) !== ui.Button.YES) return { status: 'cancelled' };
    if (rowCompletionBook_().getId() !== book.getId()) throw new Error('確認後に対象データ元が変わりました．');
    const result = maintenanceLedgerMigrate(prepared.planHash, true);
    const state = maintenanceLedgerHistory();
    if (!state.active) throw new Error('有効化の確認結果が一致しません．再実行せず保存状態を確認してください．');
    ui.alert('管理台帳への切替を確認しました．', state.counts.map(function (c) { return labels[c.kind] + ' ' + c.count + '件'; }).join('／') +
      '\n元3タブとバックアップを保持しています．「保守の判定・履歴を確認」で未確認・保留・不一致・実験草案を確認してください．', ui.ButtonSet.OK);
    return { status: result.status, active: true };
  } catch (error) {
    ui.alert('移行を自動で再試行しません．', String(error && error.message || error).slice(0, 500) +
      '\n元タブと保存状態を確認してください．完了が確認できるまで，再度の移行や台帳削除は行わないでください．', ui.ButtonSet.OK);
    throw error;
  }
}
