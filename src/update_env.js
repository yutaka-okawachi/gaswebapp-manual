const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '../mahler-search-app/js/app.js');

// ================================================================
// [1] GAS_NOTIFICATION_URL の更新（デプロイURLの最新化）
// ================================================================
console.log('Fetching deployments to find the latest one...');
exec('clasp deployments', (err, stdout, stderr) => {
    if (err) {
        console.error('Error fetching deployments:', stderr);
        // URLの更新に失敗してもトークン同期は続行する
    } else {
        const lines = stdout.split('\n');
        const list = [];
        lines.forEach(l => {
            const m = l.match(/- ([A-Za-z0-9_-]+) @([0-9]+)/);
            if(m) {
                list.push({ id: m[1].trim(), ver: parseInt(m[2], 10) });
            }
        });

        list.sort((a, b) => b.ver - a.ver); // Descending

        if (list.length > 0) {
            const latest = list[0];
            console.log(`Latest deployment: ${latest.id} (@${latest.ver})`);
            
            const newUrl = `https://script.google.com/macros/s/${latest.id}/exec`;
            console.log(`New URL: ${newUrl}`);

            // .env を更新
            try {
                const envPath = path.join(__dirname, '../.env');
                let envContent = fs.readFileSync(envPath, 'utf-8');
                
                const newEnvContent = envContent.replace(/GAS_DEPLOY_URL=.+/, `GAS_DEPLOY_URL=${newUrl}`);
                
                if (envContent === newEnvContent) {
                    console.log('.env was not updated (regex match failed or already same).');
                } else {
                    fs.writeFileSync(envPath, newEnvContent);
                    console.log('.env updated successfully.');
                }

            } catch (e) {
                console.error('Error updating .env:', e);
            }

            // app.js の GAS_NOTIFICATION_URL を更新
            try {
                console.log('Target app.js path:', appJsPath);
                
                if (fs.existsSync(appJsPath)) {
                    let appJsContent = fs.readFileSync(appJsPath, 'utf-8');
                    const appJsNewContent = appJsContent.replace(
                        /const GAS_NOTIFICATION_URL = '.*';/, 
                        `const GAS_NOTIFICATION_URL = '${newUrl}';`
                    );
                    
                    if (appJsContent === appJsNewContent) {
                         console.log('app.js was not updated (regex match failed or already same).');
                    } else {
                        fs.writeFileSync(appJsPath, appJsNewContent);
                        console.log('app.js updated successfully with new URL.');
                    }
                } else {
                    console.warn('app.js not found at expected path:', appJsPath);
                }
            } catch (e) {
                console.error('Error updating app.js:', e);
            }

        } else {
            console.error('No deployments found!');
        }
    }

    // ================================================================
    // [2] NOTIFY_SEC_TOKEN の同期（.env → app.js の GAS_NOTIFY_TOKEN）
    // ================================================================
    try {
        const envPath = path.join(__dirname, '../.env');
        if (!fs.existsSync(envPath)) {
            console.warn('.env not found. Skipping NOTIFY_SEC_TOKEN sync.');
            return;
        }

        const envContent = fs.readFileSync(envPath, 'utf-8');
        const tokenMatch = envContent.match(/^NOTIFY_SEC_TOKEN=(.+)$/m);

        if (!tokenMatch || !tokenMatch[1].trim()) {
            console.warn('NOTIFY_SEC_TOKEN not set in .env. Skipping token sync.');
            return;
        }

        const token = tokenMatch[1].trim();

        if (!fs.existsSync(appJsPath)) {
            console.warn('app.js not found. Skipping NOTIFY_SEC_TOKEN sync.');
            return;
        }

        let appJsContent = fs.readFileSync(appJsPath, 'utf-8');
        const updated = appJsContent.replace(
            /const GAS_NOTIFY_TOKEN = '.*';/,
            `const GAS_NOTIFY_TOKEN = '${token}';`
        );

        if (updated === appJsContent) {
            console.log('GAS_NOTIFY_TOKEN in app.js: already up to date.');
        } else {
            fs.writeFileSync(appJsPath, updated);
            console.log('app.js updated with NOTIFY_SEC_TOKEN.');
        }
    } catch (e) {
        console.warn('Could not sync NOTIFY_SEC_TOKEN to app.js:', e.message);
    }
});
