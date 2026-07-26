const assert = require('assert');
const {
    getDeploymentIdFromEnv,
    parseDeployments,
    parseCreatedVersion
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
assert.strictEqual(parseCreatedVersion('No version was created'), null);

console.log('manage deployment tests: OK');
