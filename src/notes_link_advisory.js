/** Read-only advisory: no source changes, no automatic link decisions. */
function notesLinkAdvisory_(headword, english, source, rows, mappings) {
 const data=rows.map(r=>[r.values.de,r.values.en,r.values.source]);
 if(!data.some(r=>r[0]===headword))data.push([headword,english,source]);
 const index=generateDicTermsIndex(data,mappings||[]),prepared=prepareTermMatchers(index),names={};
 data.forEach(r=>{const id='term-'+normalizeForId(r[0]);if(!names[id])names[id]=[];if(!names[id].includes(r[0]))names[id].push(r[0]);});
 const raw=renderDictionaryNotationText(english,headword,source,'en',part=>renderDictionaryReferenceText(part,fragment=>linkTermsInTranslation(fragment,index,prepared)));
 const html=removeReviewedEnglishTermLinks(renderNotesEnglishLayout(raw,'en'),headword,english,'en');
 const decode=s=>s.replace(/&(?:amp|lt|gt|quot|#039);/g,e=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#039;':"'"})[e]);
 const candidates=[],german=[];let candidateCount=0,germanCount=0;
 html.split('<br>').forEach((line,i)=>{
  const de=/class="notes-example-line" lang="de"/.test(line),context=decode(line.replace(/<[^>]*>/g,'')),group=new Map();
  const re=/<a href="#([^"]+)" class="term-link">([^]*?)<\/a>/g;let m;
  while((m=re.exec(line))){const id=decode(m[1]),label=decode(m[2]),key=JSON.stringify([id,label]);
   if(!group.has(key))group.set(key,{line:i+1,label,target:(names[id]||[id]).join(' / '),context,count:0});
   group.get(key).count++;if(de)germanCount++;else candidateCount++;
  }
  group.forEach(item=>{const list=de?german:candidates;if(list.length<60)list.push(item);});
 });
 return {status:'ready',candidates,german,candidateCount,germanCount,truncated:candidates.reduce((s,r)=>s+r.count,0)<candidateCount||german.reduce((s,r)=>s+r.count,0)<germanCount};
}
function maintenanceNotesLinkAdvisory_(plan,english){
 try{const book=rowCompletionBook_(),rows=notesRegistrationRead_(book.getSheetByName('Notes')).rows,sheet=book.getSheetByName(EXPERIMENTAL_TERM_MAPPING_SHEET_NAME);
  const mappings=sheet&&sheet.getLastRow()>1?namedSheetRead_(sheet,EXPERIMENTAL_TERM_MAPPING_HEADERS,2,sheet.getLastRow()-1).values:[];
  return notesLinkAdvisory_(plan.de,english,plan.source,rows,mappings);
 }catch(_){return {status:'unavailable'};}
}
