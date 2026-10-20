'use strict';
function switchLanguageUrl(current,target,options={}){
 if(!['ja','en'].includes(target))throw Error('Invalid target language');
 const url=new URL(current),base=String(options.basePath||'').replace(/\/$/,'');
 let logical=url.pathname;if(base&&logical.startsWith(base+'/'))logical=logical.slice(base.length);
 logical=logical.replace(/^\/(?:ja|en)(?=\/|$)/,'')||'/';
 url.pathname=base+(options.local?'/'+target:target==='en'?'/en':'')+(logical.startsWith('/')?logical:'/'+logical);
 url.search='';url.hash='';
 return url.href;
}
(function languageNavigationRuntime(){
 const config=window.__SITE_LANGUAGE_NAV__;if(!config)return;
 const update=()=>{for(const link of document.querySelectorAll('[data-language-target]'))link.href=switchLanguageUrl(location.href,link.dataset.languageTarget,config);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update);else update();
 window.addEventListener('pageshow',update);
})();
