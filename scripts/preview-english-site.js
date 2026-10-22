'use strict';
const fs=require('fs'),path=require('path'),http=require('http');
const {root}=require('./sync/core'),{publicPath}=require('./preview-site'),{buildEnglishSite}=require('./english-site'),{buildJapanesePreview}=require('./japanese-preview'),locale=require('./english-locale'),languages=require('./site-languages');
function startEnglishPreview({source,port=4178,runtimeDirectory=null}={}){
 if(!Number.isSafeInteger(port)||port<1024||port>65535)throw Error('Invalid preview port');
 const synopsis=require('./synopsis-links'),baseMetadata=synopsis.readBaseMetadata(root),metadata={ja:synopsis.projectMetadata(baseMetadata,source.synopsis,'ja'),en:synopsis.projectMetadata(baseMetadata,source.synopsis,'en')};
 const site=buildEnglishSite(root,source),japanese=buildJapanesePreview(root,source,site),aliases=languages.buildTargetAliases(source),htmlCache=new Map(),origin='http://127.0.0.1:'+port;
 const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
 function transform(html,key,language){
  const cacheKey=language+':'+key;if(htmlCache.has(cacheKey))return htmlCache.get(cacheKey);
  let clean=html.replace(/<script\b[^>]*src=["'][^"']*(?:googletagmanager|google-analytics)[^"']*["'][^>]*>[^]*?<\/script>/gi,'');
  if(/(?:rw|rs)_synopsis\.html$/.test(key))clean=synopsis.rewriteList(clean,baseMetadata,metadata[language],language);
  if(language==='en')clean=site.localizeHtml(clean);
  const optout='<script>window.__LOCAL_PREVIEW__=true;window.__SITE_LANGUAGE__="'+language+'";try{localStorage.setItem("gmt_admin_device_optout","1")}catch(e){}</script>'+(language==='en'?'<script src="'+(key.includes('/')?'js/english-preview.js':'mahler-search-app/js/english-preview.js')+'"></script>':'')+'<meta name="robots" content="noindex,nofollow">';
  clean=clean.replace(/<head([^>]*)>/i,'<head$1>'+optout);
  const output=languages.decorateHtml(clean,{language,local:true,file:key,targetAliases:aliases});htmlCache.set(cacheKey,output);return output;
 }
 let servers=[];
 const handler=(req,res)=>{
  if(!['127.0.0.1:'+port,'localhost:'+port,'[::1]:'+port].includes(req.headers.host)){res.writeHead(403);return res.end('Local host only');}
  const url=new URL(req.url,origin),route=url.pathname;
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; form-action 'none'; object-src 'none'; frame-ancestors 'none'");
  if(route==='/health'&&req.method==='GET'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({app:'gaswebapp-english-sample-preview',edition:'shared-full-english',languages:['ja','en'],pid:process.pid,url:origin,readAt:site.readAt,stats:site.stats,publicRelease:false}));}
  if(route==='/__stop'&&req.method==='POST'&&req.headers.origin===origin){res.end('{"stopped":true}');return Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve)))).then(()=>process.exit(0));}
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end('Read-only preview');}
  if(route==='/ja'||route==='/en'){res.writeHead(302,{Location:route+'/'+url.search});return res.end();}
  const language=route.startsWith('/ja/')?'ja':'en',logical=route.replace(/^\/(?:ja|en)(?=\/|$)/,'')||'/';
  if(logical==='/mahler-search-app/js/site-language-switch.js'){res.setHeader('Content-Type','application/javascript; charset=utf-8');return res.end(languages.runtimeSource());}
  if(logical==='/mahler-search-app/js/english-preview.js'){res.setHeader('Content-Type','application/javascript; charset=utf-8');return res.end(locale.browserSource());}
  if(logical==='/mahler-search-app/js/score_metadata.js'){res.setHeader('Content-Type','application/javascript; charset=utf-8');return res.end(synopsis.metadataScript(metadata[language]));}
  if(logical==='/mahler-search-app/js/analytics.js'){res.setHeader('Content-Type','application/javascript');return res.end('/* Analytics disabled in local preview. */');}
  let file;try{file=publicPath(logical+url.search);}catch{}if(!file){res.writeHead(404);return res.end('Not found');}
  const relative=path.relative(root,file).replaceAll('\\','/'),localized=language==='ja'?japanese:site,overridden=Object.prototype.hasOwnProperty.call(localized.files,relative);
  if(!overridden&&(!fs.existsSync(file)||!fs.statSync(file).isFile()||!fs.realpathSync(file).startsWith(root+path.sep))){res.writeHead(404);return res.end('Not found');}
  const extension=path.extname(file);res.setHeader('Content-Type',(types[extension]||'application/octet-stream')+'; charset=utf-8');
  const value=overridden?localized.files[relative]:fs.readFileSync(file),body=typeof value==='object'&&!Buffer.isBuffer(value)?JSON.stringify(value):String(value);
  return res.end(req.method==='HEAD'?'':extension==='.html'?transform(body,relative,language):extension==='.json'?body:overridden?body:fs.readFileSync(file));
 };
 servers=[http.createServer(handler),http.createServer(handler)];
 const ready=Promise.all(servers.map((server,index)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen({port,host:index?'::1':'127.0.0.1',ipv6Only:true},resolve);}))).then(()=>{if(runtimeDirectory)fs.writeFileSync(path.join(runtimeDirectory,'runtime.json'),JSON.stringify({app:'gaswebapp-english-sample-preview',edition:'shared-full-english',languages:['ja','en'],pid:process.pid,url:origin,startedAt:new Date().toISOString()},null,2));console.log('Shared bilingual preview: '+origin);return {url:origin,site,japanese};});
 return {ready,site,japanese,close:()=>Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))))};
}
module.exports={startEnglishPreview};
if(require.main===module){const sourcePath=process.argv.find(arg=>arg.startsWith('--source='))?.slice(9);if(!sourcePath)throw Error('Private --source= file required');startEnglishPreview({source:JSON.parse(fs.readFileSync(sourcePath,'utf8')),port:Number(process.argv.find(arg=>arg.startsWith('--port='))?.slice(7)||4178)}).ready.catch(error=>{console.error(error.message);process.exitCode=1;});}
