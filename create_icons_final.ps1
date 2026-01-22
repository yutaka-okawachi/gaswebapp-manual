
# 1. 選択された画像を読み込む (Option F-3)
$sourceImagePath = "c:\Users\okawa\.gemini\antigravity\brain\92443775-8526-432b-8bca-5c1a7d461708\favicon_stained_glass_initials_1769078867700.png"
$webAppDir = "c:\Users\okawa\gaswebapp-manual\mahler-search-app"

# System.Drawingのアセンブリをロード
Add-Type -AssemblyName System.Drawing

# 画像を読み込む
$sourceImage = [System.Drawing.Image]::FromFile($sourceImagePath)

# --- A. favicon.png (透過背景の円形アイコン - ブラウザタブ用) ---
# そのままコピーすればOK（生成画像は既に円形・透過のはずだが、念のためそのまま使う）
# ※もし生成画像が正方形で背景がある場合は切り抜きが必要だが、今回は円形で生成されている前提
# 生成AIの画像は透過PNGではない場合もあるので、念のため「黒背景を透過」などの処理を入れるか、
# あるいは今回は「円形マスク」を適用して透過PNGとして保存し直すのが確実。

$faviconSize = 64
$favicon = New-Object System.Drawing.Bitmap($faviconSize, $faviconSize)
$gFavicon = [System.Drawing.Graphics]::FromImage($favicon)
$gFavicon.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# 円形クリップを作成
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddEllipse(0, 0, $faviconSize, $faviconSize)
$gFavicon.SetClip($path)

# リサイズして描画
$gFavicon.DrawImage($sourceImage, 0, 0, $faviconSize, $faviconSize)

# 保存
$faviconPath = Join-Path $webAppDir "favicon.png"
$favicon.Save($faviconPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created: $faviconPath"


# --- B. apple-touch-icon.png (正方形背景 + 中央にアイコン - スマホホーム画面用) ---
# AndroidやiOSはこれを自動的に角丸にしたり円にしたりする。
# 背景色：ステンドグラスの縁に合わせて「黒」(#000000) または ダークブルー(#003366)
# ステンドグラスは黒縁が綺麗なので、黒背景を採用してみる。

$iconSize = 180 # apple-touch-icon standard size
$mobileIcon = New-Object System.Drawing.Bitmap($iconSize, $iconSize)
$gMobile = [System.Drawing.Graphics]::FromImage($mobileIcon)
$gMobile.Clear([System.Drawing.Color]::Black) # 背景色：黒
# もし以前のダークブルーがいい場合はここを変更: [System.Drawing.ColorTranslator]::FromHtml("#003366")

$gMobile.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

# アイコンの配置サイズ（少し余白を持たせる：80%程度）
$logoSize = [int]($iconSize * 0.85)
$logoX = [int](($iconSize - $logoSize) / 2)
$logoY = [int](($iconSize - $logoSize) / 2)

# 円形クリップして描画（万が一ソースが透過でない場合のため）
# ステンドグラス自体は円形なので、そのまま描画してOKだが、
# 背景となじませるために円形で切り抜いて描画する。
$pathMobile = New-Object System.Drawing.Drawing2D.GraphicsPath
$pathMobile.AddEllipse($logoX, $logoY, $logoSize, $logoSize)
# ここではクリップせず、透過PNGとして上に描画するだけでよい（ソースが透過なら）
# ソースが黒背景の正方形画像だった場合を考慮し、円形マスクをかけて描画する

$gMobile.SetClip($pathMobile)
$gMobile.DrawImage($sourceImage, $logoX, $logoY, $logoSize, $logoSize)
$gMobile.ResetClip()

# 保存
$mobilePath = Join-Path $webAppDir "apple-touch-icon.png"
$mobileIcon.Save($mobilePath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created: $mobilePath"

# リソース解放
$gFavicon.Dispose()
$favicon.Dispose()
$gMobile.Dispose()
$mobileIcon.Dispose()
$sourceImage.Dispose()
