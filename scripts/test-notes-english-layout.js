// English Notes layout uses explicit structure; never infer or rewrite existing evidence.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),c=vm.createContext({}),read=f=>fs.readFileSync(path.join(root,f),'utf8');
for(const file of ['maintenance_text_style','row_completion_notes','dictionary_notation','generate_dic_html'])vm.runInContext(read('src/'+file+'.js'),c);
let passed=0;const test=(name,fn)=>{try{fn();passed++;}catch(e){e.message=name+': '+e.message;throw e;}};
const options={tab:'Notes',de:'term',profile:'dictionary',restrictEquivalents:true,known:{english:'side, page',italian:'lato, pagina'}};
const header='Italian:\nlato — side\npagina — page';
const body=header+'\n\n【General meanings】\nSide; page.\n\n【Examples in musical contexts】\nGerman: Original phrase\nEnglish: Adopted translation.';
test('meaning groups retain Italian candidates without treating English glosses as equivalents',()=>{
 const v=c.maintenanceStyleEquivalents_(body);assert.equal(v.italian,'lato, pagina');assert.equal(v.english,'');
 assert.equal(v.groups.length,2);assert.equal(v.groups[1].meaning,'page');
 assert.equal(c.maintenanceStyleKnown_('',body).italian,'lato, pagina');
 assert.equal(c.maintenanceStyleValidate_(body,'en',{...options,requireMusicExamples:true}),body);
});
test('legacy single-line Italian and old musical heading remain valid',()=>{
 const old='Italian: lato, pagina\n\n【Musical translation examples】\nExisting summary.';
 assert.equal(c.maintenanceStyleValidate_(old,'en',{...options,requireMusicExamples:true}),old);
 assert.equal(c.renderNotesEnglishLayout('Italian: lato, pagina<br>Existing summary.','en'),'Italian: lato, pagina<br>Existing summary.');
});
test('malformed, added, lost and noncanonical Italian terms are rejected',()=>{
 for(const bad of [body.replace('lato — side','lato'),body.replace('lato — side','lato,pagina — side'),body.replace('pagina — page','inventato — page'),body.replace('pagina — page\n',''),body.replace('pagina — page','pagina — ')])assert.throws(()=>c.maintenanceStyleValidate_(bad,'en',options));
});
test('English labels require a matching German original inside the musical section',()=>{
 for(const bad of [body.replace('German: Original phrase\n',''),body.replace('English: Adopted translation.',''),body.replace('German: Original phrase','German:'),body.replace('German: Original phrase','German: First\nGerman: Second'),'English: side\n'+body,body.replace('【Examples in musical contexts】','【Usage notes】')])assert.throws(()=>c.maintenanceStyleValidate_(bad,'en',options));
 assert.throws(()=>c.maintenanceStyleValidate_(body.replace('German: Original phrase\nEnglish: Adopted translation.','Unlabelled pair.'),'en',{...options,requireMusicExamples:true}));
});
test('code-fenced labels cannot satisfy the new musical example requirement',()=>{
 const text=body.replace('German: Original phrase\nEnglish: Adopted translation.','```text\nGerman: Original phrase\nEnglish: Adopted translation.\n```');
 assert.throws(()=>c.maintenanceStyleValidate_(text,'en',{...options,requireMusicExamples:true}));
});
test('closed code blocks return to normal example validation and source formatting',()=>{
 const text=body.replace('German: Original phrase','```text\nEnglish: Literal code\n```\nGerman: Original phrase');
 assert.equal(c.maintenanceStyleValidate_(text,'en',{...options,requireMusicExamples:true}),text);
 const row={tab:'Notes',snapshot:{values:{de:'Saite',ja:'',en:'',source:'[GM]'}},notesSupport:{kind:'new_dictionary_proposal',examples:[{tab:'GM',id:'GM:2'}],usageIds:['GM:2']}};
 const withSource=text.replace('German: Original phrase','GM\nGerman: Original phrase');
 c.rowCompletionProtected_=value=>String(value).match(/\[GM\]/g)||[];
 assert.equal(c.rowCompletionNotesFormatHeadings_(row,'en',withSource),withSource.replace('\nGM\n','\n[GM]\n'));
});
test('multiple example pairs and necessary usage notes are retained',()=>{
 const text=body+'\n\nGerman: Second original\nEnglish: Second translation.\n\n【Usage notes】\nA necessary playing condition.';
 assert.equal(c.maintenanceStyleValidate_(text,'en',options),text);
});
test('new heading supports only evidenced source-group normalization',()=>{
 const row={tab:'Notes',snapshot:{values:{de:'Saite',ja:'',en:'',source:'[GM]'}},notesSupport:{kind:'new_dictionary_proposal',examples:[{tab:'GM',id:'GM:2'}],usageIds:['GM:2']}};
 c.rowCompletionProtected_=text=>String(text).match(/\[(?:GM|RW: Oper)\]/g)||[];
 const text=body.replace('German:','GM\nGerman:');
 assert.equal(c.rowCompletionNotesFormatHeadings_(row,'en',text),text.replace('\nGM\n','\n[GM]\n'));
 assert.equal(c.rowCompletionNotesFormatHeadings_(row,'en',text,true),text);
 row.notesSupport.usageIds=[];assert.equal(c.rowCompletionNotesFormatHeadings_(row,'en',text),text);
});
test('fenced text and markers outside the musical section are not normalized',()=>{
 const row={tab:'Notes',snapshot:{values:{de:'Saite',ja:'',en:'',source:'[GM]'}},notesSupport:{kind:'new_dictionary_proposal',examples:[{tab:'GM',id:'GM:2'}],usageIds:['GM:2']}};
 for(const text of ['【General meanings】\nGM','【Examples in musical contexts】\n```text\nGM\n```','【Examples in musical contexts】\n~~~text\nGM\n~~~'])assert.equal(c.rowCompletionNotesFormatHeadings_(row,'en',text),text);
});
test('English renderer adds labels and Italian styling without altering literal evidence',()=>{
 const text=body+'\n\n【References】\n[Duden](https://example.invalid/source#page=9)';
 const data=[['Term',text,'[GM]']],before=JSON.stringify(data);
 const html=c.generateDicListHtml(data,null,null,null,'en');
 assert(html.includes('<span lang="it">lato</span> — side'));assert(html.includes('lang="de"><strong class="notes-example-label">German:</strong> Original phrase'));
 assert(html.includes('English:</strong> Adopted translation.'));assert(html.includes('https://example.invalid/source#page=9'));
 assert.equal(JSON.stringify(data),before);assert(html.includes('id="term-term"'));
});
test('Japanese and ambiguous legacy examples remain literal with no inferred labels',()=>{
 const text='【Musical translation examples】<br>[GM]<br>Original<br>Translation<br>Necessary note.';
 assert.equal(c.renderNotesEnglishLayout(text,'ja'),text);
 const en=c.renderNotesEnglishLayout(text,'en');assert(!en.includes('notes-example-label'));assert(en.includes('[GM]<br>Original<br>Translation<br>Necessary note.'));
});
test('escaping and protected notation/link rendering still run before layout',()=>{
 const data=[['Term',body.replace('Original phrase','<script>alert(1)</script> & text')+'\nhttps://example.invalid/path?q=1&n=2','[GM]']];
 const html=c.generateDicListHtml(data,null,null,null,'en');assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(html.includes('path?q=1&amp;n=2'));
 const rendered='【Examples in musical contexts】<br>German: <svg data-notation="kept"></svg><br>English: <a href="https://example.invalid/">Kept</a>';
 const out=c.renderNotesEnglishLayout(rendered,'en');assert(out.includes('<svg data-notation="kept"></svg>'));assert(out.includes('<a href="https://example.invalid/">Kept</a>'));
});
test('all published rows retain original data, row identities and protected score rendering',()=>{
 for(const language of ['ja','en']){
  const rows=JSON.parse(read((language==='en'?'en/':'')+'mahler-search-app/data/dic_notes.json')),before=JSON.stringify(rows);
  const html=c.generateDicHtml(rows,[],null,null,{language});
  assert.equal([...html.matchAll(/<div class="row" id="/g)].length,rows.length);assert(rows.length>0);
  assert(html.includes('data-notation="quarter-tremolo-three"'));assert.equal(JSON.stringify(rows),before);
 }
});
test('quoted labels remain literal in display and cannot become headings',()=>{
 for(const quote of [['“','”'],['&quot;','&quot;'],['„','“']]){
  const html='【Examples in musical contexts】<br>'+quote[0]+'Transcription:<br>German: Quoted wording<br>English: Quoted wording<br>【Usage notes】<br>'+quote[1]+'<br>German: Actual original<br>English: Actual translation';
  const output=c.renderNotesEnglishLayout(html,'en');
  assert(output.includes('German: Quoted wording<br>English: Quoted wording'));
  assert.equal((output.match(/class="notes-example-label"/g)||[]).length,2);
 }
});
for(const language of ['ja','en'])test(language+' real generated bundle shares layout across search and dynamic dictionary',()=>{
 const text=body+'\n\n【References】\n[Duden](https://example.invalid/source#page=9)',data=[['Ab',text,'[GM]']],before=JSON.stringify(data);
 const window={addEventListener(){},appData:{dic_notes:data,dic_terms_index:{}},location:{pathname:'/mahler-search-app/other.html',search:''}};
 const nodes=[],container={appendChild(n){nodes.push(n);},innerHTML:''},document={documentElement:{lang:language},getElementById:id=>id==='listContainer'?container:null,createElement:()=>({innerHTML:'',style:{},classList:{add(){}},children:[],appendChild(n){this.children.push(n);}})};
 const b=vm.createContext({window,document,URL,URLSearchParams,console,setTimeout,clearTimeout,navigator:{userAgent:'test'}});
 const bundle=read('mahler-search-app/js/app.js');assert.equal((bundle.match(/function renderNotesEnglishLayout\(/g)||[]).length,1);
 vm.runInContext(bundle,b);
 const expected=b.renderNotesEnglishLayout(b.renderDictionaryNotationText(text,'Ab','[GM]',language,part=>b.renderDictionaryReferenceText(part,b.escapeHtmlWithBreaks)),language);
 const search=window.searchTermsLocal('Ab'),searchBody=search.match(/<dd class="translation">([^]*?)<\/dd>/)[1];
 assert.equal(searchBody,expected);b.fixture=data;vm.runInContext('renderDictionaryList(fixture);',b);
 assert.equal(nodes[0].children[1].innerHTML,expected);assert.equal(JSON.stringify(data),before);
 assert.equal((expected.match(/class="notes-example-label"/g)||[]).length,language==='en'?2:0);
 assert(expected.includes('https://example.invalid/source#page=9'));
 for(const name of ['notes-italian-pair','notes-example-label','notes-example-line'])assert(read('mahler-search-app/css/common.css').includes('.'+name));
});
test('actual static and dynamic escaping preserve single-quoted labels and embedded section names',()=>{
 const text="【Examples in musical contexts】\nGerman: Original\nEnglish: 'Source transcription:\nGerman: Quoted wording\n【Usage notes】\nEnglish: Quoted wording\n'\n\nGerman: Second original\nEnglish: Second translation.";
 const staticHtml=c.generateDicListHtml([['Ab',text,'[GM]']],null,null,null,'en');
 const window={addEventListener(){},appData:{dic_notes:[['Ab',text,'[GM]']],dic_terms_index:{}},location:{pathname:'/mahler-search-app/other.html',search:''}};
 const nodes=[],container={appendChild(n){nodes.push(n);},innerHTML:''},document={documentElement:{lang:'en'},getElementById:id=>id==='listContainer'?container:null,createElement:()=>({innerHTML:'',style:{},classList:{add(){}},children:[],appendChild(n){this.children.push(n);}})};
 const b=vm.createContext({window,document,URL,URLSearchParams,console,setTimeout,clearTimeout,navigator:{userAgent:'test'}});
 vm.runInContext(read('mahler-search-app/js/app.js'),b);
 const search=window.searchTermsLocal('Ab');b.fixture=window.appData.dic_notes;vm.runInContext('renderDictionaryList(fixture);',b);
 for(const [html,entity]of [[staticHtml,'&#039;'],[search,'&#39;'],[nodes[0].children[1].innerHTML,'&#39;']]){
  assert(html.includes(entity+'Source transcription:</span><br>German: Quoted wording<br>【Usage notes】<br>English: Quoted wording<br>'+entity));
  assert.equal((html.match(/class="notes-example-label"/g)||[]).length,4);
  assert(html.includes('German:</strong> Second original'));assert(html.includes('English:</strong> Second translation.'));
 }
});
console.log('English Notes layout: '+passed+' scenarios passed; new/legacy parsing, explicit labels, protected evidence, both languages, no API or Sheet writes.');
