'use strict';
const legal=require('./site-legal');
function switchLanguageUrl(current,target,options={}){
 if(!['ja','en'].includes(target))throw Error('Invalid target language');
 const url=new URL(current),base=String(options.basePath||'').replace(/\/$/,'');
 let logical=url.pathname;if(base&&logical.startsWith(base+'/'))logical=logical.slice(base.length);
 logical=logical.replace(/^\/(?:ja|en)(?=\/|$)/,'')||'/';
 url.pathname=base+(options.local?'/'+target:target==='en'?'/en':'')+(logical.startsWith('/')?logical:'/'+logical);
 return url.href;
}
function buildTargetAliases(source){
 const sets={ja:Object.create(null),en:Object.create(null)};
 for(const tab of ['RW','RS'])for(const row of source.tabs[tab]||[]){
  const a=String(row.whom||'').trim(),b=String(row.whom_en||'').trim(),opera=String(row.Oper||'');
  // Only explicit, unambiguous single-target translations; never infer multi-person alignment.
  if(!a||!b||/[,、;\n]/.test(a)||/[,、;\n]/.test(b))continue;
  for(const [lang,from,to]of [['ja',a,b],['en',b,a]]){const group=sets[lang][opera]||=(Object.create(null));(group[from]||=(new Set())).add(to);}
 }
 return Object.fromEntries(Object.entries(sets).map(([lang,operas])=>[lang,Object.fromEntries(Object.entries(operas).map(([opera,entries])=>[opera,Object.fromEntries(Object.entries(entries).filter(([,values])=>values.size===1).map(([from,values])=>[from,[...values][0]]))]))]));
}
function stripLanguageUi(html){return html.replace(/<!-- language-ui:start -->[^]*?<!-- language-ui:end -->/g,'');}
function decorateHtml(html,options={}){
 const language=options.language==='ja'?'ja':'en',enabled=options.local===true||options.englishEnabled===true;
 html=legal.decorateHtml(stripLanguageUi(html),options);
 if(language==='en'){
  if(/\/(?:rw|rs)_synopsis\.html$/.test('/'+options.file)&&!html.includes('data-japanese-only="synopsis"'))html=html.replace(/<\/h1>/i,'</h1><p class="japanese-only-note" role="note" data-japanese-only="synopsis">Available in Japanese only.</p>');
  if(options.file==='mahler-search-app/other.html')html=html.replace(/<a\b[^>]*class=["'][^"']*\barticle-link\b[^"']*["'][^>]*>[^]*?<\/a>/gi,link=>/Shostakovich[^]*passacaglia|ショスタコーヴィチ[^]*パッサカリア/i.test(link)?link+' <span class="japanese-only-note" data-japanese-only="essay">Available in Japanese only.</span>':link);
 }
 if(!enabled)return html;
 const config={language,local:options.local===true,basePath:options.local?'':'/gaswebapp-manual',targetAliases:options.targetAliases||{ja:{},en:{}}};
 const current='http://preview.invalid/'+options.file,escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 const link=lang=>{const u=new URL(switchLanguageUrl(current,lang,config));return escape(u.pathname+u.search+u.hash);};
 const nav='<!-- language-ui:start --><div class="site-language-switch" id="site-language-switch" role="navigation" data-language-switch aria-label="Language: Japanese / English"><a lang="en" hreflang="ja" data-language-target="ja" href="'+link('ja')+'"'+(language==='ja'?' aria-current="page"':'')+'>Japanese</a><span aria-hidden="true">/</span><a lang="en" hreflang="en" data-language-target="en" href="'+link('en')+'"'+(language==='en'?' aria-current="page"':'')+'>English</a></div><!-- language-ui:end -->';
 const script=options.file?.includes('/')?'js/site-language-switch.js':'mahler-search-app/js/site-language-switch.js';
 const head='<!-- language-ui:start --><style>.site-language-switch{display:flex;visibility:visible;justify-content:flex-end;align-items:center;gap:.25rem;box-sizing:border-box;width:fit-content;max-width:100%;margin:0 0 12px auto;padding:0;background:transparent;border:0;box-shadow:none;font-family:var(--font-sans,Arial,sans-serif);font-size:.85rem;line-height:1.5;position:relative;z-index:1}.site-language-switch a{display:inline-flex;align-items:center;min-height:28px;padding:0 1px;border:0;color:#174a8b;background:transparent;text-decoration:underline}.site-language-switch [aria-current=page]{font-weight:700;text-decoration:none;color:inherit}@media(max-width:600px){.site-language-switch a{min-height:36px;min-width:44px;justify-content:center}}.japanese-only-note{font-size:.9em;color:#555}.language-transfer-note{margin:8px 24px;padding:8px;border-left:3px solid #888}</style><script>window.__SITE_LANGUAGE_NAV__='+JSON.stringify(config).replaceAll('<','\\u003c')+';</script><script src="'+script+'"></script><!-- language-ui:end -->';
 html=html.replace(/<head([^>]*)>/i,'<head$1>'+head);
 // Put the static home-page switch inside the visible title header, without a JavaScript dependency.
 if(options.file==='index.html'&&/<header\b[^>]*class=["'][^"']*\bmain-header\b/.test(html))return html.replace(/(<header\b[^>]*class=["'][^"']*\bmain-header\b[^>]*>)/i,'$1'+nav);
 return html.replace(/<body([^>]*)>/i,'<body$1>'+nav);
}
function languageNavigationRuntime(){
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
}
function runtimeSource(){return "'use strict';\n"+switchLanguageUrl.toString()+'\n('+languageNavigationRuntime.toString()+')();\n';}
module.exports={switchLanguageUrl,buildTargetAliases,stripLanguageUi,decorateHtml,runtimeSource};
