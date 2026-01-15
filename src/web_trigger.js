/**
 * Unified Web Trigger for Automated Deployment and Search Notifications
 * 
 * This script handles:
 * 1. GET/POST requests for administrative tasks (sync-data.ps1)
 * 2. POST requests for search notifications from GitHub Pages
 */

const SECRET_TOKEN = PropertiesService.getScriptProperties().getProperty('GAS_SECRET_TOKEN');

/**
 * HTTP POST handler
 * 
 * Note: doGet関数はmahler.jsに統合されました。
 * mahler.jsのdoGet関数が、tokenパラメータの有無に基づいて
 * 管理APIリクエスト（token有り）とWeb UIリクエスト（token無し）を
 * 自動的に振り分けます。
 */
function doPost(e) {
  Logger.log("doPost triggered");
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Route 1: Search Notification (no auth token required for public search feedback)
    if (data.work && data.page && !data.token && !data.action) {
        return handleSearchNotification(data);
    }
    
    // Route 2: Administrative Tasks (requires SECRET_TOKEN)
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
 * Administrative Request Handler (clasp push / sync-data)
 */
function handleRequest(params) {
  try {
    const token = params.token;
    const action = params.action || params.function;
    
    if (!token || token !== SECRET_TOKEN) {
      return createJsonResponse({
        status: "error",
        error: "Unauthorized: Invalid or missing token"
      }, 401);
    }
    
    let result;
    if (action === "exportDic" || action === "exportAllDataToJson") {
      Logger.log("Starting exportAllDataToJson...");
      exportAllDataToJson();
      result = {
        status: "success",
        message: "dic.html exported and pushed to GitHub successfully",
        timestamp: new Date().toISOString()
      };
    } else if (action === "ping") {
      result = {
        status: "success",
        message: "Web trigger is working correctly",
        timestamp: new Date().toISOString()
      };
    } else {
      result = {
        status: "error",
        error: "Unknown action: " + action
      };
    }
    
    return createJsonResponse(result);
    
  } catch (error) {
    Logger.log("Error in handleRequest: " + error.toString());
    return createJsonResponse({
      status: "error",
      error: error.toString()
    }, 500);
  }
}

/**
 * Search Notification Handler
 */
function handleSearchNotification(data) {
  try {
    // Helper function for empty values
    const getValue = (val) => (val && val !== "N/A") ? val : "未指定";
    
    // Mappings
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
      let hasAnyScenePattern = false;

      const results = parts.map(part => {
        if (part === "all") { hasAnyScenePattern = true; return "全場面"; }
        const numericMatch = /^(\d+)(-(\d*))?$/.exec(part);
        if (numericMatch) {
          hasAnyScenePattern = true;
          const aufzug = numericMatch[1], szene = numericMatch[3];
          return "第" + aufzug + "幕" + (szene ? "第" + szene + "場" : (aufzug ? "（全体）" : ""));
        }
        const mixedMatch = /^(\d+)-(.+)$/.exec(part);
        if (mixedMatch) {
          hasAnyScenePattern = true;
          return "第" + mixedMatch[1] + "幕" + (sceneTermMap[mixedMatch[2].toLowerCase()] || mixedMatch[2]);
        }
        if (sceneTermMap[part.toLowerCase()]) { hasAnyScenePattern = true; return sceneTermMap[part.toLowerCase()]; }
        return instrumentMap[part.toLowerCase()] || part;
      });

      return results.join(', ');
    };

    const translateWork = (work, page) => {
      if (!work || work === "N/A") return "未指定";
      if (work === "All (GM)") return "全作品";
      if (work === "Mahler Search") return "マーラー検索";
      const key = work.toLowerCase();
      if (page && (page.includes('richard_strauss') || page.includes('(RS)'))) return operaNameMap_RS[key] || work;
      if (page && (page.includes('richard_wagner') || page.includes('(RW)'))) return operaNameMap_RW[key] || work;
      return work;
    };

    const page = getValue(data.page);
    const work = translateWork(data.work, page);
    const term = getValue(data.term);
    
    // Whom Searchの場合は scope の変換をスキップしてそのまま使う
    let scope;
    if (term === "Whom Search") {
      scope = data.scope;
    } else {
      scope = translateScope(data.scope);
    }

    const formattedDate = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");

    const subject = "【マーラー検索】検索通知: " + work;

    // 検索タイプの表示名決定
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
    } else if (scope === "用語検索") {
      searchTypeDisplay = "用語検索";
      detailLabel = "検索語";
      detailContent = term;
    } else {
      detailLabel = "楽器";
    }

    // メール本文を構築（新フォーマット）
    let body = "■ 検索内容\n" +
               "【作品】 " + work + "\n" +
               "【タイプ】 " + searchTypeDisplay + "\n" +
               "【" + detailLabel + "】 " + detailContent + "\n";

    if (data.includeGlobal) {
        body += "【全体検索】 はい (全体を含む)\n";
    }

    body += "【日時】 " + formattedDate + "\n\n" +
               "■ 検索元\n" +
               "【ページ】 " + (pageNameMap[page] || page) + "\n\n" +
               "■ ユーザー環境\n" +
               getValue(data.userAgent);
                
    const recipient = 'pistares@ezweb.ne.jp';
    try {
      MailApp.sendEmail(recipient, subject, body);
    } catch (e) {
      Logger.log("Email sending failed (likely quota exceeded): " + e.toString());
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
 * JSON Helper
 */
function createJsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
  if (statusCode) data.httpStatus = statusCode;
  return output;
}

/**
 * Log search history to Spreadsheet
 * @param {Object} data - Search data object
 * @param {string} detail - Detailed formatted string (email body or similar) for validity check/backup
 */
function logToSpreadsheet(data, detail) {
  try {
    const sheetName = '検索履歴';
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    
    // Header definition
    const HEADERS = ['日時', 'Work', 'Page', 'Term', 'Instruments', 'Whom', 'Page_Num', 'Global', 'UserAgent', '詳細'];

    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(sheetName);
      sheet.appendRow(HEADERS);
    } else {
        // Ensure header exists if sheet was empty or check first row? 
        // For simplicity, assume if exists, it has headers or we just append.
        // If we want to enforce new headers on existing sheet, we might need check.
        const lastRow = sheet.getLastRow();
        if (lastRow === 0) {
            sheet.appendRow(HEADERS);
        }
    }

    // --- Mappings ---
    const pageNameMap = {
      'index.html': '曲名と楽器から検索（GM）',
      'terms_search.html': '用語から検索（GM）',
      'richard_wagner.html': '曲名から検索（RW）',
      'richard_wagner': '曲名から検索（RW）', // Added for JS calls
      'rw_terms_search.html': '用語から検索（RW）',
      'richard_strauss.html': '曲名から検索（RS）',
      'richard_strauss': '曲名から検索（RS）', // Added for JS calls
      'rs_terms_search.html': '用語から検索（RS）',
      'dic.html': '用語集',
      'home.html': 'HOME'
    };

    const workNameMap = {
        // GM
        '1': '交響曲第1番', '2': '交響曲第2番', '3': '交響曲第3番', '4': '交響曲第4番',
        '5': '交響曲第5番', '6': '交響曲第6番', '7': '交響曲第7番', '8': '交響曲第8番',
        '9': '交響曲第9番', '10': '交響曲第10番', 'das_lied': '大地の歌',
        'klagende': '嘆きの歌', 'gesellen': 'さすらう若人の歌', 'knaben': '子供の魔法の角笛',
        'kindertoten': '子供の死の歌', 'rueckert': 'リュッケルトの歌',
        'blumine': 'Blumine', 'totenfeier': 'Totenfeier',
        // RW
        'feen': 'Die Feen', 'liebes': 'Das Liebesverbot', 'rienzi': 'Rienzi',
        'holländer': 'Der fliegende Holländer', 'tann_dresden': 'Tannhäuser (Dresden)',
        'tann_paris': 'Tannhäuser (Paris)', 'lohengrin': 'Lohengrin',
        'rheingold': 'Das Rheingold', 'walküre': 'Die Walküre', 'siegfried': 'Siegfried',
        'götter': 'Götterdämmerung', 'tristan': 'Tristan und Isolde',
        'meister': 'Die Meistersinger von Nürnberg', 'parsifal': 'Parsifal',
        // RS
        'guntram': 'Guntram', 'feuersnot': 'Feuersnot', 'salome': 'Salome',
        'elektra': 'Elektra', 'rosenkavalier': 'Der Rosenkavalier',
        'ariadne': 'Ariadne auf Naxos', 'schatten': 'Die Frau ohne Schatten',
        'intermezzo': 'Intermezzo', 'helena': 'Die ägyptische Helena',
        'arabella': 'Arabella', 'schweigsame': 'Die schweigsame Frau',
        'tag': 'Friedenstag', 'daphne': 'Daphne', 'danae': 'Die Liebe der Danae',
        'cap': 'Capriccio',
        'metamorphosen': 'Metamorphosen', 'vier_letzte': 'Vier letzte Lieder'
    };

    // --- Data Preparation ---
    const formattedDate = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
    
    // Work
    let workDisplay = data.work || '';
    if (workDisplay.includes(',')) {
        workDisplay = workDisplay.split(',').map(w => workNameMap[w.trim()] || w.trim()).join(', ');
    } else {
        workDisplay = workNameMap[workDisplay] || workDisplay;
    }

    // Page
    const pageRaw = data.page || '';
    const pageDisplay = pageNameMap[pageRaw] || pageRaw;

    // --- Column Population Logic ---
    let termDisplay = '';
    let instrumentsDisplay = '';
    let whomDisplay = '';
    let szeneDisplay = '';
    let pageNumDisplay = '';

    // 1. Term Column
    if (pageRaw.includes('terms_search')) {
        termDisplay = data.term || '';
    }
    
    // 2. Instruments Column (Strictly for GM Search)
    if (pageRaw === 'index.html') {
        instrumentsDisplay = data.scope || '';
    }

    // 3. Whom, Szene & Page_Num Columns
    const scopeVal = data.scope || '';
    const searchType = data.type; 

    if (searchType === 'page') {
        pageNumDisplay = scopeVal;
    } else if (searchType === 'scene') {
        szeneDisplay = scopeVal; // Scene -> Szene column
    } else if (searchType === 'whom') {
        whomDisplay = scopeVal; // Whom -> Whom column
    } else if (!searchType && (pageRaw.includes('richard_wagner') || pageRaw.includes('richard_strauss'))) {
        // Fallback for legacy calls
        if (scopeVal.match(/^p\.|^\d+(?:-\d+)?(?:,|$)/)) {
             pageNumDisplay = scopeVal;
        } else if (scopeVal.startsWith('Page ')) {
             pageNumDisplay = scopeVal.replace('Page ', '');
        } else {
             // Default to Whom if ambiguous, or Szene? 
             // Legacy "Scene Search" used to go here. But user asked for Szene column.
             // If looks like scene "Act 1, Scene 2", put in Szene?
             // It's safer to leave legacy behavior or put in Whom as generic bucket if unsure.
             // Let's assume Whom for now unless it clearly says "Scene".
             if (data.term && data.term === 'Scene Search') {
                 szeneDisplay = scopeVal;
             } else {
                 whomDisplay = scopeVal;
             }
        }
    }

    // Global
    const globalDisplay = (data.includeGlobal === true || data.includeGlobal === 'true') ? 'Yes' : '';

    // UserAgent
    const ua = data.userAgent || '';

    // Detail
    const detailedBody = detail || '';

    // Construct Row
    const rowData = [
        formattedDate,
        workDisplay,
        pageDisplay,
        termDisplay,
        instrumentsDisplay,
        whomDisplay,
        szeneDisplay,
        pageNumDisplay,
        globalDisplay,
        ua,
        detailedBody
    ];

    sheet.appendRow(rowData);

  } catch (e) {
    Logger.log("Error logging to spreadsheet: " + e.toString());
  }
}
