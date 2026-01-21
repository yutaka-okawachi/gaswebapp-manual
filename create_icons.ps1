
Add-Type -AssemblyName System.Drawing

$sourcePath = "c:\Users\okawa\.gemini\antigravity\brain\92443775-8526-432b-8bca-5c1a7d461708\favicon_refined_transparent_1769006632869.png"
$targetDir = "c:\Users\okawa\gaswebapp-manual\mahler-search-app"
$faviconPath = Join-Path $targetDir "favicon.png"
$appleIconPath = Join-Path $targetDir "apple-touch-icon.png"

# 1. Update favicon.png (use the transparent one)
Write-Host "Updating favicon.png..."
Copy-Item -Path $sourcePath -Destination $faviconPath -Force
Write-Host "favicon.png updated."

# 2. Create apple-touch-icon.png (Square, Dark Blue Background)
Write-Host "Creating apple-touch-icon.png..."

# Size for apple-touch-icon (usually 180x180 is enough, but let's go high res 512x512 for safety)
$size = 512
$padding = 80 # Padding around the logo

$bitmap = New-Object System.Drawing.Bitmap($size, $size)
$graph = [System.Drawing.Graphics]::FromImage($bitmap)

# Background Color - Dark Blue (Matching the user's preference/logo theme)
# Using a standard dark blue consistent with the "Ornamental" theme description (#003366 or similar)
# Let's pick a nice deep slightly grayish blue to match Mahler/classic vibe, or just pure dark blue.
# User mentioned #003366 earlier in plan, let's use that.
$bgColor = [System.Drawing.ColorTranslator]::FromHtml("#003366")
$brush = New-Object System.Drawing.SolidBrush($bgColor)
$graph.FillRectangle($brush, 0, 0, $size, $size)

# Load Source Image
$sourceImg = [System.Drawing.Image]::FromFile($sourcePath)

# Calculate centering
$destW = $size - ($padding * 2)
$destH = $size - ($padding * 2)
$destX = $padding
$destY = $padding

# Draw Source Image
# Use HighQualityBicubic for better scaling
$graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graph.DrawImage($sourceImg, $destX, $destY, $destW, $destH)

# Save
$bitmap.Save($appleIconPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Cleanup
$graph.Dispose()
$bitmap.Dispose()
$sourceImg.Dispose()
$brush.Dispose()

Write-Host "apple-touch-icon.png created at $appleIconPath"
