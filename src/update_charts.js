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
  
  // 「検索履歴まとめ」シートが存在しない場合は作成し、ある場合は初期化する
  if (!summarySheet) {
    summarySheet = ss.insertSheet('検索履歴まとめ');
  } else {
    summarySheet.clear();
    const charts = summarySheet.getCharts();
    for (let i = 0; i < charts.length; i++) {
        summarySheet.removeChart(charts[i]);
    }
  }
  
  const data = historySheet.getDataRange().getValues();
  if (data.length <= 1) return; // データがない場合は終了
  
  const headers = data[0];
  const rows = data.slice(1);
  
  // グラフ化したい列の構成（ヘッダー名とグラフ種別のマッピング）
  // PIE: 全体の割合を見るのに適している（Work, Page, Instrumentsなど）
  // COLUMN: 項目ごとの絶対的な量や比較を見るのに適している（Term, Szene, Whomなど）
  const targetColumns = [
    { name: 'Work', type: Charts.ChartType.PIE, titleSuffix: 'の検索割合' },
    { name: 'Page', type: Charts.ChartType.PIE, titleSuffix: 'の検索割合' },
    { name: 'Term', type: Charts.ChartType.COLUMN, titleSuffix: 'の検索回数' },
    { name: 'Instruments', type: Charts.ChartType.PIE, titleSuffix: 'の検索割合' },
    { name: 'Szene', type: Charts.ChartType.COLUMN, titleSuffix: 'の検索回数' },
    { name: 'Whom', type: Charts.ChartType.COLUMN, titleSuffix: 'の検索回数' }
  ];
  
  // データの出力開始行
  let currentStartRow = 1;
  // グラフの配置開始行
  let chartRowStart = 1;
  const chartColStart = 4; // グラフはD列から配置
  
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
        // 最近30日分に絞る（長すぎると見づらいため）
        const recentDailyCounts = sortedDailyCounts.slice(-30);

        summarySheet.getRange(currentStartRow, 1).setValue('日付');
        summarySheet.getRange(currentStartRow, 2).setValue('検索回数');
        summarySheet.getRange(currentStartRow, 1, 1, 2).setFontWeight("bold");
        
        summarySheet.getRange(currentStartRow + 1, 1, recentDailyCounts.length, 2).setValues(recentDailyCounts);
        
        const chartDataRange = summarySheet.getRange(currentStartRow, 1, recentDailyCounts.length + 1, 2);
        
        // 日別の推移は折れ線グラフ (LINE) または縦棒グラフ (COLUMN) が適している
        const chartBuilder = summarySheet.newChart()
            .setChartType(Charts.ChartType.LINE)
            .addRange(chartDataRange)
            .setPosition(chartRowStart, chartColStart, 0, 0)
            .setOption('title', `【日別検索回数】 の推移（直近${recentDailyCounts.length}日）`)
            .setOption('width', 600)
            .setOption('height', 350)
            .setOption('legend', {position: 'none'}) // 凡例は１つしかないので非表示
            .setOption('pointSize', 5); // 折れ線グラフの点を表示
            
        summarySheet.insertChart(chartBuilder.build());
        
        currentStartRow += recentDailyCounts.length + 3;
        chartRowStart += 18;
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
    
    // 集計データをシートのA～B列に書き込む
    summarySheet.getRange(currentStartRow, 1).setValue(colName);
    summarySheet.getRange(currentStartRow, 2).setValue('検索回数');
    
    // 見出しを太字に
    summarySheet.getRange(currentStartRow, 1, 1, 2).setFontWeight("bold");
    
    summarySheet.getRange(currentStartRow + 1, 1, topCounts.length, 2).setValues(topCounts);
    
    // グラフを作成
    const chartDataRange = summarySheet.getRange(currentStartRow, 1, topCounts.length + 1, 2);
    let chartBuilder = summarySheet.newChart()
        .setChartType(colConfig.type)
        .addRange(chartDataRange)
        .setPosition(chartRowStart, chartColStart, 0, 0)
        .setOption('title', `【${colName}】 ${colConfig.titleSuffix}（上位${topCounts.length}件）`)
        .setOption('width', 500)
        .setOption('height', 300);
        
    // グラフ種別ごとの個別オプション調整
    if (colConfig.type === Charts.ChartType.COLUMN) {
        chartBuilder = chartBuilder.setOption('legend', {position: 'none'});
    }
    
    summarySheet.insertChart(chartBuilder.build());
    
    // 次の表とグラフの位置をずらす
    currentStartRow += topCounts.length + 3;
    chartRowStart += 16;
  }
}
