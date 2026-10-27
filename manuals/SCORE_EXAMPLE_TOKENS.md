# 譜例トークンの仕様と追加手順

## 文法と対象

`[[score:<id>]]` を de・ja・en の表示位置へ置きます。IDはASCII英小文字で始まる小文字・数字・ハイフン1〜96文字です。行番号を名前に使いません。HTMLやSVGをシートへ貼りません。

|対象|ID|deへの挿入|ja/enへの挿入|
|---|---|---|---|
|GM325|`mahler-trill-chain`|現行文末 `also so:` の後|現行全文の末尾|
|GM1550|`mahler-editorial-g2`|現行全文の末尾|現行全文の末尾|
|RS651|`feuersnot-desk-division`|`～ etc.`をトークンへ置換。etc.は画像に一度だけ表示|現行全文の末尾|
|RS782|`salome-timpani-layout`|現行全文の末尾。手の文字も維持|見出し＋トークンへ整理（下記）|
|Notes235（旧236）|`hindemith-glockenspiel-fsharp5`|`(の譜例)`だけを置換。Fisは維持|現行全文の末尾|

末尾追加では半角空白を一つ置きます。Notesの括弧位置は直接置換します。GM358/387の `[Notenbeispiel]` と日英対応トークンは今回変更せず、既存の変換を維持します。

## 登録と安全性

`src/dictionary_notation.js` の `SCORE_EXAMPLE_REGISTRY` が意味ID、描画種別、安定文脈を管理します。GMは使用箇所data、RSはOper/Aufzug/Szene/page、Notesは出典と原文の意味を表すprefixです。Notesの対象は `[H: KM1-1]` と `Ein Stab aus einem Glockenspiel` で、GMのキーには入りません。行の挿入・削除・並替えでは登録を変更しません。

トークンは指定位置でSVGへ置換し、同じIDが一つの欄に重複しても画像は一枚です。原文と訳文はそれぞれ独立した欄なので、各一枚を表示します。ID・文脈が不明なら壊れたimgを出さず、ID付きの説明（「譜例を表示できません」／「Score example unavailable」）を安全な文字列で表示します。未知IDの本文もXSSとして実行しません。

旧データ用の全文・文脈差込みも残します。トークンがある欄では旧差込みを重ねません。deだけ先に移行した場合も、旧訳文には文脈による一枚を表示します。全三列の移行前後・部分移行を検証します。

トークンは通常検索、候補の表示・値、辞書ID、実例シャードの照合、実例リンクの検索語、日英のde_normalized、辞書の構造化データから除外します。辞書の旧アンカーはトークンで変化しません。原文そのものの語句を編集する場合には、検索語やアンカーの変化を別途確認します。同期は元のde/ja/enトークンをJSONへ保持し、正規化値だけから除外します。

## 譜例を後から追加する手順

1. 原譜・採用見本を確認し、音高・音価・付点・声部・文字・透明性を確定します。登録だけで画像が自動生成されるわけではありません。
2. 意味を表す新IDを一つ決め、既存のSVG描画機構へ画像・日英の代替説明・必要な出典ライセンスを登録します。譜例の追加に物理行番号の条件は使いません。
3. `SCORE_EXAMPLE_REGISTRY` にIDと対象文脈を追加します。通常の演奏指示は `direction`、Notesの辞書項目は `dictionary` を使用します。新しい描画種別は既存の描画分岐または共通描画関数へ登録します。
4. 旧データ互換が必要なら、承認済みの旧表記だけに限定したフォールバックを追加します。原文の一般語や全作品への一括置換を行いません。
5. fixtureだけを使い、de/ja/enの任意位置、一枚表示、誤文脈・未知ID、XSS、行変更、検索・実例・静的/動的辞書、320pxを検証します。
6. コード公開の成功確認後に、担当writerがシートの三列を変更します。変更後はデータ取得を明示する同期を行い、日英公開値と画面を照合します。

## 今回の同期順と検証

先にトークン対応コードを公開します。この時点のシートは旧表記のままでよく、旧データ互換が働きます。公開成功を確認してから対象5件の三列をwriterが編集し、その後 `sync-data.ps1 -Mode Data` 等のデータ取得を伴う正規同期で反映します。旧公開コードが新トークンをそのまま表示しないよう、順序を逆にしません。今回はローカル準備だけで、シート編集・sync-data（Check含む）・commit・push・deployを行いません。

`node scripts/test-score-tokens.js`、`node scripts/test-notes-glockenspiel.js`、`node scripts/test-original-score-examples.js`、既存譜例・安全URLテストを実行します。全ローカル回帰は `node scripts/check-local.js` です。

## 文面QAによる挿入案の具体化

RS651のdeは `vielleicht pultweise derart zu teilen [[score:feuersnot-desk-division]]` とします。SVG内のetc.を保持し、本文で重ねません。レジストリのsearchTextに旧 `～ etc.` を持たせ、GASと英語出力のde_normalized・通常検索・実例シャード検索ではIDの代わりにこの検索表記を使います。旧全文・etc.による検索を維持し、表示には重ねません。通常の辞書ID・候補表示・構造化テキストではIDを除外します。

RS782のjaは `4つのティンパニの配置： [[score:salome-timpani-layout]]`、enは `Arrangement of the four timpani: [[score:salome-timpani-layout]]` とする案をfixtureで確認しました。deは左右手の実テキストを維持するのでその語での検索を保持します。代替説明にも `linke H. / l. H. / rechte H. / rechte Hand` を明記します。左右を示す2つの（譜例）を残して画像を二重に追加することはしません。シートの文面変更はwriterがコード公開後に担当します。

`node scripts/test-score-token-sync.js` は合成シートだけで一回読取のGAS出力と英語生成を実行し、生トークンの保持、IDを除いた検索値、etc.検索互換、辞書アンカーと構造化テキストを確認します。元データにトークンがない場合の正規化値・空白は変更しません。

## 日英envelopeの正規化修復（2026-10-27）

token移行後のData同期で `日英の元行が一致しません: GM:325:de_normalized` が発生した原因は、日本語JSONだけで検索用トークン除外を行い、同一取得の英語入力envelopeにシートの計算結果をそのまま格納していたことでした。`buildEnglishExportSource_` もGM/RW/RSのde_normalizedだけに同じ `scoreExampleSearchText()` を適用します。シート式・de/ja/en・用例等を変更せず、`validateEnglishSource` の厳密な文字・行数比較を維持します。

回帰は描画・英語生成関数の直接呼出しだけでなく、合成シート一回読取→GAS export→実際のvalidateEnglishSource→bilingual.prepare全体を、旧データ・新トークン・部分移行で通します。envelopeのde/ja/data/page/de_normalizedやNotes出典の改変、行削除は引き続き拒否します。

修正はGASのexportコードなので、ローカル修正だけで再取得しても直りません。標準DataモードはSite以外のモードと同様、GASソース差分があれば先にGASを更新し、ソースハッシュを検証してから新snapshotを取得します。準備完了後に利用者が修正版checkoutで `./sync-data.ps1 -Mode Data` を実行すればよく、別の先行モードや手動deployは不要です。認証・GAS編集差分等で停止した場合は表示理由を確認し、繰返し実行しません。こちらではsync-data（Check含む）・commit・push・deployを実行しません。
