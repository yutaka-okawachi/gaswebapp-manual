'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const c=vm.createContext({});for(const p of ['src/dictionary_notation.js','src/generate_dic_html.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);
const citations=[['《Die Meistersinger von Nürnberg》 WWV 96','Die Meistersinger von Nürnberg, WWV 96'],['《Die schweigsame Frau》 Op. 80 / TrV 265','Die schweigsame Frau, Op. 80 / TrV 265'],['《Die Frau ohne Schatten》 Op. 65 / TrV 234','Die Frau ohne Schatten, Op. 65 / TrV 234']];
for(const [ja,en] of citations)for(const [lang,title] of [['ja',ja],['en',en]]){
 const raw='['+(title.includes('Meistersinger')?'RW':'RS')+': Oper]\nGerman original\n'+(lang==='en'?'English: Translation.':'日本語訳．')+'\n'+title;
 const out=c.generateDicListHtml([['ärgerlich',raw,'[RS: Oper]']],null,null,null,lang);
 assert(out.includes('<span class="notes-work-citation" lang="'+lang+'">'+title+'</span>'));assert(out.includes('German original'));
 const other=c.renderNotesEnglishLayout(raw.replace(/\n/g,'<br>'),lang);assert(other.includes('notes-work-citation'));
}
const linked='[RS: Oper]<br>Original<br>Translation<br>Die schweigsame <a href="#term-frau" class="term-link">Frau</a>, Op. 80 / <a class="term-link" href="#term-trv">TrV</a> 265';
const out=c.renderNotesEnglishLayout(linked,'en');assert(!out.includes('term-link'));assert(out.includes('Die schweigsame Frau, Op. 80 / TrV 265'));
const explicit=linked.replace('<a href="#term-frau" class="term-link">','<a href="https://example.test/score" class="notes-reference">');assert(c.renderNotesEnglishLayout(explicit,'en').includes('https://example.test/score'));
for(const raw of ['Explanation<br>Other line<br>Die schweigsame Frau, Op. 80 / TrV 265','[RS: Oper]<br>Original<br>Translation<br>【References】<br>Die schweigsame Frau, Op. 80 / TrV 265','[RS: Oper]<br>Original<br>Translation<br>This is ordinary prose.'])assert(!c.renderNotesEnglishLayout(raw,'en').includes('notes-work-citation'));
assert(c.renderNotesEnglishLayout('[GM]<br>Langsam<br>Slowly<br>Das Lied von der Erde','en').includes('notes-work-citation'));
for(const p of ['mahler-search-app/css/common.css']){const css=fs.readFileSync(p,'utf8');assert(/\.notes-work-citation \{[^}]*font-size: 0\.84em;[^}]*font-style: normal;/.test(css));assert(/\.notes-work-citation\[lang="en"\] \{ font-style: italic;/.test(css));}
console.log('Notes work citation: actual JA/EN forms, GM, links, exclusions and CSS passed');
