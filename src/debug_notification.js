/**
 * 通知システムの動作確認用テストスクリプト
 * 
 * このスクリプトを GAS エディタで実行して、メール通知が正しく機能するか確認できます。
 */

/**
 * 1. サーバーサイドの直接通知テスト
 * GAS プロジェクト内から MailApp.sendEmail を直接呼び出すテストです。
 */
function testServerSideNotification() {
  const subject = "【テスト】通知システム動作確認（サーバーサイド）";
  const body = "このメールは、GASのサーバーサイド関数から直接送信されたテストメールです。\n実行日時: " + new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  
  try {
    sendSearchNotification(subject, body);
    Logger.log("サーバーサイド通知テストを実行しました。実行ログと受信箱（pistares@ezweb.ne.jp）を確認してください。");
  } catch (e) {
    Logger.log("エラーが発生しました: " + e.toString());
  }
}

/**
 * 2. doPost (Web App) のシミュレーションテスト
 * GitHub Pages 等から fetch POST で呼ばれる際の処理をテストします。
 */
function testDoPostSimulation() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        work: "交響曲第1番ニ長調（1884-88）",
        scope: "v1, v2",
        term: "Test Term",
        page: "index.html",
        userAgent: "Mock UserAgent (Test)"
      })
    }
  };
  
  try {
    const result = doPost(mockEvent);
    Logger.log("doPost シミュレーション結果: " + result.getContent());
  } catch (e) {
    Logger.log("doPost シミュレーションエラー: " + e.toString());
  }
}

/**
 * 3. スクリプトプロパティの確認
 * 必要な設定値（SPREADSHEET_ID等）が正しくセットされているか確認します。
 */
function checkScriptProperties() {
  const props = PropertiesService.getScriptProperties().getProperties();
  Logger.log("--- スクリプトプロパティの確認 ---");
  Logger.log("SPREADSHEET_ID: " + (props.SPREADSHEET_ID ? "✅ 設定済み" : "❌ 未設定"));
  Logger.log("GAS_SECRET_TOKEN: " + (props.GAS_SECRET_TOKEN ? "✅ 設定済み" : "❌ 未設定"));
  Logger.log("GITHUB_TOKEN: " + (props.GITHUB_TOKEN ? "✅ 設定済み" : "❌ 未設定"));
  
  if (!props.SPREADSHEET_ID) {
    Logger.log("⚠️ 注意: SPREADSHEET_ID が未設定のため、検索機能が動作しません。");
  }
}
