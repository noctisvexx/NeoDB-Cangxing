<#
发布脚本：创建/更新 GitHub Release 并上传安装包。
Token 读取自用户环境变量 CANGXING_GH_TOKEN，不需要在命令行里出现。

用法：
  查看 Release 列表：
    powershell -File scripts/publish.ps1 -List
  发布新版本：
    powershell -File scripts/publish.ps1 -Tag v2.0.5 -Name "藏星 v2.0.5" -Body "更新说明" `
      -Assets @("dist\藏星 2.0.5.exe", "dist\藏星 Setup 2.0.5.exe") -DeleteTag v2.0.4
#>
param(
  [string]$Tag = "",
  [string]$Name = "",
  [string]$Body = "",
  [string]$Repo = "noctisvexx/NeoDB-Cangxing",
  [string[]]$Assets = @(),
  [string[]]$AssetNames = @(),
  [string]$DeleteTag = "",
  [switch]$List
)

$ErrorActionPreference = "Stop"
$token = [Environment]::GetEnvironmentVariable("CANGXING_GH_TOKEN", "User")
if (-not $token) {
  Write-Error "未找到 CANGXING_GH_TOKEN（用户环境变量）"
  exit 1
}
$api = "https://api.github.com/repos/$Repo"

function Invoke-GhJson {
  param([string]$Method, [string]$Url, [string]$Data = "")
  $args = @("-sS", "-X", $Method, "-H", "Authorization: Bearer $token")
  $tmp = ""
  if ($Data) {
    $tmp = Join-Path $env:TEMP ("gh-body-" + [guid]::NewGuid().ToString("N") + ".json")
    [System.IO.File]::WriteAllText($tmp, $Data, [System.Text.UTF8Encoding]::new($false))
    $args += @("-H", "Content-Type: application/json", "--data-binary", "@$tmp")
  }
  $args += @("--max-time", "60", $Url)
  $out = (& curl.exe @args 2>$null) -join "`n"
  if ($tmp -and (Test-Path -LiteralPath $tmp)) {
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  }
  return $out
}

if ($List) {
  $r = Invoke-GhJson -Method "GET" -Url "$api/releases?per_page=10"
  try {
    $rels = $r | ConvertFrom-Json
    foreach ($x in $rels) {
      $names = ($x.assets | ForEach-Object { $_.name }) -join ", "
      Write-Output "TAG=$($x.tag_name) id=$($x.id) assets=$($x.assets.Count): $names"
    }
  } catch {
    Write-Output $r
  }
  exit 0
}

if (-not $Tag) {
  Write-Error "请提供 -Tag（如 v2.0.5）"
  exit 1
}
if ($Name -eq "") { $Name = "藏星 $($Tag.TrimStart('v'))" }

# 1) 查找或创建 release
$existing = Invoke-GhJson -Method "GET" -Url "$api/releases/tags/$Tag"
$rel = $null
try { $rel = $existing | ConvertFrom-Json } catch { }
if ($rel -and $rel.id) {
  Write-Output "release 已存在，id=$($rel.id)"
} else {
  $bodyJson = @{ tag_name = $Tag; name = $Name; body = $Body } | ConvertTo-Json -Compress
  $created = Invoke-GhJson -Method "POST" -Url "$api/releases" -Data $bodyJson
  $rel = $created | ConvertFrom-Json
  if (-not $rel.id) {
    Write-Error "创建 release 失败：$created"
    exit 1
  }
  Write-Output "release 已创建，id=$($rel.id)"
}

# 2) 上传安装包
for ($i = 0; $i -lt $Assets.Count; $i++) {
  $src = $Assets[$i]
  if (-not (Test-Path -LiteralPath $src)) {
    Write-Error "文件不存在：$src"
    exit 1
  }
  $name = ""
  if ($i -lt $AssetNames.Count -and $AssetNames[$i]) {
    $name = $AssetNames[$i]
  } else {
    $name = (Split-Path -Leaf $src) -replace '^藏星\s+', 'Cangxing-' -replace '\s+', '-'
  }
  $up = "https://uploads.github.com/repos/$Repo/releases/$($rel.id)/assets?name=$([uri]::EscapeDataString($name))"
  $code = curl.exe -sS -o NUL -w '%{http_code}' -X POST -H "Authorization: Bearer $token" -H 'Content-Type: application/octet-stream' --data-binary "@$src" $up --max-time 600
  Write-Output "upload $name -> HTTP $code"
}

# 3) 删除旧 release（可选）
if ($DeleteTag) {
  $old = Invoke-GhJson -Method "GET" -Url "$api/releases/tags/$DeleteTag"
  try {
    $o = $old | ConvertFrom-Json
    if ($o.id) {
      $c = curl.exe -sS -o NUL -w '%{http_code}' -X DELETE -H "Authorization: Bearer $token" "$api/releases/$($o.id)" --max-time 60
      Write-Output "deleted $DeleteTag -> HTTP $c"
    }
  } catch {
    Write-Output "未找到旧 release $DeleteTag"
  }
}
Write-Output "完成：https://github.com/$Repo/releases/tag/$Tag"
