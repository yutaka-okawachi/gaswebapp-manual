# Google Search Console 設定ガイド

## 🎯 目的
Google Search Consoleにサイトを登録し、サイトマップを送信してSEOを改善します。

## 📋 手順

### ステップ1: Google Search Consoleにアクセス

1. **ブラウザで開く**
   ```
   https://search.google.com/search-console
   ```
   Googleアカウントでログイン

2. **プロパティを追加**
   - 画面左上の「プロパティを検索」（またはプロパティ名）をクリック
   - 「プロパティを追加」を選択

### ステップ2: プロパティタイプを選択

**URLプレフィックス**方式（右側）を選択：

```
https://yutaka-okawachi.github.io/
```

> [!IMPORTANT]
> - 末尾の `/` を忘れずに！
> - `http`ではなく`https`を使用
> - ドメインプロパティ（左側）ではなく、URLプレフィックス（右側）を選択

### ステップ3: 所有権の確認

**HTMLファイルアップロード方式**（推奨）：

1. **確認ファイルをダウンロード**
   - Google Search Consoleが`google[ランダム文字列].html`のようなファイルを生成
   - 「ダウンロード」をクリック

2. **GitHubにアップロード**
   
   **方法A: GitHub Web UIで直接アップロード**
   - https://github.com/yutaka-okawachi/gaswebapp-manual にアクセス
   - 「Add file」→「Upload files」
   - ダウンロードした`google[ランダム文字列].html`ファイルをドラッグ＆ドロップ
   - 「Commit changes」をクリック
   
   **方法B: ローカルからGit経由**
   ```bash
   # ダウンロードしたファイルをリポジトリのルートに移動
   cp ~/Downloads/google*.html c:\Users\okawa\gaswebapp-manual\
   
   # Git操作
   cd c:\Users\okawa\gaswebapp-manual
   git add google*.html
   git commit -m "Google Search Console確認ファイル追加"
   git push
   ```

3. **確認を実行**
   - 1-2分待つ（GitHub Pagesのデプロイを待つ）
   - Google Search Consoleに戻る
   - 「確認」ボタンをクリック

### ステップ4: サイトマップを送信

所有権確認が完了したら：

1. **サイトマップページを開く**
   - 左メニュー → 「サイトマップ」をクリック

2. **サイトマップURLを入力**
   ```
   https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/sitemap.xml
   ```
   
3. **「送信」をクリック**

4. **結果を確認**
   - ステータスが「成功しました」になればOK
   - インデックスされたURLの数が表示されます

### ステップ5: URL検査（個別ページのインデックス促進）

特定のページを早くインデックスさせたい場合：

1. **URL検査ツールを開く**
   - 左メニュー → 「URL検査」

2. **URLを入力**
   ```
   https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/dic.html
   ```

3. **「インデックス登録をリクエスト」をクリック**
   - 1-2分待つ
   - 「インデックス登録をリクエスト済み」と表示されればOK

## 📊 期待される結果

### タイムライン

- **所有権確認**: 即時
- **サイトマップ送信**: 即時
- **インデックス開始**: 数時間〜24時間
- **完全なインデックス**: 1-3日

### 確認方法

**Google検索で確認**:
```
site:yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/dic.html
```

## 🛠️ トラブルシューティング

### Q: 所有権確認が失敗する

**A**: 以下を確認：
1. 確認ファイルが正しくアップロードされているか
2. GitHub Pagesがデプロイ済みか（1-2分待つ）
3. URLが正確か（https://yutaka-okawachi.github.io/google[ランダム文字列].html で直接アクセス可能か）

### Q: サイトマップが読み込めない

**A**: sitemap.xmlが正しくアップロードされているか確認：
```
https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/sitemap.xml
```
ブラウザで直接開いて、XMLが表示されればOK

### Q: インデックスされない

**A**: 
1. Google Search Consoleの「カバレッジ」レポートを確認
2. エラーメッセージがあれば対処
3. robots.txtでブロックされていないか確認

## 📝 次のステップ

1. 定期的にGoogle Search Consoleをチェック
2. 「パフォーマンス」レポートで検索順位を確認
3. スプレッドシート更新時にサイトマップの`<lastmod>`を更新（オプション）
