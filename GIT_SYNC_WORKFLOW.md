# Git同期ワークフロー

GASの自動更新とローカル編集をスムーズに同期するためのガイドです。

## 背景

このプロジェクトでは2つの更新経路があります:

1. **GAS → GitHub**: `exportAllDataToJson`でJSONファイルとHTMLを自動更新
2. **ローカル → GitHub**: HTML/CSSなどをローカルで編集してpush

## コンフリクトを防ぐ方法

### ✅ 推奨ワークフロー

ローカルで編集してpushする前に、**必ずリモートの変更を取り込む**:

```powershell
# /pushコマンドを使う（推奨）
/push
```

エージェントが自動的に以下を実行します:
1. `git pull --rebase` (リモートの変更を取得)
2. `git add .` (変更をステージング)
3. `git commit` (コミット)
4. `git push` (プッシュ)

### 手動で実行する場合

```powershell
# 1. リモートの変更を取り込む
git pull --rebase

# 2. 変更を確認
git status

# 3. 変更をステージング
git add .

# 4. コミット
git commit -m "HTMLを更新"

# 5. プッシュ
git push
```

## `git pull --rebase`とは？

- **`git pull`**: リモートの変更をローカルに統合
- **`--rebase`**: マージコミットを作らず、ローカルの変更をリモートの最新の上に「乗せる」
  - 履歴がきれいになる
  - コンフリクトが起きにくい

## コンフリクトが発生した場合

もしコンフリクトが発生した場合:

```powershell
# 1. コンフリクトしているファイルを確認
git status

# 2. ファイルを手動で編集してコンフリクトを解決

# 3. 解決後、続行
git add <ファイル名>
git rebase --continue

# 4. プッシュ
git push
```

### よくあるケース

**シナリオ**: GASでJSONを更新後、ローカルでHTMLを編集してpush

❌ **誤った手順** (コンフリクト発生):
```powershell
git add .
git commit -m "HTML更新"
git push  # ← エラー！リモートが先に進んでいる
```

✅ **正しい手順**:
```powershell
git pull --rebase  # ← 先にリモートを取得
git add .
git commit -m "HTML更新"
git push  # ← 成功！
```

## Tips

- **GASで更新した直後**: ローカルで作業する前に`git pull`を実行
- **編集中に不安な場合**: `git fetch`でリモートの状態を確認
- **`/push`コマンド**: 常にこのコマンドを使えば自動的に安全

## ファイル管理の原則

### GASが管理するファイル（直接編集しない）

| ファイル | 管理方法 | 編集したい場合 |
|---------|---------|---------------|
| `mahler-search-app/dic.html` | GASが自動生成 | `/dic-layout`で`generate_dic_html.js`を編集 |
| `mahler-search-app/data/*.json` | GASがエクスポート | スプレッドシート経由で編集 |

### ローカルで管理するファイル（自由に編集可）

- `index.html`
- `richard_strauss.html`
- `richard_wagner.html`
- `notes.html`
- `app.js`
- `styles.css`
- その他のHTML/CSS/JS

### 🚨 dic.htmlで特別な注意

`dic.html`はGASで自動生成されるため、**ローカルで直接編集すると上書きされます**。

#### コンフリクトが発生した場合

```powershell
# GAS版を優先（推奨）
git checkout --theirs mahler-search-app/dic.html
git add mahler-search-app/dic.html
git rebase --continue
git push
```

#### レイアウト変更したい場合

`/dic-layout`ワークフローを使用してください:

1. `src/generate_dic_html.js`を編集
2. `clasp push`でGASにアップロード
3. GASで`exportAllDataToJson`を実行
4. `git pull`で取得

詳細は[DIC_LAYOUT_CHANGE_GUIDE.md](file:///c:/Users/okawa/gaswebapp-manual/DIC_LAYOUT_CHANGE_GUIDE.md)を参照。

## まとめ

> [!TIP]
> **常に`/push`コマンドを使う**ことで、コンフリクトを自動的に防げます！
> 
> dic.htmlのレイアウト変更は`/dic-layout`を使用してください。

