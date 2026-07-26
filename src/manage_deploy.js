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

    if (deployments.size > 180) {
        fs.writeFileSync(WARNING_PATH, String(deployments.size), 'utf8');
        console.warn(`Deployment count is high (${deployments.size}/200).`);
    }

    if (!deployments.has(deploymentId)) {
        throw new Error(
            '固定デプロイIDが現在のGASデプロイ一覧にありません。別IDは選択せず処理を中止します。'
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
    const verifiedDeployments = parseDeployments(runClasp(['deployments']));
    if (verifiedDeployments.get(deploymentId) !== versionNumber) {
        throw new Error(
            '固定デプロイIDの更新後バージョンが、作成したバージョンと一致しません。'
        );
    }

    console.log(`[OK] Fixed Web App deployment updated to version ${versionNumber}.`);
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
    getDeploymentIdFromEnv,
    parseDeployments,
    parseCreatedVersion,
    runClasp
};
