/**
 * RWサジェスト用語リストのキャッシュを強化する関数
 * 定期的にトリガーで実行推奨
 */
function updateDeTermsCache_RW() {
  const allData = getRichardWagnerData();
  const deTerms = [...new Set(allData.map(row => row.de).filter(de => de))];
  CacheService.getScriptCache().put('rw_de_terms_cache', JSON.stringify(deTerms), 3600);
}
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
  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'index';
  let name;
  switch (page) {
    case 'richard_strauss':
    case 'richard_wagner':
    case 'terms_search':
    case 'rs_terms_search':
    case 'rw_terms_search':
    case 'list':
    case 'notes':
      name = page;
      break;
    default:
      name = 'index';
  }
  const template = HtmlService.createTemplateFromFile(name);

  // ★★★ 変更点 ★★★
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
  const range = sheet.getRange(1, 1, lastRow, 7);
  const data = range.getValues();

  const header = data.shift();
  const headerMap = header.reduce((obj, col, i) => { if (col) { obj[col.toString().trim().toLowerCase()] = i; } return obj; }, {});
  const requiredHeaders = ['oper', 'aufzug', 'szene', 'page', 'whom', 'de', 'ja'];
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
  const deTerms = [...new Set(allData.map(row => row.de).filter(de => de))];
  cache.put(cacheKey, JSON.stringify(deTerms), 3600);
  return deTerms;
}

function searchRWTermsPartially(input) {
  if (!input || typeof input !== 'string' || input.trim().length < 2) return [];
  const normalizedInput = normalizeString(input);
  const cache = CacheService.getScriptCache();
  const cached = cache.get('rw_de_terms_cache');
  if (!cached) return [];
  const allTerms = JSON.parse(cached);
  return allTerms.filter(term => normalizeString(term).includes(normalizedInput)).slice(0, 20);
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
        'holländer': 'Der fliegende Holländer', 'tann_dresden': 'Tannhäuser (Dresden)',
        'tann_paris': 'Tannhäuser (Paris)', 'lohengrin': 'Lohengrin',
        'rheingold': 'Das Rheingold', 'walküre': 'Die Walküre', 'siegfried': 'Siegfried',
        'götter': 'Götterdämmerung', 'tristan': 'Tristan und Isolde',
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

        const operKey = normalizeString(row.oper || '');
        const aufzug = (row.aufzug || '0').toString().trim().toLowerCase();
        const szene = (row.szene || '0').toString().trim().toLowerCase();
        const page = escapeHtml(row.page || '');

        const operaDisplayName = operaDisplayNames[operKey] || escapeHtml(row.oper);
        const sceneMapKey = `${operKey}-${aufzug}-${szene}`;
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
 * (以下、既存の Mahler 関連コード)
 ***********************************************************/

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