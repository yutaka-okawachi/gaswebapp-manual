'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const c=vm.createContext({console});for(const f of ['src/dictionary_notation.js','src/generate_dic_html.js'])vm.runInContext(read(f),c);
const kinds=['portamento-wave-down','portamento-wave-up'],ids=['heldenleben-portamento-strong','heldenleben-portamento-slide'];
const imgs=html=>[...html.matchAll(/<img\b[^>]*data-notation="portamento-wave-(?:up|down)"[^>]*>/g)].map(m=>m[0]);
let checks=0;
for(const language of ['ja','en']){
 const notes=JSON.parse(read((language==='en'?'en/':'')+'mahler-search-app/data/dic_notes.json'));
 const rows=ids.map((id,i)=>{
  const token='[[score:'+id+']]',row=notes.find(r=>r[2]==='[RS: Held]'&&(r[0].startsWith(i?'/ bedeutet:':'/ bedeutet stets:')||r[0].startsWith(token)));
  return row&&row.map((value,column)=>column<2?value.replace(token,'/'):value);
 });assert(rows.every(Boolean));
 for(const [i,row]of rows.entries()){
  const token='[[score:'+ids[i]+']]';
  for(const scenario of ['legacy','token','source-only','translation-only']){
   const fixture=[...row];if(scenario==='token'||scenario==='source-only')fixture[0]=fixture[0].replace('/',token);if(scenario==='token'||scenario==='translation-only')fixture[1]=fixture[1].replace('/',token);
   const before=JSON.stringify(fixture),images=[];
   for(const text of fixture.slice(0,2)){
    const html=c.renderDictionaryNotationText(text,fixture[0],fixture[2],language),found=imgs(html);assert.equal(found.length,1,language+' '+scenario);images.push(found[0]);
    const svg=decodeURIComponent(found[0].match(/src="data:image\/svg\+xml,([^"]+)"/)[1]);assert(svg.includes('data-portamento="'+(i?'ascending':'descending')+'"'));assert(!/<rect|fill="white"|<script|foreignObject|<text/.test(svg));
    assert.equal(html.replace(found[0],text.includes(token)?token:'/'),c.escapeHtml(text),'Only the approved marker changes');
    if(language==='en')assert(!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(found[0]));checks++;
   }
   assert.equal(images[0],images[1]);assert.equal(c.getSortLetter(fixture[0]),'OTHER');assert.equal(c.normalizeForId(fixture[0]),c.normalizeForId(row[0]),'Bookmark IDs remain stable');
   for(const input of [[['zart','soft',''],fixture], [fixture,['A','a','']]]){
    const html=c.generateDicListHtml(input,{},null,null,language);assert(html.indexOf('id="letter-OTHER"')>html.indexOf('id="letter-'+(input.some(r=>r[0]==='A')?'A':'Z')+'"'));assert.equal(imgs(html).length,2);
   }
   assert.equal(JSON.stringify(fixture),before);
  }
  assert(!imgs(c.renderDictionaryNotationText(row[0],row[0],'[GM]',language)).length);
  assert(!imgs(c.renderDictionaryNotationText(row[0],row[0]+' altered',row[2],language)).length);
  const wrong='[[score:'+ids[1-i]+']]';assert(!imgs(c.renderDictionaryNotationText(wrong,row[0],row[2],language)).length,'Wrong artwork context is rejected');
  const duplicate=token+' '+token;assert.equal(imgs(c.renderDictionaryNotationText(duplicate,row[0],row[2],language)).length,1);
  const unsafe=c.renderDictionaryNotationText(token+' <script>alert(1)</script>',row[0],row[2],language);assert(!unsafe.includes('<script>'));assert.equal(imgs(unsafe).length,1);
  assert.equal(c.scoreExampleSearchText(row[0].replace('/',token)),row[0].trim(),'Legacy slash search remains available');
 }
 const dynamic=vm.createContext({window:{addEventListener(){}},document:{documentElement:{lang:language}}});vm.runInContext(read('frontend/dictionary-view.js'),dynamic);
 for(const row of rows){assert.equal(dynamic.getSortLetter(row[0]),'OTHER');assert.equal(dynamic.getSortLetter(row[0].replace('/', '[[score:'+ids[0]+']]')),'OTHER');assert(dynamic.compareGermanStrings('zart',row[0])<0);}
 assert(dynamic.generateAlphabetLinks().endsWith('<a href="#letter-OTHER">'+(language==='en'?'Other':'数字・記号')+'</a>'));
}
console.log('Notes portamento: '+checks+' source/translation cases, exact context, distinct geometry, legacy/token/partial migrations, stable IDs/search, last OTHER section, localized safe SVG passed.');
