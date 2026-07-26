# GA4イベント計測仕様

## 検索実行

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

## 検索ページへの移動

検索ページへのリンクをクリックした時点で `search_page_move` を1回送る。

パラメータ:

- `source_page`: リンクが置かれていたページ
- `destination_page`: 移動先の検索ページ
- `link_type`: `search_navigation`、`prefilled_search`、`example_search`
- `search_term`: 移動先URLに空でない `q` がある場合だけ追加

`search_term` は `search_page_move` の説明情報であり、イベントを追加発生させるものではない。
リンククリック時には `view_search_results` と `search_no_results` を送らない。
移動先で検索処理が完了した後にだけ、検索結果イベントを別途送る。

## 「実例を見る」

閉じている実例欄を開いた時点で `click_view_example` を1回送る。

パラメータ:

- `term`: 開いた用語
- `source_page`: 用語集ページ
- `page_path`: 既存データとの互換性のため当面維持

実例欄を閉じる操作では送らない。

## ページ閲覧

既存のGA4 `page_view` を利用する。独自のページ閲覧イベントは追加しない。

## 二重計測の防止

- `search_page_move` は検索実行数へ含めない。
- ダッシュボードの検索総数は、イベント名が
  `view_search_results` または `search_no_results` の行だけを集計する。
- GA4拡張計測の「サイト内検索」は無効にする。
- 拡張計測を無効にするまでは、`?q=` のあるページで自動生成される
  `view_search_results` と明示送信イベントが重複する可能性があるため公開しない。
- Realtime検証では、1回の操作について送信イベント名と回数を確認する。
