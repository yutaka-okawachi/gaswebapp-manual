'use strict';
// Reuse the English build's source ordering and shard membership, replacing display fields
// with the same captured ja/whom cells. No second Sheet read or write is performed.
const fs=require('fs'),path=require('path'),vm=require('vm');
function buildJapanesePreview(root,source,english){
 const data=name=>JSON.parse(fs.readFileSync(path.join(root,'mahler-search-app/data',name+'.json'),'utf8'));
 const c=vm.createContext({});for(const file of ['dictionary_notation','generate_dic_html'])vm.runInContext(fs.readFileSync(path.join(root,'src',file+'.js'),'utf8'),c);
 const files={},rowsByComposer={};
 for(const [tab,name,code]of [['GM','mahler','gm'],['RW','richard_wagner','rw'],['RS','richard_strauss','rs']]){
  const inputs=source.tabs[tab].filter(row=>tab==='GM'||row.page!=null&&String(row.page).trim()!=='');
  const base=data(name),score=new Map(base.map(row=>[String(row.Oper),row['楽譜情報']]));
  const scenes=tab==='GM'?[]:data(tab==='RW'?'rw_scenes':'rs_scenes'),sceneMap=new Map(scenes.map(row=>[[row.Oper,row.Aufzug,row.Szene].join('|'),row['日本語']]));
  const rows=english.files['mahler-search-app/data/'+name+'.json'].map((row,index)=>{const copy={...row},input=inputs[index];delete copy.en;delete copy.whom_en;copy.ja=String(input.ja??'');if(tab!=='GM'){copy.whom=String(input.whom??'');copy['楽譜情報']=score.get(String(input.Oper))||'';copy['場面タイトル']=sceneMap.get([input.Oper,input.Aufzug,input.Szene].join('|'))||'';}return copy;});
  rowsByComposer[code]=rows;files['mahler-search-app/data/'+name+'.json']=rows;
 }
 for(const [file,value]of Object.entries(english.files))if(file.includes('/dictionary-examples/')){const code=file.split('/').pop().slice(0,2);files[file]=value.map(row=>({...rowsByComposer[code][row.__exampleOrder],__exampleOrder:row.__exampleOrder}));}
 const notes=source.tabs.Notes.map(row=>[row.de,String(row.ja??''),String(row.source??'')]);
 files['mahler-search-app/data/dic_notes.json']=notes;files['mahler-search-app/dic.html']=c.generateDicHtml(notes,data('abbr_list'),english.exampleQueryIndex,english.mappingRows);
 files['mahler-search-app/data/dic_terms_index.json']=c.generateDicTermsIndex(notes,english.mappingRows);
 const targets={};for(const row of rowsByComposer.rw.concat(rowsByComposer.rs)){const key=String(row.Oper).toLowerCase().trim();(targets[key]||=[]).push(...String(row.whom).split(/[,、;\n]/).map(v=>v.trim()).filter(Boolean));}for(const key of Object.keys(targets))targets[key]=[...new Set(targets[key])].sort();files['mahler-search-app/data/whom_list.json']=targets;
 for(const name of ['rw_scenes','rs_scenes'])files['mahler-search-app/data/'+name+'.json']=data(name);
 return {files};
}
module.exports={buildJapanesePreview};
