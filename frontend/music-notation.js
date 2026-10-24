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
    // GM358: user-provided footnote photograph (2026-10-24), edition unspecified.
    // GM387: Peters 8951, Symphony 5, printed/PDF p.137; unchanged.
    function motifSvg(two) {
        const width = two ? 292 : 134;
        let body = '<g fill="black" stroke="black" stroke-width="1">';
        for (const y of [38, 44, 50, 56, 62]) body += '<path d="M4 '+y+' H'+(two ? 280 : width)+'" fill="none" stroke-width=".7"/>';
        if (two) body += '<path data-clef="treble" d="M18 62 C7 61 6 49 15 45 C23 40 30 48 25 55 C21 61 12 56 14 50 C16 44 25 40 26 31 C28 22 26 15 23 15 C16 19 17 29 19 40 L26 73 C28 83 17 87 13 79 C10 73 16 69 19 73 C21 76 17 79 15 77" fill="none" stroke-width="2.2" stroke-linecap="round"/>';
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
