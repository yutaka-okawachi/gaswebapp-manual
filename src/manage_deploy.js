const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Fetching deployments...');
exec('clasp deployments', (err, stdout, stderr) => {
    if (err) {
        console.error('Error fetching deployments:', stderr);
        return;
    }

    const lines = stdout.split('\n');
    const list = [];
    lines.forEach(l => {
        const m = l.match(/- ([A-Za-z0-9_-]+) @([0-9]+)/);
        if(m) {
            list.push({ id: m[1].trim(), ver: parseInt(m[2], 10) });
        }
    });

    // Sort by version Ascending (Oldest first)
    list.sort((a, b) => a.ver - b.ver);

    console.log(`Found ${list.length} deployments.`);

    const createNewDeployment = () => {
        console.log('Creating new deployment...');
        exec('clasp deploy -d "New Deployment via sync-data (Force Refresh)"', (e, out, er) => {
            console.log('Deploy (New) stdout:', out);
            if(er) console.error('Deploy (New) stderr:', er);
            // update_env.js will handle updating .env with the new ID
        });
    };

    if (list.length > 0) {
        const oldest = list[0];
        console.log(`Deleting oldest deployment: ${oldest.id} (@${oldest.ver})`);
        
        exec(`clasp undeploy ${oldest.id}`, (e, out, er) => {
            console.log('Undeploy stdout:', out);
            if(er) console.error('Undeploy stderr:', er);
            
            // Create new deployment after deletion
            createNewDeployment();
        });
    } else {
        // No deployments exist, just create one
        createNewDeployment();
    }
});
