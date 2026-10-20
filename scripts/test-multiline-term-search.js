'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
function extract(s,n){const start=s.indexOf('function '+n+'(');assert(start>=0,n);const open=s.indexOf('{',start);let depth=0;for(let i=open;i<s.length;i++){if(s[i]==='{')depth++;if(s[i]==='}'&&!--depth)return s.slice(start,i+1);}throw Error(n);}
const german='Vollendet am Geburtstage und zur höheren Ehre des „Allmächtigen“!\nCharlottenburg, 22 Mai 1901.';
let checks=0;
for(const source of [[read('frontend/search-core.js'),read('frontend/result-format.js'),read('frontend/search.js')].join('\n'),read('mahler-search-app/js/app.js')]){
 const c=vm.createContext({window:{appData:{dic_terms_index:{}}},console});
 vm.runInContext(['normalizeString','normalizeTermSearchText','termSearchTextVariants','isTermWordCharacter','matchesTermQuery','matchesAnyTermQuery','hasScorePage','searchGenericTermsLocal','escapeHtml','escapeHtmlWithBreaks'].map(n=>extract(source,n)).join('\n'),c);
 const canonical=c.normalizeString(german),row={Oper:'feuersnot',Aufzug:'',Szene:'',page:331,whom:'',de:german,de_normalized:canonical,ja:'Completion note.'};
 c.window.appData.richard_strauss=[row];c.isDictionaryExampleSearch=()=>false;c.getDictionaryExampleSearchQueries=q=>[q];c.buildTermResolutionNotice=()=>'';c.createTermHighlightRegexForQueries=()=>/THIS_WILL_NOT_MATCH/g;c.linkTermsInTranslation=x=>x;
 const before=JSON.stringify(row);
 for(const query of ['vollendet',canonical,canonical.replace(/\n/g,''),canonical.replace(/\n/g,' '),canonical.replace(/\n/g,'\r\n'),canonical.replace(/\n/g,'\u2028'),canonical.replace(/\n/g,'\u00a0'),canonical.replaceAll(' ','  ')])for(const mode of ['partial','exact']){const meta={};const html=c.searchGenericTermsLocal(query,'richard_strauss','RS',meta,mode);assert.equal(meta.resultCount,1,JSON.stringify(query));assert(html.includes('p.331'));checks++;}
 assert.equal(JSON.stringify(row),before,'Canonical German and normalized source unchanged');
 assert.equal(c.matchesTermQuery('ab nehmen','abnehmen','partial'),false,'Ordinary spaces are not discarded');
 assert.equal(c.matchesTermQuery('abnehmen','ab','exact'),false,'Whole-word boundary preserved');
 assert.equal(c.matchesTermQuery(canonical,canonical.replace('!',''),'partial'),false,'Exclamation mark remains literal');
 assert.equal(c.matchesTermQuery(canonical,canonical.replace('„','"').replace('“','"'),'partial'),false,'Quote style remains literal');
 const start=source.indexOf('window.getGenericTermsListLocal = function');vm.runInContext(source.slice(start,source.indexOf('\n};',start)+3),c);const candidate=c.window.getGenericTermsListLocal('richard_strauss')[0];assert(!/[\r\n\u2028\u2029]/.test(candidate.normalized));assert(candidate.normalized.includes('! charlottenburg'));assert.equal(candidate.original,german);checks++;
}
console.log('Multiline search: '+checks+' cases passed, including RS664 old joined/new spaced suggestions, exact/partial modes and preserved canonical punctuation/word boundaries.');
