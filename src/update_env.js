/*
 * .env の固定 GAS_DEPLOY_URL を公開側 app.js に同期する。
 *
 * デプロイ一覧から「最新版」を選ぶ処理は行わない。
 * 固定URLが不正、app.js がない、置換対象がない場合は終了コード1を返す。
 */
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '../.env');
const APP_JS_PATH = path.join(__dirname, '../frontend/state-and-notifications.js');

function getFixedDeploymentUrl(envContent) {
    const match = envContent.match(
        /^\s*GAS_DEPLOY_URL\s*=\s*(https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec)\s*$/m
    );
    return match ? match[1] : null;
}

function run() {
    if (!fs.existsSync(ENV_PATH)) {
        throw new Error('.env が見つかりません。処理を中止します。');
    }

    const envContent = fs.readFileSync(ENV_PATH, 'utf8');
    const fixedUrl = getFixedDeploymentUrl(envContent);
    if (!fixedUrl) {
        throw new Error('.env の GAS_DEPLOY_URL が有効な固定WebアプリURLではありません。');
    }

    if (!fs.existsSync(APP_JS_PATH)) {
        throw new Error(`app.js が見つかりません: ${APP_JS_PATH}`);
    }

    const appJsContent = fs.readFileSync(APP_JS_PATH, 'utf8');
    const targetPattern = /const GAS_NOTIFICATION_URL = '.*';/;
    if (!targetPattern.test(appJsContent)) {
        throw new Error('app.js に GAS_NOTIFICATION_URL の置換対象が見つかりません。');
    }

    const updatedContent = appJsContent.replace(
        targetPattern,
        `const GAS_NOTIFICATION_URL = '${fixedUrl}';`
    );

    if (updatedContent === appJsContent) {
        console.log('[OK] app.js already uses the fixed Web App URL.');
        return;
    }

    fs.writeFileSync(APP_JS_PATH, updatedContent, 'utf8');
    console.log('[OK] app.js updated with the fixed Web App URL.');
}

if (require.main === module) {
    try {
        run();
    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = {
    getFixedDeploymentUrl
};
