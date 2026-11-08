'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fixture=require('./fixtures/notes-dicht-score.json'),token='[[score:mahler-trill-chain]]';
const images=html=>[...html.matchAll(/<img\b[^>]*data-notation="gm325-example"[^>]*>/g)].map(m=>m[0]);
const svg=image=>decodeURIComponent(image.match(/src="data:image\/svg\+xml,([^"]+)"/)[1]);
const restore=html=>html.replace(/<span class="rs-score-example-scroll"[^>]*><img\b[^>]*data-notation="gm325-example"[^>]*><\/span>/g,token);
let checks=0;
for(const language of ['ja','en']){
 const prefix=language==='en'?'en/':'',row=fixture.notes[language],before=JSON.stringify(row),nodes=[];
 const container={innerHTML:'',appendChild(node){nodes.push(node);}};
 const document={documentElement:{lang:language},getElementById:id=>id==='listContainer'?container:null,createElement:()=>({innerHTML:'',style:{},classList:{add(){}},children:[],appendChild(n){this.children.push(n);}})};
 const window={addEventListener(){},appData:{dic_notes:[row],dic_terms_index:{}},location:{pathname:'/'+prefix+'mahler-search-app/other.html',search:''}};
 const c=vm.createContext({window,document,URL,URLSearchParams,console,setTimeout,clearTimeout,navigator:{userAgent:'test'}});
 // Use the actual source bundle so both languages are tested before publication.
 for(const file of JSON.parse(read('frontend/bundle.json')))vm.runInContext(read(file),c);
 const render=(value,source=row[2])=>c.renderDictionaryNotationText(value,row[0],source,language,c.escapeHtml);
 const html=render(row[1]),scores=images(html);assert.equal(scores.length,2,'One image each in the German and translated Notes field');
 assert(!html.includes('score-example-unavailable'));assert.equal(restore(html),c.escapeHtml(row[1]),'Only approved tokens change; all text and references remain exact');
 assert.equal(svg(scores[0]),svg(scores[1]));
 const gm=JSON.parse(read(prefix+'mahler-search-app/data/mahler.json')).find(r=>r.data==='M-2-5-55-dir&');assert(gm);
 assert.equal(svg(scores[0]),svg(images(window.linkTermsInTranslation(gm.de,{},gm))[0]),'Notes reuses the unchanged GM artwork');
 const score=svg(scores[0]);assert.equal((score.match(/data-duration="quarter"/g)||[]).length,4);assert.equal((score.match(/data-grace="thirty-second"/g)||[]).length,8);assert.equal((score.match(/data-beam="thirty-second"/g)||[]).length,12);assert.equal((score.match(/data-accidental="natural"/g)||[]).length,2);assert(score.includes('SIL OPEN FONT LICENSE'));
 if(language==='en')assert(!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(scores[0]));
 assert.equal(images(render(row[1].split(token).join(token+' '+token))).length,2,'Duplicate tokens are suppressed within each field, not across fields');
 for(const form of ['NFC','NFD'])assert.equal(images(render(row[1].normalize(form))).length,2);
 assert.equal(images(render(row[1].replace(/\n/g,'\r\n'))).length,2);
 for(const value of [token,row[1].replace('[GM]','[RW: Oper]'),row[1].replace('Anmerk. f. d. Dirigenten','Changed quotation'),row[1].replace(/【(?:音楽用語としての訳例|Examples in musical contexts)】/,'【Other】')])assert.equal(images(render(value)).length,0,'No unrelated or incomplete context inherits a GM score');
 assert.equal(images(render(row[1],'[RW: Oper]')).length,0);
 const unsafe=render(row[1]+'\n<script>alert(1)</script> [[score:unknown-artwork]] '+token);assert.equal(images(unsafe).length,2);assert(!unsafe.includes('<script>'));assert(unsafe.includes('score-example-unavailable'));
 for(let i=0;i<3;i++)assert.equal(images(window.searchTermsLocal('dicht')).length,2,'Repeated Notes search shows two images without accumulation');
 c.rows=[['unrelated','plain','[GM]'],row];vm.runInContext('renderDictionaryList(rows);',c);assert.equal(nodes.reduce((count,node)=>count+images(node.children[1].innerHTML).length,0),2,'Dynamic Notes list');
 vm.runInContext(read('src/generate_dic_html.js'),c);
 for(const rows of [[row],c.rows,[...c.rows].reverse()]){const output=c.generateDicHtml(rows,[],null,[],{language});assert.equal(images(output).length,2);assert(output.includes('id="term-dicht"'));assert(!output.includes('score-example-unavailable'));}
 const css=read(prefix+'mahler-search-app/css/common.css');assert(/rs-score-example-scroll\s*\{[^}]*max-width:\s*100%;[^}]*overflow-x:\s*auto/.test(css));assert(html.includes('tabindex="0"')&&html.includes('role="region"'));
 assert.equal(JSON.stringify(row),before,'Source data remains untouched');checks+=29;
}
console.log('Notes dicht score: '+checks+' JA/EN assertions covering shared score geometry, separate source/translation images, exact text, duplicate suppression, safe context, unknown tokens, static/dynamic/search paths and row moves passed.');
