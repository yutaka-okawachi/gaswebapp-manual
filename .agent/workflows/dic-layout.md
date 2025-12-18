---
description: dic.htmlのレイアウト変更
---

# dic.htmlレイアウト変更ワークフロー

`dic.html`は自動生成されるため、直接編集せず、テンプレートを編集します。

> [!WARNING]
> `mahler-search-app/dic.html`を直接編集しないでください。
> 次回のGAS更新で上書きされます。

## 🚀 クイックスタート（自動化スクリプト使用）

// turbo-all

1. テンプレートファイルを編集
```powershell
code c:\Users\okawa\gaswebapp-manual\src\generate_dic_html.js
```

2. 自動化スクリプトを実行
```powershell
.\update-dic-layout.ps1
```

3. 指示に従ってGASで`exportAllDataToJson`を実行

4. Enterキーで続行 → 自動的に`git pull`と`git push`が実行される（すべての変更ファイルを含む）

---

## 📋 手動実行する場合

自動化スクリプトを使わない場合は、以下の手順で実行します。

// turbo-all

1. テンプレートファイルを開く
```powershell
code c:\Users\okawa\gaswebapp-manual\src\generate_dic_html.js
```

2. HTMLテンプレート内のスタイルや構造を編集
   - CSSは`<style>`セクション
   - HTMLは`<body>`セクション
   - JSは`<script>`セクション

3. srcディレクトリに移動
```powershell
cd c:\Users\okawa\gaswebapp-manual\src
```

4. GASにアップロード
```powershell
clasp push
```

5. 元のディレクトリに戻る
```powershell
cd c:\Users\okawa\gaswebapp-manual
```

6. GASで実行（手動操作）
   - Google Apps Scriptエディタを開く
   - `exportAllDataToJson`を実行
   - dic.htmlが新しいレイアウトで生成され、GitHubに自動push

7. ローカルに反映
```powershell
git pull
```

8. 確認
```powershell
# ブラウザでdic.htmlを開いて確認
start mahler-search-app/dic.html
```

---

## トラブルシューティング

### 誤ってローカルのdic.htmlを編集してしまった場合

```powershell
# ローカルの変更を破棄してリモート版に戻す
git checkout origin/main -- mahler-search-app/dic.html
```

### コンフリクトが発生した場合

```powershell
# GAS版を採用
git checkout --theirs mahler-search-app/dic.html
git add mahler-search-app/dic.html
git rebase --continue
```

---

## 詳細ガイド

- **自動化スクリプト**: [AUTOMATION_SCRIPTS_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/AUTOMATION_SCRIPTS_GUIDE.md)
- **レイアウト変更**: [DIC_LAYOUT_CHANGE_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/DIC_LAYOUT_CHANGE_GUIDE.md)

