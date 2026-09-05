const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { root, run } = require('./sync/core');
function check() {
    for (const dir of ['src', 'frontend', 'mahler-search-app/js', 'scripts/sync']) {
        for (const file of fs.readdirSync(path.join(root, dir)).filter(file => file.endsWith('.js'))) {
            new vm.Script(fs.readFileSync(path.join(root, dir, file), 'utf8'), { filename: dir + '/' + file });
        }
    }
    for (const file of fs.readdirSync(path.join(root, 'scripts')).filter(file => /^test-.*\.js$/.test(file)).sort()) {
        process.stdout.write(run(process.execPath, ['scripts/' + file]));
    }
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'pwsh';
    process.stdout.write(run(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/test-dashboard-api-check.ps1']));
    console.log('ローカル検証に成功しました。');
}
if (require.main === module) check();
module.exports = { check };
