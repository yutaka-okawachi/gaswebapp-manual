function exportAllDataToJson() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // 0. Score Info (楽譜情報) - Load first for Publisher info
    const scoreSheet = ss.getSheetByName('楽譜情報');
    const scoreMap = {}; // Map for Publisher info (Opera -> Publisher)
    // sceneTitleMap will be populated from Scene Structure sheets

    if (scoreSheet) {
        const data = scoreSheet.getDataRange().getValues();
        // Assume Row 1 is header, Data starts from Row 2
        // Column A: Opera Name
        // Column E: Publisher
        data.slice(1).forEach(row => {
            const opera = String(row[0]).toLowerCase().trim();
            if (opera) {
                // Publisher Info (Column E) - Last one wins if multiple
                scoreMap[opera] = row[4];
            }
        });
    }

    // 0.5 Scene Title Map (from RS幕構成 / RW幕構成)
    const sceneTitleMap = {}; // Map for Scene Titles (Opera_Act_Scene -> Title)
    
    const populateSceneMap = (sheetName) => {
        const sheet = ss.getSheetByName(sheetName);
        if (sheet) {
            const data = sheet.getDataRange().getValues();
            // Assume Row 1 is header
            data.slice(1).forEach(row => {
                const opera = String(row[0]).toLowerCase().trim();
                const aufzug = row[1];
                const szene = row[2];
                const title = row[3]; // Column D: Japanese Title

                if (opera && title) {
                    const key = `${opera}_${aufzug}_${szene}`.toLowerCase();
                    sceneTitleMap[key] = title;
                }
            });
        }
    };

    populateSceneMap('RS幕構成');
    populateSceneMap('RW幕構成');

    // 1. Mahler Data (GM)
    const gmSheet = ss.getSheetByName('GM');
    const gmData = gmSheet.getDataRange().getValues();
    // Remove header
    const gmRows = gmData.slice(1);
    // Convert to object array for better readability/safety
    const mahlerJson = gmRows.map(row => ({
        de: row[0],
        de_normalized: row[1],
        ja: row[2],
        data: row[3]
    })).filter(item => item.de || item.data); // Filter out empty rows

    // 2. Richard Strauss Data (RS)
    const rsSheet = ss.getSheetByName('RS');
    let rsJson = [];
    if (rsSheet) {
        const rsData = rsSheet.getDataRange().getValues();
        const rsHeader = rsData[0].slice(0, 8); // Limit to columns A-H
        const rsRows = rsData.slice(1);

        // Simple mapping: map header names to values
        rsJson = rsRows.map(row => {
            let obj = {};
            rsHeader.forEach((h, i) => {
                obj[h.toString().trim()] = row[i];
            });
            
            const operKey = String(obj['Oper'] || '').toLowerCase().trim();
            
            // Add Score Info (Publisher)
            obj['楽譜情報'] = scoreMap[operKey] || '';

            // Add Scene Title
            const aufzug = obj['Aufzug'];
            const szene = obj['Szene'];
            const sceneKey = `${operKey}_${aufzug}_${szene}`.toLowerCase();
            obj['場面タイトル'] = sceneTitleMap[sceneKey] || '';
            
            return obj;
        }).filter(item => Object.values(item).some(val => val !== '')); // Filter out empty rows
    }

    // 3. Richard Wagner Data (RW)
    const rwSheet = ss.getSheetByName('RW');
    let rwJson = [];
    if (rwSheet) {
        const rwData = rwSheet.getDataRange().getValues();
        const rwHeader = rwData[0].slice(0, 8); // Limit to columns A-H
        const rwRows = rwData.slice(1);

        rwJson = rwRows.map(row => {
            let obj = {};
            rwHeader.forEach((h, i) => {
                obj[h.toString().trim()] = row[i];
            });

            const operKey = String(obj['Oper'] || '').toLowerCase().trim();

            // Add Score Info (Publisher)
            obj['楽譜情報'] = scoreMap[operKey] || '';

            // Add Scene Title
            const aufzug = obj['Aufzug'];
            const szene = obj['Szene'];
            const sceneKey = `${operKey}_${aufzug}_${szene}`.toLowerCase();
            obj['場面タイトル'] = sceneTitleMap[sceneKey] || '';

            return obj;
        }).filter(item => Object.values(item).some(val => val !== '')); // Filter out empty rows
    }

    // 4. Scene Maps (RS幕構成, RW幕構成) - Export raw data as well
    const rsSceneSheet = ss.getSheetByName('RS幕構成');
    let rsScenes = [];
    if (rsSceneSheet) {
        const data = rsSceneSheet.getDataRange().getValues();
        const header = data[0];
        rsScenes = data.slice(1).map(row => {
            let obj = {};
            header.forEach((h, i) => obj[h.toString().trim()] = row[i]);
            return obj;
        });
    }

    const rwSceneSheet = ss.getSheetByName('RW幕構成');
    let rwScenes = [];
    if (rwSceneSheet) {
        const data = rwSceneSheet.getDataRange().getValues();
        const header = data[0];
        rwScenes = data.slice(1).map(row => {
            let obj = {};
            header.forEach((h, i) => obj[h.toString().trim()] = row[i]);
            return obj;
        });
    }

    // 7. Dictionary Notes (Notes sheet)
    const dicNotesSheet = ss.getSheetByName('Notes');
    let dicNotesJson = [];
    if (dicNotesSheet) {
        const data = dicNotesSheet.getDataRange().getValues();
        // dic.html uses columns A, B, C (German, Translation, Source)
        dicNotesJson = data.slice(1).map(row => [row[0], row[1], row[2]]);
    }

    // 8. Abbreviation List (略記一覧)
    const abbrSheet = ss.getSheetByName('略記一覧');
    let abbrJson = [];
    if (abbrSheet) {
        const data = abbrSheet.getDataRange().getValues();
        // dic.html uses columns A, B, C
        abbrJson = data.slice(1).map(row => [row[0], row[1], row[2]]);
    }

    // Output to Drive
    const folder = DriveApp.getRootFolder();

    folder.createFile('mahler.json', JSON.stringify(mahlerJson));
    folder.createFile('richard_strauss.json', JSON.stringify(rsJson));
    folder.createFile('richard_wagner.json', JSON.stringify(rwJson));
    folder.createFile('rs_scenes.json', JSON.stringify(rsScenes));
    folder.createFile('rw_scenes.json', JSON.stringify(rwScenes));

    // New files
    folder.createFile('dic_notes.json', JSON.stringify(dicNotesJson));
    folder.createFile('abbr_list.json', JSON.stringify(abbrJson));

    Logger.log('Files created in Google Drive root folder:');
    Logger.log('- mahler.json');
    Logger.log('- richard_strauss.json');
    Logger.log('- richard_wagner.json');
    Logger.log('- rs_scenes.json');
    Logger.log('- rw_scenes.json');
    Logger.log('- dic_notes.json');
    Logger.log('- abbr_list.json');
}
