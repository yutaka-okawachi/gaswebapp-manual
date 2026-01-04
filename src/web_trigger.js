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
    if (action === "exportAllDataToJsonReturn") {
      Logger.log("Starting exportAllDataToJson (Return Mode)...");
      const files = exportAllDataToJson(true);
      result = {
        status: "success",
        message: "Data exported successfully",
        files: files,
        timestamp: new Date().toISOString()
      };
    } else if (action === "exportDic" || action === "exportAllDataToJson") {
      Logger.log("Starting exportAllDataToJson...");
      exportAllDataToJson(false);
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
    const scope = translateScope(data.scope);
    const term = getValue(data.term);
    const formattedDate = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");

    const subject = "【マーラー検索】検索通知: " + work;
    let body = "マーラー検索アプリで新しい検索がありました。\n\n" +
               "■ 検索詳細\n" +
               "--------------------------------------------------\n" +
               "【日時】 " + formattedDate + "\n" +
               "【検索元ページ】 " + (pageNameMap[page] || page) + "\n" +
               "【作品】 " + work + "\n";

    if (term === "Scene Search") {
      body += "【検索タイプ】 場面検索\n【場面】 " + scope + "\n";
    } else if (term === "Page Search") {
      body += "【検索タイプ】 ページ検索\n【ページ番号】 " + scope.replace("ページ番号: ", "") + "\n";
    } else if (scope === "用語検索") {
      body += "【検索語】 " + term + "\n【検索タイプ】 用語検索\n";
    } else {
      body += "【検索タイプ】 曲名・楽器検索\n【楽器】 " + scope + "\n";
    }
    
    body += "--------------------------------------------------\n\n■ ユーザー環境\n" + getValue(data.userAgent);
                
    const recipient = 'pistares@ezweb.ne.jp';
    MailApp.sendEmail(recipient, subject, body);
    
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
