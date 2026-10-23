'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const locale=require('./english-locale');
const {validateGmOriginals}=require('./gm-original-validation');
const normalize=s=>String(s||'').toLowerCase().replaceAll('ä','ae').replaceAll('ö','oe').replaceAll('ü','ue').replaceAll('ß','ss').trim();
function englishValue(value,missing){return String(value||'').trim()?locale.localizeHtml(String(value),missing):'English translation is not yet available.';}
function buildEnglishSite(root,source,options={}){
 if(source.schema!==1||!source.tabs)throw Error('Invalid English source snapshot');
 const missing=new Set(),data=name=>{const key='mahler-search-app/data/'+name+'.json';if(options.baseFiles){if(!Object.hasOwn(options.baseFiles,key))throw Error('Same-snapshot metadata missing: '+key);return options.baseFiles[key];}return JSON.parse(fs.readFileSync(path.join(root,key),'utf8'));};
 const context=vm.createContext({console});for(const f of ['dictionary_notation','dictionary_example_shards','generate_dic_html'])vm.runInContext(fs.readFileSync(path.join(root,'src',f+'.js'),'utf8'),context);
 const base={GM:data('mahler'),RW:data('richard_wagner'),RS:data('richard_strauss')};
 const warnings=validateGmOriginals(source.tabs.GM||[]);
 const stats={},converted={};
 for(const tab of ['GM','RW','RS','Notes']){
  const rows=source.tabs[tab];if(!Array.isArray(rows)||!rows.length)throw Error('Missing full source: '+tab);
  stats[tab]={sourceRows:rows.length,visibleRows:0,blankPageRows:0,missingEnglish:0,missingTargetEnglish:0,blankTargetRows:0};
  const scoreMap=new Map((base[tab]||[]).map(r=>[String(r.Oper),r['楽譜情報']]));
  converted[tab]=[];
  for(const row of rows){
   for(const key of ['de','ja','en'])if(!(key in row))throw Error(tab+': missing '+key);
   if((tab==='RW'||tab==='RS')&&(row.page===null||row.page===undefined||String(row.page).trim()==='')){stats[tab].blankPageRows++;continue;}
   if(!String(row.en||'').trim())stats[tab].missingEnglish++;
   const text=englishValue(row.en,missing);
   if(tab==='Notes')converted[tab].push([row.de,text,String(row.source||'')]);
   else if(tab==='GM')converted[tab].push({de:row.de,de_normalized:normalize(row.de),ja:text,en:text,data:row.data});
   else{
    const hasSourceTarget=String(row.whom||'').trim()!=='';
    if(!String(row.whom_en||'').trim()){if(hasSourceTarget)stats[tab].missingTargetEnglish++;else stats[tab].blankTargetRows++;}
    const target=String(row.whom_en||'').trim()?locale.localizeText(row.whom_en,missing):hasSourceTarget?'Target translation unavailable':'';
    const scene=[row.Aufzug?'Act '+row.Aufzug:'',row.Szene?'Scene '+row.Szene:''].filter(Boolean).join(', ');
    converted[tab].push({Oper:row.Oper,Aufzug:row.Aufzug,Szene:row.Szene,page:row.page,whom:target,whom_en:target,de:row.de,de_normalized:normalize(row.de),ja:text,en:text,'楽譜情報':locale.localizeText(scoreMap.get(String(row.Oper))||'',missing),'場面タイトル':scene});
   }
  }
  stats[tab].visibleRows=converted[tab].length;
 }
 const existingIndex=data('dic_terms_index'),byId=new Map(converted.Notes.map(row=>['term-'+context.normalizeForId(row[0]),row[0]])),mappings=Array.isArray(source.termMappings)?source.termMappings.map(row=>row.slice()):[];
 if(!Array.isArray(source.termMappings))for(const entry of Object.values(existingIndex))if(entry&&typeof entry==='object'&&entry.exampleVariants){const heading=byId.get(entry.id);if(heading)for(const form of entry.exampleVariants){const alias=existingIndex[context.normalizeForId(form)],aliasId=typeof alias==='string'?alias:alias?.id,type=entry.exampleVariantDetails?.find(d=>d.form===form)?.type||'';mappings.push([heading,form,type,aliasId===entry.id?'対象':'対象外','対象','']);}}
 const examples=context.buildDictionaryExampleShardFiles(converted.Notes,{mahler:converted.GM,wagner:converted.RW,strauss:converted.RS},mappings);
 const html=context.generateDicHtml(converted.Notes,data('abbr_list'),examples.queryIndex,mappings,{language:'en'}),index=context.generateDicTermsIndex(converted.Notes,mappings);
 const targets={};for(const row of converted.RW.concat(converted.RS)){const key=String(row.Oper).toLowerCase().trim();(targets[key]||=[]).push(...String(row.whom).split(/[,、;\n]/).map(value=>value.trim()).filter(Boolean));}for(const key of Object.keys(targets))targets[key]=[...new Set(targets[key])].sort();
 const files={...examples.files,'mahler-search-app/data/mahler.json':converted.GM,'mahler-search-app/data/richard_wagner.json':converted.RW,'mahler-search-app/data/richard_strauss.json':converted.RS,'mahler-search-app/data/dic_notes.json':converted.Notes,'mahler-search-app/data/dic_terms_index.json':index,'mahler-search-app/data/whom_list.json':targets,'mahler-search-app/dic.html':html};
 for(const name of ['rw_scenes','rs_scenes'])files['mahler-search-app/data/'+name+'.json']=data(name).map(row=>({...row,'日本語':[row.Aufzug?'Act '+row.Aufzug:'',row.Szene?'Scene '+row.Szene:''].filter(Boolean).join(', ')}));
 return {files,stats,missing,warnings,exampleQueryIndex:examples.queryIndex,mappingRows:mappings,readAt:source.readAt,sourceHash:source.hash,mappings: mappings.length,localizeHtml:html=>locale.localizeHtml(html,missing)};
}
function assertEnglishReleaseGate(options={}){if(options.publishEnglish!==true||options.englishReleaseApproved!==true)throw Error('English public release is disabled; local preview only.');}
module.exports={buildEnglishSite,englishValue,assertEnglishReleaseGate};
