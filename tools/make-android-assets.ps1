# 生成 Capacitor(@capacitor/assets) 需要的安卓图标与启动图
# 用法: powershell -NoProfile -ExecutionPolicy Bypass -File tools\make-android-assets.ps1
Add-Type -AssemblyName System.Drawing

function New-TankBitmap {
    param([int]$Size, [double]$Padding = 0.0)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 18, 26, 35),
        [System.Drawing.Color]::FromArgb(255, 7, 9, 12),
        [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
    $g.FillRectangle($bg, $rect)

    $gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(48, 42, 58, 74), [Math]::Max(1, $Size / 160))
    foreach ($i in 1..7) {
        $p = $i * $Size / 8
        $g.DrawLine($gridPen, $p, 0, $p, $Size)
        $g.DrawLine($gridPen, 0, $p, $Size, $p)
    }

    # 设计稿 512，缩放并留出安全区
    $s = ($Size * (1 - 2 * $Padding)) / 512.0
    $o = $Size * $Padding

    $trackBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 28, 32, 38))
    $g.FillRectangle($trackBg, $o + 96 * $s, $o + 140 * $s, 320 * $s, 250 * $s)

    $trackBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 58, 63, 70))
    $g.FillRectangle($trackBrush, $o + 100 * $s, $o + 144 * $s, 52 * $s, 242 * $s)
    $g.FillRectangle($trackBrush, $o + 360 * $s, $o + 144 * $s, 52 * $s, 242 * $s)

    $toothBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 22, 25, 30))
    for ($y = 158; $y -le 350; $y += 34) {
        $g.FillRectangle($toothBrush, $o + 100 * $s, $o + $y * $s, 52 * $s, 14 * $s)
        $g.FillRectangle($toothBrush, $o + 360 * $s, $o + $y * $s, 52 * $s, 14 * $s)
    }

    $bodyBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 232, 195, 58))
    $g.FillRectangle($bodyBrush, $o + 172 * $s, $o + 150 * $s, 168 * $s, 240 * $s)

    $lightBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(235, 255, 246, 201))
    $g.FillRectangle($lightBrush, $o + 172 * $s, $o + 150 * $s, 168 * $s, 26 * $s)

    $g.FillRectangle($bodyBrush, $o + 242 * $s, $o + 62 * $s, 28 * $s, 116 * $s)
    $g.FillRectangle($lightBrush, $o + 242 * $s, $o + 62 * $s, 10 * $s, 116 * $s)

    $turretBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 217, 77))
    $g.FillEllipse($turretBrush, $o + 196 * $s, $o + 176 * $s, 120 * $s, 120 * $s)
    $darkTurret = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 168, 128, 28))
    $g.FillEllipse($darkTurret, $o + 216 * $s, $o + 196 * $s, 80 * $s, 80 * $s)
    $g.FillEllipse($lightBrush, $o + 234 * $s, $o + 214 * $s, 44 * $s, 44 * $s)

    $shadow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 0, 0, 0))
    $g.FillRectangle($shadow, $o + 172 * $s, $o + 356 * $s, 168 * $s, 34 * $s)

    $g.Dispose()
    return $bmp
}

function Save-Asset {
    param([int]$Size, [string]$OutPath, [double]$Padding)
    $dir = Split-Path -Parent $OutPath
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $bmp = New-TankBitmap -Size $Size -Padding $Padding
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host ("OK  {0}" -f $OutPath)
}

$root = Split-Path -Parent $PSScriptRoot
Save-Asset -Size 1024 -OutPath (Join-Path $root 'assets\icon-only.png') -Padding 0.06
Save-Asset -Size 1024 -OutPath (Join-Path $root 'assets\icon-foreground.png') -Padding 0.16
Save-Asset -Size 1024 -OutPath (Join-Path $root 'assets\icon-background.png') -Padding 0.0
Save-Asset -Size 2732 -OutPath (Join-Path $root 'assets\splash.png') -Padding 0.34
Save-Asset -Size 2732 -OutPath (Join-Path $root 'assets\splash-dark.png') -Padding 0.34
