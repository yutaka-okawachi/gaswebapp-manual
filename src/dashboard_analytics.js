/**
 * Administrator dashboard aggregate API backed by the GA4 Data API.
 *
 * Public responses contain aggregate counts only. Raw search-history rows,
 * UserAgent values, client identifiers, and zero-result term lists are never
 * read or returned here.
 */

const DASHBOARD_SCHEMA_VERSION = 1;
const DASHBOARD_TIME_ZONE = 'Asia/Tokyo';
const DASHBOARD_ALLOWED_PERIODS = Object.freeze([7, 30, 90, 180]);
const DASHBOARD_CACHE_SECONDS = 300;
const DASHBOARD_TERM_LIMIT = 50;
const DASHBOARD_SEARCH_EVENTS = Object.freeze([
  'view_search_results',
  'search_no_results'
]);
const DASHBOARD_TERM_SEARCH_TYPES = Object.freeze([
  'gm_term',
  'rs_term',
  'rw_term'
]);
const DASHBOARD_DICTIONARY_EXAMPLE_DESTINATIONS = Object.freeze([
  {
    composer: 'Wagner',
    path: '/gaswebapp-manual/mahler-search-app/rw_terms_search.html'
  },
  {
    composer: 'Mahler',
    path: '/gaswebapp-manual/mahler-search-app/terms_search.html'
  },
  {
    composer: 'R. Strauss',
    path: '/gaswebapp-manual/mahler-search-app/rs_terms_search.html'
  }
]);

const DASHBOARD_PAGES = Object.freeze([
  { page: 'HOME', path: '/gaswebapp-manual/' },
  { page: '曲名と楽器等から選択 (GM)', path: '/gaswebapp-manual/mahler-search-app/mahler.html' },
  { page: 'ドイツ語の音楽用語集', path: '/gaswebapp-manual/mahler-search-app/dic.html' },
  { page: '用語から検索 (GM)', path: '/gaswebapp-manual/mahler-search-app/terms_search.html' },
  { page: '用語から検索 (RS)', path: '/gaswebapp-manual/mahler-search-app/rs_terms_search.html' },
  { page: '用語から検索 (RW)', path: '/gaswebapp-manual/mahler-search-app/rw_terms_search.html' },
  { page: '曲名から検索 (RS)', path: '/gaswebapp-manual/mahler-search-app/richard_strauss.html' },
  { page: '曲名から検索 (RW)', path: '/gaswebapp-manual/mahler-search-app/richard_wagner.html' },
  { page: 'あらすじ集 (RS)', path: '/gaswebapp-manual/mahler-search-app/rs_synopsis.html' },
  { page: 'あらすじ集 (RW)', path: '/gaswebapp-manual/mahler-search-app/rw_synopsis.html' },
  { page: '訳出についての覚書', path: '/gaswebapp-manual/mahler-search-app/notes.html' },
  { page: '作品・索引など', path: '/gaswebapp-manual/mahler-search-app/other.html' }
]);

const DASHBOARD_DICTIONARY_PATH = '/gaswebapp-manual/mahler-search-app/dic.html';

/**
 * GET/POST route entrypoint.
 * @param {Object} params Query-string or JSON body parameters.
 * @returns {TextOutput}
 */
function handleDashboardAnalyticsRequest(params) {
  const period = parseDashboardPeriod(params && params.period);
  if (!period) {
    return createJsonResponse({
      error: {
        code: 'INVALID_PERIOD',
        message: 'period must be one of 7, 30, 90, 180'
      }
    });
  }

  try {
    return createJsonResponse(getDashboardAnalytics(period));
  } catch (error) {
    Logger.log('Dashboard analytics error: ' + String(error && error.stack ? error.stack : error));
    const code = error && error.dashboardCode ? error.dashboardCode : 'GA4_API_ERROR';
    const message = code === 'CONFIGURATION_ERROR'
      ? 'Dashboard analytics is not configured'
      : 'Dashboard analytics data is temporarily unavailable';
    return createJsonResponse({ error: { code: code, message: message } });
  }
}

/**
 * Builds or returns the cached dashboard response.
 * @param {number} period
 * @returns {Object}
 */
function getDashboardAnalytics(period) {
  const propertyId = String(
    PropertiesService.getScriptProperties().getProperty('GA4_PROPERTY_ID') || ''
  ).trim();
  if (!/^\d+$/.test(propertyId)) {
    const configurationError = new Error('GA4_PROPERTY_ID is missing or invalid');
    configurationError.dashboardCode = 'CONFIGURATION_ERROR';
    throw configurationError;
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = 'admin_dashboard_analytics_v3_' + propertyId + '_' + period;
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      cache.remove(cacheKey);
    }
  }

  const range = createDashboardDateRange(period);
  const previousRange = createDashboardPreviousDateRange(range, period);
  const propertyName = 'properties/' + propertyId;
  const reports = {
    pageViews: runDashboardPageViewsReport(propertyName, range),
    activity: runDashboardActivityReport(propertyName, range),
    searchMoves: runDashboardSearchMovesReport(propertyName, range),
    terms: runDashboardTermsReport(propertyName, range),
    previousRange: previousRange,
    previousPageViews: runDashboardPageViewsReport(propertyName, previousRange),
    previousActivity: runDashboardActivityReport(propertyName, previousRange)
  };
  const result = buildDashboardAnalyticsResponse(period, range, reports);

  try {
    cache.put(cacheKey, JSON.stringify(result), DASHBOARD_CACHE_SECONDS);
  } catch (error) {
    Logger.log('Dashboard cache write skipped: ' + String(error));
  }
  return result;
}

/**
 * Performs a minimal read-only request so the deployer can authorize and
 * verify Analytics Data API access from the Apps Script editor.
 * @returns {string}
 */
function verifyDashboardAnalyticsAccess() {
  ScriptApp.requireScopes(ScriptApp.AuthMode.FULL, [
    'https://www.googleapis.com/auth/analytics.readonly'
  ]);

  const propertyId = String(
    PropertiesService.getScriptProperties().getProperty('GA4_PROPERTY_ID') || ''
  ).trim();
  if (!/^\d+$/.test(propertyId)) {
    throw new Error('GA4_PROPERTY_ID is missing or invalid');
  }

  AnalyticsData.Properties.runReport({
    dateRanges: [{ startDate: 'today', endDate: 'today' }],
    metrics: [{ name: 'eventCount' }],
    limit: '1'
  }, 'properties/' + propertyId);

  Logger.log('Analytics Data API access: OK');
  return 'Analytics Data API access: OK';
}

function parseDashboardPeriod(value) {
  const text = String(value == null ? '' : value).trim();
  if (!/^\d+$/.test(text)) return null;
  const period = Number(text);
  return DASHBOARD_ALLOWED_PERIODS.indexOf(period) >= 0 ? period : null;
}

function createDashboardDateRange(period) {
  const endDate = Utilities.formatDate(new Date(), DASHBOARD_TIME_ZONE, 'yyyy-MM-dd');
  return {
    startDate: shiftDashboardIsoDate(endDate, -(period - 1)),
    endDate: endDate
  };
}

function shiftDashboardIsoDate(isoDate, dayOffset) {
  const parts = String(isoDate).split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + dayOffset));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-');
}

function runDashboardPageViewsReport(propertyName, range) {
  return AnalyticsData.Properties.runReport({
    dateRanges: [range],
    dimensions: [
      { name: 'date' },
      { name: 'pagePath' }
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: dashboardAndFilter([
      dashboardExactFilter('eventName', 'page_view'),
      dashboardInListFilter('pagePath', DASHBOARD_PAGES.map(item => item.path))
    ]),
    limit: '100000'
  }, propertyName);
}

function runDashboardActivityReport(propertyName, range) {
  return AnalyticsData.Properties.runReport({
    dateRanges: [range],
    dimensions: [
      { name: 'date' },
      { name: 'eventName' },
      { name: 'customEvent:source_page' },
      { name: 'pagePath' }
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: dashboardInListFilter('eventName', [
      'view_search_results',
      'search_no_results',
      'click_view_example'
    ]),
    limit: '100000'
  }, propertyName);
}

function createDashboardPreviousDateRange(range, period) {
  const endDate = shiftDashboardIsoDate(range.startDate, -1);
  return {
    startDate: shiftDashboardIsoDate(endDate, -(period - 1)),
    endDate: endDate
  };
}

function runDashboardSearchMovesReport(propertyName, range) {
  return AnalyticsData.Properties.runReport({
    dateRanges: [range],
    dimensions: [
      { name: 'customEvent:source_page' },
      { name: 'customEvent:destination_page' },
      { name: 'customEvent:link_type' },
      { name: 'pagePath' }
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: dashboardExactFilter('eventName', 'search_page_move'),
    limit: '100000'
  }, propertyName);
}

function runDashboardTermsReport(propertyName, range) {
  return AnalyticsData.Properties.runReport({
    dateRanges: [range],
    dimensions: [
      { name: 'searchTerm' },
      { name: 'customEvent:source_page' },
      { name: 'pagePath' }
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: dashboardAndFilter([
      dashboardExactFilter('eventName', 'view_search_results'),
      dashboardInListFilter('customEvent:search_type', DASHBOARD_TERM_SEARCH_TYPES)
    ]),
    limit: '100000'
  }, propertyName);
}

function dashboardExactFilter(fieldName, value) {
  return {
    filter: {
      fieldName: fieldName,
      stringFilter: {
        matchType: 'EXACT',
        value: value,
        caseSensitive: true
      }
    }
  };
}

function dashboardInListFilter(fieldName, values) {
  return {
    filter: {
      fieldName: fieldName,
      inListFilter: {
        values: values.slice(),
        caseSensitive: true
      }
    }
  };
}

function dashboardAndFilter(expressions) {
  return { andGroup: { expressions: expressions } };
}

function buildDashboardAnalyticsResponse(period, range, reports) {
  const dailyByIso = {};
  enumerateDashboardDates(range.startDate, period).forEach(isoDate => {
    dailyByIso[isoDate] = {
      date: dashboardDisplayDate(isoDate),
      searches: 0,
      views: 0,
      exampleClicks: 0
    };
  });

  const pageByPath = {};
  DASHBOARD_PAGES.forEach(item => {
    pageByPath[item.path] = {
      page: item.page,
      path: item.path,
      views: 0,
      searchMoves: 0,
      searches: 0,
      exampleClicks: 0,
      topTerms: []
    };
  });

  dashboardReportRows(reports.pageViews, 2).forEach(row => {
    const isoDate = dashboardGaDateToIso(row.dimensions[0]);
    const path = normalizeDashboardPagePath(row.dimensions[1]);
    const count = dashboardCount(row.metrics[0]);
    if (pageByPath[path]) pageByPath[path].views += count;
    if (path === DASHBOARD_DICTIONARY_PATH && dailyByIso[isoDate]) {
      dailyByIso[isoDate].views += count;
    }
  });

  dashboardReportRows(reports.activity, 4).forEach(row => {
    const isoDate = dashboardGaDateToIso(row.dimensions[0]);
    const eventName = row.dimensions[1];
    const sourcePath = chooseDashboardSourcePath(row.dimensions[2], row.dimensions[3]);
    const count = dashboardCount(row.metrics[0]);

    if (dailyByIso[isoDate]) {
      if (DASHBOARD_SEARCH_EVENTS.indexOf(eventName) >= 0) {
        dailyByIso[isoDate].searches += count;
      } else if (eventName === 'click_view_example') {
        dailyByIso[isoDate].exampleClicks += count;
      }
    }

    if (!pageByPath[sourcePath]) return;
    if (DASHBOARD_SEARCH_EVENTS.indexOf(eventName) >= 0) {
      pageByPath[sourcePath].searches += count;
    } else if (eventName === 'click_view_example') {
      pageByPath[sourcePath].exampleClicks += count;
    }
  });

  const previousDaily = buildDashboardDailySeries(
    period,
    reports.previousRange || createDashboardPreviousDateRange(range, period),
    reports.previousPageViews,
    reports.previousActivity
  );

  const dictionaryExampleMoveCounts = {};
  DASHBOARD_DICTIONARY_EXAMPLE_DESTINATIONS.forEach(item => {
    dictionaryExampleMoveCounts[item.path] = 0;
  });

  dashboardReportRows(reports.searchMoves, 4).forEach(row => {
    const sourcePath = chooseDashboardSourcePath(row.dimensions[0], row.dimensions[3]);
    const destinationPath = normalizeDashboardPagePath(row.dimensions[1]);
    const linkType = String(row.dimensions[2] || '').trim();
    const count = dashboardCount(row.metrics[0]);

    if (pageByPath[sourcePath]) {
      pageByPath[sourcePath].searchMoves += count;
    }
    if (
      sourcePath === DASHBOARD_DICTIONARY_PATH &&
      linkType === 'example_search' &&
      Object.prototype.hasOwnProperty.call(dictionaryExampleMoveCounts, destinationPath)
    ) {
      dictionaryExampleMoveCounts[destinationPath] += count;
    }
  });

  const termAggregates = {};
  const pageTermCounts = {};
  dashboardReportRows(reports.terms, 3).forEach(row => {
    const rawTerm = String(row.dimensions[0] || '').trim();
    const normalizedTerm = normalizeDashboardTerm(rawTerm);
    const sourcePath = chooseDashboardSourcePath(row.dimensions[1], row.dimensions[2]);
    const count = dashboardCount(row.metrics[0]);
    if (!normalizedTerm || rawTerm === '(not set)' || count < 1) return;

    if (!termAggregates[normalizedTerm]) {
      termAggregates[normalizedTerm] = {
        key: normalizedTerm,
        searches: 0,
        variants: {},
        pages: {}
      };
    }
    const aggregate = termAggregates[normalizedTerm];
    aggregate.searches += count;
    aggregate.variants[rawTerm] = (aggregate.variants[rawTerm] || 0) + count;
    if (pageByPath[sourcePath]) {
      aggregate.pages[sourcePath] = (aggregate.pages[sourcePath] || 0) + count;
      if (!pageTermCounts[sourcePath]) pageTermCounts[sourcePath] = {};
      pageTermCounts[sourcePath][normalizedTerm] =
        (pageTermCounts[sourcePath][normalizedTerm] || 0) + count;
    }
  });

  const translationMap = readDashboardTranslationMap();
  const allTermEntries = Object.keys(termAggregates).map(key => {
    const aggregate = termAggregates[key];
    return {
      key: key,
      term: chooseDashboardTermVariant(aggregate.variants),
      searches: aggregate.searches,
      pages: aggregate.pages
    };
  }).sort(compareDashboardTermEntries);

  const displayTermByKey = {};
  allTermEntries.forEach(item => {
    displayTermByKey[item.key] = item.term;
  });

  DASHBOARD_PAGES.forEach(pageDefinition => {
    const counts = pageTermCounts[pageDefinition.path] || {};
    pageByPath[pageDefinition.path].topTerms = Object.keys(counts)
      .map(key => ({ key: key, count: counts[key] }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
      .slice(0, 3)
      .map(item => displayTermByKey[item.key] || item.key);
  });

  const terms = allTermEntries.slice(0, DASHBOARD_TERM_LIMIT).map(item => ({
    term: item.term,
    translation: translationMap[item.key] || '',
    searches: item.searches,
    pages: Object.keys(item.pages)
      .map(path => ({
        name: pageByPath[path].page,
        count: item.pages[path],
        pageOrder: dashboardPageOrder(path)
      }))
      .sort((a, b) => b.count - a.count || a.pageOrder - b.pageOrder)
      .map(itemPage => ({ name: itemPage.name, count: itemPage.count }))
  }));

  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    period: period,
    updatedAt: Utilities.formatDate(new Date(), DASHBOARD_TIME_ZONE, 'yyyy年M月d日 HH:mm'),
    range: { startDate: range.startDate, endDate: range.endDate },
    daily: Object.keys(dailyByIso).sort().map(date => dailyByIso[date]),
    previous: {
      range: {
        startDate: reports.previousRange
          ? reports.previousRange.startDate
          : createDashboardPreviousDateRange(range, period).startDate,
        endDate: reports.previousRange
          ? reports.previousRange.endDate
          : createDashboardPreviousDateRange(range, period).endDate
      },
      daily: previousDaily
    },
    pages: DASHBOARD_PAGES.map(item => pageByPath[item.path]),
    dictionaryExampleMoves: DASHBOARD_DICTIONARY_EXAMPLE_DESTINATIONS.map(item => ({
      composer: item.composer,
      path: item.path,
      count: dictionaryExampleMoveCounts[item.path]
    })),
    terms: terms
  };
}

function buildDashboardDailySeries(period, range, pageViewsReport, activityReport) {
  const dailyByIso = {};
  enumerateDashboardDates(range.startDate, period).forEach(isoDate => {
    dailyByIso[isoDate] = {
      date: dashboardDisplayDate(isoDate),
      searches: 0,
      views: 0,
      exampleClicks: 0
    };
  });

  dashboardReportRows(pageViewsReport, 2).forEach(row => {
    const isoDate = dashboardGaDateToIso(row.dimensions[0]);
    const path = normalizeDashboardPagePath(row.dimensions[1]);
    if (path === DASHBOARD_DICTIONARY_PATH && dailyByIso[isoDate]) {
      dailyByIso[isoDate].views += dashboardCount(row.metrics[0]);
    }
  });

  dashboardReportRows(activityReport, 4).forEach(row => {
    const isoDate = dashboardGaDateToIso(row.dimensions[0]);
    const eventName = row.dimensions[1];
    const count = dashboardCount(row.metrics[0]);
    if (!dailyByIso[isoDate]) return;
    if (DASHBOARD_SEARCH_EVENTS.indexOf(eventName) >= 0) {
      dailyByIso[isoDate].searches += count;
    } else if (eventName === 'click_view_example') {
      dailyByIso[isoDate].exampleClicks += count;
    }
  });

  return Object.keys(dailyByIso).sort().map(date => dailyByIso[date]);
}

function dashboardReportRows(report, dimensionCount) {
  return (report && report.rows ? report.rows : []).map(row => ({
    dimensions: Array.from({ length: dimensionCount }, (_, index) =>
      row.dimensionValues && row.dimensionValues[index]
        ? String(row.dimensionValues[index].value || '')
        : ''
    ),
    metrics: [
      row.metricValues && row.metricValues[0]
        ? String(row.metricValues[0].value || '0')
        : '0'
    ]
  }));
}

function dashboardCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.round(count) : 0;
}

function enumerateDashboardDates(startDate, period) {
  return Array.from({ length: period }, (_, index) =>
    shiftDashboardIsoDate(startDate, index)
  );
}

function dashboardGaDateToIso(value) {
  const text = String(value || '');
  if (!/^\d{8}$/.test(text)) return '';
  return text.slice(0, 4) + '-' + text.slice(4, 6) + '-' + text.slice(6, 8);
}

function dashboardDisplayDate(isoDate) {
  const parts = isoDate.split('-');
  return Number(parts[1]) + '/' + Number(parts[2]);
}

function normalizeDashboardPagePath(value) {
  let path = String(value || '').trim();
  if (!path || path === '(not set)') return '';
  try {
    if (/^https?:\/\//i.test(path)) path = new URL(path).pathname;
  } catch (error) {
    return '';
  }
  path = path.split(/[?#]/, 1)[0] || '/';
  if (path === '/gaswebapp-manual' || path === '/gaswebapp-manual/') {
    return '/gaswebapp-manual/';
  }
  if (path === '/') return '/';
  return '/' + path.replace(/^\/+|\/+$/g, '');
}

function chooseDashboardSourcePath(sourcePage, pagePath) {
  const explicitSource = normalizeDashboardPagePath(sourcePage);
  if (DASHBOARD_PAGES.some(item => item.path === explicitSource)) {
    return explicitSource;
  }
  const standardPagePath = normalizeDashboardPagePath(pagePath);
  return DASHBOARD_PAGES.some(item => item.path === standardPagePath)
    ? standardPagePath
    : '';
}

function normalizeDashboardTerm(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

function chooseDashboardTermVariant(variants) {
  return Object.keys(variants).sort((a, b) => {
    const countDifference = variants[b] - variants[a];
    if (countDifference) return countDifference;
    const lowerDifference = a.toLowerCase().localeCompare(b.toLowerCase());
    return lowerDifference || a.localeCompare(b);
  })[0] || '';
}

function compareDashboardTermEntries(a, b) {
  return b.searches - a.searches || a.key.localeCompare(b.key);
}

function dashboardPageOrder(path) {
  const index = DASHBOARD_PAGES.findIndex(item => item.path === path);
  return index < 0 ? DASHBOARD_PAGES.length : index;
}

function readDashboardTranslationMap() {
  const translations = {};
  try {
    const spreadsheetId = String(
      PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || ''
    ).trim();
    if (!spreadsheetId) return translations;
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Notes');
    if (!sheet || sheet.getLastRow() < 2) return translations;
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
    rows.forEach(row => {
      const key = normalizeDashboardTerm(row[0]);
      const translation = sanitizeDashboardTranslation(row[1]);
      if (key && translation && !translations[key]) translations[key] = translation;
    });
  } catch (error) {
    Logger.log('Dashboard translations unavailable: ' + String(error));
  }
  return translations;
}

function sanitizeDashboardTranslation(value) {
  const firstLine = String(value == null ? '' : value)
    .split(/\r?\n/)
    .map(line => line.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
    .find(Boolean) || '';
  if (firstLine.length <= 80) return firstLine;
  return firstLine.slice(0, 79) + '…';
}
