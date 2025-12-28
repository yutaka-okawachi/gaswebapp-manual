# GitHub Personal Access Token 作成手順（詳細版）

GitHubのUIは頻繁に変更されるので、最新の手順を説明します。

---

## 方法1: 直接URLにアクセス（最速）

### ステップ1: トークン作成ページへ直接アクセス

**このURLを開いてください:**
```
https://github.com/settings/tokens?type=beta
```

または

```
https://github.com/settings/personal-access-tokens/new
```

これで直接トークン作成ページが開きます！

---

## 方法2: GitHubのメニューから探す

UIが変更されている可能性があるので、いくつかのパターンを紹介します。

### パターンA（新UI）

1. **GitHub.com**にログイン
2. 右上のプロフィールアイコンをクリック
3. **Settings**（設定）
4. 左サイドバーを一番下までスクロール
5. **Developer settings**（開発者向け設定）
   - ⚠️ 見つからない場合は、サイドバーの**Access**セクション内を確認
6. **Personal access tokens**
7. **Fine-grained tokens**（または**Tokens (classic)**）
8. **Generate new token**

### パターンB（一部のアカウント）

1. **GitHub.com**にログイン
2. 右上のプロフィールアイコン → **Settings**
3. 左サイドバーの**Access**セクション内:
   - **Personal access tokens**を直接クリック
4. **Fine-grained tokens**
5. **Generate new token**

---

## トークン作成の設定

### 基本情報
- **Token name**: `GAS Spreadsheet Sync`（わかりやすい名前）
- **Expiration**: `90 days`または`1 year`
- **Description**（オプション）: `Google Apps Scriptからスプレッドシートデータを自動プッシュ`

### Repository access（重要！）
- **Only select repositories**を選択
- **Select repositories**で `gaswebapp-manual`を選択

### Permissions（権限）
- **Repository permissions**の中から:
  - **Contents**: `Read and write`（読み取りと書き込み）✅
  - 他は不要（すべてデフォルトのまま）

### 完了
- **Generate token**をクリック
- 🔑 **表示されたトークンをコピー**（重要：再表示できません！）

---

## トークンが見つからない場合の対処法

### 検索機能を使う

1. GitHubの**Settings**ページを開く
2. ブラウザの検索機能（Ctrl+F）で以下を検索:
   - `personal access`
   - `tokens`
   - `developer`

### 古いUI（Classic tokens）でも可

Fine-grained tokensが見つからない場合、**Personal access tokens (classic)**でも動作します：

1. **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. **Generate new token (classic)**
3. 権限で以下をチェック:
   - ✅ `repo`（フルリポジトリアクセス）
4. **Generate token**

---

## トークンの保存

⚠️ **重要**: トークンは一度しか表示されません！

**保存方法:**
1. トークンをコピー
2. メモ帳などに一時保存
3. GASの`setupGitHubCredentials()`実行時に貼り付け

---

## トラブルシューティング

### Q: Developer settingsが見つからない

**A**: 以下を確認してください:
1. GitHubにログインしているか
2. 個人アカウントの設定を開いているか（組織アカウントではない）
3. サイドバーを一番下までスクロールしたか

### Q: Fine-grained tokensが見つからない

**A**: アカウントによっては古いUIのままです。**Tokens (classic)**を使ってください。

### Q: トークン作成後にエラーが出る

**A**: 権限設定を確認:
- リポジトリが正しく選択されているか
- `Contents`権限が`Read and write`になっているか

---

## 参考スクリーンショット（イメージ）

```
GitHub画面構成:
┌─────────────────────────────────────┐
│ Profile Icon → Settings             │
│                                     │
│ 左サイドバー:                         │
│  - Public profile                   │
│  - Account                          │
│  - Appearance                       │
│  - ...（スクロール）                   │
│  - Applications                     │
│  - Scheduled reminders              │
│  ────────────────────────           │
│  - Developer settings ← ここ！       │
│    - Personal access tokens         │
│      - Fine-grained tokens ← ここ！  │
└─────────────────────────────────────┘
```

---

## 最速の方法（まとめ）

1. **直接URL**: https://github.com/settings/tokens?type=beta
2. トークン名: `GAS Spreadsheet Sync`
3. Repository: `gaswebapp-manual`のみ
4. Permissions: `Contents` → `Read and write`
5. **Generate token**
6. トークンをコピー！
