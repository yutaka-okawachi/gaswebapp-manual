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

#### 1. clasp認証（必須）

初回実行時は、claspでGoogleアカウント認証が必要です：

```powershell
clasp login
```

ブラウザでGoogleアカウントの認証を完了してください。

#### 2. GAS関数の権限認証（初回実行時のみ）

初めて`sync-data.ps1`を実行する際、またはGASエディタで`exportAllDataToJson`を初めて実行する際に、権限承認画面が表示されます。

**手順**:
1. GASエディタ（https://script.google.com）を開く
2. `exportAllDataToJson`関数を選択して実行
3. 権限承認画面が表示されたら「承認」をクリック
4. 必要な権限（Spreadsheets, Drive, External Request）を許可

> [!IMPORTANT]
> この権限認証は**1度だけ**必要です。認証後は`sync-data.ps1`が自動的に実行できます。

#### 3. Web App設定（オプション・推奨）

`clasp run`が失敗する環境では、Web App経由での実行が自動的にフォールバックされます。

セットアップ（約5分）：

```powershell
.\setup-web-trigger.ps1
```

### 日常の使い方

セットアップ完了後は、以下のコマンド1つで完了：

```powershell
.\sync-data.ps1
```

**完全自動で実行される処理**:
1. `clasp push` でGASにアップロード
2. `git commit` でローカル変更を保存（自動）
3. `clasp run` または Web App経由で`exportAllDataToJson`を自動実行
4. `git pull --rebase` で更新を取得
5. `git push` で自動プッシュ

✅ **確認プロンプトなし** - 全自動で完了します！

> [!TIP]
> `clasp run`が失敗しても、Web App経由で自動的にフォールバックします。
> 初回の権限認証さえ完了していれば、以降は完全自動で動作します。



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

### clasp pushの認証エラー（Permission denied / Insufficient Permission）

**症状**: `sync-data.ps1`実行時に「permission」「Insufficient Permission」などの警告が表示される

**原因**: 別のGoogleアカウントでclaspにログインしているため、GASプロジェクトの編集権限がない

**動作**: ✅ **スクリプトは自動的に続行します**

v2024.12.27以降の`sync-data.ps1`は、clasp pushが失敗しても**自動的にスキップして続行**します：

```powershell
⚠ clasp push failed: Authentication error detected.

This usually means clasp is logged in with a different Google account.
The script will continue using Web App for GAS function execution.

To fix authentication (optional):
  1. cd src
  2. clasp logout
  3. clasp login
  4. Select the correct Google account (pistares@gmail.com)

⚠ Skipping clasp push. GAS files will not be updated.
✓ GAS function executed successfully via Web App.
```

> [!IMPORTANT]
> GASファイル（`src/`内のファイル）をローカルで編集した場合のみ、clasp認証の修正が必要です。
> スプレッドシートのデータ更新だけなら、認証エラーは無視して問題ありません。

**手動で認証を修正する場合**（GASファイルを編集する場合のみ）:

```powershell
cd src
clasp logout
clasp login  # ブラウザで pistares@gmail.com を選択
```

> [!TIP]
> clasp pushの認証エラーは、**Web App経由でのデータ更新には影響しません**。
> GASファイルの編集が不要なら、エラーを無視して構いません。

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

