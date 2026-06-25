# 継承者向け追加引き継ぎ資料 (Additonal Handover Notes)

本ドキュメントは、Richard Strauss (RS) および Richard Wagner (RW) のあらすじ集追加に伴うシステム構成の変更点、およびデータ同期スクリプト `sync-data.ps1` の仕様と管理上の注意点をまとめたものです。

---

## 1. あらすじ集の追加に伴う構成変更

新たにRSおよびRWのあらすじ集ページを追加しました。

*   **追加されたファイル**:
    *   `mahler-search-app/rs_synopsis.html` (Richard Strauss あらすじ集)
    *   `mahler-search-app/rw_synopsis.html` (Richard Wagner あらすじ集)
*   **デザインと表記のルール**:
    *   「曲名から検索」画面の「ドイツ語の音楽用語集」へのリンク（角丸の `<fieldset>` と、右上に矢印 `↗` が付いたブロック `<a>` リンクのリスト）と同じビジュアルデザインを踏襲しています。
    *   ホバー時の色は、それぞれの作曲家のテーマカラー（Strauss: `#e1610e`, Wagner: `#3b5275`）を設定しています。
    *   文章中の句読点は全角の「，」と「．」で統一し、Wagnerの対象は「楽劇等」と表記しています。

---

## 2. サイドバーメニュー管理の注意点（超重要）

サイドバーメニューのリンク項目（今回追加した「あらすじ集」など）を新規追加・変更・削除する場合は、**静的HTML** と **GAS側のテンプレート・ビルドロジック** の両方を修正する必要があります。

> [!IMPORTANT]
> `dic.html` はスプレッドシートデータから動的にビルドされるため、ローカルの `mahler-search-app/dic.html` を直接修正しても、同期スクリプト実行時に上書きされて消えてしまいます。必ず以下の両系統を修正してください。

### ① 静的HTMLファイル（計13ファイル）
以下のファイルにあるサイドバー（`<nav class="sidebar">`）を直接修正します。
*   `mahler-search-app/` 配下の全HTMLファイル (12ファイル)
*   ルートの `index.html` (1ファイル)

### ② GASテンプレート/スクリプト（計3ファイル）
`dic.html` の自動生成時やGAS Web App実行時にサイドバーが崩れるのを防ぐため、以下のファイルも必ず同期して修正します。
*   `src/sidebar.html` (GASで出力されるサイドバーのテンプレート)
*   `src/index.html` (GAS Web App用のトップテンプレート)
*   `src/generate_dic_html.js` (用語集 `dic.html` 生成時にサイドバーを動的に組み立てるロジック。790行目付近〜にサイドバーの HTML 文字列が埋め込まれています)

---

## 3. `sync-data.ps1` の動作仕様と安全性

`sync-data.ps1` は、ローカルコード、GAS、およびスプレッドシートデータの整合性を保ちながら GitHub Pages に公開するための「統合データ同期スクリプト」です。

### 実行される処理フロー
1.  **Git状態の自動クリーンアップ**:
    *   `main` 以外のブランチで実行された場合、自動でコミットやマージ、または stash を行い、安全に `main` ブランチに切り替えます。
2.  **GASコードのアップロード (`clasp push`)**:
    *   `src/` 配下の変更を GAS へアップロードします。
    *   Node.jsの接続エラー（Windows環境で発生しやすいIPv6優先による `FETCH_ERROR`）を防ぐため、自動的に `$env:NODE_OPTIONS = "--dns-result-order=ipv4first"` を適用しています。
3.  **GAS Web Appの自動更新**:
    *   `manage_deploy.js` と `update_env.js` を実行し、Web App デプロイメントを自動更新します。
4.  **スプレッドシートデータのエクスポートトリガー**:
    *   `clasp run exportAllDataToJson` または Web App 経由でのAPI叩きによって、GAS 側でスプレッドシートの最新データを読み込み、`dic.html` や JSON データを生成して GitHub のリモートリポジトリにプッシュします。
5.  **ローカルとの同期と競合回避**:
    *   リモートにプッシュされたデータを `git pull --rebase` でローカルに安全に取り込みます。
6.  **`sitemap.xml` の自動日付更新**:
    *   更新された HTML ファイルを検出し、`sitemap.xml` 内の対応する `<lastmod>`（最終更新日）タグを自動で今日の日付に書き換えてコミットします。
7.  **GitHub への最終プッシュ**:
    *   すべての変更をプッシュします。GAS からの push が `[skip ci]` メッセージで行われた場合、GitHub Pages のビルドが走らないのを防ぐため、空のトリガーコミット (`Deploy: Update data files`) を自動挿入してビルドを強制実行します。

### 「そのまま実行して大丈夫か」についての検証
*   今回追加した `rs_synopsis.html` と `rw_synopsis.html` は静的HTMLファイルのため、`sync-data.ps1` によって上書きされたり削除されたりすることはありません。
*   サイドバーのテンプレート群（`src/sidebar.html`, `src/generate_dic_html.js` など）はすでに今回追加した「あらすじ集」を含んだ状態で本番マージ・同期済みであるため、次回以降にスクリプトを走らせても、`dic.html` や各種生成ページのサイドバーから「あらすじ集」リンクが消える心配はありません。
*   `sitemap.xml` の自動日付更新機能も、あらすじ集のURL（`mahler-search-app/rs_synopsis.html` など）が `sitemap.xml` 内に定義されており、かつ `sync-data.ps1` の `$pathMappings` に登録されたため、自動的にマッチして最終更新日が更新される仕様になっています。

---

## 4. Google Search Console (GSC) および Google Analytics (GA4) の対応

### ① Google Search Console (GSC)
*   **サイトマップの登録**:
    *   `sitemap.xml` に新しいあらすじ集ページのURLを登録済みです。
    *   GSC上でサイトマップが「取得できませんでした」と表示されるのは、Google クローラー側の検知タイムラグ（通常24〜48時間）によるものであり、設定ミスではありません。
    *   本サイトは `github.io` のサブディレクトリ（`gaswebapp-manual/`）で運用されていますが、ドメイン直下でなくてもルート（`gaswebapp-manual/sitemap.xml`）に設置し、`robots.txt` でパスを正しく宣言しているため、問題なくインデックスされます。放置して大丈夫です。

### ② Google Analytics 4 (GA4)
*   **外部リンク（PDF）の計測**:
    *   「あらすじ集」の各リンクは Google ドライブの PDF ファイルへの外部リンクとなっています。
    *   GA4の基本機能である「測定機能の強化」が有効になっているため、ユーザーがこれらのリンクをクリックした際は「離脱クリック（Outbound clicks）」イベントとして自動的に測定されます。
    *   日本語版のGA4管理画面では「離脱クリック」というイベント名でカウントされ、レポートで確認できます。特に追加の実装は不要です。

---

## 5. 運用時のトラブルシューティング

*   **clasp の認証エラー**:
    *   `clasp push` などで権限エラーが出た場合は、`clasp login` を実行し、ブラウザでログイン認証をやり直してください。
*   **Web Appデプロイ数の警告**:
    *   Web App のバージョンが上限（200回）に近づくとコンソールに警告が表示されます。その際はGASエディタの「デプロイの管理」から古いデプロイを整理してください。
