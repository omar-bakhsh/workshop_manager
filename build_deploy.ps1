Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipPath = Join-Path $PSScriptRoot "workshop_deploy.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

# List of files and folders to include
$filesToInclude = @(
    "server.js", "package.json", "package-lock.json", "db.js", "index.html",
    "app-config.js", "script.js", "utils.js", "toast.js", "toast_helpers.js", "toast.css", "style.css",
    "manifest.json", "sw.js", "favicon.ico", "icon-192.svg", "icon-512.svg", "car_diagram.png", "car_diagram.svg",
    "admin.html", "employee.html", "inspector.html", "income_report.html", "inspections_list.html",
    "job_order.html", "job_orders_list.html", "lifts.html", "login.html", "services_manager.html",
    "settings.html", "shortcuts_manager.html", "track.html", "demo.html", "toast_demo.html"
)

# Open zip stream
$zipStream = [System.IO.File]::Create($zipPath)
$archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

# 1. Add root files
foreach ($fileName in $filesToInclude) {
    $filePath = Join-Path $PSScriptRoot $fileName
    if (Test-Path $filePath) {
        $entry = $archive.CreateEntry($fileName, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        $fileStream = [System.IO.File]::Open($filePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $fileStream.CopyTo($entryStream)
        $fileStream.Close()
        $entryStream.Close()
    }
}

# 2. Add public directory files (using '/' forward slash for Linux compatibility)
$publicDir = Join-Path $PSScriptRoot "public"
if (Test-Path $publicDir) {
    $pubFiles = Get-ChildItem -Path $publicDir -Recurse -File
    foreach ($pf in $pubFiles) {
        $relPath = $pf.FullName.Substring($publicDir.Length + 1).Replace("\", "/")
        $entryName = "public/" + $relPath
        $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        $fileStream = [System.IO.File]::Open($pf.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $fileStream.CopyTo($entryStream)
        $fileStream.Close()
        $entryStream.Close()
    }
}

# 3. Add uploads/inspection_photos directory entry
$nullEntry = $archive.CreateEntry("uploads/inspection_photos/", [System.IO.Compression.CompressionLevel]::Optimal)
$nullStream = $nullEntry.Open()
$nullStream.Close()

# 4. Add db.sqlite and default_seed.sqlite if present
$dbFile = Join-Path $PSScriptRoot "db.sqlite"
if (Test-Path $dbFile) {
    try {
        $entry = $archive.CreateEntry("db.sqlite", [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        $fileStream = [System.IO.File]::Open($dbFile, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $fileStream.CopyTo($entryStream)
        $fileStream.Close()
        $entryStream.Close()

        $entrySeed = $archive.CreateEntry("default_seed.sqlite", [System.IO.Compression.CompressionLevel]::Optimal)
        $entrySeedStream = $entrySeed.Open()
        $fileSeedStream = [System.IO.File]::Open($dbFile, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $fileSeedStream.CopyTo($entrySeedStream)
        $fileSeedStream.Close()
        $entrySeedStream.Close()
    } catch {
        Write-Host "db.sqlite warning: $($_.Exception.Message)"
    }
}

$archive.Dispose()
$zipStream.Dispose()

if (Test-Path $zipPath) {
    $size = (Get-Item $zipPath).Length / 1KB
    Write-Host "BUILD_SUCCESS: workshop_deploy.zip created ($([math]::Round($size, 2)) KB)"
}
