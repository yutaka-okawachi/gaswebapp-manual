const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repositoryRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(repositoryRoot, 'src', 'dashboard_analytics.js');
const manifestPath = path.join(repositoryRoot, 'src', 'appsscript.json');
const getRouterPath = path.join(repositoryRoot, 'src', 'mahler_server.js');
const postRouterPath = path.join(repositoryRoot, 'src', 'web_trigger.js');

let analyticsCallCount = 0;
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

const activityReport = {
  rows: [
    reportRow([
      '20260726',
      'view_search_results',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      '/gaswebapp-manual/mahler-search-app/terms_search.html'
    ], 3),
    reportRow([
      '20260726',
      'search_no_results',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      '/gaswebapp-manual/mahler-search-app/terms_search.html'
    ], 1),
    reportRow([
      '20260726',
      'view_search_results',
      '(not set)',
      '/gaswebapp-manual/mahler-search-app/terms_search.html'
    ], 2),
    reportRow([
      '20260726',
      'click_view_example',
      '/gaswebapp-manual/mahler-search-app/dic.html',
      '/gaswebapp-manual/mahler-search-app/dic.html'
    ], 2),
    reportRow([
      '20260725',
      'search_page_move',
      '/gaswebapp-manual/',
      '/gaswebapp-manual/'
    ], 4)
  ]
};

const termsReport = {
  rows: [
    reportRow([
      'innig',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      '/gaswebapp-manual/mahler-search-app/terms_search.html'
    ], 3),
    reportRow([
      'Innig',
      '/gaswebapp-manual/mahler-search-app/terms_search.html',
      '/gaswebapp-manual/mahler-search-app/terms_search.html'
    ], 1),
    reportRow([
      'bewegt',
      '/gaswebapp-manual/mahler-search-app/rs_terms_search.html',
      '/gaswebapp-manual/mahler-search-app/rs_terms_search.html'
    ], 2),
    reportRow(['(not set)', '(not set)', '(not set)'], 9)
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
        assert.deepStrictEqual(
          JSON.parse(JSON.stringify(request.dateRanges)),
          [{
            startDate: '2026-07-20',
            endDate: '2026-07-26'
          }]
        );
        const dimensionNames = request.dimensions.map(item => item.name).join(',');
        if (dimensionNames === 'date,pagePath') return pageViewsReport;
        if (dimensionNames === 'date,eventName,customEvent:source_page,pagePath') {
          return activityReport;
        }
        if (dimensionNames === 'searchTerm,customEvent:source_page,pagePath') {
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
assert.strictEqual(context.parseDashboardPeriod(180), 180);
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
      message: 'period must be one of 7, 30, 90, 180'
    }
  }
);
assert.strictEqual(analyticsCallCount, 1);

const result = context.getDashboardAnalytics(7);
assert.strictEqual(analyticsCallCount, 4);
assert.strictEqual(result.schemaVersion, 1);
assert.strictEqual(result.period, 7);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(result.range)),
  { startDate: '2026-07-20', endDate: '2026-07-26' }
);
assert.strictEqual(result.daily.length, 7);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(result.daily[result.daily.length - 1])),
  { date: '7/26', searches: 6, views: 10, exampleClicks: 2 }
);

const home = result.pages.find(page => page.page === 'HOME');
const dictionary = result.pages.find(page => page.page === 'ドイツ語の音楽用語集');
const gmTerms = result.pages.find(page => page.page === '用語から検索 (GM)');
assert.strictEqual(result.pages.length, 12);
assert.strictEqual(home.views, 5);
assert.strictEqual(home.searchMoves, 4);
assert.strictEqual(dictionary.views, 10);
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

const cachedResult = context.getDashboardAnalytics(7);
assert.strictEqual(analyticsCallCount, 4);
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(cachedResult)),
  JSON.parse(JSON.stringify(result))
);

[
  { period: 7, startDate: '2026-07-20' },
  { period: 30, startDate: '2026-06-27' },
  { period: 90, startDate: '2026-04-28' },
  { period: 180, startDate: '2026-01-28' }
].forEach(testCase => {
  const range = context.createDashboardDateRange(testCase.period);
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(range)),
    { startDate: testCase.startDate, endDate: '2026-07-26' }
  );
  const emptyResponse = context.buildDashboardAnalyticsResponse(
    testCase.period,
    range,
    { pageViews: {}, activity: {}, terms: {} }
  );
  assert.strictEqual(emptyResponse.daily.length, testCase.period);
  assert.strictEqual(emptyResponse.daily[0].searches, 0);
  assert.strictEqual(emptyResponse.daily[0].views, 0);
  assert.strictEqual(emptyResponse.daily[0].exampleClicks, 0);
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
assert.ok(getRouterSource.includes("e.parameter.api === 'dashboard'"));
assert.ok(postRouterSource.includes("data.api === 'dashboard'"));

console.log('dashboard analytics tests: OK');
