# GitHub自動同期システム - 使用方法

このシステムは、Google Apps Script (GAS)を使って、スプレッドシートのデータを**直接GitHubリポジトリへプッシュ**します。

## 🎯 何ができるか

- ✅ スプレッドシート更新 → ワンクリックでGitHubへ自動反映
- ✅ Google Driveのダウンロード/アップロード作業が不要
- ✅ 古いファイルが蓄積しない
- ✅ Git履歴で変更を追跡可能

---

## 📋 初回セットアップ（1回のみ）

### ステップ1: GitHub Personal Access Token (PAT)の作成

1. **GitHub**にログイン
2. **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
3. **Generate new token**をクリック
4. 設定:
   - **Token name**: `GAS Spreadsheet Sync`
   - **Expiration**: 90日または1年
   - **Repository access**: `Only select repositories` → `gaswebapp-manual`を選択
   - **Permissions**:
     - `Contents`: **Read and write**
5. **Generate token**をクリック
6. **トークンをコピー**（⚠️ 再表示できないので必ず保存）

### ステップ2: GASプロジェクトにトークンを設定

1. **スプレッドシート**を開く
2. **拡張機能** → **Apps Script**
3. 左メニューから**実行ログ**の上にある「▶️」ボタンをクリック
4. 関数リストから **`setupGitHubCredentials`** を選択
5. **実行**をクリック
6. 許可を求められたら**許可を確認**
7. UIプロンプトが表示されるので順番に入力:
   - **Step 1/4**: Personal Access Token（先ほどコピーしたトークン）
   - **Step 2/4**: GitHubユーザー名（推奨: `yutaka-okawachi`）
   - **Step 3/4**: リポジトリ名（デフォルト: `gaswebapp-manual`）
   - **Step 4/4**: ブランチ名（デフォルト: `main`）
8. **✓ 設定完了**が表示されれば成功

---

## 🚀 使い方（日常運用）

### 方法1: カスタムメニューから実行（推奨）

1. **スプレッドシート**を開く
2. メニューバーの **🔧 GitHub同期** をクリック
3. **🚀 GitHubへデータをエクスポート**を選択
4. 数秒後、画面右下に「✓ 完了」トースト通知が表示
5. GitHubリポジトリを確認 → 自動コミットが記録されています！

### 方法2: GASエディタから直接実行

1. **拡張機能** → **Apps Script**
2. 関数リストから **`exportAllDataToJson`** を選択
3. **実行**をクリック
4. **実行ログ**で結果を確認

---

## 🧪 テスト方法

初回セットアップ後、まずテストを実行することを推奨します：

1. **Apps Script**を開く
2. 関数リストから **`testGitHubSync`** を選択
3. **実行**をクリック
4. **実行ログ**を確認:
   ```
   処理中: test/gas_test.json
   ✓ 成功: test/gas_test.json をプッシュしました
   ✓ テスト成功！GitHubリポジトリを確認してください。
   ```
5. GitHubリポジトリの`test/`フォルダに`gas_test.json`が作成されていれば成功！

---

## 📁 プッシュされるファイル

以下の7つのJSONファイルが`mahler-search-app/data/`フォルダへ自動プッシュされます：

- `mahler.json`
- `richard_strauss.json`
- `richard_wagner.json`
- `rs_scenes.json`
- `rw_scenes.json`
- `dic_notes.json`
- `abbr_list.json`

---

## 🔍 設定の確認

現在の設定を確認するには：

1. メニューバー **🔧 GitHub同期** → **👁️ 現在の設定を確認**

表示内容:
```
GitHub Owner: yutaka-okawachi
Repository: gaswebapp-manual
Branch: main
Spreadsheet ID: 1WTZicVS_Dnu5PHQf1RPrXyS03LffwjbTwPu7bn61WTJTfQzTcimC5Pqs
Token: 設定済み (***非表示***)
```

---

## ⚙️ 自動化（オプション）

完全自動化するには、トリガーを設定します：

1. **Apps Script**を開く
2. 左メニューの**トリガー**（時計アイコン）をクリック
3. **トリガーを追加**
4. 設定:
   - 実行する関数: `exportAllDataToJson`
   - イベントのソース: `時間主導型`
   - 時間ベースのトリガー: `日タイマー` → `午前2時～3時`
5. **保存**

これで、毎日深夜に自動的にGitHubへプッシュされます！

---

## 🛠️ トラブルシューティング

### エラー: "GitHub Tokenが設定されていません"

**原因**: トークンが設定されていない  
**解決**: `setupGitHubCredentials()`を実行して設定

### エラー: "Status: 401"

**原因**: トークンが無効または期限切れ  
**解決**: 新しいトークンを作成し、`setupGitHubCredentials()`で再設定

### エラー: "Status: 403" (API rate limit)

**原因**: GitHub APIのレート制限（1時間5000リクエスト）  
**解決**: 1時間後に再実行（通常は発生しません）

### エラー: "Status: 404"

**原因**: リポジトリ名またはブランチ名が間違っている  
**解決**: `viewGitHubSettings()`で設定を確認し、必要なら再設定

---

## 🗑️ 設定のクリア

設定を削除したい場合（トークンを含む）：

1. メニューバー **🔧 GitHub同期** → **🗑️ 設定をクリア**
2. 確認ダイアログで**はい**

---

## 📊 実行ログの見方

成功例:
```
=== GitHubへデータをプッシュ中 ===
処理中: mahler-search-app/data/mahler.json
✓ 成功: mahler-search-app/data/mahler.json をプッシュしました
処理中: mahler-search-app/data/richard_strauss.json
✓ 成功: mahler-search-app/data/richard_strauss.json をプッシュしました
...
=== プッシュ結果 ===
成功: 7 / 7
失敗: 0 / 7
=== 完了 ===
```

---

## 💡 ヒント

### Google Driveのファイルを削除

古いJSONファイルがGoogle Driveに残っている場合は、手動で削除できます：

1. [Google Drive](https://drive.google.com/)を開く
2. ルートフォルダで`mahler.json`などを検索
3. 古いファイルを削除

### コミットメッセージのカスタマイズ

`export_json.js`の以下の行を編集:
```javascript
const commitMessage = `自動更新: スプレッドシートからデータ同期 [${timestamp}]`;
```

---

## 🎉 これで完了！

スプレッドシートを更新したら、メニューから「GitHubへエクスポート」をクリックするだけ！  
手動でのダウンロード・アップロード作業は不要です。
