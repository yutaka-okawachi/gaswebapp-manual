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
1. `clasp push` でGASにアップロード
2. `clasp run` で`exportAllDataToJson`を自動実行
3. `git pull` で更新を取得
4. `git add . && git commit && git push` で自動プッシュ

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

## トラブルシューティング

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

