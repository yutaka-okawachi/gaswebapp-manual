# ドキュメント索引

このプロジェクトの各種ガイドへのクイックリファレンスです。

## 🚀 クイックスタート

- [QUICKSTART.md](file:///c:/Users/okawa/gaswebapp-manual/QUICKSTART.md) - 初めての方向け

## 🤖 エージェントへの指示方法

エージェント（AI）に作業を依頼する方法は3つあります：

### 1. ワークフローコマンド（最も簡単）

`/`で始まるコマンドを送信すると、定義済みのワークフローが自動実行されます：

```
/dic-layout
```
→ dic.htmlレイアウト変更ワークフローを実行

```
/push
```
→ Git変更をプッシュ（自動pull付き）

利用可能なコマンド一覧は [.agent/workflows/](.agent/workflows/) を参照

### 2. 日本語で直接指示

普通の日本語で話しかけるだけで、エージェントが理解して実行します：

**例：**
- `dic.htmlのレイアウトを更新してください`
- `スクリプトを実行してください`
- `generate_dic_html.jsを編集したいです`
- `clasp pushしてください`
- `git pullしてください`

### 3. 具体的なコマンド実行を依頼

PowerShellコマンドやGitコマンドを直接指定することもできます：

**例：**
- `clasp push --forceを実行してください`
- `git status を確認してください`
- `update-dic-layout.ps1を実行してください`

### 💡 Tips

- **シンプルに**: やりたいことを普通に伝えればOK
- **確認不要**: エージェントが自動的に適切な方法で実行します
- **中断も可能**: 「待ってください」「キャンセルしてください」と伝えるだけ

---

## 📖 基本ガイド

### GAS関連
- [GAS_WebApp_Manual.md](file:///c:/Users/okawa/gaswebapp-manual/GAS_WebApp_Manual.md) - GASウェブアプリの基本
- [GAS_PROJECT_LOCATION.md](file:///c:/Users/okawa/gaswebapp-manual/GAS_PROJECT_LOCATION.md) - GASプロジェクトの場所
- [GAS_FUNCTION_EXECUTION_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/GAS_FUNCTION_EXECUTION_GUIDE.md) - 関数実行ガイド
- [GAS_UPLOAD_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/GAS_UPLOAD_GUIDE.md) - アップロード方法

### Clasp関連
- [CLASP_LOGIN_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/CLASP_LOGIN_GUIDE.md) - Claspログイン方法
- [HOW_TO_RUN_SETUP.md](file:///c:/Users/okawa/gaswebapp-manual/HOW_TO_RUN_SETUP.md) - セットアップ実行方法

### GitHub関連
- [GIT_SYNC_WORKFLOW.md](file:///c:/Users/okawa/gaswebapp-manual/GIT_SYNC_WORKFLOW.md) - **Git同期ワークフロー（重要）**
- [GITHUB_SYNC_MANUAL.md](file:///c:/Users/okawa/gaswebapp-manual/GITHUB_SYNC_MANUAL.md) - GitHub同期マニュアル
- [GITHUB_TOKEN_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/GITHUB_TOKEN_GUIDE.md) - GitHubトークン設定
- [GitHub_Manual_gaswebapp-manual.md](file:///c:/Users/okawa/gaswebapp-manual/GitHub_Manual_gaswebapp-manual.md) - GitHubマニュアル

## 🎨 開発ガイド

### dic.html関連
- [DIC_LAYOUT_CHANGE_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/DIC_LAYOUT_CHANGE_GUIDE.md) - **dic.htmlレイアウト変更ガイド（重要）**
- [AUTOMATION_SCRIPTS_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/AUTOMATION_SCRIPTS_GUIDE.md) - **自動化スクリプトガイド（重要）**

### SEO
- [GOOGLE_SEARCH_CONSOLE_SETUP.md](file:///c:/Users/okawa/gaswebapp-manual/GOOGLE_SEARCH_CONSOLE_SETUP.md) - Google Search Console設定

## 🔧 トラブルシューティング

- [FIX_GETUI_ERROR.md](file:///c:/Users/okawa/gaswebapp-manual/FIX_GETUI_ERROR.md) - getUi()エラー修正
- [UTF8_ENCODING_FIX.md](file:///c:/Users/okawa/gaswebapp-manual/UTF8_ENCODING_FIX.md) - UTF-8エンコーディング修正

## ⚡ 自動化スクリプト

手作業を効率化するPowerShellスクリプト:

### dic.htmlレイアウト更新（完全自動化✨）
```powershell
# 初回のみ: セットアップ（約5分）
.\setup-web-trigger.ps1

# 以降は、これだけで完全自動実行！
.\update-dic-layout.ps1
```

**完全自動で実行される処理**:
1. clasp push (GASにアップロード)
2. GAS関数実行 (Web App経由)
3. git pull (更新を取得)
4. git push (自動プッシュ)

詳細: [AUTOMATION_SCRIPTS_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/AUTOMATION_SCRIPTS_GUIDE.md)

## 🤖 ワークフローコマンド

エージェントに以下のコマンドを送信して実行できます:

- `/push` - Git変更をプッシュ（自動pull付き）
- `/dic-layout` - dic.htmlのレイアウト変更（自動化スクリプト使用）

詳細は [.agent/workflows/](.agent/workflows/) を参照

## 📝 よくある作業フロー

### GASでデータ更新 → ローカルでHTML編集 → push

```powershell
# 1. GASでexportAllDataToJsonを実行（ブラウザ）

# 2. ローカルで作業
# - index.html などを編集

# 3. pushする
/push
```

詳細: [GIT_SYNC_WORKFLOW.md](file:///c:/Users/okawa/gaswebapp-manual/GIT_SYNC_WORKFLOW.md)

### dic.htmlのレイアウト変更

**方法1: ワークフローコマンド（推奨）**
```powershell
/dic-layout
```

**方法2: 直接スクリプト実行**
```powershell
# テンプレートを編集（任意）
code src\generate_dic_html.js

# スクリプト実行（完全自動）
.\update-dic-layout.ps1

# 完了！確認プロンプトなし、全自動で完了
```

**初回のみ**: `.\setup-web-trigger.ps1` でセットアップ（約5分）

詳細: [AUTOMATION_SCRIPTS_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/AUTOMATION_SCRIPTS_GUIDE.md)


### GASコードの更新

```powershell
# 1. src/ 内のファイルを編集（例: export_json.js）

# 2. GASにpush
cd src
clasp push
cd ..

# 3. GASで動作確認

# 4. ローカルの変更をGitHubにpush
/push
```

## 🆘 困ったときは

### コンフリクトが発生した

→ [GIT_SYNC_WORKFLOW.md の「コンフリクトが発生した場合」](file:///c:/Users/okawa/gaswebapp-manual/GIT_SYNC_WORKFLOW.md#コンフリクトが発生した場合)

### dic.htmlを誤って編集してしまった

→ [DIC_LAYOUT_CHANGE_GUIDE.md の「トラブルシューティング」](file:///c:/Users/okawa/gaswebapp-manual/DIC_LAYOUT_CHANGE_GUIDE.md#トラブルシューティング)

### GASの関数実行でエラー

→ [GAS_FUNCTION_EXECUTION_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/GAS_FUNCTION_EXECUTION_GUIDE.md)

---

## 📌 重要なポイント

> [!IMPORTANT]
> **Git同期の基本原則**
> 
> 1. ローカルでpushする前に必ず`/push`コマンドを使う
> 2. dic.htmlは直接編集せず、`/dic-layout`を使う
> 3. JSONファイルはスプレッドシート経由で編集する

> [!TIP]
> **迷ったら**
> 
> エージェントに「GIT_SYNC_WORKFLOW.mdを開いて」と指示してください。
