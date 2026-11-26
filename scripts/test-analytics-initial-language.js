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

function exerciseAdmin(search, blocked, pathname) {
  const items = new Map(), callbacks = {}, badges = [];
  let sent = 0;
  const storage = {getItem: key => items.get(key) || null, setItem: (key,value) => items.set(key,value), removeItem:key => items.delete(key)};
  const window = { location: { hostname:'yutaka-okawachi.github.io', pathname, search },
    dataLayer:[], addEventListener(){}, setTimeout(){},
    sendSearchNotification: async () => { sent++; }
  };
  if (blocked) Object.defineProperty(window,'localStorage',{get(){throw Error('Storage restricted');}});
  else window.localStorage=storage;
  const document = { addEventListener(name, cb){callbacks[name]=cb;}, getElementById:()=>null,
    createElement:()=>({style:{},setAttribute(){}}), body:{appendChild:node=>badges.push(node)}, querySelector:()=>({}) };
  vm.runInContext(source, vm.createContext({window,document,URLSearchParams,URL,console:{info(){}}}));
  callbacks.DOMContentLoaded();
  return {window, badges, items, sent:()=>sent};
}
for (const [pathname, text] of [['/gaswebapp-manual/','このページのみ'],['/gaswebapp-manual/en/','this page only']]) {
  const run=exerciseAdmin('?admin=1',true,pathname);
  assert(run.window.isAdminDeviceOptOut());
  assert(run.window.__gaAdminOptOut && run.window['ga-disable-G-ZT6MPW5MNG']);
  assert(run.window.sendSearchNotification.__adminOptOutWrapped);
  assert.equal(run.sent(),0);
  assert(run.badges[0].textContent.includes(text));
  assert(!exerciseAdmin('',true,pathname).window.isAdminDeviceOptOut(), 'No persisted flag on a new page');
  assert(!exerciseAdmin('?admin=0',true,pathname).window.isAdminDeviceOptOut());
  const stored=exerciseAdmin('?admin=1',false,pathname);
  assert.equal(stored.items.get('gmt_admin_device_optout'),'1');
  assert(!stored.badges[0].textContent.includes(text));
}
console.log('Admin mode works on the current page when storage is unavailable, with a bilingual notice.');
