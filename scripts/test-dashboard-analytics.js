const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repositoryRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(repositoryRoot, 'src', 'dashboard_analytics.js');
const manifestPath = path.join(repositoryRoot, 'src', 'appsscript.json');
const getRouterPath = path.join(repositoryRoot, 'src', 'mahler_server.js');
const postRouterPath = path.join(repositoryRoot, 'src', 'web_trigger.js');
const commonScriptsPath = path.join(repositoryRoot, 'src', 'common_scripts.html');
const dictionaryGeneratorPath = path.join(repositoryRoot, 'src', 'generate_dic_html.js');
const publicAppScriptPath = path.join(repositoryRoot, 'mahler-search-app', 'js', 'app.js');
const publicTermSearchPages = [
  'terms_search.html',
  'rs_terms_search.html',
  'rw_terms_search.html'
].map(fileName => path.join(repositoryRoot, 'mahler-search-app', fileName));

let analyticsCallCount = 0;
let lockAcquireCount = 0;
let lockReleaseCount = 0;
const cacheValues = new Map();
const scriptProperties = {
  GA4_PROPERTY_ID: '471296729',
  SPREADSHEET_ID: 'spreadsheet-test-id'
};

function reportRow(dimensions, metric) {
  return {
    dimensionValues: dimensions.map(value => ({ value: String(value) })),
    metricValues: [{ value: String(metric) }]
  };
}

const pageViewsReport = {
  rows: [
    reportRow(['20260726', '/gaswebapp-manual/mahler-search-app/dic.html'], 10),
    reportRow(['20260725', '/gaswebapp-manual/'], 5)
  ]
};

const previousPageViewsReport = {
  rows: [
    reportRow(['20260719', '/gaswebapp-manual/mahler-search-app/dic.html'], 8),
    reportRow(['20260719', '/gaswebapp-manual/'], 4)
  ]
};

const activityReport = {
  rows: [
    reportRow([
      '20260726',
      'view_search_results',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      'gm_term',
      '(not set)'
    ], 3),
    reportRow([
      '20260726',
      'search_no_results',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      'gm_term',
      '(not set)'
    ], 1),
    reportRow([
      '20260726',
      'view_search_results',
      '(not set)',
      '/macros/s/test/exec',
      'gm_term',
      '(not set)'
    ], 2),
    reportRow([
      '20260726',
      'view_example_search_results',
      '/gaswebapp-manual/mahler-search-app/dic.html',
      '/gaswebapp-manual/mahler-search-app/dic.html',
      'gm_term',
      '/gaswebapp-manual/mahler-search-app/terms_search.html'
    ], 2)
  ]
};

const previousActivityReport = {
  rows: [
    reportRow([
      '20260719',
      'view_search_results',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      'gm_term',
      '(not set)'
    ], 3),
    reportRow([
      '20260719',
      'search_no_results',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      'gm_term',
      '(not set)'
    ], 1),
    reportRow([
      '20260719',
      'view_example_search_results',
      '/gaswebapp-manual/mahler-search-app/dic.html',
      '/gaswebapp-manual/mahler-search-app/dic.html',
      'gm_term',
      '/gaswebapp-manual/mahler-search-app/terms_search.html'
    ], 1)
  ]
};

const searchMovesReport = {
  rows: [
    reportRow([
      '/gaswebapp-manual/',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      'search_navigation',
      '/gaswebapp-manual/'
    ], 4),
    reportRow([
      '/gaswebapp-manual/mahler-search-app/dic.html',
      '/gaswebapp-manual/mahler-search-app/rw_terms_search.html',
      'example_search',
      '/gaswebapp-manual/mahler-search-app/dic.html'
    ], 3),
    reportRow([
      '/gaswebapp-manual/mahler-search-app/dic.html',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      'example_search',
      '/gaswebapp-manual/mahler-search-app/dic.html'
    ], 5),
    reportRow([
      '/gaswebapp-manual/mahler-search-app/dic.html',
      '/gaswebapp-manual/mahler-search-app/rs_terms_search.html',
      'example_search',
      '/gaswebapp-manual/mahler-search-app/dic.html'
    ], 2),
    reportRow([
      '/gaswebapp-manual/mahler-search-app/dic.html',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      'search_navigation',
      '/gaswebapp-manual/mahler-search-app/dic.html'
    ], 7)
  ]
};

const termsReport = {
  rows: [
    reportRow([
      'innig',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      'gm_term'
    ], 3),
    reportRow([
      'Innig',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      'gm_term'
    ], 1),
    reportRow([
      'bewegt',
      '/gaswebapp-manual/mahler-search-app/rs_terms_search.html',
      '/gaswebapp-manual/mahler-search-app/rs_terms_search.html',
      'rs_term'
    ], 2),
    reportRow(['(not set)', '(not set)', '(not set)', '(not set)'], 9)
  ]
};

const context = {
  console,
  URL,
  Logger: { log() {} },
  ScriptApp: {
    AuthMode: { FULL: 'FULL' },
    requireScopes(authMode, scopes) {
      assert.strictEqual(authMode, 'FULL');
      assert.deepStrictEqual(
        JSON.parse(JSON.stringify(scopes)),
        ['https://www.googleapis.com/auth/analytics.readonly']
      );
    }
  },
  Utilities: {
    formatDate(date, timeZone, format) {
      assert.strictEqual(timeZone, 'Asia/Tokyo');
      if (format === 'yyyy-MM-dd') return '2026-07-26';
      if (format === 'yyyy年M月d日 HH:mm') return '2026年7月26日 14:05';
      throw new Error(`Unexpected date format: ${format}`);
    }
  },
  PropertiesService: {
    getScriptProperties() {
      return {
        getProperty(name) {
          return scriptProperties[name] || null;
        }
      };
    }
  },
  CacheService: {
    getScriptCache() {
      return {
        get(key) {
          return cacheValues.get(key) || null;
        },
        put(key, value) {
          cacheValues.set(key, value);
        },
        remove(key) {
          cacheValues.delete(key);
        }
      };
    }
  },
  LockService: {
    getScriptLock() {
      return {
        tryLock(waitMilliseconds) {
          assert.strictEqual(waitMilliseconds, 30000);
          lockAcquireCount += 1;
          return true;
        },
        releaseLock() {
          lockReleaseCount += 1;
        }
      };
    }
  },
  SpreadsheetApp: {
    openById(id) {
      assert.strictEqual(id, 'spreadsheet-test-id');
      return {
        getSheetByName(name) {
          assert.strictEqual(name, 'Notes');
          return {
            getLastRow() {
              return 3;
            },
            getRange(row, column, rowCount, columnCount) {
              assert.deepStrictEqual([row, column, rowCount, columnCount], [2, 1, 2, 2]);
              return {
                getValues() {
                  return [
                    ['innig', '<b>心をこめて</b>\n第二候補'],
                    ['bewegt', '動きをもって']
                  ];
                }
              };
            }
          };
        }
      };
    }
  },
  AnalyticsData: {
    Properties: {
      runReport(request, propertyName) {
        analyticsCallCount += 1;
        assert.strictEqual(propertyName, 'properties/471296729');
        if (!request.dimensions) {
          assert.deepStrictEqual(
            JSON.parse(JSON.stringify(request)),
            {
              dateRanges: [{ startDate: 'today', endDate: 'today' }],
              metrics: [{ name: 'eventCount' }],
              limit: '1'
            }
          );
          return {};
        }
        const requestedRange = JSON.parse(JSON.stringify(request.dateRanges[0]));
        const isPreviousRange =
          requestedRange.startDate === '2026-07-13' &&
          requestedRange.endDate === '2026-07-19';
        assert.ok(
          isPreviousRange ||
          (
            requestedRange.startDate === '2026-07-20' &&
            requestedRange.endDate === '2026-07-26'
          )
        );
        const dimensionNames = request.dimensions.map(item => item.name).join(',');
        if (dimensionNames === 'date,pagePath') {
          return isPreviousRange ? previousPageViewsReport : pageViewsReport;
        }
        if (
          dimensionNames ===
          'date,eventName,customEvent:source_page,pagePath,customEvent:search_type,customEvent:destination_page'
        ) {
          return isPreviousRange ? previousActivityReport : activityReport;
        }
        if (
          dimensionNames ===
          'customEvent:source_page,customEvent:destination_page,customEvent:link_type,pagePath'
        ) {
          assert.strictEqual(
            request.dimensionFilter.filter.stringFilter.value,
            'search_page_move'
          );
          return searchMovesReport;
        }
        if (
          dimensionNames ===
          'searchTerm,customEvent:source_page,pagePath,customEvent:search_type'
        ) {
          const eventFilter = request.dimensionFilter.andGroup.expressions[0];
          assert.strictEqual(
            eventFilter.filter.stringFilter.value,
            'view_search_results'
          );
          return termsReport;
        }
        throw new Error(`Unexpected report dimensions: ${dimensionNames}`);
      }
    }
  },
  createJsonResponse(data) {
    return data;
  }
};

vm.createContext(context);
vm.runInContext(fs.readFileSync(sourcePath, 'utf8'), context, {
  filename: sourcePath
});

assert.strictEqual(context.parseDashboardPeriod('7'), 7);
assert.strictEqual(context.parseDashboardPeriod(90), 90);
assert.strictEqual(context.parseDashboardPeriod(180), null);
assert.strictEqual(context.parseDashboardPeriod('14'), null);
assert.strictEqual(context.parseDashboardPeriod('7days'), null);
assert.strictEqual(
  context.verifyDashboardAnalyticsAccess(),
  'Analytics Data API access: OK'
);
assert.strictEqual(analyticsCallCount, 1);

const invalid = context.handleDashboardAnalyticsRequest({ period: '14' });
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(invalid)),
  {
    error: {
      code: 'INVALID_PERIOD',
      message: 'period must be one of 7, 30, 90'
    }
  }
);
assert.strictEqual(analyticsCallCount, 1);

const result = context.getDashboardAnalytics(7);
assert.strictEqual(analyticsCallCount, 7);
assert.strictEqual(lockAcquireCount, 1);
assert.strictEqual(lockReleaseCount, 1);
assert.strictEqual(result.schemaVersion, 2);
assert.strictEqual(result.period, 7);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(result.range)),
  { startDate: '2026-07-20', endDate: '2026-07-26' }
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(result.previous.range)),
  { startDate: '2026-07-13', endDate: '2026-07-19' }
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(result.searchSummary)),
  { withResults: 5, noResults: 1, successRate: 83.3 }
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(result.previous.searchSummary)),
  { withResults: 3, noResults: 1, successRate: 75 }
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(result.searchMethods)),
  [
    { key: 'term', label: '用語から検索', count: 6 },
    {
      key: 'mahler_work',
      label: '曲名・楽器等から検索（Mahler）',
      count: 0
    },
    {
      key: 'opera_work',
      label: '曲名・場面等から検索（Wagner / R. Strauss）',
      count: 0
    },
    {
      key: 'unclassified',
      label: '分類情報なし（過去データ等）',
      count: 0
    }
  ]
);
assert.strictEqual(result.daily.length, 7);
assert.strictEqual(result.previous.daily.length, 7);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(result.daily[result.daily.length - 1])),
  { date: '7/26', searches: 6, views: 10, exampleClicks: 2 }
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(result.previous.daily[result.previous.daily.length - 1])),
  { date: '7/19', searches: 4, views: 12, exampleClicks: 1 }
);
assert.strictEqual(
  result.daily.reduce((sum, day) => sum + day.views, 0),
  15
);

const home = result.pages.find(page => page.page === 'HOME');
const dictionary = result.pages.find(page => page.page === 'ドイツ語の音楽用語集');
const gmTerms = result.pages.find(page => page.page === '用語から検索 (GM)');
assert.strictEqual(result.pages.length, 12);
assert.strictEqual(home.views, 5);
assert.strictEqual(home.searchMoves, 4);
assert.strictEqual(dictionary.views, 10);
assert.strictEqual(dictionary.searchMoves, 17);
assert.strictEqual(dictionary.exampleClicks, 2);
assert.strictEqual(gmTerms.searches, 6);
assert.deepStrictEqual(Array.from(gmTerms.topTerms), ['innig']);

assert.strictEqual(result.terms.length, 2);
assert.strictEqual(result.terms[0].term, 'innig');
assert.strictEqual(result.terms[0].translation, '心をこめて');
assert.strictEqual(result.terms[0].searches, 4);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(result.terms[0].pages)),
  [{ name: '用語から検索 (GM)', count: 4 }]
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(result.dictionaryExampleMoves)),
  [
    {
      composer: 'Wagner',
      path: '/gaswebapp-manual/mahler-search-app/rw_terms_search.html',
      count: 0
    },
    {
      composer: 'Mahler',
      path: '/gaswebapp-manual/mahler-search-app/terms_search.html',
      count: 2
    },
    {
      composer: 'R. Strauss',
      path: '/gaswebapp-manual/mahler-search-app/rs_terms_search.html',
      count: 0
    }
  ]
);

const manyTermsReport = {
  rows: Array.from({ length: 55 }, (_, index) => reportRow([
    `term-${String(index + 1).padStart(2, '0')}`,
    '/gaswebapp-manual/mahler-search-app/terms_search.html',
    '/gaswebapp-manual/mahler-search-app/terms_search.html',
    'gm_term'
  ], index + 1))
};
const limitedTermsResult = context.buildDashboardAnalyticsResponse(
  7,
  context.createDashboardDateRange(7),
  {
    pageViews: {},
    activity: {},
    searchMoves: {},
    terms: manyTermsReport,
    previousRange: { startDate: '2026-07-13', endDate: '2026-07-19' },
    previousPageViews: {},
    previousActivity: {}
  }
);
assert.strictEqual(limitedTermsResult.terms.length, 50);
assert.strictEqual(limitedTermsResult.terms[0].term, 'term-55');
assert.strictEqual(limitedTermsResult.terms[0].searches, 55);
assert.strictEqual(limitedTermsResult.terms[49].term, 'term-06');
assert.strictEqual(limitedTermsResult.terms[49].searches, 6);

const searchMethodResult = context.buildDashboardAnalyticsResponse(
  7,
  context.createDashboardDateRange(7),
  {
    pageViews: {},
    activity: {
      rows: [
        reportRow([
          '20260726',
          'view_search_results',
          '/gaswebapp-manual/mahler-search-app/mahler.html',
          '/gaswebapp-manual/mahler-search-app/mahler.html',
          'gm_work',
          '(not set)'
        ], 4),
        reportRow([
          '20260726',
          'search_no_results',
          '/gaswebapp-manual/mahler-search-app/richard_wagner.html',
          '/gaswebapp-manual/mahler-search-app/richard_wagner.html',
          'rw_work_scene',
          '(not set)'
        ], 2)
      ]
    },
    searchMoves: {},
    terms: {},
    previousRange: { startDate: '2026-07-13', endDate: '2026-07-19' },
    previousPageViews: {},
    previousActivity: {}
  }
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(searchMethodResult.searchMethods)),
  [
    { key: 'term', label: '用語から検索', count: 0 },
    {
      key: 'mahler_work',
      label: '曲名・楽器等から検索（Mahler）',
      count: 4
    },
    {
      key: 'opera_work',
      label: '曲名・場面等から検索（Wagner / R. Strauss）',
      count: 2
    },
    {
      key: 'unclassified',
      label: '分類情報なし（過去データ等）',
      count: 0
    }
  ]
);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(searchMethodResult.searchSummary)),
  { withResults: 4, noResults: 2, successRate: 66.7 }
);
assert.strictEqual(
  context.chooseDashboardSearchMethodKey(
    '/gaswebapp-manual/mahler-search-app/rs_terms_search.html',
    '(not set)'
  ),
  'term'
);
assert.strictEqual(
  context.chooseDashboardSearchMethodKey(
    '/gaswebapp-manual/mahler-search-app/mahler.html',
    '(not set)'
  ),
  'mahler_work'
);
assert.strictEqual(
  context.chooseDashboardSearchMethodKey(
    '/gaswebapp-manual/mahler-search-app/richard_wagner.html',
    '(not set)'
  ),
  'opera_work'
);

const cachedResult = context.getDashboardAnalytics(7);
assert.strictEqual(analyticsCallCount, 7);
assert.strictEqual(lockAcquireCount, 1);
assert.strictEqual(lockReleaseCount, 1);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(cachedResult)),
  JSON.parse(JSON.stringify(result))
);

[
  { period: 7, startDate: '2026-07-20' },
  { period: 30, startDate: '2026-06-27' },
  { period: 90, startDate: '2026-04-28' }
].forEach(testCase => {
  const range = context.createDashboardDateRange(testCase.period);
  const previousRange = context.createDashboardPreviousDateRange(
    range,
    testCase.period
  );
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(range)),
    { startDate: testCase.startDate, endDate: '2026-07-26' }
  );
  assert.strictEqual(previousRange.endDate, context.shiftDashboardIsoDate(range.startDate, -1));
  const emptyResponse = context.buildDashboardAnalyticsResponse(
    testCase.period,
    range,
    {
      pageViews: {},
      activity: {},
      searchMoves: {},
      terms: {},
      previousRange: previousRange,
      previousPageViews: {},
      previousActivity: {}
    }
  );
  assert.strictEqual(emptyResponse.daily.length, testCase.period);
  assert.strictEqual(emptyResponse.daily[0].searches, 0);
  assert.strictEqual(emptyResponse.daily[0].views, 0);
  assert.strictEqual(emptyResponse.daily[0].exampleClicks, 0);
  assert.strictEqual(emptyResponse.previous.daily.length, testCase.period);
  assert.strictEqual(emptyResponse.previous.daily[0].searches, 0);
  assert.strictEqual(emptyResponse.previous.daily[0].views, 0);
  assert.strictEqual(emptyResponse.previous.daily[0].exampleClicks, 0);
  assert.strictEqual(emptyResponse.pages.length, 12);
});

function assertFiniteNonNegativeCounts(value, key) {
  if (Array.isArray(value)) {
    value.forEach(item => assertFiniteNonNegativeCounts(item, key));
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.keys(value).forEach(childKey => {
    const childValue = value[childKey];
    if (
      ['searches', 'views', 'exampleClicks', 'searchMoves', 'count'].includes(childKey)
    ) {
      assert.strictEqual(Number.isFinite(childValue), true);
      assert.strictEqual(Number.isInteger(childValue), true);
      assert.ok(childValue >= 0);
    } else {
      assertFiniteNonNegativeCounts(childValue, childKey);
    }
  });
}

assertFiniteNonNegativeCounts(result);

cacheValues.clear();
scriptProperties.GA4_PROPERTY_ID = '';
const missingConfiguration = context.handleDashboardAnalyticsRequest({ period: '7' });
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(missingConfiguration)),
  {
    error: {
      code: 'CONFIGURATION_ERROR',
      message: 'Dashboard analytics is not configured'
    }
  }
);
assert.strictEqual(JSON.stringify(missingConfiguration).includes('spreadsheet-test-id'), false);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/analytics.readonly'));
assert.deepStrictEqual(manifest.dependencies.enabledAdvancedServices, [{
  userSymbol: 'AnalyticsData',
  version: 'v1beta',
  serviceId: 'analyticsdata'
}]);

const getRouterSource = fs.readFileSync(getRouterPath, 'utf8');
const postRouterSource = fs.readFileSync(postRouterPath, 'utf8');
const commonScriptsSource = fs.readFileSync(commonScriptsPath, 'utf8');
const dictionaryGeneratorSource = fs.readFileSync(dictionaryGeneratorPath, 'utf8');
const publicAppScriptSource = fs.readFileSync(publicAppScriptPath, 'utf8');
assert.ok(getRouterSource.includes("e.parameter.api === 'dashboard'"));
assert.ok(postRouterSource.includes("data.api === 'dashboard'"));
assert.ok(dictionaryGeneratorSource.includes('&source=dictionary_example'));
assert.strictEqual(dictionaryGeneratorSource.includes("'click_view_example'"), false);
assert.ok(commonScriptsSource.includes("resultCount > 0"));
assert.ok(commonScriptsSource.includes("urlParams.get('source') === 'dictionary_example'"));
assert.ok(commonScriptsSource.includes("'view_example_search_results'"));
assert.ok(publicAppScriptSource.includes("resultCount > 0"));
assert.ok(publicAppScriptSource.includes("urlParams.get('source') === 'dictionary_example'"));
assert.ok(publicAppScriptSource.includes("'view_example_search_results'"));
publicTermSearchPages.forEach(pagePath => {
  assert.ok(fs.readFileSync(pagePath, 'utf8').includes('js/app.js?v=11'));
});
assert.strictEqual(
  fs.readFileSync(sourcePath, 'utf8').includes("'click_view_example'"),
  false
);

console.log('dashboard analytics tests: OK');
