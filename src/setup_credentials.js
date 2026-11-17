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
  addSheetRowNavigationMenu_(ui);
  ui.createMenu('🛠 日常保守')
    .addItem('用語を調べて登録・編集', 'showMaintenanceWorkbench')
    .addItem('選択行の空欄補完', 'showMaintenanceSelectedRows')
    .addItem('並べ替え', 'sortMaintenanceRows')
    .addSeparator()
    .addItem('使い方', 'showMaintenanceFunctionRoles')
    .addToUi();
  ui.createMenu('🔧 データ同期')
    .addItem('同期方法を確認', 'showSyncInstructions')
    .addItem('このシートをデータ元に設定', 'setupSpreadsheetId')
    .addToUi();

  ui.createMenu('📊 検索履歴グラフ')
    .addItem('🔄 グラフを最新に更新する', 'updateSearchHistoryCharts')
    .addToUi();
  if (typeof notesEntryGuardInitialize_ === 'function') notesEntryGuardInitialize_();

}

/** Static menu help: opening this dialog reads no sheet data and runs no generation. */
function showMaintenanceFunctionRoles() {
  const html = HtmlService.createHtmlOutput(`<!doctype html><html lang="ja"><head><base target="_top"><meta charset="utf-8">
<style>body{font:14px/1.65 Arial,sans-serif;color:#23303e;margin:20px}h1{font-size:21px}h2{font-size:17px;margin:20px 0 8px}li{margin:6px 0}details{border:1px solid #cdd5dd;border-radius:6px;margin:10px 0;padding:12px}summary{font-weight:bold;cursor:pointer}p{margin:8px 0}.note{background:#f2f5f8;padding:12px;border-radius:6px}strong{color:#172a43}</style></head><body>
<h1>日常保守の使い方</h1>
<h2>用語を調べて登録・編集</h2>
<ol><li>検索画面の「整備する語をコピー」でコピーした単語，または調べたい語を入力する．検索から保守用の候補記録は作成しない．</li><li>既存のNotes見出しとGM・RW・RSの用例を確認する．必要ならAPIで判断の参考情報を得る．</li><li>既存見出しの語形なら語形対応へ，新しい見出しが必要ならNotesの新規登録へ進む．意味・出典・本文を確認してから保存する．</li></ol>
<p>新規の日英案の生成ではOpenAI APIを使う．調査結果は参考であり，保存前に内容を確認する．</p>
<p class="note">英語のSee・also・kindなどがドイツ語の見出しへの参照と混同される場合がある．英訳の参照先と表示を確認し，意図しない自動リンクを付けない．ドイツ語の用語を指す正しい参照は残す．</p>
<h2>選択行の空欄補完</h2>
<p>Notes・GM・RW・RSで対象行を選択して開く．画面の案と現在の内容を確認し，必要な項目を編集・補完する．入力済み本文を不用意に置き換えない．</p>
<h2>並べ替え</h2>
<p>GMとNotesの2行目以降をA列の昇順に並べ替える．他のタブは対象外．見出し行を残し，全列のデータを一緒に移す．GMの正規化式も保持する．実行結果を確認する．</p>
<p class="note">シートへの保存と公開サイトへの反映は別の操作．公開にはPCでsync-dataを実行する．この説明を開いてもAPI利用や保存・公開は行わない．</p>
</body></html>`).setWidth(800).setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, '日常保守の使い方');
}
