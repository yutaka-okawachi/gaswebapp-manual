const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { root, run } = require('./sync/core');
const timing = require('./sync/timing');
function check() {
    timing.measure('syntax-checks', () => {
        for (const dir of ['src', 'frontend', 'mahler-search-app/js', 'scripts/sync']) {
            for (const file of fs.readdirSync(path.join(root, dir)).filter(file => file.endsWith('.js'))) {
                new vm.Script(fs.readFileSync(path.join(root, dir, file), 'utf8'), { filename: dir + '/' + file });
            }
        }
    });
    // Successful child output is a developer summary; timing supplies the Japanese progress.
    // run() still throws with the original error details when any check fails.
    for (const file of fs.readdirSync(path.join(root, 'scripts')).filter(file => /^test-.*\.js$/.test(file)).sort()) {
        timing.measure('test:' + file, () => run(process.execPath, ['scripts/' + file]));
    }
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
    timing.measure('test:test-dashboard-api-check.ps1', () =>
        run(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/test-dashboard-api-check.ps1']));
    console.log('[完了] ローカル検証に成功しました。');
}
if (require.main === module) {
    timing.start('Local');
    let outcome = 'success';
    try { check(); } catch (error) { outcome = 'failure'; throw error; }
    finally { timing.end(outcome); }
}
module.exports = { check };
