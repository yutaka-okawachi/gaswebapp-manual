'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),c=vm.createContext({});
for(const name of ['dictionary_notation','generate_dic_html'])vm.runInContext(read('src/'+name+'.js'),c);
const expected=[['Bässe (Violen u. Celli) deutlich hervortretend, immer fort','[B: 5]'],['Die Accentuierung darf natürlich nur zu ppp proportioniert geschehen.','[B: 5]'],['Streicher abwärts Kurz immer die 3 letzten Noten des Themas No.1 (Hauptthema)','[B: 5]'],['Streicher am besten, auch die Achtelnoten sämtlich hier abwärts, Kurz.','[B: 5]'],['Diese 3 B-schläge nur für chromatische Pauken, außerdem wegzulassen.','[RS: Bur]']].map(x=>JSON.stringify(x));
const urls=text=>[...new Set([...text.matchAll(/https?:\/\/[^\s]+?#page=\d+|https?:\/\/[^\s)]+/g)].map(m=>m[0]))].sort();
const report=[];
for(const language of ['ja','en']){
 const data=JSON.parse(read((language==='en'?'en/':'')+'mahler-search-app/data/dic_notes.json')),before=JSON.stringify(data),changes=[];
 for(const row of data){const value=c.normalizeDictionaryScoreReferences(row[1]);assert.equal(c.normalizeDictionaryScoreReferences(value),value,'Idempotent');assert.deepEqual(urls(value),urls(row[1]),'No distinct source URL lost or invented');if(value!==row[1]){assert(expected.includes(JSON.stringify([row[0].trim(),row[2].trim()])),'No unreviewed row changed');changes.push(row[0]);}if(row[0].startsWith('Diese 3 B-schläge')){assert.equal(value.split('IMSLP683714').length-1,1);assert(value.includes('Edmund A. Bowles: Nineteenth-Century Innovations'));assert(value.includes('https://amis.mircat.org/jamis/1979-80_074.pdf'));}}
 assert.equal(changes.length,5);assert.equal(JSON.stringify(data),before,'No Sheet/JSON edits');
 const example=data.find(r=>r[0].startsWith('Bässe (Violen'));const merged=c.normalizeDictionaryScoreReferences(example[1]);assert(merged.includes('Nowak'));assert(merged.includes('152'));assert(merged.includes('154'));assert(!merged.includes('【参考資料】')&&!merged.includes('【References】'));
 const html=c.generateDicHtml(data.map(r=>r.slice()),[],null,null,{language});const rowIds=[...html.matchAll(/<div class="row" id="([^"]+)"/g)].map(match=>match[1]);assert.equal(rowIds.length,data.length,"Every source row is rendered");assert.equal(new Set(rowIds).size,rowIds.length,"Unique rendered row IDs");assert(!html.includes('dictionary-score-help'));assert(!html.includes('notes-score-viewer.js'));assert(!html.includes('Acrobat'));assert(!html.includes('楽譜画像を見る'));assert(!html.includes('View score image'));assert(html.includes('data-notation="quarter-tremolo-three"'));
 report.push({language,rows:data.length,mergedRows:changes.length});
}
const fixture='Body\n\n【参考資料】\n・[Work Nowak版：当該脚注（PDF 154頁）](https://vmirror.imslp.org/files/imglnks/usimg/f/f5/IMSLP563860-PMLP10607-B_5_Nowak_IMSLP.pdf#page=154)\n\n（参照譜：Work Nowak版：印刷152頁）';
assert.notEqual(c.normalizeDictionaryScoreReferences(fixture),fixture);
for(const changed of [fixture.replace('Nowak版：印刷','Other版：印刷'),fixture.replace('PDF 154','PDF 153'),fixture.replace('https://vmirror.imslp.org/files/imglnks/usimg/f/f5/IMSLP563860-PMLP10607-B_5_Nowak_IMSLP.pdf#page=154','javascript:alert(1)'),fixture.replace('【参考資料】','【本文】')])assert.equal(c.normalizeDictionaryScoreReferences(changed),changed,'Ambiguous/unsafe citations remain untouched');
assert.equal(c.normalizeDictionaryScoreReferences(fixture.replace('印刷152','印刷151')),fixture.replace('印刷152','印刷151'),'A different printed page is not silently merged');
const other=fixture.replace('\n\n（参照譜','\n[Duden](https://example.org/dictionary)\n\n（参照譜');const merged=c.normalizeDictionaryScoreReferences(other);assert(merged.includes('[Duden](https://example.org/dictionary)'));assert(merged.includes('【参考資料】'));
const plain=c.renderDictionaryReferenceText('（参照譜：Also sprach Zarathustra：印刷5頁／PDF15頁）',text=>text?'<b>'+text+'</b>':'');assert(!plain.includes('<b>'),'Unlinked score information does not become a dictionary link');
const bundle=JSON.parse(read('frontend/bundle.json'));assert(!bundle.some(p=>/notes-score-(?:viewer|model)/.test(p)));assert(!read('mahler-search-app/js/app.js').includes('__NOTES_SCORE_VIEW_CONFIG__'));
console.log('Notes reference layout: all'+report.reduce((sum,item)=>sum+item.rows,0)+' language rows audited;5+5 lossless merges, distinct documents/URLs/notation preserved, ambiguous cases rejected, PDF links remain native, no viewer/extra guidance. '+JSON.stringify(report));
