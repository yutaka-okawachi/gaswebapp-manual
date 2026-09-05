// Page loader
async function showPage(pageName) {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<div class="loading">読み込み中...</div>';

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

}

const dataLoadPromises = {};
async function loadData(key) {
    const dependencies = {
        mahler: ['mahler', 'dic_terms_index'],
        richard_wagner: ['richard_wagner', 'rw_scenes', 'dic_terms_index', 'whom_list'],
        richard_strauss: ['richard_strauss', 'rs_scenes', 'dic_terms_index', 'whom_list'],
        terms_search: ['mahler', 'dic_terms_index'],
        rw_terms_search: ['richard_wagner', 'dic_terms_index'],
        rs_terms_search: ['richard_strauss', 'dic_terms_index'],
        dic: ['dic_notes', 'abbr_list', 'dic_terms_index'],
        notes: ['dic_notes'], rs_scenes: ['rs_scenes'], rw_scenes: ['rw_scenes']
    };
    await Promise.all((dependencies[key] || []).map(dataKey => {
        if (window.appData[dataKey]) return Promise.resolve();
        if (!dataLoadPromises[dataKey]) {
            dataLoadPromises[dataKey] = fetchJson(`data/${dataKey}.json`)
                .then(data => { window.appData[dataKey] = data; })
                .finally(() => { delete dataLoadPromises[dataKey]; });
        }
        return dataLoadPromises[dataKey];
    }));
}

const dictionaryExampleSearchConfig = Object.freeze({
    terms_search: {
        composer: 'gm',
        dataKey: 'mahler',
        fullDataPath: 'data/mahler.json'
    },
    rw_terms_search: {
        composer: 'rw',
        dataKey: 'richard_wagner',
        fullDataPath: 'data/richard_wagner.json'
    },
    rs_terms_search: {
        composer: 'rs',
        dataKey: 'richard_strauss',
        fullDataPath: 'data/richard_strauss.json'
    }
});
const dictionaryExamplePartialData = {};
const dictionaryExampleFullDataPromises = {};

window.loadDictionaryExampleData = async function(key, rawQuery) {
    const config = dictionaryExampleSearchConfig[key];
    const urlParams = new URLSearchParams(window.location.search);
    if (
        !config ||
        !rawQuery ||
        urlParams.get('source') !== 'dictionary_example'
    ) {
        return false;
    }

    const shardIds = Array.from(new Set(
        String(urlParams.get('example_shards') || '')
            .split(',')
            .map(value => Number(value))
            .filter(value => Number.isInteger(value) && value >= 0 && value < 16)
    ));
    if (shardIds.length === 0) return false;

    try {
        const shardRequests = shardIds.map(shardNumber => {
            const suffix = String(shardNumber).padStart(2, '0');
            return fetchJson(`data/dictionary-examples/${config.composer}-${suffix}.json`);
        });
        const dictionaryIndexRequest = window.appData.dic_terms_index
            ? Promise.resolve(window.appData.dic_terms_index)
            : fetchJson('data/dic_terms_index.json');

        const [shards, dictionaryIndex] = await Promise.all([
            Promise.all(shardRequests),
            dictionaryIndexRequest
        ]);
        window.appData[config.dataKey] = shards.reduce((rows, shard) => {
            return rows.concat(Array.isArray(shard) ? shard : []);
        }, []).sort((a, b) => {
            return Number(a.__exampleOrder || 0) - Number(b.__exampleOrder || 0);
        });
        window.appData[config.dataKey].forEach(row => {
            delete row.__exampleOrder;
        });
        window.appData.dic_terms_index = dictionaryIndex;
        dictionaryExamplePartialData[key] = true;
        return true;
    } catch (error) {
        console.warn('実例検索用の分割データを読み込めないため、通常データを使用します:', error);
        return false;
    }
};

window.hydrateDictionaryExampleData = function(key, onLoaded) {
    const config = dictionaryExampleSearchConfig[key];
    if (!config || !dictionaryExamplePartialData[key]) return;

    const loadFullData = () => {
        if (!dictionaryExampleFullDataPromises[key]) {
            dictionaryExampleFullDataPromises[key] = fetchJson(config.fullDataPath)
                .then(data => {
                    window.appData[config.dataKey] = data;
                    dictionaryExamplePartialData[key] = false;
                    if (typeof onLoaded === 'function') onLoaded(data);
                    return data;
                })
                .catch(error => {
                    delete dictionaryExampleFullDataPromises[key];
                    console.warn('全検索データのバックグラウンド読み込みに失敗:', error);
                });
        }
        return dictionaryExampleFullDataPromises[key];
    };

    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(loadFullData, { timeout: 1500 });
    } else {
        window.setTimeout(loadFullData, 250);
    }
};

async function fetchJson(path) {
    // console.log(`Fetching ${path}...`);
    // GitHub Pages の ETag/ブラウザキャッシュを利用する。時刻パラメータを
    // 毎回付けると数MBの検索データまで遷移のたびに再取得されてしまう。
    try {
        const response = await fetch(path, { cache: 'default' });
        if (!response.ok) {
            throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
        }
        return await response.json();
    } catch (firstError) {
        // Pagesの更新直後やEdgeのHTTPキャッシュに一時的な失敗が残った場合は、
        // キャッシュを使わない別URLで一度だけ再試行する。
        console.warn(`Retrying ${path} without cache:`, firstError);
        const separator = path.includes('?') ? '&' : '?';
        const retryUrl = `${path}${separator}retry=${Date.now()}`;
        const retryResponse = await fetch(retryUrl, { cache: 'no-store' });
        if (!retryResponse.ok) {
            throw new Error(`Failed to load ${path}: HTTP ${retryResponse.status}`);
        }
        return await retryResponse.json();
    }
}
