param(
  # デプロイ環境を指定（'staging' または 'production'）
  [Parameter(Mandatory = $true)]
  [ValidateSet('staging', 'production')]
  [string]$env,

  # コミットメッセージやバージョン説明文
  [string]$d = "New version"
)

# 環境ごとのデプロイIDを定義
$deploymentIds = @{
  "production" = "AKfycbxWl-KLwo8SnOyqQT84gJyrofRQnIp_GBv8Pg0N5athPAoxp9LBuwj0HDTXkFqh0xiGsw"
  "staging"    = "AKfycbwgYpxpOQ3kez3T_5AAB6b4eFGy2yhjqcc0r84o4NjVVfq8B54RXLRikVo0rgwhtW-eyQ"
}
$ID = $deploymentIds[$env]

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
  # 4. 抽出したバージョン番号を使って、指定された環境にデプロイ
  clasp deploy -i $ID -V $versionNumber -d $d
} else {
  Write-Error "Failed to create or parse version number from output: $versionOutput"
}

# 元のディレクトリに戻る
Pop-Location
