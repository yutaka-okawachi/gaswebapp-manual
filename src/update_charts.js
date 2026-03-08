/**
 * 検索履歴からデータを集計し、「検索履歴まとめ」シートにグラフを自動生成します
 */
function updateSearchHistoryCharts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const historySheet = ss.getSheetByName('検索履歴');
  let summarySheet = ss.getSheetByName('検索履歴まとめ');
  
  if (!historySheet) {
    Logger.log('「検索履歴」シートが見つかりません。');
    return;
  }
  
  // 「検索履歴まとめ（データ用）」シート（非表示推奨）と「検索履歴まとめ」シート（ダッシュボード用）を分ける
  let dataSheet = ss.getSheetByName('検索履歴まとめ（データ）');
  let dashboardSheet = ss.getSheetByName('検索履歴まとめ');
  
  // データ用シートの準備
  if (!dataSheet) {
    dataSheet = ss.insertSheet('検索履歴まとめ（データ）');
    dataSheet.hideSheet(); // ユーザーからは見えないように隠す
  } else {
    dataSheet.clear();
  }

  // ダッシュボード（グラフ専用）シートの準備
  if (!dashboardSheet) {
    dashboardSheet = ss.insertSheet('検索履歴まとめ');
  } else {
    // 既存のグラフをすべて削除
    const charts = dashboardSheet.getCharts();
    for (let i = 0; i < charts.length; i++) {
        dashboardSheet.removeChart(charts[i]);
    }
    // セルの中身も念のためクリアし、背景を白にする等で見やすくできる
    dashboardSheet.clear();
  }
  
  const data = historySheet.getDataRange().getValues();
  if (data.length <= 1) return; // データがない場合は終了
  
  const headers = data[0];
  const rows = data.slice(1);
  
  // グラフ化したい列の構成（ヘッダー名とグラフ種別のマッピング）
  // PIE: 全体の割合を見るのに適している（Work, Page, Instrumentsなど）
  // COLUMN: 項目ごとの絶対的な量や比較を見るのに適している（Term, Szene, Whomなど）
  const targetColumns = [
    { name: 'Work', type: Charts.ChartType.COLUMN, titleSuffix: 'の検索回数' },
    { name: 'Page', type: Charts.ChartType.COLUMN, titleSuffix: 'の検索回数' },
    { name: 'Term', type: Charts.ChartType.COLUMN, titleSuffix: 'の検索回数' },
    { name: 'Instruments', type: Charts.ChartType.COLUMN, titleSuffix: 'の検索回数' },
    { name: 'Szene', type: Charts.ChartType.COLUMN, titleSuffix: 'の検索回数' },
    { name: 'Whom', type: Charts.ChartType.COLUMN, titleSuffix: 'の検索回数' }
  ];
  
  // データの出力開始行 (データ用シート)
  let currentStartRow = 1;
  
  // グラフの配置 (ダッシュボード用シート)
  let chartRowStart = 2; // 少し上部に余白を持たせる
  let chartColStart = 2; // B列から配置（左端に余白を入れるため）
  
  // グラフを横に並べるためのカウンタ
  let chartCount = 0;
  const maxChartsPerRow = 2; // 1行に並べるグラフの数
  
  // ====== 1. 日別検索回数の集計とグラフ化 ======
  // 「日時」列は通常インデックス0
  const dateColIndex = headers.indexOf('日時');
  if (dateColIndex !== -1) {
    const dailyCounts = {};
    for (let r = 0; r < rows.length; r++) {
      let val = rows[r][dateColIndex];
      if (!val) continue;
      
      // 日付オブジェクトから 'YYYY/MM/DD' の文字列を作成
      let dateObj = new Date(val);
      if (isNaN(dateObj.getTime())) continue; // 有効な日付でない場合はスキップ
      
      let dateStr = Utilities.formatDate(dateObj, Session.getScriptTimeZone(), 'yyyy/MM/dd');
      dailyCounts[dateStr] = (dailyCounts[dateStr] || 0) + 1;
    }
    
    // 日付順にソート（古い順）
    const sortedDailyCounts = Object.keys(dailyCounts)
      .sort((a, b) => new Date(a) - new Date(b))
      .map(k => [k, dailyCounts[k]]);
      
    if (sortedDailyCounts.length > 0) {
        // 最近90日分（約3か月）に絞る
        const recentDailyCounts = sortedDailyCounts.slice(-90);

        // データシートへ書き込み
        dataSheet.getRange(currentStartRow, 1).setValue('日付');
        dataSheet.getRange(currentStartRow, 2).setValue('検索回数');
        dataSheet.getRange(currentStartRow, 1, 1, 2).setFontWeight("bold");
        dataSheet.getRange(currentStartRow + 1, 1, recentDailyCounts.length, 2).setValues(recentDailyCounts);
        
        // グラフのデータ範囲はデータシートから取得
        const chartDataRange = dataSheet.getRange(currentStartRow, 1, recentDailyCounts.length + 1, 2);
        
        // ダッシュボードシートにグラフを配置
        // 日別のグラフは横幅を取りたいので、1段丸々使う
        const chartBuilder = dashboardSheet.newChart()
            .setChartType(Charts.ChartType.LINE)
            .addRange(chartDataRange)
            .setPosition(chartRowStart, chartColStart, 0, 0)
            .setOption('title', `【日別検索回数】 の推移（直近${recentDailyCounts.length}日）`)
            .setOption('width', 900) // 横長にする
            .setOption('height', 350)
            .setOption('legend', {position: 'none'}) 
            .setOption('pointSize', 5);
            
        dashboardSheet.insertChart(chartBuilder.build());
        
        // 次のデータ位置
        currentStartRow += recentDailyCounts.length + 3;
        // 次のグラフ位置（一番上の段を使ったので、次の段へ下がる距離を長めに確保）
        chartRowStart += 22; // 350pxの高さに対して約22セル分
    }
  }

  // ====== 2. 各列の集計とグラフ化 ======
  for (let colConfig of targetColumns) {
    const colName = colConfig.name;
    const colIndex = headers.indexOf(colName);
    if (colIndex === -1) continue;
    
    // 各項目の出現回数を集計
    const counts = {};
    for (let r = 0; r < rows.length; r++) {
      let val = rows[r][colIndex];
      // 空白データや未指定のデータを除外
      if (val === "" || val == null || val === "未指定") continue;
      
      val = String(val).trim();
      counts[val] = (counts[val] || 0) + 1;
    }
    
    // 配列に変換してカウントの降順でソート
    const sortedCounts = Object.keys(counts)
      .map(k => [k, counts[k]])
      .sort((a, b) => b[1] - a[1]);
    
    // グラフが煩雑にならないよう、上位20件に絞る（必要に応じて変更可）
    const topCounts = sortedCounts.slice(0, 20);
    
    if (topCounts.length === 0) continue;
    
    // 集計データをデータ用シートへ書き込む
    dataSheet.getRange(currentStartRow, 1).setValue(colName);
    dataSheet.getRange(currentStartRow, 2).setValue('検索回数');
    dataSheet.getRange(currentStartRow, 1, 1, 2).setFontWeight("bold");
    dataSheet.getRange(currentStartRow + 1, 1, topCounts.length, 2).setValues(topCounts);
    
    // グラフのデータ範囲
    const chartDataRange = dataSheet.getRange(currentStartRow, 1, topCounts.length + 1, 2);
    
    // 現在の配置位置（列）を計算（横の間隔を広げすぎないよう調整）
    let currentColPos = chartColStart + (chartCount % maxChartsPerRow) * 6; // 横幅450pxに対して約6列分 (適度な間隔)
    
    let chartBuilder = dashboardSheet.newChart()
        .setChartType(colConfig.type)
        .addRange(chartDataRange)
        .setPosition(chartRowStart, currentColPos, 0, 0)
        .setOption('title', `【${colName}】 ${colConfig.titleSuffix}（上位${topCounts.length}件）`)
        .setOption('width', 450)
        .setOption('height', 320);
        
    // グラフ種別ごとの個別オプション調整
    if (colConfig.type === Charts.ChartType.COLUMN) {
        chartBuilder = chartBuilder.setOption('legend', {position: 'none'});
    }
    
    dashboardSheet.insertChart(chartBuilder.build());
    
    // 次のデータ位置
    currentStartRow += topCounts.length + 3;
    
    // グラフを配置したのでカウンタを進め、改行判定
    chartCount++;
    if (chartCount % maxChartsPerRow === 0) {
        chartRowStart += 20; // 320pxの高さに対して約20セル分（縦の余白を多めに）
    }
  }
}
