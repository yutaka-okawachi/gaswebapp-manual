# パフォーマンス改善ガイド

このドキュメントは、GitHub Pages で公開しているトップページおよび検索ページの PageSpeed Insights 対応方針をまとめたものです。
測定値は実行ごとにぶれるため、1回の結果だけで大きな変更を判断しないでください。

## 現在の方針

- トップページの主要指標は、モバイルで概ね 90 点前後を目標にします。
- 検索ページの可読性を優先し、検索結果やカード見出しの `Lora` 指定は維持します。
- トップページ冒頭の説明文は LCP 対象になりやすいため、Web フォントではなくシステムフォントを使います。
- Google Tag は初期描画を妨げないよう、ページ読み込み後に遅延読み込みします。
- `common.css` はトップページでも読み込みます。単純に外すと表示や計測が悪化する可能性があります。

## 2026-05 時点で効果があった変更

### トップページ冒頭説明文のフォント変更

LCP 対象になっていたトップページ冒頭の `.subtitle` だけをシステムフォントに変更したところ、モバイルの PageSpeed が大きく改善しました。

対象ファイル:

- `index.html`
- `src/index.html`

維持する指定:

```css
.subtitle {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif;
}
```

この変更はトップページ冒頭の説明文だけに限定します。検索結果ページ、作曲家カード、ボタン、見出しの `Lora` には影響させません。

### Google Tag の遅延読み込み

`gtag.js` を `<head>` で即時読み込みせず、ページ読み込み後に追加する形にしています。

対象ファイル:

- `index.html`
- `src/gtag.html`

目的:

- 初期描画中の JavaScript 実行を減らす
- PageSpeed の TBT や強制リフローへの影響を抑える

注意:

- Google Tag は PageSpeed の計測中に実行されると、未使用 JavaScript や TBT として表示されることがあります。
- Analytics の即時計測を重視する場合、遅延時間を長くしすぎないでください。

## 触るときに注意するもの

### common.css

PageSpeed では `common.css` が「レンダリングをブロックしているリクエスト」として表示されることがあります。
ただし、ファイルサイズは小さく、トップページのサイドバーや共通レイアウトにも関係します。

過去に `common.css` をトップページから単純に外したところ、PageSpeed が大きく悪化しました。
そのため、以下は避けてください。

- `common.css` の単純削除
- 必要な共通CSSを十分に確認しないままのインライン化
- 検索ページとトップページの共通CSSを一度に大きく組み替えること

CSSを触る場合は、まず1ページだけで小さく試し、すぐ戻せるコミット単位にしてください。

### Google Fonts

トップページでは Google Fonts の読み込みを軽くしていますが、検索結果ページでは `Lora` の見た目を維持します。

トップページの冒頭説明文だけはシステムフォントにして、LCP改善を優先します。
検索結果本文や専門用語表示のフォントを変える場合は、可読性への影響を確認してからにしてください。

## PageSpeed 再計測時の見方

1. モバイルで測定します。
2. 1回だけで判断せず、必要に応じて2〜3回測ります。
3. 優先して見る指標は以下です。
   - Largest Contentful Paint (LCP)
   - First Contentful Paint (FCP)
   - Total Blocking Time (TBT)
   - Cumulative Layout Shift (CLS)
4. 「診断」欄は、スコアへの直接影響が小さい項目も含みます。

判断の目安:

- LCP が 3 秒未満なら良好です。
- CLS が 0.1 未満なら大きな問題はありません。
- TBT はぶれやすく、Google Tag の実行タイミングでも変わります。
- `common.css` のキャッシュやレンダリングブロック警告は、数値が小さければ優先度を下げます。

## 変更手順

1. 変更前に PageSpeed の現在値を記録します。
2. 1つの施策だけを変更します。
3. `index.html` と必要な `src/` 側テンプレートを両方更新します。
4. `sync-data.ps1` または通常の git push 手順で公開します。
5. GitHub Pages 反映後に再計測します。
6. 悪化した場合は、該当コミットだけを revert します。

例:

```powershell
git revert <悪化したコミットID>
git push
```

## 変更してはいけない情報

このマニュアルには、Google Analytics、Google Search Console、GitHub Token、GAS の秘密情報は記載しないでください。
