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
  'index.html': '曲名と楽器から検索 (GM)',
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

const translateScope = (scope) => {
  if (!scope || scope === "N/A") return "未指定";
  if (scope === "Term") return "用語検索";
  if (scope === "Mahler Search") return "曲名・楽器検索";
  if (scope === "Scene Search") return "場面検索";
  if (scope === "Page Search") return "ページ検索";
  if (scope.toLowerCase() === "all_global") return "全楽器";
  if (scope.indexOf("Page ") === 0) return "ページ番号: " + scope.substring(5);
  if (scope === "all") return "全場面";

  const sceneTermMap = { 'einleitung': '導入部', 'vorspiel': '前奏曲', 'introduction': '導入部', 'prelude': '前奏曲', 'finale': 'フィナーレ' };
  const parts = scope.split(',').map(p => p.trim());

  const results = parts.map(part => {
    if (part === "all") { return "全場面"; }
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
    
    // Whom Searchの場合は scope の変換をスキップ
    let scope;
    if (term === "Whom Search") {
      scope = data.scope;
    } else {
      scope = translateScope(data.scope);
    }

    const formattedDate = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
    const subject = "【マーラー検索】検索通知: " + workFull;

    // 表示用ラベル
    let searchTypeDisplay = "曲名・楽器検索";
    let detailLabel = "詳細";
    let detailContent = scope;

    if (term === "Scene Search") {
      searchTypeDisplay = "場面検索";
      detailLabel = "場面";
    } else if (term === "Page Search") {
      searchTypeDisplay = "ページ検索";
      detailLabel = "ページ番号";
      detailContent = scope.replace("ページ番号: ", "");
    } else if (term === "Whom Search") {
      searchTypeDisplay = "指示対象検索";
      detailLabel = "指示対象";
    } else if (data.scope === "用語検索") {
      searchTypeDisplay = "用語検索";
      detailLabel = "検索語";
      detailContent = term;
    } else {
      detailLabel = "楽器";
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
    if (scopeRaw === '用語検索') {
        dataMap['Term'] = termParam;
    } else if (termParam === 'Mahler Search' || termParam === '曲名・楽器検索') {
        dataMap['Instruments'] = translateScope(scopeRaw);
        dataMap['Global'] = data.includeGlobal ? 'Yes' : 'No';
    } else if (termParam === 'Scene Search' || termParam === '場面検索') {
        dataMap['Szene'] = translateScope(scopeRaw);
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
 * JSON Helper
 */
function createJsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
  if (statusCode) data.httpStatus = statusCode;
  return output;
}
