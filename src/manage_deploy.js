/*
 * manage_deploy.js
 * 
 * 役割: Google Apps Script (GAS) のデプロイを管理するスクリプト。
 * 
 * 具体的な動作:
 * 1. .envファイルから現在のデプロイIDを取得します。
 * 2. `clasp deployments` コマンドを実行し、既存のデプロイ一覧を取得します。
 * 3. .envのデプロイIDが既存リストに存在する場合、そのデプロイを更新（上書き）します。
 *    これにより、WebアプリのURLが変わることなく、最新のコードが反映されます。
 * 4. デプロイIDが見つからない場合は、既存の最新デプロイを更新するか、新規デプロイを作成します。
 * 
 * これにより、sync-data実行時に毎回WebアプリURLが変わってしまうのを防いでいます。
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Helper to get current deployment ID from .env
function getCurrentDeploymentId() {
    try {
        const envPath = path.join(__dirname, '../.env');
        if (!fs.existsSync(envPath)) return null;
        
        const envContent = fs.readFileSync(envPath, 'utf-8');
        // GAS_DEPLOY_URL=https://script.google.com/macros/s/DEPLOY_ID/exec
        const match = envContent.match(/GAS_DEPLOY_URL=https:\/\/script\.google\.com\/macros\/s\/([A-Za-z0-9_-]+)\/exec/);
        return match ? match[1] : null;
    } catch (e) {
        console.error('Error reading .env:', e);
        return null;
    }
}

const currentId = getCurrentDeploymentId();
console.log('Current Deployment ID from .env:', currentId || 'None');

console.log('Fetching deployments...');
exec('clasp deployments', (err, stdout, stderr) => {
    if (err) {
        console.error('Error fetching deployments:', stderr);
        return;
    }

    const lines = stdout.split('\n');
    const deployments = {};
    lines.forEach(l => {
        const m = l.match(/- ([A-Za-z0-9_-]+) @([0-9]+)/);
        if(m) {
            deployments[m[1].trim()] = parseInt(m[2], 10);
        }
    });

    const deploymentsCount = Object.keys(deployments).length;
    console.log(`Found ${deploymentsCount} deployments.`);

    // Warn if deployments approach the limit (200)
    if (deploymentsCount > 180) {
        const warningFile = path.join(__dirname, '../.deploy_warning');
        fs.writeFileSync(warningFile, deploymentsCount.toString());
        console.log(`Warning: Deployment count (${deploymentsCount}) is high. Created warning flag.`);
    }

    if (currentId && deployments[currentId] !== undefined) {
        console.log(`Targeting existing deployment: ${currentId}`);
        // Update existing deployment
        exec(`clasp deploy -i "${currentId}" -d "Auto-update via sync-data"`, (e, out, er) => {
            console.log('Deploy (Update) stdout:', out);
            if(er) console.error('Deploy (Update) stderr:', er);
        });
    } else {
        console.log('Current deployment ID not found or invalid. Finding latest...');
        // Fallback: Use the latest version deployment if .env mismatches
        const keys = Object.keys(deployments);
        if (keys.length > 0) {
            const latestId = keys[0]; // Just pick one if we can't sort reliability without more parsing
            console.log(`Falling back to updating: ${latestId}`);
             exec(`clasp deploy -i "${latestId}" -d "Auto-update via sync-data"`, (e, out, er) => {
                console.log('Deploy (Update fallback) stdout:', out);
                if(er) console.error('Deploy (Update fallback) stderr:', er);
            });
        } else {
             console.log('No deployments found. Creating new...');
            // Create new deployment
            exec('clasp deploy -d "New Deployment via sync-data"', (e, out, er) => {
                console.log('Deploy (New) stdout:', out);
                if(er) console.error('Deploy (New) stderr:', er);
                // update_env.js will handle updating .env with the new ID
            });
        }
    }
});
