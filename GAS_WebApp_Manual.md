# 🚀 Google Apps Script（GAS）Webアプリ開発・更新マニュアル
（プロジェクト名：`gaswebapp-manual`）

---

## 🧩 1. 環境概要

| 項目 | 内容 |
|------|------|
| プロジェクトルート | `C:\Users\okawa\gaswebapp-manual` |
| GAS スクリプトID | `1WTZicVS_Dnu5PHQf1RPrXyS03LffwjbTwPu7bn61WTJTfQzTcimC5Pqs` |
| デプロイID（本番） | `AKfycbxWl-KLwo8SnOyqQT84gJyrofRQnIp_GBv8Pg0N5athPAoxp9LBuwj0HDTXkFqh0xiGsw` |
| デプロイID（テスト） | `AKfycbwgYpxpOQ3kez3T_5AAB6b4eFGy2yhjqcc0r84o4NjVVfq8B54RXLRikVo0rgwhtW-eyQ` |
| clasp バージョン | 2.4.2 |
| Node.js | 18.x 以上 |
| 実行シェル | PowerShell |
| 注意事項 | `punycode` DeprecationWarning は無視して問題ありません |

---

## 📁 2. フォルダ構成

```
C:\Users\okawa\gaswebapp-manual\
├─ .clasp.json              # GAS プロジェクト設定（rootDir = src）
├─ deploy.ps1               # GAS への push / version / deploy を自動化
├─ git-push.ps1             # git add → commit → push のラッパー
├─ GAS_WebApp_Manual.md     # 本マニュアル
├─ GitHub_Manual_gaswebapp-manual.md
├─ README.md
└─ src\
   ├─ appsscript.json       # GAS マニフェスト
   ├─ index.html            # Webアプリのトップ
   ├─ common_styles.html
   ├─ common_terms_styles.html
   ├─ common_scripts.html
   ├─ notes.html ほか各種 HTML ページ
   ├─ mahler.js / Richard_Strauss.js などのデータスクリプト
   ├─ list_and_notes.js / swap.js などのユーティリティ
   └─ デプロイ手順.txt ほか関連ドキュメント
```

`.clasp.json` の `rootDir` が `src` になっているため、`clasp push` などはリポジトリルートから実行して問題ありません。

---

## 🛠️ 3. 作業前のチェックリスト

- Node.js 18.x 以上と `@google/clasp`（2.4.2）をインストール済みであること。
- 初回のみ `clasp login --no-localhost` で Google アカウント認証。
- PowerShell を管理者権限なしで起動し、プロジェクトルート `C:\Users\okawa\gaswebapp-manual` に移動。

---

## ⚙️ 4. 開発の基本フロー

1. VS Code などで `src` 配下の `.html` / `.js` を編集。
2. 必要に応じてローカルで差分確認（`git status` など）。
3. GAS へアップロード:
   ```powershell
   cd "C:\Users\okawa\gaswebapp-manual"
   clasp push
   ```
4. 新しいバージョンを作成:
   ```powershell
   clasp version "update: 変更内容の概要"
   ```
   例: `Created version 566.` と表示されます。
5. デプロイ（推奨: 後述の `deploy.ps1` を利用）。

---

## 🚀 5. デプロイ手順

### 5.1 `deploy.ps1` で一括デプロイ（推奨）

`deploy.ps1` は `clasp push` → `clasp version` → `clasp deploy` を連続実行し、ヒューマンエラーを減らします。スクリプト内部のポイントは以下の通りです。

- `Push-Location "c:\Users\okawa\gaswebapp-manual\src"` で `src` に移動してから処理。
- 環境ごとのデプロイIDをハッシュテーブルで管理。
- `clasp version` の出力から正規表現でバージョン番号を取得し、その番号を `clasp deploy` に渡す。
- バージョン番号が取得できなかった場合は `Write-Error` で停止。

利用方法:

```powershell
cd "C:\Users\okawa\gaswebapp-manual"
.\deploy.ps1 -env staging -d "fix: improve search box"
.\deploy.ps1 -env production -d "release: 2025-11-03"
```

引数:

- `-env`（必須）: `staging` または `production` を指定。対応するデプロイIDはスクリプト内の `$deploymentIds` で定義済み。
- `-d`（任意）: バージョン説明とデプロイ説明に同じ文字列を設定。省略時は `"New version"`。

主要部分抜粋:

```powershell
$deploymentIds = @{
  "production" = "AKfycbxWl-KLwo8SnOyqQT84gJyrofRQnIp_GBv8Pg0N5athPAoxp9LBuwj0HDTXkFqh0xiGsw"
  "staging"    = "AKfycbwgYpxpOQ3kez3T_5AAB6b4eFGy2yhjqcc0r84o4NjVVfq8B54RXLRikVo0rgwhtW-eyQ"
}
$versionOutput = clasp version $d
if ($versionOutput -match "Created version (\d+)") {
  $versionNumber = $Matches[1]
  clasp deploy -i $deploymentIds[$env] -V $versionNumber -d $d
}
```

### 5.2 手動で実行する場合

1. `clasp push`
2. `clasp version "update: 説明"`
3. `clasp deploy -i <デプロイID> -V <バージョン番号> -d "説明"`

テスト環境の場合は `<デプロイID>` に `AKfycbwg...`、本番の場合は `AKfycbxW...` を指定します。

---

## 🔍 6. 動作確認のポイント

- デプロイ後は Google サイトの公開 URL を再読み込み（`?t=20231103` のようにクエリを付与するとキャッシュを回避）。
- Apps Script の「デプロイを管理」画面で、対象デプロイが新バージョンを指しているか確認。
- スクリプトが期待通り動作したら、ログに残したい内容を記録（バージョン番号や変更概要）。

---

## 🧰 7. 補助スクリプトとコマンド

| ツール / コマンド | 用途 |
|-------------------|------|
| `git-push.ps1 -m "<message>"` | `git add .` → `git commit -m` → `git push` を自動実行 |
| `clasp versions` | 作成済みバージョン一覧を表示 |
| `clasp deployments` | デプロイ一覧を表示 |
| `clasp login --status` | 現在ログイン中の Google アカウントを確認 |
| `$env:NODE_NO_WARNINGS=1` | `punycode` DeprecationWarning を抑制 |

---

## 🧹 8. よくあるエラーと対処

| エラー | 主な原因 | 対処 |
|--------|----------|------|
| `Insufficient Permission` | clasp が別アカウントでログインしている | `clasp login --status` で確認し、必要に応じて再ログイン |
| `Unknown command 'create-version'` | clasp の旧バージョンを使用 | 最新版に更新、または `clasp version "..."` を利用 |
| `punycode module deprecated` | Node.js からの警告 | 問題ないため無視でOK |
| 変更が反映されない | ブラウザキャッシュ | `?t=timestamp` を付けて再読み込み、もしくはシークレットウィンドウ |

---

## 📌 9. 運用メモ

- 本番URLとテストURLは固定。バージョン番号と説明を常にメモしておく。
- 重要な改修はまず `staging` で確認してから `production` に反映。
- `deploy.ps1` のログを PowerShell の履歴またはメモに残すと追跡しやすい。
- Node.js / clasp は定期的にアップデートし、問題があればマニュアルに追記する。
