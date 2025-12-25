# ドキュメント索引

このプロジェクトの各種ガイドへのクイックリファレンスです。

## 🚀 クイックスタート

- [QUICKSTART.md](file:///c:/Users/okawa/gaswebapp-manual/QUICKSTART.md) - 初めての方向け

## 🤖 エージェントへの指示方法

エージェント（AI）に作業を依頼する方法は3つあります。

### 1. ワークフローコマンド（最も簡単）

`/`で始まるコマンドを送信すると、定義済みのワークフローが自動実行されます。

```
/push
```
→ Git変更をプッシュ（自動pull付き）

利用可能なコマンド一覧は [.agent/workflows/](.agent/workflows/) を参照

### 2. 日本語で直接指示

普通の日本語で話しかけるだけで、エージェントが理解して実行します。

**例:**
- `スクリプトを実行してください`
- `clasp pushしてください`
- `git pullしてください`

### 3. 具体的なコマンド実行を依頼

PowerShellコマンドやGitコマンドを直接指定することもできます。

**例:**
- `clasp push --forceを実行してください`
- `git status を確認してください`
- `sync-data.ps1を実行してください`

### 💡 Tips

- **シンプルに**: やりたいことを普通に伝えればOK
- **確認不要**: エージェントが自動的に適切な方法で実行します
- **中断も可能**: 「待ってください」「キャンセルしてください」と伝えればOK

---

## 📚 基本ガイド

### GAS関連
- [GAS_WebApp_Manual.md](file:///c:/Users/okawa/gaswebapp-manual/GAS_WebApp_Manual.md) - GASウェブアプリの基本
- [GAS_PROJECT_LOCATION.md](file:///c:/Users/okawa/gaswebapp-manual/GAS_PROJECT_LOCATION.md) - GASプロジェクトの場所
- [GAS_FUNCTION_EXECUTION_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/GAS_FUNCTION_EXECUTION_GUIDE.md) - 関数実行ガイド
- [GAS_UPLOAD_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/GAS_UPLOAD_GUIDE.md) - アップロード方法

### Clasp関連
- [CLASP_LOGIN_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/CLASP_LOGIN_GUIDE.md) - Claspログイン方法
- [HOW_TO_RUN_SETUP.md](file:///c:/Users/okawa/gaswebapp-manual/HOW_TO_RUN_SETUP.md) - セットアップツール実行方法

### GitHub関連
- [GIT_SYNC_WORKFLOW.md](file:///c:/Users/okawa/gaswebapp-manual/GIT_SYNC_WORKFLOW.md) - **Git同期ワークフロー（重要）**
- [GITHUB_SYNC_MANUAL.md](file:///c:/Users/okawa/gaswebapp-manual/GITHUB_SYNC_MANUAL.md) - GitHub同期マニュアル
- [GITHUB_TOKEN_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/GITHUB_TOKEN_GUIDE.md) - GitHubトークン設定
- [GitHub_Manual_gaswebapp-manual.md](file:///c:/Users/okawa/gaswebapp-manual/GitHub_Manual_gaswebapp-manual.md) - GitHubマニュアル

## 🛠 開発ガイド

### dic.html関連
- [AUTOMATION_SCRIPTS_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/AUTOMATION_SCRIPTS_GUIDE.md) - **自動化スクリプトガイド（重要）**

### SEO
- [GOOGLE_SEARCH_CONSOLE_SETUP.md](file:///c:/Users/okawa/gaswebapp-manual/GOOGLE_SEARCH_CONSOLE_SETUP.md) - Google Search Console設定

## 🆘 トラブルシューティング

- [FIX_GETUI_ERROR.md](file:///c:/Users/okawa/gaswebapp-manual/FIX_GETUI_ERROR.md) - getUi()エラー修正
- [UTF8_ENCODING_FIX.md](file:///c:/Users/okawa/gaswebapp-manual/UTF8_ENCODING_FIX.md) - UTF-8エンコーディング修正

## ⚡ 自動化スクリプト

手作業を効率化するPowerShellスクリプト:

### データ同期・更新（完全自動化✨）
```powershell
# 初回のみ: セットアップ（数分）
.\setup-web-trigger.ps1

# 以降は、これだけで完全自動実行（コミットも自動）！
.\sync-data.ps1
```

**完全自動で実行される処理**:
1. clasp push (GASにアップロード)
2. git commit (ローカル変更をコミット)
3. GAS関数実行 (Web App経由)
4. git pull --rebase (最新データ取得)
5. git push (すべてGitHubへ公開)

詳細: [AUTOMATION_SCRIPTS_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/AUTOMATION_SCRIPTS_GUIDE.md)

## 🤖 ワークフローコマンド

エージェントに以下のコマンドを送信して実行できます。

- `/push` - Git変更をプッシュ（自動pull付き）

詳細は [.agent/workflows/](.agent/workflows/) を参照

## 🔄 よくある作業フロー

### GASでデータ更新 → ローカルでHTML編集 → push

```powershell
# 1. GASでexportAllDataToJsonを実行（ブラウザ）
# または sync-data.ps1 を使うと楽です

# 2. ローカルで作業
# - index.html などを編集

# 3. pushする
/push
# または
.\sync-data.ps1
```

詳細: [GIT_SYNC_WORKFLOW.md](file:///c:/Users/okawa/gaswebapp-manual/GIT_SYNC_WORKFLOW.md)

---

## 📌 重要なポイント

> [!IMPORTANT]
> **Git同期の基本原則**
> 
> 1. ローカルでpushする前に必ず更新（pull）する ⇒ `sync-data.ps1` なら自動でやります
> 2. dic.htmlは直接編集しない
> 3. JSONファイルはスプレッドシート経由で更新する

> [!TIP]
> **迷ったら**
> 
> エージェントに「GIT_SYNC_WORKFLOW.mdを開いて」と指示してください。
