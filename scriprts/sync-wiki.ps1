# vaultの場所指定
$VaultRel = "vault"        
$DstRel   = "content"

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot      # scripts/ の1つ上＝リポジトリルート
$SRC   = Join-Path $repoRoot $VaultRel
$SITE  = Join-Path $repoRoot "site"
$DST   = Join-Path $SITE     $DstRel

Write-Host "Source: $SRC"
Write-Host "Site:   $SITE"
Write-Host "Dest:   $DST"

# 出力先を用意（既存は残す）
if (-not (Test-Path $DST)) {
  New-Item $DST -ItemType Directory | Out-Null
}

# 以降は今のままでOK（New-Item -Force で必要なフォルダだけ作る）
Get-ChildItem $SRC -Recurse -Include *.md | ForEach-Object {
  $raw = Get-Content $_.FullName -Raw
  if ($raw -match '(^|\n)publish:\s*true\b' -or $raw -match '(^|\n)draft:\s*false\b') {

    $rel = $_.FullName.Substring($SRC.Length).TrimStart('\','/')
    $out = Join-Path $DST $rel
    New-Item (Split-Path $out) -ItemType Directory -Force | Out-Null

    $raw = $raw `
      -replace '\[\[([^\|\]]+)\|([^\]]+)\]\]', '[$2](/wiki/$1/)' `
      -replace '\[\[([^\]]+)\]\]',             '[$1](/wiki/$1/)'

    Set-Content $out $raw -NoNewline -Encoding UTF8
  }
}

Write-Host "Synced to $DST "