# SEO運用ガイド

このドキュメントは、GitHub Pages サイトのSEO（検索エンジン最適化）に関する設定と運用方法を説明します。

## 現在のSEO設定

### 1. canonicalタグ
各HTMLファイルには `<link rel="canonical">` タグが設定されており、検索エンジンに正規URLを伝えます。

```html
<link rel="canonical" href="https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/xxx.html">
```

### 2. og:urlメタタグ
SNS共有時の正規URLを指定するOGPタグです。

```html
<meta property="og:url" content="https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/xxx.html">
```

### 3. sitemap.xml
`mahler-search-app/sitemap.xml` に全ページのURLと更新日が記載されています。

## 対象ファイル一覧

| ファイル | 説明 |
|---------|------|
| home.html | ホームページ |
| index.html | マーラー検索 |
| dic.html | 用語集（自動生成） |
| terms_search.html | GM用語検索 |
| rs_terms_search.html | RS用語検索 |
| rw_terms_search.html | RW用語検索 |
| richard_strauss.html | RS曲名検索 |
| richard_wagner.html | RW曲名検索 |
| notes.html | 翻訳ノート |
| other.html | 参考資料 |

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

## 旧Google Sitesとの関係

- 旧サイト（sites.google.com）と新サイト（GitHub Pages）は並行運用
- canonicalタグにより、Googleは徐々にGitHub Pagesを正規版として認識
- **旧サイトへの対応は不要**（noindex設定やリダイレクトは不要）
- Google Search Console (GSC) への追加設定も不要

## 注意事項

- **og:image は未設定**: SNS共有時に画像は表示されません（SEOには影響なし）
- **sitemap.xmlの更新**: 大きな更新を行った際は `lastmod` の日付を更新してください
- **dic.htmlは自動生成**: `src/generate_dic_html.js` を編集することで、生成時にog:urlタグも含まれます

## 参考リンク

- [Google Search Central - canonical タグ](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Meta - OGPデバッガー](https://developers.facebook.com/tools/debug/)
