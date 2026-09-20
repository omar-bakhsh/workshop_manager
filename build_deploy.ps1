Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipPath = Join-Path $PSScriptRoot "workshop_deploy.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }

# List of root files to include in deployment package
$filesToInclude = @(
    "server.js",
    "import_clients.js",
    "db.js",
    "package.json",
    "package-lock.json",
    ".env.example",
    "index.html",
    "login.html",
    "admin.html",
    "employee.html",
    "inspector.html",
    "income_report.html",
    "inspections_list.html",
    "job_order.html",
    "job_orders_list.html",
    "lifts.html",
    "employees_manager.html",
    "services_manager.html",
    "settings.html",
    "shortcuts_manager.html",
    "clients_manager.html",
    "marketing.html",
    "track.html",
    "demo.html",
    "toast_demo.html",
    "app-config.js",
    "script.js",
    "utils.js",
    "toast.js",
    "toast_helpers.js",
    "toast.css",
    "style.css",
    "manifest.json",
    "sw.js",
    "ecosystem.config.js",
    "Procfile",
    "favicon.ico",
    "icon-192.svg",
    "icon-512.svg",
    "car_diagram.png",
    "car_diagram.jpg",
    "car_diagram.svg"
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
    } else {
        Write-Warning "File not found: $fileName"
    }
}

# 2. Add public directory files (using '/' forward slash for Linux/Unix hosting compatibility)
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

# 3. Add server_parts directory if present
$serverPartsDir = Join-Path $PSScriptRoot "server_parts"
if (Test-Path $serverPartsDir) {
    $spFiles = Get-ChildItem -Path $serverPartsDir -Recurse -File
    foreach ($spf in $spFiles) {
        $relPath = $spf.FullName.Substring($serverPartsDir.Length + 1).Replace("\", "/")
        $entryName = "server_parts/" + $relPath
        $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $entryStream = $entry.Open()
        $fileStream = [System.IO.File]::Open($spf.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $fileStream.CopyTo($entryStream)
        $fileStream.Close()
        $entryStream.Close()
    }
}

# 4. Add uploads directory structure with placeholder
$nullEntry = $archive.CreateEntry("uploads/inspection_photos/", [System.IO.Compression.CompressionLevel]::Optimal)
$nullStream = $nullEntry.Open()
$nullStream.Close()

# 5. Add db.sqlite and default_seed.sqlite
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
    Write-Host "BUILD_SUCCESS: workshop_deploy.zip created successfully ($([math]::Round($size, 2)) KB)"
}
