/**
 * GAS 側の初期設定とスプレッドシート用メニュー。
 * GitHub 認証は PC 側だけで管理し、GAS のプロパティには保存しない。
 */

/**
 * 現在開いているスプレッドシートをデータ元として登録する。
 * 初回設定時、またはデータ元を変更するときだけ実行する。
 */
function setupSpreadsheetId() {
  const ui = SpreadsheetApp.getUi();
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  const response = ui.alert(
    'データ元の確認',
    '現在開いているスプレッドシートを同期データ元として登録しますか？',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheetId);
  ui.alert('設定完了', '同期データ元を登録しました。', ui.ButtonSet.OK);
}

/**
 * 現行の同期方法を表示する。
 */
function showSyncInstructions() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'データ同期',
    'GitHubへの公開はPCで 02_RUN_SYNC.bat を実行してください。\n' +
    '組み立て、検証、GAS更新、データ取得、公開前確認、GitHub Pagesの確認まで自動で進みます。',
    ui.ButtonSet.OK
  );
}

/**
 * カスタムメニューを追加する。
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔧 データ同期')
    .addItem('同期方法を確認', 'showSyncInstructions')
    .addItem('このシートをデータ元に設定', 'setupSpreadsheetId')
    .addToUi();

  ui.createMenu('📊 検索履歴グラフ')
    .addItem('🔄 グラフを最新に更新する', 'updateSearchHistoryCharts')
    .addToUi();
}
