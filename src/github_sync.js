/**
 * GitHub API連携スクリプト
 * スプレッドシートから取得したJSONデータをGitHubリポジトリに直接プッシュ
 */

// 設定情報をスクリプトプロパティから取得
function getGitHubConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    token: props.getProperty('GITHUB_TOKEN'),
    owner: props.getProperty('GITHUB_OWNER') || 'yutaka-okawachi',
    repo: props.getProperty('GITHUB_REPO') || 'gaswebapp-manual',
    branch: props.getProperty('GITHUB_BRANCH') || 'main'
  };
}

/**
 * GitHubの既存ファイルのSHAを取得
 * @param {string} path - ファイルパス
 * @param {Object} config - GitHub設定
 * @return {string} SHA（存在しない場合はnull）
 */
function getFileSha(path, config) {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`;
  
  const options = {
    method: 'get',
    headers: {
      'Authorization': `token ${config.token}`,
      'Accept': 'application/vnd.github.v3+json'
    },
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    
    if (statusCode === 200) {
      const data = JSON.parse(response.getContentText());
      return data.sha;
    } else if (statusCode === 404) {
      // ファイルが存在しない場合
      return null;
    } else {
      Logger.log(`警告: ${path} のSHA取得に失敗 (Status: ${statusCode})`);
      return null;
    }
  } catch (e) {
    Logger.log(`エラー: ${path} のSHA取得中にエラー - ${e.message}`);
    return null;
  }
}

/**
 * GitHubにファイルをプッシュ（作成または更新）
 * @param {string} path - ファイルパス
 * @param {Object} content - JSONデータ
 * @param {string} message - コミットメッセージ
 * @param {Object} config - GitHub設定
 * @return {Object} レスポンス
 */
function pushFileToGitHub(path, content, message, config) {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
  
  // JSONを文字列化してUTF-8でBase64エンコード
  const jsonString = JSON.stringify(content, null, 2);
  
  // UTF-8として正しくエンコードするためにBlobを使用
  const blob = Utilities.newBlob(jsonString, 'application/json; charset=utf-8');
  const base64Content = Utilities.base64Encode(blob.getBytes());
  
  // 既存ファイルのSHAを取得
  const sha = getFileSha(path, config);
  
  const payload = {
    message: message,
    content: base64Content,
    branch: config.branch
  };
  
  // 既存ファイルの場合はSHAを追加
  if (sha) {
    payload.sha = sha;
  }
  
  const options = {
    method: 'put',
    headers: {
      'Authorization': `token ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (statusCode === 200 || statusCode === 201) {
      Logger.log(`✓ 成功: ${path} をプッシュしました`);
      return { success: true, path: path, statusCode: statusCode };
    } else {
      Logger.log(`✗ エラー: ${path} のプッシュに失敗 (Status: ${statusCode})`);
      Logger.log(`レスポンス: ${responseText}`);
      return { success: false, path: path, statusCode: statusCode, error: responseText };
    }
  } catch (e) {
    Logger.log(`✗ 例外エラー: ${path} - ${e.message}`);
    return { success: false, path: path, error: e.message };
  }
}

/**
 * 複数のファイルをGitHubにプッシュ
 * @param {Object} files - { 'path/to/file.json': jsonData, ... }
 * @param {string} commitMessage - コミットメッセージ（オプション）
 * @return {Object} 結果サマリー
 */
function pushToGitHub(files, commitMessage) {
  const config = getGitHubConfig();
  
  // 設定チェック
  if (!config.token) {
    throw new Error('GitHub Tokenが設定されていません。setup_credentials.js を実行してください。');
  }
  
  // デフォルトのコミットメッセージ
  const message = commitMessage || `自動更新: スプレッドシートからデータ同期 [${new Date().toLocaleString('ja-JP')}]`;
  
  const results = {
    success: [],
    failed: [],
    total: Object.keys(files).length
  };
  
  // 各ファイルをプッシュ
  for (const [path, content] of Object.entries(files)) {
    Logger.log(`処理中: ${path}`);
    
    // APIレート制限対策: 各リクエスト間に1秒待機
    if (results.success.length + results.failed.length > 0) {
      Utilities.sleep(1000);
    }
    
    const result = pushFileToGitHub(path, content, message, config);
    
    if (result.success) {
      results.success.push(path);
    } else {
      results.failed.push({ path: path, error: result.error });
    }
  }
  
  // 結果をログ出力
  Logger.log('=== プッシュ結果 ===');
  Logger.log(`成功: ${results.success.length} / ${results.total}`);
  Logger.log(`失敗: ${results.failed.length} / ${results.total}`);
  
  if (results.failed.length > 0) {
    Logger.log('失敗したファイル:');
    results.failed.forEach(f => Logger.log(`  - ${f.path}: ${f.error}`));
  }
  
  return results;
}

/**
 * テスト用: 単一のテストファイルをプッシュ
 */
function testGitHubSync() {
  const testData = {
    test: 'data',
    timestamp: new Date().toISOString(),
    message: 'GASからのテストプッシュ'
  };
  
  const files = {
    'test/gas_test.json': testData
  };
  
  try {
    const result = pushToGitHub(files, 'テスト: GAS GitHub連携確認');
    Logger.log('テスト結果: ' + JSON.stringify(result, null, 2));
    
    if (result.success.length > 0) {
      Logger.log('✓ テスト成功！GitHubリポジトリを確認してください。');
    } else {
      Logger.log('✗ テスト失敗。設定を確認してください。');
    }
  } catch (e) {
    Logger.log('✗ エラー: ' + e.message);
  }
}
