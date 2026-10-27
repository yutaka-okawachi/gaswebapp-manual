// Display only: preserve the Sheet's Unicode/German source and search keys.
(function () {
    'use strict';
    const variants = (text, kind) => [...new Set([text, text.normalize('NFC'), text.normalize('NFD')])].map(value => [value, kind]);
    function notationContextKey(row) {
        if (!row || typeof row !== 'object') return '';
        const de = String(row.de ?? row[0] ?? '').normalize('NFC');
        const data = row.data ?? row[3];
        return data ? JSON.stringify(['GM',String(data),de]) :
            row.Oper !== undefined ? JSON.stringify(['opera',String(row.Oper),String(row.Aufzug ?? ''),String(row.Szene ?? ''),String(row.page ?? ''),de]) : '';
    }
    const contexts = new Map((window.MUSIC_NOTATION_CONTEXTS || []).map(context => {
        const tokens = context.tokens.flatMap(([token,kind,boundary]) => variants(token,kind).map(([value]) => [value,kind,boundary]));
        tokens.sort((a,b) => b[0].length-a[0].length);
        return [notationContextKey(context),tokens];
    }));
    // GM1550: user-approved G2 correction (2026-10-27), not F2.
    function isGm1550(row) {
        return String(row?.data ?? row?.[3] ?? '') === 'M-b1-t1-380-chor&' &&
            String(row?.de ?? row?.[0] ?? '').normalize('NFC') === 'Müßte so sein (Herausgebervorschlag)';
    }
    // Approved score diagrams: match complete opera context, never physical row or translated whom.
    const rsExampleKinds = new Map([
        [notationContextKey({Oper:'feuersnot',Aufzug:'',Szene:'',page:320,de:'vielleicht pultweise derart zu teilen ～ etc.'}), 'rs651-example'],
        [notationContextKey({Oper:'salome',Aufzug:'',Szene:4,page:287,de:'Aufstellung der 4 Pauken: linke H. rechte Hand'}), 'rs782-example']
    ]);
    const gm325Key = notationContextKey({data:'M-2-5-55-dir&',de:"Anmerk. f. d. Dirigenten : hier, wie bei der folgende gleichartigen Stelle ist darauf zu achten, dass sich die Triller der 1. u. 2. Geigen dicht an einander schliessen, und keine Pause dazwischen entsteht (eine 'Trillerkette') also so:"});
    function tokenKindForRow(row,id) {
        const entry=typeof scoreExampleRegistryEntry==='function' ? scoreExampleRegistryEntry(row,id) : null;
        return entry?.renderer==='direction' ? entry.kind : '';
    }
    const scoreExampleKind = row => {
        const source=String(row?.de??row?.[0]??''),tokens=[...source.matchAll(/\[\[score:([a-z][a-z0-9-]{0,95})\]\]/gi)];
        if(tokens.length)return tokens.map(token=>tokenKindForRow(row,token[1].toLowerCase())).find(Boolean);
        return isGm1550(row) ? 'gm1550-example' : notationContextKey(row) === gm325Key ? 'gm325-example' : rsExampleKinds.get(notationContextKey(row));
    };
    function rulesFor(row) {
        if (scoreExampleKind(row)) return [];
        return contexts.get(notationContextKey(row));
    }
    const labels = {
        'gm325-example': ['トリルの連鎖：主四分音符C6・A5・F5・D5、各トリル後に小32分音符2個を三重連桁で示す4組、ナチュラル2個。音部記号なし。', 'Chain of trills: main quarter notes C6, A5, F5, D5; four pairs of small thirty-second after-notes with triple beams; two naturals; no clef.'],
        'rs651-example': ['プルト単位の分割譜例：ヘ音記号、上下声部それぞれ4組の二重連桁音符、変化記号、休符、スラー、etc.。', 'Division by desk: bass clef, four pairs of double-beamed notes in each voice, accidentals, rests, slurs, and etc.'],
        'rs782-example': ['4台のティンパニの配置譜例：ヘ音記号、4個の四分音符、フラット2個、原譜ラベルlinke H. / l. H. / rechte H. / rechte Hand。', 'Arrangement of four timpani: bass clef, four quarter notes, two flats, and the original labels linke H. / l. H. / rechte H. / rechte Hand.'],
        'gm1550-example': ['編集者提案の譜例：ヘ音記号、フラット3個、G2二分音符、Und、二分休符、複縦線、縦線なしのC。', 'Editorial example: bass clef, three flats, G2 half note, Und, half rest, double barline, and common-time C without a vertical stroke.'],
        half: ['二分音符', 'Half note'],
        whole: ['全音符', 'Whole note'],
        eighth: ['八分音符', 'Eighth note'],
        'dotted-quarter': ['付点四分音符', 'Dotted quarter note'],
        fermata: ['フェルマータ記号', 'Fermata sign'],
        'short-pause': ['小節線上の短い休止を示す記号（長く保持しない）', 'Sign for a brief pause at the barline, without a sustained hold'],
        'stopped-plus': ['ゲシュトップを示すプラス記号', 'Plus sign for a stopped note'],
        'rhythmic-alignment': ['リズム一致位置を示す縦線', 'Rhythmic alignment line'],
        'caret-accent': ['山形アクセント記号', 'Caret-shaped accent'],
        'accent-right': ['アクセント記号', 'Accent sign'],
        'glissando-up': ['グリッサンドを示す斜線', 'Diagonal glissando line'],
        'portamento-up': ['ポルタメントを示す右上がりの斜線', 'Rising portamento line'],
        'portamento-down': ['ポルタメントを示す右下がりの斜線', 'Falling portamento line'],
        'down-arrow': ['打点の位置を示す下向き矢印', 'Downward beat-cue arrow'],
        'tempo-star': ['テンポ変化の参照位置を示す星形記号', 'Star-shaped tempo reference marker'],
        'tempo-theta': ['テンポ変化の参照位置を示す横線入り丸形記号', 'Circle with horizontal bar, a tempo reference marker'],
        'circle-cross-marker': ['接続・カット位置を示す円十字形記号', 'Circle-and-cross connection or cut marker'],
        'time-signature-c': ['拍子記号C', 'Time signature C'],
        roof: ['山形アクセントとその下の横線', 'Roof-shaped accent with a horizontal line underneath'],
        'fermata-v': ['フェルマータとV記号の並置', 'Fermata followed by a V-shaped sign'],
        quarter: ['四分音符', 'Quarter note'],
        'dotted-half': ['付点二分音符', 'Dotted half note'],
        quarters: ['通常の四分音符3個', 'Three ordinary quarter notes'],
        'quarter-triplet': ['四分音符3個の三連符1組', 'One triplet group of three quarter notes'],
        eighths: ['一本の連桁で結んだ通常の八分音符3個', 'Three ordinary eighth notes with one beam'],
        'eighth-triplet': ['一本の連桁で結んだ八分音符3個の三連符1組', 'One triplet group of three eighth notes with one beam'],
        'eighth-triplet-below': ['下側の3を付した八分音符三連符1組', 'One beamed eighth-note triplet with the numeral 3 below'],
        'motif-two': ['ト音記号付き2小節。第1小節はG4四分音符、付点八分休符、D4十六分音符、F4八分音符、八分休符。第2小節はG4四分音符、付点八分休符、C4十六分音符、F4四分音符と右へ続くタイ。各小節の最初にテヌート、十六分音符と第1小節の八分音符にスタッカート。', 'Two bars with treble clef. First bar: G4 quarter, dotted eighth rest, D4 sixteenth, F4 eighth, eighth rest. Second bar: G4 quarter, dotted eighth rest, C4 sixteenth, F4 quarter tied onward to the right. The first note in each bar has tenuto; the sixteenths and the first-bar eighth have staccato.'],
        'motif-one': ['音部記号と奏法記号なしの1小節。四分音符、付点八分休符、十六分音符、八分音符、八分休符。音高F4-D4-F4。', 'One bar without clef or articulation marks: quarter note, dotted eighth rest, sixteenth note, eighth note, eighth rest. Pitches F4-D4-F4.']
    };
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    // gClef outline from Bravura 1.482 (Steinberg), OFL-1.1.
    // Pinned source and reproduction details: manuals/BILINGUAL_SYNC.md; manuals/licenses/Bravura-OFL.md.
    const gm358ClefPath = "M19.024 46.04C18.976 45.752 19.024 45.728 19.168 45.584C19.552 45.224 20.056 44.72 20.512 44.216C22.528 42.008 23.728 39.152 23.728 36.44C23.728 34.352 23.152 32.288 22.168 30.848C21.808 30.32 21.184 29.648 20.92 29.648C20.584 29.648 19.84 30.272 19.36 30.8C17.584 32.768 17.008 35.768 17.008 38.264C17.008 39.656 17.176 41.216 17.344 42.2C17.392 42.488 17.416 42.536 17.128 42.776C15.592 44.048 13.936 45.512 12.688 47.048C11.032 49.112 10 51.344 10 53.912C10 58.088 12.856 62.048 18.736 62.048C19.288 62.048 19.912 62 20.392 61.904C20.656 61.856 20.704 61.832 20.752 62.12C21.04 63.728 21.4 65.816 21.4 66.944C21.4 70.496 19 70.928 17.584 70.928C16.288 70.928 15.664 70.544 15.664 70.232C15.664 70.064 15.88 69.992 16.432 69.824C17.176 69.608 18.04 68.96 18.04 67.568C18.04 66.248 17.2 65.12 15.736 65.12C14.128 65.12 13.168 66.392 13.168 67.88C13.168 69.44 14.104 71.792 17.728 71.792C19.336 71.792 22.456 71.072 22.456 66.992C22.456 65.624 22.024 63.344 21.76 61.856C21.712 61.568 21.736 61.592 22.072 61.448C24.496 60.488 26.104 58.448 26.104 55.736C26.104 52.664 23.848 49.952 20.32 49.952C19.696 49.952 19.696 49.952 19.624 49.52ZM21.28 33.368C22.072 33.368 22.72 34.016 22.72 35.336C22.72 36.992 21.928 38.528 20.056 40.4C19.672 40.784 19.096 41.336 18.544 41.816C18.376 41.96 18.28 41.936 18.232 41.624C18.136 41 18.088 40.184 18.088 39.416C18.088 35.672 19.816 33.368 21.28 33.368ZM18.664 49.712C18.736 50.168 18.736 50.144 18.304 50.288C16.192 51.008 14.824 52.904 14.824 54.944C14.824 57.104 15.952 58.64 17.584 59.192C17.776 59.264 18.064 59.336 18.232 59.336C18.424 59.336 18.52 59.216 18.52 59.072C18.52 58.904 18.328 58.832 18.16 58.76C17.152 58.328 16.432 57.296 16.432 56.192C16.432 54.824 17.368 53.792 18.832 53.384C19.216 53.288 19.264 53.312 19.312 53.576L20.512 60.728C20.56 60.992 20.536 60.992 20.176 61.064C19.792 61.136 19.312 61.184 18.832 61.184C14.632 61.184 11.92 58.856 11.92 55.52C11.92 54.104 12.16 52.208 14.152 49.952C15.592 48.344 16.696 47.456 17.824 46.544C18.064 46.352 18.112 46.376 18.16 46.64ZM20.32 53.528C20.272 53.24 20.296 53.168 20.584 53.192C22.528 53.36 24.136 54.992 24.136 57.104C24.136 58.616 23.224 59.84 21.88 60.512C21.592 60.656 21.544 60.656 21.496 60.368Z";
    const gm358ClefLicense = "Copyright © 2026, Steinberg Media Technologies GmbH (http://www.steinberg.net/),\nwith Reserved Font Name \"Bravura\".\n\nThis Font Software is licensed under the SIL Open Font License, Version 1.1.\nThis license is copied below, and is also available with a FAQ at:\nhttp://scripts.sil.org/OFL\n\n-----------------------------------------------------------\nSIL OPEN FONT LICENSE Version 1.1 - 26 February 2007\n-----------------------------------------------------------\n\nPREAMBLE\nThe goals of the Open Font License (OFL) are to stimulate worldwide\ndevelopment of collaborative font projects, to support the font creation\nefforts of academic and linguistic communities, and to provide a free and\nopen framework in which fonts may be shared and improved in partnership\nwith others.\n\nThe OFL allows the licensed fonts to be used, studied, modified and\nredistributed freely as long as they are not sold by themselves. The\nfonts, including any derivative works, can be bundled, embedded,\nredistributed and/or sold with any software provided that any reserved\nnames are not used by derivative works. The fonts and derivatives,\nhowever, cannot be released under any other type of license. The\nrequirement for fonts to remain under this license does not apply\nto any document created using the fonts or their derivatives.\n\nDEFINITIONS\n\"Font Software\" refers to the set of files released by the Copyright\nHolder(s) under this license and clearly marked as such. This may\ninclude source files, build scripts and documentation.\n\n\"Reserved Font Name\" refers to any names specified as such after the\ncopyright statement(s).\n\n\"Original Version\" refers to the collection of Font Software components as\ndistributed by the Copyright Holder(s).\n\n\"Modified Version\" refers to any derivative made by adding to, deleting,\nor substituting -- in part or in whole -- any of the components of the\nOriginal Version, by changing formats or by porting the Font Software to a\nnew environment.\n\n\"Author\" refers to any designer, engineer, programmer, technical\nwriter or other person who contributed to the Font Software.\n\nPERMISSION AND CONDITIONS\nPermission is hereby granted, free of charge, to any person obtaining\na copy of the Font Software, to use, study, copy, merge, embed, modify,\nredistribute, and sell modified and unmodified copies of the Font\nSoftware, subject to the following conditions:\n\n1) Neither the Font Software nor any of its individual components,\nin Original or Modified Versions, may be sold by itself.\n\n2) Original or Modified Versions of the Font Software may be bundled,\nredistributed and/or sold with any software, provided that each copy\ncontains the above copyright notice and this license. These can be\nincluded either as stand-alone text files, human-readable headers or\nin the appropriate machine-readable metadata fields within text or\nbinary files as long as those fields can be easily viewed by the user.\n\n3) No Modified Version of the Font Software may use the Reserved Font\nName(s) unless explicit written permission is granted by the corresponding\nCopyright Holder. This restriction only applies to the primary font name as\npresented to the users.\n\n4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font\nSoftware shall not be used to promote, endorse or advertise any\nModified Version, except to acknowledge the contribution(s) of the\nCopyright Holder(s) and the Author(s) or with their explicit written\npermission.\n\n5) The Font Software, modified or unmodified, in part or in whole,\nmust be distributed entirely under this license, and must not be\ndistributed under any other license. The requirement for fonts to\nremain under this license does not apply to any document created\nusing the Font Software.\n\nTERMINATION\nThis license becomes null and void if any of the above conditions are\nnot met.\n\nDISCLAIMER\nTHE FONT SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND,\nEXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF\nMERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT\nOF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE\nCOPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,\nINCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL\nDAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING\nFROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM\nOTHER DEALINGS IN THE FONT SOFTWARE.\n";
    // GM358: user-provided footnote photograph (2026-10-24), edition unspecified.
    // GM387: Peters 8951, Symphony 5, printed/PDF p.137; unchanged.
    function motifSvg(two) {
        const width = two ? 292 : 134;
        let body = '<g fill="black" stroke="black" stroke-width="1">';
        for (const y of [38, 44, 50, 56, 62]) body += '<path d="M4 '+y+' H'+(two ? 280 : width)+'" fill="none" stroke-width=".7"/>';
        if (two) body += '<metadata>'+escape(gm358ClefLicense)+'</metadata><path data-clef="treble" data-glyph="gClef" data-source="Bravura-1.482" d="'+gm358ClefPath+'" fill="black" stroke="none"/>';
        function note(x, y, duration, pitch, articulation) {
            body += '<g data-note="'+duration+'" data-pitch="'+pitch+'"><ellipse cx="'+x+'" cy="'+y+'" rx="4.6" ry="3.1" transform="rotate(-20 '+x+' '+y+')"/><path d="M'+(x+4)+' '+y+' V'+(y-31)+'" fill="none" stroke-width="1.25"/>';
            const stem = x + 4, top = y - 31;
            for (let flag = 0; flag < (duration === 'sixteenth' ? 2 : duration === 'eighth' ? 1 : 0); flag++) {
                const t = top + flag * 7;
                body += '<path d="M'+stem+' '+t+' C'+(stem+1)+' '+(t+7)+' '+(stem+13)+' '+(t+6)+' '+(stem+10)+' '+(t+19)+' C'+(stem+12)+' '+(t+10)+' '+(stem+3)+' '+(t+10)+' '+stem+' '+(t+4)+' Z" stroke="none"/>';
            }
            if (pitch === 'C4') body += '<path d="M'+(x-7)+' 68 H'+(x+7)+'" fill="none" stroke-width=".9"/>';
            if (articulation === 'tenuto') body += '<path data-articulation="tenuto" d="M'+(x-3.5)+' '+(y+13)+' H'+(x+3.5)+'" stroke-width="1.4"/>';
            if (articulation === 'staccato') body += '<circle data-articulation="staccato" cx="'+x+'" cy="'+(y+12)+'" r="1.35" stroke="none"/>';
            body += '</g>';
        }
        function rest(x, dotted) {
            body += '<g data-rest="'+(dotted ? 'dotted-eighth' : 'eighth')+'"><circle cx="'+x+'" cy="46" r="2.1"/><path d="M'+x+' 47 Q'+(x+4)+' 50 '+(x+6)+' 43 L'+(x+1)+' 59" fill="none" stroke-width="1.4"/>';
            if (dotted) body += '<circle data-augmentation-dot="rest" cx="'+(x+11)+'" cy="47" r="1.35"/>';
            body += '</g>';
        }
        for (let bar = 0; bar < (two ? 2 : 1); bar++) {
            const start = two ? 40 + bar * 123 : 20;
            body += '<g data-measure="'+(bar+1)+'">';
            note(start, two ? 56 : 59, 'quarter', two ? 'G4' : 'F4', two ? 'tenuto' : '');
            rest(start + 28, true);
            note(start + 51, bar ? 68 : 65, 'sixteenth', bar ? 'C4' : 'D4', two ? 'staccato' : '');
            const tiedFinal = two && bar === 1;
            note(start + 71, 59, tiedFinal ? 'quarter' : 'eighth', 'F4', two && !tiedFinal ? 'staccato' : '');
            if (tiedFinal) body += '<path data-tie="continuing" d="M239 65 C252 78 275 78 286 65 C273 75 252 75 239 65 Z" stroke="none"/>';
            else rest(start + 94, false);
            body += '<path data-barline="true" d="M'+(two ? (bar ? 280 : 144) : 134)+' 38 V62" fill="none" stroke-width="1"/></g>';
        }
        return {width, height:96, body:body+'</g>'};
    }
    // Bravura 1.482 E062/E260/E08A; same pinned source and OFL as GM358.
    // NimbusRoman-Regular Und outline: manuals/licenses/NimbusRoman-LICENSE.md.
    const gm1550BassPath = "M252 262C78 262 0 135 0 39C0 -41 42 -110 123 -110C186 -110 229 -66 229 -4C229 60 182 100 133 100C106 100 96 93 83 93C70 93 67 101 67 111C67 151 127 224 229 224C335 224 381 120 381 -37C381 -140 359 -260 297 -356C237 -449 134 -534 10 -605C1 -610 -5 -615 -5 -623C-5 -629 -1 -635 8 -635C13 -635 19 -633 25 -630C158 -565 286 -489 392 -375C479 -281 531 -159 531 -28C531 146 425 262 252 262ZM629 180C598 180 574 156 574 125C574 94 598 70 629 70C660 70 684 94 684 125C684 156 660 180 629 180ZM630 -71C599 -71 576 -94 576 -125C576 -156 599 -179 630 -179C661 -179 684 -156 684 -125C684 -94 661 -71 630 -71Z";
    const gm1550FlatPath = "M12 -170C15 -174 18 -175 21 -175C24 -175 27 -173 27 -173C57 -156 81 -129 106 -112C195 -50 226 11 226 57C226 114 182 150 136 153C129 153 122 152 115 150C104 147 92 143 81 136C75 131 64 122 59 122C57 122 56 122 54 123C47 126 43 133 43 140C44 162 50 402 50 422C50 433 41 439 31 439C17 439 1 429 0 411C0 411 4 -160 12 -170ZM47 -81C47 -81 44 -21 44 19C44 35 45 47 46 51C50 63 76 85 90 93C99 98 108 100 116 100C126 100 135 96 141 89C151 78 157 61 157 42C157 24 152 3 140 -18C127 -42 98 -74 68 -93C64 -95 61 -96 58 -96C49 -96 47 -86 47 -81Z";
    const gm1550CommonPath = "M233 251C203 251 168 243 141 231C52 192 5 85 5 -10C5 -19 5 -28 6 -37C11 -91 37 -142 70 -182C108 -228 163 -249 223 -249C398 -249 424 -90 424 -61C424 -39 413 -39 409 -39C401 -39 394 -40 394 -57C394 -186 284 -216 252 -216C171 -216 128 -137 128 28C128 193 204 227 258 227C310 227 331 203 331 193C331 184 328 171 313 171C273 171 250 128 250 97C250 40 299 22 327 22C327 22 403 25 403 108C403 239 252 251 233 251Z";
    const gm1550UndPath = "M705 662H473V643C550 638 565 618 567 515V245C567 177 561 139 544 109C517 61 453 30 378 30C307 30 258 54 231 101C213 133 206 170 206 233V553C207 626 217 636 297 643V662H14V643C93 637 103 627 104 553V241C104 68 185 -14 355 -14C464 -14 539 21 578 89C602 131 611 177 611 254V515C613 620 624 634 705 643ZM740 0H952V15C902 18 886 31 886 67V348C934 393 956 405 989 405C1038 405 1062 374 1062 308V99C1060 34 1048 18 999 15V0H1207V15C1158 20 1147 32 1146 81V310C1146 404 1102 460 1028 460C982 460 951 443 883 379V458L876 460C824 441 790 430 738 415V398C745 401 754 402 765 402C793 402 802 387 802 338V90C801 31 790 18 740 15ZM1713 58C1700 57 1694 57 1690 57C1655 57 1646 68 1646 114V681L1641 683C1594 667 1560 656 1494 639V623C1502 624 1507 624 1516 624C1553 624 1562 614 1562 573V417C1524 449 1497 460 1457 460C1342 460 1249 347 1249 205C1249 77 1323 -10 1434 -10C1490 -10 1528 10 1562 57V-7L1566 -10L1713 42ZM1562 102C1562 95 1555 83 1545 72C1528 52 1502 42 1473 42C1389 42 1335 122 1335 246C1335 358 1384 432 1460 432C1514 432 1562 385 1562 332Z";
    const gm1550UnderlayLicense = "(URW)++,Copyright 2014 by (URW)++ Design & Development\nThe font and related files in this directory are distributed under the\nGNU AFFERO GENERAL PUBLIC LICENSE Version 3 (see the file COPYING), with\nthe following exemption:\n\nAs a special exception, permission is granted to include these font\nprograms in a Postscript or PDF file that consists of a document that\ncontains text to be displayed or printed using this font, regardless\nof the conditions or license applying to the document itself.\n\n";
    function gm1550Svg() {
        const width = 220, height = 96;
        let body = '<metadata>'+escape(gm358ClefLicense)+'\n'+escape(gm1550UnderlayLicense)+'</metadata><g fill="black" stroke="black">';
        for (const y of [38, 44, 50, 56, 62]) body += '<path d="M8 '+y+' H212" fill="none" stroke-width=".7"/>';
        body += '<path data-clef="bass" data-glyph="fClef" d="'+gm1550BassPath+'" transform="translate(12 44) scale(.024 -.024)" stroke="none"/>';
        for (const [x,y] of [[37,56],[45,47],[53,59]]) body += '<path data-accidental="flat" d="'+gm1550FlatPath+'" transform="translate('+x+' '+y+') scale(.024 -.024)" stroke="none"/>';
        body += '<rect data-rest="half" x="84" y="46.6" width="9" height="3.4" stroke="none"/>';
        body += '<g data-note="half" data-pitch="G2"><ellipse cx="136" cy="62" rx="4.6" ry="3.1" transform="rotate(-20 136 62)" fill="none" stroke-width="1.2"/><path d="M140 61 V40" fill="none" stroke-width="1.25"/></g>';
        body += '<path data-underlay="Und" d="'+gm1550UndPath+'" transform="translate(126.529 80) scale(0.011 -0.011)" stroke="none"/>';
        body += '<path data-barline="double" d="M181 38 V62 M185 38 V62" fill="none" stroke-width="1"/>';
        body += '<path data-time-signature="common" data-glyph="timeSigCommon" d="'+gm1550CommonPath+'" transform="translate(195 50) scale(.024 -.024)" stroke="none"/>';
        return {width, height, body:body+'</g>'};
    }
    // Bravura 1.482; NimbusRoman-Italic outlines, with existing font licenses.
    const rsNaturalPath = "M141 181C139 181 138 180 137 180C137 180 73 157 47 157C41 157 37 158 37 162V329C37 336 31 341 25 341H12C5 341 0 336 0 329V-186C0 -192 3 -195 8 -195C9 -195 11 -194 12 -194C12 -194 14 -194 15 -193C29 -187 85 -163 114 -163C124 -163 131 -166 131 -174V-323C131 -330 136 -335 143 -335H156C162 -335 168 -330 168 -323V179C168 184 164 187 160 187C159 187 157 187 156 186ZM37 39C37 53 98 79 122 79C128 79 131 78 131 74V-29C131 -47 74 -70 49 -70C42 -70 37 -68 37 -64Z";
    const rsSharpPath = "M237 118C244 121 249 129 249 135V206C249 211 246 214 242 214C240 214 239 214 237 213C237 213 217 205 212 204C205 204 198 209 198 217V339C198 345 192 350 184 350C174 350 168 345 168 339V209C167 199 164 186 155 180C143 173 109 159 92 155C83 155 80 167 80 175V295C80 301 73 306 66 306C56 306 50 301 50 295V160C50 146 44 136 38 133C32 130 12 122 12 122C5 120 0 112 0 106V35C0 29 3 26 8 26C9 26 11 27 12 27C12 27 27 33 34 37C35 37 36 38 37 38C44 38 50 28 50 20V-79C50 -90 45 -99 39 -102C33 -104 12 -113 12 -113C5 -115 0 -123 0 -129V-200C0 -206 3 -209 8 -209C9 -209 11 -208 12 -208C12 -208 26 -202 35 -199C36 -198 37 -198 38 -198C45 -198 50 -209 50 -214V-337C50 -343 56 -348 63 -348C73 -348 80 -343 80 -337V-198C80 -185 85 -178 90 -176L151 -151C152 -151 154 -150 155 -150C163 -150 168 -162 168 -168V-293C168 -299 174 -304 181 -304C192 -304 198 -299 198 -293V-151C198 -143 202 -131 209 -128C216 -125 237 -117 237 -117C244 -114 249 -106 249 -100V-29C249 -24 246 -21 242 -21C240 -21 239 -21 237 -22L211 -32C205 -32 198 -26 198 -14V79C198 86 203 105 211 108ZM168 -45C162 -65 115 -85 92 -85C86 -85 81 -83 80 -80C78 -76 77 -54 77 -30C77 1 78 36 80 44C82 61 128 82 153 82C160 82 166 80 168 76C170 71 172 46 172 19C172 -8 170 -36 168 -45Z";
    const rsDoubleSharpPath = "M190 -32C179 -26 143 -6 143 1C143 15 176 30 190 35C194 35 198 34 202 34C218 34 233 38 240 44C245 49 247 64 247 80C247 97 244 115 240 120C236 125 220 127 203 127C185 127 167 125 162 120C158 117 157 99 157 81C152 70 136 34 124 34C110 34 94 67 90 81C90 98 87 116 82 120C78 125 62 127 46 127C29 127 11 125 5 120C2 118 0 101 0 83C0 65 2 47 5 44C12 38 30 34 47 34C51 34 54 35 57 35C68 29 104 9 104 2C104 -11 72 -27 58 -32H48C30 -32 11 -34 5 -39C2 -42 0 -59 0 -77C0 -95 2 -113 5 -115C12 -121 28 -125 45 -125C60 -125 76 -122 82 -115C88 -110 90 -93 90 -77C90 -76 91 -74 92 -73C98 -59 110 -31 123 -31C136 -31 153 -63 157 -77C157 -95 158 -112 162 -115C169 -121 185 -125 202 -125C218 -125 233 -122 240 -115C245 -110 247 -95 247 -79C247 -62 244 -44 240 -39C235 -34 217 -32 200 -32Z";
    const rsEighthRestPath = "M134 107C134 144 104 174 67 174C30 174 0 144 0 107C0 86 12 68 27 56C36 50 45 45 55 43C63 41 72 39 81 39C95 39 109 42 120 46C134 50 143 54 156 61C158 62 160 62 161 62C165 62 166 58 166 53C166 50 166 46 165 42C162 27 90 -172 72 -238C72 -250 95 -251 101 -251C112 -251 126 -249 136 -241C139 -239 237 112 237 112C241 130 246 146 247 151C247 161 237 166 235 167C233 167 230 167 224 163C217 157 167 97 134 97Z";
    const rsEtcOutline = "<path data-label=\"etc.\" d=\"M358 109C286 50 255 34 211 34C155 34 118 70 118 125C118 140 120 154 128 186L156 190C306 211 412 287 412 373C412 415 382 441 332 441C188 441 31 277 31 126C31 45 85 -11 163 -11C234 -11 311 30 370 97ZM152 252C186 341 260 418 311 418C332 418 346 403 346 379C346 348 327 312 296 282C259 247 221 229 135 208ZM740 428H660L688 531C689 533 689 535 689 537C689 543 687 546 681 546C675 546 672 545 666 537C627 487 565 436 533 427C508 419 501 413 501 402C501 401 501 399 502 396H576L504 121C502 112 501 108 498 100C488 67 481 36 481 26C481 5 502 -11 529 -11C575 -11 608 17 671 110L658 117C609 54 593 38 577 38C568 38 562 45 562 58C562 59 562 59 563 63L651 396H735ZM1072 106C1017 47 978 25 929 25C872 25 838 67 838 139C838 224 873 314 929 372C958 402 998 420 1038 420C1061 420 1075 412 1075 400C1075 395 1073 390 1069 381C1062 368 1060 362 1060 352C1060 328 1075 314 1099 314C1127 314 1147 333 1147 360C1147 407 1103 441 1042 441C892 441 752 295 752 139C752 44 806 -11 899 -11C974 -11 1027 19 1088 96ZM1248 100C1218 100 1193 75 1193 43C1193 14 1218 -11 1246 -11C1278 -11 1304 13 1304 43C1304 74 1278 100 1248 100Z\" transform=\"translate(449.504 58) scale(0.012 -0.012)\" stroke=\"none\"/>";
    const rsLeftFullOutline = "<path data-label=\"linke H.\" d=\"M228 123C163 40 155 32 133 32C123 32 118 38 118 50C118 58 121 71 126 89C127 93 128 96 128 97V99L279 678L274 683C214 669 176 663 118 656V640C166 640 186 634 186 617C186 613 185 607 183 599L45 71C42 61 41 52 41 45C41 8 58 -11 90 -11C142 -11 176 17 241 114ZM500 114C475 81 469 73 459 63C442 46 427 36 418 36C410 36 402 43 402 51C402 61 405 77 412 95L417 113L418 115V117L506 439L503 441C401 422 382 419 343 416V400C397 399 406 396 406 376C406 368 403 351 397 332L349 155C333 95 327 66 327 46C327 9 343 -11 373 -11C420 -11 456 19 513 103ZM492 654C465 654 445 632 445 601C445 569 464 548 493 548C519 548 542 571 542 599C542 628 519 654 492 654ZM1016 117C962 49 950 38 934 38C925 38 918 45 918 54C918 62 922 81 932 117L989 323C994 344 998 366 998 380C998 417 971 441 932 441C868 441 805 380 702 221L769 439L766 441C713 430 691 426 604 410V394C655 393 668 387 668 367C668 361 667 355 666 350L570 0H645C692 158 701 180 745 248C805 340 856 390 893 390C908 390 917 379 917 361C917 349 911 316 903 285L859 120C846 68 843 55 843 45C843 7 857 -9 890 -9C935 -9 960 11 1030 104ZM1470 109C1434 47 1428 41 1410 41C1389 41 1368 74 1329 170C1324 183 1309 219 1292 258C1440 389 1469 409 1517 412V428H1334V412C1377 411 1389 407 1389 394C1389 374 1339 326 1246 254C1231 243 1217 232 1203 221L1323 678L1318 683C1257 669 1219 663 1162 656V640C1211 641 1229 634 1230 615C1228 598 1221 571 1208 525C1204 511 1201 500 1199 492L1197 483L1070 0H1145L1193 180L1235 212C1251 168 1277 106 1295 71C1327 8 1345 -11 1374 -11C1414 -11 1439 14 1485 98ZM1858 109C1786 50 1755 34 1711 34C1655 34 1618 70 1618 125C1618 140 1620 154 1628 186L1656 190C1806 211 1912 287 1912 373C1912 415 1882 441 1832 441C1688 441 1531 277 1531 126C1531 45 1585 -11 1663 -11C1734 -11 1811 30 1870 97ZM1652 252C1686 341 1760 418 1811 418C1832 418 1846 403 1846 379C1846 348 1827 312 1796 282C1759 247 1721 229 1635 208ZM2961 653H2714V637C2772 630 2784 622 2784 594C2784 579 2781 559 2773 532L2727 368H2442L2496 563C2511 614 2537 633 2597 637V653H2324V637C2387 631 2401 623 2401 594C2401 579 2398 559 2390 532L2267 90C2249 32 2242 26 2186 16V0H2432V16C2372 24 2361 31 2361 60C2361 67 2362 75 2364 82L2430 326H2715L2650 90C2634 38 2614 23 2549 16V0H2822V16C2757 22 2744 30 2744 59C2744 68 2745 74 2747 82L2879 563C2896 621 2904 627 2961 637ZM2998 100C2968 100 2943 75 2943 43C2943 14 2968 -11 2996 -11C3028 -11 3054 13 3054 43C3054 74 3028 100 2998 100Z\" transform=\"translate(39.587 88) scale(0.011 -0.011)\" stroke=\"none\"/>";
    const rsLeftShortOutline = "<path data-label=\"l. H.\" d=\"M228 123C163 40 155 32 133 32C123 32 118 38 118 50C118 58 121 71 126 89C127 93 128 96 128 97V99L279 678L274 683C214 669 176 663 118 656V640C166 640 186 634 186 617C186 613 185 607 183 599L45 71C42 61 41 52 41 45C41 8 58 -11 90 -11C142 -11 176 17 241 114ZM360 100C330 100 305 75 305 43C305 14 330 -11 358 -11C390 -11 416 13 416 43C416 74 390 100 360 100ZM1545 653H1298V637C1356 630 1368 622 1368 594C1368 579 1365 559 1357 532L1311 368H1026L1080 563C1095 614 1121 633 1181 637V653H908V637C971 631 985 623 985 594C985 579 982 559 974 532L851 90C833 32 826 26 770 16V0H1016V16C956 24 945 31 945 60C945 67 946 75 948 82L1014 326H1299L1234 90C1218 38 1198 23 1133 16V0H1406V16C1341 22 1328 30 1328 59C1328 68 1329 74 1331 82L1463 563C1480 621 1488 627 1545 637ZM1582 100C1552 100 1527 75 1527 43C1527 14 1552 -11 1580 -11C1612 -11 1638 13 1638 43C1638 74 1612 100 1582 100Z\" transform=\"translate(117.375 88) scale(0.011 -0.011)\" stroke=\"none\"/>";
    const rsRightShortOutline = "<path data-label=\"rechte H.\" d=\"M121 0C173 171 190 212 236 289C270 345 297 376 314 376C321 376 325 372 330 362C338 345 346 340 366 340C396 340 412 358 412 390C412 420 393 441 365 441C342 441 315 426 289 399C248 356 208 298 192 258L178 222L231 439L228 441C155 428 146 426 73 414V397C95 401 99 402 107 402C129 402 142 392 142 374C142 360 142 360 126 292L45 0ZM747 109C675 50 644 34 600 34C544 34 507 70 507 125C507 140 509 154 517 186L545 190C695 211 801 287 801 373C801 415 771 441 721 441C577 441 420 277 420 126C420 45 474 -11 552 -11C623 -11 700 30 759 97ZM541 252C575 341 649 418 700 418C721 418 735 403 735 379C735 348 716 312 685 282C648 247 610 229 524 208ZM1183 106C1128 47 1089 25 1040 25C983 25 949 67 949 139C949 224 984 314 1040 372C1069 402 1109 420 1149 420C1172 420 1186 412 1186 400C1186 395 1184 390 1180 381C1173 368 1171 362 1171 352C1171 328 1186 314 1210 314C1238 314 1258 333 1258 360C1258 407 1214 441 1153 441C1003 441 863 295 863 139C863 44 917 -11 1010 -11C1085 -11 1138 19 1199 96ZM1742 117C1688 50 1676 38 1660 38C1651 38 1644 46 1644 56C1644 67 1660 129 1677 181C1706 274 1725 349 1725 374C1725 414 1698 441 1659 441C1594 441 1523 376 1430 230L1550 678L1545 683C1485 669 1446 663 1388 656V640L1414 641C1437 642 1455 631 1455 616C1455 602 1450 578 1441 549C1440 547 1436 533 1431 512L1296 0H1371C1411 154 1424 188 1464 249C1516 328 1584 390 1619 390C1634 390 1647 378 1647 365C1647 361 1644 348 1640 332L1585 125C1572 76 1565 45 1565 33C1565 7 1582 -9 1610 -9C1660 -9 1695 18 1755 105ZM2073 428H1993L2021 531C2022 533 2022 535 2022 537C2022 543 2020 546 2014 546C2008 546 2005 545 1999 537C1960 487 1898 436 1866 427C1841 419 1834 413 1834 402C1834 401 1834 399 1835 396H1909L1837 121C1835 112 1834 108 1831 100C1821 67 1814 36 1814 26C1814 5 1835 -11 1862 -11C1908 -11 1941 17 2004 110L1991 117C1942 54 1926 38 1910 38C1901 38 1895 45 1895 58C1895 59 1895 59 1896 63L1984 396H2068ZM2413 109C2341 50 2310 34 2266 34C2210 34 2173 70 2173 125C2173 140 2175 154 2183 186L2211 190C2361 211 2467 287 2467 373C2467 415 2437 441 2387 441C2243 441 2086 277 2086 126C2086 45 2140 -11 2218 -11C2289 -11 2366 30 2425 97ZM2207 252C2241 341 2315 418 2366 418C2387 418 2401 403 2401 379C2401 348 2382 312 2351 282C2314 247 2276 229 2190 208ZM3516 653H3269V637C3327 630 3339 622 3339 594C3339 579 3336 559 3328 532L3282 368H2997L3051 563C3066 614 3092 633 3152 637V653H2879V637C2942 631 2956 623 2956 594C2956 579 2953 559 2945 532L2822 90C2804 32 2797 26 2741 16V0H2987V16C2927 24 2916 31 2916 60C2916 67 2917 75 2919 82L2985 326H3270L3205 90C3189 38 3169 23 3104 16V0H3377V16C3312 22 3299 30 3299 59C3299 68 3300 74 3302 82L3434 563C3451 621 3459 627 3516 637ZM3553 100C3523 100 3498 75 3498 43C3498 14 3523 -11 3551 -11C3583 -11 3609 13 3609 43C3609 74 3583 100 3553 100Z\" transform=\"translate(176.5345 18) scale(0.011 -0.011)\" stroke=\"none\"/>";
    const rsRightFullOutline = "<path data-label=\"rechte Hand\" d=\"M121 0C173 171 190 212 236 289C270 345 297 376 314 376C321 376 325 372 330 362C338 345 346 340 366 340C396 340 412 358 412 390C412 420 393 441 365 441C342 441 315 426 289 399C248 356 208 298 192 258L178 222L231 439L228 441C155 428 146 426 73 414V397C95 401 99 402 107 402C129 402 142 392 142 374C142 360 142 360 126 292L45 0ZM747 109C675 50 644 34 600 34C544 34 507 70 507 125C507 140 509 154 517 186L545 190C695 211 801 287 801 373C801 415 771 441 721 441C577 441 420 277 420 126C420 45 474 -11 552 -11C623 -11 700 30 759 97ZM541 252C575 341 649 418 700 418C721 418 735 403 735 379C735 348 716 312 685 282C648 247 610 229 524 208ZM1183 106C1128 47 1089 25 1040 25C983 25 949 67 949 139C949 224 984 314 1040 372C1069 402 1109 420 1149 420C1172 420 1186 412 1186 400C1186 395 1184 390 1180 381C1173 368 1171 362 1171 352C1171 328 1186 314 1210 314C1238 314 1258 333 1258 360C1258 407 1214 441 1153 441C1003 441 863 295 863 139C863 44 917 -11 1010 -11C1085 -11 1138 19 1199 96ZM1742 117C1688 50 1676 38 1660 38C1651 38 1644 46 1644 56C1644 67 1660 129 1677 181C1706 274 1725 349 1725 374C1725 414 1698 441 1659 441C1594 441 1523 376 1430 230L1550 678L1545 683C1485 669 1446 663 1388 656V640L1414 641C1437 642 1455 631 1455 616C1455 602 1450 578 1441 549C1440 547 1436 533 1431 512L1296 0H1371C1411 154 1424 188 1464 249C1516 328 1584 390 1619 390C1634 390 1647 378 1647 365C1647 361 1644 348 1640 332L1585 125C1572 76 1565 45 1565 33C1565 7 1582 -9 1610 -9C1660 -9 1695 18 1755 105ZM2073 428H1993L2021 531C2022 533 2022 535 2022 537C2022 543 2020 546 2014 546C2008 546 2005 545 1999 537C1960 487 1898 436 1866 427C1841 419 1834 413 1834 402C1834 401 1834 399 1835 396H1909L1837 121C1835 112 1834 108 1831 100C1821 67 1814 36 1814 26C1814 5 1835 -11 1862 -11C1908 -11 1941 17 2004 110L1991 117C1942 54 1926 38 1910 38C1901 38 1895 45 1895 58C1895 59 1895 59 1896 63L1984 396H2068ZM2413 109C2341 50 2310 34 2266 34C2210 34 2173 70 2173 125C2173 140 2175 154 2183 186L2211 190C2361 211 2467 287 2467 373C2467 415 2437 441 2387 441C2243 441 2086 277 2086 126C2086 45 2140 -11 2218 -11C2289 -11 2366 30 2425 97ZM2207 252C2241 341 2315 418 2366 418C2387 418 2401 403 2401 379C2401 348 2382 312 2351 282C2314 247 2276 229 2190 208ZM3516 653H3269V637C3327 630 3339 622 3339 594C3339 579 3336 559 3328 532L3282 368H2997L3051 563C3066 614 3092 633 3152 637V653H2879V637C2942 631 2956 623 2956 594C2956 579 2953 559 2945 532L2822 90C2804 32 2797 26 2741 16V0H2987V16C2927 24 2916 31 2916 60C2916 67 2917 75 2919 82L2985 326H3270L3205 90C3189 38 3169 23 3104 16V0H3377V16C3312 22 3299 30 3299 59C3299 68 3300 74 3302 82L3434 563C3451 621 3459 627 3516 637ZM3935 110 3907 82C3875 50 3864 41 3855 41C3847 41 3841 47 3841 54C3841 74 3883 246 3930 417C3933 427 3934 429 3936 438L3929 441L3868 434L3865 431L3854 383C3846 420 3817 441 3774 441C3641 441 3488 259 3488 100C3488 30 3526 -11 3590 -11C3660 -11 3703 22 3791 146C3770 64 3768 56 3768 31C3768 2 3780 -10 3808 -10C3848 -10 3872 9 3947 100ZM3780 419C3814 417 3836 393 3836 358C3836 274 3785 156 3717 82C3693 55 3659 38 3630 38C3594 38 3572 66 3572 112C3572 168 3609 269 3653 332C3693 390 3739 422 3780 419ZM4431 117C4377 49 4365 38 4349 38C4340 38 4333 45 4333 54C4333 62 4337 81 4347 117L4404 323C4409 344 4413 366 4413 380C4413 417 4386 441 4347 441C4283 441 4220 380 4117 221L4184 439L4181 441C4128 430 4106 426 4019 410V394C4070 393 4083 387 4083 367C4083 361 4082 355 4081 350L3985 0H4060C4107 158 4116 180 4160 248C4220 340 4271 390 4308 390C4323 390 4332 379 4332 361C4332 349 4326 316 4318 285L4274 120C4261 68 4258 55 4258 45C4258 7 4272 -9 4305 -9C4350 -9 4375 11 4445 104ZM4934 111C4879 48 4869 40 4852 40C4842 40 4834 48 4834 60C4834 76 4865 194 4899 306C4922 386 4942 459 4998 678L4993 683C4941 672 4905 667 4840 660V643C4895 641 4902 638 4902 617C4902 603 4901 600 4887 547L4843 383C4835 425 4817 441 4778 441C4648 441 4486 253 4486 103C4486 32 4526 -11 4591 -11C4659 -11 4703 21 4771 121C4760 70 4758 55 4758 32C4758 5 4775 -13 4800 -13C4842 -13 4895 28 4946 101ZM4782 418C4812 416 4827 397 4827 361C4827 209 4723 37 4631 37C4596 37 4573 63 4573 103C4573 185 4623 302 4689 372C4717 401 4754 420 4782 418Z\" transform=\"translate(239.6595 18) scale(0.011 -0.011)\" stroke=\"none\"/>";
    const gm325TrillPath = "M266 390C262 390 256 388 253 387L204 371C195 368 191 365 187 355L151 267C147 257 146 255 143 255C139 255 133 260 124 264C110 270 97 273 82 273C35 273 0 245 0 203C0 172 21 146 66 146C78 146 91 148 97 148C99 148 100 147 100 145C100 143 99 140 97 135L86 108C75 81 67 61 67 40C67 12 86 -10 124 -10C176 -10 226 32 226 106C226 130 222 152 213 174C211 179 210 181 210 184C210 190 216 195 232 204L238 207C273 228 297 242 316 242C325 242 329 239 329 227C329 217 326 205 323 198L250 17C248 12 247 9 247 6C247 2 250 0 258 0H307C316 0 319 2 323 12L388 174C401 207 433 244 455 244C461 244 465 242 465 238C465 229 443 226 443 198C443 178 458 166 479 166C503 166 521 186 521 221C521 250 506 274 469 274C443 274 422 260 407 243C398 233 397 229 393 229C388 229 392 236 384 251C377 264 362 273 340 273C300 273 262 253 241 242C228 235 222 231 217 231C215 231 214 232 214 234C214 238 217 244 219 249L269 373C271 378 272 381 272 384C272 388 270 390 266 390ZM82 250C94 250 109 246 120 240C129 235 133 231 133 226C133 223 131 218 129 213L125 203C120 190 116 187 103 184C90 181 78 179 68 179C35 179 27 195 27 209C27 227 42 250 82 250ZM189 167C192 167 192 164 194 159C202 141 203 123 203 105C203 61 176 21 147 21C139 21 136 26 136 33C136 41 140 54 144 64C144 65 145 65 183 160C185 165 186 167 189 167Z";
    function gm325Svg() {
        let body='<metadata>'+escape(gm358ClefLicense)+'</metadata><g fill="black" stroke="black">';
        for (const y of [50,56,62,68,74]) body+='<path d="M8 '+y+' H292" fill="none" stroke-width=".7"/>';
        const ledger=(x,y,small)=>{let lines='';for(let ly=44;ly>=y;ly-=6)lines+='<path data-ledger="'+(small?'grace':'main')+'" d="M'+(x-(small?4.62:7))+' '+ly+' H'+(x+(small?4.62:7))+'" stroke-width=".8"/>';return lines;};
        for (const [x,y,pitch,first,second] of [[30,38,'C6',41,38],[99,44,'A5',47,44],[168,50,'F5',53,50],[237,56,'D5',59,56]]) {
            body+=ledger(x,y,false)+'<ellipse data-duration="quarter" data-pitch="'+pitch+'" cx="'+x+'" cy="'+y+'" rx="4.6" ry="3.1" transform="rotate(-20 '+x+' '+y+')" stroke="none"/>';
            body+='<path data-stem="down" d="M'+(x-4)+' '+y+' V'+(y+25)+'" fill="none" stroke-width="1.25"/><path data-ornament="trill" d="'+gm325TrillPath+'" transform="translate('+(x-5)+' '+(y-12)+') scale(.024 -.024)" stroke="none"/>';
            const beam=Math.min(first,second)-13.2,one=x+29,two=x+42;
            body+='<g data-after-notes="thirty-second-pair">';
            for(const [nx,ny] of [[one,first],[two,second]]) body+=ledger(nx,ny,true)+'<ellipse data-grace="thirty-second" cx="'+nx+'" cy="'+ny+'" rx="3.036" ry="2.046" transform="rotate(-20 '+nx+' '+ny+')" stroke="none"/><path data-stem="grace-up" d="M'+(nx+2.64)+' '+ny+' V'+beam+'" fill="none" stroke-width=".825"/>';
            for(const by of [beam,beam+4,beam+8])body+='<path data-beam="thirty-second" d="M'+(one+2.64)+' '+by+' H'+(two+2.64)+'" stroke-width="1.716"/>';
            if(x===30||x===168)body+='<path data-accidental="natural" d="'+rsNaturalPath+'" transform="translate('+(x+19)+' '+first+') scale(.017 -.017)" stroke="none"/>';
            body+='</g>';
        }
        body+='<path data-barline="end" d="M292 50 V74" fill="none" stroke-width="1"/>';
        return {width:300,height:100,body:body+'</g>'};
    }
    function rsScoreSvg(kind) {
        const division = kind === 'rs651-example', width = division ? 480 : 310, height = division ? 112 : 104;
        let body = '<metadata>'+escape(gm358ClefLicense)+'\n'+escape(gm1550UnderlayLicense)+'</metadata><g fill="black" stroke="black">';
        for (const y of [38,44,50,56,62]) body += '<path d="M8 '+y+' H'+(division ? 436 : 302)+'" fill="none" stroke-width=".7"/>';
        body += '<path data-clef="bass" d="'+gm1550BassPath+'" transform="translate(12 44) scale(.024 -.024)" stroke="none"/>';
        const accidental = (kind,x,y) => kind ? '<path data-accidental="'+kind+'" d="'+({flat:gm1550FlatPath,natural:rsNaturalPath,sharp:rsSharpPath,doubleSharp:rsDoubleSharpPath}[kind])+'" transform="translate('+x+' '+y+') scale(.024 -.024)" stroke="none"/>' : '';
        const head = (x,y) => '<ellipse data-notehead="black" cx="'+x+'" cy="'+y+'" rx="4.6" ry="3.1" transform="rotate(-20 '+x+' '+y+')" stroke="none"/>';
        if (division) {
            const upperY=[[65,68],[62,65],[56,59],[53,56]], lowerY=[[62,65],[59,62],[56,59],[50,53]];
            const upperAcc=[[null,'sharp'],['sharp','doubleSharp'],['flat',null],['natural',null]], lowerAcc=[['natural',null],[null,'sharp'],['natural','sharp'],['flat','natural']];
            const pair = (x,ys,acc,up) => {
                const beam = up ? Math.min(...ys)-20 : Math.max(...ys)+23, shift = up ? 4 : -4;
                let result='<g data-voice="'+(up?'upper':'lower')+'" data-duration="sixteenth-pair">';
                for (let i=0;i<2;i++) {
                    const nx=x+i*20,y=ys[i];
                    result+=accidental(acc[i],nx-12,y)+head(nx,y)+'<path data-stem="'+(up?'up':'down')+'" d="M'+(nx+shift)+' '+y+' V'+beam+'" fill="none" stroke-width="1.25"/>';
                }
                for (const by of [beam,beam+(up?4:-4)]) result+='<path data-beam="sixteenth" d="M'+(x+shift)+' '+by+' H'+(x+20+shift)+'" stroke-width="2.6"/>';
                const sy=up?Math.max(...ys)+7:Math.min(...ys)-8;
                result+='<path data-slur="'+(up?'below':'above')+'" d="M'+x+' '+sy+' Q'+(x+10)+' '+(sy+(up?9:-9))+' '+(x+20)+' '+sy+'" fill="none" stroke-width=".8"/>';
                result+='<path data-rest="eighth" d="'+rsEighthRestPath+'" transform="translate('+(x+6)+' '+(up?87:32)+') scale(.021 -.021)" stroke="none"/>';
                return result+'</g>';
            };
            for (let i=0;i<4;i++) { const x=48+i*102; body+=pair(x,upperY[i],upperAcc[i],true)+pair(x+48,lowerY[i],lowerAcc[i],false); }
            body+='<path data-barline="end" d="M436 38 V62" fill="none" stroke-width="1"/>'+rsEtcOutline;
        } else {
            for (const [x,y,up] of [[57,56,true],[127,50,false],[197,53,true],[267,59,true]]) body+=head(x,y)+'<path data-duration="quarter" data-stem="'+(up?'up':'down')+'" d="M'+(x+(up?4:-4))+' '+y+' V'+(y+(up?-25:25))+'" fill="none" stroke-width="1.25"/>';
            body+=accidental('flat',45,56)+accidental('flat',255,59)+rsLeftFullOutline+rsLeftShortOutline+rsRightShortOutline+rsRightFullOutline;
        }
        return {width,height,body:body+'</g>'};
    }
    function notationImage(kind, fallback) {
        let width = 76, height = 48, body = '';
        if (kind === 'gm325-example') {
            ({width, height, body} = gm325Svg());
        } else if (kind === 'rs651-example' || kind === 'rs782-example') {
            ({width, height, body} = rsScoreSvg(kind));
        } else if (kind === 'gm1550-example') {
            ({width, height, body} = gm1550Svg());
        } else if (kind.startsWith('motif-')) {
            ({width, height, body} = motifSvg(kind === 'motif-two'));
        } else if (kind === 'roof') {
            width = 37;
            body = '<path d="M7 26 L18 9 L29 26 M7 32 H29" fill="none" stroke="black" stroke-width="2.3"/>';
        } else if (kind === 'fermata-v') {
            width = 70;
            body = '<path d="M5 28 C8 7 31 7 34 28 M45 11 L54 31 L64 11" fill="none" stroke="black" stroke-width="2.3"/><circle cx="19.5" cy="27" r="2.5"/>';
        } else if (kind === 'fermata' || kind === 'short-pause') {
            width = 39;
            body = '<path d="M5 28 C8 7 31 7 34 28" fill="none" stroke="black" stroke-width="2.3"/><circle cx="19.5" cy="27" r="2.5"/>';
        } else if (kind === 'whole') {
            width = 33;
            body = '<ellipse data-note="whole" cx="16" cy="31" rx="9" ry="5" fill="none" stroke="black" stroke-width="2"/>';
        } else if (kind === 'stopped-plus') {
            width = 30;
            body = '<path d="M15 13 V35 M4 24 H26" fill="none" stroke="black" stroke-width="2"/>';
        } else if (kind === 'rhythmic-alignment') {
            width = 17;
            body = '<path d="M8 7 V41" fill="none" stroke="black" stroke-width="1.8"/>';
        } else if (kind === 'caret-accent') {
            width = 31;
            body = '<path d="M5 32 L15 12 L26 32" fill="none" stroke="black" stroke-width="2.3"/>';
        } else if (kind === 'accent-right') {
            width = 33;
            body = '<path d="M5 14 L28 24 L5 34" fill="none" stroke="black" stroke-width="2.1"/>';
        } else if (['glissando-up','portamento-up','portamento-down'].includes(kind)) {
            width = 34;
            body = '<path d="'+(kind === 'portamento-down' ? 'M5 9 L29 39' : 'M5 39 L29 9')+'" fill="none" stroke="black" stroke-width="1.7"/>';
        } else if (kind === 'down-arrow') {
            width = 34;
            body = '<path d="M17 7 V39 M6 28 L17 39 L28 28" fill="none" stroke="black" stroke-width="1.9"/>';
        } else if (kind === 'tempo-star') {
            width = 35;
            body = '<path d="M17.5 9 V39 M5 16 L30 32 M5 32 L30 16" fill="none" stroke="black" stroke-width="2"/>';
        } else if (kind === 'tempo-theta') {
            width = 35;
            body = '<ellipse cx="17.5" cy="24" rx="11" ry="15" fill="none" stroke="black" stroke-width="2"/><path d="M7 24 H28" stroke="black" stroke-width="2"/>';
        } else if (kind === 'circle-cross-marker') {
            width = 42;
            body = '<circle cx="21" cy="24" r="11" fill="none" stroke="black" stroke-width="1.8"/><path d="M21 5 V43 M2 24 H40" stroke="black" stroke-width="1.8"/>';
        } else if (kind === 'time-signature-c') {
            width = 34;
            body = '<path d="M28 13 C8 2 3 42 27 35" fill="none" stroke="black" stroke-width="4" stroke-linecap="round"/>';
        } else if (['quarter','dotted-half','half','dotted-quarter','eighth'].includes(kind)) {
            const dotted = kind.startsWith('dotted-'), openHead = kind === 'half' || kind === 'dotted-half';
            width = dotted ? 38 : 28;
            body = '<ellipse data-note="'+(openHead ? 'half' : kind === 'eighth' ? 'eighth' : 'quarter')+'" cx="12" cy="36" rx="6" ry="4" transform="rotate(-20 12 36)" fill="'+(openHead ? 'none' : 'black')+'" stroke="black" stroke-width="1.8"/><path d="M17 35 V9" fill="none" stroke="black" stroke-width="1.7"/>';
            if (kind === 'eighth') body += '<path data-flag="eighth" d="M17 9 C18 16 29 15 26 29 C29 20 20 20 17 14 Z"/>';
            if (dotted) body += '<circle data-augmentation-dot="note" cx="29" cy="35" r="2.1"/>';
        } else {
            const below = kind === 'eighth-triplet-below', triplet = kind.endsWith('triplet') || below, beamed = kind.startsWith('eighth');
            if (below) height = 60;
            for (const x of [12, 35, 58]) body += '<ellipse cx="'+x+'" cy="39" rx="6" ry="4" transform="rotate(-20 '+x+' 39)"/><path d="M'+(x+5)+' 38 V17" fill="none" stroke="black" stroke-width="1.7"/>';
            if (beamed) body += '<path d="M17 17 H63" fill="none" stroke="black" stroke-width="4"/>';
            if (triplet) {
                body += '<path '+(below ? 'data-tuplet-position="below" transform="translate(8.75 45) scale(.7)" ' : '')+'d="M33 3 C41 -1 42 7 36 7 C43 7 42 15 33 11" fill="none" stroke="black" stroke-width="1.6"/>';
                if (!beamed) body += '<path d="M9 12 V7 H28 M46 7 H68 V12" fill="none" stroke="black" stroke-width="1.2"/>';
            }
        }
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' '+height+'" width="'+width+'" height="'+height+'">'+body+'</svg>';
        const english = typeof document !== 'undefined' && /^en\b/i.test(document.documentElement?.lang || '');
        const label = labels[kind][english ? 1 : 0], extra = kind === 'gm325-example' ? ' gm-score-example-gm325' : kind === 'rs651-example' || kind === 'rs782-example' ? ' rs-score-example-'+kind.slice(0,5) : kind === 'gm1550-example' ? ' gm-score-example-gm1550' : kind.startsWith('motif-') ? ' gm-score-example-'+(kind === 'motif-two' ? 'two' : 'one') : kind === 'eighth-triplet-below' ? ' gm-triplet-below' : '';
        return '<img class="gm-music-notation'+extra+'" data-notation="'+kind+'" src="data:image/svg+xml,'+encodeURIComponent(svg)+'" width="'+width+'" height="'+height+'" alt="'+escape(label)+'" aria-label="'+escape(label)+'" title="'+escape(fallback)+'">';
    }
    function scoreExampleHtml(kind,text) {
        const image=notationImage(kind,typeof stripScoreExampleTokens==='function'?stripScoreExampleTokens(text).trim():String(text));
        return kind==='rs651-example'||kind==='gm325-example' ? '<span class="rs-score-example-scroll" tabindex="0" role="region" aria-label="'+escape(labels[kind][/^en\b/i.test(document.documentElement?.lang||'')?1:0])+'">'+image+'</span>' : image;
    }
    function renderMusicNotationDirection(text, termsIndex, row, renderText) {
        const tokenized=typeof renderScoreExampleTokens==='function' ? renderScoreExampleTokens(text,id=>{const kind=tokenKindForRow(row,id);return kind?scoreExampleHtml(kind,text):'';},part=>renderText(part,termsIndex),/^en\b/i.test(document.documentElement?.lang||'')?'en':'ja') : {found:false};
        if(tokenized.found)return tokenized.html;
        const entries = rulesFor(row);
        if (!entries) return renderText(text, termsIndex);
        let parts = [{text:String(text || '')}];
        for (const [token, kind, boundary] of entries) parts = parts.flatMap(part => {
            if (part.html !== undefined) return [part];
            const result = [];
            let last = 0;
            // Literal matching avoids regex syntax; the boundary protects 'trills', etc.
            let index = part.text.indexOf(token);
            while (index >= 0) {
                const adjacent = (part.text[index-1] || '') + (part.text[index+token.length] || '');
                if (boundary !== 'word' || !/[a-zA-Z0-9äöüßÄÖÜ]/.test(adjacent)) {
                    result.push({text:part.text.slice(last,index)},{html:notationImage(kind,token)});
                    last = index + token.length;
                }
                index = part.text.indexOf(token,index+token.length);
            }
            result.push({text:part.text.slice(last)});
            return result;
        });
        const rendered = parts.map(part => part.html === undefined ? renderText(part.text, termsIndex) : part.html).join('');
        const example = scoreExampleKind(row);
        // A score belongs in both the complete German source and its translation.
        // Keep all canonical text/search keys intact; never append to a partial text fragment.
        const source = row.de ?? row[0];
        const comparable=value=>(typeof stripScoreExampleTokens==='function'?stripScoreExampleTokens(value):String(value)).normalize('NFC').trim();
        const isSource = source !== undefined && comparable(text) === comparable(source);
        const isTranslation = [row.ja, row.en, row[2]].some(value => value !== undefined && comparable(text) === comparable(value));
        if (!example || !(isSource || isTranslation)) return rendered;
        return rendered+' '+scoreExampleHtml(example,text);
    }
    window.renderMusicNotationDirection = renderMusicNotationDirection;
    window.hasMusicNotationForRow = row => !!rulesFor(row);
    window.highlightMusicNotationResult = (html, regex) => html.split(/(<[^>]*>)/g)
        .map((part, i) => i % 2 ? part : part.replace(regex, '<span style="color: red;">$1</span>')).join('');
}());
