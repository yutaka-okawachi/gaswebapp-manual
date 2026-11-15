'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const c=vm.createContext({}),baseline=vm.createContext({});
for(const ctx of [c,baseline])vm.runInContext(fs.readFileSync('src/dictionary_notation.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('src/generate_dic_html.js','utf8'),c);
vm.runInContext(fs.readFileSync('src/generate_dic_html.js','utf8'),baseline);
vm.runInContext('removeReviewedEnglishTermLinks = function(rendered) { return rendered; };',baseline);
const rows=JSON.parse(fs.readFileSync('en/mahler-search-app/data/dic_notes.json','utf8'));
const index=JSON.parse(fs.readFileSync('en/mahler-search-app/data/dic_terms_index.json','utf8'));
const snapshot=JSON.stringify(rows);
const before=baseline.generateDicListHtml(rows,index,null,null,'en');
const after=c.generateDicListHtml(rows,index,null,null,'en');
const links=s=>s.match(/<a href="#[^"]+" class="term-link">[^<]*<\/a>/g)||[];
const visible=s=>s.replace(/<[^>]*>/g,'');
assert.equal(visible(after),visible(before));

const oldLinks=links(before),newLinks=links(after);assert(newLinks.every(l=>oldLinks.includes(l)));
// All approved legitimate and unresolved candidate occurrences keep their links.
const approvedOrdinals=[7, 8, 9, 84, 85, 157, 165, 203, 299, 300, 304, 307, 315, 404, 451, 526, 544, 553, 561, 658, 675, 771, 774, 854, 909, 975, 1013, 1022, 1064, 1085, 1106, 1140, 1156, 1161, 1172, 1178, 1188, 1191, 1196, 1252, 1314, 1329, 1335, 1374, 1378, 1406, 1586, 1672, 1784, 1801, 1839, 1878, 1892, 1935, 1955, 2123, 2185, 2233, 2364, 2409, 2410, 2586, 2620, 2676, 2769, 2779, 2782, 2823, 2832, 2841, 2893, 2908, 2911, 3018, 3027, 3056, 3067, 3231, 3263, 3269, 3292, 3453, 3586, 3602, 3824, 3849, 3851, 3887, 3890, 3959, 3961, 3965, 3973, 4099, 4110, 4175, 4186, 4188, 4190, 4246, 4257, 4261, 4282, 4287, 4305, 4316, 4320, 4324, 4361, 4390, 4439, 4463, 4552, 4649, 4697, 4711, 4712, 4733, 4780, 4826, 4938, 4942, 5022, 5026, 5028, 5029, 5030, 5035, 5038, 5042, 5063, 5089, 5122, 5136, 5188, 5192, 5298, 5299, 5332, 5344, 5374, 5429, 5523, 5639, 5750, 5796, 5804, 5807, 5812, 5896, 5965, 6034, 6056, 6408, 6409, 6430, 6432, 6441, 6442, 6453, 6501, 6511, 6636, 6960, 6961, 6964, 6966, 6967, 6968, 7184, 7196, 7204, 7205, 7206, 7207, 7208, 7220, 7397, 7447, 7654, 7661, 7684, 7686, 7693, 7731, 7742, 7743, 7780];
// Compare complete emitted anchor sequence: exactly approved ordinals removed.
const remove=new Set(approvedOrdinals);
if (crypto.createHash('sha256').update(before).digest('hex') === 'a744b5755c55f9bd815856deb9eda7da599149a2b894998f14d1faffa52203cf') {
  assert.equal(oldLinks.length,7817);
  assert.deepEqual(newLinks,oldLinks.filter((_,i)=>!remove.has(i)));
  assert.equal((after.match(/href="#term-see" class="term-link"/g)||[]).length,9);
}
// Fixed reviewed contexts remain tested even after the live Notes dataset changes.
const rules=vm.runInContext('REVIEWED_ENGLISH_LINK_CONTEXTS',c),fixtureIndex={};
for(const rule of rules)for(const [target,text] of rule.links)fixtureIndex[c.normalizeForId(text)]=target.slice(1);
let fixtureRemoved=0;
for(const rule of rules){
  const input=c.linkTermsInTranslation(rule.line,fixtureIndex);
  const output=c.removeReviewedEnglishTermLinks(input,rule.headword,rule.line,'en');
  const removed=links(input).length-links(output).length;
  assert.equal(removed,rule.links.reduce((n,item)=>n+item[2],0),rule.headword+': '+rule.line);
  assert.equal(visible(input),visible(output));fixtureRemoved+=removed;
}
assert.equal(fixtureRemoved,188);
const anchor=(w,t)=>`<a href="#term-${t}" class="term-link">${w}</a>`;
const altered=['genau','English: Juts his head forward, as shortsighted people do, to see the major-domo more distinctly.',''];
assert(c.generateDicListHtml([altered],index,null,null,'en').includes(anchor('see','see')),'changed context must retain legacy links');
const known='See the entry for anhalten.';
const rendered=anchor('See','see')+' the entry for '+anchor('anhalten','anhalten')+'.';
assert(!c.removeReviewedEnglishTermLinks(rendered,'angehalten',known,'en').includes(anchor('See','see')));
for(const [word,source,lang,output] of [
 ['other',known,'en',rendered],['angehalten',known+' changed','en',rendered],['angehalten',known+'\n'+known,'en',rendered],['angehalten',known,'ja',rendered],
 ['angehalten',known,'en',rendered.replace('#term-see','#term-new')],
 ['angehalten',known,'en',rendered+anchor('See','see')]
])assert.equal(c.removeReviewedEnglishTermLinks(output,word,source,lang),output);
const ja=JSON.parse(fs.readFileSync('mahler-search-app/data/dic_notes.json','utf8'));
assert.equal(c.generateDicListHtml(ja,index,null,null,'ja'),baseline.generateDicListHtml(ja,index,null,null,'ja'));
assert.equal(JSON.stringify(rows),snapshot);
console.log('Reviewed English links: 188 fixed-context removals; current dataset removed '+(oldLinks.length-newLinks.length)+'; original snapshot exact-anchor check when applicable; visible text unchanged, JA identical, stale/duplicate/changed target fail closed.');
