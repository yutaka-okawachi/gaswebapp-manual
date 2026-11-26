const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseStatus, captureCandidate, assertCommitted, commitChanges } = require('./sync/git');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gmt-candidate-test-'));
const call = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const runGit = (...args) => call(...args).trim();
const getChanged = () => parseStatus(call('status', '--porcelain=v1', '-z', '--untracked-files=all'));
const config = { directory, runGit, getChanged };
const write = (file, value) => fs.writeFileSync(path.join(directory, file), value);
const rejected = /ローカル変更/;

try {
    runGit('init', '-b', 'main');
    runGit('config', 'user.name', 'Fixture');
    runGit('config', 'user.email', 'fixture@example.test');
    runGit('config', 'commit.gpgsign', 'false');
    write('index.html', 'base\n');
    write('privacy.html', 'old\n');
    runGit('add', '.');
    runGit('commit', '-m', 'base');
    const base = runGit('rev-parse', 'HEAD');
    assert.equal(commitChanges('no change', captureCandidate(config), config), base);

    write('index.html', 'pass\n');
    const candidate = captureCandidate(config);
    write('index.html', 'edit\n');
    assert.throws(() => commitChanges('stale content', candidate, config), rejected);
    assert.equal(runGit('rev-parse', 'HEAD'), base);
    assert.equal(fs.readFileSync(path.join(directory, 'index.html'), 'utf8'), 'edit\n');
    assert.equal(runGit('diff', '--cached', '--name-only'), '');

    write('index.html', 'pass\n');
    runGit('add', 'index.html');
    assert.throws(() => commitChanges('stale index', candidate, config), rejected);
    assert.equal(runGit('diff', '--cached', '--name-only'), 'index.html');

    const beforeAddition = captureCandidate(config);
    write('README.md', 'new\n');
    assert.throws(() => commitChanges('stale paths', beforeAddition, config), rejected);
    assert(getChanged().includes('README.md'));

    fs.unlinkSync(path.join(directory, 'privacy.html'));
    const release = commitChanges('validated release', captureCandidate(config), config);
    assert.notEqual(release, base);
    assert.equal(runGit('show', release + ':index.html'), 'pass');
    assert.equal(runGit('show', release + ':README.md'), 'new');
    assert.equal(runGit('ls-tree', release, '--', 'privacy.html'), '');
    assertCommitted(release, config);

    write('index.html', 'next\n');
    const beforeCommitHook = captureCandidate(config);
    const modifiedCommit = (...args) => {
        if (args[0] === 'commit') {
            write('README.md', 'untested\n');
            runGit('add', 'README.md');
        }
        return runGit(...args);
    };
    assert.throws(() => commitChanges('unexpected tree', beforeCommitHook, { ...config, runGit: modifiedCommit }), rejected);
    assert.notEqual(runGit('rev-parse', 'HEAD'), release);
    assert.throws(() => assertCommitted(release, config), rejected);
} finally {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert(path.basename(resolved).startsWith('gmt-candidate-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
}
console.log('verified Git candidate tests: OK');
