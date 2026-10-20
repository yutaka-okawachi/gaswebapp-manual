'use strict';
const legal=require('./site-legal');
function switchLanguageUrl(current,target,options={}){
 if(!['ja','en'].includes(target))throw Error('Invalid target language');
 const url=new URL(current),base=String(options.basePath||'').replace(/\/$/,'');
 let logical=url.pathname;if(base&&logical.startsWith(base+'/'))logical=logical.slice(base.length);
 logical=logical.replace(/^\/(?:ja|en)(?=\/|$)/,'')||'/';
 url.pathname=base+(options.local?'/'+target:target==='en'?'/en':'')+(logical.startsWith('/')?logical:'/'+logical);
 url.search='';url.hash='';
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
 const config={language,local:options.local===true,basePath:options.local?'':'/gaswebapp-manual'};
 const current='http://preview.invalid/'+options.file,escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
 const link=lang=>{const u=new URL(switchLanguageUrl(current,lang,config));return escape(u.pathname+u.search+u.hash);};
 const nav='<!-- language-ui:start --><div class="site-language-switch" id="site-language-switch" role="navigation" data-language-switch aria-label="Language: Japanese / English"><a lang="en" hreflang="ja" data-language-target="ja" href="'+link('ja')+'"'+(language==='ja'?' aria-current="page"':'')+'>Japanese</a><span aria-hidden="true">/</span><a lang="en" hreflang="en" data-language-target="en" href="'+link('en')+'"'+(language==='en'?' aria-current="page"':'')+'>English</a></div><!-- language-ui:end -->';
 const script=options.file?.includes('/')?'js/site-language-switch.js':'mahler-search-app/js/site-language-switch.js';
 const head='<!-- language-ui:start --><style>.site-language-switch{display:flex;visibility:visible;justify-content:flex-end;align-items:center;gap:.25rem;box-sizing:border-box;width:fit-content;max-width:100%;margin:0 0 12px auto;padding:0;background:transparent;border:0;box-shadow:none;font-family:var(--font-sans,Arial,sans-serif);font-size:.85rem;line-height:1.5;position:relative;z-index:1}.site-language-switch a{display:inline-flex;align-items:center;min-height:28px;padding:0 1px;border:0;color:#174a8b;background:transparent;text-decoration:underline}.site-language-switch [aria-current=page]{font-weight:700;text-decoration:none;color:inherit}@media(max-width:600px){.site-language-switch a{min-height:36px;min-width:44px;justify-content:center}}.japanese-only-note{font-size:.9em;color:#555}.language-transfer-note{margin:8px 24px;padding:8px;border-left:3px solid #888}</style><script>window.__SITE_LANGUAGE_NAV__='+JSON.stringify(config).replaceAll('<','\\u003c')+';</script><script src="'+script+'"></script><!-- language-ui:end -->';
 html=html.replace(/<head([^>]*)>/i,'<head$1>'+head);
 // Put the static home-page switch inside the visible title header, without a JavaScript dependency.
 if(options.file==='index.html'&&/<header\b[^>]*class=["'][^"']*\bmain-header\b/.test(html))return html.replace(/(<header\b[^>]*class=["'][^"']*\bmain-header\b[^>]*>)/i,'$1'+nav);
 if(/<main\b[^>]*class=["'][^"']*\blegal-page-main\b/.test(html))return html.replace(/(<main\b[^>]*class=["'][^"']*\blegal-page-main\b[^>]*>)/i,'$1'+nav);
 const content=/(<div\b[^>]*class=["'](?:[^"']*\s)?container(?:\s[^"']*)?["'][^>]*>)/i;
 if(content.test(html))return html.replace(content,'$1'+nav);
 return html.replace(/<body([^>]*)>/i,'<body$1>'+nav);
}
function languageNavigationRuntime(){
 const config=window.__SITE_LANGUAGE_NAV__;if(!config)return;
 const update=()=>{for(const link of document.querySelectorAll('[data-language-target]'))link.href=switchLanguageUrl(location.href,link.dataset.languageTarget,config);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update);else update();
 window.addEventListener('pageshow',update);
}
function runtimeSource(){return "'use strict';\n"+switchLanguageUrl.toString()+'\n('+languageNavigationRuntime.toString()+')();\n';}
module.exports={switchLanguageUrl,buildTargetAliases,stripLanguageUi,decorateHtml,runtimeSource};
