'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../src/notes_example_provenance.js'),'utf8');
function fixture(){
 const tables={
  '楽譜情報':[['Oper','Composer','Opera_Title','Work_Number'],['liebes','Richard Wagner','恋愛禁制 (Das Liebesverbot)','WWV 38'],['schatten','Richard Strauss','影のない女 (Die Frau ohne Schatten)','Op. 65 / TrV 234'],['arabella','Richard Strauss','アラベラ (Arabella)','Op. 79 / TrV 263']],
  RW:[['de','ja','en','Oper'],['Sie eilen ab.','彼らは急いで退場する．','They hurry off.','liebes']],
  RS:[['de','ja','en','Oper'],['süßen','甘い','sweet','schatten'],['süßen','甘い','sweet','arabella']],
  GM:[['de','ja','en','data'],['Langsam','ゆっくり','Slowly','M-1-1-1-all&M-2-1-1-all&M-1-4-2-va&']]
 };
 const book={getSheetByName:n=>tables[n]?{name:n,getLastRow:()=>tables[n].length,getDataRange:()=>({getValues:()=>tables[n]})}:null};
 const styles=[];
 const c={console,SpreadsheetApp:{newRichTextValue(){let text='',spans=[],links=[];return {setText(v){text=v;return this},setTextStyle(start,end,style){spans.push({start,end,style});return this},setLinkUrl(start,end,url){links.push({start,end,url});return this},build(){return {text,spans,links,getText:()=>text}}}},newTextStyle(){const s={};return {setFontFamily(v){s.font=v;return this},setFontSize(v){s.size=v;return this},setItalic(v){s.italic=v;return this},build(){styles.push(s);return s}}}},namedSheetRead_:(s,names,start,count)=>({values:tables[s.name].slice(start-1,start-1+count).map(row=>names.map(n=>row[tables[s.name][0].indexOf(n)]))})};
 vm.createContext(c);vm.runInContext(code,c);return {c,tables,book,styles};
}
test('strict original and adopted translation, own next line, original catalogue title',()=>{
 const h=fixture(),ja='【音楽用語としての訳例】\n[RW: Oper]\nSie eilen ab.\n彼らは急いで退場する．',en='[RW: Oper]\nGerman: Sie eilen ab.\nEnglish: They hurry off.';
 const p=h.c.notesExamplePrepare_(h.book,{ja,en});
 assert.equal(p.ja.text,ja+'\n《Das Liebesverbot》 WWV 38');assert.equal(p.en.text,en+'\nDas Liebesverbot, WWV 38');
 assert.equal(p.en.text.slice(p.en.ranges[0].start,p.en.ranges[0].end),'Das Liebesverbot, WWV 38');
 const again=h.c.notesExamplePrepare_(h.book,{ja:p.ja.text,en:p.en.text});assert.equal(again.ja.text,p.ja.text);assert.equal(again.en.added,0);
});
test('each language is verified separately, including süßen mismatching EN',()=>{
 const h=fixture(),p=h.c.notesExamplePrepare_(h.book,{ja:'[RS: Oper]\nsüßen\n甘い',en:'[RS: Oper]\nGerman: süßen\nEnglish: sweetly'});
 assert.match(p.ja.text,/《Die Frau ohne Schatten》 Op\. 65 \/ TrV 234 ／ 《Arabella》/);assert.equal(p.en.added,0);
});
test('multiple GM locations deduplicate works; unknown work makes provenance conservative',()=>{
 const h=fixture(),fields={ja:'[GM]\nLangsam\nゆっくり',en:''};
 assert.match(h.c.notesExamplePrepare_(h.book,fields).ja.text,/《Symphonie Nr\. 1》 ／ 《Symphonie Nr\. 2》$/);
 h.tables.GM[1][3]+='M-unknown-x&';assert.equal(h.c.notesExamplePrepare_(h.book,fields).ja.text,fields.ja);
});
test('missing metadata, conflicting metadata, or mixed known/unknown work never invents',()=>{
 const h=fixture(),f={ja:'[RW: Oper]\nSie eilen ab.\n彼らは急いで退場する．',en:''};
 h.tables['楽譜情報'].push(['liebes','Richard Wagner','別 (Different)','WWV 99']);assert.equal(h.c.notesExamplePrepare_(h.book,f).ja.added,0);
 h.tables['楽譜情報'].pop();h.tables.RW.push(['Sie eilen ab.','彼らは急いで退場する．','They hurry off.','unknown']);assert.equal(h.c.notesExamplePrepare_(h.book,f).ja.added,0);
 delete h.tables['楽譜情報'];assert.equal(h.c.notesExamplePrepare_(h.book,f).ja.added,0);
});
test('existing editor only adds changed pairs, leaving unchanged examples and manual citations',()=>{
 const h=fixture(),old={ja:'[RW: Oper]\nSie eilen ab.\n彼らは急いで退場する．',en:''};
 assert.equal(h.c.notesExamplePrepare_(h.book,{ja:old.ja+'\n\n追記',en:''},old).ja.added,0);
 for(const citation of ['私の手入力出典','《Das Liebesverbot》 p. 10']){
  const f={ja:old.ja+'\n'+citation,en:''};assert.equal(h.c.notesExamplePrepare_(h.book,f).ja.text,f.ja);
 }
 const changed=h.c.notesExamplePrepare_(h.book,old,{ja:'[RW: Oper]\nSie eilen ab.\n古い訳',en:''});assert.equal(changed.ja.added,1);
});
test('markers, fenced examples and changed originals are not guessed',()=>{
 const h=fixture();for(const ja of ['Sie eilen ab.\n彼らは急いで退場する．','[RW: Oper]\nSie eilen ab!\n彼らは急いで退場する．','```\n[RW: Oper]\nSie eilen ab.\n彼らは急いで退場する．\n```'])assert.equal(h.c.notesExamplePrepare_(h.book,{ja,en:''}).ja.added,0);
});
test('multiline translation exact match adds after full translation, preserves body verbatim',()=>{
 const h=fixture();h.tables.RW[1][1]='一行目\n二行目';const ja='[RW: Oper]\nSie eilen ab.\n一行目\n二行目\n\n【補足】\n残す';
 const out=h.c.notesExamplePrepare_(h.book,{ja,en:''}).ja.text;assert.equal(out,ja.replace('二行目\n','二行目\n《Das Liebesverbot》 WWV 38\n'));
});
test('rich text style is limited to citation; prior unchanged prefix/suffix links/styles survive',()=>{
 const h=fixture(),p=h.c.notesExamplePrepare_(h.book,{ja:'[RW: Oper]\nSie eilen ab.\n彼らは急いで退場する．',en:''}).ja;
 const old={getText:()=> '[RW: Oper]\nSie eilen ab.\n彼らは急いで退場する．',getRuns:()=>[{getStartIndex:()=>0,getEndIndex:()=>10,getTextStyle:()=>({bold:true}),getLinkUrl:()=> 'https://example.test/'}]};
 const rich=h.c.notesExampleRich_(p,'ja',old),last=rich.spans.at(-1);assert.deepEqual(JSON.parse(JSON.stringify(last.style)),{font:'Noto Sans JP',size:8,italic:false});assert.equal(rich.links[0].url,'https://example.test/');assert.equal(rich.text,p.text);
 h.c.notesExampleRich_(p,'en');assert.deepEqual(h.styles.at(-1),{font:'Arial',size:8,italic:true});
});

test('nolink wrappers preserve exact adopted text; blank-separated manual source is not duplicated',()=>{
 const h=fixture();h.tables.RW[1][2]='See them hurry off.';const en='[RW: Oper]\nGerman: Sie eilen ab.\nEnglish: [[nolink:See]] them hurry off.';
 const p=h.c.notesExamplePrepare_(h.book,{ja:'',en});assert.equal(p.en.added,1);assert.ok(p.en.text.includes('[[nolink:See]]'));
 const manual=en+'\n\nDas Liebesverbot, WWV 38, p. 14';assert.equal(h.c.notesExamplePrepare_(h.book,{ja:'',en:manual}).en.text,manual);
});

test('unique original gives identical work for differing Japanese and English translations without rewriting',()=>{
 const h=fixture();h.tables.RS.pop();
 const fields={ja:'[RS: Oper]\nsüßen\n甘く',en:'[RS: Oper]\nGerman: süßen\nEnglish: sweetly'};
 const p=h.c.notesExamplePrepare_(h.book,fields);
 assert.equal(p.ja.text,fields.ja+'\n《Die Frau ohne Schatten》 Op. 65 / TrV 234');
 assert.equal(p.en.text,fields.en+'\nDie Frau ohne Schatten, Op. 65 / TrV 234');
 assert.equal(h.c.notesExamplePrepare_(h.book,{ja:p.ja.text,en:p.en.text}).en.added,0);
 assert.equal(h.c.notesExamplePrepare_(h.book,fields,fields).en.added,0);
 const manual={ja:'',en:fields.en+'\nMy verified manual citation'};
 assert.equal(h.c.notesExamplePrepare_(h.book,manual).en.text,manual.en);
});
test('same original in conflicting works is not disambiguated by translation',()=>{
 const h=fixture();h.tables.RS[2][1]='別の訳';h.tables.RS[2][2]='other translation';
 const p=h.c.notesExamplePrepare_(h.book,{ja:'[RS: Oper]\nsüßen\n甘い',en:'[RS: Oper]\nGerman: süßen\nEnglish: other translation'});
 assert.equal(p.ja.added,0);assert.equal(p.en.added,0);
});
test('unique-original fallback handles repeated examples under one tag and declines uncertain continuations',()=>{
 const h=fixture();h.tables.RS.pop();h.tables.RS.push(['Anderes','別','Other','schatten']);
 const en='[RS: Oper]\nGerman: süßen\nEnglish: sweetly\n\nGerman: Anderes\nEnglish: Differently';
 assert.equal(h.c.notesExamplePrepare_(h.book,{ja:'',en}).en.added,2);
 const multiline='[RS: Oper]\nGerman: süßen\nEnglish: altered first\nunknown second';
 assert.equal(h.c.notesExamplePrepare_(h.book,{ja:'',en:multiline}).en.text,multiline);
});
