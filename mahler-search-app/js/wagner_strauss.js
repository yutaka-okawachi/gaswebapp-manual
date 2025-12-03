/*
 * wagner_strauss.js
 * 共通JS: リヒャルト・ワーグナー／リヒャルト・シュトラウス「曲名から検索」ページで
 * オペラ選択・検索方法切り替え・場面データ取得・検索実行を担当。
 */

const sceneOptionsCache = {};
let currentSearchId = 0;

document.addEventListener('DOMContentLoaded', async () => {
    // Load data locally first
    const composer = document.title.includes('Wagner') || document.title.includes('RW') ? 'richard_wagner' : 'richard_strauss';
    if (typeof loadData === 'function') {
        await loadData(composer);
        // Also load scene data
        if (composer === 'richard_wagner') await loadData('rw_scenes');
        if (composer === 'richard_strauss') await loadData('rs_scenes');
    }

    document.querySelectorAll('input[name="opera"]').forEach(radio => {
        radio.addEventListener('change', handleOperaSelection);
    });
    document.querySelectorAll('input[name="search-type"]').forEach(radio => {
        radio.addEventListener('change', handleSearchTypeSelection);
    });
});

/**
 * オペラ（曲名）が選択されたときの処理
 */
function handleOperaSelection(event) {
    const operaValue = event.target.value;
    const composer = (document.title.includes('Wagner') || document.title.includes('RW')) ? 'richard_wagner' : 'richard_strauss';

    // 検索方法セクションを表示し初期化
    document.getElementById('search-method-container').style.display = 'block';
    resetSearchType();

    const sceneOptionsWrapper = document.getElementById('scene-options-wrapper');
    sceneOptionsWrapper.innerHTML = '<p class="loading">場面データを読み込み中...</p>';

    // キャッシュ済みであればそれを利用
    if (sceneOptionsCache[composer] && sceneOptionsCache[composer][operaValue]) {
        buildSceneCheckboxes(operaValue, sceneOptionsCache[composer]);
        return;
    }

    // サーバーから場面データを取得 (Local fallback)
    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(options => {
                if (!sceneOptionsCache[composer]) sceneOptionsCache[composer] = {};
                Object.assign(sceneOptionsCache[composer], options || {});
                buildSceneCheckboxes(operaValue, sceneOptionsCache[composer]);
            })
            .withFailureHandler(err => {
                console.error('場面データの取得に失敗しました', err);
                sceneOptionsWrapper.innerHTML = '<p class="result-message">場面データの取得に失敗しました</p>';
            })
            .getSceneOptionsForOpera(composer);
    } else {
        // Local fallback
        setTimeout(() => {
            try {
                const scenesData = composer === 'richard_wagner' ? window.appData.rw_scenes : window.appData.rs_scenes;
                if (!scenesData) {
                    sceneOptionsWrapper.innerHTML = '<p class="result-message">場面データが読み込まれていません。</p>';
                    return;
                }

                // Filter scenes for this opera
                const filteredScenes = scenesData.filter(s => normalizeString(s.Oper) === normalizeString(operaValue));

                // Transform to options format expected by buildSceneCheckboxes
                const options = filteredScenes.map(scene => {
                    const aufzug = scene.Aufzug !== undefined ? scene.Aufzug : '';
                    const szene = scene.Szene !== undefined ? scene.Szene : '';
                    const val = `${aufzug}-${szene}`;
                    return { value: val, text: scene['日本語'] };
                });

                if (!sceneOptionsCache[composer]) sceneOptionsCache[composer] = {};
                sceneOptionsCache[composer][operaValue] = options;

                buildSceneCheckboxes(operaValue, sceneOptionsCache[composer]);
            } catch (e) {
                console.error('Error in local scene loading:', e);
                sceneOptionsWrapper.innerHTML = `<p class="result-message">場面データの読み込み中にエラーが発生しました: ${e.message}</p>`;
            }
        }, 10);
    }
}

/**
 * 取得した場面データをもとにチェックボックス群を描画
 */
function buildSceneCheckboxes(operaValue, sceneOptionsData) {
    const wrapper = document.getElementById('scene-options-wrapper');
    wrapper.innerHTML = '';
    const options = sceneOptionsData[operaValue];

    if (!options || options.length === 0) {
        wrapper.innerHTML = '<p>この曲の場面データは登録されていません。</p>';
        return;
    }

    const checkboxGroup = document.createElement('div');
    checkboxGroup.className = 'checkbox-group';

    // 「すべて」チェックボックス
    checkboxGroup.innerHTML += `<label><input type="checkbox" name="${operaValue}-scene" value="all"> すべて</label>`;
    if (options.length > 1) {
        checkboxGroup.innerHTML += '<hr>';
    }

    options.forEach(opt => {
        checkboxGroup.innerHTML += `<label><input type="checkbox" name="${operaValue}-scene" value="${opt.value}"> ${opt.text}</label>`;
    });

    wrapper.appendChild(checkboxGroup);

    // 「すべて」チェックボックスの排他制御
    const sceneCheckboxes = wrapper.querySelectorAll(`input[name="${operaValue}-scene"]`);
    if (sceneCheckboxes.length > 1) {
        const allCheckbox = wrapper.querySelector(`input[name="${operaValue}-scene"][value="all"]`);
        sceneCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.value === 'all' && cb.checked) {
                    sceneCheckboxes.forEach(other => {
                        if (other.value !== 'all') other.checked = false;
                    });
                } else if (cb.value !== 'all' && cb.checked && allCheckbox) {
                    allCheckbox.checked = false;
                }
            });
        });
    }
}

/**
 * 検索方法（場面 / ページ）が選択されたときの処理
 */
function handleSearchTypeSelection(event) {
    const type = event.target.value;
    document.getElementById('scene-selection-container').style.display = type === 'scene' ? 'block' : 'none';
    document.getElementById('page-selection-container').style.display = type === 'page' ? 'block' : 'none';
}

/**
 * 検索方法の選択状態をリセット
 */
function resetSearchType() {
    document.querySelectorAll('input[name="search-type"]').forEach(radio => (radio.checked = false));
    document.getElementById('scene-selection-container').style.display = 'none';
    document.getElementById('page-selection-container').style.display = 'none';
    setResults('');
}

/**
 * 場面で検索
 */
function searchByScene() {
    const selectedOpera = document.querySelector('input[name="opera"]:checked');
    if (!selectedOpera) {
        setResults('<p class="result-message">曲を選択してください</p>');
        return;
    }

    document.querySelectorAll('#scene-selection-container .btn-search').forEach(btn => {
        btn.disabled = true;
    });

    const operaValue = selectedOpera.value;
    const sceneCheckboxes = document.querySelectorAll(`input[name="${operaValue}-scene"]:checked`);
    const selectedScenes = Array.from(sceneCheckboxes).map(cb => cb.value);
    if (selectedScenes.length === 0) {
        setResults('<p class="result-message">場面を選択してください</p>');
        document.querySelectorAll('#scene-selection-container .btn-search').forEach(btn => {
            btn.disabled = false;
        });
        return;
    }

    setResults('<p class="loading">検索中・・・</p>');
    currentSearchId++;
    const thisSearchId = currentSearchId;

    const composer = (document.title.includes('Wagner') || document.title.includes('RW')) ? 'richard_wagner' : 'richard_strauss';
    const funcName = composer === 'richard_wagner'
        ? 'searchRichardWagnerByScene'
        : 'searchRichardStraussByScene';

    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(html => {
                if (thisSearchId === currentSearchId) setResults(html);
                document.querySelectorAll('#scene-selection-container .btn-search').forEach(btn => {
                    btn.disabled = false;
                });
            })
            .withFailureHandler(err => {
                if (thisSearchId === currentSearchId) {
                    setResults(`<p class="result-message">検索に失敗しました: ${err.message}</p>`);
                }
                document.querySelectorAll('#scene-selection-container .btn-search').forEach(btn => {
                    btn.disabled = false;
                });
            })[funcName](operaValue, selectedScenes);
    } else {
        // Local fallback
        setTimeout(() => {
            if (thisSearchId !== currentSearchId) return;

            try {
                const data = window.appData[composer];
                if (!data) {
                    setResults('<div class="result-message">データが読み込まれていません。</div>');
                    return;
                }

                const isAll = selectedScenes.includes('all');
                const filteredData = data.filter(row => {
                    if (normalizeString(row.Oper) !== normalizeString(operaValue)) return false;
                    if (row.page === undefined || row.page === null || row.page === '') return false;
                    if (isAll) return true;

                    const aufzug = (row.Aufzug !== undefined && row.Aufzug !== null) ? row.Aufzug : '';
                    const szene = (row.Szene !== undefined && row.Szene !== null) ? row.Szene : '';
                    const rowKey = `${aufzug}-${szene}`;

                    return selectedScenes.includes(rowKey);
                });

                const items = prepareGenericResults(filteredData);
                setResults(items);

                // Send notification
                if (typeof sendSearchNotification === 'function') {
                    const details = {
                        work: operaValue,
                        scope: selectedScenes.join(', '),
                        term: 'Scene Search'
                    };
                    sendSearchNotification(details, composer);
                }
            } catch (e) {
                console.error('Error in local scene search:', e);
                setResults(`<p class="result-message">検索中にエラーが発生しました: ${e.message}</p>`);
            } finally {
                document.querySelectorAll('#scene-selection-container .btn-search').forEach(btn => btn.disabled = false);
            }
        }, 10);
    }
}

/**
 * ページ番号で検索
 */
function searchByPage() {
    const selectedOpera = document.querySelector('input[name="opera"]:checked');
    if (!selectedOpera) {
        setResults('<p class="result-message">曲を選択してください</p>');
        return;
    }

    document.querySelectorAll('#page-selection-container .btn-search').forEach(btn => {
        btn.disabled = true;
    });

    const operaValue = selectedOpera.value;
    const pageInput = document.getElementById('page-input').value.trim();
    if (!pageInput) {
        setResults('<p class="result-message">ページ番号を入力してください</p>');
        document.querySelectorAll('#page-selection-container .btn-search').forEach(btn => {
            btn.disabled = false;
        });
        return;
    }

    setResults('<p class="loading">検索中・・・</p>');
    currentSearchId++;
    const thisSearchId = currentSearchId;

    const composer = (document.title.includes('Wagner') || document.title.includes('RW')) ? 'richard_wagner' : 'richard_strauss';
    const funcName = composer === 'richard_wagner'
        ? 'searchRichardWagnerByPage'
        : 'searchRichardStraussByPage';

    if (typeof google !== 'undefined' && google.script && google.script.run) {
        google.script.run
            .withSuccessHandler(html => {
                // Note: Server side still returns HTML. If we want lazy loading for server results, 
                // we'd need to update server code to return JSON. 
                // For now, we assume local fallback is primary or server returns HTML which we just display.
                // If the user wants lazy loading everywhere, we should prioritize local search or update server.
                // Given the context "Local fallback" is used in the plan, we focus on that.
                if (thisSearchId === currentSearchId) setResults(html);
                document.querySelectorAll('#page-selection-container .btn-search').forEach(btn => {
                    btn.disabled = false;
                });
            })
            .withFailureHandler(err => {
                if (thisSearchId === currentSearchId) {
                    setResults(`<p class="result-message">検索に失敗しました: ${err.message}</p>`);
                }
                document.querySelectorAll('#page-selection-container .btn-search').forEach(btn => {
                    btn.disabled = false;
                });
            })[funcName](operaValue, pageInput);
    } else {
        // Local fallback
        setTimeout(() => {
            if (thisSearchId !== currentSearchId) return;

            try {
                const data = window.appData[composer];
                if (!data) {
                    setResults('<div class="result-message">データが読み込まれていません。</div>');
                    return;
                }

                const pages = parsePageInput(pageInput);
                if (pages.size === 0) {
                    setResults('<div class="result-message">有効なページ番号が指定されていません。</div>');
                    return;
                }

                const filteredData = data.filter(row => {
                    if (normalizeString(row.Oper) !== normalizeString(operaValue)) return false;
                    if (row.page === undefined || row.page === null || row.page === '') return false;
                    return pages.has(Number(row.page));
                });

                const items = prepareGenericResults(filteredData);
                setResults(items);

                // Send notification
                if (typeof sendSearchNotification === 'function') {
                    const details = {
                        work: operaValue,
                        scope: 'Page ' + pageInput,
                        term: 'Page Search'
                    };
                    sendSearchNotification(details, composer);
                }
            } catch (e) {
                console.error('Error in local page search:', e);
                setResults(`<p class="result-message">検索中にエラーが発生しました: ${e.message}</p>`);
            } finally {
                document.querySelectorAll('#page-selection-container .btn-search').forEach(btn => btn.disabled = false);
            }
        }, 10);
    }
}

/**
 * 検索を中止
 */
function cancelSearch() {
    currentSearchId++;
    setResults('<p class="loading">検索を中止しました</p>');
    document.querySelectorAll('.btn-search').forEach(btn => (btn.disabled = false));
}

function clearScenes() {
    const selectedOpera = document.querySelector('input[name="opera"]:checked');
    if (!selectedOpera) return;
    const operaValue = selectedOpera.value;
    document.querySelectorAll(`input[name="${operaValue}-scene"]`).forEach(cb => {
        cb.checked = false;
    });
    setResults('');
}

function clearPageInput() {
    document.getElementById('page-input').value = '';
    setResults('');
}

// Helper for setResults
function setResults(content) {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;

    if (Array.isArray(content)) {
        // Use LazyLoader
        new LazyLoader('results', content, renderGenericItem);
    } else {
        // String content (HTML or message)
        resultsDiv.innerHTML = content;
    }

    if (typeof focusResultsPanel === 'function') {
        focusResultsPanel({ instant: true });
    }
}
