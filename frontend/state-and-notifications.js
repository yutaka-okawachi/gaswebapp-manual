// app.js


// Global state to hold loaded data (guarded to avoid shadowing inline window.appData)
window.appData = window.appData || {
    mahler: null,
    richard_strauss: null,
    richard_wagner: null,
    rs_scenes: null,
    rw_scenes: null,
    dic_notes: null,
    abbr_list: null
};

// --- Configuration ---
// TODO: Replace with your deployed Web App URL
const GAS_NOTIFICATION_URL = 'https://script.google.com/macros/s/AKfycbzFD2EDHfECX0yK3cP0toN5zJRpcCNMO9HiEBM7WrD_9fX8N5bjHo9IYtEEXu_fsifO4Q/exec';
const DICTIONARY_EXAMPLE_TIMING_KEY = 'gmt_dictionary_example_timing';
const DICTIONARY_EXAMPLE_TIMING_MAX_AGE_MS = 5 * 60 * 1000;

function consumeDictionaryExampleTiming(searchTerm, destinationPage) {
    try {
        const stored = JSON.parse(window.sessionStorage.getItem(DICTIONARY_EXAMPLE_TIMING_KEY) || 'null');
        if (!stored || typeof stored.startedAt !== 'number') return null;

        const elapsedMilliseconds = Math.round(Date.now() - stored.startedAt);
        const matchesRequest =
            stored.searchTerm === searchTerm &&
            stored.destinationPage === destinationPage;
        window.sessionStorage.removeItem(DICTIONARY_EXAMPLE_TIMING_KEY);
        if (
            !matchesRequest ||
            elapsedMilliseconds < 0 ||
            elapsedMilliseconds > DICTIONARY_EXAMPLE_TIMING_MAX_AGE_MS
        ) {
            return null;
        }
        return elapsedMilliseconds;
    } catch (error) {
        return null;
    }
}

function getSearchResultCount(options) {
    if (options && Number.isInteger(options.resultCount) && options.resultCount >= 0) {
        return options.resultCount;
    }

    const root = options && options.resultRoot;
    if (!root || typeof root.querySelectorAll !== 'function') return null;

    const text = (root.textContent || '').replace(/\s+/g, ' ').trim();
    const countMatch = text.match(/(\d[\d,]*)\s*件\s*(?:見つかりました|ありました|該当しました)/);
    if (countMatch) return Number(countMatch[1].replace(/,/g, ''));

    const entryCount = Math.max(
        root.querySelectorAll('.result-entry').length,
        root.querySelectorAll('.search-result-item').length
    );
    if (entryCount > 0) return entryCount;

    if (/(?:該当する[^。]*?(?:見つかりません|ありません)|検索結果[^。]*?(?:見つかりません|ありません)|0\s*件)/.test(text)) {
        return 0;
    }
    return null;
}
window.getSearchResultCount = getSearchResultCount;

function trackSearchResults(options) {
    if (typeof window.gtag !== 'function' || !options) return false;

    const searchTerm = String(options.searchTerm || '').trim();
    const searchType = String(options.searchType || '').trim();
    if (!searchTerm || !searchType) return false;

    const resultCount = getSearchResultCount(options);
    if (resultCount === null) return false;

    const payload = Object.assign({}, options.params || {}, {
        search_term: searchTerm,
        search_type: searchType,
        result_count: resultCount,
        source_page: typeof window.getAnalyticsPagePath === 'function'
            ? window.getAnalyticsPagePath()
            : window.location.pathname
    });
    window.gtag('event', resultCount > 0 ? 'view_search_results' : 'search_no_results', payload);

    const urlParams = new URLSearchParams(window.location.search);
    if (
        resultCount > 0 &&
        urlParams.get('source') === 'dictionary_example' &&
        !window.__dictionaryExampleResultTracked
    ) {
        window.__dictionaryExampleResultTracked = true;
        const destinationPage = typeof window.getAnalyticsPagePath === 'function'
            ? window.getAnalyticsPagePath()
            : window.location.pathname;
        const examplePayload = Object.assign({}, payload, {
            term: searchTerm,
            source_page: '/gaswebapp-manual/mahler-search-app/dic.html',
            destination_page: destinationPage
        });
        window.gtag('event', 'view_example_search_results', examplePayload);

        const elapsedMilliseconds = consumeDictionaryExampleTiming(searchTerm, destinationPage);
        if (elapsedMilliseconds !== null) {
            window.gtag('event', 'dictionary_example_timing', Object.assign({}, examplePayload, {
                value: elapsedMilliseconds,
                duration_ms: elapsedMilliseconds
            }));
        }
    }
    return true;
}
window.trackSearchResults = trackSearchResults;

function escapeRegExpLiteral(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createTermHighlightRegex(normalizedQuery, matchMode) {
    let pattern = escapeRegExpLiteral(normalizedQuery);
    pattern = pattern.split('ae').join('(?:ae|ä)');
    pattern = pattern.split('oe').join('(?:oe|ö)');
    pattern = pattern.split('ue').join('(?:ue|ü)');
    pattern = pattern.split('ss').join('(?:ss|ß)');
    if (matchMode === 'exact') {
        return new RegExp(`(?<![\\p{L}\\p{N}])(${pattern})(?![\\p{L}\\p{N}])(?![^<]*>)`, 'giu');
    }
    return new RegExp(`(${pattern})(?![^<]*>)`, 'gi');
}
window.createTermHighlightRegex = createTermHighlightRegex;


window.matchesTermQuery = matchesTermQuery;

/**
 * Sends a search notification to the Google Apps Script Web App.
 * @param {Object} details - The search details { work, scope, term }.
 * @param {string} pageName - The name of the page where the search was performed.
 */
async function sendSearchNotification(details, pageName) {
    if (window.__LOCAL_PREVIEW__) return;
    if (GAS_NOTIFICATION_URL === 'YOUR_GAS_WEB_APP_URL_HERE' || !GAS_NOTIFICATION_URL) {
        console.warn('GAS_NOTIFICATION_URL is not set. Notification skipped.');
        return;
    }

    try {
        await fetch(GAS_NOTIFICATION_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                work: details.work,
                scope: details.scope,
                term: details.term,
                page: pageName,
                userAgent: navigator.userAgent,
                includeGlobal: details.includeGlobal || false
            })
        });
        console.log('Search notification sent');
    } catch (e) {
        console.error('Failed to send search notification', e);
    }
}
