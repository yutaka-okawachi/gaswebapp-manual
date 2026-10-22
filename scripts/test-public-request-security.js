'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const dashboardToken = 'synthetic-dashboard-read-only-token';
let count = 0;
function test(name, fn) { fn(); count++; }
function sandbox() {
  let now = Date.UTC(2026, 9, 22, 3), held = false, quota = 100, failBudget = false, failSheet = false;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const props = new Map([['GAS_SECRET_TOKEN', 'synthetic-admin-token'], ['DASHBOARD_API_TOKEN', dashboardToken], ['NOTIFY_EMAIL', 'owner@example.invalid']]);
  const cache = new Map(), mails = [], logs = [], writes = [];
  const literal = value => typeof value === 'string' && value.startsWith("'") ? value.slice(1) : value;
  function sheet(headers) {
    const rows = [headers];
    const write = row => {
      if (failSheet) throw Error('synthetic sheet failure');
      // Inspect the actual argument supplied to Sheets; emulate literal text reads.
      assert(!row.some(value => typeof value === 'string' && value.startsWith('=')), 'Unescaped formula reached Sheets');
      writes.push(Array.from(row)); return Array.from(row, literal);
    };
    return { rows, getLastRow: () => rows.length, getLastColumn: () => headers.length,
      getRange: (r, c, n = 1, m = 1) => ({
        getValues: () => Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => rows[r - 1 + i]?.[c - 1 + j] ?? '')),
        setValues: values => values.forEach((row, i) => { const values = write(row); values.forEach((v, j) => { rows[r - 1 + i][c - 1 + j] = v; }); })
      }), appendRow: row => rows.push(write(row)) };
  }
  const history = sheet(['日時', 'Work', 'Page', 'Term', 'Instruments', 'Global', 'Szene', 'Whom', 'Page_Num', 'UserAgent', '詳細', 'Language']);
  const observation = sheet(['観測ID', '検索語', '正規化語形', '初回検索日時', '最終検索日時', '検索回数', '検索ページ', '最大検索結果件数', '処理状態', 'Jev判定ID', '備考']);
  const c = vm.createContext({ Date: Clock, URL, JSON, Number, Logger: { log: value => logs.push(value) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key) || null,
      setProperty: (key, value) => { assert(held, 'Budget update requires script lock'); if (failBudget) throw Error('budget unavailable'); props.set(key, value); } }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: name => name === '検索履歴' ? history : observation }) },
    MailApp: { getRemainingDailyQuota: () => quota, sendEmail: (...args) => { assert(held); mails.push(args); } },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (_, value) => [...crypto.createHash('sha256').update(value).digest()], formatDate: () => 'synthetic-time' },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key) || null, put: (key, value) => cache.set(key, value), remove: key => cache.delete(key) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => { assert(!held); held = true; return true; }, releaseLock: () => { held = false; } }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
  });
  for (const file of ['sheet_column_layout', 'mahler_server', 'web_trigger', 'dictionary_candidate_workflow', 'dashboard_analytics']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'src', file + '.js'), 'utf8'), c);
  }
  const post = data => JSON.parse(c.doPost({ postData: { contents: JSON.stringify(data) } }).text);
  const send = data => post({ work: 'All (GM)', page: 'terms_search.html', scope: 'Term', term: 'langsam', userAgent: 'MockAgent', ...data });
  const observe = data => post({ action: 'observe_unregistered_result_term', term: 'Geistern', page: 'terms_search.html', resultCount: 2, eventId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', ...data });
  const reserve = kind => { held = true; try { return c.consumePublicRequestBudget_(kind); } finally { held = false; } };
  return { c, props, cache, history, observation, mails, logs, writes, post, send, observe, reserve,
    advance: ms => { now += ms; cache.clear(); }, setQuota: value => { quota = value; },
    failBudget: () => { failBudget = true; }, failSheet: value => { failSheet = value; } };
}

test('All external history fields are stored literally while the original text is preserved', () => {
  for (const language of ['ja', 'en']) {
    const s = sandbox();
    assert.equal(s.send({ language, term: '=1+1', work: '=2+2', userAgent: '=3+3' }).status, 'success');
    assert.equal(s.history.rows[1][1], '=2+2'); assert.equal(s.history.rows[1][3], '=1+1'); assert.equal(s.history.rows[1][9], '=3+3');
    assert.equal(s.writes[0][3], "'=1+1");
    assert.equal(s.send({ language, term: 'Whom Search', scope: '=4+4' }).status, 'success');
    assert.equal(s.history.rows[2][7], '=4+4');
  }
});
test('Formula-like text stays literal through observation creation, update and candidate promotion', () => {
  const s = sandbox(); assert.equal(s.observe({ term: '=1+1' }).recorded, true);
  assert.equal(s.observation.rows[1][1], '=1+1'); assert.equal(s.writes[0][1], "'=1+1");
  assert.equal(s.observe({ term: '=1+1', eventId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' }).recorded, true);
  assert.equal(s.observation.rows[1][5], 2);
  const review = ['jev-synthetic', '=1+1', '', '=1+1', '', '', 'NEW_TERM_CANDIDATE', '', '', 0.8, 0.9, '', '採用'];
  const destination = { appendRow: row => { assert.equal(row[1], "'=1+1"); assert.equal(row[2], "'=1+1"); }, getLastRow: () => 2 };
  assert.equal(s.c.appendApprovedNewTermCandidate(review, new Map([['=1+1', { row: s.observation.rows[1], sheet: s.observation, sheetRow: 2 }]]), destination, new Map()), 'inserted');
  for (const value of ['=1', ' \t=1', '+1', '-1', '@x']) assert.equal(s.c.sheetLiteralValue_(value), "'" + value);
  for (const value of ['langsam', "'=1", 0, false, null]) assert.equal(s.c.sheetLiteralValue_(value), value);
});
test('Changing User-Agent cannot bypass duplicate suppression; different legitimate searches still pass', () => {
  const s = sandbox(); s.send({}); s.send({ userAgent: 'Changed' }); assert.equal(s.history.rows.length, 2); assert.equal(s.mails.length, 1);
  s.cache.clear(); s.send({ userAgent: 'Changed again' }); assert.equal(s.history.rows.length, 2);
  s.send({ term: 'schnell' }); s.send({ language: 'en' }); assert.equal(s.history.rows.length, 4);
});
test('Global notification burst cap survives cache eviction and changing terms and User-Agents', () => {
  const s = sandbox();
  for (let i = 0; i < 30; i++) { s.cache.clear(); assert.equal(s.send({ term: 'term' + i, userAgent: 'UA' + i }).status, 'success'); }
  assert.equal(s.history.rows.length, 31); assert.equal(s.mails.length, 10);
  assert.equal(s.send({ term: 'over-limit' }).limited, true); assert.equal(s.history.rows.length, 31);
  s.advance(60000); s.send({ term: 'next-minute' }); assert.equal(s.history.rows.length, 32);
});
test('Observation budget does not trust a fresh event ID and is independent of notifications', () => {
  const s = sandbox();
  for (let i = 0; i < 30; i++) assert.equal(s.observe({ term: 'word' + i, eventId: i.toString(16).padStart(32, '0') }).recorded, true);
  assert.equal(s.observe({ term: 'extra' }).limited, true); assert.equal(s.observation.rows.length, 31);
  s.send({}); assert.equal(s.history.rows.length, 2);
});
test('Persistent daily caps survive minute changes and reset on the next JST day', () => {
  for (const [kind, maximum] of [['notification', 3000], ['observation', 3000], ['mail', 80]]) {
    const s = sandbox();
    for (let i = 0; i < maximum; i++) { if (i % (kind === 'mail' ? 10 : 30) === 0) s.advance(60000); assert.equal(s.reserve(kind), true); }
    s.advance(60000); assert.equal(s.reserve(kind), false);
    s.advance(86400000); assert.equal(s.reserve(kind), true);
  }
});
test('Mail quota reserve suppresses only mail; writes remain available and failed history never sends mail', () => {
  const s = sandbox(); s.setQuota(10); s.send({}); assert.equal(s.mails.length, 0); assert.equal(s.history.rows.length, 2);
  s.setQuota(11); s.send({ term: 'another' }); assert.equal(s.mails.length, 1);
  const failed = sandbox(); failed.failSheet(true); assert.equal(failed.send({}).status, 'error'); assert.equal(failed.mails.length, 0);
  failed.failSheet(false); assert.equal(failed.send({}).status, 'success'); assert.equal(failed.mails.length, 1);
});
test('Unavailable or corrupt durable counters fail closed before Sheets or mail', () => {
  for (const corrupt of [false, true]) {
    const s = sandbox(); if (corrupt) s.props.set('public_request_budget_v1_notification', '{broken'); else s.failBudget();
    assert.equal(s.send({}).status, 'error'); assert.equal(s.history.rows.length, 1); assert.equal(s.mails.length, 0);
  }
});
test('Dashboard denies GET, URL credentials, missing/wrong/admin tokens and absent configuration before touching GA4', () => {
  const s = sandbox(); let calls = 0;
  s.c.getDashboardAnalytics = (period, language) => { calls++; return { schemaVersion: 9, period, selectedLanguage: language }; };
  for (const params of [{}, { token: 'synthetic-admin-token' }, { dashboardToken: 'wrong' }, { dashboardToken: {} }]) {
    assert.equal(s.post({ api: 'dashboard', period: 7, ...params }).error.code, 'UNAUTHORIZED');
  }
  assert.equal(JSON.parse(s.c.doGet({ parameter: { api: 'dashboard', period: '7', dashboardToken } }).text).error.code, 'UNAUTHORIZED');
  assert.equal(calls, 0);
  for (const period of [7, 30, 90, 180]) for (const language of ['all', 'ja', 'en']) {
    const response = s.post({ api: 'dashboard', period, language, dashboardToken }); assert.equal(response.period, period); assert.equal(response.selectedLanguage, language);
  }
  assert.equal(calls, 12);
  s.props.delete('DASHBOARD_API_TOKEN'); assert.equal(s.post({ api: 'dashboard', period: 7, dashboardToken }).error.code, 'UNAUTHORIZED'); assert.equal(calls, 12);
});
test('Malformed public bodies and observation types have no side effects or payload logging', () => {
  const s = sandbox();
  for (const contents of ['null', '[]', '{"private-secret":', 'x'.repeat(24001)]) assert.equal(JSON.parse(s.c.doPost({ postData: { contents } }).text).status, 'error');
  for (const data of [{ term: {} }, { resultCount: '2' }, { eventId: {} }]) assert.equal(s.observe(data).status, 'error');
  assert.equal(s.writes.length, 0); assert(!s.logs.join('\n').includes('private-secret'));
});
console.log('Public request security: ' + count + ' groups passed (mock Sheets/Mail/GA4 only; no external writes).');
