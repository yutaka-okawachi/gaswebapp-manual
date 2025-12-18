# dic.htmlレイアウト更新 自動化スクリプト

dic.htmlのレイアウト変更作業を自動化するPowerShellスクリプトです。

## 📜 スクリプト

### **update-dic-layout.ps1**

**用途**: clasp push → GAS実行（手動） → git pull を自動化

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
2. ⏸️ GASで`exportAllDataToJson`実行（手動・待機）
3. ✅ `git pull` (自動)
4. ✅ `git push` (オプション)

---

## 🚀 使用例

### 基本的な使い方

```powershell
# 1. generate_dic_html.js を編集
code c:\Users\okawa\gaswebapp-manual\src\generate_dic_html.js

# 2. スクリプト実行
.\update-dic-layout.ps1

# 3. 指示に従ってGASで関数実行
# 4. Enterキーで続行
# 5. 完了！
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
│ 2. GASで関数実行                     │ ← 手動（待機）
│    └→ exportAllDataToJson           │
├─────────────────────────────────────┤
│ 3. git pull                         │ ← 自動
│    └→ 最新のdic.htmlを取得          │
├─────────────────────────────────────┤
│ 4. git push (オプション)             │ ← 選択制
│    └→ generate_dic_html.jsをpush    │
└─────────────────────────────────────┘
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
