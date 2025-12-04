# GASプロジェクトの場所

## 🎯 3つのアクセス方法

---

## 方法1: 直接URLで開く（最速）⭐

このURLをブラウザで開いてください：

```
https://script.google.com/d/1WTZicVS_Dnu5PHQf1RPrXyS03LffwjbTwPu7bn61WTJTfQzTcimC5Pqs/edit
```

または

```
https://script.google.com/home/projects/1WTZicVS_Dnu5PHQf1RPrXyS03LffwjbTwPu7bn61WTJTfQzTcimC5Pqs
```

→ **これが一番簡単です！**

---

## 方法2: スプレッドシートから開く

### ステップ1: スプレッドシートを見つける

このGASプロジェクトは**スプレッドシートにバインドされています**。

スプレッドシートのURLは、スクリプトIDと同じです：
```
https://docs.google.com/spreadsheets/d/1WTZicVS_Dnu5PHQf1RPrXyS03LffwjbTwPu7bn61WTJTfQzTcimC5Pqs/
```

### ステップ2: Apps Scriptを開く

1. 上記のスプレッドシートを開く
2. メニューバー → **拡張機能**
3. **Apps Script**

→ GASエディタが開きます

---

## 方法3: Google Driveから探す

### Option A: script.google.com から

1. https://script.google.com/ を開く
2. 「マイプロジェクト」に表示される
3. プロジェクト名で検索（名前はスプレッドシート名と同じ）

### Option B: Google Driveで検索

1. https://drive.google.com/ を開く
2. 検索ボックスに以下を入力:
   ```
   type:script
   ```
3. Apps Scriptプロジェクトの一覧が表示される

---

## 📁 プロジェクト構成

GASプロジェクトには以下のファイルがアップロード済みです：

```
📁 GASプロジェクト（スクリプトID: 1WTZicVS_...)
├── 📄 setup_credentials.js      ← 設定スクリプト
├── 📄 github_sync.js            ← GitHub連携スクリプト
├── 📄 export_json.js            ← データエクスポート（修正版）
├── 📄 mahler.js
├── 📄 list_and_notes.js
├── 📄 Richard_Strauss.js
├── 📄 index.html
├── 📄 dic.html
├── 📄 list.html
└── ... 他のファイル（計20個）
```

---

## 🔍 確認方法

GASエディタを開いたら、左側の**ファイルリスト**を確認：

```
ファイル
├─ setup_credentials.js  ← これがあればOK！
├─ github_sync.js        ← これもあればOK！
└─ export_json.js        ← これもあればOK！
```

この3つが表示されていれば、正しいプロジェクトです。

---

## 💡 ブックマーク推奨

よく使うので、以下のURLをブックマークすることをおすすめします：

**GASエディタ:**
```
https://script.google.com/d/1WTZicVS_Dnu5PHQf1RPrXyS03LffwjbTwPu7bn61WTJTfQzTcimC5Pqs/edit
```

**スプレッドシート:**
```
https://docs.google.com/spreadsheets/d/1WTZicVS_Dnu5PHQf1RPrXyS03LffwjbTwPu7bn61WTJTfQzTcimC5Pqs/
```

---

## 🚀 次のステップ

1. 上記のURLでGASエディタを開く
2. `setupGitHubCredentials`を実行
3. テストを実行

---

## ❓ トラブルシューティング

### Q: URLを開いても「アクセスできません」と表示される

**A**: Googleアカウントを確認してください
- 正しいアカウントでログインしていますか？
- スプレッドシートのオーナーは誰ですか？

### Q: ファイルリストに setup_credentials.js がない

**A**: `clasp push` がまだ実行されていません
```powershell
cd c:\Users\okawa\gaswebapp-manual
clasp push
```

### Q: スプレッドシートが見つからない

**A**: スプレッドシートIDで検索してください
1. Google Driveを開く
2. 検索ボックスに: `1WTZicVS_Dnu5PHQf1RPrXyS03LffwjbTwPu7bn61WTJTfQzTcimC5Pqs`
