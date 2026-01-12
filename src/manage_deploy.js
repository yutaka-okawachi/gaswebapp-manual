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

    console.log(`Found ${Object.keys(deployments).length} deployments.`);

    if (currentId && deployments[currentId] !== undefined) {
        console.log(`Targeting existing deployment: ${currentId}`);
        // Update existing deployment
        exec(`clasp deploy -i "${currentId}" -d "Auto-update via sync-data"`, (e, out, er) => {
            console.log('Deploy (Update) stdout:', out);
            if(er) console.error('Deploy (Update) stderr:', er);
        });
    } else {
        console.log('Current deployment ID not found or invalid. Creating new deployment...');
        // Create new deployment
        exec('clasp deploy -d "New Deployment via sync-data"', (e, out, er) => {
            console.log('Deploy (New) stdout:', out);
            if(er) console.error('Deploy (New) stderr:', er);
            // update_env.js will handle updating .env with the new ID
        });
    }
});
