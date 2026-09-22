const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const frontendSource = fs.readFileSync(
  path.join(root, 'frontend', 'state-and-notifications.js'),
  'utf8'
);
const analyticsSource = fs.readFileSync(
  path.join(root, 'mahler-search-app', 'js', 'analytics.js'),
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

async function testBrowserNotificationPayload() {
  const requests = [];
  const context = {
    console: { log() {}, warn() {}, error() {} },
    JSON,
    navigator: { userAgent: 'step12-test-agent' },
    GAS_NOTIFICATION_URL: 'https://example.test/gas',
    fetch: async (url, options) => requests.push({ url, options }),
    window: { __LOCAL_PREVIEW__: false }
  };
  vm.createContext(context);
  vm.runInContext(
    frontendSource.slice(frontendSource.indexOf('async function sendSearchNotification')),
    context
  );

  await context.sendSearchNotification({
    work: 'test-work',
    scope: '用語検索',
    term: 'stürzen',
    includeGlobal: true
  }, 'terms_search.html');
  assert.strictEqual(requests.length, 1);
  assert.deepStrictEqual(JSON.parse(requests[0].options.body), {
    work: 'test-work',
    scope: '用語検索',
    term: 'stürzen',
    page: 'terms_search.html',
    userAgent: 'step12-test-agent',
    includeGlobal: true
  });

  context.window.__LOCAL_PREVIEW__ = true;
  await context.sendSearchNotification({ work: 'preview', scope: '用語検索', term: 'langsam' }, 'terms_search.html');
  assert.strictEqual(requests.length, 1, 'ローカルプレビューでは検索通知を送信しないこと');
}

function createElement(tagName) {
  return {
    tagName,
    id: '',
    className: '',
    textContent: '',
    href: '',
    style: {},
    setAttribute() {},
    append() {}
  };
}

async function runAdminModeScenario(search, initialAdminValue) {
  const storage = new Map();
  if (initialAdminValue) storage.set('gmt_admin_device_optout', initialAdminValue);
  const appended = [];
  const listeners = {};
  let originalNotificationCalls = 0;
  const window = {
    location: {
      search,
      pathname: '/gaswebapp-manual/mahler-search-app/terms_search.html',
      href: `https://example.test/terms_search.html${search}`,
      origin: 'https://example.test'
    },
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key)
    },
    sessionStorage: { setItem() {} },
    sendSearchNotification: async () => { originalNotificationCalls += 1; },
    setTimeout: callback => { callback(); return 1; },
    addEventListener: (name, callback) => { listeners[`window:${name}`] = callback; }
  };
  const document = {
    body: { appendChild: element => appended.push(element) },
    createElement,
    getElementById: id => appended.find(element => element.id === id) || null,
    querySelector: () => null,
    addEventListener: (name, callback) => { listeners[`document:${name}`] = callback; }
  };
  const context = {
    console: { info() {} },
    document,
    window,
    URL,
    URLSearchParams,
    Date,
    Object,
    String,
    Boolean,
    RegExp
  };
  vm.createContext(context);
  vm.runInContext(
    sourceBetween(analyticsSource, '    const GA_MEASUREMENT_ID', '    function normalizeAnalyticsPath'),
    context
  );
  listeners['document:DOMContentLoaded']();
  await window.sendSearchNotification({ term: 'stürzen' }, 'terms_search.html');
  return { storage, appended, originalNotificationCalls, window };
}

async function testAdminModeNotificationGuard() {
  const enabled = await runAdminModeScenario('?admin=1', null);
  assert.strictEqual(enabled.storage.get('gmt_admin_device_optout'), '1');
  assert.strictEqual(enabled.window['ga-disable-G-ZT6MPW5MNG'], true);
  assert.strictEqual(enabled.window.__gaAdminOptOut, true);
  assert.strictEqual(enabled.originalNotificationCalls, 0);
  assert.ok(enabled.window.sendSearchNotification.__adminOptOutWrapped);
  assert.ok(enabled.appended.some(element => element.id === 'admin-device-optout-badge'));

  const disabled = await runAdminModeScenario('?admin=0', '1');
  assert.strictEqual(disabled.storage.has('gmt_admin_device_optout'), false);
  assert.strictEqual(disabled.window['ga-disable-G-ZT6MPW5MNG'], undefined);
  assert.strictEqual(disabled.originalNotificationCalls, 1);
  assert.strictEqual(Boolean(disabled.window.sendSearchNotification.__adminOptOutWrapped), false);
}

function testGasMailAndHistoryContract() {
  const mail = [];
  const history = [];
  const logs = [];
  const context = {
    console,
    Date,
    String,
    Object,
    isRateLimited: () => false,
    getValue: value => value || '未指定',
    pageNameMap: { 'terms_search.html': '用語から検索 (GM)' },
    translateWork: value => value,
    translateScope: value => value,
    Utilities: { formatDate: () => '2026/09/22 12:00:00' },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: name => name === 'NOTIFY_EMAIL' ? 'test@example.invalid' : '' })
    },
    MailApp: { sendEmail: (recipient, subject, body) => mail.push({ recipient, subject, body }) },
    Logger: { log: message => logs.push(String(message)) },
    logToSpreadsheet: (data, detail) => history.push({ data, detail }),
    createJsonResponse: (data, statusCode) => ({ data, statusCode: statusCode || 200 })
  };
  vm.createContext(context);
  vm.runInContext(
    sourceBetween(gasSource, 'function handleSearchNotification', 'function logToSpreadsheet'),
    context
  );

  const payload = {
    work: 'test-work',
    scope: '用語検索',
    term: 'stürzen',
    page: 'terms_search.html',
    userAgent: 'step12-test-agent'
  };
  const result = context.handleSearchNotification(payload);
  assert.strictEqual(result.data.status, 'success');
  assert.strictEqual(mail.length, 1);
  assert.strictEqual(mail[0].recipient, 'test@example.invalid');
  assert.match(mail[0].subject, /検索通知/);
  assert.match(mail[0].body, /stürzen/);
  assert.strictEqual(history.length, 1);

  context.isRateLimited = () => true;
  context.handleSearchNotification(payload);
  assert.strictEqual(mail.length, 1, '短時間重複ではメールを再送しないこと');
  assert.strictEqual(history.length, 1, '短時間重複では検索履歴を再記録しないこと');
  assert.ok(logs.some(message => message.includes('レート制限')));
}

Promise.resolve()
  .then(testBrowserNotificationPayload)
  .then(testAdminModeNotificationGuard)
  .then(testGasMailAndHistoryContract)
  .then(() => console.log('STEP12 admin・検索通知契約テストに成功しました．'))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
