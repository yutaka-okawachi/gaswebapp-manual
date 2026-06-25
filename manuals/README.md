# マニュアル一覧

このディレクトリには、プロジェクトの運用・保守に関するマニュアルが含まれています。
現在、`manuals` 配下の Markdown ファイルは GitHub 上で閲覧できる前提です。秘密情報そのものは書き込まないでください。

## プロジェクト全般
-   [**プロジェクト概要 / 更新手順 / トラブルシューティング**](../README.md): プロジェクトのルートにあるREADMEです。データの更新手順やよくあるエラーの対処法が記載されています。

## 継承
-   [**継承者の方へ - 最初に読むページ (SUCCESSOR_START_HERE.md)**](SUCCESSOR_START_HERE.md): PCに詳しくない後継者向けの最初の入口です。
-   [**継承情報チェックリスト (SUCCESSOR_INFO_CHECKLIST.md)**](SUCCESSOR_INFO_CHECKLIST.md): 前任者が後継者へ渡す情報と、事前に行う作業の整理表です。
-   [**長期保守・継承マニュアル (LEGACY_MAINTENANCE_GUIDE.md)**](LEGACY_MAINTENANCE_GUIDE.md): アカウント、権限、機密情報、長期保守の全体方針です。
-   [**継承者向け追加引き継ぎ資料 (ADDITIONAL_HANDOVER_NOTES.md)**](ADDITIONAL_HANDOVER_NOTES.md): あらすじ集追加に伴うシステム構成の変更点、サイドバーの二重管理注意点、`sync-data.ps1` の仕様解説、GSC/GA4に関する対応状況。

## 環境構築・運用
-   [**環境構築ガイド (SETUP_GUIDE.md)**](SETUP_GUIDE.md): ローカル環境の構築手順。`.env` の設定方法など。
-   [**データ同期ワークフロー (SYNC_WORKFLOW.md)**](SYNC_WORKFLOW.md): データ同期スクリプト (`sync-data.ps1`) の詳細な使用方法。
-   [**楽譜情報の更新手順 (UPDATE_SCORE_INFO.md)**](UPDATE_SCORE_INFO.md): 楽譜詳細情報やIMSLPリンクを修正・追加する際の手順。

## サイト運用
-   [**SEO運用ガイド (SEO_GUIDE.md)**](SEO_GUIDE.md): SEO設定（canonical、og:url、sitemap）の説明と新規ページ追加時の対応手順。
-   [**パフォーマンス改善ガイド (PERFORMANCE_GUIDE.md)**](PERFORMANCE_GUIDE.md): PageSpeed Insights の見方、LCP/TBT 改善時の注意点、Google Tag・フォント・CSSの運用方針。
