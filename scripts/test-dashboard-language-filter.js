'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const requests = [], cache = new Map();
const c = vm.createContext({ URL, console, Logger: { log() {} }, AnalyticsData: { Properties: {
  runReport(request) { requests.push(request); return { rows: [{ dimensionValues: request.dimensions.length ? [{ value: '202610' }] : [], metricValues: [{ value: '420' }, { value: '2' }] }] }; },
  getMetadata() { return { dimensions: [{ apiName: 'customUser:gmt_initial_language' }] }; }
} } });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/dashboard_analytics.js'), 'utf8'), c);
const plain = value => JSON.parse(JSON.stringify(value));
const filters = expression => expression.filter ? [expression.filter] : (expression.andGroup?.expressions || []).flatMap(filters);
const range = { startDate: '2026-10-01', endDate: '2026-10-21' };
const ja = '/gaswebapp-manual/mahler-search-app/terms_search.html', en = ja.replace('/gaswebapp-manual/', '/gaswebapp-manual/en/');
assert.equal(c.parseDashboardLanguage(undefined), 'all');
for (const invalid of ['EN', '../en', 'en ', ['en', 'ja'], {}, 1]) assert.equal(c.parseDashboardLanguage(invalid), null);
for (const name of ['PageViews','PageEngagement','Activity','ExampleTiming','SearchMoves','Terms','Works','Cities','MonthlyPageViews','MonthlyPageEngagement','MonthlyActivity']) {
  c['runDashboard' + name + 'Report']('properties/test', range, 'en');
  const request = requests.at(-1), parts = filters(request.dimensionFilter);
  assert(parts.some(item => item.fieldName === 'hostName'));
  const language = parts.findLast(item => item.fieldName === 'pagePath');
  assert(language.inListFilter.values.length >= 14);
  assert(language.inListFilter.values.every(value => value.startsWith('/gaswebapp-manual/en/')));
  if (name === 'Cities') assert.deepEqual(plain(request.dimensions), [{ name: 'city' }, { name: 'country' }], 'GA deduplicates users without grouping by language or page');
}
for (const name of ['MonthlyAcquisition','AcquisitionSources','AcquisitionLandingPages','AcquisitionSearches']) {
  c['runDashboard' + name + 'Report']('properties/test', range, 'ja');
  const language = filters(requests.at(-1).dimensionFilter).find(item => item.fieldName === 'landingPage');
  assert(language.inListFilter.values.includes(ja));
  assert(language.inListFilter.values.every(value => !value.includes('/en/')));
}
const row = (dimensions, seconds, users) => ({ dimensionValues: dimensions.map(value => ({ value })), metricValues: [{ value: String(seconds) }, { value: String(users) }] });
for (const monthly of [false, true]) {
  const rows = [row(monthly ? ['202610', ja] : [ja], 120, 2), row(monthly ? ['202610', en] : [en], 300, 1)];
  for (const input of [rows, rows.slice().reverse()]) {
    const result = c.deduplicateDashboardEngagement_('properties/test', range, { rows: input }, monthly, 'all');
    assert.equal(result.rows.length, 1);
    assert.deepEqual(plain(result.rows[0].metricValues), [{ value: '420' }, { value: '2' }]);
    const request = requests.at(-1);
    assert.deepEqual(plain(request.dimensions), monthly ? [{ name: 'yearMonth' }] : []);
  }
}
const cacheService = { get: key => cache.get(key), put: (key, value) => cache.set(key, value) };
const retention = c.getDashboardRetentionAnalytics('properties/test', cacheService, '2026-10-21', 'en');
assert.equal(retention.availability, 'collecting');
assert(retention.rows.every(row => row.firstVisitUsers === null && row.periods.every(period => period.status === 'unmeasured')));
c.AnalyticsData.Properties.getMetadata = () => ({ dimensions: [] });
assert.equal(c.getDashboardRetentionAnalytics('properties/unconfigured', cacheService, '2027-02-01', 'en').availability, 'not_configured');
c.AnalyticsData.Properties.getMetadata = () => ({ dimensions: [{ apiName: 'customUser:gmt_initial_language' }] });
c.getDashboardRetentionAnalytics('properties/configured', cacheService, '2027-02-01', 'ja');
const cohortRequest = requests.at(-1);
assert(cohortRequest.cohortSpec.cohorts.every(cohort => cohort.dateRange.startDate >= '2026-11-01'));
assert(filters(cohortRequest.dimensionFilter).some(item => item.fieldName === 'customUser:gmt_initial_language' && item.stringFilter.value === 'ja'));
assert(!filters(cohortRequest.dimensionFilter).some(item => item.fieldName === 'pagePath'), 'revisits in either language remain in the first-language cohort');
assert(c.dashboardTrackedPagePaths_().includes('/gaswebapp-manual/en/mahler-search-app/notes.html'));
assert(c.dashboardTrackedPagePaths_().includes('/gaswebapp-manual/privacy.html'));
c.Utilities = { formatDate: () => '2026-10-21' };
const works = { rows: [
  { dimensionValues: ['gm_1', '交響曲第1番', 'GM', 'gm_work', ja].map(value => ({ value })), metricValues: [{ value: '3' }] },
  { dimensionValues: ['gm_1', 'Symphony No. 1', 'GM', 'gm_work', en].map(value => ({ value })), metricValues: [{ value: '5' }] }
] };
const result = c.buildDashboardAnalyticsResponse(7, { startDate: '2026-10-15', endDate: '2026-10-21' }, { works, retention });
assert.equal(result.works.length, 1, 'translated titles share one work identity');
assert.deepEqual(plain(result.works[0].languageCounts), { ja: 3, en: 5, unknown: 0 });
assert.equal(result.works[0].searches, 8);
c.applyDashboardLanguageMetadata_(result, 'en');
assert.equal(result.daily[0].status, 'before_launch');
assert.equal(result.daily[5].status, 'measured');
assert(result.pageTrends.pages[0].months.slice(0, -1).every(month => month.status === 'before_launch' && month.views === null));
assert.equal(result.pageTrends.pages[0].months.at(-1).partial, true);
assert.equal(result.pages.find(page => page.path.endsWith('/privacy.html')).group, 'auxiliary');
const duplicatePaths = c.dashboardTrackedPagePaths_().filter(value => !value.includes('/en/')).slice(0, 7);
let batchCalls = 0;
c.AnalyticsData.Properties.batchRunReports = request => {
  batchCalls += 1;
  assert(request.requests.length <= 5);
  return { reports: request.requests.map(() => ({ rows: [row([], 420, 2)] })) };
};
const duplicateRows = duplicatePaths.flatMap(value => [row([value], 120, 2), row([value.replace('/gaswebapp-manual/', '/gaswebapp-manual/en/')], 300, 1)]);
assert.equal(c.deduplicateDashboardEngagement_('properties/test', range, { rows: duplicateRows }, false, 'all').rows.length, 7);
assert.equal(batchCalls, 2, 'multiple logical pages are batched in groups of five');
c.AnalyticsData.Properties.batchRunReports = () => ({ reports: [] });
assert.throws(() => c.deduplicateDashboardEngagement_('properties/test', range, { rows: duplicateRows }, false, 'all'), /Incomplete engagement/);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(result));
console.log('dashboard language filters, deduplicated engagement and first-language cohorts: OK');
