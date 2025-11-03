param(
  # -d で説明文を受け取る。指定がなければ "New version" を使う
  [string]$d = "New version"
)

$ID = "AKfycbxWl-KLwo8SnOyqQT84gJyrofRQnIp_GBv8Pg0N5athPAoxp9LBuwj0HDTXkFqh0xiGsw"

# スクリプトがどこから実行されても正しく動作するように、
# claspが管理するソースコードのルートディレクトリに移動する
Push-Location "c:\Users\okawa\gaswebapp-manual\src"

# 1. ローカルの変更をGASにプッシュ
clasp push

# 2. 新しいバージョンを作成し、出力を変数に格納
$versionOutput = clasp version $d

# 3. 出力からバージョン番号を正規表現で抽出 (例: "Created version 567." → "567")
if ($versionOutput -match "Created version (\d+)") {
  $versionNumber = $Matches[1]
  Write-Host "Successfully created version: $versionNumber"
  # 4. 抽出したバージョン番号を使ってデプロイ
  clasp deploy -i $ID -V $versionNumber -d $d
} else {
  Write-Error "Failed to create or parse version number from output: $versionOutput"
}

# 元のディレクトリに戻る
Pop-Location
