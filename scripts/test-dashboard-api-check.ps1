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

foreach ($period in @(7, 30, 90)) {
    $daily = @()
    for ($i = 0; $i -lt $period; $i++) {
        $daily += @{
            date = "7/26"
            searches = 0
            views = 0
            exampleClicks = 0
        }
    }

    $pages = @()
    for ($i = 0; $i -lt 11; $i++) {
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
        schemaVersion = 4
        period = $period
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
            pages = @(0..10 | ForEach-Object {
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
        pages = $pages
        dictionaryExampleMoves = @(
            @{ composer = "Wagner"; path = "/rw_terms_search.html"; count = 0 },
            @{ composer = "Mahler"; path = "/terms_search.html"; count = 0 },
            @{ composer = "R. Strauss"; path = "/rs_terms_search.html"; count = 0 }
        )
        terms = @(
            @{
                term = "innig"
                translation = "心をこめて"
                searches = 1
                pages = @(@{ name = "Page 1"; count = 1 })
            }
        )
    } | ConvertTo-Json -Depth 8

    $result = Test-DashboardApiPayload -Payload $payload -ExpectedPeriod $period
    Assert-True -Condition $result.Success -Message "valid $period-day payload"
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

$syncSource = Get-Content (Join-Path $PSScriptRoot "..\sync-data.ps1") -Raw
Assert-True `
    -Condition ($syncSource -match '\$dashboardApiRetryDelays = @\(0, 10, 20, 40, 60\)') `
    -Message "dashboard API retries must allow propagation time"
Assert-True `
    -Condition ($syncSource -match '\$pendingDashboardPeriods = @\(\$dashboardPeriods\)') `
    -Message "all periods must share one retry schedule"

Write-Output "sync dashboard API checks: OK"
