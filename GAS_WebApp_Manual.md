
# 🚀 Google Apps Script（GAS）Webアプリ開発・更新マニュアル  
（プロジェクト名：`gaswebapp-manual`）

---

## 🧩 1. 環境概要

| 項目 | 内容 |
|------|------|
| プロジェクトルート | `C:\Users\okawa\gaswebapp-manual` |
| デプロイメントID（本番） | `AKfycbxWl-KLwo8SnOyqQT84gJyrofRQnIp_GBv8Pg0N5athPAoxp9LBuwj0HDTXkFqh0xiGsw` |
| clasp バージョン | 2.4.2 |
| Node.js | 18.x 以上 |
| 実行シェル | PowerShell |
| 警告表示 | `punycode` DeprecationWarning は無視してOK |

---

## 📁 2. フォルダ構成

```
C:\Users\okawa\gaswebapp-manual\
├── .clasp.json
├── src\
│   ├── Code.gs
│   ├── main.html
│   ├── style.html
│   └── script.html
├── deploy.ps1
└── README.md
```

---

## ⚙️ 3. 開発の基本フロー

### Step 1. VS Codeでコードを編集
`src` フォルダ内の `.gs` や `.html` ファイルを変更します。

### Step 2. スクリプトをGASに反映
```powershell
cd "C:\Users\okawa\gaswebapp-manual"
clasp push
```

### Step 3. 新しいバージョンを作成
```powershell
clasp version "update: 修正内容の説明（例：検索中メッセージ修正）"
```
出力例：`Created version 566.`

### Step 4. 本番デプロイを新バージョンに更新
```powershell
clasp deploy -i AKfycbxWl-KLwo8SnOyqQT84gJyrofRQnIp_GBv8Pg0N5athPAoxp9LBuwj0HDTXkFqh0xiGsw -V 566 -d "rollout"
```

---

## 🧾 4. 動作確認

- Googleサイトで再読み込み（`?t=123` を付与）
- Apps Script の「デプロイを管理」でバージョン確認

---

## 🧰 5. 補助コマンド

| コマンド | 説明 |
|-----------|------|
| `clasp versions` | バージョン一覧の確認 |
| `clasp deployments` | デプロイ一覧の確認 |
| `clasp login --status` | 現在ログイン中のGoogleアカウント確認 |
| `clasp logout` → `clasp login --no-localhost` | アカウント切替 |
| `$env:NODE_NO_WARNINGS=1` | punycode警告の非表示設定 |

---

## ⚡ 6. 自動デプロイスクリプト（任意）

`deploy.ps1`

```powershell
param(
  [Parameter(Mandatory=$true)][int]$v,
  [string]$d = "rollout"
)
$ID = "AKfycbxWl-KLwo8SnOyqQT84gJyrofRQnIp_GBv8Pg0N5athPAoxp9LBuwj0HDTXkFqh0xiGsw"

clasp push
clasp version $d
clasp deploy -i $ID -V $v -d $d
```

実行例：
```powershell
cd "C:\Users\okawa\gaswebapp-manual"
.\deploy.ps1 -v 567 -d "fix: layout behavior"
```

---

## 🧹 7. よくあるエラー対処

| エラー | 原因 | 対処 |
|--------|------|------|
| `Insufficient Permission` | アカウントが異なる | `clasp login --status` → 作成者で再ログイン |
| `Unknown command 'create-version'` | clasp v2系 | `clasp version "..."` を使う |
| `punycode module deprecated` | Node警告 | 無視OK |
| 反映されない | キャッシュ | `?t=数字` 付き再読み込み or シークレットモード |

---

## ✅ 8. 運用のポイント

- 本番URLは固定
- バージョン番号を都度メモ
- GoogleサイトURLは最初の1回だけ設定
- clasp / Node.js は定期更新
