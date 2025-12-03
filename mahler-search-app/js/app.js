// app.js
console.log('app.js: Script execution started');

// Global state to hold loaded data (guarded to avoid shadowing inline window.appData)
window.appData = window.appData || {
    mahler: null,
    richard_strauss: null,
    richard_wagner: null,
    rs_scenes: null,
    rw_scenes: null,
    dic_notes: null,
    abbr_list: null
};

// Page loader
async function showPage(pageName) {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<div class="loading">読み込み中...</div>';

    // DEBUG PANEL
    const debugDiv = document.createElement('div');
    debugDiv.id = 'debug-panel';

    console.log('app.js: showPage called');

    try {
        // Load data if not loaded
        if (!window.appData[pageName] && pageName !== 'index') {
            await loadData(pageName);
        }

        // Render content based on page
        switch (pageName) {
            case 'mahler':
                renderMahlerSearch(contentArea);
                break;
            case 'richard_strauss':
                renderRichardStraussSearch(contentArea);
                break;
            case 'richard_wagner':
                renderRichardWagnerSearch(contentArea);
                break;
            case 'dic':
                renderDictionary(contentArea);
                break;
            case 'notes':
                renderNotes(contentArea);
                break;
            default:
                contentArea.innerHTML = '<p style="text-align: center;">上のボタンから検索したい対象を選択してください。</p>';
        }
    } catch (error) {
        console.error(error);
        contentArea.innerHTML = `<div class="result-message">エラーが発生しました: ${error.message}</div>`;
    }

    debugDiv.style.border = '1px solid red';
    debugDiv.style.padding = '10px';
    debugDiv.style.marginTop = '20px';
    debugDiv.style.fontSize = '12px';
    debugDiv.style.fontFamily = 'monospace';
    debugDiv.style.whiteSpace = 'pre-wrap';
    debugDiv.style.backgroundColor = '#fff0f0';
    contentArea.appendChild(debugDiv);
}

async function loadData(key) {
    // Map page keys to filenames
    const fileMap = {
        'mahler': 'mahler.json',
        'richard_strauss': 'richard_strauss.json',
        'richard_wagner': 'richard_wagner.json',
        'rs_scenes': 'rs_scenes.json',
        'rw_scenes': 'rw_scenes.json',
        'dic': ['dic_notes.json', 'abbr_list.json'],
        'notes': 'notes.json'
    };

    // Handle special cases and aliases
    if (key === 'dic') {
        if (!window.appData.dic_notes) window.appData.dic_notes = await fetchJson('data/dic_notes.json');
        if (!window.appData.abbr_list) window.appData.abbr_list = await fetchJson('data/abbr_list.json');
        return;
    }

    if (key === 'rw_terms_search' || key === 'rs_terms_search') {
        if (!window.appData.dic_notes) window.appData.dic_notes = await fetchJson('data/dic_notes.json');
        return;
    }

    if (key === 'terms_search') {
        if (!window.appData.mahler) window.appData.mahler = await fetchJson('data/mahler.json');
        return;
    }

    // Standard case
    const filename = fileMap[key];
    if (filename) {
        window.appData[key] = await fetchJson(`data/${filename}`);
    }

    // Load scene data for operas
    if (key === 'richard_strauss' && !window.appData.rs_scenes) {
        window.appData.rs_scenes = await fetchJson('data/rs_scenes.json');
    }
    if (key === 'richard_wagner' && !window.appData.rw_scenes) {
        window.appData.rw_scenes = await fetchJson('data/rw_scenes.json');
    }
}

async function fetchJson(path) {
    // console.log(`Fetching ${path}...`);
    const url = `${path}?v=${new Date().getTime()}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${path}: ${response.statusText}`);
    }
    const data = await response.json();
    // console.log(`Fetched ${path}, size: ${Array.isArray(data) ? data.length : Object.keys(data).length}`);
    return data;
}

// --- Render Functions ---
// NOTE: All Mahler-related functions and mappings are defined in index.html inline script.
// DO NOT duplicate them here to avoid function overriding issues when app.js is loaded after index.html.
// The guarded window.* mappings and render functions are authoritative from index.html.

function renderRichardStraussSearch(container) {
    container.innerHTML = `
        <div id="rs-search-container">
            <h1>曲名から検索 (RS)</h1>
            <p><b>Richard Strauss の管弦楽曲については<a href="https://sites.google.com/site/brucknermahleryinleyongyu/%E7%94%A8%E8%AA%9E%E9%9B%86" target="_blank">用語集</a>のページを参照</b></p>
            <p>オーケストラに対する指示で Gustav Mahler の用語検索ページで何とかなりそうなものは基本的に不記載．</p>
            <div class="big-label">曲を選択</div>
            <fieldset>
                <legend>オペラ</legend>
                <div class="radio-group" id="opera-selection">
                    <label><input type="radio" name="opera" value="guntram"> Guntram, Op.25 (1888-93, revised 1934–39)</label>
                    <label><input type="radio" name="opera" value="feuersnot"> Feuersnot, Op.50 (1900-01)</label>
                    <label><input type="radio" name="opera" value="salome"> Salome, Op.54 (1903-05)</label>
                    <label><input type="radio" name="opera" value="elektra"> Elektra, Op.58 (1906-08)</label>
                    <label><input type="radio" name="opera" value="rosenkavalier"> Der Rosenkavalier, Op.59 (1909-10)</label>
                    <label><input type="radio" name="opera" value="ariadne"> Ariadne auf Naxos, Op.60 (1912, revised 1916)</label>
                    <label><input type="radio" name="opera" value="schatten"> Die Frau ohne Schatten, Op.65 (1914-17)</label>
                    <label><input type="radio" name="opera" value="intermezzo"> Intermezzo, Op.72 (1919-23)</label>
                    <label><input type="radio" name="opera" value="helena"> Die ägyptische Helena, Op.75 (1924-27)</label>
                    <label><input type="radio" name="opera" value="arabella"> Arabella, Op.79 (1930-32)</label>
                    <label><input type="radio" name="opera" value="schweigsame"> Die schweigsame Frau, Op.80 (1932-35)</label>
                    <label><input type="radio" name="opera" value="tag"> Friedenstag, Op.81 (1935-36)</label>
                    <label><input type="radio" name="opera" value="daphne"> Daphne, Op.82 (1936-37)</label>
                    <label><input type="radio" name="opera" value="danae"> Die Liebe der Danae, Op.83 (1938-40)</label>
                    <label><input type="radio" name="opera" value="cap"> Capriccio, Op.85 (1940-41)</label>
                </div>
            </fieldset>

            <div id="search-method-container" style="display: none;">
                <div class="big-label">検索方法を選択</div>
                <fieldset>
                    <legend>方法</legend>
                    <div class="radio-group">
                        <label><input type="radio" name="search-type" value="scene"> 場面から検索</label>
                        <label><input type="radio" name="search-type" value="page"> ページから検索</label>
                    </div>
                </fieldset>
            </div>

            <div id="scene-selection-container" class="accordion-content" style="display: none;">
                <fieldset>
                    <legend>場面</legend>
                    <div id="scene-options-wrapper"></div>
                </fieldset>
                <div class="button-container">
                    <button type="button" id="btn-search-scene" class="btn-search">検索</button>
                    <button type="button" id="btn-cancel-scene" class="btn-danger">中止</button>
                    <button type="button" id="btn-clear-scene" class="btn-clear">クリア</button>
                </div>
            </div>

            <div id="page-selection-container" class="accordion-content" style="display: none;">
                <fieldset>
                    <legend>ページ番号</legend>
                    <p style="font-size: 0.9em; color: #555;">ページ番号は半角で入力(例: 3,14,15-92)</p>
                    <input type="text" id="page-input" placeholder="例 3, 14, 15-92">
                </fieldset>
                <div class="button-container">
                    <button type="button" id="btn-search-page" class="btn-search">検索</button>
                    <button type="button" id="btn-cancel-page" class="btn-danger">中止</button>
                    <button type="button" id="btn-clear-page" class="btn-clear">クリア</button>
                </div>
            </div>

            <div id="results"></div>
        </div>
    `;

    attachRichardStraussEventHandlers();
}

function attachRichardStraussEventHandlers() {
    // Opera Selection
    document.querySelectorAll('input[name="opera"]').forEach(radio => {
        radio.addEventListener('change', handleOperaSelection);
    });

    // Search Type Selection
    document.querySelectorAll('input[name="search-type"]').forEach(radio => {
        radio.addEventListener('change', handleSearchTypeSelection);
    });

    // Buttons
    document.getElementById('btn-search-scene').addEventListener('click', searchRichardStraussByScene);
    document.getElementById('btn-cancel-scene').addEventListener('click', cancelSearch);
    document.getElementById('btn-clear-scene').addEventListener('click', clearScenes);

    document.getElementById('btn-search-page').addEventListener('click', searchRichardStraussByPage);
    document.getElementById('btn-cancel-page').addEventListener('click', cancelSearch);
    document.getElementById('btn-clear-page').addEventListener('click', clearPageInput);
}

function handleOperaSelection(event) {
    const operaValue = event.target.value;

    // Show search method container and reset
    document.getElementById('search-method-container').style.display = 'block';
    resetSearchType();

    const sceneOptionsWrapper = document.getElementById('scene-options-wrapper');
    sceneOptionsWrapper.innerHTML = '<div class="loading">場面データを読み込み中...</div>';

    // Get scenes from window.appData.rs_scenes
    const scenesData = window.appData.rs_scenes || [];
    const filteredScenes = scenesData.filter(s => normalizeString(s.Oper) === normalizeString(operaValue));

    if (filteredScenes.length === 0) {
        sceneOptionsWrapper.innerHTML = '<p>この曲の場面データは登録されていません。</p>';
        return;
    }

    // Generate checkboxes
    let html = '<div class="checkbox-group">';
    html += `<label><input type="checkbox" name="${operaValue}-scene" value="all"> すべて</label>`;
    if (filteredScenes.length > 1) html += '<hr>';

    filteredScenes.forEach(scene => {
        // Construct value as "Aufzug-Szene"
        // Note: rs_scenes.json has "Aufzug" and "Szene" keys.
        // We need to handle empty or 0 values gracefully if needed, but usually they are valid.
        const val = `${scene.Aufzug}-${scene.Szene}`;
        html += `<label><input type="checkbox" name="${operaValue}-scene" value="${val}"> ${scene['日本語']}</label>`;
    });
    html += '</div>';
    sceneOptionsWrapper.innerHTML = html;

    // Attach "All" checkbox logic
    const allCheckbox = sceneOptionsWrapper.querySelector(`input[name="${operaValue}-scene"][value="all"]`);
    const sceneCheckboxes = sceneOptionsWrapper.querySelectorAll(`input[name="${operaValue}-scene"]:not([value="all"])`);

    if (allCheckbox) {
        allCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                sceneCheckboxes.forEach(cb => cb.checked = false);
            }
        });
        sceneCheckboxes.forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) {
                    allCheckbox.checked = false;
                }
            });
        });
    }
}

function handleSearchTypeSelection(event) {
    const type = event.target.value;
    document.getElementById('scene-selection-container').style.display = type === 'scene' ? 'block' : 'none';
    document.getElementById('page-selection-container').style.display = type === 'page' ? 'block' : 'none';
    document.getElementById('results').innerHTML = '';
}

function resetSearchType() {
    document.querySelectorAll('input[name="search-type"]').forEach(radio => radio.checked = false);
    document.getElementById('scene-selection-container').style.display = 'none';
    document.getElementById('page-selection-container').style.display = 'none';
    document.getElementById('results').innerHTML = '';
}

function clearScenes() {
    const selectedOpera = document.querySelector('input[name="opera"]:checked');
    if (!selectedOpera) return;
    const operaValue = selectedOpera.value;
    document.querySelectorAll(`input[name="${operaValue}-scene"]`).forEach(cb => cb.checked = false);
    document.getElementById('results').innerHTML = '';
}

function clearPageInput() {
    document.getElementById('page-input').value = '';
    document.getElementById('results').innerHTML = '';
}

function searchRichardStraussByScene() {
    const selectedOpera = document.querySelector('input[name="opera"]:checked');
    if (!selectedOpera) {
        document.getElementById('results').innerHTML = '<div class="result-message">曲を選択してください</div>';
        return;
    }
    const operaValue = selectedOpera.value;

    const sceneCheckboxes = document.querySelectorAll(`input[name="${operaValue}-scene"]:checked`);
    const selectedScenes = Array.from(sceneCheckboxes).map(cb => cb.value);

    if (selectedScenes.length === 0) {
        document.getElementById('results').innerHTML = '<div class="result-message">場面を選択してください</div>';
        return;
    }

    document.getElementById('results').innerHTML = '<div class="loading">検索中...</div>';

    setTimeout(() => {
        const data = window.appData.richard_strauss;
        if (!data) {
            document.getElementById('results').innerHTML = '<div class="result-message">データが読み込まれていません。</div>';
            return;
        }

        const isAll = selectedScenes.includes('all');
        const filteredData = data.filter(row => {
            if (normalizeString(row.Oper) !== normalizeString(operaValue)) return false;
            if (isAll) return true;

            // Construct scene key from row data
            // row.Aufzug and row.Szene might be numbers or strings
            const rowKey = `${row.Aufzug}-${row.Szene}`;
            return selectedScenes.includes(rowKey);
        });

        const html = formatGenericResults(filteredData);
        document.getElementById('results').innerHTML = html;
    }, 10);
}

function searchRichardStraussByPage() {
    const selectedOpera = document.querySelector('input[name="opera"]:checked');
    if (!selectedOpera) {
        document.getElementById('results').innerHTML = '<div class="result-message">曲を選択してください</div>';
        return;
    }
    const operaValue = selectedOpera.value;
    const pageInput = document.getElementById('page-input').value.trim();

    if (!pageInput) {
        document.getElementById('results').innerHTML = '<div class="result-message">ページ番号を入力してください</div>';
        return;
    }

    document.getElementById('results').innerHTML = '<div class="loading">検索中...</div>';

    setTimeout(() => {
        const data = window.appData.richard_strauss;
        if (!data) {
            document.getElementById('results').innerHTML = '<div class="result-message">データが読み込まれていません。</div>';
            return;
        }

        const pages = parsePageInput(pageInput);
        if (pages.size === 0) {
            document.getElementById('results').innerHTML = '<div class="result-message">有効なページ番号が指定されていません。</div>';
            return;
        }

        const filteredData = data.filter(row => {
            if (normalizeString(row.Oper) !== normalizeString(operaValue)) return false;
            // row.page might be number or string
            return pages.has(Number(row.page));
        });

        const html = formatGenericResults(filteredData);
        document.getElementById('results').innerHTML = html;
    }, 10);
}

// --- Helper Functions ---

function normalizeString(str) {
    if (typeof str !== 'string') return '';
    return str.toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .trim();
}

function parsePageInput(input) {
    const pages = new Set();
    const parts = input.split(',');
    parts.forEach(part => {
        part = part.trim();
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let i = start; i <= end; i++) {
                    pages.add(i);
                }
            }
        } else {
            const num = Number(part);
            if (!isNaN(num)) {
                pages.add(num);
            }
        }
    });
    return pages;
}

// Helper functions for HTML escaping
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (match) {
        const escape = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        return escape[match];
    });
}

function escapeHtmlWithBreaks(str) {
    if (!str) return '';
    return escapeHtml(str).replace(/\n/g, '<br>');
}

function formatGenericResults(data) {
    if (data.length === 0) {
        return '<div class="result-message">該当するデータが見つかりませんでした。</div>';
    }

    // Sort by Aufzug, Szene, then page
    data.sort((a, b) => {
        const aufzugA = Number(a.Aufzug) || 0;
        const aufzugB = Number(b.Aufzug) || 0;
        if (aufzugA !== aufzugB) return aufzugA - aufzugB;

        const szeneA = Number(a.Szene) || 0;
        const szeneB = Number(b.Szene) || 0;
        if (szeneA !== szeneB) return szeneA - szeneB;

        const pageA = Number(a.page) || 0;
        const pageB = Number(b.page) || 0;
        return pageA - pageB;
    });

    let html = '';

    // Add score info at the top (once)
    if (data[0] && data[0].hasOwnProperty('楽譜情報') && data[0]['楽譜情報']) {
        html += `<div style="background-color: #e3f2fd; padding: 10px; margin-bottom: 15px; border-radius: 5px; font-family: 'Lora', serif;">楽譜情報: ${escapeHtml(data[0]['楽譜情報'])}</div>`;
    }

    let prevAufzug = null;
    let prevSzene = null;

    data.forEach(row => {
        const currentAufzug = row.Aufzug;
        const currentSzene = row.Szene;

        // Add scene title when Aufzug or Szene changes
        if (currentAufzug !== prevAufzug || currentSzene !== prevSzene) {
            let sceneTitle = '';
            
            // Use explicit Scene Title if available (from JSON export)
            if (row['場面タイトル']) {
                sceneTitle = row['場面タイトル'];
            } else {
                // Fallback to generating title from Aufzug/Szene
                const aufzugText = currentAufzug ? `第${currentAufzug}幕` : '';
                const szeneText = currentSzene ? `第${currentSzene}場` : '';
                sceneTitle = [aufzugText, szeneText].filter(t => t).join('');
            }
            
            if (sceneTitle) {
                html += `<h2 style="font-family: 'Lora', serif; font-size: 1.1em; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #333;">${sceneTitle}</h2><hr style="border-top: 1px solid #ccc; margin-bottom: 20px;">`;
            }
            
            prevAufzug = currentAufzug;
            prevSzene = currentSzene;
        }

        const pageDisplay = row.page ? `p.${row.page}` : '';
        const de = escapeHtmlWithBreaks(row.de);
        const ja = escapeHtmlWithBreaks(row.ja);
        const whom = escapeHtml(row.whom);

        html += `
            <div class="result-entry">
                <div class="result-page">${pageDisplay}</div>
                <div class="result-content">
                    <div class="result-de">${de}</div>
                    <div class="result-ja-loc">
                        <span>${ja}</span>
                        <span>【${whom}】</span>
                    </div>
                </div>
            </div>
        `;
    });

    return `<div>${data.length}件見つかりました。</div>${html}`;
}

function renderRichardWagnerSearch(container) {
    container.innerHTML = `
        <div id="rw-search-container">
            <h1>曲名から検索 (RW)</h1>
            <p><b>Richard Wagner の管弦楽曲については<a href="https://sites.google.com/site/brucknermahleryinleyongyu/%E7%94%A8%E8%AA%9E%E9%9B%86" target="_blank">用語集</a>のページを参照</b></p>
            <div class="big-label">曲を選択</div>
            <fieldset>
                <legend>オペラ</legend>
                <div class="radio-group" id="wagner-opera-selection">
                    <label><input type="radio" name="wagner-opera" value="feen"> Die Feen, WWV 32 (1833-34)</label>
                    <label><input type="radio" name="wagner-opera" value="liebes"> Das Liebesverbot, WWV 38 (1834)</label>
                    <label><input type="radio" name="wagner-opera" value="rienzi"> Rienzi, WWV 49 (1840)</label>
                    <label><input type="radio" name="wagner-opera" value="holländer"> Der fliegende Holländer, WWV 63 (1840-41)</label>
                    <label><input type="radio" name="wagner-opera" value="tann_dresden"> Tannhäuser, WWV 70 (1845, revised 1860 Dresden)</label>
                    <label><input type="radio" name="wagner-opera" value="tann_paris"> Tannhäuser, WWV 70 (1860-61, revised 1875 Paris)</label>
                    <label><input type="radio" name="wagner-opera" value="lohengrin"> Lohengrin, WWV 75 (1846-48)</label>
                    <label><input type="radio" name="wagner-opera" value="rheingold"> Das Rheingold, WWV 86A (1854)</label>
                    <label><input type="radio" name="wagner-opera" value="walküre"> Die Walküre, WWV 86B (1856-70)</label>
                    <label><input type="radio" name="wagner-opera" value="siegfried"> Siegfried, WWV 86C (1871)</label>
                    <label><input type="radio" name="wagner-opera" value="götter"> Götterdämmerung, WWV 86D (1848-74)</label>
                    <label><input type="radio" name="wagner-opera" value="tristan"> Tristan und Isolde, WWV 90 (1857-59)</label>
                    <label><input type="radio" name="wagner-opera" value="meister"> Die Meistersinger von Nürnberg, WWV 96 (1862-67)</label>
                    <label><input type="radio" name="wagner-opera" value="parsifal"> Parsifal, WWV 111 (1857-82)</label>
                </div>
            </fieldset>

            <div id="wagner-search-method-container" style="display: none;">
                <div class="big-label">検索方法を選択</div>
                <fieldset>
                    <legend>方法</legend>
                    <div class="radio-group">
                        <label><input type="radio" name="wagner-search-type" value="scene"> 場面から検索</label>
                        <label><input type="radio" name="wagner-search-type" value="page"> ページから検索</label>
                    </div>
                </fieldset>
            </div>

            <div id="wagner-scene-selection-container" class="accordion-content" style="display: none;">
                <fieldset>
                    <legend>場面</legend>
                    <div id="wagner-scene-options-wrapper"></div>
                </fieldset>
                <div class="button-container">
                    <button type="button" id="btn-search-wagner-scene" class="btn-search">検索</button>
                    <button type="button" id="btn-cancel-wagner-scene" class="btn-danger">中止</button>
                    <button type="button" id="btn-clear-wagner-scene" class="btn-clear">クリア</button>
                </div>
            </div>

            <div id="wagner-page-selection-container" class="accordion-content" style="display: none;">
                <fieldset>
                    <legend>ページ番号</legend>
                    <p style="font-size: 0.9em; color: #555;">ページ番号は半角で入力(例: 3,14,15-92)</p>
                    <input type="text" id="wagner-page-input" placeholder="例 3, 14, 15-92">
                </fieldset>
                <div class="button-container">
                    <button type="button" id="btn-search-wagner-page" class="btn-search">検索</button>
                    <button type="button" id="btn-cancel-wagner-page" class="btn-danger">中止</button>
                    <button type="button" id="btn-clear-wagner-page" class="btn-clear">クリア</button>
                </div>
            </div>

            <div id="results"></div>
        </div>
    `;

    attachRichardWagnerEventHandlers();
}

function attachRichardWagnerEventHandlers() {
    // Opera Selection
    document.querySelectorAll('input[name="wagner-opera"]').forEach(radio => {
        radio.addEventListener('change', handleWagnerOperaSelection);
    });

    // Search Type Selection
    document.querySelectorAll('input[name="wagner-search-type"]').forEach(radio => {
        radio.addEventListener('change', handleWagnerSearchTypeSelection);
    });

    // Buttons
    document.getElementById('btn-search-wagner-scene').addEventListener('click', searchRichardWagnerByScene);
    document.getElementById('btn-cancel-wagner-scene').addEventListener('click', cancelSearch);
    document.getElementById('btn-clear-wagner-scene').addEventListener('click', clearWagnerScenes);

    document.getElementById('btn-search-wagner-page').addEventListener('click', searchRichardWagnerByPage);
    document.getElementById('btn-cancel-wagner-page').addEventListener('click', cancelSearch);
    document.getElementById('btn-clear-wagner-page').addEventListener('click', clearWagnerPageInput);
}

function handleWagnerOperaSelection(event) {
    const operaValue = event.target.value;
    // console.log(`Selected opera: ${operaValue}`);
    // console.log(`appData.rw_scenes length: ${appData.rw_scenes ? appData.rw_scenes.length : 'undefined'}`);

    // Show search method container and reset
    document.getElementById('wagner-search-method-container').style.display = 'block';
    resetWagnerSearchType();

    const sceneOptionsWrapper = document.getElementById('wagner-scene-options-wrapper');
    sceneOptionsWrapper.innerHTML = '<div class="loading">場面データを読み込み中...</div>';

    // Get scenes from window.appData.rw_scenes
    const scenesData = window.appData.rw_scenes || [];
    const filteredScenes = scenesData.filter(s => normalizeString(s.Oper) === normalizeString(operaValue));
    // console.log(`Filtered scenes: ${filteredScenes.length}`);

    if (filteredScenes.length === 0) {
        sceneOptionsWrapper.innerHTML = '<p>この曲の場面データは登録されていません。</p>';
        return;
    }

    // Generate checkboxes
    let html = '<div class="checkbox-group">';
    html += `<label><input type="checkbox" name="${operaValue}-scene" value="all"> すべて</label>`;
    if (filteredScenes.length > 1) html += '<hr>';

    filteredScenes.forEach(scene => {
        // Construct value as "Aufzug-Szene"
        // Note: rw_scenes.json has "Aufzug" and "Szene" keys.
        const aufzug = scene.Aufzug !== undefined ? scene.Aufzug : '';
        const szene = scene.Szene !== undefined ? scene.Szene : '';
        const val = `${aufzug}-${szene}`;
        html += `<label><input type="checkbox" name="${operaValue}-scene" value="${val}"> ${scene['日本語']}</label>`;
    });
    html += '</div>';
    sceneOptionsWrapper.innerHTML = html;

    // Attach "All" checkbox logic
    const allCheckbox = sceneOptionsWrapper.querySelector(`input[name="${operaValue}-scene"][value="all"]`);
    const sceneCheckboxes = sceneOptionsWrapper.querySelectorAll(`input[name="${operaValue}-scene"]:not([value="all"])`);

    if (allCheckbox) {
        allCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                sceneCheckboxes.forEach(cb => cb.checked = false);
            }
        });
        sceneCheckboxes.forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) {
                    allCheckbox.checked = false;
                }
            });
        });
    }
}

function handleWagnerSearchTypeSelection(event) {
    const type = event.target.value;
    document.getElementById('wagner-scene-selection-container').style.display = type === 'scene' ? 'block' : 'none';
    document.getElementById('wagner-page-selection-container').style.display = type === 'page' ? 'block' : 'none';
    document.getElementById('results').innerHTML = '';
}

function resetWagnerSearchType() {
    document.querySelectorAll('input[name="wagner-search-type"]').forEach(radio => radio.checked = false);
    document.getElementById('wagner-scene-selection-container').style.display = 'none';
    document.getElementById('wagner-page-selection-container').style.display = 'none';
    document.getElementById('results').innerHTML = '';
}

function clearWagnerScenes() {
    const selectedOpera = document.querySelector('input[name="wagner-opera"]:checked');
    if (!selectedOpera) return;
    const operaValue = selectedOpera.value;
    document.querySelectorAll(`input[name="${operaValue}-scene"]`).forEach(cb => cb.checked = false);
    document.getElementById('results').innerHTML = '';
}

function clearWagnerPageInput() {
    document.getElementById('wagner-page-input').value = '';
    document.getElementById('results').innerHTML = '';
}

function searchRichardWagnerByScene() {
    const selectedOpera = document.querySelector('input[name="wagner-opera"]:checked');
    if (!selectedOpera) {
        document.getElementById('results').innerHTML = '<div class="result-message">曲を選択してください</div>';
        return;
    }
    const operaValue = selectedOpera.value;

    const sceneCheckboxes = document.querySelectorAll(`input[name="${operaValue}-scene"]:checked`);
    const selectedScenes = Array.from(sceneCheckboxes).map(cb => cb.value);

    if (selectedScenes.length === 0) {
        document.getElementById('results').innerHTML = '<div class="result-message">場面を選択してください</div>';
        return;
    }

    document.getElementById('results').innerHTML = '<div class="loading">検索中...</div>';

    setTimeout(() => {
        const data = window.appData.richard_wagner;
        if (!data) {
            document.getElementById('results').innerHTML = '<div class="result-message">データが読み込まれていません。</div>';
            return;
        }

        const isAll = selectedScenes.includes('all');
        const filteredData = data.filter(row => {
            if (normalizeString(row.Oper) !== normalizeString(operaValue)) return false;
            if (isAll) return true;

            // Construct scene key from row data
            const aufzug = (row.Aufzug !== undefined && row.Aufzug !== null) ? row.Aufzug : '';
            const szene = (row.Szene !== undefined && row.Szene !== null) ? row.Szene : '';
            const rowKey = `${aufzug}-${szene}`;

            return selectedScenes.includes(rowKey);
        });

        const html = formatGenericResults(filteredData);
        document.getElementById('results').innerHTML = html;
    }, 10);
}

function searchRichardWagnerByPage() {
    const selectedOpera = document.querySelector('input[name="wagner-opera"]:checked');
    if (!selectedOpera) {
        document.getElementById('results').innerHTML = '<div class="result-message">曲を選択してください</div>';
        return;
    }
    const operaValue = selectedOpera.value;
    const pageInput = document.getElementById('wagner-page-input').value.trim();

    if (!pageInput) {
        document.getElementById('results').innerHTML = '<div class="result-message">ページ番号を入力してください</div>';
        return;
    }

    document.getElementById('results').innerHTML = '<div class="loading">検索中...</div>';

    setTimeout(() => {
        const data = window.appData.richard_wagner;
        if (!data) {
            document.getElementById('results').innerHTML = '<div class="result-message">データが読み込まれていません。</div>';
            return;
        }

        const pages = parsePageInput(pageInput);
        if (pages.size === 0) {
            document.getElementById('results').innerHTML = '<div class="result-message">有効なページ番号が指定されていません。</div>';
            return;
        }

        const filteredData = data.filter(row => {
            if (normalizeString(row.Oper) !== normalizeString(operaValue)) return false;
            return pages.has(Number(row.page));
        });

        const html = formatGenericResults(filteredData);
        document.getElementById('results').innerHTML = html;
    }, 10);
}

function renderDictionary(container) {
    container.innerHTML = `
        <div id="dic-container">
            <h1>用語集</h1>
            <div class="top-message sticky-top-message" id="listStickyNotice">
                Gustav Mahler の用語検索ページで何とかなりそうなものは基本的に不記載．<br>
                略記一覧は<a href="#abbrListContainer">こちら</a>
            </div>
            
            <div id="listContainer">
                <div class="loading">表示中・・・</div>
            </div>

            <hr class="section-divider">

            <div id="abbrListContainer">
                <div class="top-message" id="abbrMessage">(*)は特記すべきドイツ語はなし</div>
                <div id="abbrContent">
                    <div class="loading">表示中・・・</div>
                </div>
            </div>
            
            <!-- Floating Alphabet Bar -->
            <div id="alpha-floating-bar">
                <a href="#" onclick="window.scrollTo({top:0, behavior:'smooth'}); return false;">Top</a>
                ${generateAlphabetLinks()}
            </div>
        </div>
    `;

    // Render Dictionary List
    const dicData = window.appData.dic_notes || [];
    renderDictionaryList(dicData);

    // Render Abbreviation List
    const abbrData = window.appData.abbr_list || [];
    renderAbbrList(abbrData);
}

function renderNotes(container) {
    container.innerHTML = `
        <div id="notes-container">
            <h1>訳出についての覚書</h1>
            <div id="notesContent">
                <p>現在、このコンテンツは準備中です。</p>
            </div>
        </div>
    `;
}

// --- Dictionary Helper Functions ---

// NOTE: customOrder is defined in index.html and guarded to window.customOrder.
// Ensure it's available for dictionary functions.
window.customOrder = window.customOrder || [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K",
    "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U",
    "V", "W", "X", "Y", "Z"
];

function getOrder(letter) {
    const idx = window.customOrder.indexOf(letter);
    return idx === -1 ? 999 : idx;
}

function normalizeGermanForSort(text) {
    if (typeof text !== "string") return "";
    const trimmed = text.trim();
    if (!trimmed) return "";
    const normalized = typeof trimmed.normalize === "function"
        ? trimmed.normalize("NFD")
        : trimmed;
    return normalized.replace(/[\u0300-\u036f]/g, "").replace(/ß/gi, "ss");
}

function getSortLetter(text) {
    return normalizeGermanForSort(text).charAt(0).toUpperCase();
}

function compareGermanStrings(a, b) {
    const letterA = getSortLetter(a);
    const letterB = getSortLetter(b);
    const orderDiff = getOrder(letterA) - getOrder(letterB);
    if (orderDiff !== 0) return orderDiff;

    const textA = (a || "").toString().trim();
    const textB = (b || "").toString().trim();
    if (typeof textA.localeCompare === "function") {
        return textA.localeCompare(textB, "de", { sensitivity: "base" });
    }
    if (textA === textB) return 0;
    return textA > textB ? 1 : -1;
}

function generateAlphabetLinks() {
    return window.customOrder.map(letter => `<a href="#letter-${letter}">${letter}</a>`).join('\n');
}

function renderDictionaryList(data) {
    const container = document.getElementById("listContainer");
    if (!data || data.length === 0) {
        container.innerHTML = '<div class="result-message">データが存在しません。</div>';
        return;
    }

    // Sort data
    // data is array of [german, translation, source]
    data.sort((a, b) => compareGermanStrings(a[0], b[0]));

    container.innerHTML = "";
    const anchorSet = {};

    data.forEach(row => {
        const [german, translation, source] = row;

        const rowDiv = document.createElement("div");
        rowDiv.classList.add("row");

        // Anchor assignment
        if (german && typeof german === "string") {
            const anchorLetter = getSortLetter(german);
            if (anchorLetter && window.customOrder.includes(anchorLetter) && !anchorSet[anchorLetter]) {
                rowDiv.id = "letter-" + anchorLetter;
                anchorSet[anchorLetter] = true;
            }
        }

        // German term
        const germanWrapper = document.createElement("div");
        const germanSpan = document.createElement("span");
        germanSpan.classList.add("german");
        germanSpan.textContent = german;

        const sourceSpan = document.createElement("span");
        sourceSpan.classList.add("source");
        sourceSpan.textContent = source;

        germanWrapper.appendChild(germanSpan);
        germanWrapper.appendChild(sourceSpan);
        rowDiv.appendChild(germanWrapper);

        // Translation
        const translationDiv = document.createElement("div");
        translationDiv.classList.add("translation");
        translationDiv.textContent = translation;

        rowDiv.appendChild(translationDiv);
        container.appendChild(rowDiv);
    });
}

function renderAbbrList(data) {
    const contentContainer = document.getElementById("abbrContent");
    contentContainer.innerHTML = "";

    if (!data || data.length === 0) {
        contentContainer.innerHTML = '<p>（略記一覧のデータが存在しませんでした）</p>';
        return;
    }

    data.forEach(row => {
        const [colA, colB, colC] = row;

        if (colA && !isNaN(parseInt(colA))) {
            const titleDiv = document.createElement("div");
            titleDiv.classList.add("abbr-title");
            titleDiv.textContent = colB;
            contentContainer.appendChild(titleDiv);
        } else {
            const rowDiv = document.createElement("div");
            rowDiv.classList.add("abbr-row");

            const shortSpan = document.createElement("span");
            shortSpan.classList.add("abbr-short");
            shortSpan.textContent = colB;

            const longSpan = document.createElement("span");
            longSpan.classList.add("abbr-long");
            longSpan.textContent = colC;

            rowDiv.appendChild(shortSpan);
            rowDiv.appendChild(longSpan);
            contentContainer.appendChild(rowDiv);
        }
    });
}


// Scroll to top logic
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.addEventListener('scroll', () => {
    const btn = document.getElementById('scrollToTop');
    if (window.scrollY > 300) {
        btn.style.display = 'block';
    } else {
        btn.style.display = 'none';
    }
});

function focusResultsPanel(options) {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;

    const topOffset = Math.max((resultsDiv.getBoundingClientRect().top + window.scrollY) - 20, 0);
    const behavior = options && options.instant ? 'auto' : 'smooth';
    window.scrollTo({ top: topOffset, behavior });
}
window.focusResultsPanel = focusResultsPanel;

// --- Local Search Helpers for Terms ---

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
            <div><span class="german">${escapeHtml(german)}</span><span class="source">${escapeHtml(source)}</span></div>
            <div class="translation">${escapeHtmlWithBreaks(translation)}</div>
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
    "all": "ALLE", "dir": "Dirigent", "v1": "Violine1", "v2": "Violine2", "va": "Bratche", "vc": "Violoncello",
    "kb": "Kontrabaß", "sv": "Solo Violine", "sva": "Solo Bratche", "svc": "Solo Violoncello", "skb": "Solo Kontrabaß",
    "fl": "Flöte", "pic": "Piccolo", "ob": "Oboe", "eh": "Englischhorn", "cl": "Klarinette", "escl": "Es-Klarinette",
    "bcl": "Bassklarinette", "fg": "Fagott", "cfg": "Kontrafagott", "tr": "Trompete", "pis": "Piston",
    "phr": "Posthorn", "hr": "Horn", "thr": "Tenorhorn", "ohr": "Obligates Horn", "fhr": "Flügelhorn",
    "whr": "Waldhorn", "pos": "Posaune", "bt": "Basstuba", "pau": "Pauken", "gtr": "Gloße Trommel",
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
                resultHTML += `<div class="result-a">${escapeHtmlWithBreaks(deData)}</div>`;
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

window.searchMahlerTermsLocal = function (query) {
    const data = window.appData.mahler;
    if (!data) return '<div class="result-message">データが読み込まれていません。</div>';

    const normalizedQuery = normalizeString(query);
    const results = data.filter(row => {
        const deNormalized = row.de_normalized || row[1];
        return deNormalized && deNormalized.includes(normalizedQuery);
    });

    if (results.length === 0) {
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
                resultHTML += `<div class="result-a">${escapeHtmlWithBreaks(deData)}</div>`;
                resultHTML += `<div class="result-c">${escapeHtmlWithBreaks(jaData)}</div>`;
                matchedLocList.forEach(loc => {
                    resultHTML += `<div class="result-loc">${escapeHtml(loc)}</div>`;
                });
                resultHTML += `<div class="result-loc">(${segmentCount}件)</div>`;
                resultHTML += '<hr style="border-top: 1px dashed #ccc; margin: 10px 0;">';
            }
        });
    } catch (e) {
        console.error("Error in searchMahlerTermsLocal:", e);
        return `<div class="result-message">検索中にエラーが発生しました: ${e.message}</div>`;
    }

    return totalMatches === 0 ? '<div class="result-message">該当するデータが見つかりませんでした。</div>' : `<div>${totalMatches}件ありました。</div>${resultHTML}`;
};

// RS Terms Search Local
window.searchRSTermsLocal = function (query) {
    return searchGenericTermsLocal(query, 'richard_strauss', 'RS');
};

// RW Terms Search Local
window.searchRWTermsLocal = function (query) {
    return searchGenericTermsLocal(query, 'richard_wagner', 'RW');
};

// Generic Terms Search Local for RS/RW
function searchGenericTermsLocal(query, dataKey, type) {
    const data = window.appData[dataKey];
    if (!data) return '<div class="result-message">データが読み込まれていません。</div>';

    const normalizedQuery = normalizeString(query);
    
    // Filter data
    const filteredData = data.filter(row => {
        const de = row.de || '';
        const deNormalized = row.de_normalized || normalizeString(de);
        const pageExists = row.page !== null && row.page !== undefined && String(row.page).trim() !== '';
        return deNormalized.includes(normalizedQuery) && pageExists;
    });

    if (filteredData.length === 0) {
        return '<div class="result-message">該当するデータが見つかりませんでした。</div>';
    }

    // Group by 'de' text
    const groupedByDe = filteredData.reduce((acc, row) => {
        const de = row.de || '（ドイツ語なし）';
        if (!acc[de]) {
            acc[de] = [];
        }
        acc[de].push(row);
        return acc;
    }, {});

    let html = `<div class="result-message">全部で${filteredData.length}件ありました。</div>`;
    
    const sortedDeKeys = Object.keys(groupedByDe).sort((a, b) => a.localeCompare(b, 'de'));
    
    // Opera display names mapping
    const operaDisplayNames = {
        'guntram': 'Guntram', 'feuersnot': 'Feuersnot', 'salome': 'Salome',
        'elektra': 'Elektra', 'rosenkavalier': 'Der Rosenkavalier', 'ariadne': 'Ariadne auf Naxos',
        'schatten': 'Die Frau ohne Schatten', 'intermezzo': 'Intermezzo', 'helena': 'Die ägyptische Helena',
        'arabella': 'Arabella', 'schweigsame': 'Die schweigsame Frau', 'tag': 'Friedenstag',
        'daphne': 'Daphne', 'danae': 'Die Liebe der Danae', 'cap': 'Capriccio',
        'feen': 'Die Feen', 'liebes': 'Das Liebesverbot', 'rienzi': 'Rienzi',
        'hollaender': 'Der fliegende Holländer', 'tannhaeuser': 'Tannhäuser', 'lohengrin': 'Lohengrin',
        'tristan': 'Tristan und Isolde', 'meistersinger': 'Die Meistersinger von Nürnberg',
        'rheingold': 'Das Rheingold', 'walkuere': 'Die Walküre', 'siegfried': 'Siegfried',
        'goetterdaemmerung': 'Götterdämmerung', 'parsifal': 'Parsifal'
    };

    sortedDeKeys.forEach(de => {
        html += `<div class="result-a">${escapeHtmlWithBreaks(de)}</div>`;
        
        groupedByDe[de].forEach(row => {
            const ja = escapeHtmlWithBreaks(String(row.ja || ''));
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
                locationText = `${locationText} 【${whom}】`;
            }

            html += `<div class="result-c">${ja}</div>`;
            html += `<div class="result-loc">${locationText}</div>`;
        });
    });

    return html;
}

// Get Unique Terms for RS/RW Local
window.getGenericTermsListLocal = function(dataKey) {
    const data = window.appData[dataKey];
    if (!data) return [];
    
    // Extract unique 'de' terms
    const terms = data
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
function normalizeString(str) {
    if (!str) return '';
    return str.toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .replace(/[^a-z0-9.]/g, '');
}
