/** GitHub publication is owned exclusively by the local sync-data runner. */
function pushToGitHub() {
  throw new Error('GitHubへの公開はPCの sync-data.ps1 から実行してください。');
}
function testGitHubSync() {
  SpreadsheetApp.getUi().alert('同期はPCの sync-data.ps1 または 02_RUN_SYNC.bat から実行してください。');
}
