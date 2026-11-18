# 管理者ブラウザの解析・検索記録除外

管理者モードはブラウザごとに設定する．以下を開くとGA4解析・検索通知・検索履歴送信を抑止する．

https://yutaka-okawachi.github.io/gaswebapp-manual/index.html?admin=1

表示は「管理者モード：解析・検索記録 OFF」になる．解除は同じブラウザで次を開く．

https://yutaka-okawachi.github.io/gaswebapp-manual/index.html?admin=0

保守用の未登録語候補を自動記帳する処理は廃止した．candidate_observeパラメータは使わない．必要な語は検索画面の文字選択でコピーし，スプレッドシートの「日常保守 → 用語を調べて登録・編集」へ入力する．[操作手順](DAILY_MAINTENANCE.md)を参照．
