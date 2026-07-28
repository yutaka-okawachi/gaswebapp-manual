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
    for ($i = 0; $i -lt 12; $i++) {
        $pages += @{
            page = "Page $i"
            path = "/page-$i"
            views = 0
            searchMoves = 0
            searches = 0
            exampleClicks = 0
            topTerms = @()
        }
    }

    $payload = @{
        schemaVersion = 2
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

Write-Output "sync dashboard API checks: OK"
