'use strict';const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),requests=[],c=vm.createContext({URL,console,AnalyticsData:{Properties:{runReport:request=>{requests.push(request);return{rows:[]};}}}});
vm.runInContext(fs.readFileSync(path.join(root,'src/dashboard_analytics.js'),'utf8'),c);
const ja='/gaswebapp-manual/mahler-search-app/terms_search.html',en='/gaswebapp-manual/en/mahler-search-app/terms_search.html';
const report=rows=>({rows:rows.map(([dimensions,count])=>({dimensionValues:dimensions.map(value=>({value})),metricValues:[{value:String(count)}]}))});
const pageViews=report([[[ '20261020',ja],8],[[ '20261020',en],12],[[ '20261020','/gaswebapp-manual/en/index.html'],3],[[ '20261020','/unrelated'],99]]);
const activity=report([
 [['20261020','view_search_results',ja,ja,'gm_term',''],4],
 [['20261020','view_search_results',en,en,'gm_term',''],6],
 [['20261020','search_no_results',en,en,'gm_term',''],2],
 [['20261020','view_example_search_results','/gaswebapp-manual/en/mahler-search-app/dic.html',en,'gm_term',en],3],
 [['20261020','view_search_results','(not set)','(not set)','gm_term',''],1],
 [['20261020','view_search_results','(not set)','(not set)','not-a-search',''],80],
 [['20261020','view_example_search_results','(not set)','(not set)','',''],2]
]);
const result=JSON.parse(JSON.stringify(c.buildDashboardLanguageSummary_(pageViews,activity)));
assert.equal(result.basis,'site-page-path');const [j,e,u]=result.rows;
assert.deepEqual([j.language,j.views,j.searches,j.withResults,j.noResults,j.exampleClicks],['ja',8,4,4,0,0]);
assert.deepEqual([e.language,e.views,e.searches,e.withResults,e.noResults,e.exampleClicks],['en',15,8,6,2,3]);
assert.deepEqual([u.language,u.views,u.searches,u.withResults,u.noResults,u.exampleClicks],['unknown',0,1,1,0,2]);
assert.equal(result.rows.reduce((sum,row)=>sum+row.searches,0),13);
assert.equal(c.normalizeDashboardPagePath(en),ja);
assert.equal(c.normalizeDashboardPagePath('/gaswebapp-manual/en/index.html'),'/gaswebapp-manual/');
assert.equal(c.dashboardSiteLanguage_('https://example.invalid'+en,'(not set)'),'en');
assert.equal(c.dashboardSiteLanguage_(ja,en),'en','Physical event page takes priority over old source_page values');
assert.equal(c.dashboardSiteLanguage_('(not set)','(not set)'),'unknown');
c.runDashboardPageViewsReport('properties/mock',{startDate:'2026-10-20',endDate:'2026-10-20'});
const serialized=JSON.stringify(requests[0]);assert(serialized.includes(en));assert(serialized.includes(ja));assert(serialized.includes('/gaswebapp-manual/en/index.html'));
assert.equal(c.dashboardTrackedPagePaths_().length,new Set(c.dashboardTrackedPagePaths_()).size);
assert.equal(c.buildDashboardLanguageSummary_({rows:[]},{rows:[]}).rows.length,3);
console.log('Dashboard language summary: mixed Japanese/English/legacy data, totals, English path filters and unchanged logical page grouping passed; no live GA4 calls.');
