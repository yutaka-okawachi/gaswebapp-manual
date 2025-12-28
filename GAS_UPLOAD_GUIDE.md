# GASスクリプトのアップロード手順

## 方法1: clasp を使う（推奨 - 簡単！）

### 前提
- `clasp`がインストール済み
- `.clasp.json`が存在（✓ 既に存在しています）

### 手順

```powershell
# 1. プロジェクトのルートディレクトリへ移動
cd c:\Users\okawa\gaswebapp-manual

# 2. スクリプトをGASプロジェクトへプッシュ
clasp push

# 完了！
```

これだけで、`src/`フォルダ内のすべてのスクリプトがGASプロジェクトへアップロードされます。

---

## 方法2: 手動でコピペ（claspが使えない場合）

### 手順

1. **スプレッドシートを開く**
2. **拡張機能** → **Apps Script**
3. 既存のスクリプトファイルリストの横の **+** → **スクリプト**をクリック

#### ファイル1: github_sync
- ファイル名を `github_sync` に変更
- `c:\Users\okawa\gaswebapp-manual\src\github_sync.js` の内容をコピペ

#### ファイル2: setup_credentials
- **+** → **スクリプト**で新しいファイル作成
- ファイル名を `setup_credentials` に変更
- `c:\Users\okawa\gaswebapp-manual\src\setup_credentials.js` の内容をコピペ

#### ファイル3: export_json（既存ファイルを置き換え）
- 既存の `export_json.js` を開く
- すべて削除して、`c:\Users\okawa\gaswebapp-manual\src\export_json.js` の内容をコピペ

4. **💾 保存**（Ctrl+S）

---

## どちらがおすすめ？

✅ **clasp を使う方法**が圧倒的に簡単です！  
   - コマンド1つで完了
   - ファイルの同期が自動
   - ミスが起きにくい

---

## clasp のインストール（まだの場合）

```powershell
npm install -g @google/clasp
clasp login
```

ログイン後、すぐに `clasp push` が使えます。
