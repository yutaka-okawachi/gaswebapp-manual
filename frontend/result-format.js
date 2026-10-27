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

// --- Dictionary Link Functions ---

/**
 * 用語をID用の文字列に正規化する
 * @param {string} term - ドイツ語用語
 * @return {string} 正規化されたID文字列
 */


/**
 * 正規化された用語から正規表現パターンを生成
 * @param {string} normalizedTerm - 正規化された用語
 * @return {string} 正規表現パターン
 */




/**
 * テキスト内の辞書用語をリンクに変換する
 * @param {string} text - 変換対象のテキスト
 * @param {Object} termsIndex - 用語インデックス（正規化キー → ID）
 * @return {string} リンク付きHTML
 */


// --- Dictionary Link Functions ---

/**
 * 用語をID用の文字列に正規化する
 * @param {string} term - ドイツ語用語
 * @return {string} 正規化されたID文字列
 */
function normalizeForId(term) {
    if (!term) return '';
    let id = term.replace(/\[\[score:[a-z][a-z0-9-]{0,95}\]\]/gi, '').toLowerCase().trim();
    // ウムラウトの変換
    id = id.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
    // 非英数字をハイフンに置換
    id = id.replace(/[^a-z0-9]+/g, '-');
    // 先頭・末尾のハイフンを削除
    id = id.replace(/^-+|-+$/g, '');
    return id;
}

/**
 * 正規化された用語から正規表現パターンを生成
 * @param {string} normalizedTerm - 正規化された用語
 * @return {string} 正規表現パターン
 */
function generateOriginalTermPattern(originalTerm) {
    if (!originalTerm) return null;
    const source = escapeHtml(originalTerm).toLowerCase().trim();
    let pattern = '';

    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        if (/\s/.test(char)) {
            while (i + 1 < source.length && /\s/.test(source[i + 1])) i++;
            pattern += '[\\s\\-]*';
        } else if (char === '.') {
            pattern += '\\.?';
        } else if (char === '-') {
            pattern += '[\\s\\-]?';
        } else if (char === ',') {
            pattern += '[,;:]?';
        } else if (char === 'ä') {
            pattern += '(?:ae|ä)';
        } else if (char === 'ö') {
            pattern += '(?:oe|ö)';
        } else if (char === 'ü') {
            pattern += '(?:ue|ü)';
        } else if (char === 'ß') {
            pattern += '(?:ss|ß)';
        } else {
            pattern += char.replace(/[\\^$*+?()[\]{}|]/g, '\\$&');
        }
    }

    return pattern;
}

function generateTermPattern(normalizedTerm, originalTerm) {
    if (!normalizedTerm) return null;
    const abbreviationSegments = normalizedTerm.split('-');
    const isDottedAbbreviation =
        abbreviationSegments.length > 1 &&
        abbreviationSegments.some(segment => segment.length === 1) &&
        abbreviationSegments.every(segment => /^[a-z0-9]{1,3}$/i.test(segment));
    let pattern;
    if (isDottedAbbreviation) {
        pattern = abbreviationSegments
            .map(segment => `${segment}\\.?`)
            .join('[\\s,;:\\-]*');
    } else {
        pattern = normalizedTerm;
        pattern = pattern.split('ae').join('(?:ae|ä)');
        pattern = pattern.split('oe').join('(?:oe|ö)');
        pattern = pattern.split('ue').join('(?:ue|ü)');
        pattern = pattern.split('ss').join('(?:ss|ß)');
        pattern = pattern.split('-').join('[\\s\\-]?');
    }

    const originalPattern = generateOriginalTermPattern(originalTerm);
    return originalPattern ? `(?:${originalPattern}|${pattern})` : pattern;
}

/**
 * テキスト内の辞書用語をリンクに変換する
 * @param {string} text - 変換対象のテキスト
 * @param {Object} termsIndex - 用語インデックス（正規化キー → ID）
 * @return {string} リンク付きHTML
 */
function linkTermsInTranslation(text, termsIndex, notationRow) {
    if (notationRow && typeof window.renderMusicNotationDirection === 'function') {
        return window.renderMusicNotationDirection(text, termsIndex, notationRow, (part, index) => linkTermsInTranslation(part, index));
    }
    if (!text || !termsIndex || Object.keys(termsIndex).length === 0) {
        return escapeHtmlWithBreaks(text);
    }
    
    let escaped = escapeHtml(text);
    const terms = Object.keys(termsIndex).sort((a, b) => b.length - a.length);
    const placeholders = [];
    
    terms.forEach((term) => {
        const termEntry = termsIndex[term];
        const termId = typeof termEntry === 'string' ? termEntry : termEntry && termEntry.id;
        const originalTerm = typeof termEntry === 'object' && termEntry
            ? String(termEntry.original || '')
            : '';
        if (Math.max(term.length, originalTerm.length) < 3 || !termId) return;
        const termPattern = generateTermPattern(term, originalTerm);
        if (!termPattern) return;
        
        try {
            const regex = new RegExp(`(?<![a-zA-Z0-9äöüßÄÖÜ])(${termPattern})(?![a-zA-Z0-9äöüßÄÖÜ])`, 'gi');
            escaped = escaped.replace(regex, (match) => {
                const placeholder = `__PLACEHOLDER_${placeholders.length}__`;
                placeholders.push({
                    placeholder: placeholder,
                    content: `<a href="dic.html#${termId}" class="term-link">${match}</a>`
                });
                return placeholder;
            });
        } catch (e) {
            // Ignore invalid regex
        }
    });
    
    placeholders.forEach(p => {
        escaped = escaped.replace(p.placeholder, p.content);
    });
    
    return escaped.replace(/\n/g, '<br>');
}

// Expose for use in other scripts (e.g., index.html)
window.linkTermsInTranslation = linkTermsInTranslation;

// Link only plain-text web URLs; all source HTML remains escaped.
function formatSourceTextWithLinks(text) {
    if (!text) return '';
    const source = String(text);
    const tokens = /<a\b[^>]*>[\s\S]*?<\/a\s*>|<[^>]*>|https?:\/\/[^\s<>"'\x00-\x1f\x7f「」『』【】（）]+/gi;
    let html = '', last = 0, match;
    while ((match = tokens.exec(source))) {
        html += escapeHtmlWithBreaks(source.slice(last, match.index));
        const token = match[0];
        let url = token;
        // Sentence punctuation and unmatched closing brackets belong to the prose.
        while (url) {
            if (/[.,;:!?。、，．！？]$/.test(url)) { url = url.slice(0, -1); continue; }
            const close = url.slice(-1), open = { ')': '(', ']': '[', '}': '{' }[close];
            if (open && url.split(close).length > url.split(open).length) { url = url.slice(0, -1); continue; }
            break;
        }
        let valid = false;
        if (/^https?:\/\//i.test(url) && !/[\w/:]/.test(source[match.index - 1] || ' ') &&
            !/[\\\x00-\x20\x7f]/.test(url) && !/%(?![0-9a-f]{2})/i.test(url)) {
            try {
                const parsed = new URL(url);
                valid = ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname) &&
                    !parsed.username && !parsed.password;
            } catch (_) { /* Invalid URLs stay visible as escaped text. */ }
        }
        html += valid
            ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>${escapeHtmlWithBreaks(token.slice(url.length))}`
            : escapeHtmlWithBreaks(token);
        last = tokens.lastIndex;
    }
    return html + escapeHtmlWithBreaks(source.slice(last));
}

function formatGmTranslation(text, row) {
    return typeof window.renderMusicNotationDirection === 'function'
        ? window.renderMusicNotationDirection(text, {}, row, formatSourceTextWithLinks)
        : formatSourceTextWithLinks(text);
}
window.formatGmTranslation = formatGmTranslation;
window.formatNotationTranslation = formatGmTranslation;

function formatGenericResults(data) {
    if (data.length === 0) {
        return '<div class="result-message">該当するデータが見つかりませんでした。</div>';
    }

    // Sort by Aufzug, Szene, then page
    // Sort by Aufzug, Szene, then page
    data.sort((a, b) => {
        const getAufzugOrder = (val) => {
            if (val === undefined || val === null || val === '') return 0;
            const num = Number(val);
            if (!isNaN(num)) return num;

            // Handle special text values in Aufzug
            const str = String(val).toLowerCase().trim();
            // Start keywords (should be at the top)
            if (['einleitung', 'vorspiel', 'prolog', 'ouverture', 'overture'].includes(str)) return 0;

            // Other text (e.g. "Anhang", "I zu Seite 28") -> Push to end
            return 99999;
        };

        const aufzugA = getAufzugOrder(a.Aufzug);
        const aufzugB = getAufzugOrder(b.Aufzug);
        if (aufzugA !== aufzugB) return aufzugA - aufzugB;

        const getSzeneOrder = (val) => {
            if (typeof val === 'string' && val.toLowerCase() === 'finale') return 9999;
            return Number(val) || 0;
        };

        const szeneA = getSzeneOrder(a.Szene);
        const szeneB = getSzeneOrder(b.Szene);
        if (szeneA !== szeneB) return szeneA - szeneB;

        const pageA = Number(a.page) || 0;
        const pageB = Number(b.page) || 0;
        return pageA - pageB;
    });

    let html = '';

    if (data[0] && data[0].hasOwnProperty('楽譜情報') && data[0]['楽譜情報']) {
        const operKey = normalizeString(data[0].Oper || "");
        const meta = (typeof SCORE_METADATA !== 'undefined') ? (SCORE_METADATA[operKey] || SCORE_METADATA[data[0].Oper]) : null;
        
        if (meta) {
            html += `<div class="score-info-banner" style="text-align: left; padding: 12px; font-size: 0.85em; line-height: 1.6;">`;
            html += `<div style="font-weight: bold; border-bottom: 1px solid #ccc; margin-bottom: 8px; padding-bottom: 4px;">楽譜情報 (Score Information)</div>`;
            html += `<div><strong>Publisher:</strong> ${escapeHtml(meta.publisher)}</div>`;
            html += `<div><strong>Plate No.:</strong> ${escapeHtml(meta.plate)}</div>`;
            if (meta.edition) {
                html += `<div style="margin-top: 4px; font-style: italic; color: #555;">${escapeHtml(meta.edition)}</div>`;
            }
            if (meta.imslp) {
                html += `<div style="margin-top: 8px;"><a href="${meta.imslp}" target="_blank" style="color: #0066cc; text-decoration: underline; font-weight: bold;">IMSLP Project Page ↗</a></div>`;
            }
            if (meta.synopsis) {
                html += `<div style="margin-top: 8px;"><a href="${meta.synopsis}" target="_blank" style="color: #0066cc; text-decoration: underline; font-weight: bold;">${window.__SITE_LANGUAGE__ === 'en' ? 'Synopsis ↗' : 'あらすじ ↗'}</a></div>`;
            }
            html += `</div>`;
        } else {
            html += `<div class="score-info-banner">楽譜情報: ${escapeHtml(data[0]['楽譜情報'])}</div>`;
        }
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
                html += `<h2 style="font-family: 'Lora', 'Meiryo', 'メイリオ', sans-serif; font-size: 1.1em; font-weight: bold; margin-top: 20px; margin-bottom: 10px; color: #333;">${sceneTitle}</h2><hr style="border-top: 1px solid #ccc; margin-bottom: 20px;">`;
            }
            
            prevAufzug = currentAufzug;
            prevSzene = currentSzene;
        }

        const pageDisplay = hasScorePage(row) ? `p.${row.page}` : '';
        const de = linkTermsInTranslation(row.de, window.appData.dic_terms_index, row);
        const ja = typeof window.formatNotationTranslation === 'function' ? window.formatNotationTranslation(row.ja,row) : escapeHtmlWithBreaks(row.ja);
        const whom = escapeHtml(String(row.whom ?? '').trim());

        html += `
            <div class="result-entry">
                <div class="result-page">${pageDisplay}</div>
                <div class="result-content">
                    <dt class="result-de">${de}</dt>
                    <dd class="result-ja-loc">
                        <span>${ja}</span>
                        ${whom ? `<span>【${whom}】</span>` : ''}
                    </dd>
                </div>
            </div>
        `;
    });

    return `<div>${data.length}件見つかりました。</div>${html}`;
}
