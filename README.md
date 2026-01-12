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
   .\sync-data.ps1 -message "変更内容のメモ"
   ```
   *例: `.\sync-data.ps1 -message "フォントサイズを0.85remに変更"`*

3. **完了**
   スクリプトが自動的に ローカル変更のCommit, GAS Push, **Web Appデプロイの更新, フロントエンド設定の同期**, GAS実行, Git Pull (Rebase), Git Push を行います。
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
   .\sync-data.ps1
   ```
   *※ Step 0（コミット）などはスキップされ、Step 2（GAS実行）と Step 3（Pull）が中心に動作します。*

---

## トラブルシューティング

### clasp pushの認証エラー

**症状**: `sync-data.ps1`実行時に「Insufficient Permission」「permission」などの警告が表示される

**原因**: 別のGoogleアカウントでclaspにログインしているため、GASプロジェクトの編集権限がない

**動作**: ✅ **スクリプトは自動的に続行します**（v2024.12.27以降）

```
⚠ clasp push failed: Authentication error detected.
⚠ Skipping clasp push. GAS files will not be updated.
✓ GAS function executed successfully via Web App.
```

**対処が必要な場合**: GASファイル（`src/`内のファイル）をローカルで編集した場合のみ

```powershell
cd src
clasp logout
clasp login  # ブラウザで pistares@gmail.com を選択
```

> **Note**: スプレッドシートのデータ更新だけなら、認証エラーは無視して問題ありません。

---

### git pull失敗（sync-data.ps1実行時）

**症状**: `sync-data.ps1`の`[4/5] Pulling latest data from GitHub...`でエラーが発生

**原因**: ローカルとGitHubで競合が発生、またはネットワークエラー

**対処**: v2024.12.27以降のスクリプトは自動的にリトライします

```
⚠ git pull failed.
Retrying pull in 5 seconds...
✓ Pull succeeded on retry.
```

**手動で解決する場合**:
```powershell
git pull --rebase
# コンフリクトが発生した場合
git checkout --theirs mahler-search-app/dic.html  # GitHub版を採用
git rebase --continue
```

> **Note**: v2024.12.27以降、スクリプトは自動的に3秒待機してからgit pullを実行し、失敗時は5秒後にリトライします。

---

### GAS実行時のAuth Error (401)

**Q. GAS実行時に Auth Error (401) が出る**

A. しばらくデプロイを更新していなかったり、大幅な変更をした直後は、Googleのセキュリティロックがかかることがあります。
一度、ブラウザで [Web App URL](https://script.google.com/macros/s/YOUR_WEB_APP_ID/exec) にアクセスし、画面の指示に従って「許可」ボタンを押してください。その後、再度スクリプトを実行すれば通ります。


---

## 更新履歴 (2025/01/08)

### Richard Wagner / Richard Strauss 検索機能の強化
- **フローティングバーの実装**: `richard_wagner.html` および `richard_strauss.html` に、検索状況（選んだ曲、場面、ページなど）を常時表示するフローティングバーを追加しました。
- **検索情報の排他表示**: 選択している検索方法（「場面から検索」や「ページから検索」）に応じて、関連する情報のみをサマリーに表示するように修正しました。
- **スクロール挙動の改善**: 曲選択時に自動的に検索方法選択エリアへスクロールする機能を廃止し、スムーズな操作性を確保しました。

### その他
- **用語集 (`dic.html`) の修正**: 特定の用語（Sigfrid Karg-Elertなど）に関する説明文の文言を修正しました。

### 検索通知機能の復旧と同期スクリプトの強化 (search notification & sync script fix)
- **Web App URLの自動同期**: GASコード更新時に、現在のデプロイメントを自動的に更新し、そのURLをフロントエンドに反映させるようにしました。これにより通知機能が復旧しました。
- **デプロイ戦略の改善**: 毎回新しいデプロイを作成するのではなく、既存のデプロイを更新する方式に変更し、URLの固定化と安定性を向上させました。
- **認証エラーの自動ハンドリング**: `sync-data.ps1` 実行中に認証エラーが発生した場合、自動的に再ログインを促す機能を追加しました。
