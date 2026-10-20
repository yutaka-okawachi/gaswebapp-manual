// SPREADSHEET_ID is defined in mahler.js

// sync-dataが読む列の見出し名。列はこの名前で探すため、タブ内で列を並べ替えても結果は変わらない。
// 配列の順序は出力JSONの項目順・位置を表す（シート上の列順とは無関係）。
// 略記一覧は見出し行がない（1行目が空行）ため、従来どおりA:C列の位置で読む。
const EXPORT_SHEET_HEADERS = Object.freeze({
    GM: ['de', 'de_normalized', 'ja', 'data'],
    RS: ['Oper', 'Aufzug', 'Szene', 'page', 'whom', 'de', 'de_normalized', 'ja'],
    RW: ['Oper', 'Aufzug', 'Szene', 'page', 'whom', 'de', 'de_normalized', 'ja'],
    Notes: ['de', 'ja', 'source'],
    '語形対応': ['見出し', '関連語形', '語形区分', '用語検索', '実例検索', '補足'],
    'RS幕構成': ['Oper', 'Aufzug', 'Szene', '日本語'],
    'RW幕構成': ['Oper', 'Aufzug', 'Szene', '日本語'],
    '楽譜情報': ['Oper', 'Publisher']
});
const EXPORT_POSITIONAL_SHEETS = Object.freeze({ '略記一覧': 3 });


// Optional authenticated bilingual envelope; it never changes the Japanese public file schema.
const ENGLISH_EXPORT_HEADERS = Object.freeze({
 GM: ['de','de_normalized','ja','en','data'],
 RW: ['Oper','Aufzug','Szene','page','whom','whom_en','de','de_normalized','ja','en'],
 RS: ['Oper','Aufzug','Szene','page','whom','whom_en','de','de_normalized','ja','en'],
 Notes: ['de','ja','en','source']
});
function buildEnglishExportSource_(tables, options) {
 const tabs = {};
 Object.keys(ENGLISH_EXPORT_HEADERS).forEach(name => {
  const table = tables[name], names = ENGLISH_EXPORT_HEADERS[name];
  tabs[name] = table.values.slice(1).map((values,index) => {
   const row = {__row:index+2};
   names.forEach(key => row[key] = values[table.englishColumns[key]] === undefined ? '' : values[table.englishColumns[key]]);
   return row;
  }).filter(row => name === 'GM' ? row.de || row.data : name === 'Notes' || EXPORT_SHEET_HEADERS[name].some(key => row[key] !== ''));
 });
 return {schema:1,requestId:String(options.requestId || ''),sourceHash:typeof SYNC_SOURCE_HASH === 'string' ? SYNC_SOURCE_HASH : '',readAt:new Date().toISOString(),tabs:tabs,termMappings:pickExportRows_(tables['語形対応']).filter(row => String(row[0] || '').trim() && String(row[1] || '').trim())};
}

function exportAllDataToJson(options) {
    const settings = options || {};
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(1000)) throw new Error('データ生成が実行中です。少し待って再実行してください。');
    try {
        return buildExportSnapshot_(settings);
    } finally {
        lock.releaseLock();
    }
}

function buildExportSnapshot_(exportOptions) {
    // 最新データを取得するためにキャッシュを確実にクリア
    const cache = CacheService.getScriptCache();
    const cacheKeys = [
        'mahler_data_v2', 'richard_strauss_data_v2', 'richard_wagner_data_v2',
        'rw_de_terms_cache_v2', 'rs_de_terms_cache_v2', 'whom_options_v1',
        'dic_terms_index_v1', 'dic_terms_index_v2'
    ];
    cacheKeys.forEach(key => {
        // 通常のキャッシュ削除
        cache.remove(key);
        // チャンクキャッシュの削除（安全のため多めに回す）
        cache.remove(key + '_count');
        for (let i = 0; i < 20; i++) {
            cache.remove(`${key}_${i}`);
        }
    });
    
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    // 各タブは1回だけ読み、見出し名から列位置を解決した結果を以降の処理で共有する
    const tables = validateExportSheets_(ss, exportOptions.includeEnglish === true);

    // 0. Score Info (楽譜情報) - Load first for Publisher info
    const scoreMap = {}; // Map for Publisher info (Opera -> Publisher)
    // sceneTitleMap will be populated from Scene Structure sheets
    pickExportRows_(tables['楽譜情報']).forEach(row => {
        // [Oper, Publisher]
        const opera = String(row[0]).toLowerCase().trim();
        if (opera) {
            // Publisher Info - Last one wins if multiple
            scoreMap[opera] = row[1];
        }
    });

    // 0.5 Scene Title Map (from RS幕構成 / RW幕構成)
    const sceneTitleMap = {}; // Map for Scene Titles (Opera_Act_Scene -> Title)
    
    const populateSceneMap = (sheetName) => {
        // [Oper, Aufzug, Szene, 日本語]
        pickExportRows_(tables[sheetName]).forEach(row => {
            const opera = String(row[0]).toLowerCase().trim();
            const aufzug = row[1];
            const szene = row[2];
            const title = row[3]; // Japanese Title

            if (opera && title) {
                const key = `${opera}_${aufzug}_${szene}`.toLowerCase();
                sceneTitleMap[key] = title;
            }
        });
    };

    populateSceneMap('RS幕構成');
    populateSceneMap('RW幕構成');

    // 1. Mahler Data (GM)
    // Convert to object array for better readability/safety
    const mahlerJson = pickExportRows_(tables.GM).map(row => ({
        de: row[0],
        de_normalized: row[1],
        ja: row[2],
        data: row[3]
    })).filter(item => item.de || item.data); // Filter out empty rows

    // 2. / 3. Richard Strauss (RS) / Richard Wagner (RW)
    // 項目順は EXPORT_SHEET_HEADERS の順に固定し、シート上の列順に左右されないようにする
    const buildOperaRows = (sheetName) => {
        const names = EXPORT_SHEET_HEADERS[sheetName];
        return pickExportRows_(tables[sheetName]).map(values => {
            let obj = {};
            names.forEach((h, i) => {
                obj[h] = values[i];
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
    };
    const rsJson = buildOperaRows('RS');
    const rwJson = buildOperaRows('RW');

    // 5. 指示対象 (whom) の抽出: RS / RW の whom 列をオペラ毎に集計して出力
    const whomMap = {};
    const collectWhomFromRows = (rows) => {
        rows.forEach(item => {
            const operKey = String((item['Oper'] || item['oper'] || '')).toLowerCase().trim();
            const whomField = String(item['whom'] || item['Whom'] || '').trim();
            const pageField = String(item['page'] ?? item['Page'] ?? '').trim(); // D列に対応

            // Operが空、またはWhomが空、またはPageが空の場合はスキップ
            // 空文字列 ("") も確実に弾くように .trim() と併用
            if (!operKey || !whomField || !pageField) return;

            // オペラ名が極端に長い（30文字以上）場合は、スプレッドシートの入力ミスまたは
            // ト書き行の誤検知の可能性が高いためスキップする（安全策）
            if (operKey.length > 30) return;

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
    // 必須見出しを固定順で先頭に置き、それ以外の見出し付き列（作品名など）はシート上の順で後ろに続ける
    const buildSceneRows = (sheetName) => {
        const table = tables[sheetName];
        const required = EXPORT_SHEET_HEADERS[sheetName];
        const extras = table.header
            .map((h, i) => ({ h, i }))
            .filter(item => item.h && required.indexOf(item.h) === -1);
        const seen = new Set();
        extras.forEach(item => {
            if (seen.has(item.h)) throw new Error('列名が重複しています: ' + sheetName + ':' + item.h);
            seen.add(item.h);
        });
        const order = required.map(h => ({ h, i: table.columns[h] })).concat(extras);
        return table.values.slice(1).map(row => {
            let obj = {};
            order.forEach(item => obj[item.h] = row[item.i]);
            return obj;
        });
    };
    const rsScenes = buildSceneRows('RS幕構成');
    const rwScenes = buildSceneRows('RW幕構成');

    // 7. Dictionary Notes (Notes sheet)
    // dic.html uses [German (de), Translation (ja), Source (source)]
    const dicNotesJson = pickExportRows_(tables.Notes);

    // 本番用の見出し・関連語形対応（見出し〜補足の6項目）
    const termMappingData = pickExportRows_(tables['語形対応'])
        .filter(row => String(row[0] || '').trim() && String(row[1] || '').trim());
    validateDictionaryTermMapping_(dicNotesJson, termMappingData);

    // 8. Abbreviation List (略記一覧)
    // 見出し行がないため位置で読む（1行目は空行としてスキップ）
    // dic.html uses columns A, B, C
    const abbrJson = tables['略記一覧'].values.slice(1).map(row => [row[0], row[1], row[2]]);

    // 9. 「実例を見る」用の分割データを生成
    const dictionaryExampleData = buildDictionaryExampleShardFiles(dicNotesJson, {
        mahler: mahlerJson,
        wagner: rwJson,
        strauss: rsJson
    }, termMappingData);
    Logger.log('実例検索用JSON生成完了: ' + Object.keys(dictionaryExampleData.files).length + ' ファイル');

    // 10. Generate dic.html (静的HTML生成 - リンク機能付き)
    Logger.log('=== dic.htmlを生成中（リンク機能付き） ===');
    const dicHtml = generateDicHtml(dicNotesJson, abbrJson, dictionaryExampleData.queryIndex, termMappingData);
    Logger.log('dic.html生成完了: ' + Math.round(dicHtml.length / 1024) + ' KB');
    
    // 11. 用語インデックスを生成
    const termsIndex = generateDicTermsIndex(dicNotesJson, termMappingData);
    Logger.log('dic_terms_index.json生成完了: ' + Object.keys(termsIndex).length + ' 件');

    // キャッシュを無効化（サーバーサイド検索用）
    CacheService.getScriptCache().remove('dic_terms_index_v1');
    CacheService.getScriptCache().remove('dic_terms_index_v2');

    // 検証済みの生成結果をローカル同期へ返す
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
    Object.assign(files, dictionaryExampleData.files);

    const snapshot = {
        schemaVersion: 1,
        requestId: String(exportOptions.requestId || ''),
        sourceHash: typeof SYNC_SOURCE_HASH === 'string' ? SYNC_SOURCE_HASH : '',
        files: files
    };
    if (exportOptions.includeEnglish === true) snapshot.englishSource = buildEnglishExportSource_(tables, exportOptions);
    return snapshot;
}

/**
 * 必須タブを読み込み、見出し名から列位置を解決する。
 * 必須見出しの欠落・重複があれば、公開データを作る前に停止する。
 * @return {Object<string, {values: Array[], header: string[], columns: Object<string, number>}>}
 */
function validateExportSheets_(ss, includeEnglish) {
    const tables = {};
    const names = Object.keys(EXPORT_SHEET_HEADERS).concat(Object.keys(EXPORT_POSITIONAL_SHEETS));
    names.forEach(name => {
        const sheet = ss.getSheetByName(name);
        if (!sheet) throw new Error('必須シートが欠落しています: ' + name);
        const values = sheet.getDataRange().getValues();
        if (!values.length) throw new Error('必須列が不足しています: ' + name);
        if (EXPORT_POSITIONAL_SHEETS[name]) {
            if (values[0].length < EXPORT_POSITIONAL_SHEETS[name]) throw new Error('必須列が不足しています: ' + name);
            tables[name] = { values: values, header: [], columns: {} };
            return;
        }
        const header = values[0].map(normalizeExportHeader_);
        tables[name] = { values: values, header: header, columns: resolveExportColumns_(name, header, EXPORT_SHEET_HEADERS[name]) };
        if (includeEnglish && ENGLISH_EXPORT_HEADERS[name]) tables[name].englishColumns = resolveExportColumns_(name, header, ENGLISH_EXPORT_HEADERS[name]);
    });
    return tables;
}

function normalizeExportHeader_(value) {
    return String(value === null || value === undefined ? '' : value).normalize('NFC').trim();
}

/** 見出し名ごとの列番号（0始まり）を返す。欠落・重複は誤った列を公開しないよう停止する。 */
function resolveExportColumns_(sheetName, header, requiredHeaders) {
    const columns = {};
    requiredHeaders.forEach(name => {
        const first = header.indexOf(name);
        if (first === -1) throw new Error('必須列が不足しています: ' + sheetName + ':' + name);
        if (header.indexOf(name, first + 1) !== -1) throw new Error('列名が重複しています: ' + sheetName + ':' + name);
        columns[name] = first;
    });
    return columns;
}

/** データ行（2行目以降）を EXPORT_SHEET_HEADERS の順に並べた配列へ変換する。 */
function pickExportRows_(table) {
    const names = Object.keys(table.columns);
    return table.values.slice(1).map(row => names.map(name => {
        const value = row[table.columns[name]];
        return value === undefined ? '' : value;
    }));
}

function validateDictionaryTermMapping_(dicNotesData, mappingData) {
    const headings = new Set(dicNotesData.map(row => normalizeForId(String(row[0] || ''))).filter(Boolean));
    const pairs = new Set();
    mappingData.forEach((row, index) => {
        const heading = normalizeForId(String(row[0] || ''));
        const related = normalizeForId(String(row[1] || ''));
        // ID用正規化は別綴りや句読点の違いも潰すため、重複検査には使わない。
        const pairHeading = String(row[0] || '').normalize('NFC').trim().toLowerCase().replace(/[\s\u3000]+/g, ' ');
        const pairRelated = String(row[1] || '').normalize('NFC').trim().toLowerCase().replace(/[\s\u3000]+/g, ' ');
        const pair = `${pairHeading}\u0000${pairRelated}`;
        if (!headings.has(heading)) throw new Error(`語形対応の見出しがNotesにありません: ${index + 2}`);
        if (pairs.has(pair)) throw new Error(`語形対応の組合せが重複しています: ${index + 2}`);
        pairs.add(pair);
        if (!['対象', '対象外'].includes(String(row[3] || '').trim()) ||
            !['対象', '対象外'].includes(String(row[4] || '').trim())) {
            throw new Error(`語形対応の検索対象指定が不正です: ${index + 2}`);
        }
    });
}
