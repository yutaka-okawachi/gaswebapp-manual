# 日英統合同期

更新日：2026-10-20。通常sync-dataによるGAS1669・日本語サイトの反映と同一取得の英語非公開生成は検証済みです。続く英語公開はユーザーの明示許可を受け、通知・履歴・ダッシュボードの言語対応を含む通常リリースとして進めます。公開完了は同期のreceipt・Pages・API検証結果で判定します。

## 一回の取得から生成

`src/export_json.js` は見出し名で列を解決し、9タブを各一回だけ読み取った同じ値から従来の日本語58生成物と英語入力を返します。英語入力は `includeEnglish:true` を指定した認証済みexportSnapshotだけに付与します。`src/web_trigger.js` は無認証GET/POST・dashboardへこの入力を出しません。ja_old・レビュー列は入力投影から除きます。

`scripts/sync/bilingual.js` はrequestId/sourceHash、行数、元のドイツ語・日本語・位置情報、語形対応を検証し、応答内の補助データだけで日英の検索JSON・辞書・実例を生成します。英語本文はen、対象はwhom_enで、日本語fallbackは使いません。元のde/de_normalizedの改行・句読点・IDは保存し、検索時だけ空白を正規化します。

## Synopsis PDFリンク（2026-10-22）

認証付き日英snapshotは、存在する場合に `synopsis` タブを追加で一回読み取ります。契約は A=作品略称、B=日本語PDF、C=英語PDF、データ行2～29（RS15・RW13、overview除外）です。これは既存の主要タブの見出し名解決とは別の、明示されたA:C位置契約です。B/CはGoogle DriveのPDF閲覧URLを使います。リンクの公開権限・ダウンロード等制限はDrive側で別途確認します。

一覧は日英で同じ作品順・配置・別タブ導線を使い、日本語はB、英語はCへリンクします。検索結果のSynopsisも同じ作品対応を使います。同じ日本語PDFを共有するウムラウト表記やTannhäuserの版違いも同一の対応へ結びます。C空欄時は日本語PDFへfallbackせず、英語一覧は準備中、英語検索結果はSynopsisリンクなしとします。synopsis向けJapanese only注記は除き、未翻訳のショスタコーヴィチ・エッセイ等の注記は維持します。

生成元は `scripts/synopsis-links.js`、`scripts/build-site.js`、`scripts/sync/bilingual.js` です。C列は日本語公開JSONへ入れず、認証snapshotと英語生成物でのみ使用します。通常sync-dataは新しい取得から、サイトのみの再生成は同一取得キャッシュからリンクを再生成します。古いsnapshotにはCがないため、英語リンクは生成しません。新しいGAS exporterの反映とC列の完成後にデータを再取得する必要があります。

## 非公開の境界

`scripts/english-publication.json` のpublishEnglishとenglishReleaseApprovedは英語公開時にともにtrueへ変更します。両方trueの場合だけ英語を公開対象にできます。一方だけtrue、不明なキー、同期途中の設定変更は停止します。.sync-stateキャッシュは常にGit対象外です。ゲート閉鎖中の英語出力先はGit対象外の `.sync-state/english/<buildHash>/` であり、公開enディレクトリは作りません。

公開ディレクトリ、Gitの追加許可、release manifest、未完了公開の再開経路でも英語公開ゲートを検査します。閉じた状態でenファイルや非公開パスが混入した場合は停止します。公開日本語HTMLには未公開英語へのリンクを入れません。英語公開は2026-10-20に明示許可済みです。

## 再開と22ファイルの廃止

非公開キャッシュは取得内容と入力・生成ハッシュを検証して保存します。サイトだけの変更ではキャッシュから英語を再生成し、日本語の現在ファイルと一致しない古い取得分は拒否します。公開再開では保存済みmanifest、HEAD、ゲート、GAS編集版を再確認します。新規取得やGAS更新を無条件で繰り返しません。

`scripts/sync/retirement-policy.js` は `english-retirement-20261020.json` に固定した22ファイルだけを名前・型・正規化SHA-256・プロジェクトハッシュ・基準commit・公開版1668で検証します。未知の削除、変更された遠隔コード、部分削除は拒否し、一般の削除検出は無効化しません。読取専用の実GAS照合は2026-10-20 09:38 UTCに成功し、編集版40/公開版1668の40/ローカル18の差が許可対象と一致しました。

## 非破壊検証

- `node scripts/check-local.js`：既存を含む37本のJavaScriptテストとPowerShell API検査が成功。実Google/Git公開操作はスタブ化します。
- `test-bilingual-sync.js`：各タブ一回取得、従来日本語出力互換、並べ替え、同一取得の結合、別取得・改変の拒否、非公開ステージ、ゲートとキャッシュ再生成。
- `test-bilingual-privacy.js`：無認証応答、英語入力の明示認証、ログ、日本語公開項目、Git/manifest/公開ディレクトリからの漏れ拒否。
- `test-bilingual-dry-run.js`：dry-run中のファイル変更・ネットワーク・プロセス/Git呼び出しを禁止して検証。
- `test-sync-flow.js`：失敗・再開順序、同期途中のゲート変更、英語入り未完了公開をゲート閉鎖時に送信しないこと。
- `test-gas-head.js`相当の既存ガード58ケースと `test-gas-retirement-policy.js` の24ケース。

明示dry-runは `node scripts/dry-run-bilingual.js --snapshot=<非公開snapshot.json>` です。既存JSON入力を検証し、生成予定をメモリーで計算して結果を標準出力へ返します。通常同期の入口は呼びません。入力JSONは認証応答と同じ契約が必要で、公開フォルダーやGitへ置きません。

全量オフライン検証では08:37 UTC取得の4主タブ14,794行とローカル補助データを模擬Spreadsheetへ与え、現行GAS exporterから一回の模擬応答を生成しました。日本語58・英語82ファイル、表示対象14,497行、未翻訳UI 0、各9タブ読取1回、dry-run中の書込・通信・Git・deploy 0を確認しました。これは新しい実GAS応答や実同期の成功を意味しません。テスト用JSONと結果は作業フォルダーの非公開領域に保管しています。

## 次の運用確認と未確認

通常同期の初回実運用では固定公開版1669・編集版・ローカル18ファイルの一致、日英同一requestId/sourceHash、日本語58生成物、英語82ファイルの非公開生成、Pagesと7/30/90/180日APIの成功を確認しました。旧22ファイルは厳格な廃止manifestに一致するものだけを除去しました。今回の通知・履歴・集計変更は次の通常同期で必要なGAS更新とともに反映します。実シート移動後の手動保存と、全所有者のトリガー列挙は未確認です。

英語版の検索通知・検索履歴・日英集計を実装しました。通知はJA/ENを区別し、既知のページ・型・長さ・言語の矛盾を検証します。既存履歴は列名で解決し、Language列がなければ最初の通常記録時に右端へ追加します。既存の履歴行を補完・書換えしません。欠落言語は従来互換のjaです。完全一致payloadの短時間重複だけをハッシュ＋CacheService＋LockServiceで抑制し、別の検索や別言語は抑制しません。履歴保存失敗時は通知しません。メール失敗時は保存済み履歴と重複キーを保持します。ユーザーPCの既存オプトアウトは日英共通でGA4・通知・履歴記入を止めます。プレビューとテストは実履歴記入・通知・GA4を送信しません。

## ダッシュボードの言語区分

API schemaVersion 8を維持し、任意のlanguageSummaryを追加します。basisはsite-page-path、rowsはja/en/unknownの3区分でviews/searches/withResults/noResults/exampleClicksを返します。ブラウザ言語を表示言語として使いません。英語ページを既存の11論理ページへ畳み込んだ総計も維持します。APIの言語別情報がない旧応答では画面に未対応を明示し、0と捏造しません。実通知・人工検索履歴での本番試験は行いません。

## 公開URLと言語情報（2026-10-20）

既存のルート sitemap.xml を維持し、通常sync-dataで日本語14URLと英語14URLを管理します。転送専用のhome.htmlとindex.html別名は掲載しません。日英の正規ページは各言語の自己canonicalと、head内の相互hreflang（ja/en、自己参照を含む）を共通生成処理で付けます。英語公開ゲートが閉じている場合は、英語sitemap項目と相互リンクを生成しません。英語データだけの更新は対応する英語ページのlastmodを更新し、日本語の更新日を動かしません。

Googleの多言語ページ案内: https://developers.google.com/search/docs/specialty/international/localized-versions 。GSC登録・取得成功・インデックス採用はファイル公開とは別に確認します。
