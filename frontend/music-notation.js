// Display only: preserve the Sheet's Unicode/German source and search keys.
(function () {
    'use strict';
    const examples = kind => ['[Notenbeispiel]', '［譜例］', '[譜例]', '[musical example]'].map(text => [text, kind]);
    const variants = (text, kind) => [...new Set([text, text.normalize('NFC'), text.normalize('NFD')])].map(value => [value, kind]);
    const rules = {
        'M-5-3-136-dir&': examples('motif-two'),
        'M-5-3-283-all&': examples('motif-one'),
        'M-2-5-78-hr&M-2-5-79-ob,cl&': [['[dachförmigem Akzentzeichen mit Querstrich darunter]', 'roof']],
        'M-7-5-196-all&': [['𝄐 V', 'fermata-v']],
        'M-4-3-283-all&': [...variants('𝅘𝅥', 'quarter'), ...variants('𝅗𝅥𝅭', 'dotted-half')],
        'M-d-d01-16-all&M-d-d01-92-all&': [...variants('𝅘𝅥𝅘𝅥𝅘𝅥', 'quarters'), ['[Vierteltriole]', 'quarter-triplet']],
        'M-3-2-50-all&': [...variants('𝅘𝅥𝅮𝅘𝅥𝅮𝅘𝅥𝅮', 'eighths'), ['[Achteltriole]', 'eighth-triplet']]
    };
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
    function rulesFor(row) {
        const key = notationContextKey(row), data = String(row?.data || row?.[3] || '');
        return contexts.get(key) || (Object.hasOwn(rules,data) ? rules[data] : undefined);
    }
    const labels = {
        half: ['二分音符', 'Half note'],
        whole: ['全音符', 'Whole note'],
        eighth: ['八分音符', 'Eighth note'],
        'dotted-quarter': ['付点四分音符', 'Dotted quarter note'],
        fermata: ['フェルマータ記号', 'Fermata sign'],
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
    function notationImage(kind, fallback) {
        let width = 76, height = 48, body = '';
        if (kind.startsWith('motif-')) {
            ({width, height, body} = motifSvg(kind === 'motif-two'));
        } else if (kind === 'roof') {
            width = 37;
            body = '<path d="M7 26 L18 9 L29 26 M7 32 H29" fill="none" stroke="black" stroke-width="2.3"/>';
        } else if (kind === 'fermata-v') {
            width = 70;
            body = '<path d="M5 28 C8 7 31 7 34 28 M45 11 L54 31 L64 11" fill="none" stroke="black" stroke-width="2.3"/><circle cx="19.5" cy="27" r="2.5"/>';
        } else if (kind === 'fermata') {
            width = 39;
            body = '<path d="M5 28 C8 7 31 7 34 28" fill="none" stroke="black" stroke-width="2.3"/><circle cx="19.5" cy="27" r="2.5"/>';
        } else if (kind === 'whole') {
            width = 33;
            body = '<ellipse data-note="whole" cx="16" cy="31" rx="9" ry="5" fill="white" stroke="black" stroke-width="2"/>';
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
            body = '<ellipse data-note="'+(openHead ? 'half' : kind === 'eighth' ? 'eighth' : 'quarter')+'" cx="12" cy="36" rx="6" ry="4" transform="rotate(-20 12 36)" fill="'+(openHead ? 'white' : 'black')+'" stroke="black" stroke-width="1.8"/><path d="M17 35 V9" fill="none" stroke="black" stroke-width="1.7"/>';
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
        const english = typeof document !== 'undefined' && /^en\b/i.test(document.documentElement.lang || '');
        const label = labels[kind][english ? 1 : 0], extra = kind.startsWith('motif-') ? ' gm-score-example-'+(kind === 'motif-two' ? 'two' : 'one') : kind === 'eighth-triplet-below' ? ' gm-triplet-below' : '';
        return '<img class="gm-music-notation'+extra+'" data-notation="'+kind+'" src="data:image/svg+xml,'+encodeURIComponent(svg)+'" width="'+width+'" height="'+height+'" alt="'+escape(label)+'" aria-label="'+escape(label)+'" title="'+escape(fallback)+'">';
    }
    function renderMusicNotationDirection(text, termsIndex, row, renderText) {
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
        return parts.map(part => part.html === undefined ? renderText(part.text, termsIndex) : part.html).join('');
    }
    window.renderMusicNotationDirection = renderMusicNotationDirection;
    window.hasMusicNotationForRow = row => !!rulesFor(row);
    window.highlightMusicNotationResult = (html, regex) => html.split(/(<[^>]*>)/g)
        .map((part, i) => i % 2 ? part : part.replace(regex, '<span style="color: red;">$1</span>')).join('');
}());
