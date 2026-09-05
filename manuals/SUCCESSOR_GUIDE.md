# プロジェクト引き継ぎ・長期保守ガイド

本ドキュメントは、本プロジェクト（音楽用語検索アプリ）を後継者に引き継ぎ、あるいは長期的に維持管理するための手順や情報を1つにまとめたものです。

---

## 1. はじめに（プロジェクト資産一覧）

本システムは **Google スプレッドシート** をデータベースとし、**GitHub Pages** で公開されています。後継者が管理すべき主要な資産は以下の通りです。

| 資産 | 役割 | 管理場所 |
|---|---|---|
| **Google スプレッドシート** | マスターデータ（用語、訳例、メタデータ） | Google ドライブ |
| **Google Apps Script (GAS)** | データ処理、HTML生成、GitHub同期API | スプレッドシートの「拡張機能 > Apps Script」 |
| **メインGitHubリポジトリ** | ソースコード、公開サイト、サイトマップの管理 | [yutaka-okawachi/gaswebapp-manual](https://github.com/yutaka-okawachi/gaswebapp-manual) |
| **ルート用GitHubリポジトリ** | ホスト直下の `robots.txt` の管理 | [yutaka-okawachi/yutaka-okawachi.github.io](https://github.com/yutaka-okawachi/yutaka-okawachi.github.io) |
| **公開 Web サイト** | アプリケーションの動作ページ | `https://yutaka-okawachi.github.io/gaswebapp-manual/` |

---

## 2. 後継者が最初に行うセットアップ手順（新PC移行時）

セキュリティおよびプライバシー保護のため、**パスワード、認証トークン、通知用メールアドレス、`.env` ファイルは GitHub に保存されていません**。
そのため、新しい PC で作業を開始する際は、以下の手順で初期セットアップを実施してください。

1. **フォルダの準備**:
   前任者からプロジェクトのフォルダ一式を受け取るか、GitHub から `git clone` して、Windows PC の分かりやすい場所（例: `C:\Users\ユーザー名\gaswebapp-manual`）に配置します。
2. **セットアップスクリプトの実行**:
   プロジェクトフォルダ直下の **`01_START_SUCCESSOR_SETUP.bat`** をダブルクリックして起動します。
3. **対話式セットアップへの応答**:
   画面の指示に従い、前任者から受け取った機密情報（`GAS Web App URL` と `GAS_SECRET_TOKEN`）を入力します。これにより、ローカル専用の `.env` ファイルが安全に自動生成されます。
4. **Google 認証の実施**:
   スクリプト実行中にブラウザが開き Google ログイン画面が表示されます。対象の Google アカウントでログインし、プログラム（clasp）へのアクセスを許可してください。
5. **初回同期のテスト**:
   セットアップ完了後、プロジェクトフォルダ直下の **`02_RUN_SYNC.bat`** をダブルクリックし、エラーなく完了することを確認します。

---

## 3. 前任者から引き継ぐ情報・権限チェックリスト

前任者は後継者へプロジェクトを渡す際、以下の権限共有と情報提供を必ず行ってください。
*※機密情報（パスワードやトークン、メールアドレス）は、GitHubに直接書き込まず、パスワードマネージャーや口頭、メモ等の安全な手段で渡してください。*

### 3-1. 権限の共有
* [ ] **Google スプレッドシートの共有**: 後継者の Google アカウントに「編集者」権限を付与する。
* [ ] **GAS プロジェクトのアクセス権**: スプレッドシート共有により、後継者が「拡張機能 > Apps Script」からエディタを開けることを確認する。
* [ ] **GitHub リポジトリの Collaborator 追加**: `gaswebapp-manual` と `yutaka-okawachi.github.io` の両方で `Settings > Collaborators` から招待し、Write（書き込み）権限以上を付与する。

### 3-2. 安全に引き渡すパラメータ（ローカル用）
* [ ] **GAS Web App URL**:
  後継者の `.env` ファイルに記述する `GAS_DEPLOY_URL` の値。
  *(例: `https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXXXXXX/exec`)*
* [ ] **GAS_SECRET_TOKEN**:
  ローカルPCとGASウェブアプリ間の認証用トークン。GASエディタの「プロジェクトの設定 > スクリプト プロパティ」に設定されている `GAS_SECRET_TOKEN` の値と一致する文字列。

### 3-3. GAS側のスクリプトプロパティ（クラウド側設定）
通知先メールアドレスやシークレットトークンは、コード内ではなく GAS の「スクリプト プロパティ」で安全に管理されています。

| プロパティ名 | 設定内容 | 用途 |
|---|---|---|
| `NOTIFY_EMAIL` | 通知先メールアドレス | ユーザーが検索を実行した際の通知送信先 |
| `GAS_SECRET_TOKEN` | 任意の認証トークン文字列 | ローカルPCからの自動同期認証用 |
| `GITHUB_TOKEN` | GitHub Personal Access Token | GASからGitHubへ直接データ同期する用 |

#### 💡 GAS スクリプト プロパティの確認・設定手順
1. Google スプレッドシートを開き、メニューの **「拡張機能」 ＞ 「Apps Script」** をクリックします。
2. 左サイドバーの **⚙️（歯車アイコン：プロジェクトの設定）** をクリックします。
3. ページ下部の **「スクリプト プロパティ」** セクションへ移動します。
4. **「スクリプト プロパティを編集」**（または「プロパティを追加」）をクリックします。
5. `NOTIFY_EMAIL` に通知を受け取りたいメールアドレスを入力し、**「スクリプト プロパティを保存」** をクリックします。

---

## 4. 長期保守・アカウントの継承設定

製作者に万が一のことがあった場合や、連絡が取れなくなった場合に備えて以下の継承設定を推奨します。

### 4-1. Google アカウントの無効化管理ツールの設定
Google の **「アカウント無効化管理ツール」** を使用すると、一定期間アクセスがない場合に後継者へ Google ドライブやスプレッドシートのダウンロード権限を自動で引き渡すことができます。
1. [Google アカウント無効化管理ツール](https://myaccount.google.com/inactive) にアクセス。
2. 待機期間（例：3ヶ月〜6ヶ月）を設定。
3. 通知する連絡先に、後継者のメールアドレスを登録。
4. 共有するデータとして「Google ドライブ」を選択。

### 4-2. GitHub アカウントの継承（Successor）設定
GitHub の `Settings > Account > Successor settings` にて、後継者の GitHub ユーザー名を登録しておくことで、将来的にリポジトリの管理権限を譲渡することが可能になります。

---

## 5. 技術的な引き継ぎメモ

### 5-1. あらすじ集の構成
Richard Strauss (RS) および Richard Wagner (RW) のあらすじ集ページ（`rs_synopsis.html`, `rw_synopsis.html`）は、デザインを「曲名から検索」画面と統一し、外部リンク（Google ドライブの PDF ファイル）として運用しています。これらのリンクのクリック数は、Google アナリティクス (GA4) の「離脱クリック」イベントとして自動測定されます。

### 5-2. サイドバーメニューの管理（超重要）
サイドバーメニュー（`<nav class="sidebar">`）のリンク項目を新規追加・変更・削除する場合は、**静的HTML** と **GAS側のテンプレート・ビルドロジック** の両方を修正する必要があります。
`dic.html` はスプレッドシートから自動生成されるため、ローカルの `mahler-search-app/dic.html` を直接書き換えても同期実行時に上書きされて消えてしまいます。必ず以下のファイルを同期して修正してください。

1. **静的HTML**: `mahler-search-app/` 配下の全HTML (12ファイル) および ルートの `index.html`
2. **GAS関連ファイル**: `src/sidebar.html`、`src/index.html`、および `src/generate_dic_html.js` 内のサイドバーHTML埋め込み箇所

### 5-3. robots.txt と2つのGitHubリポジトリ

公開サイトのページ本体と `sitemap.xml` は、従来どおり `gaswebapp-manual` リポジトリで管理します。ホスト直下の `robots.txt` だけは、`yutaka-okawachi.github.io` リポジトリで管理します。

ページの追加、本文修正、デザイン変更、検索データ更新では、通常は `gaswebapp-manual` だけを更新します。公開ページをルート用リポジトリへ移す必要はありません。ルート用リポジトリを触るのは、サイトマップURL、ホスト全体のクロール方針、またはGitHub Pagesの構成を変更するときだけです。

保守後は次を確認してください。

* `https://yutaka-okawachi.github.io/robots.txt` が表示されること
* その `Sitemap:` 行が `https://yutaka-okawachi.github.io/gaswebapp-manual/sitemap.xml` を指していること
* サイトマップが表示され、追加・削除したページが正しく反映されていること

Google Search Consoleへ `robots.txt` を登録したり、ルート用リポジトリのために新しいプロパティを追加したりする作業はありません。サイトマップがすでに「成功」なら、通常の更新時は何もしません。「取得できませんでした」と表示された場合は、公開URLを確認したうえでサイトマップを1回送信し、時間を置いて再確認します。
