const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const normalizeText = value => value.replace(/\r\n/g, '\n');
const ownsHash = (record, hash) => typeof hash === 'string' &&
    (Array.isArray(record) ? record.includes(hash) : record === hash);
function nextOwnedHash(previous, current, planned) {
    // Keep the actually installed prior hash until the next write succeeds.
    // A retry never accumulates older generations.
    if (!ownsHash(previous, current) || current === planned) return planned;
    return planned ? [current, planned] : current;
}
function gasSourceFingerprint(directory = root) {
    const excluded = new Set(['manage_deploy.js', 'update_env.js', 'sync_build.js']);
    const files = fs.readdirSync(path.join(directory, 'src')).filter(name => !excluded.has(name) && /\.(js|html|json)$/.test(name)).sort();
    return sha256(files.map(name => name + '\n' + normalizeText(fs.readFileSync(path.join(directory, 'src', name), 'utf8'))).join('\n'));
}
function run(command, args = [], options = {}) {
    const { redactError = false, safeStdoutPattern, redactedFailure = 'authentication unavailable', ...spawnOptions } = options;
    const result = spawnSync(command, args, {
        cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
        ...spawnOptions
    });
    if (result.error) throw result.error;
    const rawStdout = result.stdout || '';
    const safeStdout = safeStdoutPattern ? rawStdout.split(/\r?\n/).filter(line => safeStdoutPattern.test(line)).join('\n') : '';
    if (result.status !== 0) {
        const details = redactError
            ? redactedFailure + (safeStdout ? '\n' + safeStdout : '')
            : result.stderr || rawStdout;
        throw new Error(`${command} failed (${result.status}): ${details}`);
    }
    return safeStdoutPattern ? safeStdout + (safeStdout ? '\n' : '') : rawStdout;
}
function git(...args) { return run('git', args).trim(); }
function atomicFile(file, content, scratch) {
    fs.mkdirSync(scratch, { recursive: true });
    const temporary = path.join(scratch, 'public-write-' + crypto.randomUUID() + '.tmp');
    try {
        fs.writeFileSync(temporary, content, { flag: 'wx' });
        fs.renameSync(temporary, file);
    } finally {
        fs.rmSync(temporary, { force: true });
    }
}
function writeIfChanged(relative, content, { atomic = false } = {}) {
    const file = path.join(root, relative);
    if (fs.existsSync(file) && normalizeText(fs.readFileSync(file, 'utf8')) === normalizeText(content)) return false;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (atomic) atomicFile(file, content, path.join(root, '.sync-state'));
    else fs.writeFileSync(file, content, 'utf8');
    return true;
}
function atomicJson(file, value) {
    fs.writeFileSync(file + '.new', JSON.stringify(value, null, 2));
    fs.renameSync(file + '.new', file);
}
function readJson(file, fallback = null) {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(url, options = {}, fetchImpl = fetch) {
    const response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(options.timeout || 45000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${new URL(url).pathname}`);
    return response;
}
module.exports = { root, sha256, normalizeText, ownsHash, nextOwnedHash, gasSourceFingerprint, run, git, writeIfChanged, atomicFile, atomicJson, readJson, delay, request };
