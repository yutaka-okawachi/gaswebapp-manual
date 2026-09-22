const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const frontendSource = fs.readFileSync(
  path.join(root, 'frontend', 'state-and-notifications.js'),
  'utf8'
);
const gasSource = fs.readFileSync(path.join(root, 'src', 'web_trigger.js'), 'utf8');

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0, `開始位置がありません: ${startMarker}`);
  assert.ok(end > start, `終了位置がありません: ${endMarker}`);
  return source.slice(start, end);
}

async function testFrontendObservation() {
  const requests = [];
  const context = {
    console,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return {};
    },
    GAS_NOTIFICATION_URL: 'https://example.test/gas',
    dictionaryTermIndexKey: value => String(value || '').trim().toLowerCase(),
    getDictionaryTermResolution: () => null,
    window: {
      __LOCAL_PREVIEW__: false,
      isAdminDeviceOptOut: () => false,
      crypto: { randomUUID: () => '12345678-1234-1234-1234-123456789abc' }
    }
  };
  vm.createContext(context);
  vm.runInContext(
    sourceBetween(
      frontendSource,
      'function shouldObserveUnregisteredResultTermSearch',
      'function escapeRegExpLiteral'
    ),
    context
  );

  assert.strictEqual(context.window.shouldObserveUnregisteredResultTermSearch({
    searchTerm: 'zartfließend', resultCount: 3, termsIndex: {}
  }), true);
  assert.strictEqual(context.window.shouldObserveUnregisteredResultTermSearch({
    searchTerm: 'zartfließend', resultCount: 0, termsIndex: {}
  }), false);
  assert.strictEqual(context.window.shouldObserveUnregisteredResultTermSearch({
    searchTerm: 'markieren', resultCount: 2, termsIndex: { markieren: 'term-markieren' }
  }), false);

  context.getDictionaryTermResolution = () => ({ type: '誤入力', category: 'TYPO' });
  assert.strictEqual(context.window.shouldObserveUnregisteredResultTermSearch({
    searchTerm: 'markiren', resultCount: 2, termsIndex: {}
  }), false);

  context.getDictionaryTermResolution = () => null;
  assert.strictEqual(await context.window.observeUnregisteredResultTermSearch({
    searchTerm: ' zartfließend ', resultCount: 3, termsIndex: {}
  }, 'terms_search.html'), true);
  assert.strictEqual(requests.length, 1);
  const payload = JSON.parse(requests[0].options.body);
  assert.deepStrictEqual(payload, {
    action: 'observe_unregistered_result_term',
    term: 'zartfließend',
    page: 'terms_search.html',
    resultCount: 3,
    eventId: '12345678-1234-1234-1234-123456789abc'
  });
  assert.strictEqual(Object.prototype.hasOwnProperty.call(payload, 'userAgent'), false);

  context.window.isAdminDeviceOptOut = () => true;
  assert.strictEqual(await context.window.observeUnregisteredResultTermSearch({
    searchTerm: 'neu', resultCount: 1, termsIndex: {}
  }, 'terms_search.html'), false);
  assert.strictEqual(requests.length, 1);
}

function testGasObservationHelpers() {
  class FakeRange {
    constructor(sheet, row, column, rowCount, columnCount) {
      this.sheet = sheet;
      this.row = row;
      this.column = column;
      this.rowCount = rowCount;
      this.columnCount = columnCount;
    }
    getValues() {
      return Array.from({ length: this.rowCount }, (_unused, rowOffset) =>
        Array.from({ length: this.columnCount }, (_unusedColumn, columnOffset) =>
          (this.sheet.rows[this.row - 1 + rowOffset] || [])[this.column - 1 + columnOffset] ?? ''
        )
      );
    }
    setValues(values) {
      values.forEach((sourceRow, rowOffset) => {
        const targetIndex = this.row - 1 + rowOffset;
        if (!this.sheet.rows[targetIndex]) this.sheet.rows[targetIndex] = [];
        sourceRow.forEach((value, columnOffset) => {
          this.sheet.rows[targetIndex][this.column - 1 + columnOffset] = value;
        });
      });
    }
  }
  class FakeSheet {
    constructor(rows) {
      this.rows = rows.map(row => row.slice());
    }
    getRange(row, column, rowCount, columnCount) {
      return new FakeRange(this, row, column, rowCount, columnCount);
    }
    getLastRow() {
      return this.rows.length;
    }
    appendRow(row) {
      this.rows.push(row.slice());
    }
  }

  const observationHeaders = [
    '観測ID', '検索語', '正規化語形', '初回検索日時', '最終検索日時',
    '検索回数', '検索ページ', '最大検索結果件数', '処理状態', 'Jev判定ID', '備考'
  ];
  const candidateHeaders = [
    '候補ID', '検索語', '正規化語形', '初回検索日時', '最終検索日時',
    '検索回数', '検索ページ', 'Jev判定', '分類確信度', '類似する既存語候補',
    '状態', '管理者メモ', 'GPT草案状態', 'GPT草案', '元判定ID', '更新日時',
    '草案基本形', '草案品詞', '草案語形・変化形', '草案訳語', '草案説明', '草案分類',
    '草案類似語', '草案備考', 'GPT生成日時', 'GPTモデル', '草案確認', '草案修正メモ'
  ];
  const reviewHeaders = [
    '判定ID', '入力語形', '文脈', '正規化語形', '判定経路', '処理状態',
    '分類', '対応見出し', '対応見出しID', '分類確信度', '対応確信度',
    '候補一覧', '人による確認', '確認メモ', '生成日時'
  ];
  const firstSeen = new Date('2026-09-21T00:00:00Z');
  const lastSeen = new Date('2026-09-22T00:00:00Z');
  const sheets = {
    '検索結果未登録語_正規化テスト': new FakeSheet([
      observationHeaders,
      ['observation-test', 'zartfließend', 'zartfliessend', firstSeen, lastSeen, 3, '用語から検索 (GM)', 2, '未判定', '', '']
    ]),
    '未登録語候補_正規化テスト': new FakeSheet([candidateHeaders]),
    'Jev判定_正規化テスト': new FakeSheet([
      reviewHeaders,
      ['unknown-term', 'zartfließend', '', 'zartfliessend', 'Jev', 'ADVISORY', 'NEW_TERM_CANDIDATE', '', '', 0.89, 0.8, 'candidate_1: markieren', '採用', '', '2026-09-22T00:00:00Z']
    ])
  };
  const spreadsheet = { getSheetByName: name => sheets[name] || null };
  const cacheValues = new Map();
  const context = {
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => 'test-secret' })
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (_algorithm, value) => Array.from(crypto.createHash('sha256').update(value).digest())
        .map(byte => byte > 127 ? byte - 256 : byte)
    },
    Object,
    String,
    Number,
    Error,
    Map,
    Set,
    Date,
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    CacheService: {
      getScriptCache: () => ({
        get: key => cacheValues.get(key) || null,
        put: (key, value) => cacheValues.set(key, value)
      })
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock: () => undefined })
    }
  };
  context.ALLOWED_UNREGISTERED_RESULT_TERM_PAGES = Object.freeze([
    'terms_search.html', 'rs_terms_search.html', 'rw_terms_search.html'
  ]);
  context.UNREGISTERED_RESULT_TERM_SHEET_NAME = '検索結果未登録語_正規化テスト';
  context.UNREGISTERED_TERM_CANDIDATE_SHEET_NAME = '未登録語候補_正規化テスト';
  context.JEV_REVIEW_SHEET_NAME = 'Jev判定_正規化テスト';
  context.UNREGISTERED_RESULT_TERM_HEADERS = observationHeaders;
  context.UNREGISTERED_TERM_CANDIDATE_HEADERS = candidateHeaders;
  context.pageNameMap = {
    'terms_search.html': '用語から検索 (GM)',
    'rs_terms_search.html': '用語から検索 (RS)',
    'rw_terms_search.html': '用語から検索 (RW)'
  };
  vm.createContext(context);
  const helpers = sourceBetween(
    gasSource,
    'function normalizeObservedTerm',
    '/**\n * 検索通知ハンドラー'
  );
  vm.runInContext(`${helpers}\nthis.testExports = {\n` +
    'normalizeObservedTerm, sanitizeUnregisteredResultTermObservation, mergeObservationPages, termRecordId, recordUnregisteredResultTermObservation, promoteApprovedNewTermCandidates\n' +
    '};', context);

  const api = context.testExports;
  assert.strictEqual(api.normalizeObservedTerm(' Zartfließend  und Ruhig '), 'zartfliessend und ruhig');
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(api.sanitizeUnregisteredResultTermObservation({
      term: ' zartfließend ', page: 'terms_search.html', resultCount: 3,
      eventId: '12345678-1234-1234-1234-123456789abc'
    }))),
    {
      term: 'zartfließend', normalized: 'zartfliessend', page: 'terms_search.html',
      resultCount: 3, eventId: '12345678-1234-1234-1234-123456789abc'
    }
  );
  assert.throws(() => api.sanitizeUnregisteredResultTermObservation({
    term: 'neu', page: 'mahler.html', resultCount: 2,
    eventId: '12345678-1234-1234-1234-123456789abc'
  }), /対象外の検索ページ/);
  assert.throws(() => api.sanitizeUnregisteredResultTermObservation({
    term: 'neu', page: 'terms_search.html', resultCount: 0,
    eventId: '12345678-1234-1234-1234-123456789abc'
  }), /1件以上/);
  assert.throws(() => api.sanitizeUnregisteredResultTermObservation({
    term: 'x'.repeat(121), page: 'terms_search.html', resultCount: 1,
    eventId: '12345678-1234-1234-1234-123456789abc'
  }), /長すぎます/);
  assert.throws(() => api.sanitizeUnregisteredResultTermObservation({
    term: 'neu', page: 'terms_search.html', resultCount: 1,
    eventId: 'invalid id'
  }), /イベントIDが不正/);
  assert.strictEqual(api.mergeObservationPages('用語から検索 (GM)', '用語から検索 (RS)'), '用語から検索 (GM)，用語から検索 (RS)');
  assert.strictEqual(api.mergeObservationPages('用語から検索 (GM)', '用語から検索 (GM)'), '用語から検索 (GM)');
  assert.match(api.termRecordId('candidate', 'zartfliessend'), /^candidate-[a-f0-9]{24}$/);

  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(api.recordUnregisteredResultTermObservation({
      term: 'zartfließend', normalized: 'zartfliessend', page: 'rs_terms_search.html',
      resultCount: 5,
      eventId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    }))),
    { recorded: true, duplicate: false }
  );
  assert.strictEqual(sheets['検索結果未登録語_正規化テスト'].rows[1][5], 4);
  assert.strictEqual(
    sheets['検索結果未登録語_正規化テスト'].rows[1][6],
    '用語から検索 (GM)，用語から検索 (RS)'
  );
  assert.strictEqual(sheets['検索結果未登録語_正規化テスト'].rows[1][7], 5);
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(api.recordUnregisteredResultTermObservation({
      term: 'zartfließend', normalized: 'zartfliessend', page: 'rs_terms_search.html',
      resultCount: 5,
      eventId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    }))),
    { recorded: false, duplicate: true }
  );
  assert.strictEqual(sheets['検索結果未登録語_正規化テスト'].rows[1][5], 4);

  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(api.promoteApprovedNewTermCandidates())),
    { inserted: 1, updated: 0, skipped: 0 }
  );
  assert.strictEqual(sheets['未登録語候補_正規化テスト'].rows.length, 2);
  assert.strictEqual(sheets['未登録語候補_正規化テスト'].rows[1][1], 'zartfließend');
  assert.strictEqual(sheets['未登録語候補_正規化テスト'].rows[1][7], 'NEW_TERM_CANDIDATE');
  assert.strictEqual(sheets['未登録語候補_正規化テスト'].rows[1][10], '候補');
  assert.strictEqual(sheets['未登録語候補_正規化テスト'].rows[1][12], '未作成');
  assert.strictEqual(sheets['未登録語候補_正規化テスト'].rows[1][26], '未確認');
  assert.strictEqual(sheets['未登録語候補_正規化テスト'].rows[1].length, 28);
  assert.strictEqual(sheets['検索結果未登録語_正規化テスト'].rows[1][8], '候補移送済み');
  assert.strictEqual(sheets['検索結果未登録語_正規化テスト'].rows[1][9], 'unknown-term');
}

function testWiring() {
  for (const page of ['terms_search.html', 'rs_terms_search.html', 'rw_terms_search.html']) {
    const source = fs.readFileSync(path.join(root, 'mahler-search-app', page), 'utf8');
    assert.ok(source.includes('window.observeUnregisteredResultTermSearch({'));
    assert.ok(source.includes('resultCount: resultMeta.resultCount'));
    assert.ok(source.includes('termsIndex: window.appData.dic_terms_index'));
  }
  assert.ok(gasSource.includes("data.action === 'observe_unregistered_result_term'"));
  assert.ok(gasSource.includes("action === 'promoteApprovedNewTermCandidates'"));
  const publicHandler = sourceBetween(
    gasSource,
    'function handleUnregisteredResultTermObservation',
    'function recordUnregisteredResultTermObservation'
  );
  assert.strictEqual(publicHandler.includes('MailApp'), false);
  assert.strictEqual(publicHandler.includes("getSheetByName('検索履歴')"), false);
}

Promise.resolve()
  .then(testFrontendObservation)
  .then(testGasObservationHelpers)
  .then(testWiring)
  .then(() => console.log('未登録語候補のテストに成功しました。'))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
