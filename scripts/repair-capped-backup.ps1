param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Web

function Get-EntryText {
  param([System.IO.Compression.ZipArchiveEntry]$Entry)

  $reader = [System.IO.StreamReader]::new($Entry.Open())
  try {
    return $reader.ReadToEnd()
  } finally {
    $reader.Dispose()
  }
}

function ConvertTo-PlainText {
  param([string]$Html)

  $withoutTags = [regex]::Replace($Html, '<[^>]+>', ' ')
  $decoded = [System.Web.HttpUtility]::HtmlDecode($withoutTags)
  return [regex]::Replace($decoded, '\s+', ' ').Trim()
}

function Get-ChapterTitleCandidates {
  param([string]$Html)

  $candidates = [System.Collections.Generic.List[string]]::new()
  foreach ($pattern in @(
      '<h[1-6]\b[^>]*>(.*?)</h[1-6]>',
      '<strong\b[^>]*>(.*?)</strong>'
    )) {
    foreach (
      $match in [regex]::Matches(
        $Html,
        $pattern,
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase -bor
          [System.Text.RegularExpressions.RegexOptions]::Singleline
      )
    ) {
      $title = ConvertTo-PlainText $match.Groups[1].Value
      if ($title) {
        $candidates.Add($title)
      }
    }
  }
  return @($candidates)
}

function Get-ChapterNumber {
  param([string[]]$Titles)

  foreach ($title in $Titles) {
    $match = [regex]::Match(
      $title,
      '(?i)\bchapter\b[^\d]*(\d+(?:\.\d+)?)'
    )
    if (-not $match.Success) {
      $match = [regex]::Match($title, '(?i)\bch[^\d]*(\d+(?:\.\d+)?)')
    }
    if ($match.Success) {
      return [double]::Parse(
        $match.Groups[1].Value,
        [System.Globalization.CultureInfo]::InvariantCulture
      )
    }
  }

  return $null
}

function Get-PreferredTitle {
  param(
    [string[]]$Titles,
    [long]$ChapterId
  )

  foreach ($title in $Titles) {
    if ($null -ne (Get-ChapterNumber @($title))) {
      return $title
    }
  }
  if ($Titles.Count) {
    return $Titles[0]
  }
  return "Recovered download $ChapterId"
}

function Get-NovelFullCatalog {
  param([string]$NovelPath)

  $novelSlug = $NovelPath -replace '\.html$', ''
  $titleId = switch ($novelSlug) {
    'shadow-slave' { 'VYPGVZ8z' }
    'reverend-insanity' { 'vKY5Lk89' }
    default {
      throw "No exact chapter catalog is configured for NovelFull novel '$NovelPath'."
    }
  }

  $uri = "https://api.novelbuddy.me/titles/$titleId/chapters"
  $response = Invoke-RestMethod -Uri $uri -Headers @{
    'User-Agent' = 'LNReader-backup-repair/2.0'
    'Origin' = 'https://novelfull.io'
  }
  $chapters = @($response.data.chapters)
  if (-not $response.success -or -not $chapters.Count) {
    throw "The exact chapter catalog could not be loaded from $uri."
  }

  $catalog = @{}
  foreach ($chapter in $chapters) {
    if ($null -ne $chapter.number -and $chapter.slug) {
      $catalog[[string][double]$chapter.number] = [pscustomobject]@{
        Name = [string]$chapter.name
        Path = "$novelSlug/$($chapter.slug).html"
        Number = [double]$chapter.number
      }
    }
  }
  return $catalog
}

function Set-InferredNovelFullNumbers {
  param(
    [object]$Novel,
    [object[]]$Downloads,
    [object[]]$ExistingChapters
  )

  $novelSlug = ([string]$Novel.path) -replace '\.html$', ''

  if ($novelSlug -eq 'reverend-insanity') {
    $anchor = $ExistingChapters |
      Where-Object {
        $null -ne $_.id -and
        ($null -ne $_.chapterNumber -or $_.name -match '(?i)\bchapter\b')
      } |
      Sort-Object id -Descending |
      Select-Object -First 1
    if ($null -eq $anchor) {
      throw 'Cannot infer Reverend Insanity chapter numbers without an existing anchor.'
    }
    $anchorNumber = if ($null -ne $anchor.chapterNumber) {
      [double]$anchor.chapterNumber
    } else {
      Get-ChapterNumber @([string]$anchor.name)
    }
    foreach ($download in $Downloads) {
      $download.Number = $anchorNumber + ([long]$download.ChapterId - [long]$anchor.id)
    }
    return
  }

  $sorted = @($Downloads | Sort-Object ChapterId)
  $runs = [System.Collections.Generic.List[object]]::new()
  $current = [System.Collections.Generic.List[object]]::new()
  $previousId = $null
  foreach ($download in $sorted) {
    if ($null -ne $previousId -and $download.ChapterId -ne $previousId + 1) {
      $runs.Add(@($current))
      $current = [System.Collections.Generic.List[object]]::new()
    }
    $current.Add($download)
    $previousId = $download.ChapterId
  }
  if ($current.Count) {
    $runs.Add(@($current))
  }

  foreach ($run in $runs) {
    $anchor = $run | Where-Object { $null -ne $_.Number } | Select-Object -First 1
    if ($null -eq $anchor) {
      if (
        $novelSlug -eq 'shadow-slave' -and
        $run.Count -eq 1 -and
        [long]$run[0].ChapterId -eq 32105
      ) {
        # This downloaded HTML is Shadow Slave chapter 2127, "Act of Defiance".
        $run[0].Number = 2127
        continue
      }
      throw "Cannot infer chapter numbers for download ID run $($run[0].ChapterId)-$($run[-1].ChapterId)."
    }

    foreach ($download in $run) {
      if ($null -eq $download.Number) {
        $download.Number =
          [double]$anchor.Number +
          ([long]$download.ChapterId - [long]$anchor.ChapterId)
      }
    }
  }
}

function Get-RecoveredPosition {
  param(
    [long]$ChapterId,
    [Nullable[double]]$ChapterNumber,
    [object[]]$ExistingChapters,
    [int]$FallbackPosition
  )

  if ($null -ne $ChapterNumber) {
    return [Math]::Max(0, [int][Math]::Round($ChapterNumber) - 1)
  }

  $idAnchor = $ExistingChapters |
    Where-Object { $null -ne $_.id -and $null -ne $_.position } |
    Sort-Object { [Math]::Abs([long]$_.id - $ChapterId) } |
    Select-Object -First 1
  if (
    $null -ne $idAnchor -and
    [Math]::Abs([long]$idAnchor.id - $ChapterId) -le 5000
  ) {
    return [Math]::Max(
      0,
      [int]$idAnchor.position + [int]($ChapterId - [long]$idAnchor.id)
    )
  }

  return $FallbackPosition
}

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)

if ($resolvedInput -eq $resolvedOutput) {
  throw 'InputPath and OutputPath must be different so the original backup remains untouched.'
}

$outputDirectory = [System.IO.Path]::GetDirectoryName($resolvedOutput)
if (-not [System.IO.Directory]::Exists($outputDirectory)) {
  [System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
}
if ([System.IO.File]::Exists($resolvedOutput)) {
  throw "Output already exists: $resolvedOutput"
}

$novelsById = @{}
$entryNameByNovelId = @{}
$globalChapterIds = [System.Collections.Generic.HashSet[long]]::new()
$downloadedHtmlByNovelId = @{}

$outer = [System.IO.Compression.ZipFile]::OpenRead($resolvedInput)
try {
  foreach ($entry in $outer.Entries) {
    if ($entry.FullName -notmatch '^NovelAndChapters/[^/]+\.json$') {
      continue
    }

    $novel = Get-EntryText $entry | ConvertFrom-Json
    $novelId = [long]$novel.id
    $novelsById[[string]$novelId] = $novel
    $entryNameByNovelId[[string]$novelId] = $entry.FullName
    foreach ($chapter in @($novel.chapters)) {
      [void]$globalChapterIds.Add([long]$chapter.id)
    }
  }

  $downloadEntry = $outer.GetEntry('download.zip')
  if ($null -eq $downloadEntry) {
    throw 'The backup does not contain download.zip.'
  }

  $inner = [System.IO.Compression.ZipArchive]::new(
    $downloadEntry.Open(),
    [System.IO.Compression.ZipArchiveMode]::Read,
    $false
  )
  try {
    foreach ($entry in $inner.Entries) {
      $match = [regex]::Match(
        $entry.FullName,
        '^Novels/([^/]+)/(\d+)/(\d+)/index\.html$'
      )
      if (-not $match.Success) {
        continue
      }

      $novelId = [long]$match.Groups[2].Value
      $chapterId = [long]$match.Groups[3].Value
      if (
        -not $novelsById.ContainsKey([string]$novelId) -or
        $globalChapterIds.Contains($chapterId)
      ) {
        continue
      }

      $key = [string]$novelId
      if (-not $downloadedHtmlByNovelId.ContainsKey($key)) {
        $downloadedHtmlByNovelId[$key] =
          [System.Collections.Generic.List[object]]::new()
      }
      $titles = @(Get-ChapterTitleCandidates (Get-EntryText $entry))
      $downloadedHtmlByNovelId[$key].Add(
        [pscustomobject]@{
          ChapterId = $chapterId
          Titles = $titles
          Title = Get-PreferredTitle $titles $chapterId
          Number = Get-ChapterNumber $titles
        }
      )
      [void]$globalChapterIds.Add($chapterId)
    }
  } finally {
    $inner.Dispose()
  }
} finally {
  $outer.Dispose()
}

$repairSummary = [System.Collections.Generic.List[object]]::new()
foreach ($novelIdKey in $downloadedHtmlByNovelId.Keys) {
  $novel = $novelsById[$novelIdKey]
  $existing = @($novel.chapters)
  $downloads = @($downloadedHtmlByNovelId[$novelIdKey] | Sort-Object ChapterId)
  $catalog = $null

  if ($novel.pluginId -eq 'novelfull') {
    $catalog = Get-NovelFullCatalog ([string]$novel.path)
    Set-InferredNovelFullNumbers $novel $downloads $existing
  }

  $maxPosition = ($existing | Measure-Object -Property position -Maximum).Maximum
  if ($null -eq $maxPosition) {
    $maxPosition = -1
  }
  $fallbackPosition = [int]$maxPosition + 1
  $recovered = [System.Collections.Generic.List[object]]::new()
  $recoveredPaths = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::Ordinal
  )
  $duplicateDownloads = 0

  foreach ($download in $downloads) {
    $chapterNumber = $download.Number
    $title = $download.Title

    if ($novel.pluginId -eq 'novelfull') {
      $catalogChapter = $catalog[[string][double]$chapterNumber]
      if ($null -eq $catalogChapter) {
        throw "No exact catalog match for $($novel.name) chapter $chapterNumber."
      }
      $path = $catalogChapter.Path
      $title = $catalogChapter.Name
      $chapterNumber = $catalogChapter.Number
    } elseif ($novel.pluginId -eq 'novelfire') {
      $position = Get-RecoveredPosition `
        $download.ChapterId `
        $chapterNumber `
        $existing `
        $fallbackPosition
      $chapterNumber = $position + 1
      $path = "$($novel.path)/chapter-$chapterNumber"
      if ($title -like 'Recovered download *') {
        $title = "Chapter $chapterNumber"
      }
    } else {
      throw "Cannot safely reconstruct exact paths for plugin '$($novel.pluginId)'."
    }

    $position = Get-RecoveredPosition `
      $download.ChapterId `
      $chapterNumber `
      $existing `
      $fallbackPosition
    $fallbackPosition = [Math]::Max($fallbackPosition + 1, $position + 1)

    if ($existing.path -contains $path) {
      throw "Refusing to create duplicate chapter path '$path' for $($novel.name)."
    }
    if (-not $recoveredPaths.Add($path)) {
      $duplicateDownloads++
      continue
    }

    $recovered.Add(
      [pscustomobject][ordered]@{
        id = [long]$download.ChapterId
        novelId = [long]$novel.id
        path = $path
        name = $title
        releaseTime = $null
        bookmark = $false
        unread = $true
        readTime = $null
        isDownloaded = $true
        updatedTime = $null
        chapterNumber = $chapterNumber
        page = '1'
        position = $position
        progress = $null
        scanlator = $null
        timeSpent = 0
      }
    )
  }

  $novel.chapters = @($existing) + @($recovered)
  $repairSummary.Add(
    [pscustomobject]@{
      NovelId = [long]$novel.id
      Novel = $novel.name
      RecoveredDownloads = $recovered.Count
      DuplicateDownloadCopies = $duplicateDownloads
      TotalChapterRows = @($novel.chapters).Count
      PlaceholderPaths = @(
        $novel.chapters |
          Where-Object { $_.path -like '__lnreader_recovered_download__/*' }
      ).Count
    }
  )
}

[System.IO.File]::Copy($resolvedInput, $resolvedOutput, $false)
$updated = [System.IO.Compression.ZipFile]::Open(
  $resolvedOutput,
  [System.IO.Compression.ZipArchiveMode]::Update
)
try {
  foreach ($summary in $repairSummary) {
    $key = [string]$summary.NovelId
    $entryName = $entryNameByNovelId[$key]
    $existingEntry = $updated.GetEntry($entryName)
    if ($null -ne $existingEntry) {
      $existingEntry.Delete()
    }

    $newEntry = $updated.CreateEntry(
      $entryName,
      [System.IO.Compression.CompressionLevel]::Optimal
    )
    $writer = [System.IO.StreamWriter]::new(
      $newEntry.Open(),
      [System.Text.UTF8Encoding]::new($false)
    )
    try {
      $writer.Write(($novelsById[$key] | ConvertTo-Json -Depth 12 -Compress))
    } finally {
      $writer.Dispose()
    }
  }
} finally {
  $updated.Dispose()
}

$repairSummary |
  Sort-Object NovelId |
  Format-Table -AutoSize
"Repaired backup: $resolvedOutput"
"Recovered downloaded chapter rows: $(($repairSummary | Measure-Object -Property RecoveredDownloads -Sum).Sum)"
