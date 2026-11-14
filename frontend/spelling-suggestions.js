// Optional, local zero-result suggestions. Never changes a query until a button is clicked.
function spellingDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1,
            d[i - 1][j - 1] + (a[i - 1] !== b[j - 1]));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
            d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
    }
    return d[a.length][b.length];
}
function getSpellingSuggestions(query, notes, termsIndex, data) {
    const q = normalizeString(query);
    if (q.length < 4 || q.length > 40 || !/^\p{Script=Latin}+$/u.test(q)) return [];
    const indexKey = dictionaryTermIndexKey(query);
    if (indexKey && termsIndex && termsIndex[indexKey]) return [];
    // An existing word with no eligible score-page results is not a spelling mistake.
    if ((data || []).some(row => matchesTermQuery(row.de || '', query, 'exact'))) return [];
    const seen = new Set();
    const headings = (notes || []).map(row => row[0]).filter(term =>
        typeof term === 'string' && /^\p{Script=Latin}+$/u.test(term.normalize('NFC')));
    if (headings.some(term => normalizeString(term) === q)) return [];
    return headings.map(term => ({ term, key: normalizeString(term) }))
        .filter(item => Math.abs(item.key.length - q.length) <= (q.length < 8 ? 1 : 2))
        .map(item => ({ ...item, distance: spellingDistance(q, item.key) }))
        .filter(item => item.distance <= (q.length < 8 ? 1 : 2) &&
            item.distance / Math.max(q.length, item.key.length) <= (q.length < 8 ? .25 : .20))
        .sort((a, b) => a.distance - b.distance || a.term.localeCompare(b.term, 'de'))
        .filter(item => !seen.has(item.key) && seen.add(item.key))
        .slice(0, 3).map(item => item.term);
}
let clearSpellingSuggestionListeners = () => {};
window.showSpellingSuggestions = async function (query, resultMeta, dataKey, root, rerun) {
    clearSpellingSuggestionListeners();
    if (!root || resultMeta.resultCount !== 0 || isDictionaryExampleSearch(query)) return;
    const q = normalizeString(query);
    if (q.length < 4 || q.length > 40 || !/^\p{Script=Latin}+$/u.test(q)) return;
    const input = document.getElementById('termInput');
    const mode = document.querySelector('input[name="termMatchMode"]:checked');
    // Attached marker is invalidated by any later result replacement (including cancel/clear).
    const marker = document.createElement('div');
    marker.className = 'spelling-suggestions';
    marker.setAttribute('role', 'status');
    marker.setAttribute('aria-live', 'polite');
    root.appendChild(marker);
    let stale = false;
    const invalidate = () => { stale = true; marker.remove(); };
    input.addEventListener('input', invalidate, { once: true });
    const radios = Array.from(document.querySelectorAll('input[name="termMatchMode"]'));
    radios.forEach(radio => radio.addEventListener('change', invalidate, { once: true }));
    clearSpellingSuggestionListeners = () => {
        invalidate();
        input.removeEventListener('input', invalidate);
        radios.forEach(radio => radio.removeEventListener('change', invalidate));
    };
    try {
        await loadData('notes');
        if (stale || !root.contains(marker) || input.value.trim() !== query ||
            document.querySelector('input[name="termMatchMode"]:checked') !== mode) return;
        const candidates = getSpellingSuggestions(query, window.appData.dic_notes,
            window.appData.dic_terms_index, window.appData[dataKey]);
        if (!candidates.length) { marker.remove(); return; }
        const label = document.createElement('span');
        label.textContent = /^en\b/i.test(document.documentElement.lang || '') ? 'Did you mean? ' : 'もしかして？ ';
        marker.appendChild(label);
        candidates.forEach(term => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = term;
            button.addEventListener('click', () => {
                if (stale || !root.contains(marker) || input.value.trim() !== query) return;
                invalidate();
                input.value = term;
                rerun(); // Existing search owns mode, filters, analytics and notification opt-out.
            });
            marker.appendChild(button);
        });
    } catch (_) {
        marker.remove(); // Optional dictionary load failure must not masquerade as search results.
    } finally {
        // Keep listeners only while the rendered suggestions are actionable.
        if (!root.contains(marker)) {
            input.removeEventListener('input', invalidate);
            radios.forEach(radio => radio.removeEventListener('change', invalidate));
        }
    }
};
