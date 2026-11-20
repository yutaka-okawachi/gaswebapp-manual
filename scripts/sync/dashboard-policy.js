'use strict';

// Tracked dashboard contract dependencies. The generated GAS fingerprint is not one.
const dashboardPaths = new Set([
    '.claspignore',
    'src/dashboard_analytics.js',
    'src/web_trigger.js',
    'src/mahler_server.js',
    'src/appsscript.json',
    'src/setup_credentials.js',
    'src/sheet_column_layout.js',
    'src/notes_registration.js',
    'src/manage_deploy.js',
    'src/update_env.js',
    'scripts/sync/gas.js',
    'scripts/setup-successor.ps1',
    'scripts/verify-dashboard.ps1',
    'scripts/dashboard-api-check.ps1'
]);

function dashboardVerificationRequired(lastSuccess, candidate, remote, git) {
    const isCommit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
    const baseline = lastSuccess && lastSuccess.commit;
    if (!lastSuccess || !isCommit(baseline) || !isCommit(candidate) || !isCommit(remote) ||
        typeof lastSuccess.releaseId !== 'string' || !lastSuccess.releaseId.trim() ||
        typeof lastSuccess.verifiedAt !== 'string' || !Number.isFinite(Date.parse(lastSuccess.verifiedAt))) return true;
    try {
        // The core git() throws on nonzero status (including a non-ancestor).
        if (git('merge-base', '--is-ancestor', baseline, remote) !== '' ||
            git('merge-base', '--is-ancestor', baseline, candidate) !== '') return true;
        const changed = git('diff', '--name-only', '--no-renames', '-z', baseline, candidate, '--');
        if (typeof changed !== 'string' || (changed && !changed.endsWith('\0'))) return true;
        return changed.split('\0').some(file => dashboardPaths.has(file));
    } catch (_) {
        return true;
    }
}

function receiptNeedsDashboard(receipt) {
    if (!receipt) return true;
    return typeof receipt.dashboardRequired === 'boolean' ? receipt.dashboardRequired : !receipt.documentsOnly;
}

module.exports = { dashboardVerificationRequired, receiptNeedsDashboard };
