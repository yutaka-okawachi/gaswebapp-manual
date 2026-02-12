/**
 * Unified Web Trigger for Automated Deployment and Search Notifications
 * 
 * This script handles:
 * 1. GET/POST requests for administrative tasks (sync-data.ps1)
 * 2. POST requests for search notifications from GitHub Pages
 */

const SECRET_TOKEN = PropertiesService.getScriptProperties().getProperty('GAS_SECRET_TOKEN');

// --- Global Mappings & Helpers ---

const pageNameMap = {
  'mahler.html': '曲名と楽器から検索 (GM)',
  'terms_search.html': '用語から検索 (GM)',
  'rs_terms_search.html': '用語から検索 (RS)',
  'rw_terms_search.html': '用語から検索 (RW)',
  'richard_strauss.html': '曲名から検索 (RS)',
  'richard_strauss': '曲名から検索 (RS)',
  'richard_wagner.html': '曲名から検索 (RW)',
  'richard_wagner': '曲名から検索 (RW)',
  'other.html': 'その他 (Other)'
};

const operaNameMap_RS = {
  'guntram': 'Guntram, Op.25', 'feuersnot': 'Feuersnot, Op.50', 'salome': 'Salome, Op.54',
  'elektra': 'Elektra, Op.58', 'rosenkavalier': 'Der Rosenkavalier, Op.59', 'ariadne': 'Ariadne auf Naxos, Op.60',
  'schatten': 'Die Frau ohne Schatten, Op.65', 'intermezzo': 'Intermezzo, Op.72', 'helena': 'Die ägyptische Helena, Op.75',
  'arabella': 'Arabella, Op.79', 'schweigsame': 'Die schweigsame Frau, Op.80', 'tag': 'Friedenstag, Op.81',
  'daphne': 'Daphne, Op.82', 'danae': 'Die Liebe der Danae, Op.83', 'cap': 'Capriccio, Op.85'
};

const operaNameMap_RW = {
  'feen': 'Die Feen, WWV 32', 'liebes': 'Das Liebesverbot, WWV 38', 'rienzi': 'Rienzi, WWV 49',
  'holländer': 'Der fliegende Holländer, WWV 63', 'tann_dresden': 'Tannhäuser, WWV 70 (Dresden)',
  'tann_paris': 'Tannhäuser, WWV 70 (Paris)', 'lohengrin': 'Lohengrin, WWV 75',
  'rheingold': 'Das Rheingold, WWV 86A', 'walküre': 'Die Walküre, WWV 86B', 'siegfried': 'Siegfried, WWV 86C',
  'götter': 'Götterdämmerung, WWV 86D', 'tristan': 'Tristan und Isolde, WWV 90',
  'meister': 'Die Meistersinger von Nürnberg, WWV 96', 'parsifal': 'Parsifal, WWV 111'
};

const instrumentMap = {
  'v1': 'Violine1', 'v2': 'Violine2', 'va': 'Bratsche', 'vc': 'Violoncello', 'kb': 'Kontrabaß',
  'sv': 'Solo Violine', 'sva': 'Solo Bratsche', 'svc': 'Solo Violoncello', 'skb': 'Solo Kontrabaß',
  'fl': 'Flöte', 'pic': 'Piccolo', 'ob': 'Oboe', 'eh': 'Englischhorn', 'cl': 'Klarinette',
  'escl': 'Es-Klarinette', 'bcl': 'Bassklarinette', 'fg': 'Fagott', 'cfg': 'Kontrafagott',
  'tr': 'Trompete', 'pis': 'Piston', 'phr': 'Posthorn', 'hr': 'Horn', 'thr': 'Tenorhorn',
  'ohr': 'Obligates Horn', 'fhr': 'Flügelhorn', 'whr': 'Waldhorn', 'pos': 'Posaune', 'bt': 'Basstuba',
  'pau': 'Pauken', 'gtr': 'Große Trommel', 'ktr': 'Kleine Trommel', 'mtr': 'Militär Trommel',
  'bec': 'Becken', 'tam': 'Tam-tam', 'tri': 'Triangel', 'gls': 'Glockenspiel', 'hgl': 'Herdenglocken',
  'gl': 'Glocken', 'ham': 'Hammer', 'rt': 'Rute', 'cel': 'Celesta', 'hp': 'Harfe', 'org': 'Orgel',
  'klv': 'Klavier', 'har': 'Harmonium', 'git': 'Gitarre', 'man': 'Mandoline',
  'sop': 'Sopran', 'alt': 'Alto', 'ten': 'Tenor', 'bar': 'Bariton', 'bass': 'Bass',
  'sop1': 'Sopran1', 'sop2': 'Sopran2', 'alt1': 'Alto1', 'alt2': 'Alto2',
  'kalt': 'Knabenstimme Alto', 'chor': 'Chor', 'chor1': 'Chor1', 'chor2': 'Chor2',
  'fchor': 'Frauenchor', 'kchor': 'Knabenchor', 'sti': 'Stimme', 'dir': 'Dirigent',
  'all_strings': '弦楽器群', 'all_woodwinds': '木管楽器群', 'all_brass': '金管楽器群',
  'all_percussions': '打楽器群など', 'all_vocal': '声楽・合唱'
};

// Helper function for empty values
const getValue = (val) => (val && val !== "N/A") ? val : "未指定";

const translateWork = (work, page) => {
  if (!work || work === "N/A") return "未指定";
  if (work === "All (GM)") return "全作品";
  if (work === "Mahler Search") return "マーラー検索";
  const key = work.toLowerCase();
  
  // RS/RW mapping
  if (page && (page.includes('richard_strauss') || page.includes('(RS)'))) return operaNameMap_RS[key] || work;
  if (page && (page.includes('richard_wagner') || page.includes('(RW)'))) return operaNameMap_RW[key] || work;
  
  return work;
};

const translateScope = (scope, work, type) => {
  if (!scope || scope === "N/A") return "未指定";
  if (scope === "Term") return "用語検索";
  if (scope === "Mahler Search") return "曲名・楽器検索";
  if (scope === "Scene Search") return "場面検索";
  if (scope === "Page Search") return "ページ検索";
  if (scope.toLowerCase() === "all_global") return "全楽器";
  if (scope.indexOf("Page ") === 0) return "ページ番号: " + scope.substring(5);
  
  const workKey = work ? work.toLowerCase() : "";
  const singleActWorks = ['elektra', 'salome', 'feuersnot', 'daphne', 'tag', 'rheingold'];
  
  const isSingleAct = singleActWorks.includes(workKey);

  if (scope === "all") {
      if (type === 'instrument') {
          return "全楽器";
      }
      return isSingleAct ? "全一幕" : "全場面";
  }

  // --- Scene Code Translation Logic (RS/RW/GM) ---
  if (type === 'scene') {
      try {
          let sheetName = '幕構成'; // Default for GM
          if (operaNameMap_RS[workKey]) {
              sheetName = 'RS幕構成';
          } else if (operaNameMap_RW[workKey]) {
              sheetName = 'RW幕構成';
          }

          // Try to get map from global scope (mahler.js)
          // Using strict try-catch to avoid ReferenceError if not available
          let sceneMap = null;
          try {
             sceneMap = getSceneMap(sheetName);
          } catch(e) {
             // Function not found or spreadsheet error
             Logger.log("getSceneMap not available or failed: " + e.message);
          }

          if (sceneMap) {
               const parts = scope.split(',').map(p => p.trim());
               const resolvedParts = parts.map(part => {
                   // Handle standard "all" / "-" cases first or let map handle them?
                   // Map keys are specific scenes.
                   // "all" is handled above.
                   
                   let normWork = localNormalize(workKey);
                   let normPart = localNormalize(part);
                   
                   // Try 1: Exact Match (e.g. "1-1")
                   let key = normWork + '-' + normPart;
                   if (sceneMap[key]) return sceneMap[key];
                   
                   // Try 2: Space to Hyphen (e.g. "V zu Seite" -> "v-zu seite")
                   // Note: normalize removed extra spaces, but if part was "V zu", it stays "v zu"
                   // We want "v-zu" ? Or strictly match spreadsheet format.
                   // Spreadsheet keys are usually "oper-aufzug-szene".
                   // If "V zu Seite" comes as one string, it might be Auftritt V? No.
                   // Let's assume input might be "1 1" meant as "1-1".
                   let key2 = normWork + '-' + normPart.replace(/\s+/g, '-');
                   if (sceneMap[key2]) return sceneMap[key2];

                   // Try 3: Implicit Act 0 (e.g. "SceneName" -> "0-SceneName")
                   let key3 = normWork + '-0-' + normPart;
                   if (sceneMap[key3]) return sceneMap[key3];

                   // Retain original functionality for fallback
                   return null;
               });
               
               // If we found translations for ALL parts, return them. 
               // (Or even if partial? Better to show readable text if possible)
               // Strategy: If resolved is not null, use it. Else use part (original).
               // But we need to fall through to the numeric parsing logic below if null.
               
               // Let's modify the 'parts' calculation below.
               // We can't return early unless we are sure.
               // But complex mixing is hard.
               // If ALL parts are found in map, return immediately.
               if (resolvedParts.every(r => r !== null)) {
                   return resolvedParts.join(', ');
               }
          }
      } catch (e) {
          Logger.log("Scene translation error: " + e.toString());
      }
  }

  const sceneTermMap = { 'einleitung': '導入部', 'vorspiel': '前奏曲', 'introduction': '導入部', 'prelude': '前奏曲', 'finale': 'フィナーレ' };
  const parts = scope.split(',').map(p => p.trim());

  const results = parts.map(part => {
    if (part === "all") { 
        if (type === 'instrument') return "全楽器";
        return isSingleAct ? "全一幕" : "全場面"; 
    }
    // Case for empty Aufzug + empty Szene (e.g. Elektra "Whole Act") -> "-"
    if (part === "-" || part === "") { return "全一幕"; } // Assuming blank/hyphen in scene context implies whole work/act
    
    // Case for "1-" (Daphne, Friedenstag Whole Act)
    if (part === "1-" && (workKey === 'daphne' || workKey === 'tag')) {
        return "全一幕";
    }

    // Case for empty Aufzug + specific Szene (e.g. Salome "-1")
    const noActMatch = /^-(\d+)$/.exec(part);
    if (noActMatch) {
         return "第" + noActMatch[1] + "場";
    }

    // Case for empty Aufzug + text Szene (e.g. Capriccio "-einleitung")
    const noActTerm = /^-(.+)$/.exec(part);
    if (noActTerm) {
         const term = noActTerm[1];
         return sceneTermMap[term.toLowerCase()] || term;
    }

    const numericMatch = /^(\d+)(-(\d*))?$/.exec(part);
    if (numericMatch) {
      const aufzug = numericMatch[1], szene = numericMatch[3];
      return "第" + aufzug + "幕" + (szene ? "第" + szene + "場" : (aufzug ? "（全体）" : ""));
    }
    const mixedMatch = /^(\d+)-(.+)$/.exec(part);
    if (mixedMatch) {
      return "第" + mixedMatch[1] + "幕" + (sceneTermMap[mixedMatch[2].toLowerCase()] || mixedMatch[2]);
    }
    if (sceneTermMap[part.toLowerCase()]) { return sceneTermMap[part.toLowerCase()]; }
    return instrumentMap[part.toLowerCase()] || part;
  });

  return results.join(', ');
};

/**
 * HTTP POST handler
 */
function doPost(e) {
  Logger.log("doPost triggered");
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Route 1: Search Notification
    if (data.work && data.page && !data.token && !data.action) {
        return handleSearchNotification(data);
    }
    
    // Route 2: Administrative Tasks
    return handleRequest(data);
    
  } catch (error) {
    Logger.log("Error in doPost: " + error.toString());
    return createJsonResponse({
      status: "error",
      error: "Invalid request payload: " + error.toString()
    }, 400);
  }
}

/**
 * Administrative Request Handler
 */
function handleRequest(params) {
  try {
    const token = params.token;
    const action = params.action || params.function;
    
    if (!token || token !== SECRET_TOKEN) {
      return createJsonResponse({ status: "error", error: "Unauthorized" }, 401);
    }
    
    let result;
    if (action === "exportDic" || action === "exportAllDataToJson") {
      exportAllDataToJson();
      result = { status: "success", message: "Export success" };
    } else if (action === "ping") {
      result = { status: "success", message: "Pong" };
    } else {
      result = { status: "error", error: "Unknown action" };
    }
    return createJsonResponse(result);
  } catch (error) {
    return createJsonResponse({ status: "error", error: error.toString() }, 500);
  }
}

/**
 * Search Notification Handler
 */
function handleSearchNotification(data) {
  try {
    const pageRaw = getValue(data.page);
    const pageTitle = pageNameMap[pageRaw] || pageRaw;
    const workFull = translateWork(data.work, pageRaw);
    const term = getValue(data.term);
    const workKey = data.work; // Pass raw work key
    
    // Determine Search Type
    let searchType = 'INSTRUMENT';
    if (data.scope === '用語検索' || data.scope === 'Term') {
        searchType = 'TERM';
    } else if (term === 'Scene Search' || term === '場面検索') {
        searchType = 'SCENE';
    } else if (term === 'Page Search' || term === 'ページ検索') {
        searchType = 'PAGE';
    } else if (term === 'Whom Search' || term === '指示対象検索') {
        searchType = 'WHOM';
    } else {
        searchType = 'INSTRUMENT';
    }

    const formattedDate = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
    const subject = "【検索通知】: "+ workFull;

    // 表示用ラベルとコンテンツの決定
    let searchTypeDisplay = "曲名・楽器検索";
    let detailLabel = "詳細";
    let detailContent = "";

    if (searchType === 'TERM') {
        searchTypeDisplay = "用語検索";
        detailLabel = "検索語";
        detailContent = term;
    } else if (searchType === 'SCENE') {
        searchTypeDisplay = "場面検索";
        detailLabel = "場面";
        detailContent = translateScope(data.scope, workKey, 'scene');
    } else if (searchType === 'PAGE') {
        searchTypeDisplay = "ページ検索";
        detailLabel = "ページ番号";
        detailContent = data.scope.replace("ページ番号: ", "");
    } else if (searchType === 'WHOM') {
        searchTypeDisplay = "指示対象検索";
        detailLabel = "指示対象";
        detailContent = data.scope;
    } else {
        // INSTRUMENT
        searchTypeDisplay = "曲名・楽器検索";
        detailLabel = "楽器";
        // 楽器検索のコンテキスト ('instrument') を渡す
        detailContent = translateScope(data.scope, workKey, 'instrument');
    }

    // メール本文
    let body = "■ 検索内容\n" +
               "【作品】 " + workFull + "\n" +
               "【タイプ】 " + searchTypeDisplay + "\n" +
               "【" + detailLabel + "】 " + detailContent + "\n";

    if (data.includeGlobal) {
        body += "【全体検索】 はい (全体を含む)\n";
    }

    body += "【日時】 " + formattedDate + "\n\n" +
            "■ 検索元\n" +
            "【ページ】 " + pageTitle + "\n\n" +
            "■ ユーザー環境\n" +
            getValue(data.userAgent);
                
    const recipient = 'pistares@ezweb.ne.jp';
    try {
      MailApp.sendEmail(recipient, subject, body);
    } catch (e) {
      Logger.log("Email sending failed: " + e.toString());
    }
    
    // Log to Spreadsheet
    logToSpreadsheet(data, body);
    
    return createJsonResponse({status: "success"});
      
  } catch (error) {
    Logger.log("Error in handleSearchNotification: " + error.toString());
    return createJsonResponse({status: "error", error: error.toString()}, 500);
  }
}

/**
 * Log search history to Spreadsheet
 */
/**
 * Log search history to Spreadsheet
 */
function logToSpreadsheet(data, detail) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = '検索履歴';
    let sheet = ss.getSheetByName(sheetName);
    
    // Standard headers definition
    const standardHeaders = ['日時', 'Work', 'Page', 'Term', 'Instruments', 'Global', 'Szene', 'Whom', 'Page_Num', 'UserAgent', '詳細'];

    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(standardHeaders);
    }
    
    // Read existing headers
    // If sheet is empty (no last row), set standard headers
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(standardHeaders);
    }

    // Get actual headers from the first row
    const lastCol = sheet.getLastColumn();
    let existingHeaders = [];
    if (lastCol > 0) {
      existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    } else {
      // Should not happen if we just appended, but safe fallback
      existingHeaders = standardHeaders;
    }
    
    // Prepare data
    const timestamp = new Date();
    const safeStr = (val) => (val && val !== 'N/A') ? String(val) : '';
    
    const pageRaw = safeStr(data.page);
    const pageTitle = pageNameMap[pageRaw] || pageRaw;
    
    const workRaw = safeStr(data.work);
    const workFull = translateWork(workRaw, pageRaw);
    
    const termParam = safeStr(data.term);
    const scopeRaw = safeStr(data.scope);

    // Initialize data map with keys matching potential headers
    const dataMap = {
        '日時': timestamp,
        'Work': workFull,
        'Page': pageTitle,
        'Term': '',
        'Instruments': '',
        'Global': '',
        'Szene': '',
        'Whom': '',
        'Page_Num': '',
        'UserAgent': safeStr(data.userAgent),
        '詳細': detail
    };

    // Logic to populate specific fields based on search type
    if (scopeRaw === '用語検索' || scopeRaw === 'Term') {
        dataMap['Term'] = termParam;
    } else if (termParam === 'Mahler Search' || termParam === '曲名・楽器検索') {
        dataMap['Instruments'] = translateScope(scopeRaw, workRaw, 'instrument');
        dataMap['Global'] = data.includeGlobal ? 'Yes' : 'No';
    } else if (termParam === 'Scene Search' || termParam === '場面検索') {
        dataMap['Szene'] = translateScope(scopeRaw, workRaw, 'scene');
    } else if (termParam === 'Page Search' || termParam === 'ページ検索') {
        dataMap['Page_Num'] = scopeRaw.replace('Page: ', '').replace('ページ番号: ', '');
    } else if (termParam === 'Whom Search' || termParam === '指示対象検索') {
        dataMap['Whom'] = scopeRaw;
    } else {
        // Fallback or other types (e.g. Terms search via different path)
        if (termParam !== 'Mahler Search' && termParam !== '曲名・楽器検索') {
             // Maybe populate Term if it looks like a term?
             // Respecting user request: "Term" is for '用語から検索'.
        }
    }

    // Construct the row array based on the ORDER of existingHeaders
    const row = existingHeaders.map(header => {
        // Match header name to dataMap key (exact match expected)
        // If header is unknown, leave blank/undefined (GAS handles undefined as empty cell usually, or use '')
        return dataMap[header] || '';
    });
    
    // Append row
    sheet.appendRow(row);
    
  } catch (e) {
    Logger.log("Failed to log to spreadsheet: " + e.toString());
  }
}

/**
 * Local helper for string normalization (Matches mahler.js logic)
 */
function localNormalize(str) {
  if (typeof str !== 'string') return '';
  return str.toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .trim();
}

/**
 * JSON Helper
 */
function createJsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
  if (statusCode) data.httpStatus = statusCode;
  return output;
}
