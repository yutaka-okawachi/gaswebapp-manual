/**
 * UIなし版：スクリプトプロパティに直接設定
 * スプレッドシートから開けない場合はこちらを使用
 */
function setupGitHubCredentialsManual() {
  // ⚠️ 以下の値を直接編集してから実行してください
  
  const config = {
    GITHUB_TOKEN: 'ghp_YOUR_TOKEN_HERE',  // ← ここにトークンを貼り付け
    GITHUB_OWNER: 'yutaka-okawachi',
    GITHUB_REPO: 'gaswebapp-manual',
    GITHUB_BRANCH: 'main',
    SPREADSHEET_ID: '1WTZicVS_Dnu5PHQf1RPrXyS03LffwjbTwPu7bn61WTJTfQzTcimC5Pqs'
  };
  
  // 検証
  if (config.GITHUB_TOKEN === 'ghp_YOUR_TOKEN_HERE') {
    Logger.log('エラー: GITHUB_TOKENを設定してください');
    throw new Error('GITHUB_TOKENを設定してから実行してください');
  }
  
  // スクリプトプロパティに保存
  const props = PropertiesService.getScriptProperties();
  props.setProperties(config);
  
  Logger.log('✓ 設定が保存されました');
  Logger.log('GitHub Owner: ' + config.GITHUB_OWNER);
  Logger.log('Repository: ' + config.GITHUB_REPO);
  Logger.log('Branch: ' + config.GITHUB_BRANCH);
  Logger.log('Spreadsheet ID: ' + config.SPREADSHEET_ID);
  Logger.log('Token: 設定済み');
  Logger.log('');
  Logger.log('次のステップ: testGitHubSync() を実行してテストしてください');
}

/**
 * 現在の設定を確認（UIなし版）
 */
function viewGitHubSettingsLog() {
  const props = PropertiesService.getScriptProperties();
  
  const token = props.getProperty('GITHUB_TOKEN');
  const owner = props.getProperty('GITHUB_OWNER');
  const repo = props.getProperty('GITHUB_REPO');
  const branch = props.getProperty('GITHUB_BRANCH');
  const spreadsheetId = props.getProperty('SPREADSHEET_ID');
  
  Logger.log('=== 現在の設定 ===');
  Logger.log('Owner: ' + (owner || '未設定'));
  Logger.log('Repo: ' + (repo || '未設定'));
  Logger.log('Branch: ' + (branch || '未設定'));
  Logger.log('Spreadsheet ID: ' + (spreadsheetId || '未設定'));
  Logger.log('Token: ' + (token ? '設定済み (' + token.substring(0, 7) + '...)' : '未設定'));
}
