function renderDictionary(container) {
    container.innerHTML = `
        <div id="dic-container">
            <h1>ドイツ語の音楽用語集</h1>
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
    const firstChar = normalizeGermanForSort(text).charAt(0).toUpperCase();
    // 数字や記号の場合は "OTHER" を返す
    if (firstChar && !window.customOrder.includes(firstChar)) {
        return "OTHER";
    }
    return firstChar;
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
            if (anchorLetter && (window.customOrder.includes(anchorLetter) || anchorLetter === "OTHER") && !anchorSet[anchorLetter]) {
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

// Debounce function to limit the rate at which a function can fire
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Optimized scroll event handler with debounce
const handleScroll = debounce(() => {
    const btn = document.getElementById('scrollToTop');
    if (btn) {
        if (window.scrollY > 300) {
            btn.style.display = 'block';
        } else {
            btn.style.display = 'none';
        }
    }
}, 100); // Execute at most once every 100ms

window.addEventListener('scroll', handleScroll);

function focusResultsPanel(options) {
    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;

    const topOffset = Math.max((resultsDiv.getBoundingClientRect().top + window.scrollY) - 20, 0);
    const behavior = options && options.instant ? 'auto' : 'smooth';
    window.scrollTo({ top: topOffset, behavior });
}
window.focusResultsPanel = focusResultsPanel;

// --- Local Search Helpers for Terms ---
