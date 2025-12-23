# RWGMRS (Mahler Search App)

このリポジトリは、リヒャルト・ワーグナー、リヒャルト・シュトラウス、マーラーなどの音楽用語検索アプリケーションのソースコードとマニュアルを含んでいます。

## データ更新手順

`dic.html`（用語集）の更新手順は、変更内容によって異なります。
以下のスクリプトを実行することで、自動的に「GASへの反映 → 生成 → GitHubへの同期」が行われます。

### 1. ローカルでファイルを編集した場合
フォントサイズやレイアウト（`generate_dic_html.js`）や、スタイルシート（`common.css`）などを編集した後の更新手順です。

1. **PowerShellを開く**
   作業フォルダ（`c:\Users\okawa\gaswebapp-manual`）でPowerShellを開きます。

2. **更新スクリプトを実行**
   以下のコマンドを実行します。
   ```powershell
   .\update-dic-layout.ps1 -message "変更内容のメモ"
   ```
   *例: `.\update-dic-layout.ps1 -message "フォントサイズを0.85remに変更"`*

3. **完了**
   スクリプトが自動的に Git Commit, GAS Push, GAS実行, Git Pull, Git Push を行います。
   数分後に [GitHub Pages](https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/dic.html) に反映されます。

---

### 2. スプレッドシートだけを更新した場合
プログラム（JSやCSS）は触らず、Googleスプレッドシートのデータ（用語の追加・修正など）のみを行った場合の手順です。

1. **GASエディタで実行する場合（推奨・確実）**
   - [GASエディタ](https://script.google.com/home) を開きます。
   - `src/export_json.js` を開き、関数 `exportAllDataToJson` を選択して「実行」を押します。
   - これだけで `dic.html` が再生成され、GitHubへプッシュされます。

2. **PowerShellから行う場合**
   ローカルのファイル変更がなくても、上記と同じスクリプトで更新可能です。
   ```powershell
   .\update-dic-layout.ps1
   ```
   *※ Step 0（コミット）などはスキップされ、Step 2（GAS実行）と Step 3（Pull）が中心に動作します。*

---

## トラブルシューティング

**Q. GAS実行時に Auth Error (401) が出る**
A. しばらくデプロイを更新していなかったり、大幅な変更をした直後は、Googleのセキュリティロックがかかることがあります。
一度、ブラウザで [Web App URL](https://script.google.com/macros/s/AKfycbzsgiXGZ3ptAGqR-qMDR26tRNI235IYUVBox-quohfqvNlnkxGSqNb9yY8DiD41JB8qWA/exec) にアクセスし、画面の指示に従って「許可」ボタンを押してください。その後、再度スクリプトを実行すれば通ります。
