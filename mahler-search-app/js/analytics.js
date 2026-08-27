(function () {
    'use strict';

    const GA_MEASUREMENT_ID = 'G-ZT6MPW5MNG';
    const ADMIN_DEVICE_KEY = 'gmt_admin_device_optout';
    const DICTIONARY_EXAMPLE_TIMING_KEY = 'gmt_dictionary_example_timing';
    const SEARCH_PAGE_PATHS = Object.freeze({
        'mahler.html': '/gaswebapp-manual/mahler-search-app/mahler.html',
        'terms_search.html': '/gaswebapp-manual/mahler-search-app/terms_search.html',
        'rs_terms_search.html': '/gaswebapp-manual/mahler-search-app/rs_terms_search.html',
        'rw_terms_search.html': '/gaswebapp-manual/mahler-search-app/rw_terms_search.html',
        'richard_strauss.html': '/gaswebapp-manual/mahler-search-app/richard_strauss.html',
        'richard_wagner.html': '/gaswebapp-manual/mahler-search-app/richard_wagner.html'
    });

    function storageAvailable() {
        try {
            const testKey = '__gmt_storage_test__';
            window.localStorage.setItem(testKey, '1');
            window.localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            return false;
        }
    }

    const canUseStorage = storageAvailable();

    function setAdminDeviceOptOut(enabled) {
        if (!canUseStorage) return false;
        try {
            if (enabled) {
                window.localStorage.setItem(ADMIN_DEVICE_KEY, '1');
            } else {
                window.localStorage.removeItem(ADMIN_DEVICE_KEY);
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    function isAdminDeviceOptOut() {
        if (!canUseStorage) return false;
        try {
            return window.localStorage.getItem(ADMIN_DEVICE_KEY) === '1';
        } catch (error) {
            return false;
        }
    }

    function applyAdminDeviceUrlCommand() {
        try {
            const params = new URLSearchParams(window.location.search);
            const adminValue = params.get('admin');
            if (adminValue === '1') {
                setAdminDeviceOptOut(true);
            } else if (adminValue === '0') {
                setAdminDeviceOptOut(false);
            }
        } catch (error) {
            // URL handling must never block the page.
        }
    }

    function disableGoogleAnalyticsForAdminDevice() {
        if (!isAdminDeviceOptOut()) return;
        window[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
        window.__gaAdminOptOut = true;
    }

    function installAdminModeBadge() {
        if (!isAdminDeviceOptOut() || document.getElementById('admin-device-optout-badge')) return;
        const badge = document.createElement('div');
        badge.id = 'admin-device-optout-badge';
        badge.textContent = '管理者モード：解析・検索記録 OFF';
        badge.setAttribute('role', 'status');
        badge.style.position = 'fixed';
        badge.style.right = '10px';
        badge.style.bottom = '10px';
        badge.style.zIndex = '2147483647';
        badge.style.padding = '6px 10px';
        badge.style.borderRadius = '999px';
        badge.style.background = 'rgba(37, 37, 37, 0.88)';
        badge.style.color = '#fff';
        badge.style.fontSize = '12px';
        badge.style.lineHeight = '1.4';
        badge.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.25)';
        badge.style.pointerEvents = 'none';
        document.body.appendChild(badge);
    }

    function wrapSearchNotificationForAdminDevice() {
        if (!isAdminDeviceOptOut()) return false;
        if (typeof window.sendSearchNotification !== 'function') return false;
        if (window.sendSearchNotification.__adminOptOutWrapped) return true;

        const originalSendSearchNotification = window.sendSearchNotification;
        window.sendSearchNotification = async function adminOptOutSendSearchNotification(details, pageName) {
            console.info('管理者モードのため，検索通知・検索履歴記録を送信しません。', { details, pageName });
            return undefined;
        };
        window.sendSearchNotification.__adminOptOutWrapped = true;
        window.sendSearchNotification.__originalSendSearchNotification = originalSendSearchNotification;
        return true;
    }

    function installAdminSearchNotificationGuard() {
        if (!isAdminDeviceOptOut()) return;
        wrapSearchNotificationForAdminDevice();
        window.setTimeout(wrapSearchNotificationForAdminDevice, 0);
        window.setTimeout(wrapSearchNotificationForAdminDevice, 250);
        window.setTimeout(wrapSearchNotificationForAdminDevice, 1000);
    }

    applyAdminDeviceUrlCommand();
    disableGoogleAnalyticsForAdminDevice();

    window.isAdminDeviceOptOut = isAdminDeviceOptOut;
    window.setAdminDeviceOptOut = function (enabled) {
        const changed = setAdminDeviceOptOut(Boolean(enabled));
        disableGoogleAnalyticsForAdminDevice();
        return changed;
    };

    document.addEventListener('DOMContentLoaded', function () {
        disableGoogleAnalyticsForAdminDevice();
        installAdminModeBadge();
        installAdminSearchNotificationGuard();
    });
    window.addEventListener('load', installAdminSearchNotificationGuard);

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
            if (event.defaultPrevented || isAdminDeviceOptOut()) return;

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
                if (!destinationPage) return;

                const searchTerm = String(destinationUrl.searchParams.get('q') || '').trim();
                const linkType = searchTerm
                    ? (link.classList.contains('composer-link') ? 'example_search' : 'prefilled_search')
                    : 'search_navigation';
                if (linkType === 'example_search') {
                    try {
                        window.sessionStorage.setItem(DICTIONARY_EXAMPLE_TIMING_KEY, JSON.stringify({
                            startedAt: Date.now(),
                            destinationPage: destinationPage,
                            searchTerm: searchTerm
                        }));
                    } catch (error) {
                        // Timing is optional and must never prevent navigation.
                    }
                }
                if (typeof window.gtag !== 'function') return;
                const payload = {
                    source_page: getAnalyticsPagePath(),
                    destination_page: destinationPage,
                    link_type: linkType
                };
                if (searchTerm) {
                    payload.search_term = searchTerm;
                }

                window.gtag('event', 'search_page_move', payload);
            } catch (error) {
                // Analytics must never prevent navigation.
            }
        });
    }

    window.getAnalyticsPagePath = getAnalyticsPagePath;
    installSearchPageMoveTracking();
})();
