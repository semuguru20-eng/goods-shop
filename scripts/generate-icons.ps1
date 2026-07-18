# 굿즈샵 PWA 아이콘 생성 스크립트.
# 선물 상자 모티프, 사이트 색상 변수(--card/--bg/--accent/--text)만 사용.
# 실행: powershell -File scripts/generate-icons.ps1  (반복 실행 가능, icons/*.png를 덮어씀)

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$iconsDir = Join-Path $root "icons"
if (-not (Test-Path $iconsDir)) { New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null }

function New-RoundedRectPath {
    param([double]$x, [double]$y, [double]$w, [double]$h, [double]$r)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function Get-ScaledColor {
    param([System.Drawing.Color]$c, [double]$factor)
    $r = [Math]::Round($c.R * $factor)
    $g = [Math]::Round($c.G * $factor)
    $b = [Math]::Round($c.B * $factor)
    return [System.Drawing.Color]::FromArgb(255, $r, $g, $b)
}

function New-GiftBoxIcon {
    param([string]$Path, [int]$Size)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $cardColor = [System.Drawing.ColorTranslator]::FromHtml("#1b1b24")
    $bgColor = [System.Drawing.ColorTranslator]::FromHtml("#0f0f14")
    $accent = [System.Drawing.ColorTranslator]::FromHtml("#4d7fd9")
    $accentDark = Get-ScaledColor -c $accent -factor 0.6
    $textColor = [System.Drawing.ColorTranslator]::FromHtml("#eceef3")

    # 배경: 대각선 그라디언트, 전체 불투명 (apple-touch-icon 투명도 요건 자동 충족)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point($Size, $Size)),
        $cardColor, $bgColor)
    $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)

    # 선물 상자 본체/뚜껑 좌표 (마스커블 세이프존: 중앙 80% 안에 전부 위치)
    $margin = $Size * 0.16
    $boxLeft = $margin
    $boxRight = $Size - $margin
    $boxWidth = $boxRight - $boxLeft
    $boxTop = $Size * 0.44
    $boxBottom = $Size * 0.80
    $boxHeight = $boxBottom - $boxTop

    $lidOverhang = $Size * 0.02
    $lidTop = $Size * 0.34
    $lidBottom = $boxTop
    $lidLeft = $boxLeft - $lidOverhang
    $lidWidth = $boxWidth + ($lidOverhang * 2)
    $lidHeight = $lidBottom - $lidTop

    $cornerR = $Size * 0.035

    $boxBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF($boxLeft, $boxTop)),
        (New-Object System.Drawing.PointF($boxRight, $boxBottom)),
        $accent, $accentDark)
    $boxPath = New-RoundedRectPath -x $boxLeft -y $boxTop -w $boxWidth -h $boxHeight -r $cornerR
    $g.FillPath($boxBrush, $boxPath)

    $lidBrush = New-Object System.Drawing.SolidBrush($accentDark)
    $lidPath = New-RoundedRectPath -x $lidLeft -y $lidTop -w $lidWidth -h $lidHeight -r ($cornerR * 0.8)
    $g.FillPath($lidBrush, $lidPath)

    $ribbonBrush = New-Object System.Drawing.SolidBrush($textColor)

    # 세로 리본 (뚜껑+본체 관통)
    $ribbonW = $Size * 0.11
    $ribbonX = ($Size / 2) - ($ribbonW / 2)
    $g.FillRectangle($ribbonBrush, $ribbonX, $lidTop, $ribbonW, ($boxBottom - $lidTop))

    # 가로 리본 (본체 중간) — 모든 사이즈 공통, 작은 사이즈에서도 "선물상자" 실루엣 유지
    $hRibbonH = $Size * 0.08
    $hRibbonY = $boxTop + ($boxHeight * 0.32)
    $g.FillRectangle($ribbonBrush, $boxLeft, $hRibbonY, $boxWidth, $hRibbonH)

    if ($Size -ge 64) {
        # 리본 매듭(bow): 겹친 타원 2개 + 중앙 매듭
        $bowW = $Size * 0.15
        $bowH = $Size * 0.11
        $bowY = $lidTop - ($bowH * 0.6)
        $leftBowX = ($Size / 2) - ($bowW * 0.9)
        $rightBowX = ($Size / 2) + ($bowW * 0.9) - $bowW
        $g.FillEllipse($ribbonBrush, $leftBowX, $bowY, $bowW, $bowH)
        $g.FillEllipse($ribbonBrush, $rightBowX, $bowY, $bowW, $bowH)
        $knotSize = $Size * 0.07
        $g.FillEllipse($ribbonBrush, ($Size / 2) - ($knotSize / 2), $bowY + ($bowH / 2) - ($knotSize / 2), $knotSize, $knotSize)
    }
    else {
        # 파비콘(32px): 세밀한 리본 매듭 대신 작은 점 하나로 단순화
        $dotSize = $Size * 0.22
        $g.FillEllipse($ribbonBrush, ($Size / 2) - ($dotSize / 2), $lidTop - ($dotSize * 0.55), $dotSize, $dotSize)
    }

    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

    $g.Dispose()
    $bmp.Dispose()
    $bgBrush.Dispose()
    $boxBrush.Dispose()
    $lidBrush.Dispose()
    $ribbonBrush.Dispose()
    $boxPath.Dispose()
    $lidPath.Dispose()
}

New-GiftBoxIcon -Path (Join-Path $iconsDir "icon-512.png") -Size 512
New-GiftBoxIcon -Path (Join-Path $iconsDir "icon-192.png") -Size 192
New-GiftBoxIcon -Path (Join-Path $iconsDir "apple-touch-icon.png") -Size 180
New-GiftBoxIcon -Path (Join-Path $iconsDir "favicon.png") -Size 32

Get-ChildItem $iconsDir
