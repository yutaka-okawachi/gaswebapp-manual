/***************************************
 * mahler.js
 * * Google Apps Script 上で動作するサーバーサイドのスクリプト。
 * * 主な機能：
 * - doGet: ページ切り替え（HTMLテンプレートの表示）
 * - 全データの取得やキャッシュ管理
 * - 検索ロジック（英語用語検索 / 曲名 & 楽器検索 / R.Strauss検索 / R.Wagner検索）
 * - 検索結果メール通知
 *
 * 使われるスプレッドシートのシート構成：
 * - 「sheet4」：マーラーのドイツ語→英語→日本語などが入っている
 * - 「マーラー以外のドイツ語」
 * - 「訳出についての覚書」
 * - 「RS」：R.Straussのデータ
 * - 「RW」：R.Wagnerのデータ
 * - 「RS幕構成」：シュトラウスの場面構成データ
 * - 「RW幕構成」：ワーグナーの場面構成データ
 * - 「楽譜情報」：オペラの楽譜出版社情報
 *
 * SPREADSHEET_ID は該当スプレッドシートの ID を設定。
 ***************************************/

const SPREADSHEET_ID = '1aw2Z5gllpLX15P-FEy3QxAHQ7EqyQNIicYdNi_5rkUU';

/**
 * 文字列を正規化する関数
 * ウムラウトなどを変換し、小文字化・空白除去を行う
 */
function normalizeString(str) {
  if (typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .trim();
}

/**
 * 外部ファイル（CSSやJS）をHTMLにインクルードするためのヘルパー関数
 * @param {string} filename - インクルードするファイル名
 * @returns {string} ファイルの内容
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * メインの doGet
 */
function doGet(e) {
  // URLパラメータから表示するページ名を取得。なければ 'index' に。
  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'index';
  // 有効なページ名かをチェックし、無効な場合は 'index' にフォールバック
  const validPages = ['index', 'richard_strauss', 'richard_wagner', 'terms_search', 'rs_terms_search', 'rw_terms_search', 'list', 'notes'];
  const name = validPages.includes(page) ? page : 'index';

  const template = HtmlService.createTemplateFromFile(name);

  // すべてのテンプレートで include 関数を使えるようにする
  template.include = include;
  return template.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * クライアントから呼び出される場面データ取得用のラッパー関数
 * @param {string} operaName - 'richard_strauss' または 'richard_wagner'
 * @returns {Object} 場面オプションのデータ
 */
function getSceneOptionsForOpera(operaName) {
  try {
    const sheetName = (operaName === 'richard_strauss') ? 'RS幕構成' : 'RW幕構成';
    return getSceneOptions(sheetName);
  } catch (e) {
    Logger.log(e);
    return {}; // エラー時は空のオブジェクトを返す
  }
}

/**
 * 「楽譜情報」シートからデータを取得し、キャッシュする
 * @returns {Object} オペラの正規化名(key)と楽譜情報(value)のマップ
 */
function getScoreInfoMap() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'score_info_map_v1';
  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const sheetName = '楽譜情報';
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) {
    Logger.log(`警告: シート「${sheetName}」が見つかりません。`);
    return {};
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return {};

  const header = data.shift().map(h => h.toString().trim().toLowerCase());
  const operIdx = header.indexOf('oper');
  const publisherIdx = header.indexOf('publisher');

  if (operIdx === -1 || publisherIdx === -1) {
    Logger.log(`警告: 「${sheetName}」シートに必要なヘッダー（Oper, Publisher）がありません。`);
    return {};
  }

  const scoreMap = {};
  data.forEach(row => {
    const operKey = normalizeString(row[operIdx] || '');
    const publisher = (row[publisherIdx] || '').toString().trim();
    if (operKey && publisher) {
      scoreMap[operKey] = publisher;
    }
  });

  cache.put(cacheKey, JSON.stringify(scoreMap), 3600); // 1時間キャッシュ
  return scoreMap;
}

/**
 * 「幕構成」シートから場面の選択肢データを生成する
 */
function getSceneOptions(sheetName) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) {
    Logger.log(`警告: シート「${sheetName}」が見つかりません。`);
    return {};
  }

  const data = sheet.getDataRange().getValues();
  const header = data.shift().map(h => h.toString().trim().toLowerCase());
  const operIdx = header.indexOf('oper');
  const aufzugIdx = header.indexOf('aufzug');
  const szeneIdx = header.indexOf('szene');
  const nihongoIdx = header.indexOf('日本語');

  if ([operIdx, aufzugIdx, szeneIdx, nihongoIdx].includes(-1)) {
    throw new Error(`「${sheetName}」シートに必要なヘッダー（Oper, Aufzug, Szene, 日本語）がありません。`);
  }

  const options = {};
  data.forEach(row => {
    const operKey = (row[operIdx] || '').toString().trim().toLowerCase();
    const aufzug = (row[aufzugIdx] || '0').toString().trim().toLowerCase();
    const szene = (row[szeneIdx] || '0').toString().trim().toLowerCase();
    const nihongo = (row[nihongoIdx] || '').toString().trim();

    if (operKey && nihongo) {
      if (!options[operKey]) {
        options[operKey] = [];
      }
      const value = `${aufzug}-${szene}`;
      options[operKey].push({ value: value, text: nihongo });
    }
  });
  return options;
}

/**
 * 「幕構成」シートから場面名の対応表を作成し、キャッシュする
 */
function getSceneMap(sheetName) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `scene_map_v3_${sheetName}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) throw new Error(`シート「${sheetName}」が見つかりません。`);

  const data = sheet.getDataRange().getValues();
  const header = data.shift().map(h => h.toString().trim().toLowerCase());
  const operIdx = header.indexOf('oper');
  const aufzugIdx = header.indexOf('aufzug');
  const szeneIdx = header.indexOf('szene');
  const nihongoIdx = header.indexOf('日本語');

  if ([operIdx, aufzugIdx, szeneIdx, nihongoIdx].includes(-1)) {
    throw new Error(`「${sheetName}」シートに必要なヘッダー（Oper, Aufzug, Szene, 日本語）がありません。`);
  }

  const sceneMap = {};
  data.forEach(row => {
    const operKey = normalizeString(row[operIdx] || '');
    const aufzug = (row[aufzugIdx] || '0').toString().trim().toLowerCase();
    const szene = (row[szeneIdx] || '0').toString().trim().toLowerCase();
    const nihongo = (row[nihongoIdx] || '').toString().trim();
    if (operKey && nihongo) {
      const key = `${operKey}-${aufzug}-${szene}`;
      sceneMap[key] = nihongo;
    }
  });

  cache.put(cacheKey, JSON.stringify(sceneMap), 3600);
  return sceneMap;
}

/***********************************************************
 * R. Wagner 検索関連
 ***********************************************************/

/**
 * R. Wagnerのデータを取得する。
 * パフォーマンス向上のため、チャンキング対応のキャッシュ機構を導入。
 * @returns {Array<Object>} R. Wagnerのデータ配列
 */
function getRichardWagnerData() {
  const cacheKey = 'richard_wagner_data_v2'; // キーのバージョンを更新

  // ★★★ 変更点：新しい取得関数を呼び出す ★★★
  const cached = getChunkedCache(cacheKey);
  if (cached) {
    return cached;
  }

  Logger.log('R.Wagnerデータをスプレッドシートから取得します。');
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('RW');
  if (!sheet) throw new Error('シート「RW」が見つかりません。');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const range = sheet.getRange(1, 1, lastRow, 8); // 列数を8に変更
  const data = range.getValues();

  const header = data.shift();
  const headerMap = header.reduce((obj, col, i) => { if (col) { obj[col.toString().trim().toLowerCase()] = i; } return obj; }, {});
  const requiredHeaders = ['oper', 'aufzug', 'szene', 'page', 'whom', 'de', 'ja', 'de_normalized']; // de_normalized を追加
  for (const h of requiredHeaders) { if (headerMap[h] === undefined) { throw new Error(`シート「RW」に必要なヘッダー「${h}」がありません。`); } }
  const jsonData = data.map(row => { let obj = {}; for (const key in headerMap) { obj[key] = row[headerMap[key]]; } return obj; });

  // ★★★ 変更点：新しい保存関数を呼び出す ★★★
  setChunkedCache(cacheKey, jsonData, 21600); // 6時間キャッシュ

  return jsonData;
}

function searchRichardWagnerByScene(operaName, scenes) {
  try {
    const scoreInfoMap = getScoreInfoMap();
    const normalizedOperaName = normalizeString(operaName);
    const scoreInfo = scoreInfoMap[normalizedOperaName] || '';

    const allData = getRichardWagnerData();
    const sceneMap = getSceneMap('RW幕構成');
    const isAll = scenes.includes('all');

    const filteredData = allData.filter(row => {
      if (row.page === undefined || row.page === null || String(row.page).trim() === '') {
        return false;
      }
      const sheetOperaValue = normalizeString(row.oper);
      if (sheetOperaValue !== normalizedOperaName) return false;

      if (isAll) return true;
      const aufzug = (row.aufzug || '0').toString().trim().toLowerCase();
      const szene = (row.szene || '0').toString().trim().toLowerCase();
      const sceneCode = `${aufzug}-${szene}`;
      return scenes.includes(sceneCode);
    });

    const resultsHtml = formatGenericResults(filteredData, sceneMap);

    let finalHtml = '';
    if (scoreInfo) {
      finalHtml += `<div class="score-info">楽譜情報: ${escapeHtml(scoreInfo)}</div>`;
    }
    finalHtml += resultsHtml;

    // ▼▼▼ メール通知機能を追加 ▼▼▼
    const emailSubject = 'R.Wagner 場面からの検索が実行されました';
    const emailBody = `
検索日時: ${new Date().toLocaleString('ja-JP')}
オペラ: ${operaName}
選択場面: ${scenes.join(', ')}
    `.trim();
    sendSearchNotification(emailSubject, emailBody);
    // ▲▲▲ メール通知機能を追加 ▲▲▲

    return finalHtml;

  } catch (e) {
    Logger.log(e);
    return `<p class="result-message">エラーが発生しました: ${e.message}</p>`;
  }
}

function searchRichardWagnerByPage(operaName, pageInput) {
  try {
    const scoreInfoMap = getScoreInfoMap();
    const normalizedOperaName = normalizeString(operaName);
    const scoreInfo = scoreInfoMap[normalizedOperaName] || '';

    const allData = getRichardWagnerData();
    const sceneMap = getSceneMap('RW幕構成');
    const pages = parsePageInput(pageInput);
    if (pages.size === 0) { return '<p class="result-message">有効なページ番号が指定されていません。</p>'; }

    const filteredData = allData.filter(row => {
      const sheetOperaValue = normalizeString(row.oper);
      if (sheetOperaValue !== normalizedOperaName) return false;

      if (row.page === undefined || row.page === null) return false;
      const pageNumber = Number(row.page);
      if (String(row.page).trim() === '' || isNaN(pageNumber)) return false;
      return pages.has(pageNumber);
    });

    const resultsHtml = formatGenericResults(filteredData, sceneMap);

    let finalHtml = '';
    if (scoreInfo) {
      finalHtml += `<div class="score-info">楽譜情報: ${escapeHtml(scoreInfo)}</div>`;
    }
    finalHtml += resultsHtml;

    // ▼▼▼ メール通知機能を追加 ▼▼▼
    const emailSubject = 'R.Wagner ページからの検索が実行されました';
    const emailBody = `
検索日時: ${new Date().toLocaleString('ja-JP')}
オペラ: ${operaName}
入力ページ: ${pageInput}
    `.trim();
    sendSearchNotification(emailSubject, emailBody);
    // ▲▲▲ メール通知機能を追加 ▲▲▲

    return finalHtml;

  } catch (e) {
    Logger.log(`searchRichardWagnerByPageでエラーが発生: ${e.toString()}`);
    return `<p class="result-message">検索中にサーバーエラーが発生しました: ${e.message}</p>`;
  }
}

/***********************************************************
 * R. Wagner 用語検索関連
 ***********************************************************/

function getRichardWagnerDeTerms() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'rw_de_terms_cache';
  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const allData = getRichardWagnerData();
  // original(元の用語)とnormalized(正規化済み用語)のペアを作成
  const terms = allData
    .map(row => ({ original: row.de, normalized: row.de_normalized }))
    .filter(item => item.original && item.normalized);

  const uniqueTerms = Array.from(new Map(terms.map(item => [item.original, item])).values());
  cache.put(cacheKey, JSON.stringify(uniqueTerms), 3600);
  return uniqueTerms;
}

/**
 * [クライアントサイド検索用] R.Wagnerの全用語リストを返す
 * @returns {Array<string>}
 */
function getRWTermsForClient() {
  return getRichardWagnerDeTerms();
}

function searchRWTermsPartially(input) {
  if (!input || typeof input !== 'string' || input.trim().length < 2) return [];
  const normalizedInput = normalizeString(input);
  // キャッシュから全用語リストを取得
  const cache = CacheService.getScriptCache();
  const cached = cache.get('rw_de_terms_cache');
  if (!cached) return [];
  const allTerms = JSON.parse(cached);
  return allTerms.filter(item => item.normalized.startsWith(normalizedInput)).map(item => item.original).slice(0, 20);
}

function searchRWTerms(query) {
  try {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return '<p class="result-message">検索語句を入力してください。</p>';
    }

    const allData = getRichardWagnerData();
    const sceneMap = getSceneMap('RW幕構成');
    const operaDisplayNames = {
        'feen': 'Die Feen', 'liebes': 'Das Liebesverbot', 'rienzi': 'Rienzi',
        'hollaender': 'Der fliegende Holländer', 'tann_dresden': 'Tannhäuser (Dresden)',
        'tann_paris': 'Tannhäuser (Paris)', 'lohengrin': 'Lohengrin',
        'rheingold': 'Das Rheingold', 'walkuere': 'Die Walküre', 'siegfried': 'Siegfried',
        'goetter': 'Götterdämmerung', 'tristan': 'Tristan und Isolde',
        'meister': 'Die Meistersinger von Nürnberg', 'parsifal': 'Parsifal'
    };
    const normalizedQuery = normalizeString(query);

    const filteredData = allData.filter(row => {
      const deMatch = row.de && normalizeString(row.de).includes(normalizedQuery);
      const pageExists = row.page !== null && row.page !== undefined && String(row.page).trim() !== '';
      return deMatch && pageExists;
    });

    if (filteredData.length === 0) {
      return '<p class="result-message">該当するデータが見つかりませんでした。</p>';
    }

    const groupedByDe = filteredData.reduce((acc, row) => {
      const de = row.de || '（ドイツ語なし）';
      if (!acc[de]) {
        acc[de] = [];
      }
      acc[de].push(row);
      return acc;
    }, {});
    let html = `<div>${filteredData.length}件該当しました。</div>`;

    const sortedDeKeys = Object.keys(groupedByDe).sort((a, b) => a.localeCompare(b, 'de'));
    for (const de of sortedDeKeys) {
      html += `<div class="result-a">${escapeHtml(de)}</div>`;
      groupedByDe[de].forEach(row => {
        const ja = escapeHtml(row.ja || '');

        const normalizedOperKey = normalizeString(row.oper || '');
        const aufzug = (row.aufzug || '0').toString().trim().toLowerCase();
        const szene = (row.szene || '0').toString().trim().toLowerCase();
        const page = escapeHtml(row.page || '');

        const operaDisplayName = operaDisplayNames[normalizedOperKey] || escapeHtml(row.oper);
        const sceneMapKey = `${normalizedOperKey}-${aufzug}-${szene}`;
        const sceneName = escapeHtml(sceneMap[sceneMapKey] || `場面(${aufzug}-${szene})`);

        const pageDisplay = page ? `p.${page}` : '';
        const sitedata = `${operaDisplayName} ${sceneName} ${pageDisplay}`.trim();

        html += `<div class="result-c">${ja} 【${sitedata}】</div>`;
      });
    }

    // ▼▼▼ メール通知機能を追加 ▼▼▼
    const emailSubject = 'R.Wagner 用語検索が実行されました';
    const emailBody = `
検索日時: ${new Date().toLocaleString('ja-JP')}
検索語句: ${query}
    `.trim();
    sendSearchNotification(emailSubject, emailBody);
    // ▲▲▲ メール通知機能を追加 ▲▲▲

    return html;

  } catch (e) {
    Logger.log(`searchRWTermsでエラー: ${e.toString()}`);
    return `<p class="result-message">検索中にエラーが発生しました: ${e.message}</p>`;
  }
}


/***********************************************************
 * 共通の補助関数
 ***********************************************************/

function parsePageInput(input) {
  const pages = new Set();
  const parts = input.split(',');
  parts.forEach(part => {
    part = part.trim();
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (!isNaN(start) && !isNaN(end) && start <= end) { for (let i = start; i <= end; i++) { pages.add(i); } }
    } else {
      const num = Number(part);
      if (!isNaN(num)) { pages.add(num); }
    }
  });
  return pages;
}

/**
 * R.Strauss / R.Wagner 兼用の検索結果フォーマット関数
 * @param {Array<Object>} data - フィルタリング済みの検索結果データ
 * @param {Object} sceneMap - オペラ名と場面名を対応付けるマップ
 * @returns {string} 整形されたHTML文字列
 */
function formatGenericResults(data, sceneMap) {
  // データが0件の場合はメッセージを返す
  if (data.length === 0) {
    return '<p class="result-message">該当するデータが見つかりませんでした。</p>';
  }

  // ページ番号で昇順にソートする
  data.sort((a, b) => {
    const pageA = Number(a.page) || 0;
    const pageB = Number(b.page) || 0;
    return pageA - pageB;
  });

  let html = '';
  let currentSceneTitle = ''; // 現在処理中の場面タイトルを保持する変数

  // データを行ごとにループしてHTMLを生成
  data.forEach(row => {
    // ★★★ ここが修正点 ★★★
    // row.oper (例: 'götter') を normalizeString で正規化 (例: 'goetter') してからキーを作成する
    const operKey = normalizeString(row.oper || '');
    const aufzug = (row.aufzug || '0').toString().trim().toLowerCase();
    const szene = (row.szene || '0').toString().trim().toLowerCase();

    // sceneMap から場面名を取得するためのキーを作成 (例: "goetter-1-1")
    const sceneMapKey = `${operKey}-${aufzug}-${szene}`;
    // sceneMap からキーに一致する場面名を取得。見つからない場合はデフォルトの文字列を表示
    const sceneTitle = sceneMap[sceneMapKey] || `不明な場面 (${row.oper}-${aufzug}-${szene})`;

    // 場面のタイトルが変わった最初のタイミングで、タイトル行をHTMLに追加する
    if (sceneTitle !== currentSceneTitle) {
      currentSceneTitle = sceneTitle;
      html += `<div class="scene-title">${escapeHtml(currentSceneTitle)}</div>`;
    }

    // 各データをHTMLエスケープ処理する
    const de = escapeHtml(row.de || '');
    const ja = escapeHtml(row.ja || '');
    const whom = escapeHtml(row.whom || '');
    const pageValue = row.page ? String(row.page).trim() : '';
    const pageDisplay = pageValue ? `p.${escapeHtml(pageValue)}` : '';

    // 1件分の結果HTMLを生成
    html += `
      <div class="result-entry">
        <div class="result-page">${pageDisplay}</div>
        <div class="result-content">
          <div class="result-de">${de}</div>
          <div class="result-ja-loc">
            <span>${ja}</span>
            <span>【${whom}】</span>
          </div>
        </div>
      </div>
    `;
  });

  // 最終的なHTMLとして、件数情報と結果リストを結合して返す
  return `<div>${data.length}件見つかりました。</div>${html}`;
}

/***********************************************************
 * 定数マッピング (Mahler)
 ***********************************************************/
const aMapping = {
  "all": "ALL", "交響曲第1番ニ長調（1884-88）": "1", "交響曲第2番ハ短調（1888-94）": "2",
  "交響曲第3番ニ短調（1893-96）": "3", "交響曲第4番ト長調（1899-1900）": "4", "交響曲第5番嬰ハ短調（1901-02）": "5",
  "交響曲第6番イ短調（1903-04）": "6", "交響曲第7番ホ短調（1904-05）": "7", "交響曲第8番変ホ長調（1906）": "8",
  "交響曲イ短調『大地の歌』（1908）": "a", "交響曲第9番ニ長調（1909）": "9", "交響曲第10番嬰ヘ長調（1910）": "101",
  "交響曲第10番（クック版）": "102", "嘆きの歌（1880）": "b1", "嘆きの歌（1899）": "b2",
  "さすらう若人の歌": "c", "子供の魔法の角笛": "d", "子供の死の歌": "e",
  "リュッケルトの詩による5つの歌": "f", "花の章": "g", "葬礼": "h"
};

const aReverseMap = Object.entries(aMapping).reduce((acc, [key, value]) => {
  acc[value.toLowerCase()] = key;
  return acc;
}, {});

const dMapping = {
  "all": "ALLE", "dir": "Dirigent", "v1": "Violine1", "v2": "Violine2", "va": "Bratche", "vc": "Violoncello",
  "kb": "Kontrabaß", "sv": "Solo Violine", "sva": "Solo Bratche", "svc": "Solo Violoncello", "skb": "Solo Kontrabaß",
  "fl": "Flöte", "pic": "Piccolo", "ob": "Oboe", "eh": "Englischhorn", "cl": "Klarinette", "escl": "Es-Klarinette",
  "bcl": "Bassklarinette", "fg": "Fagott", "cfg": "Kontrafagott", "tr": "Trompete", "pis": "Piston",
  "phr": "Posthorn", "hr": "Horn", "thr": "Tenorhorn", "ohr": "Obligates Horn", "fhr": "Flügelhorn",
  "whr": "Waldhorn", "pos": "Posaune", "bt": "Basstuba", "pau": "Pauken", "gtr": "Gloße Trommel",
  "ktr": "Kleine Trommel", "mtr": "Militär Trommel", "bec": "Becken", "tam": "Tam-tam", "tri": "Triangel",
  "gls": "Glockenspiel", "hgl": "Herdenglocken", "gl": "Glocken", "ham": "Hammer", "rt": "Rute",
  "cel": "Celesta", "hp": "Harfe", "org": "Orgel", "klv": "Klavier", "har": "Harmonium", "git": "Gitarre",
  "man": "Mandoline", "sop": "Sopran", "alt": "Alto", "ten": "Tenor", "bar": "Bariton", "bass": "Bass",
  "sop1": "Sopran1", "sop2": "Sopran2", "alt1": "Alto1", "alt2": "Alto2", "kalt": "Knabe(Alto)",
  "chor": "Chor", "chor1": "Chor1", "chor2": "Chor2", "fchor": "frauen Chor", "kchor": "knaben Chor",
  "sti": "Stimme"
};

const dReverseMap = { ...dMapping };

/***********************************************************
 * (以下、既存の Mahler 関連コード)
 ***********************************************************/

/**
 * Mahlerのデータを取得する。
 * パフォーマンス向上のため、チャンキング対応のキャッシュ機構を導入。
 * @returns {Array<Object>} Mahlerのデータ配列
 */
function getMahlerData() {
  const cacheKey = 'mahler_data_v1';
  const cached = getChunkedCache(cacheKey);
  if (cached) {
    return cached;
  }

  Logger.log('Mahlerデータをスプレッドシートから取得します。');
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('sheet4');
  if (!sheet) throw new Error('シート「sheet4」が見つかりません。');

  const data = sheet.getDataRange().getValues();
  if (!data || data.length === 0) return [];

  setChunkedCache(cacheKey, data, 21600); // 6時間キャッシュ
  return data;
}

/**
 * 曲名と楽器から検索する (Mahler)
 * @param {Array<string>} choice1Arr - 選択された曲名の配列
 * @param {Array<string>} choice2Arr - 選択された楽器の配列
 * @param {boolean} includeOrchestraAll - オーケストラ全体への指示を含めるか
 * @returns {string} 検索結果のHTML
 */
function searchData(choice1Arr, choice2Arr, includeOrchestraAll) {
  const data = getMahlerData();
  if (!data || data.length === 0) {
    return 'データが存在しません。';
  }

  const groupAllMap = {
    "all_strings": ["v1", "v2", "va", "vc", "kb", "sv", "sva", "svc", "skb"],
    "all_woodwinds": ["fl", "pic", "ob", "eh", "cl", "escl", "bcl", "fg", "cfg"],
    "all_brass": ["tr", "pis", "phr", "hr", "thr", "ohr", "fhr", "whr", "pos", "bt"],
    "all_percussions": ["pau", "gtr", "ktr", "mtr", "bec", "tam", "tri", "gls", "hgl", "gl", "ham", "rt", "cel", "hp", "org", "klv", "har", "git", "man"],
    "all_vocal": ["sop", "alt", "ten", "bar", "bass", "sop1", "sop2", "alt1", "alt2", "kalt", "chor", "chor1", "chor2", "fchor", "kchor", "sti"]
  };

  let finalInstruments = new Set();

  if (choice2Arr.includes('ALL_GLOBAL')) {
    Object.keys(dMapping).forEach(code => {
      if (code !== 'all') finalInstruments.add(code);
    });
    finalInstruments.add('all');
  } else {
    choice2Arr.forEach(val => {
      const lowerVal = val.toLowerCase();
      if (groupAllMap[lowerVal]) {
        groupAllMap[lowerVal].forEach(code => finalInstruments.add(code));
      } else if (dMapping[lowerVal]) {
        finalInstruments.add(lowerVal);
      }
    });
  }

  if (includeOrchestraAll) {
    finalInstruments.add('all');
  }

  let resultHTML = '';
  let totalMatches = 0;
  data.forEach(row => {
    const deData = row[0];
    const jaData = row[2];
    const dataCol = row[3];

    if (!dataCol || typeof dataCol !== 'string') return;

    const segments = dataCol.split('&').map(s => s.trim()).filter(s => s);
    if (segments.length === 0) return;

    let matchedLocList = [];
    let segmentCount = 0;

    segments.forEach(seg => {
      const [prefix, a, b, c, d] = seg.split('-');
      if (!a || !b || !c || !d) return;

      let aMatch = choice1Arr.includes('ALL') || choice1Arr.some(choice => aMapping[choice.toLowerCase()] === a);

      const dArr = d.split(',').map(x => x.trim());
      let dMatch = dArr.some(origCode => {
        const codeLower = origCode.toLowerCase();
        if (includeOrchestraAll) {
          return finalInstruments.has(codeLower) || codeLower === 'all';
        } else {
          return finalInstruments.has(codeLower) && codeLower !== 'all';
        }
      });

      if (aMatch && dMatch) {
        totalMatches++;
        segmentCount++;

        const aLabel = aReverseMap[a.toLowerCase()] || `不明(${a})`;
        const movementText = formatMovementNumber(a, b);
        const measureText = `第${c}小節`;
        const mappedInstruments = dArr.map(code => dReverseMap[code] || code).join(', ');
        const locText = `${aLabel} ${movementText}：${measureText}（${mappedInstruments}）`;
        matchedLocList.push(locText);
      }
    });

    if (matchedLocList.length > 0) {
      resultHTML += `<div class="result-a">${escapeHtml(deData)}</div>`;
      resultHTML += `<div class="result-c">${escapeHtml(jaData)}</div>`;
      matchedLocList.forEach(loc => {
        resultHTML += `<div class="result-loc">${escapeHtml(loc)}</div>`;
      });
      resultHTML += `<div class="result-loc">(${segmentCount}件)</div>`;
    }
  });

  const emailSubject = '曲名と楽器等からの検索が実行されました';
  const selectedWorks = choice1Arr.includes('ALL') ? 'ALL' : choice1Arr.join(', ');
  const selectedInstruments = choice2Arr.includes('ALL_GLOBAL') ? 'ALL_GLOBAL' : choice2Arr.join(', ');
  const emailBody = `曲名と楽器等からの検索が実行されました。\n\n選択された曲名:\n${selectedWorks}\n\n選択された楽器:\n${selectedInstruments}\n\nオーケストラ全体を含める:\n${includeOrchestraAll ? 'はい' : 'いいえ'}\n\n検索日時: ${new Date().toLocaleString()}`.trim();
  sendSearchNotification(emailSubject, emailBody);

  return totalMatches === 0 ? '<p class="result-message">該当するデータがありません。</p>' : `<div>${totalMatches}件ありました。</div>${resultHTML}`;
}

/***********************************************************
 * Mahler 用語検索関連
 ***********************************************************/

function getAllTerms() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'all_terms';
  const cachedTerms = cache.get(cacheKey);
  if (cachedTerms) {
    return JSON.parse(cachedTerms);
  }
  const sheetName = 'sheet4';
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  const data = sheet.getRange('B:B').getValues();
  const terms = data.flat().filter(term => term);
  cache.put(cacheKey, JSON.stringify(terms), 3600);
  return terms;
}

/**
 * [クライアントサイド検索用] Mahlerの全用語リストを返す
 * @returns {Array<string>}
 */
function getGMTermsForClient() {
  return getAllTerms();
}

function searchEnglishTermsPartially(input) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `search_${input.toLowerCase()}`;
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    return JSON.parse(cachedData);
  }
  const allTerms = getAllTerms();
  const results = allTerms.filter(term => term.toLowerCase().startsWith(input.toLowerCase()));
  cache.put(cacheKey, JSON.stringify(results), 300);
  return results;
}

function searchByTerm(query) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('sheet4');
  const data = sheet.getDataRange().getValues();
  if (!query) {
    return '<p class="result-message">検索語句を入力してください。</p>';
  }
  if (!data || data.length === 0) {
    return '<p class="result-message">スプレッドシートにデータが存在しません。</p>';
  }

  const results = data.filter(row =>
    row[1] && String(row[1]).toLowerCase().includes(query.toLowerCase())
  );
  if (results.length === 0) {
    return '<p class="result-message">該当するデータが見つかりませんでした。</p>';
  }

  let resultHTML = '';
  results.forEach(row => {
    const german = row[0] || '';
    const japanese = row[2] || '';
    const dataCol = row[3] || '';

    if (!dataCol || typeof dataCol !== 'string') return;

    const segments = dataCol.split('&').map(s => s.trim()).filter(s => s);
    let segmentCount = 0;
    let detailsHTML = '';

    segments.forEach(segment => {
      const [prefix, a, b, c, d] = segment.split('-');
      if (!a || !b || !c || !d) return;

      segmentCount++;
      const workName = aReverseMap[a.toLowerCase()] || `不明(${a})`;
      const movement = formatMovementNumber(a, b);
      const measure = `第${c}小節`;
      const instrCodes = d.split(',').map(instr => instr.trim());
      const instruments = instrCodes.map(code => dReverseMap[code] || code).join(', ');
      detailsHTML += `<div class="result-loc">${workName} ${movement}：${measure}（${instruments}）</div>`;
    });

    resultHTML += `<div class="result-a">${escapeHtml(german)}</div>`;
    resultHTML += `<div class="result-c">${escapeHtml(japanese)}</div>`;
    resultHTML += detailsHTML;
    resultHTML += `<div class="result-loc">(${segmentCount}件)</div>`;
  });

  const emailSubject = '用語検索が実行されました';
  const emailBody = `用語検索が実行されました。\n\n検索された用語:\n${query}\n\n検索日時: ${new Date().toLocaleString()}`.trim();
  sendSearchNotification(emailSubject, emailBody);

  return resultHTML;
}

function formatMovementNumber(a, b) {
  const specialMapping = {
    c: { c1: "Wenn mein Schatz Hochzeit macht", c2: "Ging heut' morgen über's Feld", c3: "Ich hab' ein glühend Messer", c4: "Die zwei blauen Augen von meinem Schatz" },
    d: { d01: "Der Schildwache Nachlied", d02: "Verlorne Müh'!", d03: "Trost im Unglück", d04: "Das himmlische Leben", d05: "Wer hat dies Liedel erdacht?", d06: "Das irdische Leben", d07: "Urlicht", d08: "Des Antonius von Padua Fischpredigt", d09: "Rheinlegendchen", d10: "Lob des hohen Verstands", d11: "Lied des Verfolgten im Turm", d12: "Wo die schönen Trompeten blasen", d13: "Revelge", d14: "Der Tamboursg'sell" },
    e: { e1: "Nun will die Sonn' so hell aufgeh'n", e2: "Nun seh' ich wohl, warum so dunkle Flammen", e3: "Wenn dein Mütterlein", e4: "Oft denk' ich, sie sind nur ausgegangen", e5: "In diesem Wetter, in diesem Braus" },
    f: { f1: "Blicke mir nicht in die Lieder!", f2: "Ich atmet' einen linden Duft", f3: "Ich bin der Welt abhanden gekommen", f4: "Um Mitternacht", f5: "Liebst du um Schönheit" }
  };

  if (specialMapping[a.toLowerCase()] && specialMapping[a.toLowerCase()][b.toLowerCase()]) {
    return specialMapping[a.toLowerCase()][b.toLowerCase()];
  }
  if (b.toLowerCase() === 't1') return '第1部';
  if (b.toLowerCase() === 't2') return '第2部';
  if (b.toLowerCase() === 't3') return '第3部';
  if (['a', 'g', 'h'].includes(b.toLowerCase())) return '';
  return `第${b}楽章`;
}

/**
 * HTML特殊文字をエスケープする
 */
function escapeHtml(str) {
  const value = (str === null || str === undefined) ? '' : String(str);
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 検索実行時に管理者にメールで通知する
 * @param {string} subject - メールの件名
 * @param {string} body - メールの本文
 */
function sendSearchNotification(subject, body) {
  try {
    // ★★★ 変更点：通知先のメールアドレスを固定 ★★★
    const recipient = "pistares@ezweb.ne.jp";
    if (recipient) {
      // メールを送信
      MailApp.sendEmail(recipient, subject, body);
    }
  } catch (e) {
    // メール送信に失敗しても、メインの検索処理は続行させるため、エラーはログに記録するだけにする
    Logger.log(`メール通知の送信に失敗しました: ${e.toString()}`);
  }
}

/***********************************************************
 * 大容量データ向けチャンクキャッシュ関数
 ***********************************************************/

/**
 * データをチャンク（小さな塊）に分割してキャッシュに保存する
 * @param {string} key - キャッシュのキー
 * @param {any} data - 保存するデータ（JSONに変換可能なもの）
 * @param {number} expirationInSeconds - キャッシュの有効期間（秒）
 */
function setChunkedCache(key, data, expirationInSeconds) {
  const cache = CacheService.getScriptCache();
  const jsonString = JSON.stringify(data);
  const chunkSize = 90 * 1024; // 100KB制限より少し小さい90KBに設定
  const chunks = [];

  for (let i = 0; i < jsonString.length; i += chunkSize) {
    chunks.push(jsonString.substring(i, i + chunkSize));
  }

  const cacheData = {};
  chunks.forEach((chunk, index) => {
    cacheData[`${key}_${index}`] = chunk;
  });

  // チャンクの数も保存しておく
  cacheData[`${key}_count`] = chunks.length.toString();

  cache.putAll(cacheData, expirationInSeconds);
}

/**
 * チャンクに分割されたデータをキャッシュから復元する
 * @param {string} key - キャッシュのキー
 * @returns {any|null} 復元されたデータ、またはキャッシュが存在しない場合はnull
 */
function getChunkedCache(key) {
  const cache = CacheService.getScriptCache();
  const countStr = cache.get(`${key}_count`);
  if (!countStr) return null;

  const count = parseInt(countStr, 10);
  const keys = Array.from({ length: count }, (_, i) => `${key}_${i}`);
  const chunks = cache.getAll(keys);

  const jsonString = keys.map(k => chunks[k]).join('');
  return JSON.parse(jsonString);
}