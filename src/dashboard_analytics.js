/**
 * Administrator dashboard aggregate API backed by the GA4 Data API.
 *
 * Public responses contain aggregate counts only. Raw search-history rows,
 * UserAgent values, client identifiers, and zero-result term lists are never
 * read or returned here.
 */

const DASHBOARD_SCHEMA_VERSION = 9;
const DASHBOARD_ENGLISH_LAUNCH_DATE = '2026-10-20';
const DASHBOARD_FIRST_LANGUAGE_COHORT_START = '2026-11-01';
const DASHBOARD_TIME_ZONE = 'Asia/Tokyo';
const DASHBOARD_ALLOWED_PERIODS = Object.freeze([7, 30, 90, 180]);
const DASHBOARD_CACHE_SECONDS = 900;
const DASHBOARD_LOCK_WAIT_MILLISECONDS = 30000;
const DASHBOARD_TERM_LIMIT = 50;
const DASHBOARD_WORK_LIMIT = 50;
const DASHBOARD_CITY_LIMIT = 30;
const DASHBOARD_COMPOSER_LABELS = Object.freeze({
  GM: 'Mahler',
  RW: 'Wagner',
  RS: 'R. Strauss'
});
const DASHBOARD_HOST_NAME = 'yutaka-okawachi.github.io';
const DASHBOARD_RETENTION_COHORT_COUNT = 12;
const DASHBOARD_RETENTION_END_OFFSET = 3;
const DASHBOARD_PAGE_TREND_MONTH_COUNT = 12;
const DASHBOARD_ACQUISITION_MONTH_COUNT = 12;
const DASHBOARD_ACQUISITION_SOURCE_LIMIT = 12;
const DASHBOARD_SEARCH_EVENTS = Object.freeze([
  'view_search_results',
  'search_no_results'
]);
const DASHBOARD_TERM_SEARCH_TYPES = Object.freeze([
  'gm_term',
  'rs_term',
  'rw_term'
]);
const DASHBOARD_SEARCH_METHODS = Object.freeze([
  {
    key: 'term',
    label: '用語から検索',
    searchTypes: ['gm_term', 'rs_term', 'rw_term']
  },
  {
    key: 'mahler_work',
    label: '曲名・楽器等から検索（Mahler）',
    searchTypes: ['gm_work']
  },
  {
    key: 'opera_work',
    label: '曲名・場面等から検索（Wagner / R. Strauss）',
    searchTypes: [
      'rs_work_scene',
      'rs_work_page',
      'rs_work_whom',
      'rw_work_scene',
      'rw_work_page',
      'rw_work_whom'
    ]
  },
  {
    key: 'unclassified',
    label: '分類情報なし（過去データ等）',
    searchTypes: []
  }
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
  { page: 'ドイツ語の音楽用語集', path: '/gaswebapp-manual/mahler-search-app/dic.html' },
  { page: '曲名と楽器等から検索 (GM)', path: '/gaswebapp-manual/mahler-search-app/mahler.html' },
  { page: '用語から検索 (GM)', path: '/gaswebapp-manual/mahler-search-app/terms_search.html' },
  { page: '用語から検索 (RS)', path: '/gaswebapp-manual/mahler-search-app/rs_terms_search.html' },
  { page: '用語から検索 (RW)', path: '/gaswebapp-manual/mahler-search-app/rw_terms_search.html' },
  { page: '曲名から検索 (RS)', path: '/gaswebapp-manual/mahler-search-app/richard_strauss.html' },
  { page: '曲名から検索 (RW)', path: '/gaswebapp-manual/mahler-search-app/richard_wagner.html' },
  { page: 'あらすじ集 (RS)', path: '/gaswebapp-manual/mahler-search-app/rs_synopsis.html' },
  { page: 'あらすじ集 (RW)', path: '/gaswebapp-manual/mahler-search-app/rw_synopsis.html' },
  { page: 'その他', path: '/gaswebapp-manual/mahler-search-app/other.html' },
  { page: 'プライバシーポリシー', path: '/gaswebapp-manual/privacy.html', group: 'auxiliary' },
  { page: 'ライセンス', path: '/gaswebapp-manual/license.html', group: 'auxiliary' }
]);

const DASHBOARD_DICTIONARY_PATH = '/gaswebapp-manual/mahler-search-app/dic.html';
const DASHBOARD_SEARCH_TYPE_PAGE_PATHS = Object.freeze({
  gm_term: '/gaswebapp-manual/mahler-search-app/terms_search.html',
  rs_term: '/gaswebapp-manual/mahler-search-app/rs_terms_search.html',
  rw_term: '/gaswebapp-manual/mahler-search-app/rw_terms_search.html',
  gm_work: '/gaswebapp-manual/mahler-search-app/mahler.html',
  rs_work_scene: '/gaswebapp-manual/mahler-search-app/richard_strauss.html',
  rs_work_page: '/gaswebapp-manual/mahler-search-app/richard_strauss.html',
  rs_work_whom: '/gaswebapp-manual/mahler-search-app/richard_strauss.html',
  rw_work_scene: '/gaswebapp-manual/mahler-search-app/richard_wagner.html',
  rw_work_page: '/gaswebapp-manual/mahler-search-app/richard_wagner.html',
  rw_work_whom: '/gaswebapp-manual/mahler-search-app/richard_wagner.html'
});
const DASHBOARD_SEARCH_ENABLED_PATHS = Object.freeze([
  '/gaswebapp-manual/mahler-search-app/mahler.html',
  '/gaswebapp-manual/mahler-search-app/terms_search.html',
  '/gaswebapp-manual/mahler-search-app/rs_terms_search.html',
  '/gaswebapp-manual/mahler-search-app/rw_terms_search.html',
  '/gaswebapp-manual/mahler-search-app/richard_strauss.html',
  '/gaswebapp-manual/mahler-search-app/richard_wagner.html'
]);

/**
 * GET/POST route entrypoint.
 * @param {Object} params Query-string or JSON body parameters.
 * @returns {TextOutput}
 */
function handleDashboardAnalyticsRequest(params) {
  // A separate read-only secret is kept on the Sites server and in Script Properties.
  // Never accept query-string credentials or fall back to the administrative token.
  const expected = PropertiesService.getScriptProperties().getProperty('DASHBOARD_API_TOKEN');
  if (typeof expected !== 'string' || expected.length < 32 ||
      expected === PropertiesService.getScriptProperties().getProperty('GAS_SECRET_TOKEN') || !params ||
      typeof params.dashboardToken !== 'string' || params.dashboardToken !== expected) {
    return createJsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Dashboard authentication required' } }, 401);
  }
  const period = parseDashboardPeriod(params && params.period);
  if (!period) {
    return createJsonResponse({
      error: {
        code: 'INVALID_PERIOD',
        message: 'period must be one of 7, 30, 90, 180'
      }
    });
  }

  const language = parseDashboardLanguage(params && params.language);
  if (!language) return createJsonResponse({ error: { code: 'INVALID_LANGUAGE', message: 'language must be all, ja, or en' } });
  try {
    return createJsonResponse(getDashboardAnalytics(period, language));
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
function getDashboardAnalytics(period, language) {
  language = language || 'all';
  if (!parseDashboardLanguage(language)) throw new Error('Invalid dashboard language');
  const propertyId = String(
    PropertiesService.getScriptProperties().getProperty('GA4_PROPERTY_ID') || ''
  ).trim();
  if (!/^\d+$/.test(propertyId)) {
    const configurationError = new Error('GA4_PROPERTY_ID is missing or invalid');
    configurationError.dashboardCode = 'CONFIGURATION_ERROR';
    throw configurationError;
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = 'admin_dashboard_analytics_v24_' + propertyId + '_' + period + '_' + language;
  const cachedResult = readDashboardCachedResult(cache, cacheKey);
  if (cachedResult) return cachedResult;

  const lock = typeof LockService !== 'undefined'
    ? LockService.getScriptLock()
    : null;
  let lockAcquired = false;
  try {
    if (lock) {
      lockAcquired = lock.tryLock(DASHBOARD_LOCK_WAIT_MILLISECONDS);
      if (lockAcquired) {
        const resultAfterWait = readDashboardCachedResult(cache, cacheKey);
        if (resultAfterWait) return resultAfterWait;
      }
    }

    const range = createDashboardDateRange(period);
    const previousRange = createDashboardPreviousDateRange(range, period);
    const propertyName = 'properties/' + propertyId;
    const reports = {
      pageViews: runDashboardPageViewsReport(propertyName, range, language),
      pageEngagement: runDashboardPageEngagementReport(propertyName, range, language),
      activity: runDashboardActivityReport(propertyName, range, language),
      exampleTimings: runDashboardExampleTimingReport(propertyName, range, language),
      searchMoves: runDashboardSearchMovesReport(propertyName, range, language),
      terms: runDashboardTermsReport(propertyName, range, language),
      works: runDashboardWorksReport(propertyName, range, language),
      cities: runDashboardCitiesReport(propertyName, range, language),
      previousRange: previousRange,
      previousPageViews: runDashboardPageViewsReport(propertyName, previousRange, language),
      previousPageEngagement: runDashboardPageEngagementReport(
        propertyName,
        previousRange,
        language
      ),
      previousActivity: runDashboardActivityReport(propertyName, previousRange, language)
    };
    reports.retention = getDashboardRetentionAnalytics(
      propertyName,
      cache,
      range.endDate,
      language
    );
    reports.pageTrends = getDashboardPageTrendAnalytics(
      propertyName,
      cache,
      range.endDate,
      language
    );
    reports.acquisition = getDashboardAcquisitionAnalytics(
      propertyName,
      cache,
      range.endDate,
      language
    );
    reports.pageEngagement = deduplicateDashboardEngagement_(propertyName, range, reports.pageEngagement, false, language);
    reports.previousPageEngagement = deduplicateDashboardEngagement_(propertyName, previousRange, reports.previousPageEngagement, false, language);
    const result = buildDashboardAnalyticsResponse(period, range, reports);
    applyDashboardLanguageMetadata_(result, language);

    try {
      cache.put(cacheKey, JSON.stringify(result), DASHBOARD_CACHE_SECONDS);
    } catch (error) {
      Logger.log('Dashboard cache write skipped: ' + String(error));
    }
    return result;
  } finally {
    if (lock && lockAcquired) lock.releaseLock();
  }
}

function readDashboardCachedResult(cache, cacheKey) {
  const cached = cache.get(cacheKey);
  if (!cached) return null;
  try {
    return JSON.parse(cached);
  } catch (error) {
    cache.remove(cacheKey);
    return null;
  }
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

function runDashboardPageViewsReport(propertyName, range, language) {
  return runDashboardLanguageReport_({
    dateRanges: [range],
    dimensions: [
      { name: 'date' },
      { name: 'pagePath' }
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: dashboardAndFilter([
      dashboardExactFilter('eventName', 'page_view'),
      dashboardInListFilter('pagePath', dashboardTrackedPagePaths_())
    ]),
    limit: '100000'
  }, propertyName, language, 'pagePath');
}

function runDashboardPageEngagementReport(propertyName, range, language) {
  return runDashboardLanguageReport_({
    dateRanges: [range],
    dimensions: [{ name: 'pagePath' }],
    metrics: [
      { name: 'userEngagementDuration' },
      { name: 'activeUsers' }
    ],
    dimensionFilter: dashboardInListFilter(
      'pagePath',
      dashboardTrackedPagePaths_()
    ),
    limit: '100000'
  }, propertyName, language, 'pagePath');
}

function runDashboardActivityReport(propertyName, range, language) {
  return runDashboardLanguageReport_({
    dateRanges: [range],
    dimensions: [
      { name: 'date' },
      { name: 'eventName' },
      { name: 'customEvent:source_page' },
      { name: 'pagePath' },
      { name: 'customEvent:search_type' },
      { name: 'customEvent:destination_page' }
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: dashboardInListFilter('eventName', [
      'view_search_results',
      'search_no_results',
      'view_example_search_results'
    ]),
    limit: '100000'
  }, propertyName, language, 'pagePath');
}

function createDashboardPreviousDateRange(range, period) {
  const endDate = shiftDashboardIsoDate(range.startDate, -1);
  return {
    startDate: shiftDashboardIsoDate(endDate, -(period - 1)),
    endDate: endDate
  };
}

function runDashboardSearchMovesReport(propertyName, range, language) {
  return runDashboardLanguageReport_({
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
  }, propertyName, language, 'pagePath');
}

function runDashboardTermsReport(propertyName, range, language) {
  return runDashboardLanguageReport_({
    dateRanges: [range],
    dimensions: [
      { name: 'searchTerm' },
      { name: 'customEvent:source_page' },
      { name: 'pagePath' },
      { name: 'customEvent:search_type' }
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: dashboardAndFilter([
      dashboardExactFilter('eventName', 'view_search_results'),
      dashboardInListFilter('customEvent:search_type', DASHBOARD_TERM_SEARCH_TYPES)
    ]),
    limit: '100000'
  }, propertyName, language, 'pagePath');
}

function runDashboardWorksReport(propertyName, range, language) {
  return runDashboardLanguageReport_({
    dateRanges: [range],
    dimensions: [
      { name: 'customEvent:work_id' },
      { name: 'customEvent:work_title' },
      { name: 'customEvent:composer' },
      { name: 'customEvent:search_type' },
      { name: 'pagePath' }
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: dashboardExactFilter('eventName', 'work_search_selection'),
    limit: '100000'
  }, propertyName, language, 'pagePath');
}

function runDashboardCitiesReport(propertyName, range, language) {
  return runDashboardLanguageReport_({
    dateRanges: [range],
    dimensions: [
      { name: 'city' },
      { name: 'country' }
    ],
    metrics: [
      { name: 'activeUsers' },
      { name: 'sessions' }
    ],
    dimensionFilter: dashboardHostFilter(),
    limit: '100000'
  }, propertyName, language, 'pagePath');
}

function getDashboardRetentionAnalytics(propertyName, cache, asOfDate, language) {
  const cacheKey = 'admin_dashboard_retention_v3_' + propertyName.replace('/', '_') + '_' + (language || 'all');
  const cachedResult = readDashboardCachedResult(cache, cacheKey);
  if (cachedResult) return cachedResult;

  const cohorts = createDashboardMonthlyCohorts(asOfDate);
  const selected = language && language !== 'all';
  let configured = !selected;
  if (selected) {
    try { const metadata = AnalyticsData.Properties.getMetadata(propertyName + '/metadata'); configured = (metadata.dimensions || []).some(item => item.apiName === 'customUser:gmt_initial_language'); } catch (_) { configured = false; }
  }
  const measuredCohorts = selected ? cohorts.filter(item => item.startDate >= DASHBOARD_FIRST_LANGUAGE_COHORT_START) : cohorts;
  const report = configured && measuredCohorts.length ? runDashboardRetentionReport(propertyName, measuredCohorts, language) : {};
  const result = buildDashboardRetentionResponse(asOfDate, cohorts, report);
  result.basis = selected ? 'first-visit-language' : 'all-users';
  result.measurementStart = selected ? DASHBOARD_FIRST_LANGUAGE_COHORT_START : null;
  result.availability = !configured ? 'not_configured' : selected && !measuredCohorts.length ? 'collecting' : 'available';
  if (selected) {
    result.rows.forEach(row => {
      if (!configured || row.month < DASHBOARD_FIRST_LANGUAGE_COHORT_START.slice(0, 7)) { row.firstVisitUsers = null; row.periods.forEach(period => { period.returningUsers = null; period.rate = null; period.status = 'unmeasured'; }); }
    });
    result.summary = { nextMonth: summarizeDashboardRetention(result.rows, 1), thirdMonth: summarizeDashboardRetention(result.rows, 3), latestFirstVisitUsers: result.rows.length ? result.rows[result.rows.length - 1].firstVisitUsers : null };
  }
  try {
    cache.put(cacheKey, JSON.stringify(result), DASHBOARD_CACHE_SECONDS);
  } catch (error) {
    Logger.log('Dashboard retention cache write skipped: ' + String(error));
  }
  return result;
}

function getDashboardPageTrendAnalytics(propertyName, cache, asOfDate, language) {
  const cacheKey = 'admin_dashboard_page_trends_v3_' + propertyName.replace('/', '_') + '_' + (language || 'all');
  const cachedResult = readDashboardCachedResult(cache, cacheKey);
  if (cachedResult) return cachedResult;

  const range = createDashboardPageTrendRange(asOfDate);
  const reports = {
    pageViews: runDashboardMonthlyPageViewsReport(propertyName, range, language),
    pageEngagement: runDashboardMonthlyPageEngagementReport(propertyName, range, language),
    activity: runDashboardMonthlyActivityReport(propertyName, range, language)
  };
  reports.pageEngagement = deduplicateDashboardEngagement_(propertyName, range, reports.pageEngagement, true, language);
  const result = buildDashboardPageTrendResponse(asOfDate, range, reports);
  try {
    cache.put(cacheKey, JSON.stringify(result), DASHBOARD_CACHE_SECONDS);
  } catch (error) {
    Logger.log('Dashboard page trend cache write skipped: ' + String(error));
  }
  return result;
}

function createDashboardPageTrendRange(asOfDate) {
  return {
    startDate: dashboardMonthStart(asOfDate, -(DASHBOARD_PAGE_TREND_MONTH_COUNT - 1)),
    endDate: asOfDate
  };
}

function runDashboardExampleTimingReport(propertyName, range, language) {
  return runDashboardLanguageReport_({
    dateRanges: [range],
    dimensions: [{ name: 'customEvent:destination_page' }],
    metrics: [
      { name: 'eventCount' },
      { name: 'eventValue' }
    ],
    dimensionFilter: dashboardExactFilter(
      'eventName',
      'dictionary_example_timing'
    ),
    limit: '100000'
  }, propertyName, language, 'pagePath');
}

function getDashboardAcquisitionAnalytics(propertyName, cache, asOfDate, language) {
  const cacheKey = 'admin_dashboard_acquisition_v3_' + propertyName.replace('/', '_') + '_' + (language || 'all');
  const cachedResult = readDashboardCachedResult(cache, cacheKey);
  if (cachedResult) return cachedResult;

  const range = createDashboardAcquisitionRange(asOfDate);
  const reports = {
    monthly: runDashboardMonthlyAcquisitionReport(propertyName, range, language),
    sources: runDashboardAcquisitionSourcesReport(propertyName, range, language),
    landingPages: runDashboardAcquisitionLandingPagesReport(propertyName, range, language),
    searches: runDashboardAcquisitionSearchesReport(propertyName, range, language)
  };
  const result = buildDashboardAcquisitionResponse(asOfDate, range, reports);
  try {
    cache.put(cacheKey, JSON.stringify(result), DASHBOARD_CACHE_SECONDS);
  } catch (error) {
    Logger.log('Dashboard acquisition cache write skipped: ' + String(error));
  }
  return result;
}

function createDashboardAcquisitionRange(asOfDate) {
  return {
    startDate: dashboardMonthStart(
      asOfDate,
      -(DASHBOARD_ACQUISITION_MONTH_COUNT - 1)
    ),
    endDate: asOfDate
  };
}

function dashboardHostFilter() {
  return dashboardExactFilter('hostName', DASHBOARD_HOST_NAME);
}

function runDashboardMonthlyAcquisitionReport(propertyName, range, language) {
  return runDashboardLanguageReport_({
    dateRanges: [range],
    dimensions: [
      { name: 'yearMonth' },
      { name: 'sessionDefaultChannelGroup' },
      { name: 'sessionMedium' }
    ],
    metrics: [{ name: 'sessions' }],
    dimensionFilter: dashboardHostFilter(),
    limit: '100000'
  }, propertyName, language, 'landingPage');
}

function runDashboardAcquisitionSourcesReport(propertyName, range, language) {
  return runDashboardLanguageReport_({
    dateRanges: [range],
    dimensions: [
      { name: 'sessionSourceMedium' },
      { name: 'sessionDefaultChannelGroup' },
      { name: 'sessionMedium' }
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' }
    ],
    dimensionFilter: dashboardHostFilter(),
    limit: '100000'
  }, propertyName, language, 'landingPage');
}

function runDashboardAcquisitionLandingPagesReport(propertyName, range, language) {
  return runDashboardLanguageReport_({
    dateRanges: [range],
    dimensions: [
      { name: 'sessionSourceMedium' },
      { name: 'landingPage' }
    ],
    metrics: [{ name: 'sessions' }],
    dimensionFilter: dashboardHostFilter(),
    limit: '100000'
  }, propertyName, language, 'landingPage');
}

function runDashboardAcquisitionSearchesReport(propertyName, range, language) {
  return runDashboardLanguageReport_({
    dateRanges: [range],
    dimensions: [{ name: 'sessionSourceMedium' }],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: dashboardAndFilter([
      dashboardHostFilter(),
      dashboardInListFilter('eventName', DASHBOARD_SEARCH_EVENTS)
    ]),
    limit: '100000'
  }, propertyName, language, 'landingPage');
}

function dashboardAcquisitionChannel(channel, medium) {
  const normalizedChannel = String(channel || '').trim().toLowerCase();
  const normalizedMedium = String(medium || '').trim().toLowerCase();
  if (normalizedChannel.indexOf('search') >= 0) return 'search';
  if (normalizedChannel === 'direct') return 'direct';
  if (
    ['referral', 'organic social', 'paid social', 'email', 'sms',
      'mobile push notifications', 'affiliates'].indexOf(normalizedChannel) >= 0 ||
    ['referral', 'social', 'email', 'sms', 'qr'].indexOf(normalizedMedium) >= 0
  ) {
    return 'referral';
  }
  return 'other';
}

function dashboardAcquisitionChannelDefinitions() {
  return [
    { key: 'referral', label: '紹介・共有' },
    { key: 'search', label: '検索' },
    { key: 'direct', label: '直接' },
    { key: 'other', label: 'その他' }
  ];
}

function dashboardLandingPageLabel(landingPage) {
  const path = String(landingPage || '').split('?')[0];
  const normalizedPath = normalizeDashboardPagePath(path);
  const page = DASHBOARD_PAGES.find(item => item.path === normalizedPath);
  return page ? page.page : (path && path !== '(not set)' ? path : '不明');
}

function buildDashboardAcquisitionResponse(asOfDate, range, reports) {
  const definitions = dashboardAcquisitionChannelDefinitions();
  const months = Array.from({ length: DASHBOARD_ACQUISITION_MONTH_COUNT }, (_, index) =>
    dashboardMonthStart(range.startDate, index).slice(0, 7)
  );
  const monthlyByMonth = {};
  months.forEach(month => {
    monthlyByMonth[month] = {
      month: month,
      totalSessions: 0,
      status: month === asOfDate.slice(0, 7) ? 'collecting' : 'complete',
      channels: definitions.map(item => ({
        key: item.key,
        label: item.label,
        sessions: 0,
        share: 0
      }))
    };
  });

  dashboardReportRows(reports.monthly, 3).forEach(row => {
    const month = dashboardGaMonthToIso(row.dimensions[0]);
    const target = monthlyByMonth[month];
    if (!target) return;
    const key = dashboardAcquisitionChannel(row.dimensions[1], row.dimensions[2]);
    const channel = target.channels.find(item => item.key === key);
    const sessions = dashboardCount(row.metrics[0]);
    if (channel) channel.sessions += sessions;
    target.totalSessions += sessions;
  });

  const summaryCounts = { referral: 0, search: 0, direct: 0, other: 0 };
  months.forEach(month => {
    const target = monthlyByMonth[month];
    target.channels.forEach(channel => {
      summaryCounts[channel.key] += channel.sessions;
      channel.share = target.totalSessions > 0
        ? Math.round((channel.sessions / target.totalSessions) * 1000) / 10
        : 0;
    });
  });
  const totalSessions = Object.keys(summaryCounts)
    .reduce((sum, key) => sum + summaryCounts[key], 0);

  const landingBySource = {};
  dashboardReportRows(reports.landingPages, 2).forEach(row => {
    const sourceMedium = String(row.dimensions[0] || '').trim() || '(not set)';
    const sessions = dashboardCount(row.metrics[0]);
    if (!landingBySource[sourceMedium] || sessions > landingBySource[sourceMedium].sessions) {
      landingBySource[sourceMedium] = {
        label: dashboardLandingPageLabel(row.dimensions[1]),
        sessions: sessions
      };
    }
  });

  const searchesBySource = {};
  dashboardReportRows(reports.searches, 1).forEach(row => {
    const sourceMedium = String(row.dimensions[0] || '').trim() || '(not set)';
    searchesBySource[sourceMedium] =
      (searchesBySource[sourceMedium] || 0) + dashboardCount(row.metrics[0]);
  });

  const sources = dashboardReportRows(reports.sources, 3)
    .map(row => {
      const sourceMedium = String(row.dimensions[0] || '').trim() || '(not set)';
      const sessions = dashboardCount(row.metrics[0]);
      const searches = searchesBySource[sourceMedium] || 0;
      const key = dashboardAcquisitionChannel(row.dimensions[1], row.dimensions[2]);
      const definition = definitions.find(item => item.key === key);
      return {
        sourceMedium: sourceMedium,
        channel: definition ? definition.label : 'その他',
        sessions: sessions,
        share: totalSessions > 0
          ? Math.round((sessions / totalSessions) * 1000) / 10
          : 0,
        engagementRate: Math.round(dashboardNumber(row.metrics[1]) * 1000) / 10,
        averageEngagementSeconds: Math.round(dashboardNumber(row.metrics[2]) * 10) / 10,
        searches: searches,
        searchesPerSession: sessions > 0
          ? Math.round((searches / sessions) * 100) / 100
          : 0,
        landingPage: landingBySource[sourceMedium]
          ? landingBySource[sourceMedium].label
          : '不明'
      };
    })
    .filter(item => item.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions || a.sourceMedium.localeCompare(b.sourceMedium))
    .slice(0, DASHBOARD_ACQUISITION_SOURCE_LIMIT);

  return {
    granularity: 'month',
    asOfDate: asOfDate,
    range: {
      startMonth: months[0],
      endMonth: months[months.length - 1]
    },
    totalSessions: totalSessions,
    summary: definitions.map(item => ({
      key: item.key,
      label: item.label,
      sessions: summaryCounts[item.key],
      share: totalSessions > 0
        ? Math.round((summaryCounts[item.key] / totalSessions) * 1000) / 10
        : 0
    })),
    months: months.map(month => monthlyByMonth[month]),
    sources: sources
  };
}

function runDashboardMonthlyPageViewsReport(propertyName, range, language) {
  return runDashboardLanguageReport_({
    dateRanges: [range],
    dimensions: [
      { name: 'yearMonth' },
      { name: 'pagePath' }
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: dashboardAndFilter([
      dashboardExactFilter('eventName', 'page_view'),
      dashboardInListFilter('pagePath', dashboardTrackedPagePaths_())
    ]),
    limit: '100000'
  }, propertyName, language, 'pagePath');
}

function runDashboardMonthlyPageEngagementReport(propertyName, range, language) {
  return runDashboardLanguageReport_({
    dateRanges: [range],
    dimensions: [
      { name: 'yearMonth' },
      { name: 'pagePath' }
    ],
    metrics: [
      { name: 'userEngagementDuration' },
      { name: 'activeUsers' }
    ],
    dimensionFilter: dashboardInListFilter(
      'pagePath',
      dashboardTrackedPagePaths_()
    ),
    limit: '100000'
  }, propertyName, language, 'pagePath');
}

function runDashboardMonthlyActivityReport(propertyName, range, language) {
  return runDashboardLanguageReport_({
    dateRanges: [range],
    dimensions: [
      { name: 'yearMonth' },
      { name: 'eventName' },
      { name: 'customEvent:source_page' },
      { name: 'pagePath' },
      { name: 'customEvent:search_type' }
    ],
    metrics: [{ name: 'eventCount' }],
    dimensionFilter: dashboardInListFilter('eventName', DASHBOARD_SEARCH_EVENTS),
    limit: '100000'
  }, propertyName, language, 'pagePath');
}

function buildDashboardPageTrendResponse(asOfDate, range, reports) {
  const months = Array.from({ length: DASHBOARD_PAGE_TREND_MONTH_COUNT }, (_, index) =>
    dashboardMonthStart(range.startDate, index).slice(0, 7)
  );
  const pageByPath = {};
  DASHBOARD_PAGES.forEach(item => {
    pageByPath[item.path] = {
      page: item.page,
      path: item.path,
      months: months.map(month => ({
        month: month,
        views: 0,
        averageEngagementSeconds: null,
        searches: DASHBOARD_SEARCH_ENABLED_PATHS.indexOf(item.path) >= 0 ? 0 : null,
        status: month === asOfDate.slice(0, 7) ? 'collecting' : 'complete'
      }))
    };
  });

  function findMonth(path, gaMonth) {
    const normalizedPath = normalizeDashboardPagePath(path);
    const month = dashboardGaMonthToIso(gaMonth);
    const page = pageByPath[normalizedPath];
    return page ? page.months.find(item => item.month === month) : null;
  }

  dashboardReportRows(reports.pageViews, 2).forEach(row => {
    const target = findMonth(row.dimensions[1], row.dimensions[0]);
    if (target) target.views += dashboardCount(row.metrics[0]);
  });

  dashboardReportRows(reports.pageEngagement, 2).forEach(row => {
    const target = findMonth(row.dimensions[1], row.dimensions[0]);
    if (!target) return;
    const engagementSeconds = dashboardNumber(row.metrics[0]);
    const activeUsers = dashboardCount(row.metrics[1]);
    target.averageEngagementSeconds = activeUsers > 0
      ? Math.round((engagementSeconds / activeUsers) * 10) / 10
      : null;
  });

  dashboardReportRows(reports.activity, 5).forEach(row => {
    if (DASHBOARD_SEARCH_EVENTS.indexOf(row.dimensions[1]) < 0) return;
    const sourcePath = chooseDashboardSearchSourcePath(
      row.dimensions[2],
      row.dimensions[3],
      row.dimensions[4]
    );
    const target = findMonth(sourcePath, row.dimensions[0]);
    if (target && target.searches !== null) {
      target.searches += dashboardCount(row.metrics[0]);
    }
  });

  return {
    granularity: 'month',
    asOfDate: asOfDate,
    range: {
      startMonth: months[0],
      endMonth: months[months.length - 1]
    },
    pages: DASHBOARD_PAGES.map(item => pageByPath[item.path])
  };
}

function createDashboardMonthlyCohorts(asOfDate) {
  const cohorts = [];
  for (let index = DASHBOARD_RETENTION_COHORT_COUNT; index >= 1; index -= 1) {
    const startDate = dashboardMonthStart(asOfDate, -index);
    const month = startDate.slice(0, 7);
    cohorts.push({
      name: 'month_' + month.replace('-', '_'),
      month: month,
      startDate: startDate,
      endDate: dashboardMonthEnd(startDate)
    });
  }
  return cohorts;
}

function runDashboardRetentionReport(propertyName, cohorts, language) {
  return runDashboardLanguageReport_({
    dimensions: [
      { name: 'cohort' },
      { name: 'cohortNthMonth' }
    ],
    metrics: [
      { name: 'cohortActiveUsers' },
      { name: 'cohortTotalUsers' }
    ],
    cohortSpec: {
      cohorts: cohorts.map(item => ({
        name: item.name,
        dimension: 'firstSessionDate',
        dateRange: {
          startDate: item.startDate,
          endDate: item.endDate
        }
      })),
      cohortsRange: {
        granularity: 'MONTHLY',
        startOffset: 0,
        endOffset: DASHBOARD_RETENTION_END_OFFSET
      }
    },
    dimensionFilter: dashboardExactFilter('hostName', DASHBOARD_HOST_NAME),
    keepEmptyRows: true,
    limit: '100000'
  }, propertyName, language, 'customUser:gmt_initial_language');
}

function buildDashboardRetentionResponse(asOfDate, cohorts, report) {
  const rowsByName = {};
  cohorts.forEach(item => {
    rowsByName[item.name] = {
      month: item.month,
      firstVisitUsers: 0,
      periods: Array.from(
        { length: DASHBOARD_RETENTION_END_OFFSET + 1 },
        (_, offset) => {
          const periodEnd = dashboardMonthEnd(
            dashboardMonthStart(item.startDate, offset)
          );
          return {
            offset: offset,
            returningUsers: null,
            rate: null,
            status: periodEnd < asOfDate ? 'complete' : 'collecting'
          };
        }
      )
    };
  });

  dashboardReportRows(report, 2).forEach(reportRow => {
    const cohortName = String(reportRow.dimensions[0] || '');
    const offset = Number(String(reportRow.dimensions[1] || '').replace(/^0+/, '') || 0);
    const target = rowsByName[cohortName];
    if (!target || offset < 0 || offset > DASHBOARD_RETENTION_END_OFFSET) return;
    const activeUsers = dashboardCount(reportRow.metrics[0]);
    const totalUsers = dashboardCount(reportRow.metrics[1]);
    target.firstVisitUsers = Math.max(target.firstVisitUsers, totalUsers);
    target.periods[offset].returningUsers = activeUsers;
  });

  const rows = cohorts.map(item => {
    const row = rowsByName[item.name];
    row.periods.forEach(period => {
      if (period.status === 'complete' && period.returningUsers == null) {
        period.returningUsers = 0;
      }
      if (period.returningUsers != null && row.firstVisitUsers > 0) {
        period.rate = dashboardRoundRate(
          period.returningUsers,
          row.firstVisitUsers
        );
      }
    });
    return row;
  });

  return {
    granularity: 'month',
    asOfDate: asOfDate,
    summary: {
      nextMonth: summarizeDashboardRetention(rows, 1),
      thirdMonth: summarizeDashboardRetention(rows, 3),
      latestFirstVisitUsers: rows.length > 0
        ? rows[rows.length - 1].firstVisitUsers
        : 0
    },
    rows: rows
  };
}

function summarizeDashboardRetention(rows, offset) {
  let returningUsers = 0;
  let eligibleUsers = 0;
  rows.forEach(row => {
    const period = row.periods[offset];
    if (!period || period.status !== 'complete' || row.firstVisitUsers < 1) return;
    eligibleUsers += row.firstVisitUsers;
    returningUsers += period.returningUsers || 0;
  });
  return {
    returningUsers: returningUsers,
    eligibleUsers: eligibleUsers,
    rate: eligibleUsers > 0
      ? dashboardRoundRate(returningUsers, eligibleUsers)
      : null
  };
}

function dashboardRoundRate(numerator, denominator) {
  return denominator > 0
    ? Math.round((numerator / denominator) * 1000) / 10
    : null;
}

function dashboardMonthStart(isoDate, monthOffset) {
  const parts = String(isoDate).split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1 + monthOffset, 1));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    '01'
  ].join('-');
}

function dashboardMonthEnd(monthStart) {
  const parts = String(monthStart).split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1], 0));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-');
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
  const seriesMap = createDashboardPeriodSeriesMap(range.startDate, period);
  const dailyByBucket = seriesMap.seriesByBucket;
  const dateToBucketKey = seriesMap.dateToBucketKey;

  const pageByPath = {};
  DASHBOARD_PAGES.forEach(item => {
    pageByPath[item.path] = {
      page: item.page,
      path: item.path,
      views: 0,
      averageEngagementSeconds: 0,
      searchMoves: 0,
      searches: 0,
      exampleClicks: 0,
      topTerms: [],
      previous: {
        views: 0,
        averageEngagementSeconds: 0,
        searches: 0
      }
    };
  });

  dashboardReportRows(reports.pageViews, 2).forEach(row => {
    const isoDate = dashboardGaDateToIso(row.dimensions[0]);
    const path = normalizeDashboardPagePath(row.dimensions[1]);
    const count = dashboardCount(row.metrics[0]);
    if (pageByPath[path]) {
      pageByPath[path].views += count;
    }
    const bucketKey = dateToBucketKey[isoDate];
    if (pageByPath[path] && bucketKey && dailyByBucket[bucketKey]) {
      dailyByBucket[bucketKey].views += count;
    }
  });

  dashboardReportRows(reports.pageEngagement, 1).forEach(row => {
    const path = normalizeDashboardPagePath(row.dimensions[0]);
    if (!pageByPath[path]) return;
    const engagementSeconds = dashboardNumber(row.metrics[0]);
    const activeUsers = dashboardCount(row.metrics[1]);
    pageByPath[path].averageEngagementSeconds = activeUsers > 0
      ? Math.round((engagementSeconds / activeUsers) * 10) / 10
      : 0;
  });

  dashboardReportRows(reports.activity, 6).forEach(row => {
    const isoDate = dashboardGaDateToIso(row.dimensions[0]);
    const eventName = row.dimensions[1];
    const sourcePath = chooseDashboardSearchSourcePath(
      row.dimensions[2],
      row.dimensions[3],
      row.dimensions[4]
    );
    const count = dashboardCount(row.metrics[0]);

    const bucketKey = dateToBucketKey[isoDate];
    if (bucketKey && dailyByBucket[bucketKey]) {
      if (DASHBOARD_SEARCH_EVENTS.indexOf(eventName) >= 0) {
        if (sourcePath) dailyByBucket[bucketKey].searches += count;
      } else if (eventName === 'view_example_search_results') {
        dailyByBucket[bucketKey].exampleClicks += count;
      }
    }

    if (!pageByPath[sourcePath]) return;
    if (DASHBOARD_SEARCH_EVENTS.indexOf(eventName) >= 0) {
      pageByPath[sourcePath].searches += count;
    } else if (eventName === 'view_example_search_results') {
      pageByPath[sourcePath].exampleClicks += count;
    }
  });

  dashboardReportRows(reports.previousPageViews, 2).forEach(row => {
    const path = normalizeDashboardPagePath(row.dimensions[1]);
    if (pageByPath[path]) {
      pageByPath[path].previous.views += dashboardCount(row.metrics[0]);
    }
  });

  dashboardReportRows(reports.previousPageEngagement, 1).forEach(row => {
    const path = normalizeDashboardPagePath(row.dimensions[0]);
    if (!pageByPath[path]) return;
    const engagementSeconds = dashboardNumber(row.metrics[0]);
    const activeUsers = dashboardCount(row.metrics[1]);
    pageByPath[path].previous.averageEngagementSeconds = activeUsers > 0
      ? Math.round((engagementSeconds / activeUsers) * 10) / 10
      : 0;
  });

  dashboardReportRows(reports.previousActivity, 6).forEach(row => {
    if (DASHBOARD_SEARCH_EVENTS.indexOf(row.dimensions[1]) < 0) return;
    const sourcePath = chooseDashboardSearchSourcePath(
      row.dimensions[2],
      row.dimensions[3],
      row.dimensions[4]
    );
    if (pageByPath[sourcePath]) {
      pageByPath[sourcePath].previous.searches += dashboardCount(row.metrics[0]);
    }
  });

  const previousDaily = buildDashboardDailySeries(
    period,
    reports.previousRange || createDashboardPreviousDateRange(range, period),
    reports.previousPageViews,
    reports.previousActivity
  );
  const searchSummary = buildDashboardSearchSummary(reports.activity);
  const previousSearchSummary = buildDashboardSearchSummary(
    reports.previousActivity
  );
  const searchMethods = buildDashboardSearchMethods(reports.activity);

  const dictionaryExampleMoveCounts = {};
  DASHBOARD_DICTIONARY_EXAMPLE_DESTINATIONS.forEach(item => {
    dictionaryExampleMoveCounts[item.path] = 0;
  });

  dashboardReportRows(reports.activity, 6).forEach(row => {
    if (row.dimensions[1] !== 'view_example_search_results') return;
    const destinationPath =
      normalizeDashboardPagePath(row.dimensions[5]) ||
      DASHBOARD_SEARCH_TYPE_PAGE_PATHS[String(row.dimensions[4] || '').trim()] ||
      '';
    if (Object.prototype.hasOwnProperty.call(dictionaryExampleMoveCounts, destinationPath)) {
      dictionaryExampleMoveCounts[destinationPath] += dashboardCount(row.metrics[0]);
    }
  });

  dashboardReportRows(reports.searchMoves, 4).forEach(row => {
    const sourcePath = chooseDashboardSourcePath(row.dimensions[0], row.dimensions[3]);
    const count = dashboardCount(row.metrics[0]);

    if (pageByPath[sourcePath]) {
      pageByPath[sourcePath].searchMoves += count;
    }
  });

  const dictionaryExamplePerformance = buildDashboardDictionaryExamplePerformance(
    reports.exampleTimings
  );

  const termAggregates = {};
  const pageTermCounts = {};
  dashboardReportRows(reports.terms, 4).forEach(row => {
    const rawTerm = String(row.dimensions[0] || '').trim();
    const normalizedTerm = normalizeDashboardTerm(rawTerm);
    const sourcePath = chooseDashboardSearchSourcePath(
      row.dimensions[1],
      row.dimensions[2],
      row.dimensions[3]
    );
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
  const englishTranslationMap = readDashboardTranslationMap('en');
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
    translationEn: englishTranslationMap[item.key] || '',
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

  const workAggregates = {};
  dashboardReportRows(reports.works, 5).forEach(row => {
    const workId = String(row.dimensions[0] || '').trim();
    const workTitle = String(row.dimensions[1] || '').trim().replace(/\s+/g, ' ');
    const composerCode = String(row.dimensions[2] || '').trim().toUpperCase();
    const searchType = String(row.dimensions[3] || '').trim();
    const composer = DASHBOARD_COMPOSER_LABELS[composerCode];
    const count = dashboardCount(row.metrics[0]);
    if (
      !workId ||
      workId === '(not set)' ||
      !workTitle ||
      workTitle === '(not set)' ||
      !composer ||
      !DASHBOARD_SEARCH_TYPE_PAGE_PATHS[searchType] ||
      count < 1
    ) return;

    const key = composerCode + '|' + workId;
    if (!workAggregates[key]) {
      workAggregates[key] = {
        workId: workId,
        composer: composer,
        searches: 0,
        titles: {},
        languageCounts: { ja: 0, en: 0, unknown: 0 }
      };
    }
    const aggregate = workAggregates[key];
    aggregate.searches += count;
    aggregate.languageCounts[dashboardSiteLanguage_('', row.dimensions[4])] += count;
    aggregate.titles[workTitle] = (aggregate.titles[workTitle] || 0) + count;
  });

  const works = Object.keys(workAggregates)
    .map(key => {
      const aggregate = workAggregates[key];
      return {
        workId: aggregate.workId,
        workTitle: chooseDashboardTermVariant(aggregate.titles),
        composer: aggregate.composer,
        searches: aggregate.searches,
        languageCounts: aggregate.languageCounts
      };
    })
    .sort((a, b) =>
      b.searches - a.searches ||
      a.composer.localeCompare(b.composer) ||
      a.workTitle.localeCompare(b.workTitle)
    )
    .slice(0, DASHBOARD_WORK_LIMIT);

  return {
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    period: period,
    updatedAt: Utilities.formatDate(new Date(), DASHBOARD_TIME_ZONE, 'yyyy年M月d日 HH:mm'),
    range: { startDate: range.startDate, endDate: range.endDate },
    granularity: period === 180 ? 'week' : 'day',
    daily: seriesMap.orderedKeys.map(key => dailyByBucket[key]),
    previous: {
      range: {
        startDate: reports.previousRange
          ? reports.previousRange.startDate
          : createDashboardPreviousDateRange(range, period).startDate,
        endDate: reports.previousRange
          ? reports.previousRange.endDate
          : createDashboardPreviousDateRange(range, period).endDate
      },
      daily: previousDaily,
      searchSummary: previousSearchSummary
    },
    searchSummary: searchSummary,
    languageSummary: buildDashboardLanguageSummary_(reports.pageViews, reports.activity),
    searchMethods: searchMethods,
    retention: reports.retention || buildDashboardRetentionResponse(
      range.endDate,
      createDashboardMonthlyCohorts(range.endDate),
      {}
    ),
    pageTrends: reports.pageTrends || buildDashboardPageTrendResponse(
      range.endDate,
      createDashboardPageTrendRange(range.endDate),
      {}
    ),
    acquisition: reports.acquisition || buildDashboardAcquisitionResponse(
      range.endDate,
      createDashboardAcquisitionRange(range.endDate),
      {}
    ),
    pages: DASHBOARD_PAGES.map(item => pageByPath[item.path]),
    dictionaryExampleMoves: DASHBOARD_DICTIONARY_EXAMPLE_DESTINATIONS.map(item => ({
      composer: item.composer,
      path: item.path,
      count: dictionaryExampleMoveCounts[item.path]
    })),
    dictionaryExamplePerformance: dictionaryExamplePerformance,
    terms: terms,
    works: works,
    cities: buildDashboardCities(reports.cities)
  };
}

function buildDashboardCities(report) {
  const cityAggregates = {};
  dashboardReportRows(report, 2).forEach(row => {
    const rawCity = String(row.dimensions[0] || '').trim();
    const rawCountry = String(row.dimensions[1] || '').trim();
    const activeUsers = dashboardCount(row.metrics[0]);
    const sessions = dashboardCount(row.metrics[1]);

    const isCityNotSet = !rawCity || rawCity === '(not set)';
    const isCountryNotSet = !rawCountry || rawCountry === '(not set)';

    const city = isCityNotSet ? '特定不能/その他' : rawCity;
    const country = isCountryNotSet ? '(not set)' : rawCountry;

    let displayName;
    if (isCityNotSet && isCountryNotSet) {
      displayName = '特定不能/その他';
    } else if (isCityNotSet) {
      displayName = '特定不能/その他 (' + country + ')';
    } else if (isCountryNotSet) {
      displayName = city;
    } else {
      displayName = city + ' (' + country + ')';
    }

    const key = city + '|' + country;
    if (!cityAggregates[key]) {
      cityAggregates[key] = {
        city: city,
        country: country,
        displayName: displayName,
        users: 0,
        sessions: 0
      };
    }
    cityAggregates[key].users += activeUsers;
    cityAggregates[key].sessions += sessions;
  });

  return Object.keys(cityAggregates)
    .map(key => cityAggregates[key])
    .filter(item => item.users > 0 || item.sessions > 0)
    .sort((a, b) =>
      b.users - a.users ||
      b.sessions - a.sessions ||
      a.displayName.localeCompare(b.displayName)
    )
    .slice(0, DASHBOARD_CITY_LIMIT);
}

function buildDashboardDictionaryExamplePerformance(report) {
  const byPath = {};
  DASHBOARD_DICTIONARY_EXAMPLE_DESTINATIONS.forEach(item => {
    byPath[item.path] = {
      composer: item.composer,
      path: item.path,
      sampleCount: 0,
      totalMilliseconds: 0
    };
  });

  dashboardReportRows(report, 1).forEach(row => {
    const path = normalizeDashboardPagePath(row.dimensions[0]);
    if (!byPath[path]) return;
    byPath[path].sampleCount += dashboardCount(row.metrics[0]);
    byPath[path].totalMilliseconds += dashboardNumber(row.metrics[1]);
  });

  const composers = DASHBOARD_DICTIONARY_EXAMPLE_DESTINATIONS.map(item => {
    const aggregate = byPath[item.path];
    return {
      composer: aggregate.composer,
      path: aggregate.path,
      sampleCount: aggregate.sampleCount,
      averageMilliseconds: aggregate.sampleCount > 0
        ? Math.round(aggregate.totalMilliseconds / aggregate.sampleCount)
        : null
    };
  });
  const sampleCount = composers.reduce((sum, item) => sum + item.sampleCount, 0);
  const totalMilliseconds = Object.keys(byPath).reduce(
    (sum, path) => sum + byPath[path].totalMilliseconds,
    0
  );

  return {
    sampleCount: sampleCount,
    averageMilliseconds: sampleCount > 0
      ? Math.round(totalMilliseconds / sampleCount)
      : null,
    composers: composers
  };
}

function buildDashboardSearchSummary(activityReport) {
  const summary = {
    withResults: 0,
    noResults: 0,
    successRate: 0
  };

  dashboardReportRows(activityReport, 6).forEach(row => {
    const eventName = row.dimensions[1];
    if (DASHBOARD_SEARCH_EVENTS.indexOf(eventName) < 0) return;
    const sourcePath = chooseDashboardSearchSourcePath(
      row.dimensions[2],
      row.dimensions[3],
      row.dimensions[4]
    );
    if (!sourcePath) return;
    const count = dashboardCount(row.metrics[0]);
    if (eventName === 'view_search_results') {
      summary.withResults += count;
    } else {
      summary.noResults += count;
    }
  });

  const total = summary.withResults + summary.noResults;
  summary.successRate = total > 0
    ? Math.round((summary.withResults / total) * 1000) / 10
    : 0;
  return summary;
}

function buildDashboardSearchMethods(activityReport) {
  const counts = {};
  DASHBOARD_SEARCH_METHODS.forEach(method => {
    counts[method.key] = 0;
  });

  dashboardReportRows(activityReport, 6).forEach(row => {
    if (DASHBOARD_SEARCH_EVENTS.indexOf(row.dimensions[1]) < 0) return;
    const sourcePath = chooseDashboardSearchSourcePath(
      row.dimensions[2],
      row.dimensions[3],
      row.dimensions[4]
    );
    if (!sourcePath) return;
    const searchType = String(row.dimensions[4] || '').trim();
    const methodKey = chooseDashboardSearchMethodKey(sourcePath, searchType);
    counts[methodKey] += dashboardCount(row.metrics[0]);
  });

  return DASHBOARD_SEARCH_METHODS.map(method => ({
    key: method.key,
    label: method.label,
    count: counts[method.key]
  }));
}

function chooseDashboardSearchMethodKey(sourcePath, searchType) {
  const normalizedPath = normalizeDashboardPagePath(sourcePath);
  if ([
    DASHBOARD_SEARCH_TYPE_PAGE_PATHS.gm_term,
    DASHBOARD_SEARCH_TYPE_PAGE_PATHS.rs_term,
    DASHBOARD_SEARCH_TYPE_PAGE_PATHS.rw_term
  ].indexOf(normalizedPath) >= 0) {
    return 'term';
  }
  if (normalizedPath === DASHBOARD_SEARCH_TYPE_PAGE_PATHS.gm_work) {
    return 'mahler_work';
  }
  if ([
    DASHBOARD_SEARCH_TYPE_PAGE_PATHS.rs_work_scene,
    DASHBOARD_SEARCH_TYPE_PAGE_PATHS.rw_work_scene
  ].indexOf(normalizedPath) >= 0) {
    return 'opera_work';
  }

  const method = DASHBOARD_SEARCH_METHODS.find(item =>
    item.searchTypes.indexOf(String(searchType || '').trim()) >= 0
  );
  return method ? method.key : 'unclassified';
}

function buildDashboardDailySeries(period, range, pageViewsReport, activityReport) {
  const seriesMap = createDashboardPeriodSeriesMap(range.startDate, period);
  const dailyByBucket = seriesMap.seriesByBucket;
  const dateToBucketKey = seriesMap.dateToBucketKey;

  dashboardReportRows(pageViewsReport, 2).forEach(row => {
    const isoDate = dashboardGaDateToIso(row.dimensions[0]);
    const path = normalizeDashboardPagePath(row.dimensions[1]);
    const bucketKey = dateToBucketKey[isoDate];
    if (DASHBOARD_PAGES.some(item => item.path === path) && bucketKey && dailyByBucket[bucketKey]) {
      dailyByBucket[bucketKey].views += dashboardCount(row.metrics[0]);
    }
  });

  dashboardReportRows(activityReport, 6).forEach(row => {
    const isoDate = dashboardGaDateToIso(row.dimensions[0]);
    const eventName = row.dimensions[1];
    const count = dashboardCount(row.metrics[0]);
    const bucketKey = dateToBucketKey[isoDate];
    if (!bucketKey || !dailyByBucket[bucketKey]) return;
    if (DASHBOARD_SEARCH_EVENTS.indexOf(eventName) >= 0) {
      const sourcePath = chooseDashboardSearchSourcePath(
        row.dimensions[2],
        row.dimensions[3],
        row.dimensions[4]
      );
      if (sourcePath) dailyByBucket[bucketKey].searches += count;
    } else if (eventName === 'view_example_search_results') {
      dailyByBucket[bucketKey].exampleClicks += count;
    }
  });

  return seriesMap.orderedKeys.map(key => dailyByBucket[key]);
}

function dashboardReportRows(report, dimensionCount) {
  return (report && report.rows ? report.rows : []).map(row => ({
    dimensions: Array.from({ length: dimensionCount }, (_, index) =>
      row.dimensionValues && row.dimensionValues[index]
        ? String(row.dimensionValues[index].value || '')
        : ''
    ),
    metrics: row.metricValues && row.metricValues.length
      ? row.metricValues.map(metric => String(metric.value || '0'))
      : ['0']
  }));
}

function dashboardNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
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

function createDashboardWeeks(startDate, period) {
  const weekCount = Math.ceil(period / 7);
  return Array.from({ length: weekCount }, (_, weekIndex) => {
    const startOffset = weekIndex * 7;
    const endOffset = Math.min(startOffset + 6, period - 1);
    const weekStart = shiftDashboardIsoDate(startDate, startOffset);
    const weekEnd = shiftDashboardIsoDate(startDate, endOffset);
    const dates = [];
    for (let day = startOffset; day <= endOffset; day += 1) {
      dates.push(shiftDashboardIsoDate(startDate, day));
    }
    return {
      key: 'week_' + weekIndex,
      index: weekIndex,
      startDate: weekStart,
      endDate: weekEnd,
      label: dashboardDisplayDate(weekStart) + '-' + dashboardDisplayDate(weekEnd),
      dates: dates
    };
  });
}

function createDashboardPeriodSeriesMap(startDate, period) {
  if (period === 180) {
    const weeks = createDashboardWeeks(startDate, period);
    const seriesByBucket = {};
    const dateToBucketKey = {};
    weeks.forEach(week => {
      seriesByBucket[week.key] = {
        date: week.label,
        searches: 0,
        views: 0,
        exampleClicks: 0
      };
      week.dates.forEach(isoDate => {
        dateToBucketKey[isoDate] = week.key;
      });
    });
    return {
      seriesByBucket: seriesByBucket,
      dateToBucketKey: dateToBucketKey,
      orderedKeys: weeks.map(w => w.key)
    };
  }

  const seriesByBucket = {};
  const dateToBucketKey = {};
  const orderedKeys = enumerateDashboardDates(startDate, period);
  orderedKeys.forEach(isoDate => {
    seriesByBucket[isoDate] = {
      date: dashboardDisplayDate(isoDate),
      searches: 0,
      views: 0,
      exampleClicks: 0
    };
    dateToBucketKey[isoDate] = isoDate;
  });
  return {
    seriesByBucket: seriesByBucket,
    dateToBucketKey: dateToBucketKey,
    orderedKeys: orderedKeys
  };
}

function dashboardGaDateToIso(value) {
  const text = String(value || '');
  if (!/^\d{8}$/.test(text)) return '';
  return text.slice(0, 4) + '-' + text.slice(4, 6) + '-' + text.slice(6, 8);
}

function dashboardGaMonthToIso(value) {
  const text = String(value || '');
  if (!/^\d{6}$/.test(text)) return '';
  return text.slice(0, 4) + '-' + text.slice(4, 6);
}

function dashboardDisplayDate(isoDate) {
  const parts = isoDate.split('-');
  return Number(parts[1]) + '/' + Number(parts[2]);
}

function dashboardTrackedPagePaths_() {
  const paths = DASHBOARD_PAGES.map(item => item.path);
  paths.push('/gaswebapp-manual/index.html');
  return paths.concat(paths.map(value => value.replace('/gaswebapp-manual/', '/gaswebapp-manual/en/')));
}

function dashboardSiteLanguage_(sourcePage, pagePath) {
  for (const candidate of [pagePath, sourcePage]) {
    const canonical = normalizeDashboardPagePath(candidate);
    if (!DASHBOARD_PAGES.some(item => item.path === canonical)) continue;
    let raw = String(candidate || '').trim();
    try { if (/^https?:\/\//i.test(raw)) raw = new URL(raw).pathname; } catch (_) { continue; }
    return /^\/gaswebapp-manual\/en(?:\/|$)/.test(raw) ? 'en' : 'ja';
  }
  return 'unknown';
}

function buildDashboardLanguageSummary_(pageViewsReport, activityReport) {
  const rows = ['ja', 'en', 'unknown'].map(language => ({
    language: language,
    label: language === 'ja' ? 'Japanese' : language === 'en' ? 'English' : '言語情報なし（過去データ等）',
    views: 0, searches: 0, withResults: 0, noResults: 0, exampleClicks: 0
  }));
  const byLanguage = {};
  rows.forEach(row => { byLanguage[row.language] = row; });
  dashboardReportRows(pageViewsReport, 2).forEach(row => {
    if (!DASHBOARD_PAGES.some(item => item.path === normalizeDashboardPagePath(row.dimensions[1]))) return;
    byLanguage[dashboardSiteLanguage_('', row.dimensions[1])].views += dashboardCount(row.metrics[0]);
  });
  dashboardReportRows(activityReport, 6).forEach(row => {
    const eventName = row.dimensions[1];
    const bucket = byLanguage[dashboardSiteLanguage_(row.dimensions[2], row.dimensions[3])];
    const count = dashboardCount(row.metrics[0]);
    if (DASHBOARD_SEARCH_EVENTS.indexOf(eventName) >= 0) {
      if (!chooseDashboardSearchSourcePath(row.dimensions[2], row.dimensions[3], row.dimensions[4])) return;
      bucket.searches += count;
      bucket[eventName === 'view_search_results' ? 'withResults' : 'noResults'] += count;
    } else if (eventName === 'view_example_search_results') {
      bucket.exampleClicks += count;
    }
  });
  return { basis: 'site-page-path', rows: rows };
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
  path = path.replace(/^\/gaswebapp-manual\/en(?=\/|$)/, '/gaswebapp-manual');
  if (path === '/gaswebapp-manual/index.html') path = '/gaswebapp-manual/';
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

function chooseDashboardSearchSourcePath(sourcePage, pagePath, searchType) {
  const attributedPath = chooseDashboardSourcePath(sourcePage, pagePath);
  if (attributedPath) return attributedPath;
  return DASHBOARD_SEARCH_TYPE_PAGE_PATHS[String(searchType || '').trim()] || '';
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

function readDashboardTranslationMap(column) {
  column = column || 'ja';
  const translations = {};
  try {
    const spreadsheetId = String(
      PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || ''
    ).trim();
    if (!spreadsheetId) return translations;
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('Notes');
    if (!sheet || sheet.getLastRow() < 2) return translations;
    const rows = namedSheetRead_(sheet, ['de', column], 2, sheet.getLastRow() - 1).values;
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


function parseDashboardLanguage(value) {
  if (value != null && typeof value !== 'string') return null;
  const language = value == null || value === '' ? 'all' : String(value);
  return ['all', 'ja', 'en'].indexOf(language) >= 0 ? language : null;
}

function dashboardLanguageRequest_(request, language, basis) {
  const filters = [dashboardHostFilter()];
  if (request.dimensionFilter) filters.push(request.dimensionFilter);
  if (language && language !== 'all') {
    if (basis === 'customUser:gmt_initial_language') {
      filters.push(dashboardExactFilter(basis, language));
    } else {
      filters.push(dashboardInListFilter(
        basis || 'pagePath',
        dashboardTrackedPagePaths_().filter(path => dashboardSiteLanguage_('', path) === language)
      ));
    }
  }
  request.dimensionFilter = dashboardAndFilter(filters);
  return request;
}

function runDashboardLanguageReport_(request, propertyName, language, basis) {
  return AnalyticsData.Properties.runReport(
    dashboardLanguageRequest_(request, language, basis), propertyName
  );
}

/** Re-query logical pages with aliases in GA, so active users are deduplicated.
 * Summing per-language activeUsers would count bilingual users twice. */
function deduplicateDashboardEngagement_(propertyName, range, report, monthly, language) {
  const pathIndex = monthly ? 1 : 0;
  const groups = {};
  (report.rows || []).forEach(row => {
    const raw = row.dimensionValues[pathIndex].value;
    const key = normalizeDashboardPagePath(raw);
    if (!groups[key]) groups[key] = new Set();
    groups[key].add(raw);
  });
  const duplicates = Object.keys(groups).filter(key => groups[key].size > 1 && DASHBOARD_PAGES.some(item => item.path === key));
  if (!duplicates.length) return report;
  const rows = (report.rows || []).filter(row => duplicates.indexOf(normalizeDashboardPagePath(row.dimensionValues[pathIndex].value)) < 0);
  const requests = duplicates.map(path => dashboardLanguageRequest_({
    dateRanges: [range],
    dimensions: monthly ? [{ name: 'yearMonth' }] : [],
    metrics: [{ name: 'userEngagementDuration' }, { name: 'activeUsers' }],
    dimensionFilter: dashboardInListFilter('pagePath', Array.from(groups[path])),
    limit: '100000'
  }, language, 'pagePath'));
  // Five is the GA4 batch API limit; batching avoids a request round trip per page.
  for (let offset = 0; offset < requests.length; offset += 5) {
    const batch = requests.slice(offset, offset + 5);
    const reports = typeof AnalyticsData.Properties.batchRunReports === 'function'
      ? AnalyticsData.Properties.batchRunReports({ requests: batch }, propertyName).reports
      : batch.map(request => AnalyticsData.Properties.runReport(request, propertyName));
    if (!reports || reports.length !== batch.length) throw new Error('Incomplete engagement batch response');
    reports.forEach((aggregate, index) => {
      const path = duplicates[offset + index];
      (aggregate.rows || []).forEach(row => rows.push({
        dimensionValues: monthly ? [row.dimensionValues[0], { value: path }] : [{ value: path }],
        metricValues: row.metricValues
      }));
    });
  }
  return { rows: rows };
}

function applyDashboardLanguageMetadata_(result, language) {
  result.selectedLanguage = language;
  result.measurement = {
    englishLaunchDate: DASHBOARD_ENGLISH_LAUNCH_DATE,
    recentDataStatus: 'collecting',
    comparisonIncludesBeforeLaunch: language === 'en' && result.previous.range.startDate < DASHBOARD_ENGLISH_LAUNCH_DATE
  };
  result.pages.forEach(page => {
    page.group = DASHBOARD_PAGES.find(item => item.path === page.path).group || 'main';
  });
  if (language !== 'en') return result;
  result.pageTrends.pages.forEach(page => page.months.forEach(month => {
    if (month.month < DASHBOARD_ENGLISH_LAUNCH_DATE.slice(0, 7)) {
      month.status = 'before_launch';
      month.views = null;
      month.searches = null;
      month.averageEngagementSeconds = null;
    } else if (month.month === DASHBOARD_ENGLISH_LAUNCH_DATE.slice(0, 7)) {
      month.partial = true;
    }
  }));
  result.acquisition.months.forEach(month => {
    if (month.month < DASHBOARD_ENGLISH_LAUNCH_DATE.slice(0, 7)) month.status = 'before_launch';
  });
  [
    { rows: result.daily, range: result.range },
    { rows: result.previous.daily, range: result.previous.range }
  ].forEach(series => series.rows.forEach((day, index) => {
    const start = shiftDashboardIsoDate(series.range.startDate, index * (result.period === 180 ? 7 : 1));
    const bucketEnd = shiftDashboardIsoDate(start, result.period === 180 ? 6 : 0);
    const end = bucketEnd > series.range.endDate ? series.range.endDate : bucketEnd;
    day.status = end < DASHBOARD_ENGLISH_LAUNCH_DATE ? 'before_launch'
      : start < DASHBOARD_ENGLISH_LAUNCH_DATE ? 'partial' : 'measured';
  }));
  return result;
}
