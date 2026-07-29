function New-DashboardApiCheckResult {
    param(
        [bool]$Success,
        [int]$Period,
        [string]$Message
    )

    return [pscustomobject]@{
        Success = $Success
        Period = $Period
        Message = $Message
    }
}

function Test-DashboardHasProperty {
    param(
        $Object,
        [string]$Name
    )

    return (
        $null -ne $Object -and
        $null -ne $Object.PSObject -and
        $Object.PSObject.Properties.Name -contains $Name
    )
}

function Test-DashboardNonNegativeInteger {
    param($Value)

    try {
        $number = [double]$Value
    } catch {
        return $false
    }

    return (
        -not [double]::IsNaN($number) -and
        -not [double]::IsInfinity($number) -and
        $number -ge 0 -and
        [math]::Floor($number) -eq $number
    )
}

function Test-DashboardRate {
    param($Value)

    try {
        $number = [double]$Value
    } catch {
        return $false
    }

    return (
        -not [double]::IsNaN($number) -and
        -not [double]::IsInfinity($number) -and
        $number -ge 0 -and
        $number -le 100
    )
}

function Test-DashboardApiPayload {
    param(
        [string]$Payload,
        [int]$ExpectedPeriod
    )

    if (-not $Payload -or $Payload.TrimStart().StartsWith("<")) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "HTML or empty response"
    }

    try {
        $data = $Payload | ConvertFrom-Json -ErrorAction Stop
    } catch {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid JSON"
    }

    if (Test-DashboardHasProperty -Object $data -Name "error") {
        $errorCode = if ($data.error.code) { [string]$data.error.code } else { "UNKNOWN_ERROR" }
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "API error: $errorCode"
    }

    $requiredTopLevel = @(
        "schemaVersion",
        "period",
        "updatedAt",
        "range",
        "daily",
        "previous",
        "searchSummary",
        "searchMethods",
        "pages",
        "dictionaryExampleMoves",
        "terms"
    )
    foreach ($key in $requiredTopLevel) {
        if (-not (Test-DashboardHasProperty -Object $data -Name $key)) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Missing top-level key: $key"
        }
    }

    if ([int]$data.schemaVersion -ne 2) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Unexpected schemaVersion"
    }
    if ([int]$data.period -ne $ExpectedPeriod) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Unexpected period"
    }
    if (-not $data.updatedAt) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "updatedAt is empty"
    }
    if (
        -not (Test-DashboardHasProperty -Object $data.range -Name "startDate") -or
        -not (Test-DashboardHasProperty -Object $data.range -Name "endDate")
    ) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid range"
    }

    $daily = @($data.daily)
    $previousDaily = @($data.previous.daily)
    $searchMethods = @($data.searchMethods)
    $pages = @($data.pages)
    $dictionaryExampleMoves = @($data.dictionaryExampleMoves)
    $terms = @($data.terms)
    if ($daily.Count -ne $ExpectedPeriod) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "daily length mismatch"
    }
    if ($pages.Count -ne 12) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "pages length mismatch"
    }
    if ($previousDaily.Count -ne $ExpectedPeriod) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "previous daily length mismatch"
    }
    if ($searchMethods.Count -ne 4) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "searchMethods length mismatch"
    }
    if ($dictionaryExampleMoves.Count -ne 3) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "dictionaryExampleMoves length mismatch"
    }

    foreach ($day in $daily) {
        foreach ($key in @("date", "searches", "views", "exampleClicks")) {
            if (-not (Test-DashboardHasProperty -Object $day -Name $key)) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid daily item"
            }
        }
        foreach ($key in @("searches", "views", "exampleClicks")) {
            if (-not (Test-DashboardNonNegativeInteger -Value $day.$key)) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid daily count"
            }
        }
    }

    foreach ($summary in @($data.searchSummary, $data.previous.searchSummary)) {
        foreach ($key in @("withResults", "noResults", "successRate")) {
            if (-not (Test-DashboardHasProperty -Object $summary -Name $key)) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid search summary"
            }
        }
        foreach ($key in @("withResults", "noResults")) {
            if (-not (Test-DashboardNonNegativeInteger -Value $summary.$key)) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid search summary count"
            }
        }
        if (-not (Test-DashboardRate -Value $summary.successRate)) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid search success rate"
        }
    }

    foreach ($method in $searchMethods) {
        foreach ($key in @("key", "label", "count")) {
            if (-not (Test-DashboardHasProperty -Object $method -Name $key)) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid search method"
            }
        }
        if (-not (Test-DashboardNonNegativeInteger -Value $method.count)) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid search method count"
        }
    }

    foreach ($page in $pages) {
        foreach ($key in @("page", "path", "views", "searchMoves", "searches", "exampleClicks", "topTerms")) {
            if (-not (Test-DashboardHasProperty -Object $page -Name $key)) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid page item"
            }
        }
        foreach ($key in @("views", "searchMoves", "searches", "exampleClicks")) {
            if (-not (Test-DashboardNonNegativeInteger -Value $page.$key)) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid page count"
            }
        }
    }

    foreach ($term in $terms) {
        foreach ($key in @("term", "translation", "searches", "pages")) {
            if (-not (Test-DashboardHasProperty -Object $term -Name $key)) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid term item"
            }
        }
        if (-not (Test-DashboardNonNegativeInteger -Value $term.searches)) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid term count"
        }
        foreach ($sourcePage in @($term.pages)) {
            if (
                -not (Test-DashboardHasProperty -Object $sourcePage -Name "name") -or
                -not (Test-DashboardHasProperty -Object $sourcePage -Name "count") -or
                -not (Test-DashboardNonNegativeInteger -Value $sourcePage.count)
            ) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid term page item"
            }
        }
    }

    return New-DashboardApiCheckResult -Success $true -Period $ExpectedPeriod -Message "OK"
}

function Invoke-DashboardApiCheck {
    param(
        [string]$BaseUrl,
        [int]$Period
    )

    if (-not $BaseUrl) {
        return New-DashboardApiCheckResult -Success $false -Period $Period -Message "GAS_DEPLOY_URL is missing"
    }

    $separator = if ($BaseUrl.Contains("?")) { "&" } else { "?" }
    $url = "$($BaseUrl.Trim())${separator}api=dashboard&period=$Period"
    $tempRoot = [System.IO.Path]::GetTempPath()
    $requestId = [guid]::NewGuid().ToString("N")
    $bodyPath = Join-Path $tempRoot "dashboard-api-$requestId.json"
    $errorPath = Join-Path $tempRoot "dashboard-api-$requestId.stderr"

    try {
        # Keep the response body out of PowerShell's native-process text
        # pipeline. Windows PowerShell may decode UTF-8 JSON using the active
        # console code page, which can turn a valid response into invalid JSON.
        $metadataLines = & curl.exe `
            -sS `
            -L `
            --max-time 90 `
            -o "$bodyPath" `
            -w "%{http_code}|%{content_type}" `
            "$url" 2> "$errorPath"
        $curlExitCode = $LASTEXITCODE
        if ($curlExitCode -ne 0) {
            return New-DashboardApiCheckResult -Success $false -Period $Period -Message "HTTP request failed"
        }

        $metadata = @($metadataLines) |
            Where-Object { $_ -match "^\d{3}\|" } |
            Select-Object -Last 1
        $metadataMatch = if ($metadata) {
            [regex]::Match([string]$metadata, "^(\d{3})\|(.*)$")
        } else {
            $null
        }
        if (-not $metadataMatch -or -not $metadataMatch.Success) {
            return New-DashboardApiCheckResult -Success $false -Period $Period -Message "HTTP metadata is missing"
        }

        $httpStatus = [int]$metadataMatch.Groups[1].Value
        $contentType = $metadataMatch.Groups[2].Value.Trim()
        if ($httpStatus -lt 200 -or $httpStatus -ge 300) {
            $typeLabel = if ($contentType) { ", $contentType" } else { "" }
            return New-DashboardApiCheckResult `
                -Success $false `
                -Period $Period `
                -Message "HTTP $httpStatus$typeLabel"
        }

        if (-not (Test-Path -LiteralPath $bodyPath)) {
            return New-DashboardApiCheckResult -Success $false -Period $Period -Message "Empty response body"
        }

        try {
            $utf8 = New-Object System.Text.UTF8Encoding($false, $true)
            $payload = [System.IO.File]::ReadAllText($bodyPath, $utf8)
        } catch {
            return New-DashboardApiCheckResult -Success $false -Period $Period -Message "Invalid UTF-8 response"
        }

        $result = Test-DashboardApiPayload -Payload $payload -ExpectedPeriod $Period
        if (-not $result.Success -and $result.Message -in @("Invalid JSON", "HTML or empty response")) {
            $typeLabel = if ($contentType) { $contentType } else { "unknown content type" }
            $result.Message = "$($result.Message) (HTTP $httpStatus, $typeLabel)"
        }
        return $result
    } catch {
        return New-DashboardApiCheckResult -Success $false -Period $Period -Message "HTTP request failed"
    } finally {
        foreach ($path in @($bodyPath, $errorPath)) {
            if ($path -and (Test-Path -LiteralPath $path)) {
                Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
            }
        }
    }
}
