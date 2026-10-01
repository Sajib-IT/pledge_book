# scripts/generate_android_icons.ps1
Add-Type -AssemblyName System.Drawing

$sourcePath = (Resolve-Path "public/app-icon.jpg").Path
$sourceImg = [System.Drawing.Image]::FromFile($sourcePath)

$logoPath = (Resolve-Path "public/logo.jpg").Path
$logoImg = [System.Drawing.Image]::FromFile($logoPath)

$densities = @(
    @{ Folder = "mipmap-mdpi";    IconSize = 48;  FgSize = 108 },
    @{ Folder = "mipmap-hdpi";    IconSize = 72;  FgSize = 162 },
    @{ Folder = "mipmap-xhdpi";   IconSize = 96;  FgSize = 216 },
    @{ Folder = "mipmap-xxhdpi";  IconSize = 144; FgSize = 324 },
    @{ Folder = "mipmap-xxxhdpi"; IconSize = 192; FgSize = 432 }
)

$resBase = (Resolve-Path "android/app/src/main/res").Path

foreach ($d in $densities) {
    $targetDir = Join-Path $resBase $d.Folder
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }

    # 1. Standard square launcher icon
    $iconBmp = New-Object System.Drawing.Bitmap($d.IconSize, $d.IconSize)
    $g1 = [System.Drawing.Graphics]::FromImage($iconBmp)
    $g1.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g1.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g1.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g1.DrawImage($sourceImg, 0, 0, $d.IconSize, $d.IconSize)
    $g1.Dispose()
    $iconPath = Join-Path $targetDir "ic_launcher.png"
    $iconBmp.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $iconBmp.Dispose()

    # 2. Round launcher icon
    $roundBmp = New-Object System.Drawing.Bitmap($d.IconSize, $d.IconSize)
    $g2 = [System.Drawing.Graphics]::FromImage($roundBmp)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse(0, 0, $d.IconSize, $d.IconSize)
    $g2.SetClip($path)
    $g2.DrawImage($sourceImg, 0, 0, $d.IconSize, $d.IconSize)
    $path.Dispose()
    $g2.Dispose()
    $roundPath = Join-Path $targetDir "ic_launcher_round.png"
    $roundBmp.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $roundBmp.Dispose()

    # 3. Adaptive Foreground Icon (scaled into the 72% safe zone with transparent background)
    $fgBmp = New-Object System.Drawing.Bitmap($d.FgSize, $d.FgSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g3 = [System.Drawing.Graphics]::FromImage($fgBmp)
    $g3.Clear([System.Drawing.Color]::Transparent)
    $g3.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g3.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g3.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $contentSize = [int][Math]::Round($d.FgSize * 0.72)
    $offset = [int][Math]::Round(($d.FgSize - $contentSize) / 2)
    $g3.DrawImage($sourceImg, $offset, $offset, $contentSize, $contentSize)
    $g3.Dispose()
    $fgPath = Join-Path $targetDir "ic_launcher_foreground.png"
    $fgBmp.Save($fgPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $fgBmp.Dispose()

    Write-Host "Updated $($d.Folder) icons successfully."
}

# 4. Update Splash Screens
$splashFiles = Get-ChildItem -Path $resBase -Filter "splash.png" -Recurse
foreach ($sf in $splashFiles) {
    $existing = [System.Drawing.Image]::FromFile($sf.FullName)
    $w = $existing.Width
    $h = $existing.Height
    $existing.Dispose()

    $splashBmp = New-Object System.Drawing.Bitmap($w, $h)
    $sg = [System.Drawing.Graphics]::FromImage($splashBmp)
    $sg.Clear([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $sg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $sg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Calculate centered logo size
    $minDim = [Math]::Min($w, $h)
    $drawWidth = [int][Math]::Round($minDim * 0.45)
    $drawHeight = [int][Math]::Round($drawWidth * ($logoImg.Height / $logoImg.Width))
    if ($drawHeight > ($h * 0.6)) {
        $drawHeight = [int][Math]::Round($h * 0.4)
        $drawWidth = [int][Math]::Round($drawHeight * ($logoImg.Width / $logoImg.Height))
    }
    $x = [int][Math]::Round(($w - $drawWidth) / 2)
    $y = [int][Math]::Round(($h - $drawHeight) / 2)

    $sg.DrawImage($logoImg, $x, $y, $drawWidth, $drawHeight)
    $sg.Dispose()
    $splashBmp.Save($sf.FullName, [System.Drawing.Imaging.ImageFormat]::Png)
    $splashBmp.Dispose()
    Write-Host "Updated splash: $($sf.Directory.Name)/splash.png ($w x $h)"
}

$sourceImg.Dispose()
$logoImg.Dispose()
Write-Host "All Android app icons and splash screens generated successfully!"
