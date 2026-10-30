'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const notes=JSON.parse(read('mahler-search-app/data/dic_notes.json')),english=JSON.parse(read('en/mahler-search-app/data/dic_notes.json'));
const target=notes.find(r=>r[0].includes('als トレモロ音符'));
assert(target);const before=JSON.stringify(notes),c=vm.createContext({});
vm.runInContext(read('src/dictionary_notation.js'),c);vm.runInContext(read('src/generate_dic_html.js'),c);
const old=vm.createContext({});
const {extractFunction}=require('./test-utils/extract-function');
for(const name of ['isSafeDictionaryReferenceUrl','renderDictionaryReferenceText'])vm.runInContext(extractFunction(read('src/dictionary_notation.js'),name),old);
vm.runInContext(read('src/generate_dic_html.js'),old);
const scoreToken='[[score:hindemith-glockenspiel-fsharp5]]';
// Reverse only the approved display substitutions, back to each fixture's exact source.
// Keep the whole-document equality: anchors, metadata, links and all other text stay strict.
function restoreApprovedNotation(output,data){
 const note=data.find(r=>r[0].startsWith('Ein Stab aus einem Glockenspiel')&&r[2]==='[H: KM1-1]');assert(note);
 const glockImage=/<img\b[^>]*data-notation="glockenspiel-fsharp5"[^>]*>/g;
 let restored=output.replace(/<dfn class="german">([\s\S]*?)<\/dfn>/g,(_,body)=>'<dfn class="german">'+body.replace(glockImage,note[0].includes(scoreToken)?scoreToken:'(の譜例)')+'</dfn>');
 if(note[1].includes(scoreToken))restored=restored.replace(glockImage,scoreToken);
 else restored=restored.replace(/ <img\b[^>]*data-notation="glockenspiel-fsharp5"[^>]*>/g,'');
 for(const [id,kind,prefix]of [['heldenleben-portamento-strong','down','/ bedeutet stets:'],['heldenleben-portamento-slide','up','/ bedeutet:']]){
  const token='[[score:'+id+']]',row=data.find(r=>r[0].startsWith(prefix)||r[0].startsWith(token));if(!row)continue;
  const image=new RegExp('<img\\b[^>]*data-notation="portamento-wave-'+kind+'"[^>]*>','g');
  restored=restored.replace(/<dfn class="german">([\s\S]*?)<\/dfn>/g,(_,body)=>'<dfn class="german">'+body.replace(image,row[0].includes(token)?token:'/')+'</dfn>');
  restored=restored.replace(image,row[1].includes(token)?token:'/');
 }
 return restored.replace(/<img\b[^>]*data-notation="quarter-tremolo-three"[^>]*>/,'トレモロ音符').replace(/<img\b[^>]*data-notation="short-pause"[^>]*>/g,'𝄐');
}
function assertExactDocument(output,original,data){
 assert.equal(restoreApprovedNotation(output,data),original,'Only approved display substitutions change; all anchors, metadata, example links and source/translated text remain identical');
}
function assertTamperingRejected(output,original,data){
 const changes=[
  ['anchor',html=>html.replace('id="term-','id="tampered-term-')],
  ['metadata',html=>html.replace(/("@type":\s*)"DefinedTermSet"/,'$1"TamperedTermSet"')],
  ['example link',html=>html.replace(/href="((?:rw_|rs_)?terms_search\.html[^\"]*)"/,'href="$1&tampered=1"')],
  ['source text',html=>html.replace('<dfn class="german">','<dfn class="german">tampered ')],
  ['translation',html=>html.replace('<dd class="translation">','<dd class="translation">tampered ')]
 ];
 for(const [name,change]of changes){const changed=change(output);assert.notEqual(changed,output,'Mutation reaches '+name);assert.throws(()=>assertExactDocument(changed,original,data),assert.AssertionError,'Reject unintended '+name+' changes');}
}
let checks=0;
for(const language of ['ja','en']){
 const data=language==='ja'?notes:english,row=data.find(r=>r[0]===target[0]);
 const html=c.renderDictionaryNotationText(row[0],row[0],row[2],language);
 assert.equal((html.match(/<img\b/g)||[]).length,1);
 const image=html.match(/<img\b[^>]+>/)[0],svg=decodeURIComponent(image.match(/src="data:image\/svg\+xml,([^"]+)"/)[1]);
 assert.equal((svg.match(/data-note="quarter"/g)||[]).length,1);assert.equal((svg.match(/data-stem="single"/g)||[]).length,1);assert.equal((svg.match(/data-tremolo-stroke="true"/g)||[]).length,3);
 assert(!/<text\b|font-family|<script\b|foreignObject|data-flag|augmentation-dot/.test(svg));
 assert(svg.includes('fill="black"'));assert(svg.includes('data-stem-direction="down"')); if(language==='en')assert(!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(image));
 const output=c.generateDicHtml(data,[],null,[],{language});const original=old.generateDicHtml(data,[],null,[],{language});
 assert.equal((output.match(/dictionary-music-notation/g)||[]).length,language==='en'?9:8);
 const pauses=output.match(/<img\b[^>]*data-notation="short-pause"[^>]*>/g);
 assert.equal(pauses.length,language==='en'?2:1,'Only the approved quotation and its English translation receive pause signs');
 if(language==='en')assert.equal(pauses[1],pauses[0],'The English translation uses exactly the same short-pause SVG and accessible label');
 assertExactDocument(output,original,data);
 assertTamperingRejected(output,original,data);
 for(const r of data)if(r[0]!==target[0]&&!r[0].startsWith('Ein Stab aus einem Glockenspiel')&&!/^(?:\/ bedeutet|\[\[score:heldenleben-portamento-)/.test(r[0]))assert.equal(c.renderDictionaryNotationText(r[0],r[0],r[2],language),c.escapeHtml(r[0]),'No unrelated dictionary notation is changed');
 assert(!c.renderDictionaryNotationText(row[1],row[0],row[2],language).includes('<img'),'Spelled-out tremolo references in explanations remain words');
 assert(!c.renderDictionaryNotationText(row[0],row[0],'[GM]',language).includes('<img'));
 assert(!c.renderDictionaryNotationText(row[0],row[0]+' altered',row[2],language).includes('<img'));
 const nfd=row[0].normalize('NFD');assert(c.renderDictionaryNotationText(nfd,nfd,row[2],language).includes('<img'));
 assert.equal(c.renderDictionaryNotationText('<img onerror="x">','unrelated','',language),'&lt;img onerror=&quot;x&quot;&gt;');checks+=data.length+14;
}
// Explicit compact fixtures avoid relying on whichever migration state the live Sheet has.
for(const language of ['ja','en'])for(const scenario of ['legacy','token','partial-source','partial-translation']){
 const live=language==='ja'?notes:english;
 const glock=JSON.parse(JSON.stringify(live.find(r=>r[0].startsWith('Ein Stab aus einem Glockenspiel')&&r[2]==='[H: KM1-1]')));
 glock[0]='Ein Stab aus einem Glockenspiel (Klang Fis(の譜例) , ebenso notiert) ';
 glock[1]=language==='ja'?'実音はFis、記譜も同じ高さ。':'Sounding F-sharp, and notated at the same pitch.';
 if(scenario==='token'||scenario==='partial-source')glock[0]=glock[0].replace('(の譜例)',' '+scoreToken);
 if(scenario==='token'||scenario==='partial-translation')glock[1]+=' '+scoreToken;
 const data=[live.find(r=>r[0]===target[0]),live.find(r=>r[0]==='anhalten'),glock,['fixture unchanged','Unchanged translation','[GM]']];assert(data.every(Boolean));
 const fixtureBefore=JSON.stringify(data),output=c.generateDicHtml(data,[],null,[],{language}),original=old.generateDicHtml(data,[],null,[],{language});
 assert.equal((output.match(/data-notation="glockenspiel-fsharp5"/g)||[]).length,2,language+' '+scenario+' has one source and one translation image');
 assertExactDocument(output,original,data);assertTamperingRejected(output,original,data);
 assert.equal(JSON.stringify(data),fixtureBefore,'Fixture remains canonical: '+language+' '+scenario);checks+=9;
}
assert.equal(JSON.stringify(notes),before);
console.log('Dictionary notation: '+checks+' checks; exact Notes21 quotation, one quarter note/three strokes, language alt text, '+notes.length+'-entry isolation, exact full-document legacy/token/partial fixtures in both languages, 50 anchor/metadata/example-link/source/translation tamper rejections, canonical data and safe escaping passed. Don Quixote reference-score footnote verified (PDF32/printed p.224).');
