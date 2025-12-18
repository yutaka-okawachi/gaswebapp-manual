# dic.html レイアウト変更ガイド

`dic.html`はGASで自動生成されるため、直接編集すると次回の更新で**上書きされます**。
このガイドでは、レイアウト変更を永続的に反映する方法を説明します。

## ⚠️ 重要な原則

> [!WARNING]
> **`mahler-search-app/dic.html`を直接編集しないでください**
> 
> このファイルはGASの`generate_dic_html.js`から自動生成されます。
> レイアウト変更は必ず**テンプレート側**で行ってください。

## 正しいワークフロー

### 1. テンプレートファイルを編集

```powershell
# generate_dic_html.js を開く
code c:\Users\okawa\gaswebapp-manual\src\generate_dic_html.js
```

このファイル内のHTMLテンプレート部分を編集します。

**例: スタイルを変更**
```javascript
// 156行目付近の generateDicHtml 関数内
const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <!-- ここでCSSを変更 -->
    <style>
        .alphabet-bar {
            height: 600px;  /* 例: 高さを変更 */
        }
    </style>
</head>
...
`;
```

### 2. GASにアップロード

```powershell
# srcディレクトリに移動
cd c:\Users\okawa\gaswebapp-manual\src

# GASにpush
clasp push

# 元のディレクトリに戻る
cd ..
```

### 3. GASで再生成

1. Google Apps Scriptエディタを開く
2. `exportAllDataToJson`を実行
3. 新しいレイアウトで`dic.html`が生成され、GitHubに自動push

### 4. ローカルに反映

```powershell
# リモートの変更を取得
git pull

# 新しいdic.htmlが反映される
```

---

## クイックテスト: ローカルで確認したい場合

GASにpushする前に、ローカルでテストすることもできます:

### 方法A: テスト用のHTML作成

```powershell
# 1. generate_dic_html.js を編集

# 2. GASエディタでテスト実行
# - スクリプトエディタで testGenerateDicHtml() を実行
# - ログに出力されたHTMLをコピー

# 3. テストファイルとして保存
# mahler-search-app/dic_test.html に貼り付け

# 4. ブラウザで確認
# dic_test.html を開いてレイアウトを確認
```

### 方法B: ローカルでNode.jsを使用（上級者向け）

generate_dic_html.js を Node.js で実行できるように調整すれば、
ローカルでも生成できますが、設定が複雑になります。

---

## よくある編集パターン

### 1. CSSスタイルの変更

`generate_dic_html.js`の`<style>`セクションを編集:

```javascript
function generateDicHtml(dicData, abbrData) {
  const html = `
    ...
    <style>
      /* ここを編集 */
      body { 
        background-color: #f5f5f5; 
      }
      .alphabet-bar {
        background: linear-gradient(...);
      }
    </style>
    ...
  `;
}
```

### 2. HTML構造の変更

テンプレート内のHTMLマークアップを編集:

```javascript
const html = `
  ...
  <body>
    <!-- 新しい要素を追加 -->
    <header>
      <h1>新しいヘッダー</h1>
    </header>
    ...
  </body>
`;
```

### 3. JavaScriptロジックの変更

`<script>`セクション内のコードを編集:

```javascript
const html = `
  ...
  <script>
    // ここでロジックを変更
    function updateDatalist() {
      // 新しい処理
    }
  </script>
  ...
`;
```

---

## トラブルシューティング

### Q: 誤ってローカルのdic.htmlを編集してしまった

**A**: GAS版を優先してリセット

```powershell
# 1. ローカルの変更を破棄
git checkout origin/main -- mahler-search-app/dic.html

# 2. テンプレート側で編集し直す
code src/generate_dic_html.js
```

### Q: コンフリクトが発生した

**A**: GAS版を採用

```powershell
git pull --rebase
# コンフリクトが発生したら...

# GAS版を採用
git checkout --theirs mahler-search-app/dic.html
git add mahler-search-app/dic.html
git rebase --continue
```

### Q: 変更が反映されない

**A**: 手順を確認

1. `generate_dic_html.js`を編集したか？
2. `clasp push`でGASにアップロードしたか？
3. GASで`exportAllDataToJson`を実行したか？
4. ローカルで`git pull`したか？

---

## ベストプラクティス

> [!TIP]
> **レイアウト変更のチェックリスト**
> 
> - [ ] `src/generate_dic_html.js`を編集
> - [ ] `clasp push`でGASに反映
> - [ ] GASで`exportAllDataToJson`を実行
> - [ ] `git pull`でローカルに取得
> - [ ] ブラウザでdic.htmlを確認
> - [ ] 問題なければ完了！

## まとめ

| やること | 場所 | ツール |
|---------|------|--------|
| **レイアウト編集** | `src/generate_dic_html.js` | VSCode |
| **GASにアップロード** | - | `clasp push` |
| **HTML生成** | GAS | `exportAllDataToJson` |
| **ローカル取得** | - | `git pull` |

このワークフローに従えば、レイアウト変更が**永続的に保存**され、データ更新時も**常に最新のレイアウト**が適用されます。
