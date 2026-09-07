const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../src/mahler_server.js'), 'utf8');
const created = [];
let cachedSceneMap = null;
const context = vm.createContext({
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'spreadsheet-id' }) },
  HtmlService: {
    createHtmlOutput(html) {
      const output = {
        html,
        setTitle(title) { this.title = title; return this; }
      };
      created.push(output);
      return output;
    }
  },
  handleDashboardAnalyticsRequest: parameters => ({ route: 'dashboard', parameters }),
  handleRequest: parameters => ({ route: 'admin', parameters }),
  CacheService: { getScriptCache: () => ({
    get: () => null,
    put: (key, value) => { cachedSceneMap = { key, value }; }
  }) },
  SpreadsheetApp: { openById: id => ({
    getSheetByName: name => ({
      getDataRange: () => ({ getValues: () => [
        ['Oper', 'Aufzug', 'Szene', '日本語'],
        ['Tristan', 1, 2, '第1幕 第2場']
      ] })
    })
  }) },
  normalizeString: value => String(value).toLowerCase()
});
vm.runInContext(source, context);

assert.strictEqual(context.doGet({ parameter: { api: 'dashboard', period: '7' } }).route, 'dashboard');
assert.strictEqual(context.doGet({ parameter: { token: 'secret', action: 'syncInfo' } }).route, 'admin');
const landing = context.doGet({ parameter: { page: 'mahler' } });
assert.ok(landing.html.includes('https://yutaka-okawachi.github.io/gaswebapp-manual/'));
assert.ok(landing.html.includes('GitHub Pages版'));
assert.strictEqual(landing.title, '公開サイトへ移動します');
assert.strictEqual(source.includes('createTemplateFromFile'), false);
assert.strictEqual(source.includes('validPages'), false);
assert.strictEqual(created.length, 1);
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.getSceneMap('RW幕構成'))), {
  'tristan-1-2': '第1幕 第2場'
});
assert.strictEqual(cachedSceneMap.key, 'scene_map_v3_RW幕構成');
console.log('GAS routing and public-site redirect tests: OK');
