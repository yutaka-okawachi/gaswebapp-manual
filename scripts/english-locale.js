'use strict';
const JAPANESE=/[\u3040-\u30ff\u3400-\u9fff]/;
const phrases={
 'ドイツ語の音楽用語集':'German Music Terms Dictionary','ドイツ語の音楽用語':'German Music Terms',
 '作品・楽器等から検索':'Search by work and instrument','作品・場面等から検索':'Search by work and scene','作品から検索':'Search by work','用語から検索':'Search by term','あらすじ集':'Synopses','使用楽譜など':'Scores and sources','使用楽譜':'Scores used','音楽之友社':'ONGAKU NO TOMO SHA CORP.','全音楽譜出版社':'Zen-On Music Co., Ltd.',
 '指示対象（登場人物）':'Target (character)','検索方法を選択':'Select a search mode','作品を選択':'Select a work','楽器を選択':'Select instruments','場面から検索':'Search by scene','ページから検索':'Search by page','指示対象から検索':'Search by target','検索方法':'Search mode','指示対象':'Target','ページ番号を半角で入力':'Enter page numbers','ページ番号':'Page number',
 'すべての作品を選択':'Select all works','作品をクリア':'Clear works','すべての楽器を選択':'Select all instruments','楽器をクリア':'Clear instruments','すべての場面を選択':'Select all scenes','すべて選択':'Select all','すべて':'All','全て':'All','なし':'None',
 '検索中・・・':'Searching…','検索中...':'Searching…','検索中…':'Searching…','検索が中止されました。':'Search cancelled.','該当するデータが見つかりませんでした。':'No matching entries found.','該当する用語は見つかりませんでした。':'No matching terms found.','データが読み込まれていません。':'Data has not loaded.','検索':'Search','中止':'Cancel','クリア':'Clear','メニュー':'Menu','パンくずリスト':'Breadcrumb','その他':'Further information',
 '用語集':'Dictionary','作品':'Work','場面':'Scene','方法':'Mode','楽器':'Instrument','オペラ':'Opera','オーケストラ':'Orchestra','前奏曲':'Prelude','序奏':'Introduction','プロローグ':'Prologue','間奏曲':'Interlude','終幕':'Finale','全曲':'Complete work','楽譜情報':'Score information','の該当項目も参照可能．':' for related definitions and examples.',
 'IMSLP作品ページ':'IMSLP work page','参照譜':'Reference score','参考文献':'References','出版者':'Publisher','出版社':'Publisher','略語':'Abbreviation','略記一覧':'Abbreviations','略記':'Abbreviations','日本語訳':'English translation','日本語':'English','一般的な意味':'General meanings','音楽用語としての訳例':'Musical translation examples','実例を見る':'View examples','実例':'Examples','意味':'Meaning','用例':'Examples','コメント':'Notes','全体':'All',
 '第1部':'Part 1','第2部':'Part 2','第3部':'Part 3','弦楽器群':'Strings','木管楽器群':'Woodwinds','金管楽器群':'Brass','打楽器群など':'Percussion and others','声楽・合唱':'Voices and chorus','ヴァイオリン':'Violin','ヴィオラ':'Viola','チェロ':'Cello','コントラバス':'Double bass','フルート':'Flute','ピッコロ':'Piccolo','オーボエ':'Oboe','イングリッシュホルン':'English horn','クラリネット':'Clarinet','ファゴット':'Bassoon','コントラファゴット':'Contrabassoon','ホルン':'Horn','トランペット':'Trumpet','トロンボーン':'Trombone','チューバ':'Tuba','ティンパニ':'Timpani','シンバル':'Cymbals','大太鼓':'Bass drum','小太鼓':'Snare drum','トライアングル':'Triangle','ハープ':'Harp','オルガン':'Organ','合唱':'Chorus','独唱':'Solo voice','指揮者':'Conductor',
 '交響曲イ短調『大地の歌』（1908）':'Das Lied von der Erde (1908)','交響曲第10番（クック版）':'Symphony No. 10 (Cooke version)','嘆きの歌（1880）':'Das klagende Lied (1880)','嘆きの歌（1899）':'Das klagende Lied (1899)','さすらう若人の歌':'Lieder eines fahrenden Gesellen','子供の魔法の角笛':'Des Knaben Wunderhorn','子供の死の歌':'Kindertotenlieder','リュッケルトの詩による5つの歌':'Rückert-Lieder','花の章':'Blumine','葬礼':'Totenfeier',
 'グスタフ・マーラー':'Gustav Mahler','リヒャルト・ワーグナー':'Richard Wagner','リヒャルト・シュトラウス':'Richard Strauss','トレモロ音符':'[tremolo notes]','の譜例':' [musical example]',
 '完全一致':'Whole-word match','部分一致':'Partial match','用語を入力':'Enter a term','入力して検索':'Enter a term and search','予測変換候補':'Suggestions','ページのトップへ戻る':'Back to top','HOMEへ戻る':'Back to home','閉じる':'Close','表示':'Show','非表示':'Hide','参照':'See','プライバシーポリシー':'Privacy policy','利用規約':'Terms of use','ライセンス':'License','分詞':'Participle','活用形':'Inflected form','格変化形':'Case form','別綴り':'Alternative spelling','語形変化':'Inflection'
};
Object.assign(phrases,require('./english-phrases.json'));
const keys=Object.keys(phrases).sort((a,b)=>b.length-a.length);
// Reviewed bilingual quotations in the approved Notes English text. New quotations
// require an exact registry entry; arbitrary Japanese prose is never inferred as English.
const approvedCitations=require('./english-approved-citations.json');
function isEnglishWithJapaneseCitations(value) {
 const text=String(value??'');let rest=text;
 for(const citation of approvedCitations)rest=rest.split(citation).join(' ');
 return rest!==text&&!JAPANESE.test(rest);
}

function localizeText(value,missing,allowCitations=false){
 const original=String(value??'');if(!JAPANESE.test(original))return original;let text=original;
 // This is navigation UI, not a Notes body. Preserve the source headword verbatim.
 const returnLabel=original.match(/^(\s*)「([^]+)」に戻る(\s*)$/);
 if(returnLabel)return returnLabel[1]+'Return to “'+returnLabel[2]+'”'+returnLabel[3];
 if(allowCitations&&isEnglishWithJapaneseCitations(original))return original;
 const flat=text.trim().replace(/\s+/g,' ');if(phrases[flat])return text.replace(text.trim(),phrases[flat]);
 text=text.replace(/交響曲第(\d+)番([^（]+)（([^）]+)）/g,(_,n,key,year)=>'Symphony No. '+n+' ('+year+')');
 text=text.replace(/第([0-9IVX]+)幕/g,'Act $1').replace(/第([0-9IVX]+)楽章/g,'Movement $1').replace(/第([0-9]+)小節/g,'bar $1').replace(/(\d+)件(?:見つかりました|ありました|あります)?[。．]?/g,(_,n)=>n+(Number(n)===1?' entry':' entries'));
 for(const key of keys)text=text.split(key).join(phrases[key]);
 if(JAPANESE.test(text)){if(missing)missing.add(flat);return 'English text is not yet available for this note.';}
 return text;
}
function localizeHtml(html,missing){
 html=html.replace(/<html\b([^>]*)>/i,(tag,attributes)=>/\blang=/.test(attributes)?tag:'<html lang="en"'+attributes+'>');
 return html.replace(/<!--[^]*?-->|<script\b[^]*?<\/script>|<style\b[^]*?<\/style>|<[^>]+>|[^<]+/gi,token=>{
  if(/^<!--|^<style/i.test(token))return token;
  if(/^<script/i.test(token)){
   if(!/application\/ld\+json/i.test(token))return token;
   return token.replace(/>([^]*)<\/script>/i,(_,body)=>{try{const data=JSON.parse(body);function walk(v,key){if(Array.isArray(v))return v.map(x=>walk(x,key));if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,walk(x,k)]));if(typeof v==='string'&&['name','description','headline','alternateName'].includes(key))return localizeText(v,missing,key==='description');if(key==='inLanguage')return v==='ja'?'en':v;return v;}return '>'+JSON.stringify(walk(data))+'</script>';}catch{return '>'+body+'</script>';}});
  }
  if(token.startsWith('<'))return token.replace(/\blang=(['"])ja\1/gi,'lang="en"').replace(/\b(title|alt|placeholder|aria-label|content)=(['"])([^]*?)\2/gi,(_,name,q,value)=>name+'='+q+localizeText(value,missing).replaceAll(q,q==='"'?'&quot;':'&#39;')+q);
  return localizeText(token,missing,true);
 });
}
function browserSource(){return "'use strict';\nconst JAPANESE="+JAPANESE.toString()+",phrases="+JSON.stringify(phrases)+",keys="+JSON.stringify(keys)+",approvedCitations="+JSON.stringify(approvedCitations)+";\n"+isEnglishWithJapaneseCitations.toString()+"\n"+localizeText.toString()+"\n"+`(()=>{const missing=new Set();window.__ENGLISH_PREVIEW_MISSING__=missing;const translate=(v,allowCitations=false)=>localizeText(v,missing,allowCitations);function scan(root){if(!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode()){const node=walker.currentNode;if(!['SCRIPT','STYLE','TEXTAREA'].includes(node.parentElement?.tagName)&&!node.parentElement?.closest('[data-language-switch]')&&JAPANESE.test(node.nodeValue))nodes.push(node);}for(const node of nodes){if(node.parentElement?.closest('#abbrReturnLabel')&&/^\s*Return to “[^]+”\s*$/.test(node.nodeValue))continue;const translated=translate(node.nodeValue,!!node.parentElement?.closest('.translation'));if(translated!==node.nodeValue)node.nodeValue=translated;}for(const element of root.querySelectorAll?.('[title],[alt],[placeholder],[aria-label]')||[])for(const attr of ['title','alt','placeholder','aria-label'])if(element.hasAttribute(attr)&&JAPANESE.test(element.getAttribute(attr)))element.setAttribute(attr,translate(element.getAttribute(attr)));}const alertOriginal=window.alert;window.alert=(message)=>alertOriginal.call(window,translate(message));let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;scan(document.documentElement);});}).observe(document.documentElement,{subtree:true,childList:true,characterData:true});document.addEventListener('DOMContentLoaded',()=>scan(document.documentElement));})();`;
}
module.exports={JAPANESE,phrases,localizeText,localizeHtml,browserSource};
