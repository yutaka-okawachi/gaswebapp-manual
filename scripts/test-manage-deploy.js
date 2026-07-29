const assert = require('assert');
const {
    getDeploymentIdFromEnv,
    parseDeployments,
    parseCreatedVersion,
    parseVersionCount,
    getVersionCapacityState,
    verifyDeploymentVersion
} = require('../src/manage_deploy.js');

const deploymentId = 'AKfycb_test-fixed-deployment_123';
const env = [
    `GAS_DEPLOY_URL=https://script.google.com/macros/s/${deploymentId}/exec`,
    'GAS_SECRET_TOKEN=hidden'
].join('\n');

assert.strictEqual(getDeploymentIdFromEnv(env), deploymentId);
assert.strictEqual(
    getDeploymentIdFromEnv('GAS_DEPLOY_URL=https://example.com/not-gas'),
    null
);

const deployments = parseDeployments([
    'Found 2 deployments.',
    `- ${deploymentId} @1515 - Auto-update via sync-data`,
    '- AKfycb_other @HEAD'
].join('\n'));
assert.strictEqual(deployments.get(deploymentId), 1515);
assert.strictEqual(deployments.has('AKfycb_other'), false);

assert.strictEqual(parseCreatedVersion('Created version 1515.'), 1515);
assert.strictEqual(parseCreatedVersion('Created version 1516'), 1516);
assert.strictEqual(parseCreatedVersion('Created version 1,517'), 1517);
assert.strictEqual(parseCreatedVersion('No version was created'), null);
assert.strictEqual(
    parseVersionCount([
        'Found 139 versions.',
        '882 - Fix whom update logic',
        '1,549 - sync-data'
    ].join('\n')),
    139
);
assert.strictEqual(
    parseVersionCount([
        '882 - Fix whom update logic',
        '1,548 - sync-data',
        '1,549 - sync-data'
    ].join('\n')),
    3
);
assert.strictEqual(parseVersionCount('No versions found.'), null);
assert.deepStrictEqual(getVersionCapacityState(178), {
    limitReached: false,
    projectedVersionCount: 179,
    warning: false
});
assert.deepStrictEqual(getVersionCapacityState(179), {
    limitReached: false,
    projectedVersionCount: 180,
    warning: true
});
assert.deepStrictEqual(getVersionCapacityState(199), {
    limitReached: false,
    projectedVersionCount: 200,
    warning: true
});
assert.deepStrictEqual(getVersionCapacityState(200), {
    limitReached: true,
    projectedVersionCount: 201,
    warning: true
});

function deploymentOutput(version) {
    return [
        'Found 2 deployments.',
        `- ${deploymentId} @${version} - sync-data`,
        '- AKfycb_other @HEAD'
    ].join('\n');
}

let fetchCount = 0;
const retryResult = verifyDeploymentVersion(deploymentId, 1517, {
    fetchDeployments: () => {
        fetchCount += 1;
        return deploymentOutput(fetchCount === 1 ? 1516 : 1517);
    },
    sleep: () => {},
    delays: [0, 0]
});
assert.strictEqual(retryResult.status, 'matched');
assert.strictEqual(retryResult.observedVersion, 1517);
assert.strictEqual(fetchCount, 2);

const supersededResult = verifyDeploymentVersion(deploymentId, 1517, {
    fetchDeployments: () => deploymentOutput(1518),
    sleep: () => {},
    delays: [0]
});
assert.strictEqual(supersededResult.status, 'superseded');
assert.strictEqual(supersededResult.observedVersion, 1518);

assert.throws(
    () => verifyDeploymentVersion(deploymentId, 1517, {
        fetchDeployments: () => deploymentOutput(1516),
        sleep: () => {},
        delays: [0, 0]
    }),
    /期待値: 1517、確認値: 1516/
);

console.log('manage deployment tests: OK');
