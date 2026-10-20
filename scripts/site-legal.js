'use strict';
// Rendering legal navigation is independent of analytics, notifications and network calls.
const officialEnglishLinks=Object.freeze({
 'https://creativecommons.org/licenses/by-nc/4.0/deed.ja':'https://creativecommons.org/licenses/by-nc/4.0/deed.en',
 'https://creativecommons.org/licenses/by-nc/4.0/legalcode.ja':'https://creativecommons.org/licenses/by-nc/4.0/legalcode.en',
 'https://policies.google.com/technologies/partner-sites?hl=ja':'https://policies.google.com/technologies/partner-sites?hl=en',
 'https://tools.google.com/dlpage/gaoptout?hl=ja':'https://tools.google.com/dlpage/gaoptout?hl=en'
});
function decorateHtml(html,options={}){
 const english=options.language==='en';
 if(english)html=html.replace(/(\bhref\s*=\s*["'])([^"']+)(["'])/gi,(all,before,url,quote)=>before+(officialEnglishLinks[url]||url)+quote);
 html=html.replace(/<!-- site-legal:start -->[^]*?<!-- site-legal:end -->/g,'');
 if(/<footer\b[^>]*class=["'][^"']*\bsite-legal-footer\b/.test(html))return html;
 const prefix=String(options.file||'').includes('/')?'../':'';
 const footer='<!-- site-legal:start --><footer class="site-legal-footer" aria-label="'+(english?'Site information':'サイト情報')+'"><a href="'+prefix+'privacy.html">'+(english?'Privacy policy':'プライバシーポリシー')+'</a><span class="site-legal-footer__separator" aria-hidden="true"> '+(english?'|':'｜')+' </span><a href="'+prefix+'license.html">'+(english?'License and terms of use':'ライセンス・利用条件')+'</a><span class="site-legal-footer__copyright">© 2014–2026 Yutaka Okawachi</span></footer><!-- site-legal:end -->';
 return html.replace(/<\/body>/i,footer+'</body>');
}
module.exports={decorateHtml,officialEnglishLinks};
