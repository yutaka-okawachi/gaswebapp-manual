# セットアップガイド (Setup Guide)

このプロジェクトをローカルで動作させるための環境構築手順です。

## 1. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成し、以下の変数を設定してください。
**注意**: `.env` ファイルには実際の秘密鍵やトークンが含まれるため、Gitにはコミットしないでください（`.gitignore` で除外されています）。

### `.env` テンプレート

```bash
# Google Apps Script (GAS) のデプロイIDから生成されたウェブアプリのURL
# clasp deploy 後に出力されるURL末尾の /exec までのパス
GAS_DEPLOY_URL=https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX/exec

# APIアクセスのための秘密トークン
# GAS側のスクリプトプロパティで設定した TOKEN と一致させる必要があります
GAS_SECRET_TOKEN=your_secure_random_token_here
```

## 2. 必要なツールのインストール

このプロジェクトは Google Apps Script (GAS) を管理するために `clasp` を使用します。

```bash
npm install -g @google/clasp
clasp login
```

## 3. 初期設定

初めてプロジェクトをクローンした場合は、`.clasp.json` の設定を確認し、適切なスクリプトIDが設定されていることを確認してください。
