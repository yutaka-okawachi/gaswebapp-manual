# SEO運用ガイド

このドキュメントは、GitHub Pages サイトのSEO（検索エンジン最適化）に関する設定と運用方法を説明します。
このファイルは GitHub 上で閲覧できる前提です。Google Search Console などの認証情報や個人情報は書き込まないでください。

## 現在のSEO設定

### 1. canonicalタグ
各HTMLファイルには `<link rel="canonical">` タグが設定されており、検索エンジンに正規URLを伝えます。

```html
<link rel="canonical" href="https://yutaka-okawachi.github.io/gaswebapp-manual/">
```

### 2. og:urlメタタグ
SNS共有時の正規URLを指定するOGPタグです。SEO上の優先度が高いため、Headセクションの上部に記述します。

```html
<meta property="og:url" content="https://yutaka-okawachi.github.io/gaswebapp-manual/">
```

### 3. sitemap.xml
`sitemap.xml` に全ページのURLと更新日が記載されています。

## 対象ファイル一覧

| ファイル | 内容・役割 |
|---------|------|
| index.html | **現在のトップページ（ルートに配置）** |
| mahler-search-app/index.html | 旧トップページ（ルートへ自動転送＋canonical設定あり） |
| src/mahler.html | 曲名と楽器から検索（現メインツール） |
| dic.html | 用語集（`src/generate_dic_html.js` により自動生成） |
| terms_search.html | GM用語検索 |
| rs_terms_search.html | RS用語検索 |
| rw_terms_search.html | RW用語検索 |
| richard_strauss.html | RS曲名検索 |
| richard_wagner.html | RW曲名検索 |
| notes.html | 翻訳ノート（訳出についての覚書） |
| other.html | 参考資料（使用楽譜など） |

## 新規HTMLファイル追加時の対応

新しいHTMLファイルを追加する場合、以下が必要です：

1. **`<head>`内にタグを追加**
   ```html
   <link rel="canonical" href="https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/新ファイル名.html">
   <meta property="og:url" content="https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/新ファイル名.html">
   ```

2. **sitemap.xmlにURL追加**
   ```xml
   <url>
       <loc>https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/新ファイル名.html</loc>
       <lastmod>YYYY-MM-DD</lastmod>
       <changefreq>monthly</changefreq>
       <priority>0.8</priority>
   </url>
   ```

## サイト構造変更時の対応（2026/04 実施済み）

トップページをサブリダクトリ (`/mahler-search-app/`) からルート (`/`) へ移動した際のSEO対策は以下の通りです：

1. **旧ページ (`/mahler-search-app/index.html`) のリダイレクト**:
   - ユーザーを自動的にルートへ転送するスクリプトを追加。
   - `canonical` タグおよび `og:url` をルートURLに設定し、検索エンジンの評価を新トップページへ集約。

2. **Google Search Console (GSC) での操作**:
   - `sitemap.xml` の再送信を実施し、最新の構造をGoogleに通知。
   - URL検査ツールを使用して、新しいルートURLのインデックス登録をリクエスト。

## 旧Google Sitesとの関係

- 旧サイト（sites.google.com）と新サイト（GitHub Pages）は並行運用
- canonicalタグにより、Googleは徐々にGitHub Pagesを正規版として認識
- **旧サイト側での特別な対応は不要**

## 注意事項

- **og:image は未設定**: SNS共有時に画像は表示されません（SEOには影響なし）
- **sitemap.xmlの更新**: 大きな更新を行った際は `lastmod` の日付を更新してください
- **dic.htmlは自動生成**: `src/generate_dic_html.js` を編集することで，生成時にog:urlタグも含まれます
- **manuals 配下の Markdown**: 現在は GitHub 上で閲覧可能にしています。公開したくない情報は Markdown には書かず、別の安全な場所で管理してください。

## CTR（クリック率）最適化の指針

検索結果でのクリック率を高めるため，ディスクリプション（説明文）には以下の指針を適用しています．

1. **具体的な強みの明示**: 
   - マーラー：全交響曲およびほぼすべての管弦楽曲を網羅し，曲名・楽器等で検索可能．
   - ワーグナー・R.シュトラウス：場面，配役，スコアのページ単位での詳細検索が可能．
   - 用語集：ワーグナー，マーラー，R.シュトラウス，ブルックナー等，900語以上の膨大な収録語数を明示し，情報の豊富さをアピール．

2. **文字数制限**:
   - モバイル検索での視認性を考慮し，全角120文字以内（理想的には100〜110文字）に収めます．

3. **表記スタイル**:
   - 専門性を高めるため，体言止めを中心とした簡潔な記述とします．
   - 句読点は Western style（「，」「．」）を使用します．

## 参考リンク

- [Google Search Central - canonical タグ](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Meta - OGPデバッガー](https://developers.facebook.com/tools/debug/)
