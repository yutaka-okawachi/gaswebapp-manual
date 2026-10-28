// Portable validation: Apps Script does not provide the browser URL constructor.
function isSafeDictionaryReferenceUrl(value) {
  const url=String(value??'');
  if(url.length>8192 || /[\x00-\x20\x7f-\x9f\\<>"`\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/.test(url) || /%(?![0-9a-f]{2})|%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(url))return false;
  const parsed=/^https?:\/\/([^/?#]+)(?:[/?#][\s\S]*)?$/i.exec(url);
  if(!parsed || parsed[1].includes('@'))return false;
  const authority=/^(\[[0-9a-f:]+\]|[^:]+)(?::([0-9]+))?$/i.exec(parsed[1]);
  if(!authority || (authority[2]!==undefined && Number(authority[2])>65535))return false;
  const host=authority[1];
  if(host.startsWith('[')){
    const address=host.slice(1,-1),parts=address.split('::');
    if(parts.length>2 || address.includes(':::') || (address.startsWith(':')&&!address.startsWith('::')) || (address.endsWith(':')&&!address.endsWith('::')))return false;
    const groups=address.split(':').filter(Boolean);
    return groups.every(group=>/^[0-9a-f]{1,4}$/i.test(group)) && (parts.length===2?groups.length<8:groups.length===8);
  }
  if(/^[0-9.]+$/.test(host)){const parts=host.split('.');return parts.length===4 && parts.every(part=>/^\d{1,3}$/.test(part)&&Number(part)<=255);}
  return host.length<=253 && host.replace(/\.$/,'').split('.').every(part=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(part));
}

// Only [plain label](http(s) URL) and plain web URLs are interpreted. Protected
// spans never reach the internal-term linker; all source HTML stays literal.
function renderDictionaryReferenceText(value,renderPlain) {
  const text=String(value??''),escape=part=>String(part).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const literal=part=>escape(part).replace(/\r?\n/g,'<br>');
  const plain=typeof renderPlain==='function'?renderPlain:literal;
  const starts=/<a\b[^>]*>[\s\S]*?<\/a\s*>|<[^>]*>|\[[^\]\r\n]*\]\(|https?:\/\//gi;
  let html='',last=0,match;
  while((match=starts.exec(text))){
    html+=plain(text.slice(last,match.index));
    const start=match.index;
    let end=starts.lastIndex,url='',label='',valid=false;
    if(match[0][0]==='['){
      label=match[0].slice(1,-2);
      let depth=1,index=end;
      for(;index<text.length&&!/[\r\n]/.test(text[index]);index++){
        if(text[index]==='(')depth++;
        else if(text[index]===')'&&--depth===0)break;
      }
      if(depth===0){url=text.slice(end,index);end=index+1;valid=!!label.trim()&&!/[\x00-\x1f\x7f]/.test(label)&&text[start-1]!=='!';}
      else end=index;
    }else if(/^https?:/i.test(match[0])){
      end=start+(text.slice(start).match(/^[^\s<>"`「」『』【】（）]+/)||[''])[0].length;
      url=text.slice(start,end);
      while(url){
        if(/[.,;:!?。、，．！？]$/.test(url)){url=url.slice(0,-1);continue;}
        const close=url.slice(-1),open={')':'(',']':'[','}':'{'}[close];
        if(open&&url.split(close).length>url.split(open).length){url=url.slice(0,-1);continue;}
        break;
      }
      label=url;end=start+url.length;
      valid=!/[\w/:]/.test(text[start-1]||' ');
    }
    valid=valid&&isSafeDictionaryReferenceUrl(url);
    html+=valid?'<a class="dictionary-reference-link" style="overflow-wrap:anywhere" href="'+escape(url)+'" target="_blank" rel="noopener noreferrer">'+escape(label)+'</a>':literal(text.slice(start,end));
    last=end;starts.lastIndex=end;
  }
  return html+plain(text.slice(last));
}

// Add new approved artwork here, with semantic IDs and stable source context.
const SCORE_EXAMPLE_REGISTRY = Object.freeze({
  'mahler-trill-chain': {renderer:'direction',kind:'gm325-example',data:'M-2-5-55-dir&'},
  'mahler-editorial-g2': {renderer:'direction',kind:'gm1550-example',data:'M-b1-t1-380-chor&'},
  'feuersnot-desk-division': {renderer:'direction',kind:'rs651-example',searchText:'～ etc.',Oper:'feuersnot',Aufzug:'',Szene:'',page:320},
  'salome-timpani-layout': {renderer:'direction',kind:'rs782-example',Oper:'salome',Aufzug:'',Szene:4,page:287},
  'hindemith-glockenspiel-fsharp5': {renderer:'dictionary',kind:'glockenspiel-fsharp5',sourceTab:'Notes',source:'[H: KM1-1]',headingPrefix:'Ein Stab aus einem Glockenspiel'}
});
function scoreExampleRegistryEntry(row,id) {
  if(!Object.prototype.hasOwnProperty.call(SCORE_EXAMPLE_REGISTRY,id))return null;
  const entry=SCORE_EXAMPLE_REGISTRY[id];
  if(entry.renderer==='dictionary')return String(row?.source??row?.[2]??'').trim()===entry.source && stripScoreExampleTokens(row?.de??row?.[0]??'').normalize('NFC').trim().startsWith(entry.headingPrefix) ? entry : null;
  if(entry.data)return String(row?.data??row?.[3]??'')===entry.data ? entry : null;
  return ['Oper','Aufzug','Szene','page'].every(key=>String(row?.[key]??'')===String(entry[key]??'')) ? entry : null;
}
// Plain-text score tokens are data, never HTML. IDs describe artwork, not Sheet rows.
function stripScoreExampleTokens(value) {
  return String(value ?? '').replace(/\[\[score:[a-z][a-z0-9-]{0,95}\]\]/gi, '');
}
function scoreExampleSearchText(value) {
  const text=String(value??'');
  if(!/\[\[score:[a-z][a-z0-9-]{0,95}\]\]/i.test(text))return text;
  return text.replace(/\[\[score:([a-z][a-z0-9-]{0,95})\]\]/gi,(_,id)=>Object.prototype.hasOwnProperty.call(SCORE_EXAMPLE_REGISTRY,id.toLowerCase()) ? SCORE_EXAMPLE_REGISTRY[id.toLowerCase()].searchText||'' : '').trim();
}
function renderScoreExampleTokens(value, resolve, renderText, language='ja') {
  const text=String(value ?? ''),regex=/\[\[score:([a-z][a-z0-9-]{0,95})\]\]/gi,seen=new Set();
  let last=0,html='',found=false,match;
  while((match=regex.exec(text))){
    found=true;html+=renderText(text.slice(last,match.index));
    const id=match[1].toLowerCase(),image=resolve(id);
    html+=image ? (seen.has(id)?'':image) : '<span class="score-example-unavailable" role="note">'+renderText((language==='en'?'[Score example unavailable: ':'[譜例を表示できません: ')+id+']')+'</span>';
    if(image)seen.add(id);last=match.index+match[0].length;
  }
  return {found,html:found ? html+renderText(text.slice(last)) : ''};
}
function notesGlockenspielImage(language) {
    const escape=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    const english = language === 'en';
    const label = english ? 'Glockenspiel example: treble clef, F-sharp5 quarter note on the top staff line, downward stem, and end barline' : 'グロッケンシュピールの譜例：ト音記号、最上線のF♯5四分音符、下向き符幹、末線';
    let body='<metadata>'+escape(NOTES_GLOCKENSPIEL_ASSET.license)+'</metadata><g fill="black" stroke="black">';
    for (const y of [38,44,50,56,62]) body+='<path d="M8 '+y+' H97" fill="none" stroke-width=".7"/>';
    body+='<path data-clef="treble" d="'+NOTES_GLOCKENSPIEL_ASSET.gClef+'" transform="translate(12 56) scale(.024 -.024)" stroke="none"/>';
    body+='<path data-accidental="sharp" d="'+NOTES_GLOCKENSPIEL_ASSET.sharp+'" transform="translate(40 38) scale(.024 -.024)" stroke="none"/>';
    body+='<ellipse data-pitch="F-sharp5" data-duration="quarter" cx="55" cy="38" rx="4.6" ry="3.1" transform="rotate(-20 55 38)" stroke="none"/>';
    body+='<path data-stem="down" d="M51 38 V63" fill="none" stroke-width="1.25"/><path data-barline="end" d="M97 38 V62" fill="none" stroke-width="1"/></g>';
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="105" height="96" viewBox="0 0 105 96">'+body+'</svg>';
    return '<img class="gm-music-notation dictionary-music-notation dictionary-glockenspiel-example" data-notation="glockenspiel-fsharp5" src="data:image/svg+xml,'+encodeURIComponent(svg)+'" width="105" height="96" alt="'+escape(label)+'" aria-label="'+escape(label)+'" title="'+escape(label)+'">';
}
// Notes235 (formerly 236): approved Hindemith Glockenspiel score, display only.
// Stable identity is the complete Notes heading + [H: KM1-1], never a GM key or row number.
const NOTES_GLOCKENSPIEL_ASSET = {"gClef": "M376 415C374 427 376 428 382 434C398 449 419 470 438 491C522 583 572 702 572 815C572 902 548 988 507 1048C492 1070 466 1098 455 1098C441 1098 410 1072 390 1050C316 968 292 843 292 739C292 681 299 616 306 575C308 563 309 561 297 551C233 498 164 437 112 373C43 287 0 194 0 87C0 -87 119 -252 364 -252C387 -252 413 -250 433 -246C444 -244 446 -243 448 -255C460 -322 475 -409 475 -456C475 -604 375 -622 316 -622C262 -622 236 -606 236 -593C236 -586 245 -583 268 -576C299 -567 335 -540 335 -482C335 -427 300 -380 239 -380C172 -380 132 -433 132 -495C132 -560 171 -658 322 -658C389 -658 519 -628 519 -458C519 -401 501 -306 490 -244C488 -232 489 -233 503 -227C604 -187 671 -102 671 11C671 139 577 252 430 252C404 252 404 252 401 270ZM470 943C503 943 530 916 530 861C530 792 497 728 419 650C403 634 379 611 356 591C349 585 345 586 343 599C339 625 337 659 337 691C337 847 409 943 470 943ZM361 262C364 243 364 244 346 238C258 208 201 129 201 44C201 -46 248 -110 316 -133C324 -136 336 -139 343 -139C351 -139 355 -134 355 -128C355 -121 347 -118 340 -115C298 -97 268 -54 268 -8C268 49 307 92 368 109C384 113 386 112 388 101L438 -197C440 -208 439 -208 424 -211C408 -214 388 -216 368 -216C193 -216 80 -119 80 20C80 79 90 158 173 252C233 319 279 356 326 394C336 402 338 401 340 390ZM430 103C428 115 429 118 441 117C522 110 589 42 589 -46C589 -109 551 -160 495 -188C483 -194 481 -194 479 -182Z", "sharp": "M237 118C244 121 249 129 249 135V206C249 211 246 214 242 214C240 214 239 214 237 213C237 213 217 205 212 204C205 204 198 209 198 217V339C198 345 192 350 184 350C174 350 168 345 168 339V209C167 199 164 186 155 180C143 173 109 159 92 155C83 155 80 167 80 175V295C80 301 73 306 66 306C56 306 50 301 50 295V160C50 146 44 136 38 133C32 130 12 122 12 122C5 120 0 112 0 106V35C0 29 3 26 8 26C9 26 11 27 12 27C12 27 27 33 34 37C35 37 36 38 37 38C44 38 50 28 50 20V-79C50 -90 45 -99 39 -102C33 -104 12 -113 12 -113C5 -115 0 -123 0 -129V-200C0 -206 3 -209 8 -209C9 -209 11 -208 12 -208C12 -208 26 -202 35 -199C36 -198 37 -198 38 -198C45 -198 50 -209 50 -214V-337C50 -343 56 -348 63 -348C73 -348 80 -343 80 -337V-198C80 -185 85 -178 90 -176L151 -151C152 -151 154 -150 155 -150C163 -150 168 -162 168 -168V-293C168 -299 174 -304 181 -304C192 -304 198 -299 198 -293V-151C198 -143 202 -131 209 -128C216 -125 237 -117 237 -117C244 -114 249 -106 249 -100V-29C249 -24 246 -21 242 -21C240 -21 239 -21 237 -22L211 -32C205 -32 198 -26 198 -14V79C198 86 203 105 211 108ZM168 -45C162 -65 115 -85 92 -85C86 -85 81 -83 80 -80C78 -76 77 -54 77 -30C77 1 78 36 80 44C82 61 128 82 153 82C160 82 166 80 168 76C170 71 172 46 172 19C172 -8 170 -36 168 -45Z", "license": "Copyright © 2026, Steinberg Media Technologies GmbH (http://www.steinberg.net/),\nwith Reserved Font Name \"Bravura\".\n\nThis Font Software is licensed under the SIL Open Font License, Version 1.1.\nThis license is copied below, and is also available with a FAQ at:\nhttp://scripts.sil.org/OFL\n\n-----------------------------------------------------------\nSIL OPEN FONT LICENSE Version 1.1 - 26 February 2007\n-----------------------------------------------------------\n\nPREAMBLE\nThe goals of the Open Font License (OFL) are to stimulate worldwide\ndevelopment of collaborative font projects, to support the font creation\nefforts of academic and linguistic communities, and to provide a free and\nopen framework in which fonts may be shared and improved in partnership\nwith others.\n\nThe OFL allows the licensed fonts to be used, studied, modified and\nredistributed freely as long as they are not sold by themselves. The\nfonts, including any derivative works, can be bundled, embedded,\nredistributed and/or sold with any software provided that any reserved\nnames are not used by derivative works. The fonts and derivatives,\nhowever, cannot be released under any other type of license. The\nrequirement for fonts to remain under this license does not apply\nto any document created using the fonts or their derivatives.\n\nDEFINITIONS\n\"Font Software\" refers to the set of files released by the Copyright\nHolder(s) under this license and clearly marked as such. This may\ninclude source files, build scripts and documentation.\n\n\"Reserved Font Name\" refers to any names specified as such after the\ncopyright statement(s).\n\n\"Original Version\" refers to the collection of Font Software components as\ndistributed by the Copyright Holder(s).\n\n\"Modified Version\" refers to any derivative made by adding to, deleting,\nor substituting -- in part or in whole -- any of the components of the\nOriginal Version, by changing formats or by porting the Font Software to a\nnew environment.\n\n\"Author\" refers to any designer, engineer, programmer, technical\nwriter or other person who contributed to the Font Software.\n\nPERMISSION AND CONDITIONS\nPermission is hereby granted, free of charge, to any person obtaining\na copy of the Font Software, to use, study, copy, merge, embed, modify,\nredistribute, and sell modified and unmodified copies of the Font\nSoftware, subject to the following conditions:\n\n1) Neither the Font Software nor any of its individual components,\nin Original or Modified Versions, may be sold by itself.\n\n2) Original or Modified Versions of the Font Software may be bundled,\nredistributed and/or sold with any software, provided that each copy\ncontains the above copyright notice and this license. These can be\nincluded either as stand-alone text files, human-readable headers or\nin the appropriate machine-readable metadata fields within text or\nbinary files as long as those fields can be easily viewed by the user.\n\n3) No Modified Version of the Font Software may use the Reserved Font\nName(s) unless explicit written permission is granted by the corresponding\nCopyright Holder. This restriction only applies to the primary font name as\npresented to the users.\n\n4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font\nSoftware shall not be used to promote, endorse or advertise any\nModified Version, except to acknowledge the contribution(s) of the\nCopyright Holder(s) and the Author(s) or with their explicit written\npermission.\n\n5) The Font Software, modified or unmodified, in part or in whole,\nmust be distributed entirely under this license, and must not be\ndistributed under any other license. The requirement for fonts to\nremain under this license does not apply to any document created\nusing the Font Software.\n\nTERMINATION\nThis license becomes null and void if any of the above conditions are\nnot met.\n\nDISCLAIMER\nTHE FONT SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\nEXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF\nMERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT\nOF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE\nCOPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,\nINCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL\nDAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\nFROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM\nOTHER DEALINGS IN THE FONT SOFTWARE.\n"};
// Display-only transcription of Don Quixote, IMSLP18787, PDF32/printed p.224.
// One black quarter note, downward stem, three tremolo strokes; no pitch implied.
function renderDictionaryNotationText(text, german, source, language, renderText) {
  const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const heading = 'alle in den Bläsern als トレモロ音符 notirten Stellen sind mit Zungenschlag auszuführen.';
  const value = String(text ?? '');
  const render = typeof renderText === 'function' ? renderText : escape;
  const glockenspielHeading = 'Ein Stab aus einem Glockenspiel (Klang Fis(の譜例) , ebenso notiert)';
  const hasGlockenspielToken=!!scoreExampleRegistryEntry({de:german,source},'hindemith-glockenspiel-fsharp5') && /\[\[score:hindemith-glockenspiel-fsharp5\]\]/i.test(String(german??''));
  const notesContext=String(source??'').trim()==='[H: KM1-1]' && (String(german??'').normalize('NFC').trim()===glockenspielHeading || (hasGlockenspielToken && stripScoreExampleTokens(german).normalize('NFC').trim().startsWith('Ein Stab aus einem Glockenspiel')));
  const tokenized=renderScoreExampleTokens(value,id=>notesContext && id==='hindemith-glockenspiel-fsharp5' ? notesGlockenspielImage(language) : '',render,language);
  if(tokenized.found)return tokenized.html;
  if (notesContext && value) {
    const image=notesGlockenspielImage(language);
    if (value.normalize('NFC').trim() === glockenspielHeading) {
      const token='(の譜例)',position=value.indexOf(token);
      return render(value.slice(0,position))+image+render(value.slice(position+token.length));
    }
    // Translation remains verbatim; one complete approved example follows it.
    return render(value)+' '+image;
  }
  // Preserve the quotation and its explicit short-pause meaning; only draw its sign.
  const quote = '𝄐 bedeutet hier nur ein kurzes Anhalten auf dem Taktstrich und nicht etwa eine Fermate.';
  if (String(german ?? '').normalize('NFC').trim() === 'anhalten' && String(source ?? '').includes('[GM]') && value.includes(quote)) {
    const position = value.indexOf(quote), token = '𝄐';
    const label = language === 'en' ? 'Sign for a brief pause at the barline, without a sustained hold' : '小節線上の短い休止を示す記号（長く保持しない）';
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 39 48" width="39" height="48"><path d="M5 28 C8 7 31 7 34 28" fill="none" stroke="black" stroke-width="2.3"/><circle cx="19.5" cy="27" r="2.5"/></svg>';
    const image = '<img class="gm-music-notation dictionary-music-notation" data-notation="short-pause" src="data:image/svg+xml,' + encodeURIComponent(svg) + '" width="39" height="48" alt="' + escape(label) + '" aria-label="' + escape(label) + '" title="' + token + '">';
    return render(value.slice(0, position)) + image + render(value.slice(position + token.length));
  }
  if (String(german ?? '').normalize('NFC').trim() !== heading || String(source ?? '').trim() !== '[RS: Qui]' || value !== String(german ?? '')) return render(value);
  const token = 'トレモロ音符', position = value.indexOf(token), english = language === 'en';
  const label = english ? 'Single quarter note with a downward stem and three tremolo strokes' : '下向き符幹の四分音符1個に斜線3本のトレモロ表記';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="38" height="50" viewBox="0 0 38 50">' +
    '<ellipse data-note="quarter" cx="25" cy="10" rx="6" ry="4" transform="rotate(-20 25 10)" fill="black"/>' +
    '<path data-stem="single" data-stem-direction="down" d="M20 11 V44" stroke="black" stroke-width="1.7"/>' +
    [0, 6, 12].map(y => '<path data-tremolo-stroke="true" d="M8 ' + (25 + y) + ' L29 ' + (17 + y) + ' V' + (21 + y) + ' L8 ' + (29 + y) + ' Z" fill="black"/>').join('') + '</svg>';
  const image = '<img class="gm-music-notation dictionary-music-notation" data-notation="quarter-tremolo-three" src="data:image/svg+xml,' + encodeURIComponent(svg) + '" width="38" height="50" alt="' + escape(label) + '" aria-label="' + escape(label) + '" title="' + (english ? '[tremolo notes]' : token) + '">';
  return render(value.slice(0, position)) + image + render(value.slice(position + token.length));
}

if(typeof module!=='undefined' && module.exports)module.exports={stripScoreExampleTokens,scoreExampleSearchText,SCORE_EXAMPLE_REGISTRY};
