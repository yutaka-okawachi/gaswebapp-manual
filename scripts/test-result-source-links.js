'use strict';
const assert = require('assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { extractFunction } = require('./test-utils/extract-function');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pdf = 'https://www.gustav-mahler.org/fileadmin/archiv/musikalische_quellen_n/N_FG_14.pdf#page=31';
const library = 'https://www.gustav-mahler.org/libraryid/10540';
const escape = text => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hrefs = html => [...html.matchAll(/<a href="([^"]*)" target="_blank" rel="noopener noreferrer">/g)].map(m => m[1]);
let checks = 0;
for (const language of ['ja', 'en']) {
  const prefix = language === 'en' ? 'en/' : '';
  const text = language === 'ja' ? `資料（${pdf}）。\n参照：${library}` : `Source (${pdf}).\nSee ${library}`;
  const row = {de:'vorklingend',de_normalized:'vorklingend',ja:text,data:'M-1-1-1-all&'};
  const before = JSON.stringify(row);
  const nodes = [];
  const document = {documentElement:{lang:language},getElementById:id=>id==='result-list'?{appendChild:fragment=>nodes.push(...fragment.children)}:null,
    createDocumentFragment:()=>({children:[],appendChild(node){this.children.push(node);}}),
    createElement:()=>({classList:{add(){}},style:{},innerHTML:''})};
  const window = {__SITE_LANGUAGE__:language,addEventListener(){},appData:{mahler:[row],dic_terms_index:{}},
    location:{pathname:'/'+prefix+'mahler-search-app/terms_search.html',search:''},aReverseMap:{},aMapping:{},dReverseMap:{},dMapping:{all:'all'}};
  const context = vm.createContext({window,document,console,URL,URLSearchParams,setTimeout,clearTimeout,navigator:{userAgent:'test'}});
  vm.runInContext(read(prefix+'mahler-search-app/js/app.js'), context);
  const format = value => window.formatGmTranslation(value, row);
  assert.deepEqual(hrefs(format(text)), [pdf,library]);
  assert(format(text).includes('<br>'));
  assert(format(text).includes(`>${pdf}</a>`));
  assert.equal(window.formatNotationTranslation(text,row),format(text),'RW/RS shared formatter');
  for (const url of ['http://example.org/a', 'https://example.org/a_(b)', 'https://example.org/a[b]', 'https://example.org/?a=1&b=2', pdf]) {
    const result = format(`(${url}).`);
    assert.deepEqual(hrefs(result),[escape(url)]);
    assert(result.endsWith('</a>).'));
    checks++;
  }
  assert.deepEqual(hrefs(format(`「${library}」、【${pdf}】。`)),[library,pdf]);
  for (const value of ['javascript:alert(1)','data:text/html,<script>alert(1)</script>','ftp://example.org/a','https://','https://?q=1','https://[bad]/a','https://example.org:99999/','https://user:pass@example.org/','https://example.org/%ZZ','javascript:https://example.org/a','https://example.org\\evil']) {
    assert.deepEqual(hrefs(format(value)),[],value);
    assert(!format(value).includes('<script>'));
    checks++;
  }
  const anchor = `<a href="${library}">${library}</a>`;
  assert.equal(format(anchor),escape(anchor),'Raw existing anchors stay escaped without nested links');
  const xss = `<img src=x onerror="alert(1)"> & <script>alert(1)</script>\n${library}?q=%22%3E&x=%3Cscript%3E`;
  assert(format(xss).startsWith(escape(xss.split('\n')[0])+'<br>'));
  assert(!/<img|<script|onerror="/.test(format(xss)));
  assert.deepEqual(hrefs(format(xss)),[library+'?q=%22%3E&amp;x=%3Cscript%3E']);
  assert.equal(format(null),'');
  const renderer = window.renderMusicNotationDirection;
  delete window.renderMusicNotationDirection;
  assert.deepEqual(hrefs(format(text)),[pdf,library],'Fallback also links safely');
  window.renderMusicNotationDirection = renderer;
  const musicRow = JSON.parse(read(prefix+'mahler-search-app/data/mahler.json')).find(row=>row.data==='M-5-3-136-dir&');
  const music = window.formatGmTranslation('[musical example] ［譜例］ '+pdf,musicRow);
  assert(music.includes('data:image/svg+xml,'),'Notation remains rendered');
  assert.deepEqual(hrefs(music),[pdf]);
  for (let repeat=0;repeat<3;repeat++) {
    const result = window.searchMahlerTermsLocal('vorklingend',{},'partial');
    assert.deepEqual(hrefs(result),[pdf,library],'Generated bundle term search');
  }
  const page = read(prefix+'mahler-search-app/terms_search.html');
  const inline = [...page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('Override/Define searchMahlerTermsLocal'));
  assert(inline);
  vm.runInContext(inline,context);
  for(let repeat=0;repeat<3;repeat++) assert.deepEqual(hrefs(window.searchMahlerTermsLocal('vorklingend',{},'partial')),[pdf,library],'Actual page override');
  context.results = [{...row,locs:['1'],count:1}];
  vm.runInContext('let currentSearchResults=results,currentSearchIndex=0;const SEARCH_BATCH_SIZE=50;let searchObserver=null;'+extractFunction(read(prefix+'mahler-search-app/mahler.html'),'loadMoreSearchResults')+';loadMoreSearchResults();',context);
  assert.equal(nodes.length,1);
  assert.deepEqual(hrefs(nodes[0].innerHTML),[pdf,library],'Work/instrument result DOM');
  assert.equal(JSON.stringify(row),before,'Input remains unchanged after repeat searches');
  assert(/\.result-c\s*\{[^}]*overflow-wrap:\s*anywhere/.test(read(prefix+'mahler-search-app/css/common.css')));
  checks+=14;
}
console.log('Result source links: '+checks+' JA/EN safety, notation, bundle and page-rendering cases passed.');
