window.searchTermsLocal = function (query, sourceFilter) {
    const data = window.appData.dic_notes;
    if (!data) return '<div class="result-message">データが読み込まれていません。</div>';

    const normalizedQuery = normalizeString(query);
    const results = [];

    data.forEach(row => {
        const [german, translation, source] = row;

        // Filter by source
        // Note: Some terms might have multiple tags e.g. [GM], [RW: Oper]
        if (sourceFilter) {
            if (sourceFilter === 'GM' && !source.includes('[GM]')) return;
            if (sourceFilter === 'RW' && !source.includes('[RW')) return;
            if (sourceFilter === 'RS' && !source.includes('[RS')) return;
        }

        // Check match
        const normGerman = normalizeString(german);
        if (normGerman.includes(normalizedQuery)) {
            results.push(row);
        }
    });

    if (results.length === 0) {
        return '<div class="result-message">該当する用語は見つかりませんでした。</div>';
    }

    // Sort results
    results.sort((a, b) => compareGermanStrings(a[0], b[0]));

    // Format results
    let html = '';
    results.forEach(row => {
        const [german, translation, source] = row;
        html += `<div class="row">
            <dt><dfn class="german">${escapeHtml(german)}</dfn><span class="source">${escapeHtml(source)}</span></dt>
            <dd class="translation">${escapeHtmlWithBreaks(translation)}</dd>
        </div>`;
    });

    return `<div>${results.length}件見つかりました。</div>${html}`;
}

window.getTermsListLocal = function (sourceFilter) {
    const data = window.appData.dic_notes;
    if (!data) return [];

    const terms = [];
    data.forEach(row => {
        const [german, translation, source] = row;
        if (sourceFilter) {
            if (sourceFilter === 'GM' && !source.includes('[GM]')) return;
            if (sourceFilter === 'RW' && !source.includes('[RW')) return;
            if (sourceFilter === 'RS' && !source.includes('[RS')) return;
        }
        terms.push({ original: german, normalized: normalizeString(german) });
    });
    return terms;
}

// --- Mahler Search Logic (Local Fallback) ---

window.aMapping = {
    "all": "ALL", "交響曲第1番ニ長調（1884-88）": "1", "交響曲第2番ハ短調（1888-94）": "2",
    "交響曲第3番ニ短調（1893-96）": "3", "交響曲第4番ト長調（1899-1900）": "4", "交響曲第5番嬰ハ短調（1901-02）": "5",
    "交響曲第6番イ短調（1903-04）": "6", "交響曲第7番ホ短調（1904-05）": "7", "交響曲第8番変ホ長調（1906）": "8",
    "交響曲イ短調『大地の歌』（1908）": "a", "交響曲第9番ニ長調（1909）": "9", "交響曲第10番嬰ヘ長調（1910）": "101",
    "交響曲第10番（クック版）": "102", "嘆きの歌（1880）": "b1", "嘆きの歌（1899）": "b2",
    "さすらう若人の歌": "c", "子供の魔法の角笛": "d", "子供の死の歌": "e",
    "リュッケルトの詩による5つの歌": "f", "花の章": "g", "葬礼": "h"
};

window.aReverseMap = Object.entries(window.aMapping).reduce((acc, [key, value]) => {
    acc[value.toLowerCase()] = key;
    return acc;
}, {});

window.dMapping = {
    "all": "ALLE", "dir": "Dirigent", "v1": "Violine1", "v2": "Violine2", "va": "Bratsche", "vc": "Violoncello",
    "kb": "Kontrabaß", "sv": "Solo Violine", "sva": "Solo Bratsche", "svc": "Solo Violoncello", "skb": "Solo Kontrabaß",
    "fl": "Flöte", "pic": "Piccolo", "ob": "Oboe", "eh": "Englischhorn", "cl": "Klarinette", "escl": "Es-Klarinette",
    "bcl": "Bassklarinette", "fg": "Fagott", "cfg": "Kontrafagott", "tr": "Trompete", "pis": "Piston",
    "phr": "Posthorn", "hr": "Horn", "thr": "Tenorhorn", "ohr": "Obligates Horn", "fhr": "Flügelhorn",
    "whr": "Waldhorn", "pos": "Posaune", "bt": "Basstuba", "pau": "Pauken", "gtr": "Große Trommel",
    "ktr": "Kleine Trommel", "mtr": "Militär Trommel", "bec": "Becken", "tam": "Tam-tam", "tri": "Triangel",
    "gls": "Glockenspiel", "hgl": "Herdenglocken", "gl": "Glocken", "ham": "Hammer", "rt": "Rute",
    "cel": "Celesta", "hp": "Harfe", "org": "Orgel", "klv": "Klavier", "har": "Harmonium", "git": "Gitarre",
    "man": "Mandoline", "sop": "Sopran", "alt": "Alto", "ten": "Tenor", "bar": "Bariton", "bass": "Bass",
    "sop1": "Sopran1", "sop2": "Sopran2", "alt1": "Alto1", "alt2": "Alto2", "kalt": "Knabe(Alto)",
    "chor": "Chor", "chor1": "Chor1", "chor2": "Chor2", "fchor": "frauen Chor", "kchor": "knaben Chor",
    "sti": "Stimme"
};

window.dReverseMap = { ...window.dMapping };

function formatMovementNumber(a, b) {
    const specialMapping = {
        c: { c1: "Wenn mein Schatz Hochzeit macht", c2: "Ging heut' morgen über's Feld", c3: "Ich hab' ein glühend Messer", c4: "Die zwei blauen Augen von meinem Schatz" },
        d: { d01: "Der Schildwache Nachlied", d02: "Verlorne Müh'!", d03: "Trost im Unglück", d04: "Das himmlische Leben", d05: "Wer hat dies Liedel erdacht?", d06: "Das irdische Leben", d07: "Urlicht", d08: "Des Antonius von Padua Fischpredigt", d09: "Rheinlegendchen", d10: "Lob des hohen Verstands", d11: "Lied des Verfolgten im Turm", d12: "Wo die schönen Trompeten blasen", d13: "Revelge", d14: "Der Tamboursg'sell" },
        e: { e1: "Nun will die Sonn' so hell aufgeh'n", e2: "Nun seh' ich wohl, warum so dunkle Flammen", e3: "Wenn dein Mütterlein", e4: "Oft denk' ich, sie sind nur ausgegangen", e5: "In diesem Wetter, in diesem Braus" },
        f: { f1: "Blicke mir nicht in die Lieder!", f2: "Ich atmet' einen linden Duft", f3: "Ich bin der Welt abhanden gekommen", f4: "Um Mitternacht", f5: "Liebst du um Schönheit" }
    };

    if (specialMapping[a.toLowerCase()] && specialMapping[a.toLowerCase()][b.toLowerCase()]) {
        return specialMapping[a.toLowerCase()][b.toLowerCase()];
    }
    if (b.toLowerCase() === 't1') return '第1部';
    if (b.toLowerCase() === 't2') return '第2部';
    if (b.toLowerCase() === 't3') return '第3部';
    if (['a', 'g', 'h'].includes(b.toLowerCase())) return '';
    return `第${b}楽章`;
}

window.searchMahlerDataLocal = function (choice1Arr, choice2Arr, includeOrchestraAll) {
    const data = window.appData.mahler;
    if (!data || data.length === 0) {
        return '<div class="result-message">データが読み込まれていません。</div>';
    }

    const groupAllMap = {
        "all_strings": ["v1", "v2", "va", "vc", "kb", "sv", "sva", "svc", "skb"],
        "all_woodwinds": ["fl", "pic", "ob", "eh", "cl", "escl", "bcl", "fg", "cfg"],
        "all_brass": ["tr", "pis", "phr", "hr", "thr", "ohr", "fhr", "whr", "pos", "bt"],
        "all_percussions": ["pau", "gtr", "ktr", "mtr", "bec", "tam", "tri", "gls", "hgl", "gl", "ham", "rt", "cel", "hp", "org", "klv", "har", "git", "man"],
        "all_vocal": ["sop", "alt", "ten", "bar", "bass", "sop1", "sop2", "alt1", "alt2", "kalt", "chor", "chor1", "chor2", "fchor", "kchor", "sti"]
    };

    let finalInstruments = new Set();

    if (choice2Arr.includes('ALL_GLOBAL')) {
        Object.keys(window.dMapping).forEach(code => {
            if (code !== 'all') finalInstruments.add(code);
        });
        finalInstruments.add('all');
    } else {
        choice2Arr.forEach(val => {
            const lowerVal = val.toLowerCase();
            if (groupAllMap[lowerVal]) {
                groupAllMap[lowerVal].forEach(code => finalInstruments.add(code));
            } else if (window.dMapping[lowerVal]) {
                finalInstruments.add(lowerVal);
            }
        });
    }

    if (includeOrchestraAll) {
        finalInstruments.add('all');
    }

    let resultHTML = '';
    let totalMatches = 0;

    try {
        data.forEach(row => {
            const deData = row.de || row[0];
            const jaData = row.ja || row[2];
            const dataCol = row.data || row[3];

            if (!dataCol || typeof dataCol !== 'string') return;

            const segments = dataCol.split('&').map(s => s.trim()).filter(s => s);
            if (segments.length === 0) return;

            let matchedLocList = [];
            let segmentCount = 0;

            segments.forEach(seg => {
                const [prefix, a, b, c, d] = seg.split('-');
                if (!a || !b || !c || !d) return;

                let aMatch = choice1Arr.includes('ALL') || choice1Arr.some(choice => window.aMapping[choice.toLowerCase()] === a);

                const dArr = d.split(',').map(x => x.trim());
                let dMatch = dArr.some(origCode => {
                    const codeLower = origCode.toLowerCase();
                    if (includeOrchestraAll) {
                        return finalInstruments.has(codeLower) || codeLower === 'all';
                    } else {
                        return finalInstruments.has(codeLower) && codeLower !== 'all';
                    }
                });

                if (aMatch && dMatch) {
                    totalMatches++;
                    segmentCount++;

                    const aLabel = window.aReverseMap[a.toLowerCase()] || `不明(${a})`;
                    const movementText = formatMovementNumber(a, b);
                    const measureText = `第${c}小節`;
                    const mappedInstruments = dArr.map(code => window.dReverseMap[code] || code).join(', ');
                    const locText = `${aLabel} ${movementText}：${measureText}（${mappedInstruments}）`;
                    matchedLocList.push(locText);
                }
            });

            if (matchedLocList.length > 0) {
                resultHTML += `<div class="result-a">${linkTermsInTranslation(deData, window.appData.dic_terms_index)}</div>`;
                resultHTML += `<div class="result-c">${escapeHtmlWithBreaks(jaData)}</div>`;
                matchedLocList.forEach(loc => {
                    resultHTML += `<div class="result-loc">${escapeHtml(loc)}</div>`;
                });
                resultHTML += `<div class="result-loc">(${segmentCount}件)</div>`;
                resultHTML += '<hr style="border-top: 1px dashed #ccc; margin: 10px 0;">';
            }
        });
    } catch (e) {
        console.error("Error in searchMahlerDataLocal:", e);
        return `<div class="result-message">検索中にエラーが発生しました: ${e.message}</div>`;
    }

    return totalMatches === 0 ? '<div class="result-message">該当するデータが見つかりませんでした。</div>' : `<div>${totalMatches}件ありました。</div>${resultHTML}`;
};

// --- Mahler Terms Search Logic (Local Fallback) ---

window.getMahlerTermsListLocal = function () {
    const data = window.appData.mahler;
    console.log('getMahlerTermsListLocal called. Data:', data ? data.length : 'null');
    if (!data) return [];
    if (data.length > 0) {
        console.log('First row:', data[0]);
    }
    const mapped = data.map(row => ({
        original: row.de || row[0],
        normalized: row.de_normalized || row[1]
    })).filter(item => item.original);
    console.log('Mapped terms:', mapped.length);
    return mapped;
};

window.searchMahlerTermsLocal = function (query, resultMeta, matchMode) {
    const data = window.appData.mahler;
    if (!data) return '<div class="result-message">データが読み込まれていません。</div>';

    const normalizedQuery = normalizeString(query);
    const results = data.filter(row => {
        const deNormalized = row.de_normalized || row[1];
        return deNormalized && matchesTermQuery(deNormalized, normalizedQuery, matchMode);
    });

    if (results.length === 0) {
        if (resultMeta) resultMeta.resultCount = 0;
        return '<div class="result-message">該当するデータが見つかりませんでした。</div>';
    }

    let resultHTML = '';
    let totalMatches = 0;

    try {
        results.forEach(row => {
            const deData = row.de || row[0];
            const jaData = row.ja || row[2];
            const dataCol = row.data || row[3];

            if (!dataCol || typeof dataCol !== 'string') return;

            const segments = dataCol.split('&').map(s => s.trim()).filter(s => s);
            let matchedLocList = [];
            let segmentCount = 0;

            segments.forEach(seg => {
                const [prefix, a, b, c, d] = seg.split('-');
                if (!a || !b || !c || !d) return;

                segmentCount++;
                const aLabel = window.aReverseMap[a.toLowerCase()] || `不明(${a})`;
                const movementText = formatMovementNumber(a, b);
                const measureText = `第${c}小節`;
                const dArr = d.split(',').map(x => x.trim());
                const mappedInstruments = dArr.map(code => window.dReverseMap[code] || code).join(', ');
                const locText = `${aLabel} ${movementText}：${measureText}（${mappedInstruments}）`;
                matchedLocList.push(locText);
            });

            if (matchedLocList.length > 0) {
                totalMatches++;
                resultHTML += `<div class="search-result-item">`;
                resultHTML += `<div class="result-a">${linkTermsInTranslation(deData, window.appData.dic_terms_index)}</div>`;
                resultHTML += `<div class="result-c">${escapeHtmlWithBreaks(jaData)}</div>`;
                matchedLocList.forEach(loc => {
                    resultHTML += `<div class="result-loc">${escapeHtml(loc)}</div>`;
                });
                resultHTML += `<div class="result-loc">(${segmentCount}件)</div>`;
                resultHTML += `</div>`;
            }
        });
    } catch (e) {
        console.error("Error in searchMahlerTermsLocal:", e);
        return `<div class="result-message">検索中にエラーが発生しました: ${e.message}</div>`;
    }

    if (resultMeta) resultMeta.resultCount = totalMatches;
    return totalMatches === 0 ? '<div class="result-message">該当するデータが見つかりませんでした。</div>' : `<div>${totalMatches}件ありました。</div>${resultHTML}`;
};

// RS Terms Search Local
window.searchRSTermsLocal = function (query, resultMeta, matchMode) {
    return searchGenericTermsLocal(query, 'richard_strauss', 'RS', resultMeta, matchMode);
};

// RW Terms Search Local
window.searchRWTermsLocal = function (query, resultMeta, matchMode) {
    return searchGenericTermsLocal(query, 'richard_wagner', 'RW', resultMeta, matchMode);
};

// Generic Terms Search Local for RS/RW
// Generic Terms Search Local for RS/RW
function searchGenericTermsLocal(query, dataKey, type, resultMeta, matchMode) {
    const data = window.appData[dataKey];
    if (!data) return '<div class="result-message">データが読み込まれていません。</div>';

    const normalizedQuery = normalizeString(query);
    
    // Filter data
    const filteredData = data.filter(row => {
        const de = row.de || '';
        const deNormalized = row.de_normalized || normalizeString(de);
        const pageExists = row.page !== null && row.page !== undefined && String(row.page).trim() !== '';
        return matchesTermQuery(deNormalized, normalizedQuery, matchMode) && pageExists;
    });

    if (filteredData.length === 0) {
        if (resultMeta) resultMeta.resultCount = 0;
        return '<div class="result-message">該当するデータが見つかりませんでした。</div>';
    }

    const highlightRegex = createTermHighlightRegex(normalizedQuery, matchMode);

    // Group by 'de' text
    const groupedByDe = filteredData.reduce((acc, row) => {
        const de = row.de || '（ドイツ語なし）';
        if (!acc[de]) {
            acc[de] = [];
        }
        acc[de].push(row);
        return acc;
    }, {});

    // 見出し語の件数を表示
    const headwordCount = Object.keys(groupedByDe).length;
    if (resultMeta) resultMeta.resultCount = headwordCount;
    let html = `<div class="result-message">${headwordCount}件ありました。</div>`;
    
    const sortedDeKeys = Object.keys(groupedByDe).sort((a, b) => a.localeCompare(b, 'de'));
    
    // Opera display names mapping
    const operaDisplayNames = {
        'guntram': 'Guntram Op.25', 'feuersnot': 'Feuersnot Op.50', 'salome': 'Salome Op.54',
        'elektra': 'Elektra Op.58', 'rosenkavalier': 'Der Rosenkavalier Op.59', 'ariadne': 'Ariadne auf Naxos Op.60',
        'schatten': 'Die Frau ohne Schatten Op.65', 'intermezzo': 'Intermezzo Op.72', 'helena': 'Die ägyptische Helena Op.75',
        'arabella': 'Arabella Op.79', 'schweigsame': 'Die schweigsame Frau Op.80', 'tag': 'Friedenstag Op.81',
        'daphne': 'Daphne Op.82', 'danae': 'Die Liebe der Danae Op.83', 'cap': 'Capriccio Op.85',
        'feen': 'Die Feen WWV 32', 'liebes': 'Das Liebesverbot WWV 38', 'rienzi': 'Rienzi, der Letzte der Tribunen WWV 49',
        'hollaender': 'Der fliegende Holländer WWV 63', 
        'tann_dresden': 'Tannhäuser und der Sängerkrieg auf Wartburg (Dresden) WWV 70', 
        'tann_paris': 'Tannhäuser und der Sängerkrieg auf Wartburg (Paris) WWV 70',
        'lohengrin': 'Lohengrin WWV 75',
        'tristan': 'Tristan und Isolde WWV 90', 'meister': 'Die Meistersinger von Nürnberg WWV 96',
        'rheingold': 'Das Rheingold WWV 86A', 'walkuere': 'Die Walküre WWV 86B', 'siegfried': 'Siegfried WWV 86C',
        'goetter': 'Götterdämmerung WWV 86D', 'parsifal': 'Parsifal WWV 111'
    };

    sortedDeKeys.forEach(de => {
        const itemsForThisDe = groupedByDe[de];
        // Generate Link first
        let resultDe = linkTermsInTranslation(de, window.appData.dic_terms_index);
        
        // Apply Highlight
        if (normalizedQuery.length >= 2) {
             resultDe = resultDe.replace(highlightRegex, '<span style="color: red;">$1</span>');
        }

        html += `<div class="search-result-item">`;
        html += `<dt class="result-a">${resultDe}</dt>`;
        
        itemsForThisDe.forEach(row => {
            // 各用例ごとに日本語訳を表示（訳語の揺れがわかるように）
            const ja = escapeHtmlWithBreaks(String(row.ja || ''));
            html += `<dd class="result-c">${ja}</dd>`;
            
            const whom = escapeHtml(String(row.whom || ''));
            const operKey = normalizeString(String(row.Oper || ''));
            const aufzug = (row.aufzug || '0').toString().trim().toLowerCase();
            const szene = (row.szene || '0').toString().trim().toLowerCase();
            const page = escapeHtml(String(row.page || ''));
            const operaDisplayName = operaDisplayNames[operKey] || escapeHtml(String(row.Oper || ''));
            
            // Scene Name Logic
            let sceneName = row['場面タイトル'] || `場面(${aufzug}-${szene})`;

            const pageDisplay = page ? `p.${page}` : '';
            let locationText = `${operaDisplayName} ${sceneName} ${pageDisplay}`.trim();
            if (whom) {
                locationText += `：${whom}`;
            }

            html += `<dd class="result-loc">【${locationText}】</dd>`;
        });
        
        // 各見出し語の件数を表示
        html += `<dd class="result-loc">(${itemsForThisDe.length}件)</dd>`;
        html += `</div>`;
    });

    return html;
}

// Get Unique Terms for RS/RW Local
window.getGenericTermsListLocal = function(dataKey) {
    const data = window.appData[dataKey];
    if (!data) return [];
    
    // Extract unique 'de' terms
    const terms = data
        // ページ番号（D列）が空欄のものを予測変換候補から除外
        .filter(row => row.page !== null && row.page !== undefined && String(row.page).trim() !== '')
        .map(row => ({ original: row.de, normalized: row.de_normalized || normalizeString(row.de) }))
        .filter(item => item.original && item.normalized);

    const uniqueTermsMap = new Map();
    terms.forEach(item => {
        if (!uniqueTermsMap.has(item.original)) {
            uniqueTermsMap.set(item.original, item);
        }
    });
    
    return Array.from(uniqueTermsMap.values());
};

// Helper to normalize string (Shared)
