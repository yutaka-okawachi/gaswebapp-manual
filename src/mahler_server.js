/**
 * GAS の HTTP GET 入口と、通知で使用する場面名データの取得処理。
 * 利用者向け画面は GitHub Pages に統一し、GAS は API と同期処理だけを担う。
 */

const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const PUBLIC_SITE_URL = 'https://yutaka-okawachi.github.io/gaswebapp-manual/';

function doGet(e) {
  const parameters = e && e.parameter ? e.parameter : {};

  // 所有者用ダッシュボードが読む公開集計API。
  if (parameters.api === 'dashboard') {
    return handleDashboardAnalyticsRequest(parameters);
  }

  // sync-data が使用する認証済み管理API。
  if (parameters.token) {
    return handleRequest(parameters);
  }

  // 旧GAS版画面は提供せず、正規のGitHub Pages版へ案内する。
  return createPublicSiteRedirect_();
}

function createPublicSiteRedirect_() {
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0;url=${PUBLIC_SITE_URL}">
  <link rel="canonical" href="${PUBLIC_SITE_URL}">
  <title>公開サイトへ移動します</title>
</head>
<body>
  <p>公開サイトは <a href="${PUBLIC_SITE_URL}" target="_top" rel="noopener">GitHub Pages版</a> に統一しました。</p>
  <script>window.location.replace(${JSON.stringify(PUBLIC_SITE_URL)});</script>
</body>
</html>`;
  return HtmlService.createHtmlOutput(html).setTitle('公開サイトへ移動します');
}

/**
 * 検索通知の場面コードを日本語名へ変換するための対応表を取得する。
 */
function getSceneMap(sheetName) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `scene_map_v3_${sheetName}`;
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) throw new Error(`シート「${sheetName}」が見つかりません。`);

  const data = sheet.getDataRange().getValues();
  const header = data.shift().map(value => value.toString().trim().toLowerCase());
  const operIndex = header.indexOf('oper');
  const actIndex = header.indexOf('aufzug');
  const sceneIndex = header.indexOf('szene');
  const japaneseIndex = header.indexOf('日本語');
  if ([operIndex, actIndex, sceneIndex, japaneseIndex].includes(-1)) {
    throw new Error(`「${sheetName}」シートに必要なヘッダー（Oper, Aufzug, Szene, 日本語）がありません。`);
  }

  const sceneMap = {};
  data.forEach(row => {
    const opera = normalizeString(row[operIndex] || '');
    const act = (row[actIndex] || '0').toString().trim().toLowerCase();
    const scene = (row[sceneIndex] || '0').toString().trim().toLowerCase();
    const japanese = (row[japaneseIndex] || '').toString().trim();
    if (opera && japanese) sceneMap[`${opera}-${act}-${scene}`] = japanese;
  });

  cache.put(cacheKey, JSON.stringify(sceneMap), 3600);
  return sceneMap;
}
