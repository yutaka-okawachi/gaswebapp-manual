$script:DashboardApiAttemptSeconds = 225
$script:DashboardApiPeriods = @(7, 30, 90, 180)

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

    if ($null -eq $Value) { return $false }
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

function Test-DashboardNonNegativeNumber {
    param($Value)

    if ($null -eq $Value) { return $false }
    try {
        $number = [double]$Value
    } catch {
        return $false
    }

    return (
        -not [double]::IsNaN($number) -and
        -not [double]::IsInfinity($number) -and
        $number -ge 0
    )
}

function Test-DashboardRate {
    param($Value)

    if ($null -eq $Value) { return $false }
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
        [int]$ExpectedPeriod,
        [ValidateSet("all", "ja", "en")][string]$ExpectedLanguage = "all"
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
        "retention",
        "pageTrends",
        "acquisition",
        "pages",
        "dictionaryExampleMoves",
        "dictionaryExamplePerformance",
        "terms",
        "works",
        "granularity",
        "cities"
    )
    foreach ($key in $requiredTopLevel) {
        if (-not (Test-DashboardHasProperty -Object $data -Name $key)) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Missing top-level key: $key"
        }
    }

    if ($data.selectedLanguage -ne $ExpectedLanguage) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Unexpected selected language"
    }
    if ([int]$data.schemaVersion -ne 9) {
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
    $dictionaryExamplePerformance = $data.dictionaryExamplePerformance
    $terms = @($data.terms)
    $works = @($data.works)
    $cities = @($data.cities)
    $expectedGranularity = if ($ExpectedPeriod -eq 180) { "week" } else { "day" }
    if ($data.granularity -ne $expectedGranularity) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "granularity mismatch"
    }
    $expectedDailyCount = if ($ExpectedPeriod -eq 180) { 26 } else { $ExpectedPeriod }
    if ($daily.Count -ne $expectedDailyCount) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "daily length mismatch"
    }
    if ($pages.Count -ne 13) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "pages length mismatch"
    }
    if ($previousDaily.Count -ne $expectedDailyCount) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "previous daily length mismatch"
    }
    if ($cities.Count -gt 30) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "cities length exceeds limit"
    }
    if ($searchMethods.Count -ne 4) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "searchMethods length mismatch"
    }
    if ($dictionaryExampleMoves.Count -ne 3) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "dictionaryExampleMoves length mismatch"
    }
    if ($works.Count -gt 50) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "works length exceeds limit"
    }
    if (
        -not (Test-DashboardHasProperty -Object $dictionaryExamplePerformance -Name "sampleCount") -or
        -not (Test-DashboardHasProperty -Object $dictionaryExamplePerformance -Name "averageMilliseconds") -or
        -not (Test-DashboardHasProperty -Object $dictionaryExamplePerformance -Name "composers") -or
        -not (Test-DashboardNonNegativeInteger -Value $dictionaryExamplePerformance.sampleCount) -or
        ($null -ne $dictionaryExamplePerformance.averageMilliseconds -and
            -not (Test-DashboardNonNegativeInteger -Value $dictionaryExamplePerformance.averageMilliseconds)) -or
        @($dictionaryExamplePerformance.composers).Count -ne 3
    ) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid dictionary example performance"
    }
    foreach ($composerTiming in @($dictionaryExamplePerformance.composers)) {
        if (
            -not (Test-DashboardHasProperty -Object $composerTiming -Name "composer") -or
            -not (Test-DashboardHasProperty -Object $composerTiming -Name "path") -or
            -not (Test-DashboardHasProperty -Object $composerTiming -Name "sampleCount") -or
            -not (Test-DashboardHasProperty -Object $composerTiming -Name "averageMilliseconds") -or
            -not (Test-DashboardNonNegativeInteger -Value $composerTiming.sampleCount) -or
            ($null -ne $composerTiming.averageMilliseconds -and
                -not (Test-DashboardNonNegativeInteger -Value $composerTiming.averageMilliseconds))
        ) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid composer example performance"
        }
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

    if (Test-DashboardHasProperty -Object $data -Name "languageSummary") {
        $languageSummary = $data.languageSummary
        $languageRows = @($languageSummary.rows)
        if ($languageSummary.basis -ne "site-page-path" -or $languageRows.Count -ne 3) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid language summary"
        }
        $seenLanguages = @{}
        foreach ($row in $languageRows) {
            if ($row.language -notin @("ja", "en", "unknown") -or $seenLanguages.ContainsKey([string]$row.language) -or [string]::IsNullOrWhiteSpace($row.label)) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid language row"
            }
            $seenLanguages[$row.language] = $true
            foreach ($key in @("views", "searches", "withResults", "noResults", "exampleClicks")) {
                if (-not (Test-DashboardNonNegativeInteger -Value $row.$key)) {
                    return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid language count"
                }
            }
            if ($row.searches -ne ($row.withResults + $row.noResults)) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Inconsistent language searches"
            }
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

    $retention = $data.retention
    foreach ($key in @("granularity", "asOfDate", "summary", "rows")) {
        if (-not (Test-DashboardHasProperty -Object $retention -Name $key)) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid retention data"
        }
    }
    if ($retention.granularity -ne "month" -or @($retention.rows).Count -ne 12) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid retention range"
    }
    foreach ($summaryKey in @("nextMonth", "thirdMonth")) {
        $summary = $retention.summary.$summaryKey
        if (
            -not (Test-DashboardHasProperty -Object $summary -Name "returningUsers") -or
            -not (Test-DashboardHasProperty -Object $summary -Name "eligibleUsers") -or
            -not (Test-DashboardHasProperty -Object $summary -Name "rate") -or
            -not (Test-DashboardNonNegativeInteger -Value $summary.returningUsers) -or
            -not (Test-DashboardNonNegativeInteger -Value $summary.eligibleUsers) -or
            ($null -ne $summary.rate -and -not (Test-DashboardRate -Value $summary.rate))
        ) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid retention summary"
        }
    }
    if ($null -ne $retention.summary.latestFirstVisitUsers -and -not (Test-DashboardNonNegativeInteger -Value $retention.summary.latestFirstVisitUsers)) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid latest retention count"
    }
    foreach ($retentionRow in @($retention.rows)) {
        if (
            -not (Test-DashboardHasProperty -Object $retentionRow -Name "month") -or
            -not (Test-DashboardHasProperty -Object $retentionRow -Name "firstVisitUsers") -or
            -not (Test-DashboardHasProperty -Object $retentionRow -Name "periods") -or
            ($null -ne $retentionRow.firstVisitUsers -and -not (Test-DashboardNonNegativeInteger -Value $retentionRow.firstVisitUsers)) -or
            @($retentionRow.periods).Count -ne 4
        ) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid retention row"
        }
        foreach ($retentionPeriod in @($retentionRow.periods)) {
            if (
                -not (Test-DashboardHasProperty -Object $retentionPeriod -Name "offset") -or
                -not (Test-DashboardHasProperty -Object $retentionPeriod -Name "returningUsers") -or
                -not (Test-DashboardHasProperty -Object $retentionPeriod -Name "rate") -or
                -not (Test-DashboardHasProperty -Object $retentionPeriod -Name "status") -or
                -not (Test-DashboardNonNegativeInteger -Value $retentionPeriod.offset) -or
                ($null -ne $retentionPeriod.returningUsers -and -not (Test-DashboardNonNegativeInteger -Value $retentionPeriod.returningUsers)) -or
                ($null -ne $retentionPeriod.rate -and -not (Test-DashboardRate -Value $retentionPeriod.rate)) -or
                $retentionPeriod.status -notin @("complete", "collecting", "unmeasured")
            ) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid retention period"
            }
        }
    }

    $pageTrends = $data.pageTrends
    foreach ($key in @("granularity", "asOfDate", "range", "pages")) {
        if (-not (Test-DashboardHasProperty -Object $pageTrends -Name $key)) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid page trends"
        }
    }
    if ($pageTrends.granularity -ne "month" -or @($pageTrends.pages).Count -ne 13) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid page trend range"
    }
    foreach ($trendPage in @($pageTrends.pages)) {
        if (
            -not (Test-DashboardHasProperty -Object $trendPage -Name "page") -or
            -not (Test-DashboardHasProperty -Object $trendPage -Name "path") -or
            -not (Test-DashboardHasProperty -Object $trendPage -Name "months") -or
            @($trendPage.months).Count -ne 12
        ) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid page trend page"
        }
        foreach ($trendMonth in @($trendPage.months)) {
            if (
                -not (Test-DashboardHasProperty -Object $trendMonth -Name "month") -or
                -not (Test-DashboardHasProperty -Object $trendMonth -Name "views") -or
                -not (Test-DashboardHasProperty -Object $trendMonth -Name "averageEngagementSeconds") -or
                -not (Test-DashboardHasProperty -Object $trendMonth -Name "searches") -or
                -not (Test-DashboardHasProperty -Object $trendMonth -Name "status") -or
                ($null -ne $trendMonth.views -and -not (Test-DashboardNonNegativeInteger -Value $trendMonth.views)) -or
                ($null -eq $trendMonth.views -and $trendMonth.status -ne "before_launch") -or
                ($null -ne $trendMonth.averageEngagementSeconds -and -not (Test-DashboardNonNegativeNumber -Value $trendMonth.averageEngagementSeconds)) -or
                ($null -ne $trendMonth.searches -and -not (Test-DashboardNonNegativeInteger -Value $trendMonth.searches)) -or
                $trendMonth.status -notin @("complete", "collecting", "before_launch")
            ) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid page trend month"
            }
        }
    }

    $acquisition = $data.acquisition
    foreach ($key in @("granularity", "asOfDate", "range", "totalSessions", "summary", "months", "sources")) {
        if (-not (Test-DashboardHasProperty -Object $acquisition -Name $key)) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid acquisition data"
        }
    }
    if (
        $acquisition.granularity -ne "month" -or
        -not (Test-DashboardNonNegativeInteger -Value $acquisition.totalSessions) -or
        @($acquisition.summary).Count -ne 4 -or
        @($acquisition.months).Count -ne 12
    ) {
        return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid acquisition range"
    }
    foreach ($channel in @($acquisition.summary)) {
        if (
            -not (Test-DashboardHasProperty -Object $channel -Name "key") -or
            -not (Test-DashboardHasProperty -Object $channel -Name "label") -or
            -not (Test-DashboardHasProperty -Object $channel -Name "sessions") -or
            -not (Test-DashboardHasProperty -Object $channel -Name "share") -or
            -not (Test-DashboardNonNegativeInteger -Value $channel.sessions) -or
            -not (Test-DashboardRate -Value $channel.share)
        ) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid acquisition summary"
        }
    }
    foreach ($month in @($acquisition.months)) {
        if (
            -not (Test-DashboardHasProperty -Object $month -Name "month") -or
            -not (Test-DashboardHasProperty -Object $month -Name "totalSessions") -or
            -not (Test-DashboardHasProperty -Object $month -Name "status") -or
            -not (Test-DashboardHasProperty -Object $month -Name "channels") -or
            -not (Test-DashboardNonNegativeInteger -Value $month.totalSessions) -or
            $month.status -notin @("complete", "collecting", "before_launch") -or
            @($month.channels).Count -ne 4
        ) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid acquisition month"
        }
        foreach ($channel in @($month.channels)) {
            if (
                -not (Test-DashboardNonNegativeInteger -Value $channel.sessions) -or
                -not (Test-DashboardRate -Value $channel.share)
            ) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid acquisition monthly channel"
            }
        }
    }
    foreach ($source in @($acquisition.sources)) {
        foreach ($key in @("sourceMedium", "channel", "sessions", "share", "engagementRate", "averageEngagementSeconds", "searches", "searchesPerSession", "landingPage")) {
            if (-not (Test-DashboardHasProperty -Object $source -Name $key)) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid acquisition source"
            }
        }
        if (
            -not (Test-DashboardNonNegativeInteger -Value $source.sessions) -or
            -not (Test-DashboardRate -Value $source.share) -or
            -not (Test-DashboardRate -Value $source.engagementRate) -or
            -not (Test-DashboardNonNegativeNumber -Value $source.averageEngagementSeconds) -or
            -not (Test-DashboardNonNegativeInteger -Value $source.searches) -or
            -not (Test-DashboardNonNegativeNumber -Value $source.searchesPerSession)
        ) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid acquisition source metrics"
        }
    }

    foreach ($page in $pages) {
        foreach ($key in @("page", "path", "views", "averageEngagementSeconds", "searchMoves", "searches", "exampleClicks", "topTerms", "previous")) {
            if (-not (Test-DashboardHasProperty -Object $page -Name $key)) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid page item"
            }
        }
        foreach ($key in @("views", "searchMoves", "searches", "exampleClicks")) {
            if (-not (Test-DashboardNonNegativeInteger -Value $page.$key)) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid page count"
            }
        }
        if (-not (Test-DashboardNonNegativeNumber -Value $page.averageEngagementSeconds)) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid average engagement time"
        }
        if (-not (Test-DashboardHasProperty -Object $page.previous -Name "views") -or
            -not (Test-DashboardHasProperty -Object $page.previous -Name "averageEngagementSeconds") -or
            -not (Test-DashboardHasProperty -Object $page.previous -Name "searches") -or
            -not (Test-DashboardNonNegativeInteger -Value $page.previous.views) -or
            -not (Test-DashboardNonNegativeNumber -Value $page.previous.averageEngagementSeconds) -or
            -not (Test-DashboardNonNegativeInteger -Value $page.previous.searches)) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid previous page metrics"
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

    foreach ($work in $works) {
        foreach ($key in @("workId", "workTitle", "composer", "searches")) {
            if (-not (Test-DashboardHasProperty -Object $work -Name $key)) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid work item"
            }
        }
        if (
            [string]::IsNullOrWhiteSpace([string]$work.workId) -or
            [string]::IsNullOrWhiteSpace([string]$work.workTitle) -or
            [string]$work.composer -notin @("Mahler", "Wagner", "R. Strauss") -or
            -not (Test-DashboardNonNegativeInteger -Value $work.searches)
        ) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid work item value"
        }
    }

    foreach ($cityItem in $cities) {
        foreach ($key in @("city", "country", "displayName", "users", "sessions")) {
            if (-not (Test-DashboardHasProperty -Object $cityItem -Name $key)) {
                return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid city item"
            }
        }
        if (
            [string]::IsNullOrWhiteSpace([string]$cityItem.displayName) -or
            -not (Test-DashboardNonNegativeInteger -Value $cityItem.users) -or
            -not (Test-DashboardNonNegativeInteger -Value $cityItem.sessions)
        ) {
            return New-DashboardApiCheckResult -Success $false -Period $ExpectedPeriod -Message "Invalid city item value"
        }
    }

    return New-DashboardApiCheckResult -Success $true -Period $ExpectedPeriod -Message "OK"
}

function Invoke-DashboardApiCheck {
    param(
        [string]$BaseUrl,
        [int]$Period,
        [ValidateSet("all", "ja", "en")][string]$Language = "all",
        [string]$DashboardToken = $env:DASHBOARD_API_TOKEN
    )

    $metrics = @{ Curl = 'na'; Http = 'na'; Redirects = 'na'; Dns = 'na'; Connect = 'na'; Tls = 'na'; Ttfb = 'na'; RedirectTime = 'na'; Total = 'na' }
    $result = Invoke-DashboardApiCheckTransport -BaseUrl $BaseUrl -Period $Period -Language $Language -DashboardToken $DashboardToken -Metrics $metrics

    # This line is the only per-period output forwarded by the sync runner.
    # No response text, native stderr, URL, or credentials are used.
    $phase = if ($metrics.Curl -notin @('na', '0') -and $metrics.Http -match '^2[0-9]{2}$') {
        'after_response_headers'
    } elseif (($metrics.Redirects -ne 'na' -and [int]$metrics.Redirects -gt 0) -or $metrics.Http -match '^3[0-9]{2}$') {
        'redirect_chain'
    } elseif ($metrics.Http -eq '000') {
        'before_http'
    } elseif ($metrics.Http -ne 'na') {
        'http_response'
    } else {
        'unknown'
    }
    $outcome = if ($result.Success) {
        'ok'
    } elseif ($metrics.Curl -eq '28') {
        'timeout'
    } elseif ($metrics.Curl -notin @('na', '0')) {
        'curl_error'
    } elseif ($result.Message -eq 'API error: UNAUTHORIZED') {
        'unauthorized'
    } elseif ($metrics.Http -ne 'na' -and $metrics.Http -notmatch '^2[0-9]{2}$') {
        'http_error'
    } elseif ($metrics.Http -match '^2[0-9]{2}$') {
        'invalid_response'
    } else {
        'check_error'
    }
    $line = "DASHBOARD_CHECK period=$Period result=$outcome phase=$phase curl=$($metrics.Curl) http=$($metrics.Http) redirects=$($metrics.Redirects) dns_s=$($metrics.Dns) connect_s=$($metrics.Connect) tls_s=$($metrics.Tls) ttfb_s=$($metrics.Ttfb) redirect_s=$($metrics.RedirectTime) total_s=$($metrics.Total)"
    if ($outcome -eq 'invalid_response') {
        # Forward only fixed diagnostic labels, never the message or response body.
        $reason = switch -Wildcard ($result.Message) {
            'HTML or empty response*' { 'html_or_empty'; break }
            'Empty response body' { 'html_or_empty'; break }
            'Invalid JSON*' { 'invalid_json'; break }
            'Invalid UTF-8 response' { 'invalid_utf8'; break }
            'API error:*' { 'api_error'; break }
            'HTTP request failed' { 'check_error'; break }
            'HTTP metadata is missing' { 'check_error'; break }
            default { 'schema_mismatch' }
        }
        $line += " reason=$reason"
    }
    # A timeout after connecting may have left doPost running. Do not replay it,
    # and do not replay a POST after a redirect or an incomplete 2xx response.
    $canRetry = (-not $result.Success) -and $metrics.Redirects -eq '0' -and (
        ($metrics.Curl -in @('6', '7', '28') -and $metrics.Http -eq '000' -and
            $metrics.Connect -match '^0+\.0+$' -and $metrics.Tls -match '^0+\.0+$' -and $metrics.Ttfb -match '^0+\.0+$') -or
        ($metrics.Curl -eq '0' -and $metrics.Http -in @('429', '502', '503', '504'))
    )
    return ($result | Add-Member -NotePropertyMembers @{ Telemetry = $line; CanRetry = $canRetry } -PassThru)
}

function Invoke-DashboardApiVerification {
    param(
        [string]$BaseUrl,
        [string]$DashboardToken,
        [scriptblock]$ElapsedSeconds,
        [scriptblock]$DelaySeconds
    )
    $clock = [System.Diagnostics.Stopwatch]::StartNew()
    if (-not $ElapsedSeconds) { $ElapsedSeconds = { $clock.Elapsed.TotalSeconds } }
    if (-not $DelaySeconds) { $DelaySeconds = { param($seconds) Start-Sleep -Seconds $seconds } }
    $budgetSeconds = 930
    $retryDelaySeconds = 5

    $retryPeriods = @()
    foreach ($period in $script:DashboardApiPeriods) {
        $result = Invoke-DashboardApiCheck -BaseUrl $BaseUrl -Period $period -DashboardToken $DashboardToken
        Write-Output $result
        if ($result.CanRetry) { $retryPeriods += $period }
    }
    foreach ($period in $retryPeriods) {
        # Always reserve the same full request window, and check again after sleep.
        if ((& $ElapsedSeconds) + $retryDelaySeconds + $script:DashboardApiAttemptSeconds -gt $budgetSeconds) { break }
        & $DelaySeconds $retryDelaySeconds
        if ((& $ElapsedSeconds) + $script:DashboardApiAttemptSeconds -gt $budgetSeconds) { break }
        Invoke-DashboardApiCheck -BaseUrl $BaseUrl -Period $period -DashboardToken $DashboardToken
    }
}

function Invoke-DashboardApiCheckTransport {
    param([string]$BaseUrl, [int]$Period, [string]$Language, [string]$DashboardToken, [hashtable]$Metrics)

    if (-not $BaseUrl) {
        return New-DashboardApiCheckResult -Success $false -Period $Period -Message "GAS_DEPLOY_URL is missing"
    }

    if (-not $DashboardToken -or $DashboardToken.Length -lt 32) {
        return New-DashboardApiCheckResult -Success $false -Period $Period -Message "DASHBOARD_API_TOKEN is missing or too short"
    }
    $url = $BaseUrl.Trim()
    if ($url -notmatch '^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$') {
        return New-DashboardApiCheckResult -Success $false -Period $Period -Message "Invalid fixed GAS URL"
    }
    $requestBody = @{ api = 'dashboard'; period = $Period; language = $Language; dashboardToken = $DashboardToken } | ConvertTo-Json -Compress
    $tempRoot = [System.IO.Path]::GetTempPath()
    $requestId = [guid]::NewGuid().ToString("N")
    $bodyPath = Join-Path $tempRoot "dashboard-api-$requestId.json"
    $errorPath = Join-Path $tempRoot "dashboard-api-$requestId.stderr"

    try {
        # Keep the response body out of PowerShell's native-process text
        # pipeline. Windows PowerShell may decode UTF-8 JSON using the active
        # console code page, which can turn a valid response into invalid JSON.
        # Credentials go through stdin, never command-line arguments or URLs.
        $metadataLines = $requestBody | & curl.exe `
            -sS `
            -L `
            --connect-timeout 20 `
            --max-time $script:DashboardApiAttemptSeconds `
            -H "Content-Type: application/json" `
            --data-binary "@-" `
            -o "$bodyPath" `
            -w '%{http_code}|%{content_type}\nDASHBOARD_CURL_METRICS|%{num_redirects}|%{time_namelookup}|%{time_connect}|%{time_appconnect}|%{time_starttransfer}|%{time_redirect}|%{time_total}\n' `
            --stderr "$errorPath" `
            "$url"
        $curlExitCode = $LASTEXITCODE
        if ($null -ne $curlExitCode -and [string]$curlExitCode -match '^[0-9]{1,3}$') {
            $Metrics.Curl = [string]$curlExitCode
        }

        $timingLine = @($metadataLines) |
            Where-Object { $_ -cmatch '^DASHBOARD_CURL_METRICS\|' } |
            Select-Object -Last 1
        if ($timingLine) {
            $seconds = '([0-9]{1,8}\.[0-9]{1,9})'
            $timings = [regex]::Match([string]$timingLine, '^DASHBOARD_CURL_METRICS\|([0-9]{1,3})\|' + ((@($seconds) * 6) -join '\|') + '$')
            if ($timings.Success) {
                $keys = @('Redirects', 'Dns', 'Connect', 'Tls', 'Ttfb', 'RedirectTime', 'Total')
                for ($i = 0; $i -lt $keys.Count; $i++) {
                    $Metrics[$keys[$i]] = $timings.Groups[$i + 1].Value
                }
            }
        }

        $metadata = @($metadataLines) |
            Where-Object { $_ -match "^\d{3}\|" } |
            Select-Object -Last 1
        $metadataMatch = if ($metadata) {
            [regex]::Match([string]$metadata, "^(\d{3})\|(.*)$")
        } else {
            $null
        }
        if ($metadataMatch -and $metadataMatch.Success) {
            $Metrics.Http = $metadataMatch.Groups[1].Value
        }
        if ($curlExitCode -ne 0) {
            return New-DashboardApiCheckResult -Success $false -Period $Period -Message "HTTP request failed"
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

        $result = Test-DashboardApiPayload -Payload $payload -ExpectedPeriod $Period -ExpectedLanguage $Language
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
