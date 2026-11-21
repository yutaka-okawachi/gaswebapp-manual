'use strict';

const { sha256 } = require('./core');

// GAS and sync/authentication code changes require live API verification.
// Generated sync_build.js and dictionary data alone do not.
const dashboardPaths = new Set([
    '.claspignore',
    '.gitignore',
    'sync-data.ps1',
    'scripts/setup-successor.ps1',
    'scripts/verify-dashboard.ps1',
    'scripts/dashboard-api-check.ps1'
]);
const DASHBOARD_CHECK_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isDashboardDependency(file) {
    if (file === 'src/sync_build.js') return false;
    return file.startsWith('src/') || file.startsWith('scripts/sync/') || dashboardPaths.has(file);
}

// Save only a digest in ignored .sync-state, never raw secrets or URLs.
function dashboardSettingsHash(settings) {
    if (!settings || ![settings.GAS_DEPLOY_URL, settings.DASHBOARD_API_TOKEN, settings.GAS_SECRET_TOKEN]
        .every(value => typeof value === 'string' && value.length > 0)) return '';
    return sha256(JSON.stringify([
        'dashboard-settings-v1', settings.GAS_DEPLOY_URL,
        settings.DASHBOARD_API_TOKEN, settings.GAS_SECRET_TOKEN
    ]));
}

function dashboardCheckFresh(check, settingsHash, now = Date.now()) {
    if (!check || typeof settingsHash !== 'string' || !/^[a-f0-9]{64}$/.test(settingsHash) ||
        check.settingsHash !== settingsHash || typeof check.verifiedAt !== 'string') return false;
    const verified = Date.parse(check.verifiedAt);
    return Number.isFinite(verified) && Number.isFinite(now) && verified <= now &&
        now - verified < DASHBOARD_CHECK_MAX_AGE_MS;
}

function dashboardVerificationRequired(lastSuccess, candidate, remote, git) {
    const isCommit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
    const baseline = lastSuccess && lastSuccess.commit;
    if (!lastSuccess || !isCommit(baseline) || !isCommit(candidate) || !isCommit(remote) ||
        typeof lastSuccess.releaseId !== 'string' || !lastSuccess.releaseId.trim() ||
        typeof lastSuccess.verifiedAt !== 'string' || !Number.isFinite(Date.parse(lastSuccess.verifiedAt))) return true;
    try {
        if (git('merge-base', '--is-ancestor', baseline, remote) !== '' ||
            git('merge-base', '--is-ancestor', baseline, candidate) !== '') return true;
        const changed = git('diff', '--name-only', '--no-renames', '-z', baseline, candidate, '--');
        if (typeof changed !== 'string' || (changed && !changed.endsWith('\0'))) return true;
        return changed.split('\0').some(isDashboardDependency);
    } catch (_) {
        return true;
    }
}

function receiptNeedsDashboard(receipt) {
    if (!receipt) return true;
    return typeof receipt.dashboardRequired === 'boolean' ? receipt.dashboardRequired : !receipt.documentsOnly;
}

module.exports = { dashboardVerificationRequired, receiptNeedsDashboard, dashboardSettingsHash,
    dashboardCheckFresh, isDashboardDependency, DASHBOARD_CHECK_MAX_AGE_MS };

