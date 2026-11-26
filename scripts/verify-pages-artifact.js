const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { root, sha256, normalizeText } = require('./sync/core');
const { publicFiles } = require('./sync/artifacts');
const { assertReleaseManifest } = require('./sync/bilingual');
const releasePath = 'mahler-search-app/release.json';
const legacyAssets = ['apple-touch-icon.png', 'favicon.png', 'favicon_original.png', 'ogp.png',
    'google34b939d4db375916.html'];

function read(directory, relative) {
    const file = path.join(directory, relative);
    assert(fs.lstatSync(file).isFile(), 'Not a regular Pages file: ' + relative);
    return fs.readFileSync(file);
}
function verifyArtifact(directory, original = read(root, releasePath)) {
    const manifest = JSON.parse(original);
    assertReleaseManifest(manifest);
    assert.deepEqual(Object.keys(manifest.hashes).sort(), publicFiles(), 'Missing or unexpected release manifest paths');
    assert.equal(manifest.releaseId, sha256(JSON.stringify(manifest.hashes)), 'Wrong release ID');
    assert.deepEqual(read(directory, releasePath), original, 'Built release manifest differs from the checkout');
    for (const [file, hash] of Object.entries(manifest.hashes)) {
        const bytes = read(directory, file);
        const text = !file.startsWith('mahler-search-app/images/score-pages/');
        assert.equal(sha256(text ? normalizeText(bytes.toString('utf8')) : bytes), hash, 'Pages file differs: ' + file);
    }
    for (const file of legacyAssets) assert.deepEqual(read(directory, file), read(root, file), 'Pages asset differs: ' + file);
    for (const dir of ['.git', '.sync-state', 'frontend', 'scripts', 'src', 'manuals']) {
        assert(!fs.existsSync(path.join(directory, dir)), 'Non-public directory in Pages artifact: ' + dir);
    }
    return Object.keys(manifest.hashes).length + legacyAssets.length + 1;
}
if (require.main === module) {
    if (process.argv.length !== 3 || process.argv[2] !== '_site') throw new Error('Usage: node scripts/verify-pages-artifact.js _site');
    console.log('Verified Pages artifact files: ' + verifyArtifact(path.resolve(process.argv[2])));
}
module.exports = { verifyArtifact, releasePath, legacyAssets };

