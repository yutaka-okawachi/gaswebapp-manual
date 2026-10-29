# 譜例トークンの仕様と追加手順

[マニュアル入口の第5段階](README.md#scores)です。**下の5件は新しい共通トークン方式の登録一覧であり、サイトの全譜例・全記号の対応一覧ではありません。** 旧方式の譜例・文脈限定の記号変換・意図して文字のままの項目を区別した対応範囲は本書後半にまとめています。

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

<a id="今回の同期順と検証"></a>
## 互換移行の順序と検証

新規導入では、先にトークン対応コードと旧データ互換を公開します。公開成功を確認してから担当者がシートのde/ja/enを変更し、その後`.\sync-data.ps1 -Mode Data`でデータ取得を伴う正規同期へ進みます。コード公開とシート移行と公開データ反映は別の完了条件です。Autoはシート更新の検知を保証しないため、モードの正本は[日常保守](DEVELOPER_GUIDE.md#2-2-実行される処理の流れ)を参照してください。

**2026-10-27の引き継ぎ状態（公開完了）：** 親作業から、5件×de/ja/enの15セルのシート移行・履歴保存と、その後の正規化修復・Data同期・公開確認の完了報告を受けています。対象コミットは`5f096ab4b6ea4e421407dc88a80cd6a469ef279e`、CI run `40496402129`・Pages run `40496401519`が成功し、新方式5件と旧方式2譜例の公開画面も正常との報告です。途中の元行不一致は後述の修復履歴に残します。この文書整理では同期・シート編集・本番画面の再確認を実行しておらず、既存の完了報告と現在のローカル公開データを照合しています。新担当者が同じ移行を繰り返す必要はありません。

新規対応時の検証コマンドは`node scripts/test-score-tokens.js`、`node scripts/test-score-token-sync.js`、`node scripts/test-notes-glockenspiel.js`、`node scripts/test-original-score-examples.js`等です。全ローカル回帰は`node scripts/check-local.js`です。以下の対応表は実装・テストの静的照合で作成し、今回これらの回帰テストや本番同期を実行した結果ではありません。

<a id="文面qaによる挿入案の具体化"></a>
## 5件の文面と検索互換

RS651のdeは `vielleicht pultweise derart zu teilen [[score:feuersnot-desk-division]]` とします。SVG内のetc.を保持し、本文で重ねません。レジストリのsearchTextに旧 `～ etc.` を持たせ、GASと英語出力のde_normalized・通常検索・実例シャード検索ではIDの代わりにこの検索表記を使います。旧全文・etc.による検索を維持し、表示には重ねません。通常の辞書ID・候補表示・構造化テキストではIDを除外します。

RS782のjaは `4つのティンパニの配置： [[score:salome-timpani-layout]]`、enは `Arrangement of the four timpani: [[score:salome-timpani-layout]]` とする文面をfixtureで確認しています。deは左右手の実テキストを維持するのでその語での検索を保持します。代替説明にも `linke H. / l. H. / rechte H. / rechte Hand` を明記します。左右を示す2つの（譜例）を残して画像を二重に追加することはしません。この文面は上記の移行対象です。履歴保存・シート保存・公開同期をそれぞれ区別して確認します。

`node scripts/test-score-token-sync.js`は、合成シートの一回読取→GAS export→実運用の`validateEnglishSource`→`bilingual.prepare`までを通し、旧データ・新トークン・部分移行を区別します。日英の正規化値の一致、生トークン保持、etc.検索互換、辞書アンカー・構造化テキスト、元値改変や行削除の拒否を確認する構成です。元データにトークンがない場合の正規化値・空白は変更しません。

## 対応範囲一覧（2026-10-27・実装とテストの静的照合）

「新方式へ移行」「旧方式で表示対応」「文字を維持・未対応／未確認」を分けます。以下のGM等の番号は調査時点の由来を示す目印です。実行時の識別は原文と使用箇所・出典であり、行の挿入・削除・並替えで付け替えません。旧資料の除外・保留一覧は後続改修前の記録を含むため、現在の実装を優先して照合します。

### A. 新方式の5件と、残している旧データ互換

最新テストは[共通fixture](../scripts/test-utils/score-example-fixtures.js)でトークンなしの旧データを複製し、公開中の新トークン入りデータとは別に互換動作を検証します。既存の正本JSONやシートを旧表記へ戻す処理ではありません。

| 対象 | 新方式のID | 互換・回帰の根拠 | 移行と公開の状態 |
| --- | --- | --- | --- |
| GM325 | `mahler-trill-chain` | GMのdata文脈、`gm325-example`。四分主音4個・トリル・32分後打音 | シート移行・公開同期完了（上記引き継ぎ報告） |
| GM1550 | `mahler-editorial-g2` | GMのdata文脈、`gm1550-example`。G2・透明音符頭・連続五線 | 同上 |
| RS651 | `feuersnot-desk-division` | Feuersnot p320の文脈、`rs651-example`。etc.の重複抑止と検索互換 | 同上 |
| RS782 | `salome-timpani-layout` | Salome Szene 4 p287、`rs782-example`。左右手の文字保持 | 同上 |
| Notes235（旧236） | `hindemith-glockenspiel-fsharp5` | `[H: KM1-1]`と見出しprefix、`glockenspiel-fsharp5`。F♯5・下向き四分音符 | 同上 |

根拠は[registryと辞書描画](../src/dictionary_notation.js)、[演奏指示描画](../frontend/music-notation.js)、[新旧混在・誤文脈・未知ID等のテスト](../scripts/test-score-tokens.js)、[同期と検索正規化のテスト](../scripts/test-score-token-sync.js)です。既存全文による旧差込みも保持し、トークンがある欄に重ねません。Notesについては[専用テスト](../scripts/test-notes-glockenspiel.js)が静的辞書・動的辞書・単語検索と物理行非依存を検証します。

### B. 旧方式で表示対応を維持する譜例・辞書記号

| 対象 | 現行方式・保全内容 | 根拠 |
| --- | --- | --- |
| GM358 | `[Notenbeispiel]`等の日独英プレースホルダーから`motif-two`へ。ト音記号付き2小節、先頭G4・末尾F4と継続タイ | [GM記譜テスト](../scripts/test-gm-notation.js)、[原文と各検索経路](../scripts/test-original-score-examples.js) |
| GM387 | 旧プレースホルダーから`motif-one`へ。音部記号なし1小節 | 同上。GM358と共に今回の5ID移行対象外 |
| Notes21 | 見出し原文と`[RS: Qui]`に限定して「トレモロ音符」を黒四分音符1個・下向き符幹・斜線3本に変換。本文説明中の音符名は文字を維持 | [辞書記号実装](../src/dictionary_notation.js)、[Notes21と辞書全体の分離テスト](../scripts/test-dictionary-notation.js) |
| Notesのanhalten | `[GM]`と指定引用文中の記号だけを短い休止`short-pause`として表示。一般的なフェルマータへの意味変更はしない | 同実装、[記号網羅・静的/動的辞書テスト](../scripts/test-notation-completeness.js) |

GM358/387へ共通トークンを勝手に追加しません。日英の原文・訳文、作品別・用語・辞書実例経路の回帰は既存テストで区別しています。[RS/GMの採用譜例テスト](../scripts/test-rs-score-examples.js)と[GM1550テスト](../scripts/test-gm1550-example.js)は5ID側の図形・文脈・既存譜例を保全する範囲も確認します。

### C. 文脈限定で変換する音符・記号の全登録範囲

[MUSIC_NOTATION_CONTEXTS](../frontend/notation-contexts.js)は96文脈（GM89・RW6・RS1）です。GM358/387も含むため、上表と件数を単純合算しません。これは共通score registryの5IDとは別の一覧です。実装は原文とdataまたは作品・幕・場面・頁を照合し、指定した文字だけをSVGへ変換します。

| タブ | 描画種別 | 由来の行番号（実行条件ではない） |
| --- | --- | --- |
| GM | `stopped-plus` | 3, 721, 722, 1578 |
| GM | `fermata` | 336, 1561 |
| GM | `quarter` | 357, 653, 1032, 1135, 2572 |
| GM | `rhythmic-alignment` | 367 |
| GM | `caret-accent` | 603 |
| GM | `glissando-up` | 613 |
| GM | `accent-right` | 631 |
| GM | `half / quarter` | 649, 650, 654, 655, 930, 965, 1335, 1354, 1782, 2064, 2084, 2085, 2091, 2101, 2136, 2231, 2566, 2567, 2568, 2570, 2571, 2573, 2574, 2576, 2578, 2579, 2580, 2581, 2583, 2585, 2586, 2587, 2588, 2589, 2590, 2591, 2593, 2594, 2595 |
| GM | `dotted-quarter / quarter` | 651, 652 |
| GM | `half / whole` | 656, 2582, 2584, 2596 |
| GM | `eighth` | 1099, 2210 |
| GM | `half` | 1136, 1220, 2059, 2592 |
| GM | `down-arrow` | 1551 |
| GM | `portamento-down / portamento-up` | 1557 |
| GM | `portamento-up` | 1577 |
| GM | `eighth / quarter` | 1783, 2569, 2597, 2598, 2600 |
| GM | `tempo-star` | 2321, 2330, 2338 |
| GM | `tempo-theta` | 2322 |
| GM | `dotted-quarter / half` | 570, 2601 |
| GM | `dotted-quarter / eighth-triplet-below` | 2602 |
| GM | `short-pause` | 338 |
| GM | `motif-two` | 358 |
| GM | `motif-one` | 387 |
| GM | `roof` | 586 |
| GM | `fermata-v` | 589 |
| GM | `dotted-half / quarter` | 2575 |
| GM | `quarter-triplet / quarters` | 2577 |
| GM | `eighth-triplet / eighths` | 2599 |
| RW | `circle-cross-marker` | 364, 841, 865, 1025, 1219 |
| RW | `time-signature-c` | 2106 |
| RS | `quarter` | 726 |

GM586の山形アクセント＋横線、GM589のフェルマータ＋V、GM2575の付点二分、GM2577/2599の通常3音と三連符、GM2602の付点四分＋下側3の八分三連符もこの一覧に含みます。単なる「3個の八分音符」へ三連符数字を自動追加しません。RWの円十字は接続・カット標識として扱い、コーダ進行を補いません。

全96文脈と除外項目の分離、原文・訳文の不変、NFC/NFD、行移動、通常・用語・辞書実例の経路は[文脈テスト](../scripts/test-notation-contexts.js)を参照します。[記号網羅テスト](../scripts/test-notation-completeness.js)は日英のGM/RW/RSで音楽Unicodeを含むフィールドを走査します。走査が成功しても、画像でしか見つからない未登録譜例や原譜全頁まで調査した証明にはなりません。

### D. 文字を維持する項目・未対応／未確認

| 区分 | 対象・扱い | 根拠・残る確認 |
| --- | --- | --- |
| 意図して文字trを維持 | GM37・GM1920・RW4642。筆記風trのSVGを追加せず原文の文字を表示 | [除外fixture](../scripts/fixtures/notation-excluded-contexts.json)と文脈テスト。専用装飾記号としての原譜確認とは区別 |
| SVG化しない除外・保留 | GM582、RW349/410/742/832/2704/3128/3908/5428、RS727/5052 | 同fixtureとテストで原文どおりの表示を保持。これらを画像対応済みと数えない |
| 一般的な文字を維持 | 強弱p/pp/f/fp、分数の拍子、8va、通常の句読点・脚注記号等。文脈登録がある記号だけ例外 | 任意の同形文字を一括SVG化しない。原譜の意味や形を未確認のまま補わない |
| この一覧外 | 新規シート行、原譜中の未収録図、未調査の強弱・位置標識、ライセンスや形が未確定の画像 | 全対応済みとは扱わない。旧記録の「追加17件の強弱/位置標識」は今回個別同定していない。原譜・文脈・ライセンスを調べ、本書の追加手順へ |

**成功の目印：** 実装登録・シート保存・公開同期・表示確認をそれぞれ確認できること。**次：** [マニュアル入口の同期段階](README.md#publish)へ。表示できない場合は[復旧の入口](README.md#recovery)から、ID・描画種別・文脈・元データを順に照合します。


## 日英envelopeの正規化修復（2026-10-27）

token移行後のData同期で `日英の元行が一致しません: GM:325:de_normalized` が発生した原因は、日本語JSONだけで検索用トークン除外を行い、同一取得の英語入力envelopeにシートの計算結果をそのまま格納していたことでした。`buildEnglishExportSource_` もGM/RW/RSのde_normalizedだけに同じ `scoreExampleSearchText()` を適用します。シート式・de/ja/en・用例等を変更せず、`validateEnglishSource` の厳密な文字・行数比較を維持します。

回帰は描画・英語生成関数の直接呼出しだけでなく、合成シート一回読取→GAS export→実際のvalidateEnglishSource→bilingual.prepare全体を、旧データ・新トークン・部分移行で通します。envelopeのde/ja/data/page/de_normalizedやNotes出典の改変、行削除は引き続き拒否します。

修正はGASのexportコードなので、ローカル修正だけで再取得しても直りません。標準DataモードはSite以外のモードと同様、GASソース差分があれば先にGASを更新し、ソースハッシュを検証してから新snapshotを取得します。準備完了後に利用者が修正版checkoutで `./sync-data.ps1 -Mode Data` を実行すればよく、別の先行モードや手動deployは不要です。認証・GAS編集差分等で停止した場合は表示理由を確認し、繰返し実行しません。こちらではsync-data（Check含む）・commit・push・deployを実行しません。

上記修復節は当時の原因・対応方針を残した履歴です。修復後のData同期と公開確認は本書前半の引き継ぎ状態のとおり完了しています。今後の通常更新では[日常保守](DEVELOPER_GUIDE.md)のモード選択・検証手順を使い、この修復を新規導入の必須工程にしません。

## ポルタメント記号（Notes，2026-10-29追加）

《英雄の生涯》の脚注を実見し，印刷220頁の右下がりの長い波線と，印刷210頁の右上がりの短い波線を区別して登録しています。

| 対象文 | 意味ID | 図形 |
| --- | --- | --- |
| `/ bedeutet stets: starkes Portamento!` | `heldenleben-portamento-strong` | 右下がりの長い波線 |
| `/ bedeutet: von einem Ton zum andern schleifen (portamento)` | `heldenleben-portamento-slide` | 右上がりの短い波線 |

両者とも出典 `[RS: Held]` と原文全文で照合し，行番号は条件に使いません。de・ja・en の `/` だけを対応する `[[score:...]]` に置き換えます。ja_old はバックアップなので変更しません。旧データの先頭 `/`（英語は `The symbol /`）にも限定した表示互換があります。記号始まりの項目として，日英ともアルファベットの後にある「数字・記号」／`Other` に配置します。辞書アンカーと検索用の `/` は維持します。

参照譜：[印刷220頁／PDF44頁](https://s9.imslp.org/files/imglnks/usimg/3/3e/IMSLP19168-PMLP04982-Strauss_-_Ein_Heldenleben%2C_Op._40_%28orch._score%29.pdf#page=44)，[印刷210頁／PDF34頁](https://s9.imslp.org/files/imglnks/usimg/3/3e/IMSLP19168-PMLP04982-Strauss_-_Ein_Heldenleben%2C_Op._40_%28orch._score%29.pdf#page=34)。波線の方向は脚注の見た目を再現したもので，訳文の適用を上行・下行のみに限定する変更ではありません。

検証は `node scripts/test-notes-portamento.js`。静的・動的辞書の末尾配置，日英，旧・新・部分移行，異なる出典への非適用，行移動，検索・アンカー互換を確認します。公開時は上記のコード先行・シート変更・Data同期の順序に従ってください。
