/*
 * .env に記録された既存の Web アプリデプロイだけを更新する。
 *
 * 安全上の規則:
 * - 別のデプロイへのフォールバックはしない。
 * - 新規デプロイは作成しない。
 * - 対象IDが取得できない、存在しない、更新に失敗した場合は終了コード1を返す。
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '../.env');
const WARNING_PATH = path.join(__dirname, '../.deploy_warning');
const DEPLOYMENT_VERIFY_DELAYS_MS = [0, 2000, 5000, 10000];
const VERSION_WARNING_THRESHOLD = 180;
const VERSION_LIMIT = 200;

function getDeploymentIdFromEnv(envContent) {
    const match = envContent.match(
        /^\s*GAS_DEPLOY_URL\s*=\s*https:\/\/script\.google\.com\/macros\/s\/([A-Za-z0-9_-]+)\/exec\s*$/m
    );
    return match ? match[1] : null;
}

function parseDeployments(output) {
    const deployments = new Map();
    output.split(/\r?\n/).forEach((line) => {
        const match = line.match(/- ([A-Za-z0-9_-]+) @([0-9]+)/);
        if (match) {
            deployments.set(match[1], Number.parseInt(match[2], 10));
        }
    });
    return deployments;
}

function parseCreatedVersion(output) {
    const match = String(output || '').match(/Created version\s+([0-9][0-9,]*)/i);
    return match ? Number.parseInt(match[1].replace(/,/g, ''), 10) : null;
}

function parseVersionCount(output) {
    const text = String(output || '');
    const summaryMatch = text.match(/Found\s+([0-9][0-9,]*)\s+versions?\./i);
    if (summaryMatch) {
        return Number.parseInt(summaryMatch[1].replace(/,/g, ''), 10);
    }

    const versionLines = text
        .split(/\r?\n/)
        .filter(line => /^\s*[0-9][0-9,]*\s+-\s+/.test(line));
    return versionLines.length > 0 ? versionLines.length : null;
}

function getVersionCapacityState(versionCount) {
    if (!Number.isInteger(versionCount) || versionCount < 0) {
        throw new Error('Invalid Apps Script version count.');
    }

    const projectedVersionCount = versionCount + 1;
    return {
        limitReached: versionCount >= VERSION_LIMIT,
        projectedVersionCount,
        warning: projectedVersionCount >= VERSION_WARNING_THRESHOLD
    };
}

function maskDeploymentId(id) {
    if (id.length <= 8) return '********';
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

function runClasp(args) {
    const result = spawnSync('clasp', args, {
        cwd: __dirname,
        encoding: 'utf8',
        shell: process.platform === 'win32',
        windowsHide: true
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        const error = new Error(`clasp ${args[0]} failed with exit code ${result.status}`);
        error.stderr = result.stderr;
        throw error;
    }
    return result.stdout || '';
}

function sleep(milliseconds) {
    if (milliseconds <= 0) return;
    Atomics.wait(
        new Int32Array(new SharedArrayBuffer(4)),
        0,
        0,
        milliseconds
    );
}

function verifyDeploymentVersion(deploymentId, expectedVersion, options = {}) {
    const fetchDeployments = options.fetchDeployments ||
        (() => runClasp(['deployments']));
    const wait = options.sleep || sleep;
    const delays = options.delays || DEPLOYMENT_VERIFY_DELAYS_MS;
    let observedVersion = null;

    for (let attempt = 0; attempt < delays.length; attempt += 1) {
        wait(delays[attempt]);
        observedVersion = parseDeployments(fetchDeployments()).get(deploymentId);

        if (observedVersion === expectedVersion) {
            return {
                status: 'matched',
                observedVersion
            };
        }

        // 別の同期処理が先に進めた固定デプロイを古い版へ戻さない。
        if (Number.isInteger(observedVersion) && observedVersion > expectedVersion) {
            return {
                status: 'superseded',
                observedVersion
            };
        }

        if (attempt < delays.length - 1) {
            const displayVersion = Number.isInteger(observedVersion)
                ? observedVersion
                : 'not found';
            console.warn(
                `Deployment verification ${attempt + 1}/${delays.length}: ` +
                `observed ${displayVersion}; waiting for version ${expectedVersion}.`
            );
        }
    }

    const displayVersion = Number.isInteger(observedVersion)
        ? observedVersion
        : 'not found';
    throw new Error(
        `固定デプロイIDの更新後バージョンを確認できません。` +
        `期待値: ${expectedVersion}、確認値: ${displayVersion}`
    );
}

function run() {
    if (!fs.existsSync(ENV_PATH)) {
        throw new Error('.env が見つかりません。固定の GAS_DEPLOY_URL を設定してください。');
    }

    const envContent = fs.readFileSync(ENV_PATH, 'utf8');
    const deploymentId = getDeploymentIdFromEnv(envContent);
    if (!deploymentId) {
        throw new Error(
            '.env の GAS_DEPLOY_URL から有効なデプロイIDを取得できません。処理を中止します。'
        );
    }

    console.log(`Fixed deployment: ${maskDeploymentId(deploymentId)}`);
    console.log('Fetching existing deployments...');
    const deploymentsOutput = runClasp(['deployments']);
    const deployments = parseDeployments(deploymentsOutput);
    console.log(`Found ${deployments.size} deployments.`);

    if (!deployments.has(deploymentId)) {
        throw new Error(
            '固定デプロイIDが現在のGASデプロイ一覧にありません。別IDは選択せず処理を中止します。'
        );
    }

    console.log('Fetching existing Apps Script versions...');
    if (fs.existsSync(WARNING_PATH)) {
        fs.unlinkSync(WARNING_PATH);
    }
    const versionsOutput = runClasp(['versions']);
    const versionCount = parseVersionCount(versionsOutput);
    if (!Number.isInteger(versionCount)) {
        throw new Error('Could not determine the Apps Script version count.');
    }
    console.log(`Found ${versionCount} Apps Script versions.`);

    const versionCapacity = getVersionCapacityState(versionCount);
    if (versionCapacity.limitReached) {
        fs.writeFileSync(WARNING_PATH, String(versionCount), 'utf8');
        throw new Error(
            `Apps Script version limit reached (${versionCount}/${VERSION_LIMIT}). ` +
            'Clean up unused versions or deployments before running sync-data again.'
        );
    }

    if (versionCapacity.warning) {
        fs.writeFileSync(
            WARNING_PATH,
            String(versionCapacity.projectedVersionCount),
            'utf8'
        );
        console.warn(
            `Apps Script version count is approaching the limit ` +
            `(${versionCapacity.projectedVersionCount}/${VERSION_LIMIT} after this update).`
        );
    }

    console.log('Creating an immutable Apps Script version from the verified HEAD...');
    const versionOutput = runClasp([
        'version',
        'sync-data'
    ]);
    const versionNumber = parseCreatedVersion(versionOutput);
    if (!versionNumber) {
        throw new Error('作成されたApps Scriptバージョン番号を取得できません。');
    }

    console.log(`Updating the fixed Web App deployment to version ${versionNumber}...`);
    const deployOutput = runClasp([
        'deploy',
        '-i',
        deploymentId,
        '-V',
        String(versionNumber),
        '-d',
        'sync-data'
    ]);
    if (deployOutput.trim()) {
        console.log(deployOutput.trim());
    }
    const verification = verifyDeploymentVersion(deploymentId, versionNumber);
    if (verification.status === 'superseded') {
        throw new Error('別の同期によってデプロイが更新されました。再実行してください。');
    } else {
        console.log(`[OK] Fixed Web App deployment verified at version ${versionNumber}.`);
    }

    console.log('[OK] Fixed Web App deployment update completed.');
}

if (require.main === module) {
    try {
        run();
    } catch (error) {
        const detail = error.stderr ? String(error.stderr).trim() : '';
        console.error(`[ERROR] ${error.message}`);
        if (detail) console.error(detail);
        process.exitCode = 1;
    }
}

module.exports = {
    run,
    getDeploymentIdFromEnv,
    parseDeployments,
    parseCreatedVersion,
    parseVersionCount,
    getVersionCapacityState,
    runClasp,
    verifyDeploymentVersion
};
