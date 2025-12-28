# ワークフロー自動化マニュアル

このプロジェクトでは、アプリのコード（HTML/JS/CSS）とデータ（Googleスプレッドシート）を効率的に同期するための自動化スクリプトを使用します。

## 🚀 日常の更新ワークフロー

開発作業やデータの更新が終わったら、PowerShell で以下のコマンドを実行するだけです。

```powershell
.\sync-data.ps1
```

### スクリプトが自動で行うこと
1. **GAS の更新**: `src/` フォルダ内の変更（テンプレートやロジック）を `clasp push` で GAS へ反映。
2. **データの生成**: GAS の `exportAllDataToJson` 関数を遠隔実行し、最新データと `dic.html` を生成して GitHub にプッシュ。
3. **ローカル同期**: GAS が生成した最新の `dic.html` やデータを `git pull` で取得。
4. **一括公開**: 全ての変更をまとめて GitHub にプッシュし、GitHub Pages を更新。

---

## 🎨 UI・デザインの管理

最近のアップデートで、全ページのデザイン（タイトル、マージン、サイドバー等）の管理が統一されました。

### 全ページ共通のデザイン変更
- **管理ファイル**: `mahler-search-app/css/common.css`
- **変更方法**: このファイルを編集し、`.\sync-data.ps1` を実行してください。

### 用語集（dic.html）のレイアウト変更
- **管理ファイル**: `src/generate_dic_html.js`
- **注意**: `dic.html` を直接編集しても、次回のデータ更新で上書きされます。必ず `src/generate_dic_html.js` 内の HTML/CSS テンプレートを編集してください。

---

## ⚠️ トラブルシューティング

### GAS実行時に Auth Error (401) が出る場合
Googleのセキュリティ再認証が必要です。一度、ブラウザで [Web App URL](https://script.google.com/macros/s/AKfycbzsgiXGZ3ptAGqR-qMDR26tRNI235IYUVBox-quohfqvNlnkxGSqNb9yY8DiD41JB8qWA/exec) にアクセスし、指示に従って「許可」を押してください。

### clasp run でエラーが出る場合
```powershell
clasp login
```
を実行して再認証してください。

---

## 📚 関連ドキュメント
- [README.md](README.md): プロジェクト全体の概要
- [DOCS_INDEX.md](DOCS_INDEX.md): 全ドキュメントのインデックス
