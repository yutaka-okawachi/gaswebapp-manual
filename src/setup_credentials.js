/**
 * GitHub認証情報設定スクリプト
 * 初回セットアップ時に1回だけ実行
 */

/**
 * スクリプトプロパティにGitHub設定を保存
 * GASエディタから実行: setupGitHubCredentials()
 */
function setupGitHubCredentials() {
  const ui = SpreadsheetApp.getUi();
  
  // ステップ1: GitHub Personal Access Tokenの入力
  const tokenResponse = ui.prompt(
    'GitHub設定 - Step 1/4',
    'GitHub Personal Access Token (PAT)を入力してください:\n\n' +
    '※トークンの作成方法:\n' +
    '1. GitHub → Settings → Developer settings\n' +
    '2. Personal access tokens → Fine-grained tokens\n' +
    '3. 新規作成 (Repository: gaswebapp-manual, Permissions: Contents - Read/Write)',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (tokenResponse.getSelectedButton() !== ui.Button.OK) {
    ui.alert('キャンセルされました');
    return;
  }
  
  const token = tokenResponse.getResponseText().trim();
  if (!token) {
    ui.alert('エラー', 'トークンが入力されていません', ui.ButtonSet.OK);
    return;
  }
  
  // ステップ2: GitHubユーザー名の確認
  const ownerResponse = ui.prompt(
    'GitHub設定 - Step 2/4',
    'GitHubユーザー名を確認してください:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (ownerResponse.getSelectedButton() !== ui.Button.OK) {
    ui.alert('キャンセルされました');
    return;
  }
  
  const owner = ownerResponse.getResponseText().trim() || 'yutaka-okawachi';
  
  // ステップ3: リポジトリ名の確認
  const repoResponse = ui.prompt(
    'GitHub設定 - Step 3/4',
    'リポジトリ名を確認してください:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (repoResponse.getSelectedButton() !== ui.Button.OK) {
    ui.alert('キャンセルされました');
    return;
  }
  
  const repo = repoResponse.getResponseText().trim() || 'gaswebapp-manual';
  
  // ステップ4: ブランチ名の確認
  const branchResponse = ui.prompt(
    'GitHub設定 - Step 4/4',
    'プッシュ先のブランチ名を確認してください:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (branchResponse.getSelectedButton() !== ui.Button.OK) {
    ui.alert('キャンセルされました');
    return;
  }
  
  const branch = branchResponse.getResponseText().trim() || 'main';
  
  // スプレッドシートIDを自動取得
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  
  // スクリプトプロパティに保存
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    'GITHUB_TOKEN': token,
    'GITHUB_OWNER': owner,
    'GITHUB_REPO': repo,
    'GITHUB_BRANCH': branch,
    'SPREADSHEET_ID': spreadsheetId
  });
  
  // 確認メッセージ
  const confirmMessage = 
    '設定が完了しました！\n\n' +
    `GitHub Owner: ${owner}\n` +
    `Repository: ${repo}\n` +
    `Branch: ${branch}\n` +
    `Spreadsheet ID: ${spreadsheetId}\n\n` +
    '次のステップ:\n' +
    '1. github_sync.js の testGitHubSync() を実行してテスト\n' +
    '2. 問題なければ exportAllDataToJson() を実行';
  
  ui.alert('✓ 設定完了', confirmMessage, ui.ButtonSet.OK);
  
  Logger.log('GitHub設定が保存されました');
  Logger.log('Owner: ' + owner);
  Logger.log('Repo: ' + repo);
  Logger.log('Branch: ' + branch);
}

/**
 * 現在の設定を確認（トークンは非表示）
 */
function viewGitHubSettings() {
  const props = PropertiesService.getScriptProperties();
  const ui = SpreadsheetApp.getUi();
  
  const token = props.getProperty('GITHUB_TOKEN');
  const owner = props.getProperty('GITHUB_OWNER');
  const repo = props.getProperty('GITHUB_REPO');
  const branch = props.getProperty('GITHUB_BRANCH');
  const spreadsheetId = props.getProperty('SPREADSHEET_ID');
  
  const message = 
    '現在の設定:\n\n' +
    `GitHub Owner: ${owner || '未設定'}\n` +
    `Repository: ${repo || '未設定'}\n` +
    `Branch: ${branch || '未設定'}\n` +
    `Spreadsheet ID: ${spreadsheetId || '未設定'}\n` +
    `Token: ${token ? '設定済み (***非表示***)' : '未設定'}`;
  
  ui.alert('GitHub設定', message, ui.ButtonSet.OK);
  
  Logger.log('=== 現在の設定 ===');
  Logger.log('Owner: ' + (owner || '未設定'));
  Logger.log('Repo: ' + (repo || '未設定'));
  Logger.log('Branch: ' + (branch || '未設定'));
  Logger.log('Token: ' + (token ? '設定済み' : '未設定'));
}

/**
 * 設定をクリア（注意: 実行前に確認）
 */
function clearGitHubSettings() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    '確認',
    'すべてのGitHub設定を削除しますか？\n（トークンを含む）',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    const props = PropertiesService.getScriptProperties();
    props.deleteProperty('GITHUB_TOKEN');
    props.deleteProperty('GITHUB_OWNER');
    props.deleteProperty('GITHUB_REPO');
    props.deleteProperty('GITHUB_BRANCH');
    props.deleteProperty('SPREADSHEET_ID');
    
    ui.alert('✓ 完了', '設定をクリアしました', ui.ButtonSet.OK);
    Logger.log('GitHub設定をクリアしました');
  } else {
    ui.alert('キャンセルされました');
  }
}

/**
 * カスタムメニューを追加
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🔧 GitHub同期')
    .addItem('📝 GitHub設定を行う', 'setupGitHubCredentials')
    .addItem('👁️ 現在の設定を確認', 'viewGitHubSettings')
    .addSeparator()
    .addItem('🚀 GitHubへデータをエクスポート', 'exportAllDataToJson')
    .addItem('🧪 接続テスト', 'testGitHubSync')
    .addSeparator()
    .addItem('🗑️ 設定をクリア', 'clearGitHubSettings')
    .addToUi();
    
  ui.createMenu('📊 検索履歴グラフ')
    .addItem('🔄 グラフを最新に更新する', 'updateSearchHistoryCharts')
    .addToUi();
}
