$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "dashboard-api-check.ps1")

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
}

$script:testDashboardPayloads = @{}
foreach ($period in @(7, 30, 90, 180)) {
    $daily = @()
    $dailyCount = if ($period -eq 180) { 26 } else { $period }
    for ($i = 0; $i -lt $dailyCount; $i++) {
        $daily += @{
            date = "7/26"
            searches = 0
            views = 0
            exampleClicks = 0
        }
    }

    $pages = @()
    for ($i = 0; $i -lt 13; $i++) {
        $pages += @{
            page = "Page $i"
            path = "/page-$i"
            views = 0
            averageEngagementSeconds = 0
            searchMoves = 0
            searches = 0
            exampleClicks = 0
            topTerms = @()
            previous = @{
                views = 0
                averageEngagementSeconds = 0
                searches = 0
            }
        }
    }

    $payload = @{
        schemaVersion = 9
        selectedLanguage = "all"
        period = $period
        granularity = if ($period -eq 180) { "week" } else { "day" }
        updatedAt = "2026年7月26日 14:05"
        range = @{
            startDate = "2026-07-20"
            endDate = "2026-07-26"
        }
        daily = $daily
        previous = @{
            range = @{
                startDate = "2026-07-13"
                endDate = "2026-07-19"
            }
            daily = $daily
            searchSummary = @{
                withResults = 0
                noResults = 0
                successRate = 0
            }
        }
        searchSummary = @{
            withResults = 1
            noResults = 0
            successRate = 100
        }
        searchMethods = @(
            @{ key = "term"; label = "Term search"; count = 1 },
            @{ key = "mahler_work"; label = "Mahler work search"; count = 0 },
            @{ key = "opera_work"; label = "Opera work search"; count = 0 },
            @{ key = "unclassified"; label = "Unclassified"; count = 0 }
        )
        retention = @{
            granularity = "month"
            asOfDate = "2026-07-26"
            summary = @{
                nextMonth = @{ returningUsers = 2; eligibleUsers = 10; rate = 20 }
                thirdMonth = @{ returningUsers = 0; eligibleUsers = 0; rate = $null }
                latestFirstVisitUsers = 4
            }
            rows = @(1..12 | ForEach-Object {
                @{
                    month = "2025-$('{0:D2}' -f $_)"
                    firstVisitUsers = 4
                    periods = @(
                        @{ offset = 0; returningUsers = 4; rate = 100; status = "complete" },
                        @{ offset = 1; returningUsers = 1; rate = 25; status = "complete" },
                        @{ offset = 2; returningUsers = $null; rate = $null; status = "collecting" },
                        @{ offset = 3; returningUsers = $null; rate = $null; status = "collecting" }
                    )
                }
            })
        }
        pageTrends = @{
            granularity = "month"
            asOfDate = "2026-07-26"
            range = @{
                startMonth = "2025-08"
                endMonth = "2026-07"
            }
            pages = @(0..12 | ForEach-Object {
                @{
                    page = "Page $_"
                    path = "/page-$_"
                    months = @(1..12 | ForEach-Object {
                        @{
                            month = "2025-$('{0:D2}' -f $_)"
                            views = 0
                            averageEngagementSeconds = $null
                            searches = if ($_ % 2 -eq 0) { 0 } else { $null }
                            status = if ($_ -eq 12) { "collecting" } else { "complete" }
                        }
                    })
                }
            })
        }
        acquisition = @{
            granularity = "month"
            asOfDate = "2026-07-26"
            range = @{
                startMonth = "2025-08"
                endMonth = "2026-07"
            }
            totalSessions = 0
            summary = @(
                @{ key = "referral"; label = "Referral"; sessions = 0; share = 0 },
                @{ key = "search"; label = "Search"; sessions = 0; share = 0 },
                @{ key = "direct"; label = "Direct"; sessions = 0; share = 0 },
                @{ key = "other"; label = "Other"; sessions = 0; share = 0 }
            )
            months = @(1..12 | ForEach-Object {
                @{
                    month = "2025-$('{0:D2}' -f $_)"
                    totalSessions = 0
                    status = if ($_ -eq 12) { "collecting" } else { "complete" }
                    channels = @(
                        @{ key = "referral"; label = "Referral"; sessions = 0; share = 0 },
                        @{ key = "search"; label = "Search"; sessions = 0; share = 0 },
                        @{ key = "direct"; label = "Direct"; sessions = 0; share = 0 },
                        @{ key = "other"; label = "Other"; sessions = 0; share = 0 }
                    )
                }
            })
            sources = @()
        }
        pages = $pages
        dictionaryExampleMoves = @(
            @{ composer = "Wagner"; path = "/rw_terms_search.html"; count = 0 },
            @{ composer = "Mahler"; path = "/terms_search.html"; count = 0 },
            @{ composer = "R. Strauss"; path = "/rs_terms_search.html"; count = 0 }
        )
        dictionaryExamplePerformance = @{
            sampleCount = 3
            averageMilliseconds = 963
            composers = @(
                @{ composer = "Wagner"; path = "/rw_terms_search.html"; sampleCount = 1; averageMilliseconds = 1250 },
                @{ composer = "Mahler"; path = "/terms_search.html"; sampleCount = 2; averageMilliseconds = 820 },
                @{ composer = "R. Strauss"; path = "/rs_terms_search.html"; sampleCount = 0; averageMilliseconds = $null }
            )
        }
        terms = @(
            @{
                term = "innig"
                translation = "心をこめて"
                searches = 1
                pages = @(@{ name = "Page 1"; count = 1 })
            }
        )
        works = @(
            @{
                workId = "gm_all"
                workTitle = "マーラーの全ての楽曲"
                composer = "Mahler"
                searches = 1
            }
        )
        cities = @(
            @{
                city = "Tokyo"
                country = "Japan"
                displayName = "Tokyo (Japan)"
                users = 1
                sessions = 2
            }
        )
    } | ConvertTo-Json -Depth 8

    $script:testDashboardPayloads[$period] = $payload
    $result = Test-DashboardApiPayload -Payload $payload -ExpectedPeriod $period
    Assert-True -Condition $result.Success -Message "valid $period-day payload: $($result.Message)"
    $withLanguages = $payload | ConvertFrom-Json
    $languageSummary = @{ basis = "site-page-path"; rows = @("ja", "en", "unknown" | ForEach-Object {
        @{language = $_; label = $_; views = 0; searches = 3; withResults = 2; noResults = 1; exampleClicks = 0}
    }) }
    $withLanguages | Add-Member -NotePropertyName languageSummary -NotePropertyValue $languageSummary
    $languageResult = Test-DashboardApiPayload -Payload ($withLanguages | ConvertTo-Json -Depth 12) -ExpectedPeriod $period
    Assert-True -Condition $languageResult.Success -Message "valid optional language summary: $($languageResult.Message)"
    $languageSummary.rows[1].language = "ja"
    $duplicateResult = Test-DashboardApiPayload -Payload ($withLanguages | ConvertTo-Json -Depth 12) -ExpectedPeriod $period
    Assert-True -Condition (-not $duplicateResult.Success) -Message "duplicate language must fail"
    $languageSummary.rows[1].language = "en"
    $languageSummary.rows[1].searches = 9
    $inconsistentResult = Test-DashboardApiPayload -Payload ($withLanguages | ConvertTo-Json -Depth 12) -ExpectedPeriod $period
    Assert-True -Condition (-not $inconsistentResult.Success) -Message "inconsistent language count must fail"
}

$htmlResult = Test-DashboardApiPayload -Payload "<html>login</html>" -ExpectedPeriod 7
Assert-True -Condition (-not $htmlResult.Success) -Message "HTML must fail"

$errorResult = Test-DashboardApiPayload -Payload '{"error":{"code":"GA4_API_ERROR"}}' -ExpectedPeriod 7
Assert-True -Condition (-not $errorResult.Success) -Message "API error must fail"

$invalidJsonResult = Test-DashboardApiPayload -Payload '{invalid' -ExpectedPeriod 7
Assert-True -Condition (-not $invalidJsonResult.Success) -Message "invalid JSON must fail"

$dashboardApiHelperSource = Get-Content (Join-Path $PSScriptRoot "dashboard-api-check.ps1") -Raw
Assert-True `
    -Condition ($dashboardApiHelperSource -match '-o "\$bodyPath"') `
    -Message "curl response body must be written to a file"
Assert-True `
    -Condition ($dashboardApiHelperSource -match '\[System\.IO\.File\]::ReadAllText\(\$bodyPath, \$utf8\)') `
    -Message "response body must be decoded explicitly as UTF-8"
Assert-True `
    -Condition ($dashboardApiHelperSource -match '%\{http_code\}\|%\{content_type\}') `
    -Message "HTTP status and content type must be captured"

$syncSource = Get-Content (Join-Path $PSScriptRoot "verify-dashboard.ps1") -Raw
Assert-True -Condition ($syncSource -match 'Invoke-DashboardApiVerification') -Message 'standalone verifier uses the four-period policy'

# Exercise the transport with synthetic data; never contact the live deployment.
$script:dashboardCurlCalls = 0
$script:dashboardSentBody = $null
$script:dashboardSentArgs = $null
$script:dashboardPlan = $null
$script:dashboardResponseBody = $payload
$script:dashboardCurlExit = 0
$script:dashboardMetadata = @('200|application/json', 'DASHBOARD_CURL_METRICS|1|0.010000|0.020000|0.030000|0.050000|0.040000|0.060000')
function curl.exe {
    $script:dashboardCurlCalls++
    $script:dashboardSentArgs = @($args)
    $script:dashboardSentBody = ($input | Out-String) | ConvertFrom-Json
    if ($null -ne $script:dashboardPlan) {
        $attempt = $script:dashboardPlan.Dequeue()
        $period = [int]$script:dashboardSentBody.period
        Assert-True -Condition ($period -eq $attempt.Period) -Message 'unexpected verifier attempt order'
        $script:dashboardElapsed += $attempt.Seconds
        $script:dashboardResponseBody = $script:testDashboardPayloads[$period]
        $script:dashboardCurlExit = $attempt.Curl
        $script:dashboardMetadata = $attempt.Metadata
    }
    $outputIndex = [array]::IndexOf($args, '-o')
    [System.IO.File]::WriteAllText($args[$outputIndex + 1], $script:dashboardResponseBody, (New-Object System.Text.UTF8Encoding($false)))
    $errorIndex = [array]::IndexOf($args, '--stderr')
    [System.IO.File]::WriteAllText($args[$errorIndex + 1], 'raw-stderr should never be emitted')
    $global:LASTEXITCODE = $script:dashboardCurlExit
    $script:dashboardMetadata
}
try {
    $testToken = 'synthetic-read-only-dashboard-token'
    $transport = Invoke-DashboardApiCheck -BaseUrl 'https://script.google.com/macros/s/synthetic/exec' -Period 180 -DashboardToken $testToken
    Assert-True -Condition $transport.Success -Message "authenticated POST transport: $($transport.Message)"
    Assert-True -Condition ($script:dashboardSentBody.dashboardToken -eq $testToken) -Message 'secret is supplied in stdin JSON'
    Assert-True -Condition ($script:dashboardSentBody.api -eq 'dashboard' -and $script:dashboardSentBody.period -eq 180) -Message 'period contract preserved'
    Assert-True -Condition (-not (($script:dashboardSentArgs -join ' ') -match [regex]::Escape($testToken))) -Message 'secret absent from process arguments'
    Assert-True -Condition ($script:dashboardSentArgs -contains '@-') -Message 'curl reads request body from stdin'
    $missing = Invoke-DashboardApiCheck -BaseUrl 'https://script.google.com/macros/s/synthetic/exec' -Period 7 -DashboardToken ''
    $wrongHost = Invoke-DashboardApiCheck -BaseUrl 'https://example.invalid/exec' -Period 7 -DashboardToken $testToken
    Assert-True -Condition (-not $missing.Success -and -not $wrongHost.Success -and $script:dashboardCurlCalls -eq 1) -Message 'missing credentials or wrong host never send a request'
    Assert-True -Condition ($transport.Telemetry -eq 'DASHBOARD_CHECK period=180 result=ok phase=redirect_chain curl=0 http=200 redirects=1 dns_s=0.010000 connect_s=0.020000 tls_s=0.030000 ttfb_s=0.050000 redirect_s=0.040000 total_s=0.060000') -Message 'success metadata is complete and numeric'
    $timeoutIndex = [array]::IndexOf($script:dashboardSentArgs, '--max-time')
    $connectIndex = [array]::IndexOf($script:dashboardSentArgs, '--connect-timeout')
    Assert-True -Condition ($script:dashboardSentArgs -contains '-L' -and $script:dashboardSentArgs[$timeoutIndex + 1] -eq '225' -and $script:dashboardSentArgs[$connectIndex + 1] -eq '20') -Message 'allow a long response without extending connection setup'

    $script:dashboardCurlExit = 28
    $script:dashboardMetadata = @('000|', 'DASHBOARD_CURL_METRICS|0|0.010000|0.020000|0.030000|0.000000|0.000000|90.001000')
    $beforeHttp = Invoke-DashboardApiCheck -BaseUrl 'https://script.google.com/macros/s/synthetic/exec' -Period 180 -DashboardToken $testToken
    Assert-True -Condition (-not $beforeHttp.Success -and -not $beforeHttp.CanRetry -and $beforeHttp.Telemetry -match 'result=timeout phase=before_http curl=28 http=000 redirects=0') -Message 'timeout with no observed response retains curl code and stage'
    $script:dashboardMetadata = @('302|text/html', 'DASHBOARD_CURL_METRICS|1|0.010000|0.020000|0.030000|12.100000|12.110000|90.001000')
    $afterRedirect = Invoke-DashboardApiCheck -BaseUrl 'https://script.google.com/macros/s/synthetic/exec' -Period 180 -DashboardToken $testToken
    Assert-True -Condition (-not $afterRedirect.Success -and -not $afterRedirect.CanRetry -and $afterRedirect.Telemetry -match 'result=timeout phase=redirect_chain curl=28 http=302 redirects=1 .*redirect_s=12\.110000') -Message 'a redirect-chain timeout cannot be mistaken for no observed HTTP response'

    # Even a valid JSON prefix must fail when curl has not finished the 2xx body.
    $script:dashboardMetadata = @('200|application/json', 'DASHBOARD_CURL_METRICS|1|0.010000|0.020000|0.030000|12.100000|11.000000|225.000000')
    $partialBody = Invoke-DashboardApiCheck -BaseUrl 'https://script.google.com/macros/s/synthetic/exec' -Period 180 -DashboardToken $testToken
    Assert-True -Condition (-not $partialBody.Success -and -not $partialBody.CanRetry -and $partialBody.Telemetry -match 'result=timeout phase=after_response_headers curl=28 http=200 redirects=1') -Message 'HTTP 200 with incomplete body never passes or repeats POST'

    $script:dashboardCurlExit = 0
    $script:dashboardResponseBody = '{"error":{"code":"UNAUTHORIZED"}}'
    $script:dashboardMetadata = @('200|application/json', 'DASHBOARD_CURL_METRICS|1|0.010000|0.020000|0.030000|0.050000|0.040000|0.060000')
    $denied = Invoke-DashboardApiCheck -BaseUrl 'https://script.google.com/macros/s/synthetic/exec' -Period 180 -DashboardToken $testToken
    Assert-True -Condition (-not $denied.Success -and -not $denied.CanRetry -and $denied.Telemetry -match 'result=unauthorized phase=redirect_chain curl=0 http=200') -Message 'authentication denial is recognized from the normal JSON validator'

    $script:dashboardResponseBody = '{"error":{"code":"https://example.invalid/private"}}'
    $script:dashboardMetadata = @("200|application/json; $testToken", "DASHBOARD_CURL_METRICS|1|$testToken|0.020000|0.030000|0.050000|0.040000|0.060000")
    $invalid = Invoke-DashboardApiCheck -BaseUrl 'https://script.google.com/macros/s/synthetic/exec' -Period 180 -DashboardToken $testToken
    Assert-True -Condition (-not $invalid.Success -and -not $invalid.CanRetry -and $invalid.Telemetry -match 'result=invalid_response phase=http_response curl=0 http=200 redirects=na dns_s=na') -Message 'untrusted metadata is rejected'
    Assert-True -Condition ($invalid.Telemetry -notmatch 'https:|private|raw-stderr|application/json' -and -not $invalid.Telemetry.Contains($testToken)) -Message 'raw response, header, stderr, and token never enter telemetry'

    $successMeta = @('200|application/json', 'DASHBOARD_CURL_METRICS|1|0.010000|0.020000|0.030000|0.050000|0.040000|0.060000')
    $slowMeta = @('200|application/json', 'DASHBOARD_CURL_METRICS|1|0.010000|0.020000|0.030000|185.000000|184.000000|185.000000')
    $preconnectMeta = @('000|', 'DASHBOARD_CURL_METRICS|0|0.010000|0.000000|0.000000|0.000000|0.000000|20.000000')
    $preRedirect503 = @('503|text/html', 'DASHBOARD_CURL_METRICS|0|0.010000|0.020000|0.030000|219.000000|0.000000|220.000000')
    foreach ($roomForRetry in @($true, $false)) {
        $script:dashboardElapsed = 0
        $script:dashboardWaits = @()
        $script:dashboardPlan = New-Object System.Collections.Queue
        if ($roomForRetry) {
            $script:dashboardPlan.Enqueue(@{ Period=7; Seconds=20; Curl=7; Metadata=$preconnectMeta })
        } else {
            $script:dashboardPlan.Enqueue(@{ Period=7; Seconds=220; Curl=0; Metadata=$preRedirect503 })
        }
        $regularSeconds = if ($roomForRetry) { 13 } else { 210 }
        $script:dashboardPlan.Enqueue(@{ Period=30; Seconds=$regularSeconds; Curl=0; Metadata=$successMeta })
        $script:dashboardPlan.Enqueue(@{ Period=90; Seconds=$regularSeconds; Curl=0; Metadata=$successMeta })
        $script:dashboardPlan.Enqueue(@{ Period=180; Seconds=185; Curl=0; Metadata=$slowMeta })
        if ($roomForRetry) {
            $script:dashboardPlan.Enqueue(@{ Period=7; Seconds=13; Curl=0; Metadata=$successMeta })
        }

        $results = @(Invoke-DashboardApiVerification -BaseUrl 'https://script.google.com/macros/s/synthetic/exec' -DashboardToken $testToken `
            -ElapsedSeconds { $script:dashboardElapsed } -DelaySeconds { param($seconds) $script:dashboardElapsed += $seconds; $script:dashboardWaits += $seconds })
        $expected = if ($roomForRetry) { '7,30,90,180,7' } else { '7,30,90,180' }
        Assert-True -Condition (($results.Period -join ',') -eq $expected -and $script:dashboardPlan.Count -eq 0) -Message 'all four first attempts come before any retry with budget'
        Assert-True -Condition (-not $results[0].Success -and $results[0].CanRetry -and $results[3].Success -and $results[3].Telemetry -match 'total_s=185\.000000$') -Message 'a genuinely slow fourth response still validates fully'
        if ($roomForRetry) {
            Assert-True -Condition ($results[4].Success -and ($script:dashboardWaits -join ',') -eq '5') -Message 'one retry gets the full window after five seconds'
        } else {
            Assert-True -Condition ($script:dashboardWaits.Count -eq 0) -Message 'no retry delay when the full attempt cannot fit'
        }
    }
} finally { Remove-Item Function:curl.exe }

Write-Output "sync dashboard API checks: OK"
