const { exec } = require('child_process');

console.log('Fetching deployments...');
exec('clasp deployments', (err, stdout, stderr) => {
    if (err) {
        console.error('Error fetching deployments:', stderr);
        return;
    }

    const lines = stdout.split('\n');
    const list = [];
    lines.forEach(l => {
        // ID pattern: allow alphanumeric, underscore, hyphen
        const m = l.match(/- ([A-Za-z0-9_-]+) @([0-9]+)/);
        if(m) {
            list.push({ id: m[1].trim(), ver: parseInt(m[2], 10) });
        }
    });

    // Sort by version (ascending)
    list.sort((a, b) => a.ver - b.ver);

    console.log(`Found ${list.length} deployments.`);
    
    if (list.length > 0) {
        // Delete the oldest one
        const target = list[0];
        console.log(`Targeting oldest deployment: ${target.id} (@${target.ver})`);
        
        exec(`clasp undeploy ${target.id}`, (e, out, er) => {
            console.log('Undeploy stdout:', out);
            if (er) console.error('Undeploy stderr:', er);

            // Even if undeploy fails (maybe already gone?), try to deploy new one?
            // Usually if undeploy fails with "Invalid ID", we should try the next one?
            // But let's assume it works or we proceed if it was just a glitch.
            
            // If the error implies "not found", maybe we can proceed. 
            // But if it implies "permission denied", we are stuck.
            
            if (!e || (er && er.includes('Invalid execution'))) { 
                 console.log('Proceeding to create new deployment...');
                 exec('clasp deploy -d "Fix whom update logic (via node)"', (e2, out2, er2) => {
                     console.log('Deploy stdout:', out2);
                     if(er2) console.error('Deploy stderr:', er2);
                 });
            }
        });
    } else {
        console.log('No deployments found to delete? Trying to deploy anyway...');
        exec('clasp deploy -d "Fix whom update logic (via node)"', (e2, out2, er2) => {
             console.log('Deploy stdout:', out2);
             if(er2) console.error('Deploy stderr:', er2);
        });
    }
});
