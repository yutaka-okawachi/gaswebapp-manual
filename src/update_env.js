const { exec } = require('child_process');
const fs = require('fs');

console.log('Fetching deployments to find the latest one...');
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

    list.sort((a, b) => b.ver - a.ver); // Descending

    if (list.length > 0) {
        const latest = list[0];
        console.log(`Latest deployment: ${latest.id} (@${latest.ver})`);
        
        const newUrl = `https://script.google.com/macros/s/${latest.id}/exec`;
        console.log(`New URL: ${newUrl}`);

        // Update .env
        try {
            // Read .env from parent dir (since we are in src) or current? 
            // We run this from src, but .env is in parent. Based on previous commands, .env is in c:\Users\okawa\gaswebapp-manual
            const envPath = '../.env'; 
            let envContent = fs.readFileSync(envPath, 'utf-8');
            
            // Regex replace
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

    } else {
        console.error('No deployments found!');
    }
});
