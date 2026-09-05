const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const normalizeText = value => value.replace(/\r\n/g, '\n');
function run(command, args = [], options = {}) {
    const { redactError = false, ...spawnOptions } = options;
    const result = spawnSync(command, args, {
        cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024,
        ...spawnOptions
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${command} failed (${result.status}): ${redactError ? 'authentication unavailable' : result.stderr || result.stdout || ''}`);
    return result.stdout || '';
}
function git(...args) { return run('git', args).trim(); }
function writeIfChanged(relative, content) {
    const file = path.join(root, relative);
    if (fs.existsSync(file) && normalizeText(fs.readFileSync(file, 'utf8')) === normalizeText(content)) return false;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf8');
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
module.exports = { root, sha256, normalizeText, run, git, writeIfChanged, atomicJson, readJson, delay, request };
