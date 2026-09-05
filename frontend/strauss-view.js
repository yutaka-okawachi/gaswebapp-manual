function renderRichardStraussSearch(container) {
    container.innerHTML = `
        <div id="rs-search-container">
            <h1>曲名から検索 (RS)</h1>
            <p><b>Richard Strauss の管弦楽曲については<a href="dic.html" target="_blank">ドイツ語の音楽用語集</a>のページを参照</b></p>
            <p>オーケストラに対する指示で Gustav Mahler の用語検索ページで何とかなりそうなものは基本的に不記載．</p>
            <div class="big-label">曲名を選択</div>
            <details class="instrument-group" id="works-group">
                <summary>曲名</summary>
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
            </details>

            <div id="search-method-container" style="display: none;">
                <div class="big-label">検索方法を選択</div>
                <details class="instrument-group" id="search-method-group">
                    <summary>検索方法</summary>
                    <fieldset>
                        <legend>方法</legend>
                        <div class="radio-group">
                            <label><input type="radio" name="search-type" value="scene"> 場面から検索</label>
                            <label><input type="radio" name="search-type" value="page"> ページから検索</label>
                        </div>
                    </fieldset>
                </details>
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
            if (row.page === undefined || row.page === null || row.page === '') return false;
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
            if (row.page === undefined || row.page === null || row.page === '') return false;
            // row.page might be number or string
            return pages.has(Number(row.page));
        });

        const html = formatGenericResults(filteredData);
        document.getElementById('results').innerHTML = html;
    }, 10);
}

// --- Helper Functions ---
