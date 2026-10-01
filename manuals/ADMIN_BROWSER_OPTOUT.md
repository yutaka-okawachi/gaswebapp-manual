# 管理者ブラウザの解析・通知・検索履歴オプトアウト

## 有効化

サイトを確認する端末・ブラウザで，次のURLを開きます．

https://yutaka-okawachi.github.io/gaswebapp-manual/index.html?admin=1

管理者モードではGA4解析・検索通知・検索履歴送信を抑止します．通常の表示は「管理者モード：解析・検索記録 OFF」です．ただし，同じタブで未登録語候補の観測をONにしていた場合，`admin=1` だけではその設定は解除されません．候補観測も確実にOFFにする場合は，下記の `admin=1&candidate_observe=0` を使用します．

## 未登録語候補のみONに切り替える

次のURLで，画像の「管理者モード：解析・通知・検索履歴 OFF／未登録語候補のみ ON」に切り替えられます（画面では改行して表示されます）．

https://yutaka-okawachi.github.io/gaswebapp-manual/index.html?admin=1&candidate_observe=1

`admin=1` で管理者モードを有効にし，`candidate_observe=1` で未登録語候補の観測だけを許可します．GA4解析・検索通知・検索履歴送信はOFFのままです．同じタブでGM・RS・RWの「用語から検索」へ移動して利用します．候補になるのは，検索結果が1件以上あり，検索語が辞書見出し・登録済み関連語形にない場合です．すべての検索語を候補として記録する設定ではありません．

管理者モードを維持して，候補観測もOFFに戻すURL：

https://yutaka-okawachi.github.io/gaswebapp-manual/index.html?admin=1&candidate_observe=0

管理者モード自体を解除するURL：

https://yutaka-okawachi.github.io/gaswebapp-manual/index.html?admin=0

`admin=0` は候補観測ONの設定も解除します．以後は通常利用時の解析・通知・検索履歴送信の対象に戻ります．

## URL早見表

以下のパラメータを `https://yutaka-okawachi.github.io/gaswebapp-manual/index.html` の後に付けます．

| 目的 | URLパラメータ | 未登録語候補の観測 |
| --- | --- | --- |
| 管理者モードを有効化 | `?admin=1` | 既定はOFF．同じタブの既存設定は保持 |
| 管理者モードで未登録語候補のみON | `?admin=1&candidate_observe=1` | ON |
| 管理者モードで候補観測もOFF | `?admin=1&candidate_observe=0` | OFF |
| 管理者モードを解除 | `?admin=0` | 管理者向けの候補観測ON設定も解除 |

管理者モードが既に有効な場合は，`?candidate_observe=1` / `?candidate_observe=0` だけでも候補観測を切り替えられます．管理者モードが無効な状態では，`candidate_observe=1` だけで有効化することはできません．`admin=0` と併記した場合は解除が優先されます．

## 設定が適用される範囲と確認

- 現在の `index.html` は切替処理を行う `mahler-search-app/js/analytics.js` を読み込んでいます．`/gaswebapp-manual/?admin=1&candidate_observe=1` や `/gaswebapp-manual/mahler-search-app/mahler.html?admin=1&candidate_observe=1` でも設定できます．クエリはフォルダ階層に設定するものではなく，開いたページの処理が読み取ります．
- 管理者モードは `localStorage` の `gmt_admin_device_optout` に保存されます．同一オリジン（`https://yutaka-okawachi.github.io`）の同じブラウザ・プロファイルで共有され，本サイトの対応ページへ通常のURLで移動しても有効です．別の端末やブラウザには引き継がれません．
- 候補観測ONは `sessionStorage` の `gmt_admin_candidate_observation` に保存され，同じタブのセッションで保持されます．恒久設定ではありません．新しいタブやセッションでは表示を確認し，必要なら上記URLで設定してください．
- ストレージが利用できない場合は設定を保持できません．サイトデータの削除後も含め，右下の表示を確認してください．
- このモードは認証・認可ではありません．検索通知・検索履歴の抑止は本サイトの通常の検索送信経路に対するもので，全経路の記録を禁止するサーバー側のアクセス制御ではありません．

端末別の設定や詳しい説明は [開発者ガイド](DEVELOPER_GUIDE.md) の「管理者」関連節も参照してください．
