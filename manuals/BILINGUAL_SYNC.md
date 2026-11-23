# 日英統合同期

> 日英出力の技術契約です。運用の読む順番は[マニュアル入口](README.md)、実行モード・公開・復旧の正本は[日常保守](DEVELOPER_GUIDE.md)です。記譜の現行対応一覧・追加手順は[譜例トークン](SCORE_EXAMPLE_TOKENS.md)に集約しています。英語公開ゲートは現行設定で有効です。現在の公開状態は同期結果で確認します。

## 現行の運用

現在のリポジトリでは `scripts/english-publication.json` の `publishEnglish` と `englishReleaseApproved` がともに `true` で、日本語と英語を通常同期の公開対象にしています。シート更新は `.\sync-data.ps1 -Mode Data` で同じ取得分から反映します。英語版だけのために旧英訳作業機能や初回公開手順を再実行する必要はありません。

現行のダッシュボードAPIはschemaVersion 9で、全体・日本語・英語の選択と13論理ページを扱います。契約と検査は[ダッシュボードマニュアル](DASHBOARD_GUIDE.md#日本語版英語版の切替schemaversion-9)を参照してください。実際の公開完了は同期のreceipt・対象コミット・Pages・API検査で確認します。

## 一回の取得から生成

`src/export_json.js` は見出し名で列を解決し、9タブを各一回だけ読み取った同じ値から従来の日本語58生成物と英語入力を返します。英語入力は `includeEnglish:true` を指定した認証済みexportSnapshotだけに付与します。`src/web_trigger.js` は無認証GET/POST・dashboardへこの入力を出しません。ja_old・レビュー列は入力投影から除きます。

`scripts/sync/bilingual.js` はrequestId/sourceHash、行数、元のドイツ語・日本語・位置情報、語形対応を検証し、応答内の補助データだけで日英の検索JSON・辞書・実例を生成します。英語本文はen、対象はwhom_enで、日本語fallbackは使いません。元のde/de_normalizedの改行・句読点・IDは保存し、検索時だけ空白を正規化します。

辞書ページの収録項目数は、見出しのある掲載項目を生成時に数えます。GMの検索条件欄では、選択した作品・楽器とオーケストラ全体への指示を含めるかどうかをページの言語で表示します。

RW・RSの指示対象は、日英ともオーケストラ、舞台指示の順に上部へまとめ、登場人物との間に区切り線を表示します。英語版の項目名は `Orchestra`・`Stage directions` です。Mottlの注記は `scripts/english-phrases.json` で `Includes directions by Felix Mottl.` に訳し、日本語版と同じ作品・位置に表示します。

Auto・Data・Allは保留公開の確認成功後も最新シート取得へ続行します。Verify・Siteは取得を伴わない再開の意味を維持します。工程・検査ごとの安全な時間記録を追加しており、全ローカル検査・同一取得の日英照合・語形対応・補助データ・公開実体検証は省略しません。実行手順と記録項目は[日常保守](DEVELOPER_GUIDE.md)を参照してください。

## Notesの編集とシート正本

Notes・GM・RW・RSの現在値を同一取得の日英同期入力に使います。Notesは見出しのある行を対象にし、公開管理記録・旧公開許可一覧・承認ハッシュでは選別しません。既存項目の出典空欄も保持します。語形対応等の補助データにも同じシート正本の方針を適用し、対応先の存在・競合や日英生成物の検査は維持します。

既存本文・出典は対象セルで直接修正できます。新しいNotesは日常保守メニューで日英本文・出典を確認してから一括登録し、登録前の案はシートへ書き込みません。登録再開用IDは二重登録防止だけに使い、公開条件や出力には含めません。保守用の候補記帳と台帳は廃止し，語を直接入力する方式を使います。

空欄補完ダイアログは、確認した生成案を空欄へ保存する機能で、入力済み本文を上書きしません。手入力ガードは警告であり、既存セルの編集や同期対象を制限しません。操作は[マニュアル入口](README.md#editing-workflow)と[日常保守（操作早見）](DAILY_MAINTENANCE.md)を参照してください。シート保存とサイト公開は別で、公開反映にはData同期が必要です。

## Synopsis PDFリンク

認証付き日英snapshotは、存在する場合に `synopsis` タブを追加で一回読み取ります。契約は A=作品略称、B=日本語PDF、C=英語PDF、データ行2～29（RS15・RW13、overview除外）です。これは既存の主要タブの見出し名解決とは別の、明示されたA:C位置契約です。B/CはGoogle DriveのPDF閲覧URLを使います。リンクの公開権限・ダウンロード等制限はDrive側で別途確認します。

一覧は日英で同じ作品順・配置・別タブ導線を使い、日本語はB、英語はCへリンクします。検索結果のSynopsisも同じ作品対応を使います。同じ日本語PDFを共有するウムラウト表記やTannhäuserの版違いも同一の対応へ結びます。C空欄時は日本語PDFへfallbackせず、英語一覧は準備中、英語検索結果はSynopsisリンクなしとします。synopsis向けJapanese only注記は除き、未翻訳のショスタコーヴィチ・エッセイ等の注記は維持します。

生成元は `scripts/synopsis-links.js`、`scripts/build-site.js`、`scripts/sync/bilingual.js` です。C列は日本語公開JSONへ入れず、認証snapshotと英語生成物でのみ使用します。通常sync-dataは新しい取得から、サイトのみの再生成は同一取得キャッシュからリンクを再生成します。古いsnapshotにはCがないため、英語リンクは生成しません。

キャッシュのないCIでは、コミット済みの日本語 `score_metadata.js` からB列リンクだけを承継し、それ以外の楽譜情報は現在の `frontend/score-metadata.js` を使います。キャッシュの有無にかかわらず同じ形式で生成し、B列が将来更新された場合もCIで旧リンクに戻しません。認証付きsnapshotがある通常同期では、その取得時のB列を優先します。英語C列をこの日本語投影へ含めません。

## Notesの参照譜リンク

Notesの日英本文にある楽譜参照ラベルはシートを正本とし，元の印刷頁とURLを保ったまま，ファイル先頭から数えた通し頁を日本語では「PDF ○頁」，英語では「PDF p. N」と記します。既存PNGへの参照は画像と明記します。サイト側で頁ラベルを重ねて追加しません。

Notesの参照譜は実PDFの #page=N へ直接リンクします。同じ資料のPDF引用・参照譜表示は情報を保持して統合し，別文献は残します。URL未確定の参照譜は文字のままです。独自画像ビューア・別画像ボタンと，追加していたPDF設定ヘルプは表示しません。端末のダウンロード設定は変更しません。

生成元は `src/generate_dic_html.js` と `src/dictionary_notation.js`，回帰検査は `node scripts/test-notes-pdf-guide.js` と `node scripts/test-notes-reference-layout.js` です。既存の本文・資料URL・譜例・帰還リンクを維持します。新しい楽譜画像・PDF・ビューアは追加せず，保存済みの画像ファイルと台帳は保持します。Duett／Bruckner第5番など権利・範囲未確認の新画像は公開対象に含めません。

## 非公開の境界

`scripts/english-publication.json` のpublishEnglishとenglishReleaseApprovedが両方trueの場合だけ英語を公開対象にできます。現行設定は両方trueです。一方だけtrue、不明なキー、同期途中の設定変更は停止します。.sync-stateキャッシュは常にGit対象外です。ゲート閉鎖中の英語出力先はGit対象外の `.sync-state/english/<buildHash>/` であり、公開enディレクトリは作りません。

公開ディレクトリ、Gitの追加許可、release manifest、未完了公開の再開経路でも英語公開ゲートを検査します。閉じた状態でenファイルや非公開パスが混入した場合は停止します。公開日本語HTMLには未公開英語へのリンクを入れません。

## 再開と22ファイルの廃止

非公開キャッシュは取得内容と入力・生成ハッシュを検証して保存します。サイトだけの変更ではキャッシュから英語を再生成し、日本語の現在ファイルと一致しない古い取得分は拒否します。公開再開では保存済みmanifest、HEAD、ゲート、GAS編集版を再確認します。新規取得やGAS更新を無条件で繰り返しません。

`scripts/sync/retirement-policy.js` は `english-retirement-20261020.json` に固定した22ファイルだけを名前・型・正規化SHA-256・プロジェクトハッシュ・基準commit・公開版1668で検証します。未知の削除、変更された遠隔コード、部分削除は拒否し、一般の削除検出は無効化しません。

## 非破壊検証

`scripts/check-local.js` は `scripts/test-*.js` を列挙してすべて実行し、PowerShellのAPI検査も実行します。実Google/Git公開操作はスタブ化します。ローカル検査だけでは本番接続や公開済みファイルの一致は確認できません。

- `test-bilingual-sync.js`：各タブ一回取得、従来日本語出力互換、並べ替え、同一取得の結合、別取得・改変の拒否、非公開ステージ、ゲートとキャッシュ再生成。
- `test-bilingual-privacy.js`：無認証応答、英語入力の明示認証、ログ、日本語公開項目、Git/manifest/公開ディレクトリからの漏れ拒否。
- `test-bilingual-dry-run.js`：dry-run中のファイル変更・ネットワーク・プロセス/Git呼び出しを禁止して検証。
- `test-sync-flow.js`：失敗・再開順序、同期途中のゲート変更、英語入り未完了公開をゲート閉鎖時に送信しないこと。
- `test-gas-head.js`、`test-gas-retirement-policy.js`：GAS HEAD 照合および廃止ガード検査。

明示dry-runは `node scripts/dry-run-bilingual.js --snapshot=<非公開snapshot.json>` です。既存JSON入力を検証し、生成予定をメモリーで計算して結果を標準出力へ返します。通常同期の入口は呼びません。入力JSONは認証応答と同じ契約が必要で、公開フォルダーやGitへ置きません。

## 検索通知・検索履歴の言語対応

英語版の検索通知・検索履歴・日英集計では、通知で JA/EN を区別し、既知のページ・型・長さ・言語の矛盾を検証します。既存履歴は列名で解決し、Language列がなければ最初の通常記録時に右端へ追加します。既存の履歴行を補完・書換えしません。欠落言語は従来互換のjaです。完全一致payloadの短時間重複だけをハッシュ＋CacheService＋LockServiceで抑制し、別の検索や別言語は抑制しません。履歴保存失敗時は通知しません。メール失敗時は保存済み履歴と重複キーを保持します。ユーザーPCの既存オプトアウトは日英共通でGA4・通知・履歴記入を止めます。プレビューとテストは実履歴記入・通知・GA4を送信しません。

## ダッシュボードの言語区分

現行APIはschemaVersion 9で、`language=all|ja|en` を受け付け、`selectedLanguage` を返します。`languageSummary` のbasisはsite-page-path、rowsはja/en/unknownの3区分でviews/searches/withResults/noResults/exampleClicksを返します。ブラウザ言語を表示言語として使いません。日英を同じ13論理ページ（主要11・補助2）へ集約し、旧応答で未対応の言語別情報を0と捏造しません。認証・互換性・日別/週別の件数は[ダッシュボードマニュアル](DASHBOARD_GUIDE.md)を参照してください。プレビューや模擬テストから実通知・人工検索履歴を送信しません。

## 公開URLと言語情報

既存のルート sitemap.xml を維持し、通常sync-dataで日本語14URLと英語14URLを管理します。転送専用のhome.htmlとindex.html別名は掲載しません。日英の正規ページは各言語の自己canonicalと、head内の相互hreflang（ja/en、自己参照を含む）を共通生成処理で付けます。英語公開ゲートが閉じている場合は、英語sitemap項目と相互リンクを生成しません。英語データだけの更新は対応する英語ページのlastmodを更新し、日本語の更新日を動かしません。

Googleの多言語ページ案内: https://developers.google.com/search/docs/specialty/international/localized-versions 。GSC登録・取得成功・インデックス採用はファイル公開とは別に確認します。

## 原文検証・同期取得判定・通信再試行

- Sheet の A/`de` を正本とし、`de_normalized` と B2 配列式はコード側から編集しません。英語生成前に GM 全行の `de`・`de_normalized` に日本語が混入していないかを一律検査し、日本語が残っていれば生成を停止します。
- `Auto` モードは `scripts/english-site.js`、`scripts/gm-original-validation.js`、`frontend/notation-contexts.js` の変更時にも最新の認証済みスナップショットを取得します。表示形状だけの変更では既存のキャッシュ経路を維持します。
- `clasp` 送信対象確認の失敗時は出力や秘密値を表示せず、180秒タイムアウト・コマンド欠落・終了コード・JSON不正を区別します。GAS の非 JSON 応答は HTTP 状態・安全な内容種別・固定分類だけを報告し、HTML本文・redirect query・認証情報をログへ出しません。認証画面・CAPTCHA・割当超過・実行時間超過の判定時は読取の再試行を停止します。
- 編集版・固定公開版・公開版内容の GET 確認は、HTTP 500/502/503/504 または既知の接続障害のみ最大3回（間隔0/1/3秒）まで再確認します。401/403/429・不正 JSON・対象や内容の不一致を再試行で無視せず、OAuth 更新を含む POST は再試行対象外とします。

## 譜例SVGの字形・ライセンスと英語版UI仕様

- 譜例・記号 SVG の現行対応範囲・トークン仕様・追加手順は[譜例トークン](SCORE_EXAMPLE_TOKENS.md)に集約しています。
- 音楽字形は Bravura 1.482 の輪郭（ライセンス：[Bravura-OFL.md](licenses/Bravura-OFL.md)）、文字字形は公式 URW Base35 NimbusRoman の輪郭（ライセンス：[NimbusRoman-LICENSE.md](licenses/NimbusRoman-LICENSE.md)）をインライン SVG へ埋め込み、実行時フォント取得や端末フォントに依存しません。ライセンス本文は該当 SVG の metadata にも同梱します。
- 英語トップページ（600px 以下）では Dictionary 見出しとボタンを縦に配置します（ボタンは `0.9rem`、左右 `12px`、最小高さ `44px`、カード幅以内で折り返し許可）。
- 英語辞書の数字・記号グループへのリンク表示は `Other` とし、移動先 `#letter-OTHER`・内部分類 `OTHER`・見出しの分類と並び順を維持します。
