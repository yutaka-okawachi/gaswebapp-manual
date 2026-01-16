/**
 * GitHub API連携スクリプト (Batch Commit Version)
 * スプレッドシートから取得したJSONデータをGitHubリポジトリに
 * Git Data APIを使用して「1回のコミット」でプッシュします。
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
 * GitHub APIへの共通リクエスト処理
 */
function githubRequest(method, endpoint, payload, config) {
  const url = `https://api.github.com/repos/${config.owner}/${config.repo}${endpoint}`;
  const options = {
    method: method,
    headers: {
      'Authorization': `token ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
  
  if (payload) {
    options.payload = JSON.stringify(payload);
  }

  const response = UrlFetchApp.fetch(url, options);
  const statusCode = response.getResponseCode();
  const content = response.getContentText();
  
  if (statusCode >= 200 && statusCode < 300) {
    return JSON.parse(content);
  } else {
    throw new Error(`GitHub API Error (${statusCode}): ${endpoint} - ${content}`);
  }
}

/**
 * ブランチの最新コミットSHAを取得
 */
function getLatestCommitSha(config) {
  const ref = githubRequest('get', `/git/ref/heads/${config.branch}`, null, config);
  return ref.object.sha;
}

/**
 * コミットSHAからBase Tree SHAを取得
 */
function getBaseTreeSha(commitSha, config) {
  const commit = githubRequest('get', `/git/commits/${commitSha}`, null, config);
  return commit.tree.sha;
}

/**
 * Blobを作成してSHAを取得
 */
function createBlob(content, config) {
  const payload = {
    content: content,
    encoding: 'utf-8'
  };
  const result = githubRequest('post', '/git/blobs', payload, config);
  return result.sha;
}

/**
 * 複数のファイルを1回のコミットでGitHubにプッシュ
 * Git Data APIを使用: Blobs -> Tree -> Commit -> Ref Update
 * 
 * @param {Object} files - { 'path/to/file.json': jsonData, 'path/to/file.html': htmlString, ... }
 * @param {string} commitMessage - コミットメッセージ
 * @return {Object} 結果サマリー
 */
function pushToGitHub(files, commitMessage) {
  const config = getGitHubConfig();
  
  if (!config.token) {
    throw new Error('GitHub Tokenが設定されていません。setup_credentials.js を実行してください。');
  }

  const message = commitMessage || `自動更新: スプレッドシートからデータ同期 [${new Date().toLocaleString('ja-JP')}]`;
  
  Logger.log('=== GitHub Batch Push Start ===');
  Logger.log(`Target: ${config.owner}/${config.repo} [${config.branch}]`);

  try {
    // 1. 最新のコミットSHAを取得
    Logger.log('[1/5] Getting latest commit SHA...');
    const latestCommitSha = getLatestCommitSha(config);
    
    // 2. Base Tree SHAを取得
    Logger.log('[2/5] Getting base tree SHA...');
    const baseTreeSha = getBaseTreeSha(latestCommitSha, config);

    // 3. 各ファイルのBlobを作成し、Treeアイテムを準備
    Logger.log(`[3/5] Creating blobs for ${Object.keys(files).length} files...`);
    const treeItems = [];
    
    for (const [path, content] of Object.entries(files)) {
      let stringContent;
      // オブジェクトならJSON化、文字列ならそのまま
      if (typeof content === 'string') {
        stringContent = content;
      } else {
        stringContent = JSON.stringify(content, null, 2);
      }
      
      const blobSha = createBlob(stringContent, config);
      treeItems.push({
        path: path,
        mode: '100644', // 通常ファイル
        type: 'blob',
        sha: blobSha
      });
      
      // APIレート制限回避のための微小待機（任意）
      if (treeItems.length % 5 === 0) Utilities.sleep(500);
    }

    // 4. 新しいTreeを作成
    Logger.log('[4/5] Creating new tree...');
    const treePayload = {
      base_tree: baseTreeSha,
      tree: treeItems
    };
    const newTree = githubRequest('post', '/git/trees', treePayload, config);
    const newTreeSha = newTree.sha;

    // 5. 新しいCommitを作成
    Logger.log('[5/5] Creating commit...');
    const commitPayload = {
      message: message,
      tree: newTreeSha,
      parents: [latestCommitSha]
    };
    const newCommit = githubRequest('post', '/git/commits', commitPayload, config);
    const newCommitSha = newCommit.sha;

    // 6. 参照（HEAD）を更新
    Logger.log('Updating reference...');
    githubRequest('patch', `/git/refs/heads/${config.branch}`, { sha: newCommitSha }, config);

    Logger.log('✓ Batch push completed successfully!');
    Logger.log(`New Commit: ${newCommitSha}`);

    // 既存のレスポンス形式に合わせて成功結果を返す
    // 呼び出し元の export_json.js が result.success, result.failed を期待しているため
    return {
      success: Object.keys(files), // 全ファイル成功とみなす
      failed: [],
      total: Object.keys(files).length,
      commitSha: newCommitSha
    };

  } catch (e) {
    Logger.log('✗ Critical Error in batch push: ' + e.message);
    // 呼び出し元でログ出力されるように例外を再スロー、または全失敗として返す
    return {
      success: [],
      failed: Object.keys(files).map(p => ({ path: p, error: e.message })),
      total: Object.keys(files).length,
      error: e.message
    };
  }
}

/**
 * テスト機能: 現在の時刻でダミーファイルをバッチコミットテスト
 */
function testGitHubSync() {
  const timestamp = new Date().toISOString();
  const testFiles = {
    'test/batch_test_1.json': { time: timestamp, id: 1 },
    'test/batch_test_2.txt': `Test text file content at ${timestamp}`
  };
  
  try {
    const result = pushToGitHub(testFiles, `テスト: Batch Commit ${timestamp}`);
    if (result.success.length > 0) {
      Logger.log('Test PASSED.');
    } else {
      Logger.log('Test FAILED: ' + result.error);
    }
  } catch (e) {
    Logger.log('Test EXCEPTION: ' + e.message);
  }
}

