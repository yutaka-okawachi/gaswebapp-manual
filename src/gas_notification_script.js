function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Helper function to handle empty values
    function getValue(val) {
      return (val && val !== "N/A") ? val : "未指定";
    }

    // ページ名のマッピング
    var pageNameMap = {
      'index.html': '曲名と楽器から検索 (GM)',
      'terms_search.html': '用語から検索 (GM)',
      'rs_terms_search.html': '用語から検索 (RS)',
      'rw_terms_search.html': '用語から検索 (RW)',
      'richard_strauss.html': '曲名から検索 (RS)',
      'richard_wagner.html': '曲名から検索 (RW)'
    };
    
    // 楽器名のマッピング（フロントエンドのdMappingと対応）
    var instrumentMap = {
      // 弦楽器
      'v1': 'Violine1',
      'v2': 'Violine2',
      'va': 'Bratche',
      'vc': 'Violoncello',
      'kb': 'Kontrabaß',
      'sv': 'Solo Violine',
      'sva': 'Solo Bratche',
      'svc': 'Solo Violoncello',
      'skb': 'Solo Kontrabaß',
      // 木管楽器
      'fl': 'Flöte',
      'pic': 'Piccolo',
      'ob': 'Oboe',
      'eh': 'Englischhorn',
      'cl': 'Klarinette',
      'escl': 'Es-Klarinette',
      'bcl': 'Bassklarinette',
      'fg': 'Fagott',
      'cfg': 'Kontrafagott',
      // 金管楽器
      'tr': 'Trompete',
      'pis': 'Piston',
      'phr': 'Posthorn',
      'hr': 'Horn',
      'thr': 'Tenorhorn',
      'ohr': 'Obligates Horn',
      'fhr': 'Flügelhorn',
      'whr': 'Waldhorn',
      'pos': 'Posaune',
      'bt': 'Basstuba',
      // 打楽器など
      'pau': 'Pauken',
      'gtr': 'Große Trommel',
      'ktr': 'Kleine Trommel',
      'mtr': 'Militär Trommel',
      'bec': 'Becken',
      'tam': 'Tam-tam',
      'tri': 'Triangel',
      'gls': 'Glockenspiel',
      'hgl': 'Herdenglocken',
      'gl': 'Glocken',
      'ham': 'Hammer',
      'rt': 'Rute',
      'cel': 'Celesta',
      'hp': 'Harfe',
      'org': 'Orgel',
      'klv': 'Klavier',
      'har': 'Harmonium',
      'git': 'Gitarre',
      'man': 'Mandoline',
      // 声楽
      'sop': 'Sopran',
      'alt': 'Alto',
      'ten': 'Tenor',
      'bar': 'Bariton',
      'bass': 'Bass',
      'sop1': 'Sopran1',
      'sop2': 'Sopran2',
      'alt1': 'Alto1',
      'alt2': 'Alto2',
      'kalt': 'Knabenstimme Alto',
      'chor': 'Chor',
      'chor1': 'Chor1',
      'chor2': 'Chor2',
      'fchor': 'Frauenchor',
      'kchor': 'Knabenchor',
      'sti': 'Stimme',
      // 指揮者
      'dir': 'Dirigent',
      // グループ
      'all_strings': '弦楽器群',
      'all_woodwinds': '木管楽器群',
      'all_brass': '金管楽器群',
      'all_percussions': '打楽器群など',
      'all_vocal': '声楽・合唱'
    };
    
    // scopeを日本語に変換
    function translateScope(scope) {
      if (!scope || scope === "N/A") return "未指定";
      
      // 特殊なケース
      if (scope === "Term") return "用語検索";
      if (scope === "Mahler Search") return "曲名・楽器検索";
      if (scope === "Scene Search") return "場面検索";
      if (scope === "Page Search") return "ページ検索";
      if (scope.toLowerCase() === "all_global") return "全楽器";
      
      // ページ検索の場合（例: "Page 10-20"）
      if (scope.indexOf("Page ") === 0) {
        var pageNumbers = scope.substring(5); // "Page "を削除
        return "ページ番号: " + pageNumbers;
      }
      
      // 場面検索の場合（例: "2-, 3-" または "all"）
      if (scope === "all") return "全場面";
      
      // "数字-" または "数字-数字" のパターンをチェック（場面情報）
      var scenePattern = /^\d+(-\d*)?$/;
      var parts = scope.split(',').map(function(part) { return part.trim(); });
      var hasScenePattern = parts.every(function(part) {
        return part === "all" || scenePattern.test(part);
      });
      
      if (hasScenePattern) {
        // 場面情報を日本語化
        var sceneParts = parts.map(function(part) {
          if (part === "all") return "全場面";
          
          var matches = part.split('-');
          var aufzug = matches[0];
          var szene = matches[1];
          
          var result = "";
          if (aufzug) result += "第" + aufzug + "幕";
          if (szene) result += "第" + szene + "場";
          if (!szene && aufzug) result += "（全体）"; // "2-"のような場合
          
          return result || part;
        });
        return sceneParts.join(', ');
      }
      
      // 楽器コードの場合（カンマ区切りの楽器コードを変換）
      var instruments = scope.split(',').map(function(code) {
        code = code.trim().toLowerCase();
        return instrumentMap[code] || code;
      });
      
      return instruments.join(', ');
    }
    
    // workを日本語に変換
    function translateWork(work) {
      if (!work || work === "N/A") return "未指定";
      if (work === "All (GM)") return "全作品";
      if (work === "Mahler Search") return "マーラー検索";
      return work;
    }
    
    var work = translateWork(data.work);
    var scope = translateScope(data.scope);
    var term = getValue(data.term);
    var page = getValue(data.page);
    var userAgent = getValue(data.userAgent);
    
    // ページ名を日本語に変換
    var pageName = pageNameMap[page] || page;
    
    var now = new Date();
    // Use JST for the timestamp
    var formattedDate = Utilities.formatDate(now, "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");

    var subject = "【マーラー検索】検索通知: " + work;
    
    // メール本文を構築
    var body = "マーラー検索アプリで新しい検索がありました。\n\n" +
               "■ 検索詳細\n" +
               "--------------------------------------------------\n" +
               "【日時】 " + formattedDate + "\n" +
               "【検索元ページ】 " + pageName + "\n" +
               "【作品】 " + work + "\n";
    
    // 検索タイプによって表示を変更
    if (scope === "用語検索") {
      body += "【検索語】 " + term + "\n" +
              "【検索タイプ】 " + scope + "\n";
    } else {
      body += "【検索タイプ】 曲名・楽器検索\n" +
              "【楽器】 " + scope + "\n";
    }
    
    body += "--------------------------------------------------\n\n" +
            "■ ユーザー環境\n" +
            userAgent;
                
    MailApp.sendEmail({
      to: 'pistares@ezweb.ne.jp',
      subject: subject,
      body: body
    });
    
    return ContentService.createTextOutput(JSON.stringify({status: "success"}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
