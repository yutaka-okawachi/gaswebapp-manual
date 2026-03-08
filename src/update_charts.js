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
  
  // グラフ化したい列のヘッダー名
  const targetColumns = ['Work', 'Page', 'Term', 'Instruments', 'Szene', 'Whom'];
  
  // データの出力開始行
  let currentStartRow = 1;
  // グラフの配置開始行
  let chartRowStart = 1;
  const chartColStart = 4; // グラフはD列から配置
  
  for (let colName of targetColumns) {
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
    
    // グラフを作成（円グラフ）
    const chartDataRange = summarySheet.getRange(currentStartRow, 1, topCounts.length + 1, 2);
    const chartBuilder = summarySheet.newChart()
        .setChartType(Charts.ChartType.PIE)
        .addRange(chartDataRange)
        .setPosition(chartRowStart, chartColStart, 0, 0)
        .setOption('title', `【${colName}】 の検索割合（上位${topCounts.length}件）`)
        .setOption('width', 500)
        .setOption('height', 300);
        
    summarySheet.insertChart(chartBuilder.build());
    
    // 次の表とグラフの位置をずらす
    currentStartRow += topCounts.length + 3;
    chartRowStart += 16;
  }
}
