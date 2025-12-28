# エラー解決：Cannot call SpreadsheetApp.getUi()

## 🔴 エラーの原因

このエラーは、**スプレッドシートから開いていない**ために発生します。

GASプロジェクトを直接開いた場合（`script.google.com`から）、`SpreadsheetApp.getUi()`が使えません。

---

## ✅ 解決方法：2つの選択肢

### 方法1: スプレッドシートから開く（推奨）

#### ステップ1: スプレッドシートを開く
```
https://docs.google.com/spreadsheets/d/1WTZicVS_Dnu5PHQf1RPrXyS03LffwjbTwPu7bn61WTJTfQzTcimC5Pqs/
```

#### ステップ2: Apps Scriptを開く
1. メニューバー → **拡張機能**
2. **Apps Script**

#### ステップ3: setupGitHubCredentials() を実行
これで、UI（ダイアログ）が正しく動作します。

---

### 方法2: UIなし版を使う（簡単）⭐

スプレッドシートから開けない場合は、こちらを使ってください。

#### ステップ1: setup_manual.js を開く

GASエディタで左側のファイルリストから `setup_manual.js` を開く

#### ステップ2: トークンを貼り付け

11行目あたりの以下の部分を編集：

```javascript
const config = {
  GITHUB_TOKEN: 'ghp_YOUR_TOKEN_HERE',  // ← ここにトークンを貼り付け
  GITHUB_OWNER: 'yutaka-okawachi',
  GITHUB_REPO: 'gaswebapp-manual',
  GITHUB_BRANCH: 'main',
  SPREADSHEET_ID: '1WTZicVS_Dnu5PHQf1RPrXyS03LffwjbTwPu7bn61WTJTfQzTcimC5Pqs'
};
```

**変更例：**
```javascript
const config = {
  GITHUB_TOKEN: 'ghp_1234567890abcdefghijklmnopqrstuvwxyz',  // ← 実際のトークン
  GITHUB_OWNER: 'yutaka-okawachi',  // そのまま
  GITHUB_REPO: 'gaswebapp-manual',   // そのまま
  GITHUB_BRANCH: 'main',             // そのまま
  SPREADSHEET_ID: '1WTZicVS_Dnu5PHQf1RPrXyS03LffwjbTwPu7bn61WTJTfQzTcimC5Pqs'  // そのまま
};
```

#### ステップ3: 実行

1. 関数選択ドロップダウンから **`setupGitHubCredentialsManual`** を選択
2. **実行**をクリック
3. 実行ログで「✓ 設定が保存されました」を確認

---

## 🧪 設定確認

設定が正しく保存されたか確認：

1. 関数選択：**`viewGitHubSettingsLog`**
2. **実行**
3. 実行ログを確認：
   ```
   === 現在の設定 ===
   Owner: yutaka-okawachi
   Repo: gaswebapp-manual
   Branch: main
   Spreadsheet ID: 1WTZicVS...
   Token: 設定済み (ghp_123...)
   ```

---

## 🚀 次のステップ

設定完了後、テストを実行：

1. 関数選択：**`testGitHubSync`**
2. **実行**
3. GitHubリポジトリで `test/gas_test.json` が作成されているか確認

---

## 📋 まとめ

| 状況 | 使う関数 |
|------|---------|
| スプレッドシートから開いた | `setupGitHubCredentials()` |
| script.google.comから開いた | `setupGitHubCredentialsManual()` |

**どちらでも同じ結果になります！**

---

## ⚠️ セキュリティに関する注意

`setup_manual.js` にトークンを直接書いた場合：

1. **設定が完了したら、トークンを削除してください**
   ```javascript
   GITHUB_TOKEN: 'ghp_YOUR_TOKEN_HERE',  // ← 元に戻す
   ```

2. **保存**（Ctrl+S）

3. トークンはスクリプトプロパティに保存されており、コードから削除しても動作します

---

## 💡 推奨

できれば**方法1（スプレッドシートから開く）**を使うことをおすすめします。

理由：
- より安全（コードにトークンを書かない）
- UIで確認しながら設定できる
- カスタムメニューも使える
