/**
 * Richard_Strauss.js
 * * R.シュトラウス関連の検索機能を提供するサーバーサイドスクリプト。
 * * データ取得、場面検索、ページ番号検索、用語検索のロジックを管理します。
 */
/***********************************************************
 * R. Strauss 検索関連
 ***********************************************************/

/**
 * R. Straussのデータを取得する。
 * パフォーマンス向上のため、チャンキング対応のキャッシュ機構を導入。
 * @returns {Array<Object>} R. Straussのデータ配列
 */
if (typeof escapeHtmlWithBreaks === 'undefined') {
  function escapeHtmlWithBreaks(str) {
    return escapeHtml(str).replace(/(?:\r\n|\r|\n)/g, '<br>');
  }
}

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
  const range = sheet.getRange(1, 1, lastRow, 8); // 列数を8に変更
  const data = range.getValues();

  const header = data.shift();
  const headerMap = header.reduce((obj, col, i) => { if (col) { obj[col.toString().trim().toLowerCase()] = i; } return obj; }, {});
  const requiredHeaders = ['oper', 'aufzug', 'szene', 'page', 'whom', 'de', 'ja', 'de_normalized']; // de_normalized を追加
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
  const cacheKey = 'rs_de_terms_cache_v2';
  const cached = getChunkedCache(cacheKey);
  if (cached) {
    return cached;
  }

  const allData = getRichardStraussData();
  const terms = allData
    .map(row => ({ original: row.de, normalized: row.de_normalized }))
    .filter(item => item.original && item.normalized);

  const uniqueTerms = Array.from(new Map(terms.map(item => [item.original, item])).values());
  setChunkedCache(cacheKey, uniqueTerms, 21600);
  return uniqueTerms;
}

/**
 * [クライアントサイド検索用] R.Straussの全用語リストを返す
 * @returns {Array<string>}
 */
function getRSTermsForClient() {
  return getRichardStraussDeTerms().map(item => ({
    original: item.original || '',
    normalized: item.normalized || normalizeString(item.original || '')
  }));
}

function searchRSTermsPartially(input) {
  if (!input || typeof input !== 'string' || input.trim().length < 2) return [];
  const normalizedInput = normalizeString(input);
  const allTerms = getRichardStraussDeTerms();
  return allTerms
    .filter(item => item.normalized.startsWith(normalizedInput))
    .map(item => item.original)
    .slice(0, 20);
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
      html += `<div class="result-a">${escapeHtmlWithBreaks(de)}</div>`;
      groupedByDe[de].forEach(row => {
        const ja = escapeHtmlWithBreaks(row.ja || '');
        const whom = escapeHtml(row.whom || '');

        const operKey = normalizeString(row.oper || '');
        const aufzug = (row.aufzug || '0').toString().trim().toLowerCase();
        const szene = (row.szene || '0').toString().trim().toLowerCase();
        const page = escapeHtml(row.page || '');

        const operaDisplayName = operaDisplayNames[operKey] || escapeHtml(row.oper);
        const sceneMapKey = `${operKey}-${aufzug}-${szene}`;
        const sceneName = escapeHtml(sceneMap[sceneMapKey] || `場面(${aufzug}-${szene})`);

        const pageDisplay = page ? `p.${page}` : '';
        let sitedata = `${operaDisplayName} ${sceneName} ${pageDisplay}`.trim();
        if (whom) {
          sitedata = sitedata ? `${sitedata}：${whom}` : `：${whom}`;
        }

        html += `<div class="result-c">${ja}</div>`;
        if (sitedata) {
          html += `<div class="result-loc">【${sitedata}】</div>`;
        }
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
