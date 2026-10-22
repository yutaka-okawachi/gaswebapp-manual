'use strict';
// Sheet A=work abbreviation, B=Japanese Drive PDF, C=English Drive PDF.
// URLs are source data; never guess an English file or fall back to a Japanese PDF.
const fs = require('fs'), path = require('path'), vm = require('vm');
function pdfId(value, allowEmpty = false) {
    const text = String(value || '').trim();
    if (!text && allowEmpty) return '';
    if (!/^https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)\/view(?:\?[^\s<>"']*)?$/.test(text)) {
        throw Error('synopsis PDF must be a Google Drive file viewing URL');
    }
    return text.match(/\/d\/([^/]+)\//)[1];
}
function validateSource(source) {
    if (source === undefined || source === null) return null; // Existing captured snapshots remain usable.
    if (source.schema !== 1 || !Array.isArray(source.rows)) throw Error('Invalid synopsis source');
    const works = new Set();
    return source.rows.map(row => {
        if (!row || Object.keys(row).some(key => !['work', 'ja', 'en', '__row'].includes(key))) throw Error('Invalid synopsis fields');
        const work = String(row.work || '').normalize('NFC').trim().toLowerCase();
        if (!work || !Object.hasOwn(row, 'ja') || !Object.hasOwn(row, 'en') || /overview|概要/i.test(work)) throw Error('Invalid synopsis work');
        if (works.has(work)) throw Error('Duplicate synopsis work: ' + work);
        works.add(work);
        const ja = String(row.ja || '').trim(), en = String(row.en || '').trim();
        pdfId(ja); pdfId(en, true);
        if (en && pdfId(ja) === pdfId(en)) throw Error('English synopsis cannot reuse the Japanese PDF: ' + work);
        return { work, ja, en };
    });
}
function readBaseMetadata(root) {
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync(path.join(root, 'frontend/score-metadata.js'), 'utf8'), context);
    return JSON.parse(vm.runInContext('JSON.stringify(SCORE_METADATA)', context));
}
function projectMetadata(base, source, language) {
    const rows = validateSource(source), byKey = new Map(), entries = Object.entries(base);
    for (const row of rows || []) {
        const primary = base[row.work];
        const oldId = primary?.synopsis ? pdfId(primary.synopsis) : pdfId(row.ja);
        const matches = entries.filter(([key, meta]) => key === row.work || meta.synopsis && pdfId(meta.synopsis) === oldId);
        if (!matches.length) throw Error('Unknown synopsis work / Japanese PDF: ' + row.work);
        for (const [key] of matches) {
            if (byKey.has(key)) throw Error('Ambiguous synopsis mapping: ' + key);
            byKey.set(key, row);
        }
    }
    const result = {};
    for (const [key, meta] of entries) {
        const row = byKey.get(key);
        result[key] = { ...meta };
        if (meta.synopsis) result[key].synopsis = language === 'en' ? row?.en || '' : row?.ja || meta.synopsis;
    }
    return result;
}
function japaneseBuildMetadata(root, base, source) {
    if (source !== undefined && source !== null) return projectMetadata(base, source, 'ja');
    // The committed Japanese projection is public B-column data. Preserve it on
    // a clean CI checkout without the private authenticated bilingual snapshot.
    // All non-link score fields still come from the current frontend source.
    const result = projectMetadata(base, undefined, 'ja');
    const file = path.join(root, 'mahler-search-app/js/score_metadata.js');
    if (!fs.existsSync(file)) return result;
    const context = vm.createContext({});
    vm.runInContext(fs.readFileSync(file, 'utf8'), context);
    const published = JSON.parse(vm.runInContext('JSON.stringify(SCORE_METADATA)', context));
    for (const [key, meta] of Object.entries(result)) if (meta.synopsis && published[key]?.synopsis) {
        pdfId(published[key].synopsis);
        meta.synopsis = published[key].synopsis;
    }
    return result;
}
function metadataScript(metadata) {
    return '// Generated from frontend/score-metadata.js and the same synopsis snapshot.\nconst SCORE_METADATA = ' + JSON.stringify(metadata, null, 4).replaceAll('<', '\\u003c') + ';\n';
}
function rewriteList(html, base, projected, language) {
    // Only the existing synopsis group is changed; navigation, ordering, labels and layout remain shared.
    return html.replace(/(<div\b[^>]*class="synopsis-links-group"[^>]*>)([^]*?)(<\/div>)/g, (all, start, body, end) => {
        const next = body.replace(/<a\b([^>]*?)href="(https:\/\/drive\.google\.com\/file\/d\/[^"<>]+)"([^>]*)>([^]*?)<\/a>/g,
            (link, before, href, after, label) => {
                const id = pdfId(href.replaceAll('&amp;', '&'));
                const boundKey = (before + after).match(/data-synopsis-work="([^"]+)"/)?.[1];
                const keys = boundKey && base[boundKey] ? [boundKey] : Object.keys(base).filter(key => base[key].synopsis && pdfId(base[key].synopsis) === id);
                if (!keys.length) throw Error('Unmapped synopsis list link: ' + id);
                const urls = [...new Set(keys.map(key => projected[key].synopsis || ''))];
                if (urls.length !== 1) throw Error('Ambiguous synopsis list URL: ' + id);
                if (!urls[0]) return '<span class="synopsis-unavailable" aria-disabled="true">' + label.replace(/\s*↗\s*$/, '') + ' <small>— English synopsis is not yet available.</small></span>';
                const escaped = urls[0].replaceAll('&', '&amp;').replaceAll('"', '&quot;');
                const binding = boundKey ? '' : ' data-synopsis-work="' + keys[0] + '"';
                return '<a' + before + 'href="' + escaped + '"' + after + binding + '>' + label + '</a>';
            });
        return start + next + end;
    }).replace('.synopsis-links-group a {', '.synopsis-links-group a, .synopsis-links-group .synopsis-unavailable {');
}
function sourceFromCache(root) {
    const file = path.join(root, '.sync-state/english/snapshot.json');
    if (!fs.existsSync(file)) return undefined;
    return JSON.parse(fs.readFileSync(file, 'utf8')).englishSource?.synopsis;
}
module.exports = { pdfId, validateSource, readBaseMetadata, projectMetadata, japaneseBuildMetadata, metadataScript, rewriteList, sourceFromCache };
