# マニュアル一覧

このディレクトリには、本プロジェクトの運用・保守・引き継ぎに関するマニュアルが集約されています。
※秘密情報（パスワードやAPIトークン等）はここに記述せず、安全な手段で管理・共有してください。

---

## 1. [プロジェクト引き継ぎ・長期保守ガイド (SUCCESSOR_GUIDE.md)](SUCCESSOR_GUIDE.md)
* **対象者**: 前任者およびプロジェクトを引き継ぐ後継者（PC操作に詳しくない初心者を含みます）
* **主な内容**:
  * プロジェクト資産一覧（スプレッドシート、GAS、GitHub、Webサイト）
  * 初回セットアップ手順（`01_START_SUCCESSOR_SETUP.bat`）と日常同期手順（`02_RUN_SYNC.bat`）
  * 引き継ぎ時の権限共有・情報渡しチェックリスト
  * 長期保守・アカウント継承設定（Google 無効化管理ツール、GitHub Successor）
  * サイドバー・メニューの管理注意事項

---

## 2. [開発者・運用保守ガイド (DEVELOPER_GUIDE.md)](DEVELOPER_GUIDE.md)
* **対象者**: 開発者およびコマンドライン操作に慣れている保守管理者
* **主な内容**:
  * ローカル開発環境の構築（Node.js, Git, clasp, `.env`）
  * 同期スクリプト (`sync-data.ps1`) の動作仕様とトラブルシューティング
  * 管理者ダッシュボードの通常確認、API・画面変更、Sites公開、障害復旧
  * 楽譜情報（`score_metadata.js`）の更新手順
  * サイト運用（SEO、canonical設定、PageSpeed Insights パフォーマンス最適化方針）

---

## 3. [管理者ブラウザのアクセス解析・検索通知除外 (ADMIN_BROWSER_OPTOUT.md)](ADMIN_BROWSER_OPTOUT.md)
* **対象者**: 自分自身の閲覧・検索を利用統計から除外したいサイト管理者
* **主な内容**:
  * Android Chrome、PC Chrome、Microsoft Edge での管理者モード有効化
  * GA4、検索通知メール、スプレッドシート「検索履歴」の一括停止
  * `?admin=1` による設定、`?admin=0` による解除
  * ブラウザごとの設定範囲、動作確認、サイトデータ削除後の再設定

---

## 4. 設計仕様・計測仕様・開発履歴

* **[管理者ダッシュボード 指標・JSON仕様 (ADMIN_DASHBOARD_API_SPEC.md)](ADMIN_DASHBOARD_API_SPEC.md)**
  * 管理者向けアクセス分析ダッシュボードの集計期間、各指標の定義、APIレスポンスのJSONフォーマット初期仕様。
* **[GA4イベント計測仕様 (GA4_EVENT_SPEC.md)](GA4_EVENT_SPEC.md)**
  * サイト内の検索実行、用語集閲覧、実例クリック、移動などのGA4カスタムイベントパラメータ仕様。
* **[管理者ダッシュボード 開発タスク履歴 (ADMIN_DASHBOARD_TASKS.md)](ADMIN_DASHBOARD_TASKS.md)**
  * ダッシュボード開発・GAS安全化・公開作業のタスク一覧および作業履歴（過去経緯参照用）。

