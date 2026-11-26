const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { root, sha256, normalizeText } = require('./sync/core');
const { publicFiles } = require('./sync/artifacts');
const { verifyArtifact, releasePath, legacyAssets } = require('./verify-pages-artifact');
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'gmt-pages-test-'));
try {
    const publicPaths = publicFiles();
    const files = [...publicPaths, ...legacyAssets];
    const hashes = Object.fromEntries(publicPaths.map(file => {
        const bytes = fs.readFileSync(path.join(root, file));
        return [file, sha256(file.startsWith('mahler-search-app/images/score-pages/') ? bytes : normalizeText(bytes.toString('utf8')))];
    }));
    const receipt = Buffer.from(JSON.stringify({ schemaVersion: 1, releaseId: sha256(JSON.stringify(hashes)), hashes }));
    for (const file of files) {
        const target = path.join(stage, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.copyFileSync(path.join(root, file), target);
    }
    fs.writeFileSync(path.join(stage, releasePath), receipt);
    assert.equal(verifyArtifact(stage, receipt), files.length + 1);
    fs.appendFileSync(path.join(stage, 'index.html'), '\n<!-- Different fixture bytes -->\n');
    assert.throws(() => verifyArtifact(stage, receipt), /Pages file differs: index.html/);
    fs.copyFileSync(path.join(root, 'index.html'), path.join(stage, 'index.html'));
    fs.mkdirSync(path.join(stage, 'src'));
    assert.throws(() => verifyArtifact(stage, receipt), /Non-public directory/);
} finally {
    assert(path.resolve(stage).startsWith(path.resolve(os.tmpdir()) + path.sep) &&
        path.basename(stage).startsWith('gmt-pages-test-'));
    fs.rmSync(stage, { recursive: true, force: true });
}
console.log('Verified Pages artifact preserves public files and rejects changed or non-public files.');

