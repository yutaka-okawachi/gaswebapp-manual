# 開発環境セットアップガイド (Setup Guide)

このガイドは、本プロジェクトの開発環境を構築するための手順書です。
新しいPCでの初回セットアップを含め、ローカルで動作させるためのすべてのステップを網羅しています。

## 1. 事前準備 (ツールのインストール)

まっさらなPCから始める場合、まず必要な基本ツールをインストールします。（既にインストール済みの場合はスキップしてください）

### 1-1. Node.js のインストール
Google Apps Script (GAS) の管理ツール `clasp` を動かすために必要です。
1. [Node.js 公式サイト (日本語)](https://nodejs.org/ja/) にアクセスします。
2. **「LTS (推奨版)」** と書かれているボタンをクリックしてインストーラーをダウンロードし、インストールします。

### 1-2. Git のインストール
ソースコードを管理するために必要です。
1. [Git for Windows 公式サイト](https://git-scm.com/download/win) にアクセスします。
2. インストーラーをダウンロードし、すべてデフォルトのままでインストールします。
> **重要**: インストール完了後、パスを通すためにPCを再起動するか、ターミナルを開き直してください。

---

## 2. リポジトリの取得とツールのインストール

PowerShellを開き、プロジェクトを取得して必要なパッケージをインストールします。

```powershell
# リポジトリのクローンと移動
git clone https://github.com/yutaka-okawachi/gaswebapp-manual.git
cd gaswebapp-manual

# プロジェクトの依存ライブラリをインストール
npm install

# GAS管理ツール 'clasp' をグローバルにインストール
npm install -g @google/clasp
```

> **注意**: clasp 3.x 系では一部コマンドの構文が変わっています（例: `undeploy` → `delete-deployment`）。バージョンは `clasp --version` で確認できます。

---

## 3. Google Apps Script 認証と初期設定

`clasp` が Google アカウントにアクセスできるようにログインします。

```powershell
clasp login
```
ブラウザが開いたら、GASプロジェクトを管理しているGoogleアカウントでログインし、アクセスを許可してください。

> **初期設定の確認**: 初めてプロジェクトをクローンした場合は、`.clasp.json` の設定を確認し、適切なスクリプトIDが設定されていることを確認してください。

---

## 4. 環境変数の設定 (.envファイルの作成)

セキュリティ保護のため、APIキーなどの機密情報は `.env` ファイルで管理しています。
プロジェクトルートに `.env` ファイルを作成し、以下の変数を設定してください。
**注意**: Gitにはコミットしないでください（`.gitignore` で除外されています）。

### `.env` テンプレート

```bash
# Google Apps Script (GAS) のデプロイIDから生成されたウェブアプリのURL
# clasp deploy 後に出力されるURL末尾の /exec までのパス
GAS_DEPLOY_URL=https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/exec

# APIアクセスのための秘密トークン
# GAS側のスクリプトプロパティで設定した TOKEN と一致させる必要があります
GAS_SECRET_TOKEN=your_secure_random_token_here
```

---

## 5. GAS スクリプトプロパティの設定

GASエディタの「プロジェクトの設定 → スクリプトプロパティ」に以下を登録してください。

| キー | 値 | 用途 |
|---|---|---|
| `NOTIFY_EMAIL` | 通知先メールアドレス | 検索通知メールの送信先 |
| `TOKEN` | 任意のランダム文字列 | Web App API の認証トークン（`.env` の `GAS_SECRET_TOKEN` と一致させる） |

---

## 6. 動作確認 (初回同期)

すべての準備が整ったら、同期スクリプトを実行して環境が正しく動作するか確認します。
PowerShellで以下のコマンドを実行します：

```powershell
.\sync-data.ps1
```

> **ヒント**: スクリプトの実行ポリシーエラー（"スクリプトの実行が無効になっているため..."）が表示された場合は、一時的に許可するために以下のコマンドを実行してから、再度 `.\sync-data.ps1` を実行してください。
> ```powershell
> Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
> ```

**成功の確認**:
- [x] エラーなく "COMPLETED SUCCESSFULLY" と表示されること。
- [x] ローカルの変更がGitHubにプッシュされていること。

以上でセットアップは完了です！
