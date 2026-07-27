const assert = require('assert');
const {
    getDeploymentIdFromEnv,
    parseDeployments,
    parseCreatedVersion,
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
