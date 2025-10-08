# GitHub 運用マニュアル（gaswebapp-manual リポジトリ）

## 0. 前提
- リポジトリ: `yutaka-okawachi/gaswebapp-manual`
- ローカルパス: `C:\Users\okawa\gaswebapp-manual`
- Clasp 認証は完了済み

---

## 1. 初期設定

### (1) 作業フォルダへ移動
```powershell
cd "C:\Users\okawa\gaswebapp-manual"
```

### (2) Git ユーザー設定（初回のみ）
```powershell
git config --global user.name  "Yutaka Okawachi"
git config --global user.email "あなたのGitHub登録メール"
```

### (3) `.gitignore` の確認
`.gitignore` に以下の行があることを確認。無い場合は追加。
```
.clasprc.json
```

### (4) リモート設定
```powershell
git remote -v
```
出力が無ければ追加:
```powershell
git remote add origin https://github.com/yutaka-okawachi/gaswebapp-manual.git
```
既に存在する場合は更新:
```powershell
git remote set-url origin https://github.com/yutaka-okawachi/gaswebapp-manual.git
```

---

## 2. 初回コミットと push

### (1) 初回コミット
```powershell
git add .
git commit -m "initial commit: GAS web app (clasp project)"
git branch -M main
```

### (2) GitHub に push
```powershell
git push -u origin main
```

### (3) 既存 README 等との競合がある場合
```powershell
git pull origin main --allow-unrelated-histories
# → 衝突を解消して保存
git add .
git commit -m "merge: integrate local with remote"
git push
```

---

## 3. 通常の更新手順

### 変更を GitHub に反映
```powershell
git add .
git commit -m "update: 変更内容を記述"
git push
```

---

## 4. よく使うコマンド

| コマンド | 内容 |
|-----------|-------|
| `git status` | 現在の変更を確認 |
| `git log --oneline -5` | 直近5件のコミット |
| `git remote -v` | 接続先リポジトリを確認 |
| `git diff` | 変更内容を表示 |

---

## 5. 改行警告の対策（任意）

Windows と Git の改行差分を避けるには `.gitattributes` を作成し、以下を記入：

```
* text=auto eol=lf
```

---

## 6. 自動バックアップ（オプション）

### (1) Secret 登録
GitHub → Settings → Secrets and variables → Actions → New repository secret  
- Name: `CLASPRC_JSON`  
- Value: ローカル `~/.clasprc.json` の内容を貼付

### (2) ワークフローを作成
`.github/workflows/gas-backup.yml` を作成し、以下を記入：

```yaml
name: GAS Backup (pull from Apps Script)

on:
  schedule:
    - cron: '0 21 * * *'
  workflow_dispatch: {}

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm i -g @google/clasp@2.4.2
      - name: Restore ~/.clasprc.json
        shell: bash
        env:
          CLASPRC_JSON: ${{ secrets.CLASPRC_JSON }}
        run: |
          printf "%s" "$CLASPRC_JSON" > "$HOME/.clasprc.json"
          chmod 600 "$HOME/.clasprc.json"
      - run: clasp pull
      - run: |
          if [ -n "$(git status --porcelain)" ]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add -A
            git commit -m "chore(gas-backup): sync from Apps Script"
            git push
          else
            echo "No changes."
          fi
```

---

## 7. 運用ルールまとめ

| 操作 | コマンド例 |
|------|-------------|
| ローカル修正を GitHub に反映 | `git add .` → `git commit` → `git push` |
| 他のPCで最新版を取得 | `git pull origin main` |
| GAS 側変更を自動バックアップ | GitHub Actions が毎日実行 |

---

**最終確認:**  
- `.clasprc.json` は `.gitignore` で除外済み  
- `git push` でエラーが出ない  
- GitHub の `main` ブランチに最新コードが反映されている  
これで GitHub 運用体制は完成です。
