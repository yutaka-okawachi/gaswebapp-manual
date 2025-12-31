// SPREADSHEET_ID is defined in mahler.js

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

    // 5. 指示対象 (whom) の抽出: RS / RW の whom 列をオペラ毎に集計して出力
    const whomMap = {};
    const collectWhomFromRows = (rows) => {
        rows.forEach(item => {
            const operKey = String((item['Oper'] || item['oper'] || '')).toLowerCase().trim();
            const whomField = item['whom'] || item['Whom'] || item['Whom'] || '';
            if (!operKey || !whomField) return;
            const parts = String(whomField).split(/[,、;\n]/).map(s => s.toString().trim()).filter(Boolean);
            if (!whomMap[operKey]) whomMap[operKey] = new Set();
            parts.forEach(p => whomMap[operKey].add(p));
        });
    };

    collectWhomFromRows(rsJson);
    collectWhomFromRows(rwJson);

    const whomList = {};
    Object.keys(whomMap).forEach(k => {
        whomList[k] = Array.from(whomMap[k]).sort((a,b) => a.localeCompare(b, 'ja'));
    });

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

    // 9. Generate dic.html (静的HTML生成 - リンク機能付き)
    Logger.log('=== dic.htmlを生成中（リンク機能付き） ===');
    const dicHtml = generateDicHtml(dicNotesJson, abbrJson);
    Logger.log('dic.html生成完了: ' + Math.round(dicHtml.length / 1024) + ' KB');
    
    // 10. 用語インデックスを生成
    const termsIndex = generateDicTermsIndex(dicNotesJson);
    Logger.log('dic_terms_index.json生成完了: ' + Object.keys(termsIndex).length + ' 件');

    // キャッシュを無効化（サーバーサイド検索用）
    CacheService.getScriptCache().remove('dic_terms_index_v1');

    // GitHubへ直接プッシュ（Google Drive不要）
    const files = {
        'mahler-search-app/data/mahler.json': mahlerJson,
        'mahler-search-app/data/richard_strauss.json': rsJson,
        'mahler-search-app/data/richard_wagner.json': rwJson,
        'mahler-search-app/data/rs_scenes.json': rsScenes,
        'mahler-search-app/data/rw_scenes.json': rwScenes,
        'mahler-search-app/data/dic_notes.json': dicNotesJson,
        'mahler-search-app/data/abbr_list.json': abbrJson,
        'mahler-search-app/data/dic_terms_index.json': termsIndex,  // 新規: 用語インデックス
        'mahler-search-app/dic.html': dicHtml  // 新規: 生成されたHTML（リンク付き）
        , 'mahler-search-app/data/whom_list.json': whomList
    };

    // 自動生成されたコミットメッセージ
    const timestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const commitMessage = `自動更新: スプレッドシートからデータ同期 [${timestamp}]`;

    Logger.log('=== GitHubへデータをプッシュ中 ===');
    
    try {
        // github_sync.js の pushToGitHub() を呼び出し
        const result = pushToGitHub(files, commitMessage);
        
        Logger.log('=== 完了 ===');
        Logger.log(`成功: ${result.success.length} ファイル`);
        Logger.log(`失敗: ${result.failed.length} ファイル`);
        
        if (result.success.length > 0) {
            Logger.log('\n✓ 成功したファイル:');
            result.success.forEach(path => Logger.log(`  - ${path}`));
        }
        
        if (result.failed.length > 0) {
            Logger.log('\n✗ 失敗したファイル:');
            result.failed.forEach(f => Logger.log(`  - ${f.path}: ${f.error}`));
        }
        
        // ユーザーへの通知（オプション）
        if (result.success.length === result.total) {
            SpreadsheetApp.getActiveSpreadsheet().toast(
                `${result.total}個のファイルをGitHubへプッシュしました`,
                '✓ 完了',
                5
            );
        } else {
            SpreadsheetApp.getActiveSpreadsheet().toast(
                `${result.success.length}/${result.total}個のファイルをプッシュしました（${result.failed.length}個失敗）`,
                '⚠️ 一部失敗',
                10
            );
        }
        
        return result;
        
    } catch (error) {
        Logger.log('✗ エラー: ' + error.message);
        SpreadsheetApp.getActiveSpreadsheet().toast(
            'エラー: ' + error.message,
            '✗ 失敗',
            10
        );
        throw error;
    }
}
