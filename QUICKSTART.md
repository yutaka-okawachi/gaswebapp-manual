# 🚀 クイックスタートガイド

GASからGitHubへの自動同期を**3ステップ**で開始できます！

---

## ✅ 完了済み

- [x] GASスクリプトのアップロード → **完了！** (`clasp push`済み)

---

## 📝 残りのステップ（5分で完了）

### ステップ1: GitHubトークンを作成（2分）

**最速の方法:**

1. このURLを開く: **https://github.com/settings/tokens?type=beta**
2. **Generate new token**をクリック
3. 設定:
   - Token name: `GAS Sync`
   - Repository: `gaswebapp-manual`だけ選択
   - Permissions: `Contents` → `Read and write`
4. **Generate token**をクリック
5. 🔑 表示されたトークンを**コピー**（重要！再表示不可）

> 💡 詳細な手順は `GITHUB_TOKEN_GUIDE.md` を参照

---

### ステップ2: スプレッドシートで設定（2分）

1. **スプレッドシートを開く**
2. ページを更新（F5）→ メニューバーに **🔧 GitHub同期**が表示されます
3. **🔧 GitHub同期** → **📝 GitHub設定を行う**をクリック
4. 4つの質問に答える:
   - Personal Access Token → 先ほどコピーしたトークンを貼り付け
   - GitHubユーザー名 → `yutaka-okawachi`（Enter）
   - リポジトリ名 → `gaswebapp-manual`（Enter）
   - ブランチ名 → `main`（Enter）
5. **✓ 設定完了**と表示されれば成功！

---

### ステップ3: テスト実行（1分）

1. **🔧 GitHub同期** → **🧪 接続テスト**をクリック
2. 数秒後に完了
3. GitHubで確認: https://github.com/yutaka-okawachi/gaswebapp-manual
   - `test/gas_test.json`が作成されていればOK！

---

## 🎉 完了！日常の使い方

スプレッドシートを編集したら:

1. **🔧 GitHub同期** → **🚀 GitHubへデータをエクスポート**
2. 完了！（10-30秒）

これだけで、7つのJSONファイルがGitHubに自動プッシュされます。

---

## 📚 詳しいマニュアル

- **使い方全般**: `GITHUB_SYNC_MANUAL.md`
- **トークン作成**: `GITHUB_TOKEN_GUIDE.md`
- **スクリプトアップロード**: `GAS_UPLOAD_GUIDE.md`

---

## ⚠️ トラブルシューティング

### メニューに「🔧 GitHub同期」が表示されない

**解決**: スプレッドシートをリロード（F5）

### エラー: "GitHub Tokenが設定されていません"

**解決**: ステップ2を実行

### その他のエラー

**確認**: 
1. **🔧 GitHub同期** → **👁️ 現在の設定を確認**
2. `GITHUB_SYNC_MANUAL.md`のトラブルシューティングセクション参照
