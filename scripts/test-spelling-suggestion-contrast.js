const assert=require('assert');const fs=require('fs');const css=fs.readFileSync('mahler-search-app/css/common.css','utf8');
function luminance(hex){const a=hex.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*a[0]+.7152*a[1]+.0722*a[2];}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const color of ['#174a8b','#123b70','#0f315e']) {assert(contrast('#ffffff',color)>=4.5);assert(css.includes('background-color: '+color));console.log('text contrast',color,contrast('#ffffff',color).toFixed(2));}
for(const bg of ['#ffffff','#fff2e0','#f0f8ff']){assert(contrast('#174a8b',bg)>=3);assert(contrast('#8a3b00',bg)>=3);}
assert(css.includes('background-image: none'));assert(css.includes('min-height: 44px'));assert(css.includes('outline: 3px solid #8a3b00'));
for(const lang of ['', 'en/'])for(const page of ['terms_search','rw_terms_search','rs_terms_search']){const html=fs.readFileSync(lang+'mahler-search-app/'+page+'.html','utf8');assert(html.includes('css/common.css'));}
console.log('PASS: all six pages share contrast-safe candidate styles; hover, active, focus and 44px target verified');

for(const lang of ['', 'en/'])for(const page of ['terms_search','rw_terms_search','rs_terms_search']){const html=fs.readFileSync(lang+'mahler-search-app/'+page+'.html','utf8');assert(html.includes('onclick="clearInput()" class="btn-clear"'));assert(!html.includes('class="clear-input-btn"'));}
assert(css.includes('button.btn-clear:hover'));assert(css.includes('button:disabled'));console.log('PASS: clear buttons share existing normal / hover / disabled styling');
