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
    .addItem('項目の作成・補完（Notes・GM・RW・RS）', 'showMaintenanceWorkbench')
    .addItem('既存見出しへの語形対応を確認', 'showMaintenanceAliases')
    .addItem('保守の判定・履歴を確認', 'showMaintenanceLedgerHistory')
    .addItem('管理台帳への移行を確認', 'confirmMaintenanceLedgerMigrationFromSheet')
    .addItem('既存語形対応の出典を調査', 'refreshDictionarySourceMarkersForMappingsFromMenu')
    .addItem('並べ替え', 'sortMaintenanceRows')
    .addSeparator()
    .addItem('それぞれの関数の役割を見る', 'showMaintenanceFunctionRoles')
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
<p>シート上部の「🛠 日常保守」から使います．この説明はいつでも「それぞれの関数の役割を見る」で開けます．</p>
<h2>新しい項目をNotesへ登録する</h2>
<ol>
<li>「項目の作成・補完（Notes・GM・RW・RS）」を開きます．</li>
<li>「未登録語をNotesへ登録する」の「処理する語」から1語を選び，「出典を調べて日英案を作る」を押します．候補は検索で観測された未登録語です．<strong>案を作るとOpenAI APIを利用します．</strong></li>
<li>表示された出典・根拠・日本語全文・英語全文・対応語を確認し，必要なら本文を編集します．確認待ちの指摘があれば内容を直します．</li>
<li>登録内容を確認したチェックを入れ，「内容を承認してNotesに登録」を押します．承認した内容がNotesへ保存されます．</li>
</ol>
<p class="note">保存済みの案があるときは「保存状態を確認」で続きを開きます．通信が途切れた場合も，まず保存状態を確認します．次の語へ進むときは，現在の語の作業を終了します．</p>
<h2>各メニューの役割と操作</h2>
<details><summary>項目の作成・補完（Notes・GM・RW・RS）</summary>
<p>新規登録は上の手順を使います．既存行の空欄を補う場合は，対象タブで本文の行を1～5行選び，このメニューから「選択行を補完・再開（GM・RW・RS・Notes）」を押します．</p>
<p>行ごとに「この行の翻訳案を生成」など画面に出た操作を選び，日英の全文を確認・編集して「確認した内容を空欄へ反映」を押します．入力済みの本文を上書きする処理ではありません．翻訳案の生成時にOpenAI APIを使います．</p>
</details>
<details><summary>既存見出しへの語形対応を確認</summary>
<p>新しい本文を作らず，変化形・別綴りなどを既存の公開済みNotes見出しへ対応付けます．検索語，対応見出し，語形区分を選び，確認のチェックを入れて「確認して語形対応へ追加する」を押します．</p>
<p>自分で判断して追加する操作はOpenAI API・Jev APIを使いません．「Jevで調査・過去の判定を確認」から調査を実行する場合は，別の確認画面を経てJev APIを利用します．</p>
</details>
<details><summary>保守の判定・履歴を確認</summary>
<p>保守管理台帳にある判定・保留・未処理の状態を確認します．判定を選び，分類・対応見出し・人による確認・メモを確認して，チェック後に「この判定を保存する」を押します．</p>
<p>画面を開くだけではAPI調査を実行しません．判定の保存は台帳を更新します．新規Notes本文の登録は「項目の作成・補完」を使います．</p>
</details>
<details><summary>管理台帳への移行を確認</summary>
<p>旧台帳を保守管理台帳へまとめる初回移行用の項目です．<strong>このシートは移行済みなので，通常の登録・補完では使いません．</strong>移行済みの場合は現在の台帳の状態を確認し，移行を繰り返しません．</p>
</details>
<details><summary>既存語形対応の出典を調査</summary>
<p>登録済みの語形対応をGM・RW・RSの実例と照合し，対応するNotesのsource欄に出典記号を補います．<strong>このメニューを選ぶと調査と必要な追記が始まります．</strong>完了画面で更新件数を確認します．同じ出典は重複追記しません．OpenAI API・Jev APIは使いません．</p>
</details>
<details><summary>並べ替え</summary>
<p><strong>このメニューを選ぶと，GMとNotesの2行目以降をA列の昇順（A→Z）に並べ替えます．</strong>選択中のタブにかかわらず両方が対象です．作業中の草案・予約は保持します．並べ替え後の登録・補完では，同じ内容の対象を照合します．</p>
<p>見出し行は固定し，全列の項目データを一緒に移します．GM!B2のARRAYFORMULAは同じB2に復元します．Notesの「準備状態」は，見出しがある行を「承認」に更新します．空の行や新規登録の途中状態は公開承認へ変更しません．完了画面を確認してください．API生成は行いません．</p>
</details>
<p class="note">Notesの登録・承認済み項目はシート上で直接編集でき，編集後の本文は次回同期の対象になります．新規項目は登録メニューで内容を承認して登録します．シートへの保存と公開サイトへの反映は別の操作で，公開にはPCでのsync-dataが必要です．この説明を開いても，データの読取り・変更・API生成・公開は行いません．</p>
</body></html>`).setWidth(800).setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, '日常保守の使い方');
}
