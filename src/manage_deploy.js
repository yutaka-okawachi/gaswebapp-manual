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
        // Authentication required error often appears here
        if (stderr.includes('gcloud auth login') || stderr.includes('not logged in')) {
             console.error('CLASP_AUTH_REQUIRED');
        }
        process.exit(1);
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

    console.log(`Found ${Object.keys(deployments).length} deployments.`);

    if (currentId && deployments[currentId] !== undefined) {
        console.log(`Targeting existing deployment: ${currentId}`);
        // Update existing deployment
        exec(`clasp deploy -i "${currentId}" -d "Auto-update via sync-data"`, (e, out, er) => {
            console.log('Deploy (Update) stdout:', out);
            if(e || er) {
                console.error('Deploy (Update) failed:', er);
                process.exit(1);
            } else {
                process.exit(0);
            }
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
                if(e || er) {
                    console.error('Deploy (Update fallback) failed:', er);
                    process.exit(1);
                } else {
                    process.exit(0);
                }
            });
        } else {
             console.log('No deployments found. Creating new...');
            // Create new deployment
            exec('clasp deploy -d "New Deployment via sync-data"', (e, out, er) => {
                console.log('Deploy (New) stdout:', out);
                if(e || er) {
                    console.error('Deploy (New) stderr:', er);
                    process.exit(1);
                } else {
                    process.exit(0);
                }
                // update_env.js will handle updating .env with the new ID
            });
        }
    }
});
