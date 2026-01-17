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
    - `clasp run` 失敗時、認証エラーなら再ログインを促し、Web Appフォールバック時も自動的にデプロイを更新して最新コードを利用します。
4. `git commit` (中間コミット): Web App実行で `app.js` 等が更新された場合、自動的にコミットします。
5. `git pull --rebase` で更新を取得
6. `git push` で自動プッシュ

✅ **確認プロンプトなし** - 基本的に全自動で完了しますが、認証エラー時のみ対話的に解決できます。

> [!TIP]
> `clasp run`が失敗しても、Web App経由で自動的にフォールバックします。
> フォールバック時、古いデプロイしかない場合でも自動的に更新・`.env`同期を行うため、常に最新の状態で実行されます。



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

**動作**:
- **GASコード（`src/`）に変更がある場合**: ❌ **安全のため停止します**
  - 「ロジックを変えたのに反映されない」事故を防ぐためです。
  - 「ログインして再開しますか？」と聞かれるので、`Y` を押してログインすれば、自動的にアップロードを再試行して処理を続行します。

- **GASコードに変更がない場合**: ✅ **警告を出して続行します**
  - データ更新には影響しないため、エラーを無視して自動的に進みます。

```powershell
⚠ clasp push failed, but no local GAS changes were detected.
Since logic hasn't changed, we can proceed with data sync.
```

> [!TIP]
> アカウントの切り替え等で頻繁にログアウトしてしまう場合でも、**GASのコードをいじっていない限り**、エラーは無視されて自動的に同期が完了します。

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

