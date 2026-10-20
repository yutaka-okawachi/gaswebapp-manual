'use strict';
function switchLanguageUrl(current,target,options={}){
 if(!['ja','en'].includes(target))throw Error('Invalid target language');
 const url=new URL(current),base=String(options.basePath||'').replace(/\/$/,'');
 let logical=url.pathname;if(base&&logical.startsWith(base+'/'))logical=logical.slice(base.length);
 logical=logical.replace(/^\/(?:ja|en)(?=\/|$)/,'')||'/';
 url.pathname=base+(options.local?'/'+target:target==='en'?'/en':'')+(logical.startsWith('/')?logical:'/'+logical);
 return url.href;
}
(function languageNavigationRuntime(){
 const config=window.__SITE_LANGUAGE_NAV__;if(!config)return;
 const links=()=>[...document.querySelectorAll('[data-language-target]')];
 const controls=()=>[...document.querySelectorAll('input[type=checkbox]')];
 function state(){return {v:1,language:config.language,opera:document.querySelector('input[name=opera]:checked')?.value,searchType:document.querySelector('input[name="search-type"]:checked')?.value,pages:document.getElementById('page-input')?.value,matchMode:document.querySelector('input[name=termMatchMode]:checked')?.value,checks:controls().map(input=>({id:input.id,name:input.name,value:input.value,checked:input.checked}))};}
 function update(){
  const current=new URL(location.href),input=document.getElementById('termInput');
  if(input){if(input.value.trim())current.searchParams.set('q',input.value);else current.searchParams.delete('q');}
  const ui=state();if(ui.opera||ui.pages!==undefined||ui.matchMode||ui.checks.length)current.searchParams.set('ui',JSON.stringify(ui));
  for(const link of links())link.href=switchLanguageUrl(current.href,link.dataset.languageTarget,config);
 }
 const wait=async test=>{for(let i=0;i<120;i++){if(test())return true;await new Promise(resolve=>setTimeout(resolve,50));}return false;};
 function select(name,value){const input=[...document.querySelectorAll('input[type=radio]')].find(el=>el.name===name&&el.value===value);if(input){input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));}return input;}
 async function restore(){
  let saved;try{const raw=new URL(location.href).searchParams.get('ui');if(raw&&raw.length<=16000)saved=JSON.parse(raw);}catch{}if(!saved||saved.v!==1)return update();
  if(['partial','exact'].includes(saved.matchMode))select('termMatchMode',saved.matchMode);
  if(typeof saved.opera==='string'){const input=[...document.querySelectorAll('input[name=opera]')].find(el=>el.value===saved.opera);if(input){input.checked=true;if(typeof handleOperaSelection==='function')await handleOperaSelection({target:input});else input.dispatchEvent(new Event('change',{bubbles:true}));}}
  if(['scene','page','whom'].includes(saved.searchType))select('search-type',saved.searchType);
  const pageInput=document.getElementById('page-input');if(pageInput&&typeof saved.pages==='string')pageInput.value=saved.pages;
  if(saved.searchType==='whom')await wait(()=>document.querySelector('input[name="'+CSS.escape(saved.opera||'')+'-whom"]'));
  let unmatched=false;
  if(Array.isArray(saved.checks)&&saved.checks.length<=300){
   for(const input of controls())input.checked=false;
   for(const item of saved.checks){if(!item||typeof item.value!=='string'||item.checked!==true)continue;let value=item.value;
    if(saved.language!==config.language&&String(item.name||'').endsWith('-whom'))value=config.targetAliases?.[saved.language]?.[saved.opera]?.[value]||value;
    const input=controls().find(el=>(item.id?el.id===item.id:el.name===item.name)&&el.value===value);
    if(input){input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));}else if(String(item.name||'').endsWith('-whom'))unmatched=true;
   }
  }
  if(unmatched){const note=document.createElement('p');note.className='language-transfer-note';note.setAttribute('role','status');note.textContent=config.language==='en'?'Some target selections could not be transferred. Please select the target again.':'指示対象の一部を引き継げませんでした．対象を選び直してください．';document.querySelector('[data-language-switch]').after(note);}
  if(document.getElementById('termInput')){const file=location.pathname.split('/').pop().replace(/\.html$/,'');if(typeof loadData==='function')await loadData(file);if(typeof search==='function')search();}
  else if(!unmatched){if(saved.searchType==='scene'&&typeof searchByScene==='function')searchByScene();if(saved.searchType==='page'&&typeof searchByPage==='function')searchByPage();if(saved.searchType==='whom'&&typeof searchByWhom==='function')searchByWhom();}
  update();
 }
 document.addEventListener('DOMContentLoaded',()=>{update();for(const link of links()){link.addEventListener('pointerdown',update);link.addEventListener('click',update);}});
 window.addEventListener('hashchange',update);window.addEventListener('load',()=>restore().catch(()=>update()));
})();
