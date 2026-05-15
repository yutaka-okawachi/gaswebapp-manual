# 継承情報チェックリスト

このファイルは、前任者が後継者へ渡す情報を整理するためのチェックリストです。
機密情報そのものをこのリポジトリに書き込むことは避け、パスワードマネージャー、印刷した封書、信頼できる別経路などで渡してください。

## 0. 前任者が事前にやること

後継者がスムーズに作業を始められるよう、前任者は次を済ませておきます。

| やること | 必須度 | 備考 |
|---|---|---|
| 後継者の Google アカウントを確認する | 必須 | Gmail アドレスまたは Google アカウントのメールアドレス |
| Google スプレッドシートを後継者に共有する | 必須 | 「編集者」権限を付与 |
| 後継者が GAS プロジェクトを開けるか確認する | 必須 | スプレッドシートの「拡張機能 > Apps Script」から確認 |
| GitHub アカウント名を確認する | 必須 | collaborator 追加に必要 |
| GitHub リポジトリに後継者を追加する | 必須 | Write 権限以上を付与 |
| `GAS_DEPLOY_URL` を控える | 必須 | 後継者の `.env` 作成に必要 |
| `GAS_SECRET_TOKEN` を安全な方法で渡す | 必須 | GAS スクリプトプロパティ `GAS_SECRET_TOKEN` と同じ値 |
| GitHub PAT の発行手順を伝える | 必須 | 原則として後継者本人が発行 |
| 後継者の PC でセットアップを一緒に確認する | 推奨 | `scripts/setup-successor.ps1` を実行 |
| 後継者の作業フォルダを決める | 推奨 | 例: `ドキュメント\gaswebapp-manual` |
| プロジェクトのフォルダ一式を渡す | 推奨 | GitHub から取得できる人なら clone でも可 |
| `sync-data.ps1` の成功を確認する | 推奨 | 初回だけ一緒に確認すると安全 |
| Google アカウント無効化管理ツールを設定する | 推奨 | 緊急時・長期保守用 |
| GitHub successor 設定を確認する | 推奨 | 緊急時・長期保守用 |

特に重要なのは、Google スプレッドシートの共有、GitHub collaborator 追加、`GAS_SECRET_TOKEN` と `GAS_DEPLOY_URL` の引き渡しです。
この4点が揃っていないと、後継者の PC でセットアップだけ済ませても運用を開始できません。

## 1. プロジェクトの基本情報

| 項目 | 記入内容 |
|---|---|
| 公開サイト URL | `https://yutaka-okawachi.github.io/gaswebapp-manual/` |
| GitHub リポジトリ | `https://github.com/yutaka-okawachi/gaswebapp-manual` |
| 主な用途 | 音楽用語検索アプリの公開、更新、長期保守 |
| 通常の更新方法 | Google スプレッドシート編集後、必要に応じて `.\sync-data.ps1` を実行 |

## 2. Google 関連

| 項目 | 状態 | 備考 |
|---|---|---|
| 後継者を Google スプレッドシートの編集者に追加した | 未確認 | 共有ボタンから編集者として追加 |
| 後継者が GAS プロジェクトを開ける | 未確認 | スプレッドシートの「拡張機能 > Apps Script」 |
| Google アカウント無効化管理ツールを設定した | 未確認 | 長期保守・緊急時用 |
| 通知先メール `NOTIFY_EMAIL` を確認した | 未確認 | GAS スクリプトプロパティ |

### GAS スクリプトプロパティ

GAS エディタの「プロジェクトの設定 > スクリプト プロパティ」にある設定です。
後継者に値そのものを渡す必要があるものと、場所だけ伝えればよいものがあります。

| プロパティ | 必須度 | 後継時の扱い | 説明 |
|---|---|---|---|
| `GAS_SECRET_TOKEN` | 必須 | 値を安全な方法で渡す | 後継者の `.env` に入れる `GAS_SECRET_TOKEN` と同じ値 |
| `GITHUB_TOKEN` | 必須 | 原則、後継者の PAT に差し替える | GAS から GitHub に書き込むためのトークン |
| `GITHUB_OWNER` | 必須 | 現在値を伝える | GitHub の所有者名。通常は `yutaka-okawachi` |
| `GITHUB_REPO` | 必須 | 現在値を伝える | リポジトリ名。通常は `gaswebapp-manual` |
| `GITHUB_BRANCH` | 必須 | 現在値を伝える | 通常は `main` |
| `SPREADSHEET_ID` | 必須 | 現在値を伝える | 対象 Google スプレッドシートの ID |
| `NOTIFY_EMAIL` | 推奨 | 後継者の通知先へ変更する | 検索通知メールの送信先 |
| `SHEET_NAME` | 不要候補 | 現在のコードでは使用していない | `sheet4` タブがないなら古い設定の残りである可能性が高い |

`SHEET_NAME` は現在のリポジトリ内コードでは参照されていません。
ただし、削除前に現在デプロイされている GAS が最新コードか確認してください。
最新コードへ反映済みであれば、`SHEET_NAME` は削除しても運用上の影響はない見込みです。

## 3. GitHub 関連

| 項目 | 状態 | 備考 |
|---|---|---|
| 後継者を GitHub リポジトリの collaborator に追加した | 未確認 | Write 権限以上 |
| GitHub successor 設定を確認した | 未確認 | GitHub アカウント設定 |
| GitHub Pages の公開元を確認した | 未確認 | リポジトリ Settings > Pages |
| 後継者自身の GitHub PAT を発行した | 未確認 | Fine-grained token 推奨 |

## 4. 後継者に安全に渡す情報

| 情報 | 後継者への説明 | 渡し方 | 備考 |
|---|---|---|---|
| GAS Web App URL | セットアップ画面で `GAS Web App URL` と聞かれたら入力する値 | 安全なメモ、パスワードマネージャー等 | `.env` の `GAS_DEPLOY_URL` |
| GAS_SECRET_TOKEN | セットアップ画面で `GAS_SECRET_TOKEN` と聞かれたら入力する値 | パスワードマネージャー等 | GAS スクリプトプロパティ `GAS_SECRET_TOKEN` と同じ値 |
| Google アカウント | `clasp login` で使うアカウント | 共有権限を付与して案内 | 共有で済むならパスワードは渡さない |
| GitHub アカウント | GitHub リポジトリを更新するためのアカウント | 後継者本人が作成・管理 | collaborator に追加する |
| GitHub PAT | GitHub にデータを書き込むための専用トークン | 原則、後継者が再発行 | 前任者の PAT を渡す運用は避ける |
| Google 管理アカウント情報 | 共有だけでは継承できない場合に限って使う情報 | 必要な場合のみ安全な方法で | 共有権限で済むなら共有を優先 |

### 後継者に渡すメモの例

以下は、後継者へ別経路で渡すメモの形式例です。
この欄に実際の秘密情報を書き込んだ状態で GitHub に保存しないでください。
メールや公開チャットではなく、パスワードマネージャー、印刷した紙、直接手渡しなど安全な方法を使ってください。

```text
プロジェクト名:
RWGMRS / gaswebapp-manual

公開サイト:
https://yutaka-okawachi.github.io/gaswebapp-manual/

作業フォルダのおすすめ場所:
ドキュメント\gaswebapp-manual

Google スプレッドシート:
ここに共有済みスプレッドシートのURLを書く

GAS Web App URL:
ここに GAS_DEPLOY_URL の値を書く

GAS_SECRET_TOKEN:
ここに GAS_SECRET_TOKEN の値を書く

GAS スクリプトプロパティ:
GAS_SECRET_TOKEN = ここに値を書く
GITHUB_OWNER = yutaka-okawachi
GITHUB_REPO = gaswebapp-manual
GITHUB_BRANCH = main
SPREADSHEET_ID = ここに値を書く
NOTIFY_EMAIL = ここに通知先メールアドレスを書く
SHEET_NAME = 現在のコードでは不要候補

Google ログインに使うアカウント:
ここに後継者が使うGoogleアカウントを書く

GitHub リポジトリ:
https://github.com/yutaka-okawachi/gaswebapp-manual

GitHub アカウント:
ここに後継者のGitHubユーザー名を書く

最初に実行するもの:
scripts\start-successor-setup.bat
```

## 5. 後継者の PC で確認すること

| 確認項目 | 結果 |
|---|---|
| `.\scripts\setup-successor.ps1` を実行できた | 未確認 |
| Node.js が使える | 未確認 |
| Git が使える | 未確認 |
| `clasp login` が完了した | 未確認 |
| `.env` が作成された | 未確認 |
| `.\sync-data.ps1` が成功した | 未確認 |

## 6. 緊急時に伝える短い説明

後継者には、次のように説明すると混乱が少なくなります。

> データ本体は Google スプレッドシートにあります。  
> 公開サイトは GitHub Pages で表示されています。  
> 通常はスプレッドシートを直し、必要に応じて `sync-data.ps1` を実行するとサイトへ反映されます。  
> 最初のセットアップは `scripts/setup-successor.ps1` を実行してください。
