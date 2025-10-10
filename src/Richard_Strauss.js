/**
 * RSサジェスト用語リストのキャッシュを強化する関数
 * 定期的にトリガーで実行推奨
 */
function updateDeTermsCache_RS() {
  const allData = getRichardStraussData();
  const deTerms = [...new Set(allData.map(row => row.de).filter(de => de))];
  CacheService.getScriptCache().put('rs_de_terms_cache', JSON.stringify(deTerms), 3600);
}

/***********************************************************
 * R. Strauss 検索関連
 ***********************************************************/

/**
 * R. Straussのデータを取得する。
 * パフォーマンス向上のため、チャンキング対応のキャッシュ機構を導入。
 * @returns {Array<Object>} R. Straussのデータ配列
 */
function getRichardStraussData() {
  const cacheKey = 'richard_strauss_data_v2'; // キーのバージョンを更新

  // ★★★ 変更点：新しい取得関数を呼び出す ★★★
  const cached = getChunkedCache(cacheKey);
  if (cached) {
    return cached;
  }

  Logger.log('R.Straussデータをスプレッドシートから取得します。');
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('RS');
  if (!sheet) throw new Error('シート「RS」が見つかりません。');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const range = sheet.getRange(1, 1, lastRow, 7);
  const data = range.getValues();

  const header = data.shift();
  const headerMap = header.reduce((obj, col, i) => { if (col) { obj[col.toString().trim().toLowerCase()] = i; } return obj; }, {});
  const requiredHeaders = ['oper', 'aufzug', 'szene', 'page', 'whom', 'de', 'ja'];
  for (const h of requiredHeaders) { if (headerMap[h] === undefined) { throw new Error(`シート「RS」に必要なヘッダー「${h}」がありません。`); } }
  const jsonData = data.map(row => { let obj = {}; for (const key in headerMap) { obj[key] = row[headerMap[key]]; } return obj; });

  // ★★★ 変更点：新しい保存関数を呼び出す ★★★
  setChunkedCache(cacheKey, jsonData, 21600); // 6時間キャッシュ

  return jsonData;
}

function searchRichardStraussByScene(operaName, scenes) {
  try {
    const scoreInfoMap = getScoreInfoMap();
    const normalizedOperaName = normalizeString(operaName);
    const scoreInfo = scoreInfoMap[normalizedOperaName] || '';

    const allData = getRichardStraussData();
    const sceneMap = getSceneMap('RS幕構成');
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
    const emailSubject = 'R.Strauss 場面からの検索が実行されました';
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

function searchRichardStraussByPage(operaName, pageInput) {
  try {
    const scoreInfoMap = getScoreInfoMap();
    const normalizedOperaName = normalizeString(operaName);
    const scoreInfo = scoreInfoMap[normalizedOperaName] || '';

    const allData = getRichardStraussData();
    const sceneMap = getSceneMap('RS幕構成');
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
    const emailSubject = 'R.Strauss ページからの検索が実行されました';
    const emailBody = `
検索日時: ${new Date().toLocaleString('ja-JP')}
オペラ: ${operaName}
入力ページ: ${pageInput}
    `.trim();
    sendSearchNotification(emailSubject, emailBody);
    // ▲▲▲ メール通知機能を追加 ▲▲▲

    return finalHtml;

  } catch (e) {
    Logger.log(`searchRichardStraussByPageでエラーが発生: ${e.toString()}`);
    return `<p class="result-message">検索中にサーバーエラーが発生しました: ${e.message}</p>`;
  }
}

/***********************************************************
 * R. Strauss 用語検索関連
 ***********************************************************/

function getRichardStraussDeTerms() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'rs_de_terms_cache';
  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const allData = getRichardStraussData();
  const deTerms = [...new Set(allData.map(row => row.de).filter(de => de))];
  cache.put(cacheKey, JSON.stringify(deTerms), 3600);
  return deTerms;
}

function searchRSTermsPartially(input) {
  if (!input || typeof input !== 'string' || input.trim().length < 2) return [];
  const normalizedInput = normalizeString(input);
  const cache = CacheService.getScriptCache();
  const cached = cache.get('rs_de_terms_cache');
  if (!cached) return [];
  const allTerms = JSON.parse(cached);
  return allTerms.filter(term => normalizeString(term).includes(normalizedInput)).slice(0, 20);
}

function searchRSTerms(query) {
  try {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return '<p class="result-message">検索語句を入力してください。</p>';
    }

    const allData = getRichardStraussData();
    const sceneMap = getSceneMap('RS幕構成');
    const operaDisplayNames = {
      'guntram': 'Guntram', 'feuersnot': 'Feuersnot', 'salome': 'Salome',
      'elektra': 'Elektra', 'rosenkavalier': 'Der Rosenkavalier', 'ariadne': 'Ariadne auf Naxos',
      'schatten': 'Die Frau ohne Schatten', 'intermezzo': 'Intermezzo', 'helena': 'Die ägyptische Helena',
      'arabella': 'Arabella', 'schweigsame': 'Die schweigsame Frau', 'tag': 'Friedenstag',
      'daphne': 'Daphne', 'danae': 'Die Liebe der Danae', 'cap': 'Capriccio'
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
    const emailSubject = 'R.Strauss 用語検索が実行されました';
    const emailBody = `
検索日時: ${new Date().toLocaleString('ja-JP')}
検索語句: ${query}
    `.trim();
    sendSearchNotification(emailSubject, emailBody);
    // ▲▲▲ メール通知機能を追加 ▲▲▲

    return html;

  } catch (e) {
    Logger.log(`searchRSTermsでエラー: ${e.toString()}`);
    return `<p class="result-message">検索中にエラーが発生しました: ${e.message}</p>`;
  }
}