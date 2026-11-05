'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const c=vm.createContext({});
vm.runInContext(['sheet_column_layout.js','maintenance_text_style.js','row_completion_notes.js','row_completion_review.js','row_completion.js','dictionary_candidate_wizard.js'].map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n'),c);
let passed=0;const test=(name,fn)=>{try{fn();passed++;}catch(e){e.message=name+': '+e.message;throw e;}};
function adoptedBook(tab,mode){
  const file={GM:'mahler',RW:'richard_wagner',RS:'richard_strauss',Notes:'dic_notes'}[tab];
  const ja=JSON.parse(fs.readFileSync(path.join(root,'mahler-search-app/data/'+file+'.json'),'utf8'));
  const en=JSON.parse(fs.readFileSync(path.join(root,'en/mahler-search-app/data/'+file+'.json'),'utf8'));
  const names=['ja_old','en','修正案','de','ja'];
  const identity=r=>tab==='Notes'?r[0]:JSON.stringify([r.de,r.data,r.Oper,r.Aufzug,r.Szene,r.page]);
  const byId=new Map(en.map(r=>[identity(r),r]));
  const rows=[names,...ja.map(a=>{const b=byId.get(identity(a)),de=tab==='Notes'?a[0]:a.de,j=tab==='Notes'?a[1]:a.ja,e=b?(tab==='Notes'?b[1]:b.ja):'';return ['NEVER_SEND_OLD',mode==='old-only'?'':e,'NEVER_SEND_REVIEW',de,mode==='old-only'?'':j];})];
  const sheet={getName:()=>tab,getLastRow:()=>rows.length,getLastColumn:()=>names.length,getRange(r,col,n=1,w=1){return{getValues:()=>rows.slice(r-1,r-1+n).map(a=>a.slice(col-1,col-1+w)),getDisplayValues:()=>rows.slice(r-1,r-1+n).map(a=>a.slice(col-1,col-1+w)),getFormulas:()=>Array.from({length:n},()=>Array(w).fill(''))};}};
  return{getSheetByName:name=>name===tab?sheet:null};
}
function row(tab,values){return{tab,number:1000,draft:{whom_en:'Approved recipient'},snapshot:{values:{de:'Leise',ja:'',en:'',source:'[GM]',data:'M-1-1-1-all&',Oper:'work',Aufzug:'1',Szene:'2',page:'10',whom:'Orchester',whom_en:'',...values}}};}
const opts=(extra={})=>({tab:'Notes',de:'term',basis:'',profile:'dictionary',known:{english:'',italian:''},restrictEquivalents:true,...extra});

for(const tab of ['GM','RW','RS','Notes'])test(tab+' uses two bounded current adopted ja/en examples; never old/review columns',()=>{
  const examples=c.maintenanceStyleExamples_(adoptedBook(tab),tab,999,'dictionary');assert(examples.length>=1&&examples.length<=2);
  assert(!JSON.stringify(examples).includes('NEVER_SEND'));assert(examples.every(e=>e.de&&e.ja&&e.en&&e.columns==='current ja/en'&&!/https?:|\S+@\S+/.test(e.ja+e.en)));
  assert.throws(()=>c.maintenanceStyleExamples_(adoptedBook(tab,'old-only'),tab,999,'dictionary'),/採用例/);
});
for(const [tab,handler]of [['GM','rowCompletionGm_'],['RW','rowCompletionRw_'],['RS','rowCompletionRs_'],['Notes','rowCompletionNotes_']])test(tab+' named context and prompt bind tab-specific rules',()=>{
  const r=row(tab),context=c[handler](adoptedBook(tab),r),request=c.rowCompletionRequest_({tab}, {...r,targets:['ja','en']},'synthetic-model',context),input=JSON.parse(request.input);
  assert.equal(input.tab,tab);assert.equal(context.tab,tab);assert.equal(input.style_version,'2026-11-05');assert(input.format_rules.length>=8);assert(input.adopted_style_examples.length);
  assert(input.format_rules.join('\n').includes('例の内容'));assert(input.format_rules.join('\n').includes('plate'));
  assert(!JSON.stringify(input).includes('NEVER_SEND'));assert.equal(request.store,false);
  assert.equal(input.format_rules.join('\n').includes('説明的な導入文は付けない'),tab==='Notes');
  if(tab==='Notes'){assert.equal(input.domain_context.task,'notes_dictionary');assert.equal(input.domain_context.source_document_fetched,false);}
  else if(tab==='GM'){assert.equal(input.domain_context.task,'gm_performance_translation');assert.equal(input.domain_context.location,r.snapshot.values.data);}
  else{assert.equal(input.domain_context.tab,tab);assert.equal(input.domain_context.work,'work');assert.equal(input.domain_context.approved_whom_en,'Approved recipient');}
});
test('Notes catalogue examples are safe adopted first-paragraph excerpts',()=>{
  const examples=c.maintenanceStyleExamples_(adoptedBook('Notes'),'Notes',1000,'catalogue');assert.equal(examples[0].de,'AV');assert(examples[0].excerpt);assert(!/【英】|Italian:/.test(examples[0].ja+examples[0].en));
});
test('Notes dictionary learns actual Bogen general/musical sections beyond the first 200 rows',()=>{
  const examples=c.maintenanceStyleExamples_(adoptedBook('Notes'),'Notes',1000,'dictionary');
  assert.equal(examples[0].de,'Bogen');assert(examples[0].ja.includes('【音楽用語としての訳例】'));
  assert(examples[0].en.includes('【Musical translation examples】'));assert(examples[0].purpose==='style_only');
});
test('new Notes prompt separates adopted usage evidence from style examples and unverified lexical proposals',()=>{
  const r=row('Notes',{de:'Saite',source:'[GM], [RW: Oper], [RS: Oper]'}),context=c.rowCompletionNotes_(adoptedBook('Notes'),r);
  const request=c.rowCompletionRequest_({tab:'Notes'},{...r,targets:['ja','en']},'synthetic-model',context),input=JSON.parse(request.input);
  assert.equal(input.domain_context.new_dictionary,true);assert.equal(input.domain_context.source_document_fetched,false);
  assert(request.instructions.includes('語彙知識による未確認'));assert(request.instructions.includes('空欄であること自体は省略理由にしない'));
  assert(request.instructions.includes('模範')===false||input.format_rules.join('').includes('模範'));
  assert(request.text.format.schema.required.includes('notes_support'));
  const existing=row('Notes',{de:'Saite',ja:'【一般的な意味】\n弦．'});
  const old=c.rowCompletionRequest_({tab:'Notes'},{...existing,targets:['en']},'synthetic-model',c.rowCompletionNotes_(adoptedBook('Notes'),existing));
  assert(!old.text.format.schema.properties.notes_support);assert(!JSON.parse(old.input).domain_context.new_dictionary);
});
test('Notes has separate dictionary, annotation, and catalogue profiles',()=>{
  assert.equal(c.maintenanceStyleProfile_('Notes',{de:'AV'}),'catalogue');assert.equal(c.maintenanceStyleProfile_('Notes',{de:'abwärts'}),'dictionary');
  assert.equal(c.maintenanceStyleProfile_('Notes',{de:'a very long quoted instruction with many separate words'}),'annotation');
  assert.equal(c.maintenanceStyleProfile_('Notes',{de:'short',ja:'項目固有の解説．'}),'annotation');
});
test('manual Notes formatter uses exact current prefix and ASCII comma delimiters',()=>{
  const body=c.candidateWizardSuggestedBody({headword:'test',english:'side， page、 flank',italian:'lato,pagina',translation:'側，脇',musicExamples:'舞台の脇で'});
  assert(body.startsWith('【英】side, page, flank／【伊】lato, pagina\n\n'));assert(!body.includes('(≒'));assert(!body.includes('対応する表現'));assert(body.includes('【一般的な意味】'));
});
test('no foreign fields are invented; English and Italian remain independently optional',()=>{
  for(const [en,it,prefix]of [['','','【一般的な意味】'],['side','','【英】side'],['','lato','【伊】lato']]){
    const body=c.candidateWizardSuggestedBody({headword:'term',english:en,italian:it,translation:'意味',musicExamples:'訳例'});assert(body.startsWith(prefix));
    if(!en)assert(!body.includes('【英】'));if(!it)assert(!body.includes('【伊】'));
  }
});
test('catalogue abbreviations do not get correspondence or generic dictionary sections',()=>{
  for(const headword of ['AV','TrV']){
    const body=c.candidateWizardSuggestedBody({headword,english:'not used',italian:'not used',translation:'Richard Strauss の作品目録番号．'});
    assert.equal(body,'Richard Strauss の作品目録番号．');assert.equal(c.candidateWizardEntryMissingFields({headword,translation:'目録番号'}).length,0);
    assert.throws(()=>c.maintenanceStyleValidate_('【英】catalogue\n\n目録番号．','ja',opts({de:headword})),/作品目録/);
  }
});
test('new Japanese punctuation is formatted selectively, foreign quotation/URL/code/tokens preserved',()=>{
  const input='本文、説明。「Deutsch、Original。」 https://example.invalid/。 `code、。` [[score:example]] <span title="原文、。">';
  const expected='本文，説明．「Deutsch、Original。」 https://example.invalid/。 `code、。` [[score:example]] <span title="原文、。">';
  assert.equal(c.maintenanceStylePunctuation_(input),expected);assert.equal(c.candidateWizardSafeText(input,'説明',6000,true),expected);
  assert.equal(c.candidateWizardSafeText('Original、。','見出し',100,true),'Original、。');
  assert.throws(()=>c.maintenanceStyleValidate_('意味, 解説.','ja',opts({profile:'annotation'})),/ASCII/);
});
test('foreign header prefaces, generic disclaimers and invented equivalents are rejected',()=>{
  for(const text of ['対応する表現：【英】side','Corresponding expressions: side','意味が近い表現を挙げている．','【英】unverified\n\n【一般的な意味】\n意味．'])assert.throws(()=>c.maintenanceStyleValidate_(text,'ja',opts()));
  assert.throws(()=>c.maintenanceStyleValidate_('【英】side，page\n\n意味．','ja',opts({known:{english:'side, page',italian:''}})),/ASCII/);
});
test('English Notes omits English equivalents, preserves known Italian only',()=>{
  const options=opts({known:{english:'side, page',italian:'lato, pagina'}});
  assert.equal(c.maintenanceStyleValidate_('Italian: lato, pagina\n\n【General meanings】\nSide.','en',options),'Italian: lato, pagina\n\n【General meanings】\nSide.');
  for(const bad of ['English: side\nItalian: lato, pagina','Corresponding expressions: lato','【伊】lato, pagina','Italian: lato，pagina\nMeaning.','Meaning without provided Italian.'])assert.throws(()=>c.maintenanceStyleValidate_(bad,'en',options));
});
test('multiple meaning groups retain all corresponding terms and item-specific annotations',()=>{
  const ja='【英】coordinated, adjusted／【伊】coordinato\n【英】tuned／【伊】accordato\n【英】balanced／【伊】bilanciato〔均衡の調整〕\n\n項目固有の説明．';
  const known=c.maintenanceStyleKnown_(ja,'');assert.equal(known.groups.length,3);assert.equal(known.italian,'coordinato, accordato, bilanciato');assert(known.groups[2].italian.includes('均衡の調整'));
  const en='Italian: coordinato, accordato, bilanciato\n\nHere bilanciato refers specifically to balance.';
  assert.equal(c.maintenanceStyleValidate_(en,'en',opts({known,basis:ja})),en);
  assert.throws(()=>c.maintenanceStyleValidate_('Italian: coordinato\n\nMeaning.','en',opts({known,basis:ja})),/Italian:|英伊対応/);
});
test('manual body formatter preserves quoted originals, musical tokens, and literal URL endings',()=>{
  const body=c.candidateWizardSuggestedBody({headword:'term',translation:'https://example.invalid/。',musicExamples:'「Original、。 [[score:real]]」',comment:'引用「Hindemithの原文、。」'});
  assert(body.includes('① https://example.invalid/。\n'));assert(body.includes('「Original、。 [[score:real]]」'));assert(body.includes('引用「Hindemithの原文、。」'));
  assert.equal(c.maintenanceStylePunctuation_("Strauss's 作品、Bruckner's 作品。"),"Strauss's 作品，Bruckner's 作品．");
});
test('new dictionary needs proper meaning section; existing annotation is not forced into it',()=>{
  assert.throws(()=>c.maintenanceStyleValidate_('短い訳','ja',opts({newBody:true})),/見出し/);
  assert.equal(c.maintenanceStyleValidate_('項目固有の用法説明．','ja',opts({profile:'annotation',basis:'項目固有の用法説明．'})),'項目固有の用法説明．');
  assert.equal(c.maintenanceStyleValidate_('Specific usage note.','en',opts({profile:'annotation',basis:'項目固有の用法説明．'})),'Specific usage note.');
});
for(const tab of ['GM','RW','RS'])test(tab+' translations reject Notes boilerplate and verbose short-phrase expansions',()=>{
  const options={tab,de:'Leise',basis:'Leise'};assert.equal(c.maintenanceStyleValidate_('静かに','ja',options),'静かに');assert.equal(c.maintenanceStyleValidate_('Softly.','en',options),'Softly.');
  for(const bad of ['【一般的な意味】\n静かに','Italian: piano','訳：静かに','静かに\n独自の参考説明'])assert.throws(()=>c.maintenanceStyleValidate_(bad,'ja',options));
  assert.throws(()=>c.maintenanceStyleValidate_('静かに．','ja',options),/句点/);
});
test('proper names, spacing, work names and plate additions are checked without changing quotes',()=>{
  for(const text of ['ヒンデミット の作品．','Hindemithの作品．','作品Hindemith．','plate no. 123'])assert.throws(()=>c.maintenanceStyleValidate_(text,'ja',opts({profile:'annotation'})));
  assert.equal(c.maintenanceStyleValidate_('Hindemith の作品．「ブルックナー、引用。」','ja',opts({profile:'annotation'})),'Hindemith の作品．「ブルックナー、引用。」');
  const r=row('Notes',{de:'Original [[score:real]]',ja:'Hindemith《Kammermusik》 https://example.invalid/a#page=2 [[score:real]]'});
  assert.throws(()=>c.rowCompletionValidateText_(r,'en','Another title [[score:real]]'),/トークン/);
});
test('RW/RS preserve named recipients in de and never prepend an extra recipient heading',()=>{
  for(const tab of ['RW','RS']){
    const r=row(tab,{de:'Farzana und Zemina treten hervor.',whom:'Farzana, Zemina'});
    assert.equal(c.rowCompletionValidateText_(r,'en','Farzana and Zemina step forward.'),'Farzana and Zemina step forward.');
    assert.throws(()=>c.rowCompletionValidateText_(r,'en','Farzana steps forward.'),/固有名詞/);
    assert.throws(()=>c.rowCompletionValidateText_(row(tab),'en','Orchestra: Softly'),/指示対象/);
  }
});
function headingRow() {
  const r=row('Notes',{de:'Saite',source:'[GM], [RW: Oper], [RS: Oper]'});
  r.notesSupport={kind:'new_dictionary_proposal',english:'',italian:'',
    examples:['GM','RW','RS'].map(tab=>({tab,id:tab+':2'})),usageIds:['GM:2','RW:2','RS:2']};
  return r;
}
function headingBody(field,body) {
  return (field==='ja'?'【一般的な意味】\n弦．\n\n【音楽用語としての訳例】':'【General meanings】\nA string.\n\n【Musical translation examples】')+'\n'+body;
}
test('evidenced source group headings have bracketed formatting and safe comparison copies',()=>{
  const r=headingRow();
  for(const field of ['ja','en']){
    const draft=headingBody(field,'[GM]\nG-Saite\n\n[RW: Oper]\ndoppelte Saiten\n\n[RS: Oper]\nkeine leeren Saiten');
    assert.equal(c.rowCompletionValidateText_(r,field,draft),draft);
    const formatted=c.rowCompletionNotesFormatHeadings_(r,field,draft);
    assert.equal(formatted,draft);
    const plain=draft.replace(/^\[(GM|RW: Oper|RS: Oper)\]$/gm,'$1');
    assert.equal(c.rowCompletionNotesFormatHeadings_(r,field,plain),draft);
    assert.equal(c.rowCompletionNotesFormatHeadings_(r,field,formatted),formatted);
    assert.equal(c.rowCompletionValidateText_(r,field,formatted),formatted);
  }
  assert(c.maintenanceStyleRules_('Notes','dictionary').join('\n').includes('独立した見出しは[GM]'));
});
test('heading formatting requires the source marker and a selected adopted example with the same tab',()=>{
  for(const mode of ['source','usage','example','tab','id','kind','missing']){
    const r=headingRow();
    if(mode==='source')r.snapshot.values.source='[RW: Oper], [RS: Oper]';
    if(mode==='usage')r.notesSupport.usageIds=['RW:2','RS:2'];
    if(mode==='example')r.notesSupport.examples=[];
    if(mode==='tab')r.notesSupport.examples[0].tab='RW';
    if(mode==='id')r.notesSupport.examples[0].id='GM:unverified';
    if(mode==='kind')r.notesSupport.kind='other';
    if(mode==='missing')delete r.notesSupport;
    const draft=headingBody('ja','[GM]\nG-Saite');
    assert.equal(c.rowCompletionNotesFormatHeadings_(r,'ja',draft),draft,mode);
    assert.throws(()=>c.rowCompletionValidateText_(r,'ja',draft),/トークン/);
  }
});
test('formatting never rewrites existing bodies, other tabs, annotations, catalogue entries, or original markers',()=>{
  for(const mode of ['ja','en','GM','RW','RS','annotation','catalogue','original']){
    const r=headingRow();
    if(mode==='ja')r.snapshot.values.ja='【一般的な意味】\n既存の本文．';
    if(mode==='en')r.snapshot.values.en='Existing body.';
    if(['GM','RW','RS'].includes(mode))r.tab=mode;
    if(mode==='annotation')r.snapshot.values.de='one two three four five six seven';
    if(mode==='catalogue')r.snapshot.values.de='AV';
    if(mode==='original')r.snapshot.values.de='Saite [GM]';
    const draft=headingBody('ja','[GM]\nG-Saite');
    assert.equal(c.rowCompletionNotesFormatHeadings_(r,'ja',draft),draft,mode);
  }
});
test('inline, detailed, unknown, misplaced, duplicated, and code-quoted source markers stay protected',()=>{
  const r=headingRow();
  for(const body of ['Text [GM]','[GM: symphony-1]','[H: KM1-1]','[GM]\nG-Saite\n[GM]\nMore',
    '```text\n[GM]\n```','~~~text\n[GM]\n~~~','【別の説明】\n[GM]\nG-Saite']){
    const draft=headingBody('ja',body),formatted=c.rowCompletionNotesFormatHeadings_(r,'ja',draft);
    assert.throws(()=>c.rowCompletionValidateText_(r,'ja',formatted),/トークン/,body);
  }
  const misplaced='【一般的な意味】\n[GM]\n弦．\n\n【音楽用語としての訳例】\nG-Saite';
  assert.equal(c.rowCompletionNotesFormatHeadings_(r,'ja',misplaced),misplaced);
  const wrongLanguage=headingBody('ja','[GM]\nG-Saite');
  assert.equal(c.rowCompletionNotesFormatHeadings_(r,'en',wrongLanguage),wrongLanguage);
});
test('canonical group labels do not weaken exact score, URL, HTML, title, or detailed-reference protection',()=>{
  for(const token of ['[[score:kept]]','https://example.invalid/ref#page=7','<em>','《Original title》','[RW: Tristan-1-2]']){
    const r=headingRow();r.snapshot.values.de='Saite '+token;
    for(const field of ['ja','en']){
      const draft=headingBody(field,'[GM]\nG-Saite\n'+token),formatted=c.rowCompletionNotesFormatHeadings_(r,field,draft);
      assert(formatted.includes(token));assert.equal(c.rowCompletionValidateText_(r,field,formatted),formatted);
      assert.throws(()=>c.rowCompletionValidateText_(r,field,formatted.replace(token,'')),/トークン/);
      assert.throws(()=>c.rowCompletionValidateText_(r,field,formatted.replace(token,token+' '+token)),/トークン/);
      assert.throws(()=>c.rowCompletionValidateText_(r,field,formatted+'\n[RS: Invented]'),/トークン/);
    }
  }
});
console.log('Maintenance current style: '+passed+' scenarios passed; tab-specific prompts/validators, real adopted ja/en examples, Notes manual/AI shared formatting, optional equivalents, catalogue exceptions, protected quotations and contextual short translations. No API or Sheet writes.');
