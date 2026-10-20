'use strict';
const siteUrl = 'https://yutaka-okawachi.github.io/gaswebapp-manual/';
const pagePaths = ['', 'mahler-search-app/mahler.html', 'mahler-search-app/dic.html',
    'mahler-search-app/terms_search.html', 'mahler-search-app/rs_terms_search.html',
    'mahler-search-app/rw_terms_search.html', 'mahler-search-app/richard_strauss.html',
    'mahler-search-app/richard_wagner.html', 'mahler-search-app/rs_synopsis.html',
    'mahler-search-app/rw_synopsis.html', 'mahler-search-app/notes.html',
    'mahler-search-app/other.html', 'privacy.html', 'license.html'];
function canonicalPath(file) {
    return ['index.html', 'mahler-search-app/index.html', 'mahler-search-app/home.html'].includes(file) ? '' : file;
}
function canonicalUrl(file, language) {
    const logical = canonicalPath(file);
    if (!pagePaths.includes(logical)) return null;
    return siteUrl + (language === 'en' ? 'en/' : '') + logical;
}
function decorateHtml(html, options = {}) {
    html = html.replace(/<!-- language-seo:start -->[\s\S]*?<!-- language-seo:end -->/g, '');
    const canonical = canonicalUrl(options.file, options.language);
    if (!canonical) return html;
    const tag = '<link rel="canonical" href="' + canonical + '">';
    const canonicalPattern = /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi;
    let inserted = false;
    html = html.replace(canonicalPattern, () => { if (inserted) return ''; inserted = true; return tag; });
    if (!options.local && options.englishEnabled === true) {
        if (!inserted) html = html.replace(/<\/head>/i, tag + '</head>');
        // Redirect aliases keep their root canonical and are omitted from the indexable pairs.
        if (['mahler-search-app/index.html', 'mahler-search-app/home.html'].includes(options.file)) return html;
        const links = ['ja', 'en'].map(language => '<link rel="alternate" hreflang="' + language + '" href="' + canonicalUrl(options.file, language) + '">').join('\n');
        html = html.replace(/<\/head>/i, '<!-- language-seo:start -->' + links + '<!-- language-seo:end --></head>');
    }
    return html;
}
function updateSitemap(xml, changed, today, englishEnabled) {
    const mapping = {
        'mahler.json': ['mahler.html', 'terms_search.html'],
        'richard_wagner.json': ['richard_wagner.html', 'rw_terms_search.html'],
        'richard_strauss.json': ['richard_strauss.html', 'rs_terms_search.html'],
        'rw_scenes.json': ['richard_wagner.html', 'rw_synopsis.html'],
        'rs_scenes.json': ['richard_strauss.html', 'rs_synopsis.html'],
        'dic_notes.json': ['dic.html'], 'abbr_list.json': ['dic.html'], 'dic_terms_index.json': ['dic.html']
    };
    const targets = new Set();
    for (const file of changed) {
        const prefix = file.startsWith('en/') ? 'en/' : '', logical = file.slice(prefix.length);
        if (logical.endsWith('.html') && !logical.startsWith('src/')) targets.add(prefix + canonicalPath(logical));
        else if (logical.startsWith('mahler-search-app/data/')) {
            for (const page of mapping[logical.split('/').pop()] || []) targets.add(prefix + 'mahler-search-app/' + page);
        }
    }
    const existing = new Map();
    let next = xml.replace(/<url>[\s\S]*?<\/url>/g, block => {
        const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
        if (!loc || !loc.startsWith(siteUrl)) return block;
        const file = loc.slice(siteUrl.length);
        if (file.startsWith('en/') && !englishEnabled) return '';
        const result = targets.has(file) ? block.replace(/<lastmod>[^<]*<\/lastmod>/, '<lastmod>' + today + '</lastmod>') : block;
        existing.set(file, result);
        return result;
    });
    if (englishEnabled) {
        const added = [];
        for (const file of pagePaths) {
            if (!existing.has(file)) throw Error('Existing Japanese sitemap entry missing: ' + file);
            if (existing.has('en/' + file)) continue;
            added.push(existing.get(file).replace('<loc>' + siteUrl + file + '</loc>', '<loc>' + siteUrl + 'en/' + file + '</loc>')
                .replace(/<lastmod>[^<]*<\/lastmod>/, '<lastmod>' + today + '</lastmod>'));
        }
        if (added.length) next = next.replace('</urlset>', '  ' + added.join('\n  ') + '\n</urlset>');
    }
    return next;
}
module.exports = { siteUrl, pagePaths, canonicalPath, canonicalUrl, decorateHtml, updateSitemap };
