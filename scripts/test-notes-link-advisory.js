const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const c=vm.createContext({});for(const n of ['dictionary_notation','generate_dic_html','notes_link_advisory'])vm.runInContext(fs.readFileSync('src/'+n+'.js','utf8'),c);
const rows=['See','Kind','Hand','anhalten'].map(de=>({values:{de,en:'',source:''}}));const check=(en,de='new',m=[])=>c.notesLinkAdvisory_(de,en,'',rows,m);let n=0;function test(f){f();n++;}
test(()=>assert.equal(check('See the kind hand.').candidateCount,3));
test(()=>{const r=check('【Examples in musical contexts】\nGerman: die Hand\nEnglish: A kind hand.');assert.equal(r.germanCount,1);assert.equal(r.candidateCount,2);});
test(()=>assert.equal(check('The German word “Kind” means child.').candidateCount,1));
test(()=>assert.equal(check('【Examples in musical contexts】\n“German: Hand”').germanCount,0));
test(()=>assert.equal(check('See the entry for anhalten.','angehalten').candidateCount,1));
test(()=>assert.equal(check('[Reference](https://example.org/Hand)').candidateCount,0));
test(()=>assert.equal(check('Hände.','new',[['Hand','Hände','','対象','','']]).candidates[0].target,'Hand'));
test(()=>assert.equal(check('handful kindness seaside').candidateCount,0));
test(()=>{const r=check('Hand Hand');assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].count,2);});
test(()=>assert(check('<img src=x onerror=bad()> Hand').candidates[0].context.includes('<img')));
test(()=>{const old=JSON.stringify(rows);assert.equal(check('').candidateCount,0);assert.equal(JSON.stringify(rows),old);});
test(()=>assert.equal(check('Novelword','Novelword').candidateCount,1));
test(()=>{const r=check(Array(75).fill('Hand').join('\n'));assert.equal(r.candidateCount,75);assert.equal(r.candidates.length,60);assert(r.truncated);});
test(()=>{c.rowCompletionBook_=()=>{throw Error('offline')};assert.equal(c.maintenanceNotesLinkAdvisory_({},'').status,'unavailable');});
console.log('Rebuilt link advisory: '+n+' scenarios passed.');
