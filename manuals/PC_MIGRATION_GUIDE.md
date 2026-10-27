# PC移行マニュアル

Windows PCの買い替えと、継承者の初回準備に共通する手順です。[マニュアルの入口](README.md)の第2段階に当たります。担当者が替わる場合は先に[継承者マニュアル](SUCCESSOR_GUIDE.md)で権限を確認してください。ダッシュボード固有の作業は[ダッシュボードマニュアル](DASHBOARD_GUIDE.md)第2章を参照してください。

## 1. 旧PCで保存するもの

**前提：** 旧PCで他担当の同期やGit操作が終わっていること。旧PCが使えない場合は、クラウドの管理者と安全なバックアップから設定と未送信作業を回収します。

旧プロジェクトフォルダで次を確認し、結果と作業場所を非公開の引き継ぎ記録に控えます。

```powershell
git status --short
git branch --show-current
git remote -v
git log -1 --oneline
git log --oneline origin/main..HEAD
```

最後の一覧はローカルの`origin/main`が基準です。最新のGitHubとの一致を保証しません。未送信作業は新cloneには入らないため、必要なら`.git`を含む旧フォルダ全体を安全にバックアップします。

- サイト用リポジトリの保存場所、ブランチ、コミット、未コミット・未送信の変更を確認し、必要な変更をバックアップします。
- Gitに含まれない `.env` と `.clasp.json` を安全に保存します。
- GAS固定WebアプリURL、スクリプトID、トークンの保管場所、管理用Google・GitHubアカウントを確認します。
- `output/`、`outputs/`、`tmp/` などに必要な成果物があれば保存します。
- 未完了の同期があれば旧PCで状態を確認します。`.sync-state/` はPC専用の再開記録です。新PCへそのまま移して再開せず、公開済みコミットと未送信変更を照合します。
- ダッシュボード用の別リポジトリとSites接続情報も保存します。サイト用フォルダだけでは画面の開発環境は復元できません。

新PCの動作確認までは旧フォルダを消さないでください。秘密情報をGitHubや公開マニュアルへ書きません。

**成功の目印：** 未送信作業・設定・成果物の保全先が分かる。**次：** 第2章へ。

## 2. ツールと作業フォルダ

**前提：** 自分が書き込める任意の保存場所を用意します。`C:\Users\okawa`と同じ配置は不要です。

| 必要なもの | 用途・確認 |
| --- | --- |
| Windows PowerShell（`powershell.exe`） | `.bat`と同期内のAPI検査が使用。PowerShell 7だけを前提にしない |
| Node.jsと付属のnpm | 組み立て・同期・検証とclasp。セットアップはNode.js LTSの導入を案内する |
| Git for WindowsとGit Credential Manager | clone、変更管理、GitHub認証・送信 |
| `@google/clasp` | 既存GASへのGoogle認証とコード確認・更新。第3章で導入 |
| ブラウザとテキストエディタ | Google/GitHubのログイン、シート編集、設定ファイル復元 |

ダッシュボードも開発する場合は、そのリポジトリが指定するNode.jsの版・依存関係を確認します。本repoのルートには`package.json`がなく、ここで一律に`npm install`する手順はありません。

GitとNode.jsの導入後はPowerShellを開き直します。次のclone例はホーム直下を使いますが、別の親フォルダでも構いません。同名のフォルダが既にあれば重ねてcloneせず、内容を確認するか別の親フォルダを選びます。

```powershell
node --version
npm --version
git --version
powershell.exe -NoProfile -Command '$PSVersionTable.PSVersion'
Set-Location $env:USERPROFILE
git clone https://github.com/yutaka-okawachi/gaswebapp-manual.git
Set-Location .\gaswebapp-manual
git rev-parse --show-toplevel
```

Git管理情報が必要なのでZIP展開だけで同期を始めないでください。旧フォルダをコピーする場合は隠しフォルダ `.git` も必要です。保存場所は旧PCと同じでなくても構いません。

コミット名・メールを自分の値に置き換えて設定します。

```powershell
git config user.name "自分のコミット名"
git config user.email "自分のGitHub登録メールまたはnoreplyメール"
```

GitHub認証は新PCでやり直します。Git Credential Managerを使う場合のログイン例です。

```powershell
git credential-manager github login
```

ブラウザで対象GitHubアカウントを確認します。招待・repoアクセスが不足する場合は管理者へ依頼します。公開repoのcloneや`git ls-remote`の成功は書き込み権限の証明ではありません。同期はpush権限・Pages情報・公開状態のAPI読取りも検査します。

同期は`GH_TOKEN`、次に`GITHUB_TOKEN`、なければ保存済みGit認証を使います。古い環境変数が優先されていないか確認します。値を表示するコマンドや`git credential fill`の出力をログへ残しません。

**成功の目印：** ツールの版が表示され、Gitのルート・main・originを確認できる。**次：** 第3章へ。

## 3. GAS接続の復元

**前提：** 既存の固定GAS URL・スクリプトIDと秘密情報の保管先、対象Googleアカウントが分かること。

1. 初期準備だけなら次の入口を推奨します。最後の本番同期を省略し、Node.js・Git・claspの確認、`.env`作成、Googleログインを対話式で行います。

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-successor.ps1 -SkipSyncTest
```

`01_START_SUCCESSOR_SETUP.bat`も同じスクリプトを呼びますが、`-SkipSyncTest`を付けません。最後の同期テストでは準備中は「いいえ」を選んでください。復元済み`.env`を作り直す質問も、変更が不要なら「いいえ」を選びます。ツール導入後はPowerShellを開き直して版を再確認します。
2. GAS Web App URLには既存の固定URLを入力します。`GAS_SECRET_TOKEN` はGAS側スクリプトプロパティと同じ値を使います。別の読取り専用 `DASHBOARD_API_TOKEN` も安全に引き継ぎ、GAS・Sitesと同じ値を `.env` に設定します。初回の認証移行がまだなら[ダッシュボードマニュアル](DASHBOARD_GUIDE.md)の順序に従い、Sitesを先に更新します。
3. GASを管理するGoogleアカウントでログインします。必要なら次を個別に実行します。

```powershell
npm install -g @google/clasp
clasp --version
clasp login
```

4. **セットアップは `.clasp.json` を作成しません。** 旧PCのものをプロジェクト直下へ安全に復元します。手元にない場合はGAS設定画面のスクリプトIDを確認し、既存プロジェクトを指す設定を作成します。本リポジトリのGASソースは `src/` です。

```json
{
  "scriptId": "既存GASプロジェクトのスクリプトID",
  "rootDir": "src"
}
```

デプロイIDとスクリプトIDは別物です。移行のために新規GASプロジェクトや別の固定URLを作らないでください。

`.env`・`.clasp.json`・clasp認証ファイルはGit対象外です。設定ファイルが`.env.txt`や`.clasp.json.txt`になっていないかも確認します。ログイン済みセッションや認証ファイルの移植を前提にせず、新PCで再認証してください。Apps Script APIやGoogleの権限確認で止まる場合は管理者と確認し、PC交換だけを理由にGASのスコープ・実行主体を変更しません。

5. 最後の「同期テスト」は通常同期を呼ぶため、**本番更新・公開を伴います**。準備中は「いいえ」を選び、次章の確認から進めます。「完了」表示だけでは、スキップしたツールや認証の成功は保証されません。

**成功の目印：** 対象アカウントでログインし、既存GASへの設定を復元できる。**次：** 第4章へ。設定不足や不明なIDは第6章で確認します。

## 4. 初回確認

**前提：** 第3章までの設定が終わり、他の同期や未完了Git操作がないこと。プロジェクト直下で実行します。

```powershell
git status --short
git branch --show-current
git remote -v
git check-ignore .env .clasp.json
clasp status
.\sync-data.ps1 -Mode Check
git diff --check
git status --short
```

通常同期の対象はmainです。`clasp status` は対象ファイルの確認であり、書き込み権限や本番接続の証明ではありません。`-Mode Check` はローカルの組み立て・検証を行い、本番へ公開しません。生成された差分は内容を確認してください。

`git check-ignore`で両設定ファイルが表示されることを確認します。CheckはGAS更新・commit・pushを行いませんが、同期用ファイル等を生成・更新します。クラウド上のシート読戻し、GAS編集版HEAD照合、GitHub書き込み権限は確認しません。Check成功と本番更新可能の判断は別です。

ブラウザごとに[日常保守マニュアル](DEVELOPER_GUIDE.md)第5章の管理者モードを設定し直します。ChromeとEdge、別プロフィールは別設定です。

**成功の目印：** ローカル検査の完了と生成差分の内容を確認できた。**次：** 公開更新を行う日を決めて第5章へ。任意の`node scripts/preview-site.js --open`は現在のローカルデータを表示するだけで、シートの新規取得や公開は行いません。

## 5. 移行完了の確認

**前提：** 公開してよい変更だけを確認し、更新を実施してよいこと。通常同期は確認ボタンなしでcommit・push・必要なGAS更新・公開まで進みます。

初回公開は[日常保守第1〜2章](DEVELOPER_GUIDE.md#1-日常の作業)に従います。シート修正の反映には`.\sync-data.ps1 -Mode Data`を使います。`02_RUN_SYNC.bat`はAutoであり、常にシートを取得するものではありません。完了表示・対象コミットのPages成功・公開ファイル一致・必要なAPI検査を確認し、管理者モードの日英画面で修正内容と検索・辞書実例を確認します。

- ローカル検査が通り、GitHub・GASの権限を確認できている。
- 予定した初回更新が完了し、公開結果を確認できている。
- 管理者モードを使う全ブラウザに設定済みである。
- ダッシュボードの所有者表示と、必要なら画面用開発環境の確認が終わっている。
- 必要な成果物と秘密情報の保管先が確認できる。

PC交換だけなら、クラウド側のスプレッドシート、GASプロパティ、GA4設定、Sites公開を作り直す必要はありません。

**成功の目印：** 新PCで予定した更新と公開確認を終え、必要な作業を回収できた。**次：** [マニュアル入口の第3段階](README.md#edit)から通常運用へ。

## 6. 途中で止まった場合

| 症状 | 確認すること・再開先 |
| --- | --- |
| ツールが見つからない | 第2〜3章の導入とPATH、PowerShellの開き直し、セットアップでスキップした項目 |
| PowerShellで実行できない | セットアップのBypassはそのプロセスだけの指定。組織ポリシーで禁止される場合は管理者へ確認し、端末全体の設定を緩めない |
| clone後に公開権限で停止する | GitHubアカウント、招待・repo権限、保存済み認証、優先される環境変数を照合。秘密値は表示しない |
| Googleログイン後も接続できない | 対象アカウントのGASアクセス、既存scriptId・rootDir、固定URLを確認 |
| トークンやダッシュボード認証で停止する | 安全な保管先、GAS、Sitesの対応を管理者と照合。[ダッシュボードマニュアル](DASHBOARD_GUIDE.md)へ |
| Checkや本番同期で停止する | [日常保守のトラブルシューティング](DEVELOPER_GUIDE.md#2-5-トラブルシューティング)へ。生成物やロック・履歴を独断で削除せず、停止段階を控える |

手順の実装根拠は`01_START_SUCCESSOR_SETUP.bat`、`02_RUN_SYNC.bat`、`scripts/setup-successor.ps1`、`.gitignore`、`sync-data.ps1`、`scripts/sync/`です。ツール起動・ローカル検証・本番権限・公開完了は別々に確認します。
