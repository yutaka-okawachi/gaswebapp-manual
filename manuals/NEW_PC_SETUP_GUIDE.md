# 新しいPCでの開発環境セットアップガイド

このガイドは、新しいWindows PCで本プロジェクトの開発環境を一から構築するための手順書です。
Node.jsやGitがインストールされていない、完全にまっさらな状態からのセットアップを想定しています。

## 1. 事前準備 (ツールのインストール)

まず、必要な基本ツールをインストールします。

### 1-1. Node.js のインストール
Google Apps Script (GAS) の管理ツール `clasp` を動かすために必要です。

1.  [Node.js 公式サイト (日本語)](https://nodejs.org/ja/) にアクセスします。
2.  **「LTS (推奨版)」** と書かれているボタンをクリックしてインストーラーをダウンロードします。
3.  ダウンロードしたインストーラーを実行し、デフォルト設定のまま「Next」を押してインストールを完了させます。

### 1-2. Git のインストール
ソースコードを管理するために必要です。

1.  [Git for Windows 公式サイト](https://git-scm.com/download/win) にアクセスします。
2.  "Click here to download" をクリックしてインストーラーをダウンロードします。
3.  インストーラーを実行します。設定項目が多いですが、基本的にすべてデフォルトのままで「Next」を進めてインストールして問題ありません。

**重要**: インストール完了後、一度PCを再起動するか、現在開いているPowerShellやコマンドプロンプトをすべて閉じてください（パスを通すため）。

---

## 2. リポジトリの取得

PowerShellを開き、プロジェクトを保存したいフォルダへ移動してから、以下のコマンドを実行してソースコードを取得します。

```powershell
# 例: Documentsフォルダに移動
cd ~\Documents

# リポジトリのクローン (ダウンロード)
git clone https://github.com/yutaka-okawachi/gaswebapp-manual.git

# フォルダの中へ移動
cd gaswebapp-manual
```

---

## 3. 依存関係とツールのインストール

プロジェクトに必要なライブラリと、GAS管理ツール `clasp` をインストールします。

```powershell
# プロジェクトの依存ライブラリをインストール
npm install

# GAS管理ツール 'clasp' をグローバルにインストール
npm install -g @google/clasp
```

> **Note**: `npm install` でエラーが出る場合は、Node.jsが正しくインストールされているか確認してください (`node -v` でバージョンが表示されればOK)。

---

## 4. Google Apps Script 認証 (clasp login)

`clasp` が Google アカウントにアクセスできるようにログインします。

```powershell
clasp login
```

1.  ブラウザが自動的に開き、Googleログイン画面が表示されます。
2.  GASプロジェクトを管理しているGoogleアカウントでログインします。
3.  「clasp が Google アカウントへのアクセスをリクエストしています」という画面で **「許可」** をクリックします。
4.  ブラウザに "Logged in! You may close this page." と表示されれば成功です。

---

## 5. 環境設定 (.envファイルの作成)

セキュリティ保護のため、APIキーやURLなどの機密情報は `.env` ファイルで管理しています。このファイルはGitに含まれていないため、手動で作成する必要があります。

1.  プロジェクト直下（`gaswebapp-manual` フォルダ）に `.env` という名前のファイルを新規作成します。
2.  以下の内容をコピーして貼り付け、適切な値に書き換えてください。

**`.env` の内容:**

```ini
# Google Apps Script (GAS) のデプロイIDから生成されたウェブアプリのURL
# clasp deploy 後に出力されるURL末尾の /exec までのパス
GAS_DEPLOY_URL=https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/exec

# APIアクセスのための秘密トークン
# GAS側のスクリプトプロパティで設定した TOKEN と一致させる必要があります
GAS_SECRET_TOKEN=your_secure_random_token_here
```

> **Note**: `GAS_DEPLOY_URL` と `GAS_SECRET_TOKEN` の値が不明な場合は、既存のPC環境を確認するか、GASの管理画面（「デプロイ」>「デプロイを管理」および「プロジェクトの設定」>「スクリプトプロパティ」）から確認してください。

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
