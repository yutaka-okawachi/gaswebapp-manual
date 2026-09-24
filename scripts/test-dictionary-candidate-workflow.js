const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

async function testFrontendObservation() {
  const requests = [];
  const context = {
    console,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    navigator: { userAgent: 'test' },
    window: {
      __LOCAL_PREVIEW__: false,
      location: { search: '', pathname: '/terms_search.html' },
      crypto: { randomUUID: () => '12345678-1234-1234-1234-123456789abc' },
      isAdminDeviceOptOut: () => false
    },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true };
    },
    normalizeString(value) {
      return String(value || '').toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
    },
    matchesTermQuery() { return false; }
  };
  context.window.window = context.window;
  context.window.fetch = context.fetch;
  context.window.normalizeString = context.normalizeString;
  context.window.matchesTermQuery = context.matchesTermQuery;
  vm.createContext(context);
  vm.runInContext(read('frontend/state-and-notifications.js'), context, {
    filename: 'frontend/state-and-notifications.js'
  });

  assert.strictEqual(context.window.shouldObserveUnregisteredResultTermSearch({
    searchTerm: 'Geister', resultCount: 0, termsIndex: {}
  }), false);
  assert.strictEqual(context.window.shouldObserveUnregisteredResultTermSearch({
    searchTerm: 'Geister', resultCount: 2, termsIndex: { geister: 'term-geister' }
  }), false);
  assert.strictEqual(context.window.shouldObserveUnregisteredResultTermSearch({
    searchTerm: 'Geistern', resultCount: 2, termsIndex: {}
  }), true);

  await context.window.observeUnregisteredResultTermSearch({
    searchTerm: 'Geistern', resultCount: 2, termsIndex: {}
  }, 'terms_search.html');
  assert.strictEqual(requests.length, 1);
  const payload = JSON.parse(requests[0].options.body);
  assert.strictEqual(payload.action, 'observe_unregistered_result_term');
  assert.strictEqual(payload.term, 'Geistern');
  assert.strictEqual(payload.resultCount, 2);

  context.window.isAdminDeviceOptOut = () => true;
  await context.window.observeUnregisteredResultTermSearch({
    searchTerm: 'Geistern', resultCount: 2, termsIndex: {}
  }, 'terms_search.html');
  assert.strictEqual(requests.length, 1);

  context.window.isAdminCandidateObservationEnabled = () => true;
  await context.window.observeUnregisteredResultTermSearch({
    searchTerm: 'Geistern', resultCount: 2, termsIndex: {}
  }, 'terms_search.html');
  assert.strictEqual(requests.length, 2);

  context.window.__LOCAL_PREVIEW__ = true;
  await context.window.observeUnregisteredResultTermSearch({
    searchTerm: 'Geistern', resultCount: 2, termsIndex: {}
  }, 'terms_search.html');
  assert.strictEqual(requests.length, 2);
}

function testAdminCandidateObservationMode() {
  const local = new Map();
  const session = new Map();
  const storage = values => ({
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  });
  const source = read('mahler-search-app/js/analytics.js');
  const load = search => {
    const listeners = {};
    const appended = [];
    let notifications = 0;
    const context = {
      URLSearchParams,
      console,
      document: {
        addEventListener: (name, callback) => { listeners[name] = callback; },
        getElementById: () => null,
        createElement: () => ({ style: {}, setAttribute() {} }),
        body: { appendChild: element => appended.push(element) },
        querySelector: () => ({})
      },
      window: {
        localStorage: storage(local),
        sessionStorage: storage(session),
        location: { search, pathname: '/gaswebapp-manual/mahler-search-app/terms_search.html' },
        addEventListener() {},
        setTimeout() {},
        sendSearchNotification: () => { notifications++; }
      }
    };
    vm.createContext(context);
    vm.runInContext(source, context, { filename: 'mahler-search-app/js/analytics.js' });
    return { window: context.window, listeners, appended, notificationCount: () => notifications };
  };

  let page = load('?candidate_observe=1');
  assert.strictEqual(page.window.isAdminCandidateObservationEnabled(), false);
  assert.strictEqual(session.has('gmt_admin_candidate_observation'), false);

  page = load('?admin=1');
  assert.strictEqual(page.window.isAdminDeviceOptOut(), true);
  assert.strictEqual(page.window.isAdminCandidateObservationEnabled(), false);

  page = load('?candidate_observe=1');
  assert.strictEqual(page.window.isAdminCandidateObservationEnabled(), true);
  assert.strictEqual(page.window['ga-disable-G-ZT6MPW5MNG'], true);
  page.listeners.DOMContentLoaded();
  assert.ok(page.appended[0].textContent.includes('未登録語候補のみ ON'));
  page.window.sendSearchNotification({}, 'terms_search.html');
  assert.strictEqual(page.notificationCount(), 0);

  page = load('');
  assert.strictEqual(page.window.isAdminCandidateObservationEnabled(), true);

  page = load('?candidate_observe=0');
  assert.strictEqual(page.window.isAdminDeviceOptOut(), true);
  assert.strictEqual(page.window.isAdminCandidateObservationEnabled(), false);

  load('?admin=1&candidate_observe=1');
  page = load('?admin=0');
  assert.strictEqual(page.window.isAdminDeviceOptOut(), false);
  assert.strictEqual(page.window.isAdminCandidateObservationEnabled(), false);
  assert.strictEqual(session.has('gmt_admin_candidate_observation'), false);
}

function testRelatedFormPromotionHelper() {
  const appended = [];
  const context = {
    console,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: () => [1, 2, 3]
    }
  };
  vm.createContext(context);
  vm.runInContext(read('src/dictionary_candidate_workflow.js'), context, {
    filename: 'src/dictionary_candidate_workflow.js'
  });
  const mappingSheet = { appendRow: row => appended.push(row) };
  const notesHeadwords = new Set(['ziehen', 'gezogen']);
  const pairs = new Set();
  const review = [
    'jev-1', 'gezogenen', '', 'gezogenen', 'Jev', 'ADVISORY', 'INFLECTION',
    'gezogen', 'term-gezogen', 0.95, 0.98, '', '採用', '格変化形として要確認', ''
  ];
  assert.strictEqual(
    context.appendApprovedRelatedForm(review, mappingSheet, notesHeadwords, pairs),
    'inserted'
  );
  assert.deepStrictEqual(Array.from(appended[0]), [
    'gezogen', 'gezogenen', '語形変化（要分類）', '対象', '対象',
    'Jev判定ID：jev-1 具体的な語形区分は人が確認する． 格変化形として要確認'
  ]);
  assert.strictEqual(
    context.appendApprovedRelatedForm(review, mappingSheet, notesHeadwords, pairs),
    'duplicate'
  );

  const independentHeadingReview = review.slice();
  independentHeadingReview[0] = 'jev-2';
  independentHeadingReview[1] = 'ziehen';
  assert.strictEqual(
    context.appendApprovedRelatedForm(
      independentHeadingReview, mappingSheet, notesHeadwords, pairs
    ),
    'inserted'
  );
  assert.strictEqual(appended[1][3], '対象外');
}

function testWiring() {
  const gas = read('src/web_trigger.js');
  assert.ok(gas.includes("data.action === 'observe_unregistered_result_term'"));
  assert.ok(gas.includes("action === 'promoteApprovedDictionaryCandidates'"));
  for (const page of ['terms_search.html', 'rs_terms_search.html', 'rw_terms_search.html']) {
    const source = read(path.join('mahler-search-app', page));
    assert.ok(source.includes('window.observeUnregisteredResultTermSearch({'));
    assert.ok(source.includes('termsIndex: window.appData.dic_terms_index'));
  }
  const workflow = read('src/dictionary_candidate_workflow.js');
  assert.ok(workflow.includes("EXPERIMENTAL_TERM_MAPPING_SHEET_NAME = '辞書語形・検索対応_実験'"));
  assert.strictEqual(workflow.includes("getSheetByName('Notes')"), false);
  assert.strictEqual(workflow.includes("getSheetByName('語形対応')"), false);
}

Promise.resolve()
  .then(testFrontendObservation)
  .then(testAdminCandidateObservationMode)
  .then(testRelatedFormPromotionHelper)
  .then(testWiring)
  .then(() => console.log('辞書候補ワークフローのテストに成功しました．'))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
