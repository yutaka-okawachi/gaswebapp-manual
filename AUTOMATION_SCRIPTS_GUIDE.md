# dic.htmlレイアウト更新 自動化スクリプト（完全自動化版）

dic.htmlのレイアウト変更作業を**完全自動化**するPowerShellスクリプトです。

## 📜 スクリプト

### **update-dic-layout.ps1** ✨ 完全自動化

**用途**: clasp push → GAS実行 → git pull → git push を**すべて自動実行**

**実行方法**:
```powershell
.\update-dic-layout.ps1
```

**オプション**:
```powershell
.\update-dic-layout.ps1 -message "カスタムコミットメッセージ"
```

**処理フロー**:
1. ✅ `clasp push` (自動)
2. ✅ Web App経由で`exportAllDataToJson`実行 (自動) ← **NEW!**
3. ✅ `git pull --rebase` (自動)
4. ✅ **dic.htmlのCSS自動検証** (自動) ← **NEW!**
   - フォントサイズが正しく反映されているかチェックします
5. ✅ `git add . && git commit && git push` (自動)

**確認プロンプトなし** - 全自動で完了します！

---

## � 初回セットアップ（一度だけ）

Web App経由でGAS関数を自動実行するための設定を行います（約5分）。

### セットアップスクリプトの実行

```powershell
.\setup-web-trigger.ps1
```

### セットアップ手順

1. **GASをWeb Appとしてデプロイ**（スクリプトが手順を表示）
   - GASエディタで「デプロイ」→「新しいデプロイ」
   - 種類: 「ウェブアプリ」、実行ユーザー: 「自分」、アクセス: 「全員」

2. **環境変数の設定**（スクリプトが対話的に設定）
   - Web App URL と秘密トークンを入力

3. **接続テスト**
   - 自動的に実行され、成功を確認

設定は永続的に保存されます（ユーザー環境変数）。

---

## �🚀 使用例

### 基本的な使い方（完全自動化）

```powershell
# 1. generate_dic_html.js を編集（任意）
code c:\Users\okawa\gaswebapp-manual\src\generate_dic_html.js

# 2. スクリプト実行（これだけ！）
.\update-dic-layout.ps1

# 完了！確認プロンプトなし、全自動で完了します
```

### カスタムコミットメッセージ

```powershell
.\update-dic-layout.ps1 -message "アルファベットバーの高さを調整"
```

---

## 📋 処理の詳細

```
┌─────────────────────────────────────┐
│ 1. clasp push                       │ ← 自動
│    └→ GASにコードをアップロード      │
├─────────────────────────────────────┤
│ 2. Web App経由でGAS関数実行          │ ← 自動（NEW!）
│    └→ exportAllDataToJson           │
├─────────────────────────────────────┤
│ 3. git pull --rebase                │ ← 自動
│    └→ 最新のdic.htmlを取得          │
├─────────────────────────────────────┤
│ 4. git add/commit/push              │ ← 自動（NEW!）
│    └→ すべての変更ファイルを自動push │
└─────────────────────────────────────┘

✅ **確認プロンプトなし - 完全自動実行**
```

---

## ⚠️ トラブルシューティング

### clasp pushが失敗する

```powershell
# claspにログインしているか確認
clasp login

# .clasp.jsonが正しいか確認
cat .clasp.json
```

### 変更が反映されない（font-sizeが変わらないなど）

`clasp push`は成功しているのに、生成される`dic.html`が古いままの場合：

**原因**:
GAS Web Appのデプロイバージョンが古いままで固定されている可能性があります。

**解決策**:
1. [GASエディタ](https://script.google.com/home)を開く
2. 右上の「デプロイ」→「デプロイを管理」をクリック
3. 「設定（鉛筆アイコン）」をクリック
4. バージョンで **「新バージョン」** を選択して「デプロイ」ボタンをクリック

これを行った後、再度`update-dic-layout.ps1`を実行してください。

### git pullでコンフリクト

```powershell
# dic.htmlはGAS版を優先
git checkout --theirs mahler-search-app/dic.html
git add mahler-search-app/dic.html
git rebase --continue
```

---

## 💡 Tips

### スクリプトを簡単に実行するには

**エイリアスを設定**（PowerShell プロファイル）:

```powershell
# プロファイルを開く
notepad $PROFILE

# 以下を追加
function Update-DicLayout {
    Set-Location "c:\Users\okawa\gaswebapp-manual"
    .\update-dic-layout.ps1 @args
}

Set-Alias udl Update-DicLayout
```

保存後、どこからでも実行可能:

```powershell
udl
udl -message "レイアウト修正"
```

### VSCodeタスクとして登録

`.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Update dic.html Layout",
      "type": "shell",
      "command": ".\\update-dic-layout.ps1",
      "problemMatcher": [],
      "group": {
        "kind": "build",
        "isDefault": true
      }
    }
  ]
}
```

---

## 🎯 メリット

### 従来の手作業

```powershell
cd src
clasp push
cd ..
# GASエディタを開く
# exportAllDataToJsonを手動実行
git pull
git add .
git commit -m "..."
git push
```

**約5-10分、7ステップ**

### 自動化スクリプト使用

```powershell
.\update-dic-layout.ps1
# GASで1回実行（2分）
# Enterキー押下
```

**約2-3分、3ステップ** 🎉

---

## まとめ

> [!TIP]
> **`.\update-dic-layout.ps1`でdic.htmlレイアウト変更が簡単に！**
> 
> GAS実行のみ手動で、それ以外は完全自動化されます。
