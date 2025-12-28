/**
 * Web Trigger for Automated Deployment
 * 
 * このスクリプトは、PowerShellから HTTP GET リクエストで GAS 関数を実行するための
 * Web App エントリーポイントです。
 * 
 * デプロイ方法:
 * 1. GAS エディタで「デプロイ」→「新しいデプロイ」
 * 2. 種類: 「ウェブアプリ」
 * 3. 実行ユーザー: 「自分」
 * 4. アクセスできるユーザー: 「全員」
 * 5. デプロイ URL をコピーして環境変数に設定
 */

// 秘密トークン
// このトークンは環境変数 GAS_SECRET_TOKEN と一致させてください
// 秘密トークンをスクリプトプロパティから取得
const SECRET_TOKEN = PropertiesService.getScriptProperties().getProperty('GAS_SECRET_TOKEN');

/**
 * HTTP GET リクエストのハンドラー
 * 
 * @param {Object} e - リクエストパラメータ
 * @param {Object} e.parameter - クエリパラメータ
 * @param {string} e.parameter.token - 認証トークン
 * @param {string} e.parameter.action - 実行するアクション
 * @return {ContentService.TextOutput} JSON レスポンス
 */
function doGet(e) {
  return handleRequest(e.parameter);
}

function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    return handleRequest(params);
  } catch (error) {
    return createJsonResponse({
      status: "error",
      error: "Invalid JSON payload: " + error.toString()
    }, 400);
  }
}

/**
 * リクエストの共通処理ロジック
 */
function handleRequest(params) {
  try {
    // パラメータの取得 (GET/POST両対応)
    const token = params.token;
    const action = params.action || params.function;
    
    // 認証チェック
    if (!token || token !== SECRET_TOKEN) {
      return createJsonResponse({
        status: "error",
        error: "Unauthorized: Invalid or missing token"
      }, 401);
    }
    
    // アクションの実行
    let result;
    if (action === "exportDic" || action === "exportAllDataToJson") {
      Logger.log("Starting exportAllDataToJson...");
      exportAllDataToJson();
      Logger.log("exportAllDataToJson completed");
      result = {
        status: "success",
        message: "dic.html exported and pushed to GitHub successfully",
        timestamp: new Date().toISOString()
      };
    } else if (action === "ping") {
      result = {
        status: "success",
        message: "Web trigger is working correctly",
        timestamp: new Date().toISOString()
      };
    } else {
      result = {
        status: "error",
        error: "Unknown action: " + action
      };
    }
    
    return createJsonResponse(result);
    
  } catch (error) {
    Logger.log("Error in handleRequest: " + error.toString());
    return createJsonResponse({
      status: "error",
      error: error.toString(),
      stack: error.stack
    }, 500);
  }
}

/**
 * JSON レスポンスを作成
 * 
 * @param {Object} data - レスポンスデータ
 * @param {number} statusCode - HTTP ステータスコード（オプション）
 * @return {ContentService.TextOutput} JSON レスポンス
 */
function createJsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
  
  if (statusCode) {
    // Note: GAS Web Apps は常に 200 を返すため、statusCode は参考情報
    data.httpStatus = statusCode;
  }
  
  return output;
}

/**
 * セキュリティトークンの生成ヘルパー
 * 
 * デプロイ後に一度だけ実行して、ランダムなトークンを生成します。
 * 生成されたトークンをこのファイルの SECRET_TOKEN に設定してください。
 * 
 * 使い方:
 * 1. GAS エディタでこの関数を選択
 * 2. 実行ボタンをクリック
 * 3. ログに表示されたトークンをコピー
 * 4. SECRET_TOKEN に貼り付け
 * 5. clasp push で再アップロード
 */
function generateSecretToken() {
  const token = Utilities.getUuid();
  
  // スクリプトプロパティに保存
  PropertiesService.getScriptProperties().setProperty('GAS_SECRET_TOKEN', token);
  
  Logger.log("Generated and saved secret token:");
  Logger.log(token);
  Logger.log("\nNext steps:");
  Logger.log("1. Run 'clasp push' to update the code (to use the new property lookup)");
  Logger.log("2. Update your local .env file or environment variable GAS_SECRET_TOKEN with this value");
  return token;
}
