(function () {
    'use strict';

    const SEARCH_PAGE_PATHS = Object.freeze({
        'mahler.html': '/gaswebapp-manual/mahler-search-app/mahler.html',
        'terms_search.html': '/gaswebapp-manual/mahler-search-app/terms_search.html',
        'rs_terms_search.html': '/gaswebapp-manual/mahler-search-app/rs_terms_search.html',
        'rw_terms_search.html': '/gaswebapp-manual/mahler-search-app/rw_terms_search.html',
        'richard_strauss.html': '/gaswebapp-manual/mahler-search-app/richard_strauss.html',
        'richard_wagner.html': '/gaswebapp-manual/mahler-search-app/richard_wagner.html'
    });

    function normalizeAnalyticsPath(pathname) {
        const path = String(pathname || '').split(/[?#]/, 1)[0] || '/';
        if (path === '/') return '/';
        if (path === '/gaswebapp-manual' || path === '/gaswebapp-manual/') {
            return '/gaswebapp-manual/';
        }
        return `/${path.replace(/^\/+|\/+$/g, '')}`;
    }

    function getAnalyticsPagePath() {
        const canonical = document.querySelector('link[rel="canonical"][href]');
        if (canonical) {
            try {
                return normalizeAnalyticsPath(new URL(canonical.href, window.location.href).pathname);
            } catch (error) {
                // Fall back to the browser path below.
            }
        }
        return normalizeAnalyticsPath(window.location.pathname);
    }

    function getSearchDestinationPath(url) {
        let filename = url.pathname.split('/').filter(Boolean).pop() || '';
        if (!SEARCH_PAGE_PATHS[filename]) {
            const gasPage = url.searchParams.get('page');
            if (gasPage) {
                filename = gasPage.endsWith('.html') ? gasPage : `${gasPage}.html`;
            }
        }
        return SEARCH_PAGE_PATHS[filename] || '';
    }

    function installSearchPageMoveTracking() {
        if (window.__searchPageMoveTrackingInstalled) return;
        window.__searchPageMoveTrackingInstalled = true;

        document.addEventListener('click', function (event) {
            if (event.defaultPrevented) return;

            const link = event.target.closest && event.target.closest('a[href]');
            if (!link || link.hasAttribute('download')) return;

            const rawHref = link.getAttribute('href');
            if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:')) return;

            try {
                const destinationUrl = new URL(link.href, window.location.href);
                const isSupportedOrigin =
                    destinationUrl.origin === window.location.origin ||
                    destinationUrl.hostname === 'yutaka-okawachi.github.io';
                if (!isSupportedOrigin) return;

                const destinationPage = getSearchDestinationPath(destinationUrl);
                if (!destinationPage || typeof window.gtag !== 'function') return;

                const searchTerm = String(destinationUrl.searchParams.get('q') || '').trim();
                const linkType = searchTerm
                    ? (link.classList.contains('composer-link') ? 'example_search' : 'prefilled_search')
                    : 'search_navigation';
                const payload = {
                    source_page: getAnalyticsPagePath(),
                    destination_page: destinationPage,
                    link_type: linkType
                };
                if (searchTerm) {
                    payload.search_term = searchTerm;
                }

                // This click sends only the movement event. Search-result events are
                // sent later, after the destination page finishes the actual search.
                window.gtag('event', 'search_page_move', payload);
            } catch (error) {
                // Analytics must never prevent navigation.
            }
        });
    }

    window.getAnalyticsPagePath = getAnalyticsPagePath;
    installSearchPageMoveTracking();
})();
