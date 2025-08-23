# --- ここだけ直す -------------------------------------------------
$VaultRel = "emily-walker"        # ← ここを vault に
$SrcRel   = "Wiki"         # ← ノートの元フォルダ（例：vault/Wiki）。丸ごとなら "."
$DstRel   = "content\wiki" # ← 出力先（site/content/wiki）
# ------------------------------------------------------------------

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot      # scripts/ の1つ上＝リポジトリルート
$VAULT = Join-Path $repoRoot $VaultRel
$SRC   = Join-Path $VAULT    $SrcRel
$SITE  = Join-Path $repoRoot "site"
$DST   = Join-Path $SITE     $DstRel

Write-Host "Vault:  $VAULT"
Write-Host "Source: $SRC"
Write-Host "Site:   $SITE"
Write-Host "Dest:   $DST"

# 出力先を作り直し
if (Test-Path $DST) { Remove-Item $DST -Recurse -Force }
New-Item $DST -ItemType Directory | Out-Null

# publish:true もしくは draft:false のノートだけ同期
Get-ChildItem $SRC -Recurse -Include *.md | ForEach-Object {
  $raw = Get-Content $_.FullName -Raw
  if ($raw -match '(^|\n)publish:\s*true\b' -or $raw -match '(^|\n)draft:\s*false\b') {

    # 相対パスを維持してコピー
    $rel = $_.FullName.Substring($SRC.Length).TrimStart('\','/')
    $out = Join-Path $DST $rel
    New-Item (Split-Path $out) -ItemType Directory -Force | Out-Null

    # Wikilink を最低限 /wiki/ スキームへ（[[slug|表示]] / [[slug]])
    $raw = $raw `
      -replace '\[\[([^\|\]]+)\|([^\]]+)\]\]', '[$2](/wiki/$1/)' `
      -replace '\[\[([^\]]+)\]\]', '[$1](/wiki/$1/)'

    Set-Content $out $raw -NoNewline -Encoding UTF8
  }
}

Write-Host "✅ Synced to $DST"
