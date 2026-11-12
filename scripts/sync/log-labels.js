'use strict';
// Display labels only. Timing records retain their fixed, machine-readable names.
const tasks = Object.freeze({
    run: '同期処理全体',
    build: 'サイトの表示用ファイルの生成',
    'gas-build': 'GASの同期用定義の生成',
    checks: 'すべてのローカル検査',
    'syntax-checks': 'JavaScriptの構文検査',
    'github-preflight': 'GitHubの認証・書込み権限・公開設定の確認',
    'remote-check': 'GitHub側の変更の確認',
    'gas-inspect': 'GASの公開版とローカルソースの照合',
    'gas-head-before': '更新前のGAS編集版と同期元の照合',
    'gas-ensure': 'GAS固定デプロイの確認・必要な更新',
    'snapshot-fetch': 'スプレッドシートから最新データの取得',
    'english-prepare': '英語版データの生成と日英の整合性検査',
    'english-stage': '検証済み英語版ファイルの保存',
    'data-install': '検証済みデータのローカルファイルへの反映',
    'final-build': '取得した最新データでサイトを再生成',
    'cached-build': '保存済みデータでサイトを再生成',
    'cached-english': '保存済みデータから英語版を再生成',
    'release-manifest': '公開ファイルのハッシュ一覧の生成',
    'gas-head-commit': 'コミット前のGAS編集版と同期元の再照合',
    'gas-head-push': 'GitHub送信前のGAS編集版と同期元の再照合',
    push: 'GitHubへの送信',
    'pages-verify': 'GitHub Pagesの公開待ち・全公開ファイルの照合',
    'dashboard-verify': 'ダッシュボードAPIの応答検査（7・30・90・180日）',
    'resume-verify': '前回未完了の公開確認の再開'
});
const stages = [
    '事前確認と環境検証',
    'サイト組み立てとローカル検証',
    '変更検知と同期計画の作成',
    'GASデプロイの確認・更新',
    'スプレッドシートのデータ取得と整合性検証',
    'GitHubへの送信',
    'GitHub Pagesの公開確認とダッシュボードAPI検査'
];
const modes = { Auto: '自動', Data: 'データ更新', All: '全体更新', Site: 'サイト更新', Check: 'ローカル確認', Verify: '公開確認の再開', Recover: 'データ復旧', Local: 'ローカル検証' };
const tests = Object.freeze({
    'analytics-initial-language': '初回表示言語ごとのアクセス計測と管理者の計測除外',
    'bilingual-dry-run': '日英同期の読取り専用検証で書込みが起きないこと',
    'bilingual-privacy': '日英の公開APIと非公開データの保護',
    'bilingual-sync': '同じ取得データからの日英生成と公開条件',
    'dashboard-analytics': 'ダッシュボードの集計処理',
    'dashboard-api-check': 'ダッシュボードAPI検査の判定処理',
    'dashboard-language-filter': '言語別の集計と重複除外',
    'dashboard-languages': 'ダッシュボードの日英利用状況の集計',
    'dashboard-translation-reads': 'ダッシュボードの訳語読取りと列移動への対応',
    'data-loader': '検索データの並行読込みと再試行',
    'dictionary-abbreviation-links': '用語集の略記リンク',
    'dictionary-candidate-wizard': '辞書登録画面の入力確認と失敗時の復旧',
    'dictionary-candidate-workflow': '辞書候補の確認・登録手順',
    'dictionary-example-fast-path': '用語集の実例検索と表示',
    'dictionary-example-return': '実例検索から用語集へ戻る操作',
    'dictionary-notation': '用語集の音楽記号と引用・リンクの保持',
    'empty-target-display': '指示対象が空欄の検索結果の表示',
    'english-citations': '英語版の原文引用と日本語混入の検出',
    'english-dynamic-ui': '検索後に更新される英語表示と画面移動',
    'english-site': '英語版のデータ・画面構成・公開条件',
    'english-workflow-retirement': '旧英訳処理の廃止と現行メニューの維持',
    'experimental-dictionary-preview': '辞書候補のプレビュー',
    'export-snapshot': 'GASのデータ生成結果と同期側の形式の一致',
    'gas-head': 'GAS編集版の未統合変更を検出する安全検査',
    'gas-response': 'GASの認証・制限・異常応答の判定',
    'gas-retirement-policy': 'GASコード廃止対象の照合と意図しない削除の防止',
    'gas-routing': 'GASのAPI振分けと公開サイトへの移動',
    'gas-sync': 'GASデプロイの反映待ちと再試行',
    'gm-notation': 'マーラーの音楽記号と検索表示',
    'gm-sync-plan': 'マーラーと英語版の更新時に最新データを取得する判定',
    'gm1550-example': 'マーラーの指定譜例の形状と表示条件',
    'legal-pages': '利用規約・プライバシー説明とフッター',
    'maintenance-ledger': '日常保守台帳の処理',
    'maintenance-model': '日常保守メニューと生成モデル設定の維持',
    'maintenance-sort': '日常保守の並べ替えとデータ保持',
    'maintenance-text-style': '辞書本文・訳文の書式と引用の保持',
    'maintenance-workbench': '日常保守画面の内容確認と登録前の書込み防止',
    'manage-deploy': 'GAS固定デプロイの管理処理',
    'morphology-survey-review': '完了済み語形調査の廃止と通常保守の維持',
    'mottl-note': 'モットルに関する注記の表示',
    'multiline-term-search': '改行を含む用語の検索と候補表示',
    'notation-completeness': '日英の各検索経路での音楽記号表示',
    'notation-contexts': '音楽記号を表示する文脈と適用範囲',
    'notes-dicht-score': 'dichtの譜例と日英の表示条件',
    'notes-english-layout': '用語集の英語本文の組版',
    'notes-english-public-output': '公開データへの内部用列の混入防止',
    'notes-entry-guard': '用語集への新規手入力の検知と既存編集の保持',
    'notes-glockenspiel': 'Glockenspielの譜例と音高・表示条件',
    'notes-pdf-guide': 'PDF資料への直接リンクと既存URLの保持',
    'notes-portamento': 'portamentoの譜例と原文・訳文の表示',
    'notes-publication': '用語集のシート現在値の反映と登録再開',
    'notes-reference-layout': '参考資料欄の組版と引用・URLの保持',
    'notes-references': '参考資料リンクの安全性と日英表示',
    'notes-score-viewer': '譜例の出典・公開条件・画像パス',
    'original-score-examples': '原文に含まれる譜例の形状と検索表示',
    'page-description-fonts': 'ページ説明文の文字サイズ',
    'public-request-security': '公開APIの入力検証と通知・履歴の保護',
    'result-source-links': '検索結果の出典リンクと安全な表示',
    'row-completion': '選択行の空欄補完と競合・重複書込みの防止',
    'rs-score-examples': '指定譜例の形状と日英の各検索経路での表示',
    'rw-rs-coverage': 'ワーグナー・R.シュトラウスの収録範囲の説明',
    'score-page-filter': 'スコアページによる絞込みと空欄の扱い',
    'score-token-sync': '譜例を表す記号の同期・日英生成・検索',
    'score-tokens': '譜例を表す記号の表示と安全な代替表示',
    'search-language-telemetry': '検索言語ごとの通知と履歴記録',
    'sheet-row-navigation': 'スプレッドシートの対象行への移動',
    'site-languages': '日英の言語切替とリンク先',
    'site-seo': '日英の検索エンジン向け設定とサイトマップ',
    'source-column-layout': 'シートの列移動と見出し名による読取り',
    'sync-flow': '同期の実行順序と中断後の再開',
    'sync-recovery': '隔離コピーでのデータ復旧と失敗時の巻戻し',
    'sync-timing': '同期の進捗表示・時間計測と秘密情報の保護',
    sync: '同期データ・公開処理・プレビューの安全性',
    'synopsis-links': 'あらすじPDFの日英リンクと作品別の対応',
    'synopsis-reproducibility': 'あらすじの再生成結果と最新リンクの保持',
    'term-highlight': '検索語の強調表示',
    'term-search-match-mode': '用語検索の部分一致・完全一致'
});
function taskLabel(name, mode) {
    const test = /^test:test-(.+)\.(js|ps1)$/.exec(name);
    if (test) return (tests[test[1]] || 'ローカル機能の検査') + '（' + name.slice(5) + '）';
    const stage = /^stage-([1-7])$/.exec(name);
    if (stage) return '工程' + stage[1] + '/7：' + stages[Number(stage[1]) - 1];
    return tasks[name] + (name === 'run' ? '（' + modes[mode] + 'モード）' : '');
}
const japanTime = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});
function timingLine(entry) {
    const status = entry.event === 'start' ? '実行中' : entry.status === 'success' ? '完了' : '失敗';
    const elapsed = entry.event === 'end' ? '（' + (entry.elapsedMs / 1000).toFixed(3) + '秒）' : '';
    return '[' + status + '] ' + japanTime.format(new Date(entry.at)) + ' ' + taskLabel(entry.name, entry.mode) + elapsed;
}
module.exports = { taskLabel, timingLine };
