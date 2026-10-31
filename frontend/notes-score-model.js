(function (root) {
    'use strict';
    const normalize = value => typeof value === 'string' ? value.normalize('NFC').trim() : '';
    const identity = (heading, source, pdfUrl) => JSON.stringify([normalize(heading), normalize(source), pdfUrl]);
    const validId = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,95}$/.test(value);
    const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
    function pdfUrl(value) {
        if (typeof value !== 'string' || value.length > 8192 || /[\x00-\x20\\]/.test(value)) return null;
        try {
            const url = new URL(value);
            return url.protocol === 'https:' && !url.username && !url.password && /^#page=[1-9][0-9]{0,4}$/.test(url.hash) ? url.href : null;
        } catch (_) { return null; }
    }
    function asset(value) {
        if (!value || typeof value !== 'object' || !/^[a-f0-9]{64}$/.test(value.sha256 || '') ||
            !integer(value.width, 1, 20000) || !integer(value.height, 1, 20000) ||
            typeof value.path !== 'string' || !/^images\/score-pages\/[a-z0-9-]+\/[a-z0-9-]+\.(?:png|webp|jpg)$/.test(value.path)) return null;
        return Object.freeze({path:value.path, width:value.width, height:value.height, sha256:value.sha256});
    }
    function registry(manifest, ledger, options = {}) {
        if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.items) || manifest.items.length > 2000 ||
            !ledger || ledger.schemaVersion !== 1 || !Array.isArray(ledger.records)) throw Error('Invalid score-view manifest or rights ledger');
        const privatePreview = options.mode === 'private-preview';
        const byRecord = new Map();
        for (const record of ledger.records) {
            if (!record || !validId(record.id) || byRecord.has(record.id)) throw Error('Duplicate or invalid rights record');
            byRecord.set(record.id, record);
        }
        const byId = new Map(), byContext = new Map(), ids = new Set();
        for (const item of manifest.items) {
            if (!item || !validId(item.id) || ids.has(item.id)) throw Error('Duplicate or invalid score-view ID');
            ids.add(item.id);
            const heading = normalize(item.match?.heading), source = normalize(item.match?.source);
            if (!heading || heading.length > 2000 || !source || source.length > 1000 || !Array.isArray(item.pages) || !item.pages.length || item.pages.length > 50) throw Error('Invalid stable Notes context');
            const rights = byRecord.get(item.rightsRecordId);
            // Viewing permission and publication permission are separate affirmative decisions.
            const permitted = rights && rights.referenceId === item.id &&
                (privatePreview ? ['private-preview-approved','public-approved'].includes(rights.reviewStatus) && rights.privatePreviewApproved === true : rights.reviewStatus === 'public-approved' && rights.publicReleaseApproved === true);
            if (!permitted) continue;
            if (!Array.isArray(rights.pdfUrls) || !Array.isArray(rights.assetSha256)) throw Error('Incomplete rights/provenance record');
            const pages = [], pageIds = new Set();
            for (const page of item.pages) {
                const url = pdfUrl(page.pdfUrl), full = asset(page.full), excerpt = page.excerpt == null ? null : asset(page.excerpt);
                if (!validId(page.id) || pageIds.has(page.id) || !url || !full || (page.excerpt != null && !excerpt) ||
                    typeof page.printedPage !== 'string' || page.printedPage.length > 80 || !rights.pdfUrls?.includes(url)) throw Error('Invalid, unapproved or incomplete score page');
                if (page.sourcePdfSha256 !== rights.sourcePdfSha256 || !/^[a-f0-9]{64}$/.test(page.sourcePdfSha256 || '')) throw Error('Source PDF provenance mismatch');
                if (![full,excerpt].filter(Boolean).every(image => rights.assetSha256.includes(image.sha256))) throw Error('Image has not been reviewed for this record');
                pageIds.add(page.id);
                const value = Object.freeze({id:page.id, pdfUrl:url, pdfPage:Number(new URL(url).hash.slice(6)), printedPage:page.printedPage, full, excerpt});
                const key = identity(heading, source, url);
                if (byContext.has(key)) throw Error('Ambiguous Notes/PDF mapping');
                byContext.set(key, {id:item.id, index:pages.length});
                pages.push(value);
            }
            const titles = item.title || {};
            if (typeof titles.ja !== 'string' || typeof titles.en !== 'string' || titles.ja.length > 500 || titles.en.length > 500) throw Error('Missing bilingual edition title');
            const credit = item.credit || {ja:'',en:''};
            if (typeof credit.ja !== 'string' || typeof credit.en !== 'string' || credit.ja.length > 1000 || credit.en.length > 1000 || (!privatePreview && (!credit.ja.trim() || !credit.en.trim()))) throw Error('Missing bilingual score source credit');
            byId.set(item.id, Object.freeze({id:item.id, heading, source, title:Object.freeze({ja:titles.ja,en:titles.en}), credit:Object.freeze({ja:credit.ja,en:credit.en}), rightsRecordId:item.rightsRecordId, pages:Object.freeze(pages)}));
        }
        return Object.freeze({
            size:byId.size,
            get:id => byId.get(id) || null,
            match(heading, source, href) {
                const url = pdfUrl(href), matched = url && byContext.get(identity(heading, source, url));
                return matched ? {entry:byId.get(matched.id), index:matched.index} : null;
            }
        });
    }
    function assetUrl(value, assetBase, origin) {
        const checked = asset(value);
        if (!checked) throw Error('Invalid image asset');
        const base = new URL(assetBase);
        if (base.origin !== origin || !/^https?:$/.test(base.protocol) || base.username || base.password || base.search || base.hash || !base.pathname.endsWith('/')) throw Error('Image base must be an explicit same-origin directory');
        const url = new URL(checked.path, base);
        if (url.origin !== origin || !url.pathname.startsWith(base.pathname + 'images/score-pages/')) throw Error('Image outside approved directory');
        url.searchParams.set('v', checked.sha256);
        return url.href;
    }
    const api = Object.freeze({normalize, identity, pdfUrl, asset, registry, assetUrl});
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.NotesScoreModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
