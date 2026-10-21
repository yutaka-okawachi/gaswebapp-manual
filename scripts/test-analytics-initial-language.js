'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../mahler-search-app/js/analytics.js'), 'utf8');
function visit(pathname, store, hostname = 'yutaka-okawachi.github.io', search = '') {
  const events = [];
  const storage = { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
  const window = { location: { hostname, pathname, search }, localStorage: storage, sessionStorage: storage, dataLayer: [], addEventListener() {}, setTimeout() {} };
  const c = vm.createContext({ window, document: { addEventListener() {} }, URLSearchParams, URL, console });
  vm.runInContext(source, c);
  window.dataLayer.forEach(args => events.push(Array.from(args)));
  return events;
}
const store = new Map();
let events = visit('/gaswebapp-manual/en/', store);
assert.equal(events[0][0], 'set');
assert.equal(events[0][1], 'user_properties');
assert.equal(events[0][2].gmt_initial_language, 'en');
events = visit('/gaswebapp-manual/', store);
assert.equal(events[0][2].gmt_initial_language, 'en', 'first language persists across language switch');
assert.equal(visit('/gaswebapp-manual/', new Map(), 'localhost').length, 0);
assert.equal(visit('/gaswebapp-manual/', new Map(), 'yutaka-okawachi.github.io', '?admin=1').length, 0);
assert.equal(visit('/another-project/', new Map()).length, 0);
assert.equal(visit('/gaswebapp-manual/', new Map([['gmt_admin_device_optout', '1']])).length, 0);
console.log('initial-language analytics property: stable across languages; admin and local previews excluded: OK');
