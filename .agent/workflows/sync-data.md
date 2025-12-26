---
description: スプレッドシートデータの同期
---

# データ同期ワークフロー

スプレッドシートのデータを全て同期し、GitHubに反映します。

> [!WARNING]
> 自動生成されるファイル（`dic.html`など）を直接編集しないでください。
> 次回のGAS更新で上書きされます。

## 🚀 クイックスタート（完全自動化スクリプト）

// turbo-all

### 初回のみ: セットアップ

Web App経由でGAS関数を自動実行するための設定を行います（約5分）。

1. セットアップスクリプトを実行
```powershell
.\setup-web-trigger.ps1
```

2. スクリプトの指示に従って以下を実行:
   - GASエディタで`generateSecretToken`関数を実行してトークンを生成
   - `web_trigger.js`の`SECRET_TOKEN`を更新
   - Web Appとしてデプロイ
   - デプロイURLとトークンを入力

3. 接続テストが成功すれば設定完了！

### 日常の使い方

テンプレートを編集したら、以下のコマンド1つで完了：

```powershell
.\sync-data.ps1
```

**完全自動で実行される処理**:
**完全自動で実行される処理**:
1. `clasp push` でGASにアップロード
2. `git commit` でローカル変更を保存（自動）
3. `clasp run` で`exportAllDataToJson`を自動実行
4. `git pull --rebase` で更新を取得
5. `git push` で自動プッシュ

✅ **確認プロンプトなし** - 全自動で完了します！



---

## 📋 手動実行する場合

自動化スクリプトを使わない場合は、以下の手順で実行します。

// turbo-all

1. テンプレートファイルを開く
```powershell
code c:\Users\okawa\gaswebapp-manual\src\generate_dic_html.js
```

2. HTMLテンプレート内のスタイルや構造を編集
   - CSSは`<style>`セクション
   - HTMLは`<body>`セクション
   - JSは`<script>`セクション

3. srcディレクトリに移動
```powershell
cd c:\Users\okawa\gaswebapp-manual\src
```

4. GASにアップロード
```powershell
clasp push
```

5. 元のディレクトリに戻る
```powershell
cd c:\Users\okawa\gaswebapp-manual
```

6. GASで実行（手動操作）
   - Google Apps Scriptエディタを開く
   - `exportAllDataToJson`を実行
   - dic.htmlが新しいレイアウトで生成され、GitHubに自動push

7. ローカルに反映
```powershell
git pull
```

8. 確認
```powershell
# ブラウザでdic.htmlを開いて確認
start mahler-search-app/dic.html
```

---

---

## トラブルシューティング

### clasp認証エラー（Permission denied / Not logged in）

**症状**: `sync-data.ps1`実行時に「permission」「unauthorized」などのエラーが表示される

**原因**: 別のGASプロジェクトを使った後、claspの認証情報が混乱している

**解決方法**（自動検出あり）:

v2024.12以降の`sync-data.ps1`は、認証エラーを自動検出して解決手順を表示します：

```powershell
# スクリプトが自動的にエラーを検出し、以下の手順を表示します:
⚠ Authentication error detected. Please re-login to clasp.

Run the following commands:
  1. clasp logout
  2. clasp login
  3. .\sync-data.ps1
```

**手動で解決する場合**:

```powershell
# 1. ログアウト
clasp logout

# 2. 再ログイン（ブラウザで認証）
clasp login

# 3. sync-data.ps1を再実行
.\sync-data.ps1
```

> [!TIP]
> 複数のGASプロジェクトを使う場合、プロジェクト切り替え時に認証エラーが発生することがあります。
> その場合は上記の手順で再ログインしてください。

### Script function not found エラー

**症状**: `clasp run exportAllDataToJson`で「Script function not found」エラー

**原因**: Apps Script APIで関数が実行可能になっていない

**解決方法**（自動検出あり）:

v2024.12以降の`sync-data.ps1`は、このエラーも自動検出します：

```powershell
⚠ Function not found. This may be due to Apps Script API not being enabled.

To fix this issue:
  1. Open the GAS editor: https://script.google.com
  2. Manually execute 'exportAllDataToJson' function once
  3. Then run: git pull
```

**根本的な解決**:

`src/appsscript.json`に以下を追加（2024.12以降は既に設定済み）:

```json
"executionApi": {
  "access": "ANYONE"
}
```

### Web Appが動作しない場合

```powershell
# 接続テストを実行
.\setup-web-trigger.ps1
```

**チェック項目**:
1. `GAS_DEPLOY_URL`と`GAS_SECRET_TOKEN`環境変数が設定されているか
2. `web_trigger.js`の`SECRET_TOKEN`がPowerShellの環境変数と一致しているか
3. Web Appが正しくデプロイされているか（GASエディタで確認）
4. Web Appのアクセス権限が「全員」になっているか

### 誤ってローカルのdic.htmlを編集してしまった場合

```powershell
# ローカルの変更を破棄してリモート版に戻す
git checkout origin/main -- mahler-search-app/dic.html
```

### コンフリクトが発生した場合

```powershell
# GAS版を採用
git checkout --theirs mahler-search-app/dic.html
git add mahler-search-app/dic.html
git rebase --continue
```

---

## 詳細ガイド

- **自動化スクリプト**: [AUTOMATION_SCRIPTS_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/AUTOMATION_SCRIPTS_GUIDE.md)
- **レイアウト変更**: [DIC_LAYOUT_CHANGE_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/DIC_LAYOUT_CHANGE_GUIDE.md)

