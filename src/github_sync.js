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
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
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
  // /git/ref/heads/ または /commits エンドポイントを使用して最新のコミットSHAを取得します。
  // キャッシュ回避のためタイムスタンプクエリパラメータを付与します。
  try {
    const ref = githubRequest('get', `/git/ref/heads/${config.branch}?t=${new Date().getTime()}`, null, config);
    if (ref && ref.object && ref.object.sha) {
      return ref.object.sha;
    }
  } catch (e) {
    Logger.log('Warning in getLatestCommitSha (/git/ref): ' + e.message);
  }
  
  const commits = githubRequest('get', `/commits?sha=${config.branch}&per_page=1&t=${new Date().getTime()}`, null, config);
  if (commits && commits.length > 0) {
    return commits[0].sha;
  }
  throw new Error('Could not fetch latest commit SHA from GitHub');
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

  const message = commitMessage || `自動更新: スプレッドシートからデータ同期 [${new Date().toLocaleString('ja-JP')}] [skip ci]`;
  
  Logger.log('=== GitHub Batch Push Start ===');
  Logger.log(`Target: ${config.owner}/${config.repo} [${config.branch}]`);

  try {
    // 1. 各ファイルのBlobを事前に作成（時間がかかるためループ外で一括処理）
    Logger.log(`[1/3] Creating blobs for ${Object.keys(files).length} files...`);
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

    // 2. 最新HEADの取得、Tree作成、Commit作成、Ref更新（競合時は最新HEADで自動リトライ）
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        Logger.log(`[2/3] Getting latest commit SHA (Attempt ${attempt}/${maxRetries})...`);
        const latestCommitSha = getLatestCommitSha(config);
        
        Logger.log(`[3/3] Getting base tree SHA for ${latestCommitSha.substring(0, 7)}...`);
        const baseTreeSha = getBaseTreeSha(latestCommitSha, config);

        // 新しいTreeを作成
        const treePayload = {
          base_tree: baseTreeSha,
          tree: treeItems
        };
        const newTree = githubRequest('post', '/git/trees', treePayload, config);
        const newTreeSha = newTree.sha;

        // 新しいCommitを作成
        const commitPayload = {
          message: message,
          tree: newTreeSha,
          parents: [latestCommitSha]
        };
        const newCommit = githubRequest('post', '/git/commits', commitPayload, config);
        const newCommitSha = newCommit.sha;

        // 参照（HEAD）を更新
        Logger.log(`Updating reference to ${newCommitSha.substring(0, 7)}...`);
        githubRequest('patch', `/git/refs/heads/${config.branch}`, { sha: newCommitSha }, config);

        Logger.log('✓ Batch push completed successfully!');
        Logger.log(`New Commit: ${newCommitSha}`);

        return {
          success: Object.keys(files),
          failed: [],
          total: Object.keys(files).length,
          commitSha: newCommitSha
        };
      } catch (e) {
        lastError = e;
        if ((e.message.includes('fast forward') || e.message.includes('422')) && attempt < maxRetries) {
          Logger.log(`⚠ Fast-forward collision on attempt ${attempt}. Waiting 1.5s and retrying with fresh HEAD...`);
          Utilities.sleep(1500);
          continue;
        }
        throw e;
      }
    }
    throw lastError;

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

