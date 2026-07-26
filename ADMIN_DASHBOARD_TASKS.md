# 管理者向けアクセス分析ダッシュボード 作業チェックリスト

## 作業の基準点

- 作業開始日: 2026-07-26
- 作業前ブランチ: `main`
- 作業前コミット: `8a89d6833fe9be8dc8b111faeea137b31ff387b3`
- 作業ブランチ: `codex/admin-dashboard-analytics`
- GAS・GA4・GitHub Pages・Sites は、各公開ゲートまで変更しない。
- `mahler-search-app/dic.html` と `mahler-search-app/data/` は生成物として扱い、直接の永続修正をしない。

### 作業前へ戻す基準

作業ブランチの変更が気に入らない場合は、`main` に戻れば作業前のコードへ戻れる。
公開後に問題が見つかった場合に備え、各公開前に対象コミット、GASデプロイID、Sitesバージョンを記録する。

---

## 0. 安全な作業環境

- [x] `gaswebapp-manual` の作業ツリーがクリーンであることを確認
- [x] `main` と `origin/main` が一致していることを確認
- [x] 作業前コミットを記録
- [x] 専用ブランチ `codex/admin-dashboard-analytics` を作成
- [x] ダッシュボード側プロジェクトの現状を基準コミットまたは復元可能なスナップショットとして保存
- [x] ダッシュボード側の全ファイルが未追跡である状態を解消
- [x] 本作業で変更を許可するファイル一覧をフェーズごとに定義

## 1. 指標とJSON仕様の確定

- 仕様書案: [ADMIN_DASHBOARD_API_SPEC.md](ADMIN_DASHBOARD_API_SPEC.md)
- [x] `daily.views` を「用語集 `dic.html` の閲覧数」とする仕様案を作成
- [x] 実例クリック率を `click_view_example / dic.htmlの閲覧数` と定義
- [x] `source_page` を「検索を実行したページ」と定義
- [x] 検索ページへ移動する前のページは、移動イベント側の `source_page` として分離
- [x] 検索総数を `view_search_results + search_no_results` と定義
- [x] ページ名と実在パスの対応表を確定
- [x] `translation` が見つからない検索語は空文字とする仕様案を作成
- [x] JSONの件数上限と並び順を確定

### 確認ゲート A

- [x] 管理者が指標・用語・JSON仕様を確認（2026-07-26）
- [x] 確認完了まで計測コードを変更しなかった

## 2. `sync-data.ps1` とGASデプロイの安全強化

- [x] `.env` の既存GASデプロイIDだけを更新するようにする
- [x] デプロイIDが見つからない場合は安全停止する
- [x] 別のデプロイを自動選択するフォールバックを廃止
- [x] 通常同期で新規デプロイを自動作成しない
- [x] `manage_deploy.js` がデプロイ失敗を終了コードで返すようにする
- [x] `update_env.js` が「最新版」ではなく固定デプロイIDを参照するようにする
- [x] `sync-data.ps1` がGASデプロイ完了を確認してから次へ進むようにする
- [x] `git add .` に依存せず、許可リストに含まれるパスだけをステージする
- [x] 生成物がローカルソースコミットに入らないことを自動検査
- [x] 想定外の変更があれば、コミット・GAS出力・pull前に安全停止
- [ ] 既存の通常同期を壊していないことを非公開状態で検証

### 確認ゲート B

- [x] 変更差分と安全停止条件を管理者が確認（2026-07-26）
- [x] 確認完了まで `sync-data.ps1` を実運用モードで実行しなかった

## 3. GA4イベント計測

- 計測仕様: [GA4_EVENT_SPEC.md](GA4_EVENT_SPEC.md)
- [x] 現在の `view_search_results` / `search_no_results` の送信箇所をテストで固定
- [x] 検索イベントへ `source_page` を追加
- [x] `search_page_move` イベントを追加
- [x] `search_page_move` に `source_page` を追加
- [x] `search_page_move` に `destination_page` を追加
- [x] `?q=` がある移動では、`search_page_move` のパラメータとしてだけ `search_term` を追加
- [x] リンククリック時には `view_search_results` / `search_no_results` を送らない
- [x] 拡張計測の「サイト内検索」を無効化し、設定を保存（2026-07-26）
- [x] リンク種別を区別する `link_type` を追加
- [x] `click_view_example` の現行動作を維持
- [x] `click_view_example` へ `source_page` を追加
- [x] 無効入力・中止・失敗検索ではイベントを送らない
- [x] 0件検索では `search_no_results` を残す
- [x] 静的ページとGASテンプレートの双方を整合させる
- [x] 用語集の変更は `src/generate_dic_html.js` に入れる
- [x] イベント送信失敗が検索・リンク移動を妨げないことを確認

### 確認ゲート C

- [x] コード差分とイベント一覧を管理者が確認（2026-07-26）
- [x] 確認完了までGAS・GitHub Pagesへ公開しなかった

## 4. GA4管理画面の手動設定

- [x] `search_type` はイベントスコープ、イベントパラメータ `search_type` で登録済み
- [x] `composer` はイベントスコープ、イベントパラメータ `composer` で登録済み
- [x] `result_count` はイベントスコープのカスタム指標として登録済み
- [x] `source_page` をイベントスコープのカスタムディメンションとして追加（2026-07-26）
- [x] `destination_page` をイベントスコープのカスタムディメンションとして追加（2026-07-26）
- [x] `link_type` をイベントスコープのカスタムディメンションとして追加（2026-07-26）
- [x] `term` は表示名 `term_toggle`、イベントスコープ、イベントパラメータ `term` で登録済み
- [x] `search_term` は標準ディメンション `searchTerm` を利用するため重複登録しない
- [x] 拡張計測の「サイト内検索」が無効であり、保存済みであることを確認
- [x] データ保持期間を確認（イベントデータ・ユーザーデータともに14か月、ユーザーアクティビティ時のリセット有効、2026-07-26）
- [x] GAS実行アカウントが対象GA4プロパティの管理者であることを確認（2026-07-26）
- [x] GA4プロパティID `471296729` を確認（2026-07-26）

## 5. GAS Analytics Data API

- [x] Analytics Data 高度なサービスをマニフェストへ追加
- [x] 必要な読み取り専用OAuthスコープを追加
- [x] Script Properties の `GA4_PROPERTY_ID` を利用する
- [x] GAS管理画面のScript Propertiesに `GA4_PROPERTY_ID=471296729` を設定（2026-07-26）
- [x] `period=7/30/90/180` だけを許可
- [x] ダッシュボードAPI用GETルートを追加
- [x] ダッシュボードAPI用POSTルートを追加
- [x] 日別の検索数・閲覧数・実例クリック数を集計
- [x] ページ別の閲覧数・検索数・実例クリック数・検索ページ移動数を集計
- [x] 検索語と検索元ページの組み合わせを集計
- [x] 用語別検索回数とページ内訳を集計
- [x] `Notes` シートから訳語を補完
- [x] 個人情報・UserAgent・検索履歴の詳細本文をJSONへ含めない
- [x] 0件検索語一覧をJSONへ含めない
- [x] `CacheService` で5分間キャッシュ
- [x] エラー時のJSON形式を固定
- [x] APIを公開集計値だけに限定

## 6. GAS APIのローカル検証

- [x] Data APIリクエストの構文を確認
- [x] 各ディメンション・メトリクスの互換性を確認
- [x] ダミー応答またはテスト関数でJSON変換を確認
- [x] 7日応答を検証
- [x] 30日応答を検証
- [x] 90日応答を検証
- [x] 180日応答を検証
- [x] データがない日を0件として補完
- [x] 日本時間の日付境界を確認
- [x] JSONの値が有限の数値であることを確認
- [x] `git diff --check` と構文検査を実施

### 確認ゲート D

- [x] GAS・API差分とテスト結果を管理者が確認（2026-07-26）
- [x] 確認完了までGASをデプロイしなかった

## 7. GAS・GitHub Pagesの限定公開作業

- [x] 公開直前に `git status --short` を再確認
- [x] 変更ファイルが許可リストと一致することを確認
- [x] 公開前コミットを記録
- [x] `sync-data.ps1` でGASソースを更新
- [x] 固定デプロイIDが維持されたことを確認
- [x] GAS Webアプリの更新を確認
- [x] `exportAllDataToJson` の成功を確認
- [x] 生成物がGASからGitHubへ更新されたことを確認
- [x] `pull --rebase` 後の履歴と作業ツリーを確認
- [x] GitHub Pages公開状態を確認
- [x] 未確認の項目を完了扱いにしない

## 8. GA4受信検証

- [x] オプトアウト拡張機能の影響を受けない環境を使用
- [x] `view_search_results` をRealtimeで確認
- [x] `search_no_results` をRealtimeで確認
- [x] `click_view_example` をRealtimeで確認
- [x] `search_page_move` をRealtimeで確認
- [ ] `source_page` と `destination_page` の値を確認
- [x] 二重計測がないことを確認
- [ ] 24～48時間後に通常レポート／Data APIで確認

## 9. `sync-data.ps1` のダッシュボードAPI検査

- [x] 同期後に固定GAS API URLを使用
- [x] 7日JSONを自動検査
- [x] 30日JSONを自動検査
- [x] 90日JSONを自動検査
- [x] 180日JSONを自動検査
- [x] 必須キーと配列を検査
- [x] HTMLや認証画面が返った場合は失敗扱い
- [x] API検査失敗とGitHub Pages更新結果を分けて表示
- [x] API検査失敗時に誤って全工程成功と表示しない
- [x] デプロイ直後の一時応答に対して最大3回再試行

## 10. ダッシュボード側の実データ接続

- [x] ダッシュボード側の基準コミットから専用ブランチを作成
- [x] `GAS_API_URL` を固定GAS APIへ設定
- [x] JSONのTypeScript型を確定
- [x] 応答値を実行時検証
- [x] ダミーパスを実在するパスへ修正
- [x] 読み込み中・失敗・空データ表示を確認
- [x] 実例クリック率の分母を確認
- [x] 7・30・90・180日の切替を確認
- [x] 棒グラフの表示を確認
- [x] PC幅とスマートフォン幅で確認
- [x] ローカルビルドとテストを実施

### 確認ゲート E

- [x] 実データを使った安全なプレビューを管理者が確認
- [x] 確認完了までSitesの新バージョンを公開しない

## 11. ダッシュボード公開

- [x] 公開前のダッシュボードコミットを記録
- [ ] 正確なソース状態からSitesバージョンを保存
- [ ] Sitesバージョン番号を記録
- [ ] 承認されたバージョンだけを公開
- [ ] 本番URLのアクセス制御を確認
- [ ] 本番URLで実データを確認
- [ ] GAS API URLや秘密情報が不適切に公開されていないことを確認

## 12. 最終運用確認

- [ ] 通常のスプレッドシート更新を一件用意
- [ ] `sync-data.ps1` を一度実行
- [ ] 用語サイトの生成データ更新を確認
- [ ] GASコード・固定URLの維持を確認
- [ ] ダッシュボードAPI検査の成功を確認
- [ ] ダッシュボード再公開なしで最新値が表示されることを確認
- [ ] 作業ツリーがクリーンであることを確認
- [ ] 復元手順と運用手順をマニュアルへ記載

---

## 作業記録

各フェーズ完了時に、次を追記する。

- 日時
- 完了したチェック項目
- 変更ファイル
- コミット
- 実施した検証
- 公開の有無
- 未確認事項
- 復元先

### 2026-07-26 フェーズ5～7・9

- 完了: GA4 Data API接続、7・30・90・180日JSON、GAS固定デプロイ、生成データ同期、GitHub Pages公開
- 変更: GAS集計API、GA4イベント、固定デプロイ更新、`sync-data.ps1` API検査と一時応答再試行
- 検証: `verifyDashboardAnalyticsAccess` 成功、4期間API成功、`exportAllDataToJson` 成功、GitHub Pages HTTP 200
- 公開: GAS固定URLとGitHub Pagesへ公開済み
- 未確認: GA4 Realtimeでの各イベント受信、24～48時間後の通常レポート、ダッシュボード側の実データ表示
- 復元先: 公開前承認コミット `2767b4f`、同期後コミット `a5753ff`

### 2026-07-26 フェーズ8（Realtime確認）

- 完了: `view_search_results`、`search_no_results`、`click_view_example`、`search_page_move` のRealtime受信
- 検証: 各テスト操作に対するイベント数が1であり、テスト範囲で二重計測なし
- 公開: 追加公開なし
- 未確認: `source_page`・`destination_page` の値、24～48時間後の通常レポート／Data API

### 2026-07-27 フェーズ10（ダッシュボード実データ接続）

- 完了: 固定GAS API接続、応答型・実行時検証、ダミーデータ経路の撤去、状態表示、4期間切替、棒グラフ、PC・スマートフォン幅
- 変更許可ファイル: `.gitignore`、`app/config.ts`、`app/dashboard-data.ts`、`app/globals.css`、`app/layout.tsx`、`app/page.tsx`、`eslint.config.mjs`、`tests/rendered-html.test.mjs`
- ダッシュボード基準コミット: `58db41f`
- ダッシュボード作業ブランチ: `codex/admin-dashboard-live-data`
- ダッシュボード実装コミット: `f588fca`
- 検証: `npm run lint`、`npm test`（2件成功）、`npm run build`、`git diff --check`
- ブラウザ検証: 7・30・90・180日の全期間で接続成功、日別バー7・30・90・180本、PC幅・390px幅、コンソールエラーなし
- 公開: Sitesへの保存・公開は未実施
- 未確認: 管理者によるプレビュー承認、Sites本番URL、`source_page`・`destination_page` の通常レポート値
- 復元先: ダッシュボード基準コミット `58db41f`

### 2026-07-27 確認ゲートE

- 管理者承認: 実データを使ったローカルプレビューを承認
- 承認対象: ダッシュボード実装コミット `f588fca`
- 公開前コミット: `f588fca`
- 承認前のSites保存・公開: なし
- 次工程: 承認済みコミットからSitesバージョンを保存し、本番公開後にURL・アクセス制御・実データ表示を確認

### 2026-07-27 フェーズ11（公開準備）

- 公開対象: 承認済みダッシュボードコミット `f588fca`
- ソース状態: ダッシュボード作業ツリーがクリーンで、承認済みコミットと一致
- ビルド成果物: Sites公式パッケージ手順で検査・アーカイブ作成に成功
- Sitesプロジェクト: 既存の `.openai/hosting.json` のプロジェクトIDを維持
- 公開: 未実施
- 保留理由: 現在のスレッドでSitesのバージョン保存・公開コネクタが利用できない
- 未確認: Sitesバージョン番号、本番URL、アクセス制御、本番での実データ表示
