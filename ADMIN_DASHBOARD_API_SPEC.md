# 管理者向けアクセス分析ダッシュボード 指標・JSON仕様案

## 文書の位置づけ

- 作成日: 2026-07-26
- 対象: 「ドイツ語の音楽用語」利用状況ダッシュボード
- 状態: Gate A 確認待ち
- この文書は指標とAPI契約を定めるものであり、GA4・GAS・公開サイトはまだ変更しない。

## 1. 集計期間

- `period` は `7`、`30`、`90`、`180` のいずれかだけを受け付ける。
- 終了日はGA4プロパティのタイムゾーンにおける当日とする。
- 開始日は当日を含めて `period` 日前ではなく、`period - 1` 日前とする。
- `daily` は期間内の全日を古い日から順に返す。
- データがない日も省略せず、各値を `0` として返す。
- 日付境界はGA4プロパティとGASの双方を日本時間にそろえる。

## 2. 指標の定義

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

## 3. `source_page` の定義

- 検索イベントの `source_page` は「その検索操作を実行したページ」とする。
- 検索ページ移動イベントの `source_page` は「移動リンクをクリックしたページ」とする。
- 検索ページ移動イベントでは、移動先を別パラメータ `destination_page` に記録する。
- `document.referrer` や、その前に閲覧していたページを `source_page` に混在させない。
- 値はイベント発生時の `location.pathname` を基にし、次の規則で正規化する。
  - クエリ文字列とハッシュを含めない。
  - 先頭の `/` を含める。
  - ルート `/gaswebapp-manual/` を除き、末尾の `/` を除く。
  - 完全なURL、ホスト名、画面表示名は格納しない。

## 4. 用語別集計

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

### 訳語

- `Notes` シートのドイツ語見出しを同じ規則で正規化して照合する。
- 見つかった場合は、訳語欄の最初の空でない行を使用する。
- HTMLタグを除き、連続空白を1文字にまとめる。
- 80文字を超える場合は、79文字までに省略記号 `…` を付ける。
- 見つからない場合は `translation` を空文字 `""` とする。
- 訳語が空でも、その用語の検索数とページ内訳は返す。

## 5. ページ名と実在パス

`pages` は次の12ページを常にこの順で返す。対象期間の値がすべて0でも省略しない。

| `page` | `path` |
|---|---|
| HOME | `/gaswebapp-manual/` |
| 曲名と楽器等から選択 (GM) | `/gaswebapp-manual/mahler-search-app/mahler.html` |
| ドイツ語の音楽用語集 | `/gaswebapp-manual/mahler-search-app/dic.html` |
| 用語から検索 (GM) | `/gaswebapp-manual/mahler-search-app/terms_search.html` |
| 用語から検索 (RS) | `/gaswebapp-manual/mahler-search-app/rs_terms_search.html` |
| 用語から検索 (RW) | `/gaswebapp-manual/mahler-search-app/rw_terms_search.html` |
| 曲名から検索 (RS) | `/gaswebapp-manual/mahler-search-app/richard_strauss.html` |
| 曲名から検索 (RW) | `/gaswebapp-manual/mahler-search-app/richard_wagner.html` |
| あらすじ集 (RS) | `/gaswebapp-manual/mahler-search-app/rs_synopsis.html` |
| あらすじ集 (RW) | `/gaswebapp-manual/mahler-search-app/rw_synopsis.html` |
| 訳出についての覚書 | `/gaswebapp-manual/mahler-search-app/notes.html` |
| 作品・索引など | `/gaswebapp-manual/mahler-search-app/other.html` |

ページ別の帰属規則は次のとおりとする。

- `views`: そのパスの `page_view`
- `searchMoves`: そのパスを `source_page` とする `search_page_move`
- `searches`: そのパスを `source_page` とする検索イベント
- `exampleClicks`: そのパスを `source_page` とする `click_view_example`
- `topTerms`: そのパスで実行された用語検索の上位3件
- `source_page` 導入前の既存イベントは、GA4標準の `pagePath` が上記12パスの
  いずれかに完全一致する場合だけ、その値を検索元ページとして補完する。
- `source_page` と `pagePath` のどちらでも検索元を特定できない既存検索は、
  `search_type`（例: `gm_term`、`rs_term`、`rw_term`、各作曲家の作品検索形式）
  から対応する検索ページを補完する。

## 6. 並び順と件数上限

- `daily`: 日付昇順、件数は必ず `period` と同じ。
- `previous.daily`: 選択期間の直前に連続する同日数期間の日付昇順。
  件数は必ず `period` と同じ。
- `pages`: 上記ページ対応表の固定順、件数は12件。
- `pages[].topTerms`: 検索数降順、同数は正規化済み用語の昇順、最大3件。
- `dictionaryExampleMoves`: Wagner、Mahler、R. Straussの固定順、3件。
- `terms`: 検索数降順、同数は正規化済み用語の昇順、最大50件。
- `terms[].pages`: 検索数が1件以上のページだけを対象とし、検索数降順、同数はページ対応表の順。
- `terms` が50件を超える場合も、検索総数や日別・ページ別の合計値は切り詰めない。

## 7. 正常時JSON

既存ダッシュボードとの互換性を保つため、`daily`、`pages`、`terms` の構造は維持する。
検証と障害調査のため、トップレベルに `schemaVersion`、`period`、`range` を追加する。

```json
{
  "schemaVersion": 1,
  "period": 30,
  "updatedAt": "2026年7月26日 14:05",
  "range": {
    "startDate": "2026-06-27",
    "endDate": "2026-07-26"
  },
  "daily": [
    {
      "date": "7/26",
      "searches": 132,
      "views": 468,
      "exampleClicks": 61
    }
  ],
  "previous": {
    "range": {
      "startDate": "2026-05-28",
      "endDate": "2026-06-26"
    },
    "daily": [
      {
        "date": "6/26",
        "searches": 104,
        "views": 401,
        "exampleClicks": 48
      }
    ]
  },
  "pages": [
    {
      "page": "用語から検索 (GM)",
      "path": "/gaswebapp-manual/mahler-search-app/terms_search.html",
      "views": 1284,
      "searchMoves": 752,
      "searches": 398,
      "exampleClicks": 211,
      "topTerms": ["innig", "bewegt", "zart"]
    }
  ],
  "dictionaryExampleMoves": [
    {
      "composer": "Wagner",
      "path": "/gaswebapp-manual/mahler-search-app/rw_terms_search.html",
      "count": 21
    },
    {
      "composer": "Mahler",
      "path": "/gaswebapp-manual/mahler-search-app/terms_search.html",
      "count": 34
    },
    {
      "composer": "R. Strauss",
      "path": "/gaswebapp-manual/mahler-search-app/rs_terms_search.html",
      "count": 14
    }
  ],
  "terms": [
    {
      "term": "innig",
      "translation": "心をこめて",
      "searches": 84,
      "pages": [
        {
          "name": "用語から検索 (GM)",
          "count": 52
        }
      ]
    }
  ]
}
```

### 値の制約

- 集計値はすべて0以上の整数とする。
- `updatedAt` はGASが応答を生成した日本時間とする。
- `range.startDate` と `range.endDate` は `YYYY-MM-DD` とする。
- `daily[].date` はダッシュボード表示用の `M/D` とする。
- `previous.range` は選択期間の直前に連続する同日数期間とし、
  `previous.daily[]` は同じ並び位置の日を比較できるよう日付昇順で返す。
- クリック率と1日平均はJSONへ重複格納せず、合計値からダッシュボード側で算出する。
- 0件だった検索語の一覧、User Agent、クライアントID、個別利用者を識別できる値は返さない。

## 8. エラー時JSON

不正な期間など、利用者が修正できる入力エラーはHTTPレスポンスの制約内で次の形に統一する。

```json
{
  "error": {
    "code": "INVALID_PERIOD",
    "message": "period must be one of 7, 30, 90, 180"
  }
}
```

GA4 Data APIの失敗や設定不足も同じ `error` 構造を使い、集計値を装ったダミーデータは返さない。
内部の認証情報、スプレッドシートID、例外スタックは応答へ含めない。

## 9. Gate Aで確認する判断

次の4点を管理者確認後に確定し、それまでは計測コードへ進まない。

1. 「用語集の閲覧数」を `dic.html` だけの閲覧数とすること。
2. 実例クリック率の分母を同じ `dic.html` 閲覧数とすること。
3. `terms` を用語検索だけに限定し、上位100件まで返すこと。
4. `translation` は訳語欄の最初の空でない行を最大80文字で返し、見つからない場合は空文字とすること。
