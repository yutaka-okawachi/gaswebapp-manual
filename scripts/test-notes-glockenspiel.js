'use strict';
const {legacyNotesRows}=require('./test-utils/score-example-fixtures');
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const heading='Ein Stab aus einem Glockenspiel (Klang Fis(の譜例) , ebenso notiert)',source='[H: KM1-1]';
const identity=row=>String(row[0]??'').normalize('NFC').trim()===heading&&String(row[2]??'').trim()===source;
const imgs=html=>[...html.matchAll(/<img\b[^>]*data-notation="glockenspiel-fsharp5"[^>]*src="data:image\/svg\+xml,([^"]*)"[^>]*>/g)];
let checks=0;
for(const language of ['ja','en']){
 const prefix=language==='en'?'en/':'',notes=legacyNotesRows(JSON.parse(read(prefix+'mahler-search-app/data/dic_notes.json'))),before=JSON.stringify(notes),row=notes.find(identity);assert(row,'The source is a Notes heading, never a GM item');
 const nodes=[],container={innerHTML:'',appendChild(n){nodes.push(n);}};
 const document={documentElement:{lang:language},getElementById:id=>id==='listContainer'?container:null,createElement:()=>({innerHTML:'',style:{},classList:{add(){}},children:[],appendChild(n){this.children.push(n);}})};
 const window={addEventListener(){},appData:{dic_notes:notes,dic_terms_index:{}},location:{pathname:'/'+prefix+'mahler-search-app/other.html',search:''}};
 const c=vm.createContext({window,document,URL,URLSearchParams,console,setTimeout,clearTimeout,navigator:{userAgent:'test'}});vm.runInContext(read(prefix+'mahler-search-app/js/app.js'),c);
 const original=c.renderDictionaryNotationText(row[0],row[0],row[2],language),translated=c.renderDictionaryNotationText(row[1],row[0],row[2],language),image=imgs(original)[0];assert.equal(imgs(original).length,1);assert.equal(imgs(translated).length,1);
 assert(original.startsWith(c.escapeHtml(row[0].split('(の譜例)')[0])));assert(original.endsWith(c.escapeHtml(row[0].split('(の譜例)')[1])));assert(!original.includes('(の譜例)'),'Replace only the inner placeholder in display');
 assert.equal(original.replace(image[0],'(の譜例)'),c.escapeHtml(row[0]),'Preserve Fis, German punctuation, outer parentheses and trailing whitespace');
 assert.equal(translated.replace(' '+imgs(translated)[0][0],''),c.escapeHtml(row[1]),'Translation stays verbatim');
 const svg=decodeURIComponent(image[1]);assert.equal(svg,decodeURIComponent(imgs(translated)[0][1]));assert(svg.includes('viewBox="0 0 105 96"'));assert(svg.includes('SIL OPEN FONT LICENSE'));
 for(const y of [38,44,50,56,62])assert(svg.includes('M8 '+y+' H97'));
 assert.equal((svg.match(/data-clef="treble"/g)||[]).length,1);assert(svg.includes('translate(12 56) scale(.024 -.024)'));assert.equal((svg.match(/data-accidental="sharp"/g)||[]).length,1);assert(svg.includes('translate(40 38) scale(.024 -.024)'));
 assert.equal((svg.match(/data-duration="quarter"/g)||[]).length,1);assert(svg.includes('data-pitch="F-sharp5"'));assert(svg.includes('cx="55" cy="38" rx="4.6" ry="3.1"'));assert(svg.includes('M51 38 V63'));assert(svg.includes('M97 38 V62'));
 assert(!/<text\b|font-family|foreignObject|<script\b|<rect\b|fill="white"|data-ledger|data-time-signature/.test(svg),'Transparent background, no extra ledger, meter or key signature');
 if(language==='en')assert(!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(image[0]),'English alt/title are localized');
 for(const [de,tag]of [[row[0]+' changed',source],[row[0],'[GM]'],[row[0],'[H: KM1-2]'],['other',source]])assert.equal(imgs(c.renderDictionaryNotationText(de,de,tag,language)).length,0,'Strict Notes heading + source, not a prefix or GM key');
 for(const form of ['NFC','NFD']){const de=row[0].normalize(form);assert.equal(imgs(c.renderDictionaryNotationText(de,de,row[2],language)).length,1);}
 for(const pool of [[['eilen','',''],row,['eindringen','','']],[...notes].reverse(),[row]]){
  assert.equal(pool.filter(identity).length,1);assert.equal(pool.reduce((n,r)=>n+imgs(c.renderDictionaryNotationText(r[0],r[0],r[2],language)).length,0),1,'Row insertion/deletion/reordering does not change the match');checks++;
 }
 assert.equal(window.hasMusicNotationForRow(row),false,'Notes target is not registered in the GM/opera renderer');
 for(let n=0;n<3;n++){const html=window.searchTermsLocal('Ein Stab aus einem Glockenspiel');assert.equal(imgs(html).length,2,'Notes word search: source and translation each once');assert(html.includes(source));checks++;}
 c.onlyNotes=[row];vm.runInContext('renderDictionaryList(onlyNotes);',c);assert.equal(nodes.length,1);const german=nodes[0].children[0].children[0].innerHTML,translation=nodes[0].children[1].innerHTML;assert.equal(imgs(german).length,1);assert.equal(imgs(translation).length,1,'Dynamic dictionary source and body');
 const dictionary=read(prefix+'mahler-search-app/dic.html'),id='term-ein-stab-aus-einem-glockenspiel-klang-fis-ebenso-notiert',start=dictionary.indexOf('<div class="row" id="'+id+'">'),end=dictionary.indexOf('<div class="row" id=',start+1);assert(start>=0);const section=dictionary.slice(start,end);assert.equal(imgs(section).length,2,'Canonical static dictionary source and body');assert(section.includes(source));
 assert.equal(JSON.stringify(notes),before,'Notes source, translation, source tags and array order remain intact');
 const unsafe='<script>alert(1)</script> & '+row[1];const safe=c.renderDictionaryNotationText(unsafe,row[0],row[2],language);assert(!safe.includes('<script>'));assert(safe.includes('&lt;script&gt;'));assert.equal(imgs(safe).length,1);
 const css=read(prefix+'mahler-search-app/css/common.css');assert(/dictionary-glockenspiel-example\s*\{[^}]*width:\s*6.5em;[^}]*height:\s*auto;[^}]*max-width:\s*100%/.test(css));
}
console.log('Notes Glockenspiel: strict Notes heading/source identity, row moves, F-sharp5 geometry, independent JA/EN source/body images, static/dynamic/word-search paths, unchanged data and safe escaping passed ('+checks+' repeat/order scenarios).');
