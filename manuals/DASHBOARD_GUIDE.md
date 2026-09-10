# ダッシュボードマニュアル

利用状況の確認、APIと画面の保守、Sites公開、新PCへの移行をまとめています。サイトの日常更新は[日常保守マニュアル](DEVELOPER_GUIDE.md)、共通環境の復元は[PC移行マニュアル](PC_MIGRATION_GUIDE.md)を参照してください。

## 1. 通常確認と更新・公開

管理者ダッシュボードは、Sitesへ保存された画面から固定GAS APIを直接読み込みます。保守対象は次の2つのリポジトリに分かれています。

| 対象 | リポジトリ | 主な正本 |
|---|---|---|
| 集計・JSON API | `gaswebapp-manual`（本リポジトリ） | `src/dashboard_analytics.js` |
| 表示・入力検証・Sites公開 | `sites-plugin-sites-openai-bundled` | `app/dashboard-data.ts`、`app/page.tsx`、`app/globals.css` |

API契約の現在値は、`src/dashboard_analytics.js` の `DASHBOARD_SCHEMA_VERSION` と `scripts/dashboard-api-check.ps1` を基準にしてください。両リポジトリの `schemaVersion` は必ず一致させます。

#### 通常のデータ更新

通常のスプレッドシート更新では、本リポジトリで `sync-data.ps1` を実行します。固定GAS APIのURLが変わらない限り、**ダッシュボードをSitesへ再公開する必要はありません**。

1. 実行前に `git status --short` で意図しない変更がないことを確認します。
2. `sync-data.ps1` を実行します。
3. 末尾で7・30・90日の各 `period` が `[OK]` になったことを確認します。
4. 所有者アカウントでダッシュボードを再読み込みし、「最終更新」と主要な値を確認します。

検索数・閲覧数・実例クリック数・「実例を見る」の表示時間・訪問経路・継続利用はGA4 Data APIの集計です。スプレッドシートの「検索履歴」タブを編集しても、これらの利用状況集計は直接変更されません。「Notes」タブは検索語の訳語補完に利用され、変更内容は `mahler-search-app/data/dic_notes.json` と生成済み `mahler-search-app/dic.html` に反映されます。`dic.html` と `data/` は生成物なので、永続的な修正はスプレッドシートまたはGAS側の生成元へ入れてください。

「実例を見る」の表示時間は、用語集で作曲家名をクリックした時点から、遷移先で検索結果の描画が完了するまでを `dictionary_example_timing` イベントで計測します。ダッシュボードには選択期間内の全体平均、作曲家別平均、測定件数を表示します。公開前の実例結果表示には時間値がないため集計対象に含めず、管理者モード、URLの直接入力、コピーしたURLからの表示も測定対象外です。

集計結果は15分間キャッシュされます。更新直後に表示が変わらない場合は、すぐに再公開せず、キャッシュ時間をおいて再確認します。継続利用の `collecting` は対象期間が未完了であることを示す正常な表示です。

#### GAS APIを変更する場合

指標、対象ページ、JSONのキー、配列件数などを変えるときは、次を同じ変更単位でそろえます。

1. 本リポジトリの `src/dashboard_analytics.js` と `scripts/test-dashboard-analytics.js`
2. 本リポジトリの `scripts/dashboard-api-check.ps1`
3. Sitesリポジトリの `app/dashboard-data.ts`（型・入力検証）
4. Sitesリポジトリの `app/page.tsx`、必要に応じて `app/globals.css`
5. Sitesリポジトリの `tests/rendered-html.test.mjs`

必須キーの追加など、旧画面が新しい応答を安全に読めない変更では `schemaVersion` を上げます。GASだけを先に公開すると現行画面がエラーになる場合があるため、公開順序と互換性を事前に確認してください。

本リポジトリでの検証：

```powershell
node scripts/test-dashboard-analytics.js
node --check src/dashboard_analytics.js
git diff --check
```

GAS公開後は `sync-data.ps1` の結果、または `scripts/dashboard-api-check.ps1` を使って、固定WebアプリURLの7・30・90日応答を検査します。ローカルテストの成功だけで本番APIの更新済みとは判断しません。

Sitesリポジトリでの検証：

```powershell
npm test
npm run lint
npm run build
git diff --check
```

これらの `npm` コマンドは `package.json` があるSitesリポジトリで実行します。本リポジトリでは実行しません。

#### 画面だけを変更する場合

表示文言、グラフ、レイアウト、レスポンシブ表示だけの変更はSitesリポジトリで行います。API契約を変えない限り、GASの再デプロイや `sync-data.ps1` は不要です。PC・タブレット・スマートフォン相当の幅で、表の横スクロール、文字切れ、値が0または欠損の場合の表示も確認します。

#### Sitesへの公開

1. Sitesリポジトリの作業ツリーがクリーンであることを確認します。
2. テスト・lint・本番ビルドを通し、公開対象のコミットIDを記録します。
3. そのコミットを、`.openai/hosting.json` が設定されたリポジトリへpushします。
4. `.openai/hosting.json` の既存プロジェクトを再利用してSitesバージョンを保存・公開します。新しいSitesプロジェクトは作りません。
5. 公開したSitesバージョン、コミットID、GASの固定デプロイ、確認日時を作業記録へ残します。
6. 所有者で実データ表示を確認し、匿名アクセスがHTTP 401になることを確認します。アクセス設定は所有者限定のまま変更しません。

GAS APIの更新とSitesの公開は別作業です。どちらか一方の成功を、もう一方の更新確認として扱わないでください。


## 2. 新PC・継承時の準備

閲覧だけなら開発環境は不要です。引き継いだ公開URLを所有者アカウントで開き、7・30・90日を切り替えて実データを確認します。PCを替えただけではSites再公開やGAS再デプロイは不要です。

画面を保守する場合は次を行います。

1. 旧PCで画面用リポジトリの `git remote -v`、ブランチ、コミット、未送信の変更、Node.jsの版、公開URL、Sitesバージョンを記録します。私有リポジトリのURLやアカウント情報は公開マニュアルに記載しません。
2. `.openai/hosting.json` と、Git対象外の必要な設定を安全に保存します。既存Sitesプロジェクトへの接続情報を失わないようにします。
3. 新PCで[共通環境](PC_MIGRATION_GUIDE.md)を用意し、引き継いだ実際のリモートURLから画面用リポジトリを別フォルダへcloneします。フォルダ名だけからURLを推測しないでください。
4. `package.json` の指定とロックファイルに合わせて依存関係を復元します。`package-lock.json` があるnpm構成なら `npm ci` を実行します。
5. `.openai/hosting.json` が既存プロジェクトを指すことと、そのプロジェクトを管理できるアカウントで接続できることを確認します。欠落時は旧PC・バックアップから戻し、新規プロジェクトを作らないでください。
6. `app/dashboard-data.ts` の `GAS_API_URL` を既存の固定APIと照合します。PCのユーザー名や保存場所を変えただけならURLを変えません。
7. 画面用フォルダで `npm test`、`npm run lint`、`npm run build` を実行し、ローカル表示を確認します。サイト側フォルダでこれらのnpmコマンドを実行しないでください。
8. 公開済みの所有者画面を確認します。変更を公開する場合だけ第1章の公開手順へ進みます。

担当者交代ではSitesの管理権限・所有者限定アクセス、画面用リポジトリ権限、GAS実行主体のGA4アクセス権を個別に確認します。一般公開へ切り替えて引き継ぎを代用しないでください。

## 3. 障害対応と記録

### 復元手順

* 問題発生時は、作業直前に記録したコミットと公開バージョンを基準に差分を確認してください。過去の特定コミットやSitesバージョン番号を恒久的な復元先にはしません。
* コードを戻す場合は、復元対象のコミットから確認用ブランチを作り、必要な差分だけを通常のコミットとして反映します。作業ツリー全体を消す `git reset --hard` は使用しません。
* ダッシュボードの公開を戻す場合は、Sitesの管理画面で所有者が直前の正常なバージョンを選び、内容と所有者限定設定を確認してから公開します。コードの復元とSitesの公開切替は別作業です。
* GASに問題がある場合は、固定Webアプリのデプロイを直前の正常なコードへ戻してAPI検査を行います。Sitesを戻しただけではGAS APIは戻りません。
* 用語データを戻す場合は `dic.html` や `data/` を直接修正せず、スプレッドシートまたはGASの生成元を修正して `sync-data.ps1` を再実行します。
* 固定GAS WebアプリURLを変更しない限り、ダッシュボード側の `GAS_API_URL` は変更しません。


公開作業では日付、両リポジトリのコミットID、GAS固定デプロイ、Sitesバージョン、API検査結果、所有者表示と匿名401の確認結果を記録します。過去の開発記録は[更新履歴](../CHANGELOG.md)へ集約しています。

## 4. 計測とAPIの保守資料

2026-09-07のローカル実装では `schemaVersion` は **6** です。本番が同じ版かどうかは公開後のAPI検査で確認します。古いschemaVersion 1のJSON例は使用しません。

必須キーは `schemaVersion`、`period`、`updatedAt`、`range`、`daily`、`previous`、`searchSummary`、`searchMethods`、`retention`、`pageTrends`、`acquisition`、`pages`、`dictionaryExampleMoves`、`dictionaryExamplePerformance`、`terms` です。型・値の制約は `scripts/dashboard-api-check.ps1`、計算方法は `src/dashboard_analytics.js` とそのテストを正本とします。

### GA4・GAS設定の引き継ぎ確認

- GASのスクリプトプロパティ `GA4_PROPERTY_ID` と、実行アカウントの対象プロパティへの読み取り権限を確認します。
- `src/appsscript.json` のAnalytics DataサービスとOAuthスコープを維持します。
- イベントスコープの `search_type`、`composer`、`source_page`、`destination_page`、`link_type`、`term`（表示名 `term_toggle`）とカスタム指標 `result_count` を確認します。`search_term` は標準の `searchTerm` を使います。
- 拡張計測の「サイト内検索」を無効にし、明示送信イベントとの重複を避けます。これらはクラウド側設定なので、PC変更だけで再作成しません。
- 管理者自身の計測除外は[日常保守マニュアル](DEVELOPER_GUIDE.md)第5章に従い、ブラウザごとに設定します。

### 集計期間

- `period` は `7`、`30`、`90` のいずれかだけを受け付ける。
- 終了日はGA4プロパティのタイムゾーンにおける当日とする。
- 開始日は当日を含めて `period` 日前ではなく、`period - 1` 日前とする。
- `daily` は期間内の全日を古い日から順に返す。
- データがない日も省略せず、各値を `0` として返す。
- 日付境界はGA4プロパティとGASの双方を日本時間にそろえる。
- 集計結果は期間ごとに15分間キャッシュする。
- 同じ期間のキャッシュが同時に失効した場合は処理を直列化し、待機後に
  キャッシュを再確認してGA4 Data APIの重複呼び出しを避ける。

### 指標の定義

### 検索実行数

- 1回の検索結果表示につき、次のどちらか一方を1件として数える。
  - 検索結果が1件以上: `view_search_results`
  - 検索結果が0件: `search_no_results`
- `source_page`、GA4標準の `pagePath`、または既知の `search_type` のいずれかで
  登録済み検索ページへ帰属できるイベントだけを対象とする。
- いずれの方法でも検索元を特定できないGA4拡張計測の自動イベントや旧イベントは
  全体検索数・ページ別検索数のどちらにも含めない。
- `result_count` の合計は検索実行数に使用しない。
- 無効入力、検索中止、処理失敗は数えない。
- 日ごとの検索実行数は `daily[].searches` に返す。
- 1日平均検索数は、期間内の検索実行数合計を選択期間の日数で割り、ダッシュボード側で四捨五入して整数表示する。

### 用語集の閲覧数

- `daily[].views` はサイト全体ではなく、用語集
  `/gaswebapp-manual/mahler-search-app/dic.html`
  の `page_view` 数とする。
- ページ別の `pages[].views` は、それぞれのページの `page_view` 数とする。

### 「実例を見る」から検索結果が表示された回数

- 用語集の作曲家リンクから検索ページへ移動し、検索結果が1件以上表示されたときに
  送信する `view_example_search_results` のイベント数を数える。
- 用語集で「実例を見る」の欄を開いただけの場合や、移動先で検索結果が表示されなかった
  場合は数えない。
- `daily[].exampleClicks` は全ページの同イベント数とする。
- `pages[].exampleClicks` はクリックが発生したページへ帰属させる。
- 実例クリック率は、期間内の全 `view_example_search_results` 数を期間内の
  `dic.html` 閲覧数で割って100を掛ける。
- 分母が0の場合の実例クリック率は `0.0%` とする。

### 検索ページへの移動数

- `search_page_move` のイベント数を数える。
- `pages[].searchMoves` はリンクが置かれていた移動元ページへ帰属させる。
- `dictionaryExampleMoves` は用語集の作曲家リンクから、
  Wagner・Mahler・R. Straussの各「用語から検索」ページへ移動し、
  1件以上の検索結果が表示された回数を返す。
- `view_example_search_results` の `destination_page` ごとに集計し、
  3作曲家の合計は同期間の `exampleClicks` 合計と一致させる。
- 移動先ページの閲覧数とは別の指標として扱う。

### `source_page` の定義

- 検索イベントの `source_page` は「その検索操作を実行したページ」とする。
- 検索ページ移動イベントの `source_page` は「移動リンクをクリックしたページ」とする。
- 検索ページ移動イベントでは、移動先を別パラメータ `destination_page` に記録する。
- `document.referrer` や、その前に閲覧していたページを `source_page` に混在させない。
- 値はイベント発生時の `location.pathname` を基にし、次の規則で正規化する。
  - クエリ文字列とハッシュを含めない。
  - 先頭の `/` を含める。
  - ルート `/gaswebapp-manual/` を除き、末尾の `/` を除く。
  - 完全なURL、ホスト名、画面表示名は格納しない。

### 用語別集計

- 検索総数にはすべての検索形式を含める。
- `terms` と `topTerms` には、用語入力による検索だけを含める。
- `terms` と `topTerms` は `view_search_results` だけを対象とし、
  `search_no_results` だけだった検索語は含めない。
- 対象となる `search_type` は `gm_term`、`rs_term`、`rw_term` とする。
- 作品、楽器、場面、人物などを連結した内部検索条件は用語として表示しない。
- 同じ用語の表記ゆれは、集計キー作成時に次を適用してまとめる。
  - Unicode NFKC正規化
  - 前後空白の除去と連続空白の1文字化
  - 小文字化
  - `ä → ae`、`ö → oe`、`ü → ue`、`ß → ss`
- 表示する用語は、同じ集計キーの中で最も多く観測された元表記を使う。
- 同数の場合は、大文字・小文字を無視した昇順で先に来る表記を使う。

#### 訳語

- `Notes` シートのドイツ語見出しを同じ規則で正規化して照合する。
- 見つかった場合は、訳語欄の最初の空でない行を使用する。
- HTMLタグを除き、連続空白を1文字にまとめる。
- 80文字を超える場合は、79文字までに省略記号 `…` を付ける。
- 見つからない場合は `translation` を空文字 `""` とする。
- 訳語が空でも、その用語の検索数とページ内訳は返す。

### ページ名と実在パス

`pages` は次の12ページを常にこの順で返す。対象期間の値がすべて0でも省略しない。

| `page` | `path` |
|---|---|
| HOME | `/gaswebapp-manual/` |
| 曲名と楽器等から検索 (GM) | `/gaswebapp-manual/mahler-search-app/mahler.html` |
| ドイツ語の音楽用語集 | `/gaswebapp-manual/mahler-search-app/dic.html` |
| 用語から検索 (GM) | `/gaswebapp-manual/mahler-search-app/terms_search.html` |
| 用語から検索 (RS) | `/gaswebapp-manual/mahler-search-app/rs_terms_search.html` |
| 用語から検索 (RW) | `/gaswebapp-manual/mahler-search-app/rw_terms_search.html` |
| 曲名から検索 (RS) | `/gaswebapp-manual/mahler-search-app/richard_strauss.html` |
| 曲名から検索 (RW) | `/gaswebapp-manual/mahler-search-app/richard_wagner.html` |
| あらすじ集 (RS) | `/gaswebapp-manual/mahler-search-app/rs_synopsis.html` |
| あらすじ集 (RW) | `/gaswebapp-manual/mahler-search-app/rw_synopsis.html` |
| 訳出についての覚書 | `/gaswebapp-manual/mahler-search-app/notes.html` |
| その他 | `/gaswebapp-manual/mahler-search-app/other.html` |

ページ別の帰属規則は次のとおりとする。

- `views`: そのパスの `page_view`
- `searchMoves`: そのパスを `source_page` とする `search_page_move`
- `searches`: そのパスを `source_page` とする検索イベント
- `exampleClicks`: そのパスを `source_page` とする `view_example_search_results`
- `topTerms`: そのパスで実行された用語検索の上位3件
- `source_page` 導入前の既存イベントは、GA4標準の `pagePath` が上記12パスの
  いずれかに完全一致する場合だけ、その値を検索元ページとして補完する。
- `source_page` と `pagePath` のどちらでも検索元を特定できない既存検索は、
  `search_type`（例: `gm_term`、`rs_term`、`rw_term`、各作曲家の作品検索形式）
  から対応する検索ページを補完する。

### 並び順と件数上限

- `daily`: 日付昇順、件数は必ず `period` と同じ。
- `previous.daily`: 選択期間の直前に連続する同日数期間の日付昇順。
  件数は必ず `period` と同じ。
- `pages`: 上記ページ対応表の固定順、件数は12件。
- `pages[].topTerms`: 検索数降順、同数は正規化済み用語の昇順、最大3件。
- `dictionaryExampleMoves`: Wagner、Mahler、R. Straussの固定順、3件。
- `terms`: 検索数降順、同数は正規化済み用語の昇順、最大50件。
- `terms[].pages`: 検索数が1件以上のページだけを対象とし、検索数降順、同数はページ対応表の順。
- `terms` が50件を超える場合も、検索総数や日別・ページ別の合計値は切り詰めない。


### イベント送信の規則


#### 検索実行

検索処理が完了し、結果表示が確定した時点で、次のどちらか一方だけを送る。

| 結果 | イベント |
|---|---|
| 1件以上 | `view_search_results` |
| 0件 | `search_no_results` |

共通パラメータ:

- `search_term`: 実際に検索した入力値
- `search_type`: 検索形式
- `result_count`: 結果件数
- `composer`: 対象作曲家。該当する検索だけで送る
- `source_page`: 検索を実行したページ

検索総数は、この2イベントのイベント数を合計する。`result_count` は合計しない。

#### 検索ページへの移動

検索ページへのリンクをクリックした時点で `search_page_move` を1回送る。

パラメータ:

- `source_page`: リンクが置かれていたページ
- `destination_page`: 移動先の検索ページ
- `link_type`: `search_navigation`、`prefilled_search`、`example_search`
- `search_term`: 移動先URLに空でない `q` がある場合だけ追加

`search_term` は `search_page_move` の説明情報であり、イベントを追加発生させるものではない。
リンククリック時には `view_search_results` と `search_no_results` を送らない。
移動先で検索処理が完了した後にだけ、検索結果イベントを別途送る。

#### 「実例を見る」

閉じている実例欄を開いた時点で `click_view_example` を1回送る。

パラメータ:

- `term`: 開いた用語
- `source_page`: 用語集ページ
- `page_path`: 既存データとの互換性のため当面維持

実例欄を閉じる操作では送らない。

#### ページ閲覧

既存のGA4 `page_view` を利用する。独自のページ閲覧イベントは追加しない。

#### 二重計測の防止

- `search_page_move` は検索実行数へ含めない。
- ダッシュボードの検索総数は、イベント名が
  `view_search_results` または `search_no_results` の行だけを集計する。
- GA4拡張計測の「サイト内検索」は無効にする。
- 拡張計測を無効にするまでは、`?q=` のあるページで自動生成される
  `view_search_results` と明示送信イベントが重複する可能性があるため公開しない。
- Realtime検証では、1回の操作について送信イベント名と回数を確認する。

#### 実例結果と表示時間

`click_view_example` は欄を開く操作です。ダッシュボードの実例数には、遷移先で1件以上の結果が表示されたときの `view_example_search_results` を使います。`dictionary_example_timing` はクリックから描画完了までの時間を送り、平均と測定件数を集計します。欄を開いた回数、移動回数、結果表示回数、時間を混同しないでください。

入力期間の不正は `error.code=INVALID_PERIOD` を含むエラー応答とし、GA4取得失敗時にもダミー集計値で代用しません。個人識別情報、認証情報、例外スタックは応答に含めません。
