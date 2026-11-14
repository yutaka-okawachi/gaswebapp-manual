const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { sha256, normalizeText } = require('./sync/core');
const source = fs.readFileSync(path.join(__dirname, 'sync/publish.js'), 'utf8');

// Use the actual implementation, with no network, credentials, or repository writes.
// Expose the private scheduler only inside this test's VM.
function load(core, clock = Date) {
    const context = {
        module: { exports: {} }, Buffer, Date: clock,
        require(name) {
            if (name === './core') return core;
            if (name === './logger') return { wait() {} };
            throw new Error('Unexpected dependency: ' + name);
        }
    };
    vm.runInNewContext(source + '\nmodule.exports.forEachLimited = forEachLimited;', context);
    return context.module.exports;
}
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
async function schedulerFailure() {
    const { forEachLimited } = load({});
    const gate = deferred();
    const failureSeen = deferred();
    const error = new Error('original error');
    let active = 0;
    const seen = [];
    let settled = false;
    const pending = forEachLimited(Array.from({ length: 248 }, (_, i) => i), 6, async i => {
        seen.push(i);
        active++;
        try {
            if (i === 0) { failureSeen.resolve(); throw error; }
            await gate.promise;
        } finally { active--; }
    }).then(() => { settled = true; assert.fail('failure must propagate'); }, caught => {
        settled = true;
        assert.strictEqual(caught, error, 'preserve the first error object');
    });
    await failureSeen.promise;
    await Promise.resolve();
    assert.strictEqual(settled, false, 'failure waits for in-flight work');
    assert.strictEqual(active, 5);
    assert.deepStrictEqual(seen, [0, 1, 2, 3, 4, 5]);
    gate.resolve();
    await pending;
    assert.strictEqual(active, 0, 'no work remains when the outer retry can begin');
    assert.strictEqual(seen.length, 6, 'no new work scheduled after failure');
    await forEachLimited([], 6, () => assert.fail('empty queue invokes no callback'));
}
async function schedulerRefillsImmediately() {
    const { forEachLimited } = load({});
    const gates = Array.from({ length: 7 }, deferred);
    const seventhStarted = deferred();
    const seen = [];
    const pending = forEachLimited([0, 1, 2, 3, 4, 5, 6], 6, async i => {
        seen.push(i);
        if (i === 6) seventhStarted.resolve();
        await gates[i].promise;
    });
    assert.deepStrictEqual(seen, [0, 1, 2, 3, 4, 5]);
    gates[0].resolve();
    // Let cross-VM promise continuations drain; the other five remain blocked.
    await new Promise(setImmediate);
    assert.deepStrictEqual(seen, [0, 1, 2, 3, 4, 5, 6], 'refill before the other five finish');
    await seventhStarted.promise;
    gates.forEach(gate => gate.resolve());
    await pending;
}
async function verifyScenario(kind, count = 3) {
    const originals = {};
    for (let i = 0; i < count; i++) {
        const file = i % 3 === 0 ? `data/${i}.txt` : i % 3 === 1 ? `data/${i}.json` : `mahler-search-app/images/score-pages/${i}.png`;
        originals[file] = i % 3 === 0 ? `line${i}\r\n` : i % 3 === 1 ? JSON.stringify({ i }) : Buffer.from([i % 256, 255]);
    }
    if (kind === 'invalidJSON') originals['data/1.json'] = '{';
    const hashes = Object.fromEntries(Object.entries(originals).map(([file, value]) =>
        [file, sha256(Buffer.isBuffer(value) ? value : normalizeText(value))]));
    const seen = [];
    let active = 0;
    let peak = 0;
    let mainChecks = 0;
    let retries = 0;
    const retryBoundary = new Error('stop after retry decision');
    const core = {
        sha256, normalizeText,
        async delay(ms) {
            assert.strictEqual(ms, 10000);
            retries++;
            throw retryBoundary;
        },
        async request(url) {
            if (url.includes('/actions/')) return { json: async () => ({ workflow_runs: [{
                head_sha: 'sha', name: 'pages', id: 1, status: 'completed',
                conclusion: kind === 'deploymentFail' ? 'failure' : 'success'
            }] }) };
            if (url.includes('/git/ref/')) {
                mainChecks++;
                assert.strictEqual(active, 0);
                assert.strictEqual(seen.length, count);
                return { json: async () => ({ object: { sha: kind === 'mainChanged' ? 'other' : 'sha' } }) };
            }
            if (url.includes('release.json')) return { json: async () => ({ releaseId: kind === 'oldRelease' ? 'old' : 'r' }) };
            assert(url.startsWith('https://test/'));
            assert(url.endsWith('?v=r'), 'release-specific cache buster is retained');
            const file = url.slice('https://test/'.length).split('?')[0];
            seen.push(file);
            if (kind === 'httpFail' && file === 'data/1.json') throw new Error('HTTP 404');
            if (kind === 'requestTimeout' && file === 'data/1.json') throw new Error('TimeoutError');
            active++;
            peak = Math.max(peak, active);
            async function body() {
                // Yield so all concurrent body reads are observable.
                await Promise.resolve();
                active--;
                if (kind === 'hashFail' && file === 'data/0.txt') return 'wrong';
                if (kind === 'imageFail' && file.endsWith('.png')) return Buffer.from([1]);
                return originals[file];
            }
            return { text: body, arrayBuffer: body };
        }
    };
    let caught;
    try { await load(core).verifyPages('slug', 'sha', 'test-credential', 'https://test/', { releaseId: 'r', hashes }); }
    catch (error) { caught = error; }
    assert.strictEqual(active, 0);
    assert(peak <= 6, 'at most six complete fetch/body/check tasks in flight');
    if (kind === 'ok') {
        assert.strictEqual(caught, undefined);
        assert.strictEqual(retries, 0);
        assert.strictEqual(mainChecks, 1);
        assert.strictEqual(seen.length, count);
        assert.strictEqual(new Set(seen).size, count, 'every manifest artifact checked exactly once');
        if (count >= 6) assert.strictEqual(peak, 6);
    } else if (kind === 'deploymentFail') {
        assert.match(caught.message, /公開に失敗/);
        assert.strictEqual(retries, 0);
        assert.strictEqual(seen.length, 0);
    } else {
        assert.strictEqual(caught, retryBoundary, 'validation failures reach the existing retry handler');
        assert.strictEqual(retries, 1);
        assert.strictEqual(mainChecks, kind === 'mainChanged' ? 1 : 0);
        if (kind === 'oldRelease') assert.strictEqual(seen.length, 0);
    }
}
async function pendingDeploymentTimeout() {
    let now = 0;
    let polls = 0;
    let delays = 0;
    const core = {
        async request() {
            polls++;
            return { json: async () => ({ workflow_runs: [{ head_sha: 'sha', id: 1, name: 'pages', status: 'in_progress' }] }) };
        },
        async delay(ms) { assert.strictEqual(ms, 10000); delays++; now += ms; }
    };
    await assert.rejects(load(core, { now: () => now }).verifyPages('slug', 'sha', 'test', 'https://test/', {}), /タイムアウト/);
    assert.strictEqual(polls, 60);
    assert.strictEqual(delays, 60);
    assert.strictEqual(now, 600000);
}
(async () => {
    await schedulerFailure();
    await schedulerRefillsImmediately();
    for (const kind of ['ok', 'hashFail', 'imageFail', 'invalidJSON', 'httpFail', 'requestTimeout', 'oldRelease', 'mainChanged', 'deploymentFail']) {
        await verifyScenario(kind);
    }
    await verifyScenario('ok', 248);
    await pendingDeploymentTimeout();
    console.log('Pages queue: all artifacts, bounded concurrency, failure drain, integrity guards, retry and timeout checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
