# 開発者・運用保守ガイド

本ドキュメントは、本プロジェクトの開発環境構築、データの同期手順、およびサイト運用（SEO・パフォーマンス調整）に関する詳細な技術情報を1つにまとめた開発者向けマニュアルです。

---

## 1. 開発環境の構築（Setup）

### 1-1. 必要ツールのインストール
* **Node.js**: Google Apps Script (GAS) の管理ツール `clasp` を動かすために、[Node.js 公式サイト](https://nodejs.org/ja/)から LTS 推奨版をインストールします。
* **Git**: バージョン管理とソースコード管理のために、[Git for Windows](https://git-scm.com/download/win) からインストールします。

### 1-2. リポジトリのクローンと初期セットアップ
1. リポジトリをクローンして移動します：
   ```powershell
   git clone https://github.com/yutaka-okawachi/gaswebapp-manual.git
   cd gaswebapp-manual
   ```
2. GAS 管理ツール `clasp` をグローバルインストールし、ログインします：
   ```powershell
   npm install -g @google/clasp
   clasp login
   ```
   *※ブラウザが開くので、スプレッドシートやGASを管理しているGoogleアカウントでログインを許可します。*

### 1-3. 環境変数（.env）の設定
プロジェクトのルートディレクトリに、以下の `.env` ファイルを作成してください（Git コミット対象外）。
```bash
# GAS Web App の公開用URL
GAS_DEPLOY_URL=https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXX/exec

# Web App とローカル間の認証トークン
GAS_SECRET_TOKEN=任意の安全なトークン文字列
```

---

## 2. データ同期ワークフロー

スプレッドシートから最新データを反映したり、プログラムを更新した場合は、同期スクリプトを使用します。

### 2-1. 同期スクリプトの実行方法
非ITの運用者向けにはプロジェクト直下の `02_RUN_SYNC.bat` をクリックするだけで同期可能ですが、PowerShell から直接コマンドで実行することもできます。
```powershell
# 基本実行（自動コミット）
.\sync-data.ps1

# 任意のコミットメッセージを指定して実行
.\sync-data.ps1 -message "任意の更新メモ"
```

### 2-2. 実行される処理の流れ
1. **Gitの自動安全確認**: `main` 以外のブランチで実行された場合、自動で安全に `main` へ切り替え・マージを行います。
2. **GASコードの送信 (`clasp push`)**: `src/` 配下の変更を GAS へアップロードします。
3. **Web App デプロイメントの自動更新**: GAS 側のデプロイメントを自動で上書き更新します。
4. **データの自動書き出し**: Web App 経由でスプレッドシートの全データをエクスポートさせ、`mahler-search-app/` 配下に JSON と `dic.html` を保存・プッシュします。
5. **sitemap.xml 最終更新日の自動更新**: 実際に更新されたファイル（`dic.html` 等）を検知し、サイトマップの日付を自動で書き換えてコミット・プッシュします。

### 2-3. トラブルシューティング
* **GAS 200バージョン上限エラー**:
  GAS は1つのスクリプトにつき最大200バージョンまでの制限があります。上限に達すると `clasp deploy` でエラーが発生し、Web App が古いコードのままになってしまいます。
  * **対応**: GASエディタの左メニュー「プロジェクトの履歴」（時計マーク）から、**「バージョンの一括削除」** を行うか、古いバージョンを個別に削除して空きを作ってください。
* **Rebase 中のコンフリクト発生**:
  自動生成された `mahler-search-app/dic.html` をローカルコミットに含めてプッシュしようとすると、サーバー側で生成された `dic.html` と Git 上で競合が発生します。
  * **対応**: 競合時は以下のコマンドを実行して、ローカルでテスト生成した `dic.html` の変更を破棄してリモート版を優先させます。
    ```powershell
    git rebase --abort  # リベースを中止
    git reset --soft origin/main  # 直近コミットをステージに戻す
    git restore --staged mahler-search-app/dic.html  # dic.htmlを除外
    git checkout -- mahler-search-app/dic.html  # dic.htmlの変更を破棄
    git commit -m "きれいなコミットメッセージ"
    git push
    ```

---

## 3. 楽譜情報の更新手順

ワーグナーおよびシュトラウスの作品検索画面に表示される「楽譜情報（出版社、プレート番号、IMSLPリンク等）」をコード側で更新する手順です。

1. **`src/score_metadata.js`** を開き、該当する曲の情報を編集します。
2. 編集後、以下のコマンドでクライアント側（GitHub Pages用）のファイルにコピーします：
   ```powershell
   copy src\score_metadata.js mahler-search-app\js\score_metadata.js
   ```
3. `.\sync-data.ps1` を実行し、GASサーバーおよびGitHubに反映させます。

---

## 4. サイト運用（SEO・パフォーマンス向上）

### 4-1. SEO（検索エンジン最適化）
* **正規タグの設定**: 各 HTML の `<head>` 内に `<link rel="canonical">` および `<meta property="og:url">` が指定され、重複コンテンツを防いでいます。
* **新規ファイル追加時**: `sitemap.xml` への追加に加え、`sync-data.ps1` の内側にある `$pathMappings` 変数へファイルパスを登録することで、最終更新日の自動更新機能が有効になります。

### 4-2. パフォーマンス向上 (PageSpeed Insights 対応)
* **フォントの最適化**: ページ読み込み時の LCP（最大コンテンツ描画）遅延を防ぐため、トップページ冒頭の説明文（`.subtitle`）には Web フォントではなくシステムフォントを明示的に指定しています。
* **Googleタグの遅延読み込み**: 描画ブロックを防ぐため、`gtag.js` を即時ロードせず、ページ読み込み後に遅延して追加する実装を行っています。
* **CSSの扱い**: `common.css` は描画ブロック警告が出ることがありますが、レイアウト維持のためにトップページからも単純に削除しないようにしてください。
* **「実例を見る」アコーディオンの事前埋め込み方式**:
  巨大な辞書ページ（`dic.html`、1.2MB以上）において、「実例を見る」をクリックした際に動的にDOM要素を生成して挿入すると、ブラウザが大きなレイアウト再計算（リフロー）を引き起こすほか、翻訳ツールや広告ブロックなどの拡張機能が「DOM変更監視（MutationObserver）」によってページ全体を再スキャンしてブラウザをフリーズさせる原因になります。
  そのため、アコーディオンで表示するリンク要素は最初から非表示状態（`display: none;`）でHTML内に埋め込んでおき、クリック時は単に `display` スタイルの変更のみを行うようにして、DOMの追加/削除処理を回避しています。
* **Googleタグ（gtag）のエラー例外保護**:
  プライバシー保護アドオンや広告ブロッカー等によって `window.gtag` の呼び出しが遮断・阻害されることで、JavaScriptの実行エラー（例外）が発生しアコーディオンの開閉処理自体が止まってしまうのを防ぐため、イベント送信部分は必ず `try...catch` 構文で保護しています。
