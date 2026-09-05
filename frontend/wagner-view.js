function renderRichardWagnerSearch(container) {
    container.innerHTML = `
        <div id="rw-search-container">
            <h1>曲名から検索 (RW)</h1>
            <p><b>Richard Wagner の管弦楽曲については<a href="dic.html" target="_blank">ドイツ語の音楽用語集</a>のページを参照</b></p>
            <div class="big-label">曲名を選択</div>
            <details class="instrument-group" id="wagner-works-group">
                <summary>曲名</summary>
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
            </details>

            <div id="wagner-search-method-container" style="display: none;">
                <div class="big-label">検索方法を選択</div>
                <details class="instrument-group" id="wagner-search-method-group">
                    <summary>検索方法</summary>
                    <fieldset>
                        <legend>方法</legend>
                        <div class="radio-group">
                            <label><input type="radio" name="wagner-search-type" value="scene"> 場面から検索</label>
                            <label><input type="radio" name="wagner-search-type" value="page"> ページから検索</label>
                        </div>
                    </fieldset>
                </details>
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
            if (row.page === undefined || row.page === null || row.page === '') return false;
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
            if (row.page === undefined || row.page === null || row.page === '') return false;
            return pages.has(Number(row.page));
        });

        const html = formatGenericResults(filteredData);
        document.getElementById('results').innerHTML = html;
    }, 10);
}
