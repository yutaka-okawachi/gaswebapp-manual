---
description: Git変更をプッシュ
---

# Git変更のプッシュ

このワークフローは、変更をGitにプッシュするための手順です。

> [!IMPORTANT]
> GASの`exportAllDataToJson`でJSONファイルがリモートに更新されている場合があるため、push前に必ずpullを実行します。

// turbo-all

1. リモートの変更を取り込む（コンフリクト防止）
```bash
git pull --rebase
```

2. 変更をステージングエリアに追加
```bash
git add .
```

3. 変更をコミット（コミットメッセージは適切に変更してください）
```bash
git commit -m "変更内容をここに記載"
```

4. リモートリポジトリにプッシュ
```bash
git push
```
