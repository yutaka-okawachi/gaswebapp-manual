// Display only: keep the Sheet's readable German and search keys unchanged.
(function () {
    'use strict';
    const rules = {
        'M-2-5-78-hr&M-2-5-79-ob,cl&': [['[dachförmigem Akzentzeichen mit Querstrich darunter]', 'roof']],
        'M-7-5-196-all&': [['𝄐 V', 'fermata-v']],
        'M-d-d01-16-all&M-d-d01-92-all&': [['𝅘𝅥𝅘𝅥𝅘𝅥', 'quarters'], ['[Vierteltriole]', 'quarter-triplet']],
        'M-3-2-50-all&': [['𝅘𝅥𝅮𝅘𝅥𝅮𝅘𝅥𝅮', 'eighths'], ['[Achteltriole]', 'eighth-triplet']]
    };
    const labels = {
        roof: ['山形アクセントとその下の横線', 'Roof-shaped accent with a horizontal line underneath'],
        'fermata-v': ['フェルマータとV記号の並置', 'Fermata followed by a V-shaped sign'],
        quarters: ['通常の四分音符3個', 'Three ordinary quarter notes'],
        'quarter-triplet': ['四分音符3個の三連符1組', 'One triplet group of three quarter notes'],
        eighths: ['一本の連桁で結んだ通常の八分音符3個', 'Three ordinary eighth notes with one beam'],
        'eighth-triplet': ['一本の連桁で結んだ八分音符3個の三連符1組', 'One triplet group of three eighth notes with one beam']
    };
    const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function notationImage(kind, fallback) {
        let width = 76, body = '';
        if (kind === 'roof') {
            width = 37;
            body = '<path d="M7 26 L18 9 L29 26 M7 32 H29" fill="none" stroke="black" stroke-width="2.3"/>';
        } else if (kind === 'fermata-v') {
            width = 70;
            body = '<path d="M5 28 C8 7 31 7 34 28 M45 11 L54 31 L64 11" fill="none" stroke="black" stroke-width="2.3"/><circle cx="19.5" cy="27" r="2.5"/>';
        } else {
            const triplet = kind.endsWith('triplet'), beamed = kind.startsWith('eighth');
            for (const x of [12, 35, 58]) body += '<ellipse cx="'+x+'" cy="39" rx="6" ry="4" transform="rotate(-20 '+x+' 39)"/><path d="M'+(x+5)+' 38 V17" fill="none" stroke="black" stroke-width="1.7"/>';
            if (beamed) body += '<path d="M17 17 H63" fill="none" stroke="black" stroke-width="4"/>';
            if (triplet) {
                // A path-drawn 3 avoids any music or text font dependency.
                body += '<path d="M33 3 C41 -1 42 7 36 7 C43 7 42 15 33 11" fill="none" stroke="black" stroke-width="1.6"/>';
                if (!beamed) body += '<path d="M9 12 V7 H28 M46 7 H68 V12" fill="none" stroke="black" stroke-width="1.2"/>';
            }
        }
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+width+' 48" width="'+width+'" height="48">'+body+'</svg>';
        const english = typeof document !== 'undefined' && /^en\b/i.test(document.documentElement.lang || '');
        const label = labels[kind][english ? 1 : 0];
        return '<img class="gm-music-notation" data-notation="'+kind+'" src="data:image/svg+xml,'+encodeURIComponent(svg)+'" width="'+width+'" height="48" alt="'+escape(label)+'" aria-label="'+escape(label)+'" title="'+escape(fallback)+'">';
    }
    function renderMusicNotationDirection(text, termsIndex, row, renderText) {
        const entries = rules[String(row.data || row[3] || '')];
        if (!entries) return renderText(text, termsIndex);
        let parts = [{text:String(text || '')}];
        for (const [token, kind] of entries) parts = parts.flatMap(part => {
            if (part.html !== undefined) return [part];
            const chunks = part.text.split(token), result = [];
            chunks.forEach((chunk, i) => {
                if (i) result.push({html:notationImage(kind, token)});
                result.push({text:chunk});
            });
            return result;
        });
        return parts.map(part => part.html === undefined ? renderText(part.text, termsIndex) : part.html).join('');
    }
    window.renderMusicNotationDirection = renderMusicNotationDirection;
    // Search highlighting must never rewrite SVG URLs, dimensions, or labels.
    window.highlightMusicNotationResult = (html, regex) => html.split(/(<[^>]*>)/g)
        .map((part, i) => i % 2 ? part : part.replace(regex, '<span style="color: red;">$1</span>')).join('');
}());
