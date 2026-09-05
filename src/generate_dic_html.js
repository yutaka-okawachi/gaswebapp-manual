/**
 * dic.html 静的HTML生成スクリプト
 * スプレッドシートのデータから完全なHTMLファイルを生成
 * リンク機能付き版
 * Modified: 2026-01-22
 */

// --- リンク生成関数 ---

/**
 * 用語をID用の文字列に正規化する
 * @param {string} term - ドイツ語用語
 * @return {string} 正規化されたID文字列
 */
function normalizeForId(term) {
  if (!term) return '';
  let id = term.toLowerCase().trim();
  // ウムラウトの変換
  id = id.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  // 非英数字をハイフンに置換
  id = id.replace(/[^a-z0-9]+/g, '-');
  // 先頭・末尾のハイフンを削除
  id = id.replace(/^-+|-+$/g, '');
  return id;
}

/**
 * 用語インデックスを生成
 * @param {Array} dicData - 用語データ [[german, translation, source], ...]
 * @return {Object} 用語インデックス（正規化キー → ID）
 */
function generateDicTermsIndex(dicData) {
  const termsIndex = {};
  if (!dicData || dicData.length === 0) return termsIndex;
  
  dicData.forEach(row => {
    const [german] = row;
    if (german && typeof german === 'string') {
      const normalizedId = normalizeForId(german);
      if (normalizedId && !termsIndex[normalizedId]) {
        const termId = `term-${normalizedId}`;
        termsIndex[normalizedId] = german.includes('.')
          ? { id: termId, original: german }
          : termId;
      }
    }
  });
  
  return termsIndex;
}

/**
 * 用語IDの重複を避けつつ、通常の用語IDを可能な限り維持する
 * @param {string} normalizedId - normalizeForId() が返したID本体
 * @param {Set} usedIds - すでに使用した完全な用語ID
 * @param {Set} reservedIds - 辞書内の見出し語が本来使用する用語ID
 * @return {string} term- から始まる一意な用語ID
 */
function allocateUniqueTermId(normalizedId, usedIds, reservedIds) {
  if (!normalizedId) return '';

  const baseId = `term-${normalizedId}`;
  if (!usedIds.has(baseId)) {
    usedIds.add(baseId);
    return baseId;
  }

  let suffix = 2;
  let candidateId = `${baseId}-${suffix}`;
  while (usedIds.has(candidateId) || reservedIds.has(candidateId)) {
    suffix += 1;
    candidateId = `${baseId}-${suffix}`;
  }

  usedIds.add(candidateId);
  return candidateId;
}

/**
 * 略記の照合用キーを生成する
 * @param {string} abbreviation - [GM] などの略記
 * @return {string} 照合用キー
 */
function normalizeAbbreviation(abbreviation) {
  if (!abbreviation) return '';
  return String(abbreviation)
    .trim()
    .replace(/\[\s+/g, '[')
    .replace(/\s+\]/g, ']')
    .replace(/\s+/g, ' ');
}

/**
 * 略記のページ内リンクIDを生成する
 * @param {string} abbreviation - [GM] などの略記
 * @return {string} ページ内リンクID
 */
function generateAbbreviationId(abbreviation) {
  const normalized = normalizeAbbreviation(abbreviation);
  if (!/^\[[^\]]+\]$/.test(normalized)) return '';
  const idBody = normalizeForId(normalized.slice(1, -1));
  return idBody ? `abbr-${idBody}` : '';
}

/**
 * 略記一覧からリンク先インデックスを生成する
 * @param {Array} abbrData - 略記データ [[colA, colB, colC], ...]
 * @return {Object} 略記キーからリンク先IDへの対応
 */
function generateAbbreviationIndex(abbrData) {
  const index = {};
  if (!abbrData || abbrData.length === 0) return index;

  abbrData.forEach(row => {
    const [colA, colB] = row;
    const candidates = [];

    if (colA && !isNaN(parseInt(colA))) {
      const matches = String(colB || '').match(/\[[^\]]+\]/g) || [];
      matches.forEach(match => candidates.push(match));
    } else if (colB) {
      candidates.push(colB);
    }

    candidates.forEach(candidate => {
      const normalized = normalizeAbbreviation(candidate);
      const targetId = generateAbbreviationId(normalized);
      if (targetId && !index[normalized.toLowerCase()]) {
        index[normalized.toLowerCase()] = targetId;
      }
    });
  });

  return index;
}

/**
 * 見出し語直下の出典略記を略記一覧へのリンクに変換する
 * @param {string} source - 出典欄
 * @param {Object} abbreviationIndex - 略記インデックス
 * @param {string} termId - 戻り先となる用語ID
 * @return {string} リンク付きHTML
 */
function linkAbbreviationsInSource(source, abbreviationIndex, termId) {
  if (!source) return '';

  const text = String(source);
  const regex = /\[[^\]]+\]/g;
  let html = '';
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    html += escapeHtml(text.slice(lastIndex, match.index));

    const displayText = match[0];
    const normalized = normalizeAbbreviation(displayText);
    const targetId = abbreviationIndex && abbreviationIndex[normalized.toLowerCase()];

    if (targetId) {
      html += `<a href="#${targetId}" class="abbr-link" data-return-target="${escapeHtml(termId)}">${escapeHtml(displayText)}</a>`;
    } else {
      html += escapeHtml(displayText);
    }

    lastIndex = regex.lastIndex;
  }

  html += escapeHtml(text.slice(lastIndex));
  return html;
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
function linkTermsInTranslation(text, termsIndex) {
  if (!text || !termsIndex || Object.keys(termsIndex).length === 0) {
    return escapeHtmlWithBreaks(text);
  }
  
  let escaped = escapeHtml(text);
  const terms = Object.keys(termsIndex).sort((a, b) => b.length - a.length);
  const placeholders = [];
  
  terms.forEach((term) => {
    const termEntry = termsIndex[term];
    const termId = typeof termEntry === 'string' ? termEntry : termEntry && termEntry.id;
    const originalTerm = typeof termEntry === 'object' && termEntry ? termEntry.original : '';
    if (Math.max(term.length, originalTerm.length) < 3 || !termId) return;
    const termPattern = generateTermPattern(term, originalTerm);
    if (!termPattern) return;
    
    try {
      const regex = new RegExp(`(?<![a-zA-Z0-9äöüßÄÖÜ])(${termPattern})(?![a-zA-Z0-9äöüßÄÖÜ])`, 'gi');
      escaped = escaped.replace(regex, (match) => {
        const placeholder = `__PLACEHOLDER_${placeholders.length}__`;
        placeholders.push({
          placeholder: placeholder,
          content: `<a href="#${termId}" class="term-link">${match}</a>`
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

/**
 * HTMLエスケープ関数
 * @param {string} text - エスケープする文字列
 * @return {string} エスケープされた文字列
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 改行を<br>タグに変換（HTMLエスケープ済み）
 * @param {string} text - 変換する文字列
 * @return {string} 変換された文字列
 */
function escapeHtmlWithBreaks(text) {
  if (!text) return '';
  return escapeHtml(text).replace(/\n/g, '<br>');
}

/**
 * ドイツ語文字列から最初の文字を取得（ソート用）
 * app.jsのgetSortLetter関数と同じロジック
 * @param {string} str - ドイツ語文字列
 * @return {string} ソート用の文字（A-Z または OTHER）
 */
function getSortLetter(str) {
  if (!str || typeof str !== 'string') return 'OTHER';
  
  // 先頭の空白を除去
  const trimmed = str.trim();
  if (!trimmed) return 'OTHER';
  
  // 最初の文字を大文字に変換
  let firstChar = trimmed.charAt(0).toUpperCase();
  
  // ウムラウト等の変換
  const umlautMap = {
    'Ä': 'A', 'Ö': 'O', 'Ü': 'U', 'ẞ': 'S'
  };
  
  if (umlautMap[firstChar]) {
    firstChar = umlautMap[firstChar];
  }
  
  // A-Zの範囲内か確認
  if (firstChar >= 'A' && firstChar <= 'Z') {
    return firstChar;
  }
  
  return 'OTHER';
}

/**
 * 用語データをソート
 * @param {Array} data - ソートするデータ配列 [[german, translation, source], ...]
 * @return {Array} ソート済みデータ
 */
function sortDicData(data) {
  return data.sort((a, b) => {
    const letterA = getSortLetter(a[0]);
    const letterB = getSortLetter(b[0]);
    
    // OTHER（数字・記号）を末尾に配置するための重み付け
    if (letterA === 'OTHER' && letterB !== 'OTHER') return 1;
    if (letterA !== 'OTHER' && letterB === 'OTHER') return -1;
    
    const strA = String(a[0] || '').toLowerCase();
    const strB = String(b[0] || '').toLowerCase();
    
    // 同一グループ内（または共にA-Z内）でのドイツ語特殊文字を考慮したソート
    return strA.localeCompare(strB, 'de');
  });
}

/**
 * 用語リストのHTMLを生成（リンク機能付き）
 * @param {Array} dicData - 用語データ [[german, translation, source], ...]
 * @param {Object} termsIndex - 用語インデックス（正規化キー → ID）
 * @return {string} 生成されたHTML
 */
function generateDicListHtml(dicData, termsIndex, abbreviationIndex, dictionaryExampleIndex) {
  if (!dicData || dicData.length === 0) {
    return '<div class="result-message">データが存在しません。</div>';
  }
  
  // データをソート
  const sortedData = sortDicData(dicData);
  const reservedTermIds = new Set(
    sortedData
      .map(row => normalizeForId(row && row[0]))
      .filter(Boolean)
      .map(normalizedId => `term-${normalizedId}`)
  );
  const usedTermIds = new Set();
  
  let html = '';
  let prevLetter = null;
  
  sortedData.forEach((row, index) => {
    const [german, translation, source] = row;
    
    if (!german && !translation) return; // 空行をスキップ
    
    const currentLetter = getSortLetter(german);
    
    // 最初の出現時に、その文字で始まる最初の単語へアンカーを付ける
    let letterAnchorAttr = '';
    if (currentLetter !== prevLetter && (currentLetter === 'OTHER' || (currentLetter >= 'A' && currentLetter <= 'Z'))) {
      letterAnchorAttr = ` id="letter-${currentLetter}"`;
      prevLetter = currentLetter;
    }
    
    // Individual Term ID (Always use id for native browser scrolling)
    const normalizedTermId = german ? normalizeForId(german) : '';
    const termId = allocateUniqueTermId(normalizedTermId, usedTermIds, reservedTermIds);
    const termIdAttr = termId ? ` id="${termId}"` : '';
    
    // translationにリンクを適用
    const linkedTranslation = termsIndex ? linkTermsInTranslation(translation, termsIndex) : escapeHtmlWithBreaks(translation);
    
    // 略記から対象作曲家を判定し、実例リンクを生成
    const hasGM = source && source.includes('[GM]');
    const hasRW = source && source.includes('[RW: Oper]');
    const hasRS = source && source.includes('[RS: Oper]');
    const hasExample = hasGM || hasRW || hasRS;

    let toggleArea = '';

    if (hasExample) {
      const queryParam = encodeURIComponent(german);
      const links = [];
      const createExampleHref = (pageName, composer) => {
        const hasExampleIndex = dictionaryExampleIndex &&
          dictionaryExampleIndex[composer] &&
          typeof getDictionaryExampleShardIds === 'function';
        const shardIds = typeof getDictionaryExampleShardIds === 'function'
          ? getDictionaryExampleShardIds(dictionaryExampleIndex, composer, german)
          : [];
        if (hasExampleIndex && shardIds.length === 0) return '';
        const shardParam = shardIds.length > 0
          ? `&example_shards=${shardIds.join(',')}`
          : '';
        return `${pageName}?q=${queryParam}&source=dictionary_example${shardParam}`;
      };
      if (hasRW) {
        const href = createExampleHref('rw_terms_search.html', 'rw');
        if (href) links.push(`<a href="${href}" class="composer-link" target="_self">Wagner</a>`);
      }
      if (hasGM) {
        const href = createExampleHref('terms_search.html', 'gm');
        if (href) links.push(`<a href="${href}" class="composer-link" target="_self">Mahler</a>`);
      }
      if (hasRS) {
        const href = createExampleHref('rs_terms_search.html', 'rs');
        if (href) links.push(`<a href="${href}" class="composer-link" target="_self">R.Strauss</a>`);
      }
      if (links.length > 0) {
        const linksHtml = links.join(' ');
        toggleArea = `\n      <div class="example-wrapper"><span class="example-label">実例を見る▶</span><span class="example-content">${linksHtml}</span></div>`;
      }
    }

    // rowのHTML生成（セマンティックHTMLで辞書構造を明示）
    html += `<div class="row"${termIdAttr}>
  <dt${letterAnchorAttr}>
    <div class="dt-main">
      <dfn class="german">${escapeHtml(german)}</dfn>
    </div>
    <div class="dt-details">
      ${toggleArea}
      ${source ? `<span class="source">${linkAbbreviationsInSource(source, abbreviationIndex, termId)}</span>` : ''}
    </div>
  </dt>
  <dd class="translation">${linkedTranslation}</dd>
</div>\n`;
  });
  
  return html;
}

/**
 * 略記一覧のHTMLを生成
 * @param {Array} abbrData - 略記データ [[colA, colB, colC], ...]
 * @return {string} 生成されたHTML
 */
function generateAbbrListHtml(abbrData) {
  if (!abbrData || abbrData.length === 0) {
    return '<p>（略記一覧のデータが存在しませんでした）</p>';
  }
  
  let html = '';
  let activeAbbreviationId = '';
  
  abbrData.forEach(row => {
    const [colA, colB, colC] = row;
    
    // colAが数字の場合はタイトル
    if (colA && !isNaN(parseInt(colA))) {
      activeAbbreviationId = '';
      const titleMatch = String(colB || '').match(/\[[^\]]+\]/);
      const titleId = titleMatch ? generateAbbreviationId(titleMatch[0]) : '';
      const titleAttrs = titleId ? ` id="${titleId}" data-abbr-id="${titleId}" tabindex="-1"` : '';
      html += `<div class="abbr-title"${titleAttrs}>${escapeHtml(colB)}</div>\n`;
    } else if (colB || colC) {
      // 通常の略記エントリー
      const normalizedAbbreviation = normalizeAbbreviation(colB);
      const newAbbreviationId = generateAbbreviationId(normalizedAbbreviation);
      const isGroupStart = Boolean(newAbbreviationId);

      if (colB) {
        activeAbbreviationId = newAbbreviationId;
      }

      const groupAttrs = activeAbbreviationId
        ? `${isGroupStart ? ` id="${activeAbbreviationId}" tabindex="-1"` : ''} data-abbr-id="${activeAbbreviationId}"`
        : '';

      html += `<div class="abbr-row"${groupAttrs}>
  <span class="abbr-short">${escapeHtml(colB)}</span><span class="abbr-long">${escapeHtml(colC)}</span>
</div>\n`;
    }
  });
  
  return html;
}

/**
 * 完全なdic.htmlを生成（リンク機能付き）
 * @param {Array} dicData - 用語データ
 * @param {Array} abbrData - 略記データ
 * @return {string} 完全なHTMLファイルの内容
 */
function generateDicHtml(dicData, abbrData, dictionaryExampleIndex) {
  // 用語インデックスを生成
  const termsIndex = generateDicTermsIndex(dicData);
  const abbreviationIndex = generateAbbreviationIndex(abbrData);
  
  const dicListHtml = generateDicListHtml(dicData, termsIndex, abbreviationIndex, dictionaryExampleIndex);
  const abbrListHtml = generateAbbrListHtml(abbrData);

  // 構造化データの生成 (SEO対策)
  const definedTerms = (dicData || [])
    .filter(row => row[0]) // 有効な行のみ
    .map(row => {
      // 翻訳文からHTMLタグを除去してプレーンテキストにする
      const plainTranslation = String(row[1] || '').replace(/<[^>]*>?/gm, '').trim();
      return {
        "@type": "DefinedTerm",
        "termCode": normalizeForId(row[0]),
        "name": String(row[0]).trim(),
        "description": plainTranslation || "ドイツ語の音楽用語"
      };
    });

  const structuredDataObj = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "name": "ドイツ語の音楽用語集",
    "url": "https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/dic.html",
    "description": "Wagner・Mahler・Strauss・Bruckner・Hindemith などのスコアに使われたドイツ語音楽用語と、その日本語訳を収録した専門辞書．",
    "inLanguage": "de",
    "isPartOf": {
      "@type": "WebSite",
      "url": "https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/"
    },
    "hasDefinedTerm": definedTerms
  };
  
  // JSON-LDを整形して文字列化
  const structuredDataJSON = JSON.stringify(structuredDataObj, null, 2);
  
  // パンくずリストの生成
  const breadcrumbObj = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "HOME",
        "item": "https://yutaka-okawachi.github.io/gaswebapp-manual/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "ドイツ語の音楽用語集",
        "item": "https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/dic.html"
      }
    ]
  };
  const breadcrumbJSON = JSON.stringify(breadcrumbObj, null, 2);

    const html = `<!DOCTYPE html>
<html>

<head>
    <!-- Google Search Console Verification -->
    <meta name="google-site-verification" content="oMTfhSgc1nOrF9dVnBCR_YGcwCDYlrqNmyYn-UJuBJc" />
    
    <!-- Google tag (gtag.js) -->
<script src="js/analytics.js?v=${typeof PUBLIC_ASSET_VERSIONS === 'object' ? PUBLIC_ASSET_VERSIONS['js/analytics.js'] : '1'}"></script>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZT6MPW5MNG"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'G-ZT6MPW5MNG');
    </script>
    <meta charset="UTF-8">
    <link rel="canonical" href="https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/dic.html">
    <script type="application/ld+json">
${structuredDataJSON}
    </script>
    <script type="application/ld+json">
${breadcrumbJSON}
    </script>
    <meta property="og:type" content="website">
    <meta property="og:title" content="ドイツ語の音楽用語集 | German Music Terms Dictionary">
    <meta property="og:description" content="ワーグナー，マーラー，R.シュトラウス，ブルックナー等の作品に登場するドイツ語音楽用語を900語以上収録．専門的な訳例や詳細な解釈をまとめた，楽譜の指示を正確に理解するための網羅的な用語集・辞書一覧．">
    <meta property="og:url" content="https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/dic.html">
    <meta property="og:image" content="https://yutaka-okawachi.github.io/gaswebapp-manual/ogp.png">
    <meta name="twitter:card" content="summary">
    <title>ドイツ語の音楽用語集</title>
    <link rel="icon" href="https://yutaka-okawachi.github.io/gaswebapp-manual/favicon.png">
    <link rel="apple-touch-icon" href="https://yutaka-okawachi.github.io/gaswebapp-manual/apple-touch-icon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="ワーグナー，マーラー，R.シュトラウス，ブルックナー等の作品に登場するドイツ語音楽用語を900語以上収録．専門的な訳例や詳細な解釈をまとめた，楽譜の指示を正確に理解するための網羅的な用語集・辞書一覧．">
    
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Lora:wght@400;700&display=swap">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:wght@400;700&display=swap" media="print" onload="this.media='all'">
    <noscript>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:wght@400;700&display=swap">
    </noscript>

    <link rel="preload" href="css/common.css" as="style">
    <link rel="stylesheet" href="css/common.css">

    <style>
        /* dic.html specific styles */
        .container {
            margin-bottom: 80px;
        }

        #listContainer {
            background-color: var(--results-bg);
            padding: 1.5rem;
            border-radius: 8px;
        }

        .abbr-title {
            font-size: 1.0rem;
            font-weight: bold;
            color: #000;
            background-color: #ffe6d1;
            padding: 8px;
            margin-bottom: 0.5em;
            border-radius: 5px;
            font-family: 'Lora', serif;
        }

        .abbr-row {
            display: flex;
            flex-direction: row;
            align-items: flex-start;
            margin-bottom: 0.5em;
        }

        .abbr-short {
            flex: 0 0 20%;
            font-weight: bold;
            font-family: 'Lora', serif;
            font-size: 0.9rem;
        }

        .abbr-long {
            flex: 1;
            margin-left: 1em;
            font-family: 'Lora', serif;
            font-size: 0.8rem;
        }

        .abbr-link {
            color: #0b57d0;
            font-weight: 700;
            text-decoration: underline;
            text-decoration-thickness: 1px;
            text-underline-offset: 2px;
        }

        .abbr-link:hover,
        .abbr-link:focus-visible {
            color: #b3261e;
            text-decoration-thickness: 2px;
        }

        .abbr-title[data-abbr-id],
        .abbr-row[data-abbr-id] {
            scroll-margin-top: 16px;
        }

        .abbr-title.abbr-target-active,
        .abbr-row.abbr-target-active {
            background-color: #fff4b8;
            box-shadow: inset 4px 0 0 #e37400;
            animation: abbrHighlightIn 0.45s ease-out;
        }

        .abbr-row.abbr-target-active {
            margin-left: -8px;
            margin-right: -8px;
            padding: 5px 8px;
            border-radius: 4px;
        }

        @keyframes abbrHighlightIn {
            from { background-color: #ffd54f; }
            to { background-color: #fff4b8; }
        }

        .abbr-return-panel {
            margin: 0.25rem 0 0.75rem;
            padding: 0.55rem 0.7rem;
            background: #fff;
            border: 1px solid #e37400;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
            scroll-margin-top: 16px;
        }

        .abbr-return-panel[hidden] {
            display: none;
        }

        .abbr-return-button {
            appearance: none;
            padding: 0;
            border: 0;
            background: transparent;
            color: #0b57d0;
            font: inherit;
            font-size: 0.88rem;
            font-weight: 700;
            text-align: left;
            cursor: pointer;
        }

        .abbr-return-button:hover,
        .abbr-return-button:focus-visible {
            color: #b3261e;
            text-decoration: underline;
        }

        .section-divider {
            border: 0;
            border-top: 2px dashed #999;
            margin: 2em 0;
        }

        #abbrListContainer {
            background-color: rgba(255, 242, 224, 0.5);
            padding: 1.5rem;
            border-radius: 8px;
            scroll-margin-top: 20px;
        }

        .row {
            border-bottom: 1px solid #ccc;
            padding-bottom: 10px;
            margin-bottom: 10px;
            transition: background-color 0.3s;
        }

        [id^="letter-"],
        .row[id^="term-"] {
            scroll-margin-top: 16px;
        }

        @media (max-width: 768px) {
            [id^="letter-"],
            .row[id^="term-"] {
                scroll-margin-top: 58px;
            }

            .abbr-title[data-abbr-id],
            .abbr-row[data-abbr-id] {
                scroll-margin-top: 58px;
            }

            .abbr-return-panel {
                scroll-margin-top: 58px;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            .abbr-title.abbr-target-active,
            .abbr-row.abbr-target-active {
                animation: none;
            }
        }

        /*
         * 辞書は900項目を超えるため、項目内の表示切替による再レイアウトを
         * 画面外の全項目へ波及させない。Edgeで「実例を見る」を押した際の
         * 長いメインスレッド停止を防ぐ。
         */
        .row {
            content-visibility: auto;
            contain-intrinsic-size: auto 40px;
        }

        /* アコーディオン機能のスタイル */
        .row dt {
            cursor: pointer;
            user-select: none;
            padding: 4px 6px;
            border-radius: 4px;
            transition: background-color 0.2s ease;
            position: relative;
            width: 100%;
        }

        .row dt:hover {
            background-color: rgba(26, 115, 232, 0.08);
        }

        .row dt .dt-main {
            padding-left: 22px;
            position: relative;
        }

        /* アコーディオン開閉矢印 (▶ / ▼) */
        .row dt .dt-main::before {
            content: '▶';
            position: absolute;
            left: 4px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 0.7rem;
            color: #1a73e8;
            transition: transform 0.2s ease, color 0.2s ease;
        }

        .row.accordion-open dt .dt-main::before {
            transform: translateY(-50%) rotate(90deg);
            color: #d64d3d;
        }

        /* アコーディオン非表示時 (畳んだ状態) */
        .row dd.translation {
            display: none;
            font-size: 0.9rem;
            margin-top: 6px;
            margin-left: 1.2em;
            padding-left: 10px;
            border-left: 3px solid #1a73e8;
        }

        /* アコーディオン表示時 */
        .row.accordion-open dd.translation {
            display: block;
            animation: accordionSlideDown 0.2s ease-out;
        }

        @keyframes accordionSlideDown {
            from {
                opacity: 0;
                transform: translateY(-4px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        /* 一括操作ボタン */
        .accordion-controls {
            display: flex;
            gap: 12px;
            margin-top: 1rem;
            margin-bottom: 1.5rem;
            align-items: center;
        }

        .btn-accordion {
            background-color: #ffffff;
            border: 1.5px solid #1a73e8;
            color: #1a73e8;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .btn-accordion:hover {
            background-color: #1a73e8;
            color: #ffffff;
            box-shadow: 0 2px 6px rgba(26,115,232,0.25);
            transform: translateY(-1px);
        }

        /* Target Highlight Animation */
        .row.highlight-active {
            animation: highlightFade 2.5s ease-out !important;
        }

        @keyframes highlightFade {
            0% { background-color: #ffeb3b; }
            15% { background-color: #ffeb3b; }
            100% { background-color: transparent; }
        }

        .german {
            font-weight: bold;
            font-size: 1.0rem;
            display: block;
            font-family: 'Lora', serif;
        }

        .dt-main {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            width: 100%;
            flex-wrap: wrap;
            row-gap: 2px;
            column-gap: 10px;
        }

        .dt-details {
            display: none;
            margin-left: 22px;
            margin-top: 2px;
        }

        .row.accordion-open .dt-details {
            display: block;
        }

        .source {
            font-size: 0.8rem;
            color: #555;
            font-family: 'Lora', serif;
            display: block;
            margin-bottom: 2px;
        }

        .example-wrapper {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 2px;
            margin-bottom: 4px;
            font-size: 0.85rem;
        }

        .example-label {
            color: #1a73e8;
            font-size: 0.85rem;
            font-weight: 500;
            user-select: none;
        }

        .example-content {
            display: inline-flex;
            gap: 6px;
            font-size: 0.85rem;
            font-family: 'Lora', serif;
        }

        .composer-link {
            color: #c44536;
            text-decoration: underline;
            font-weight: bold;
        }

        .composer-link:hover {
            color: #d64d3d;
        }

        @media (max-width: 600px) {
            .abbr-row {
                display: block;
            }

            .abbr-short {
                display: block;
                width: 100%;
                margin-bottom: 5px;
            }

            .abbr-long {
                display: block;
                width: 100%;
                margin-left: 0;
            }
        }

        /* Info Notice Box */
        .info-notice {
            background-color: #f0f7ff;
            border-left: 4px solid #3b5275;
            padding: 1rem 1.5rem;
            margin-bottom: 2rem;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
        }

        .info-notice-content p {
            margin: 0;
            font-size: 0.9rem;
            color: #333;
            line-height: 1.5;
        }

        .info-notice-action {
            flex-shrink: 0;
        }

        .btn-notice {
            display: inline-block;
            background-color: #3b5275;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            text-decoration: none;
            font-size: 0.85rem;
            font-family: 'Lora', serif;
            transition: background 0.2s;
        }

        .btn-notice:hover {
            background-color: #1a2c42;
            color: white;
            text-decoration: none;
        }

        /* Floating Home Button */
        #floating-home-btn {
            position: fixed;
            left: 20px;
            bottom: 30px;
            z-index: 9999;
            background-color: #c44536; /* Accent Red */
            color: white;
            padding: 10px 20px;
            border-radius: 50px;
            text-decoration: none;
            font-weight: bold;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.2s ease;
            font-size: 0.9rem;
            opacity: 0;
            visibility: hidden;
            transform: translateY(20px);
        }

        #floating-home-btn.show {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }

        #floating-home-btn:hover {
            background-color: #d64d3d;
            transform: scale(1.05);
            color: #fff;
        }



        /* Sidebar Home Enhancement */
        .sidebar-home a {
            background: rgba(255,255,255,0.1);
            padding: 10px !important;
            border-radius: 6px;
            transition: background 0.2s;
        }

        .sidebar-home a:hover {
            background: rgba(255,255,255,0.2);
        }

        @media (max-width: 768px) {
            .info-notice {
                flex-direction: column;
                align-items: flex-start;
            }
            .info-notice-action {
                width: 100%;
                margin-top: 10px;
            }
            .btn-notice {
                display: block;
                text-align: center;
            }
            #floating-home-btn {
                bottom: 20px;
                left: 15px;
                padding: 8px 16px;
                font-size: 0.8rem;
            }
        }
    </style>

    <script>
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

        const dictionaryExamplePrefetches = new Set();

        function queueDictionaryExamplePrefetch(url) {
            if (!url || dictionaryExamplePrefetches.has(url)) return;
            dictionaryExamplePrefetches.add(url);

            const prefetch = document.createElement('link');
            prefetch.rel = 'prefetch';
            prefetch.href = url;
            document.head.appendChild(prefetch);
        }

        function prefetchDictionaryExampleLink(link) {
            const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
            if (connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType || ''))) {
                return;
            }

            let destination;
            try {
                destination = new URL(link.href, window.location.href);
            } catch (error) {
                return;
            }

            const shardValue = destination.searchParams.get('example_shards');
            if (!shardValue) return;

            const pageName = destination.pathname.split('/').pop();
            const composer = pageName === 'rw_terms_search.html'
                ? 'rw'
                : pageName === 'rs_terms_search.html'
                    ? 'rs'
                    : 'gm';

            queueDictionaryExamplePrefetch(destination.href);
            queueDictionaryExamplePrefetch(new URL('data/dic_terms_index.json', destination).href);
            shardValue.split(',').forEach(value => {
                const shardNumber = Number(value);
                if (!Number.isInteger(shardNumber) || shardNumber < 0 || shardNumber >= 16) return;
                const suffix = String(shardNumber).padStart(2, '0');
                queueDictionaryExamplePrefetch(
                    new URL('data/dictionary-examples/' + composer + '-' + suffix + '.json', destination).href
                );
            });
        }

        function prefetchDictionaryExamples(row) {
            if (!row) return;
            row.querySelectorAll('a.composer-link').forEach(prefetchDictionaryExampleLink);
        }

        // 一括開閉機能
        function openAllAccordions() {
            document.querySelectorAll('#listContainer .row').forEach(el => el.classList.add('accordion-open'));
        }

        function closeAllAccordions() {
            document.querySelectorAll('#listContainer .row').forEach(el => el.classList.remove('accordion-open'));
        }

        function clearAbbreviationHighlights() {
            document.querySelectorAll('.abbr-target-active').forEach(el => el.classList.remove('abbr-target-active'));
        }

        function getAbbreviationTargets(targetId) {
            return Array.from(document.querySelectorAll('[data-abbr-id]')).filter(function (element) {
                return element.getAttribute('data-abbr-id') === targetId;
            });
        }

        function hideAbbreviationReturnPanel() {
            const panel = document.getElementById('abbrReturnPanel');
            if (!panel) return;
            panel.hidden = true;
            panel.removeAttribute('data-return-target');
        }

        function showAbbreviationReturnPanel(targetElement, returnInfo) {
            const panel = document.getElementById('abbrReturnPanel');
            const label = document.getElementById('abbrReturnLabel');
            if (!panel || !label || !returnInfo || !returnInfo.termId) {
                hideAbbreviationReturnPanel();
                return null;
            }

            panel.setAttribute('data-return-target', returnInfo.termId);
            label.textContent = returnInfo.termLabel
                ? '「' + returnInfo.termLabel + '」に戻る'
                : '元の見出し語に戻る';
            targetElement.parentNode.insertBefore(panel, targetElement);
            panel.hidden = false;
            return panel;
        }

        function navigateToHash(targetId, state) {
            if (!targetId || !document.getElementById(targetId)) return;
            window.history.pushState(state || null, '', '#' + encodeURIComponent(targetId));
            handleHashChange();
        }

        // アコーディオン開閉 & ハッシュ変更ナビゲーション処理
        window.addEventListener('DOMContentLoaded', () => {
            const listContainer = document.getElementById('listContainer');
            if (listContainer) {
                listContainer.addEventListener('pointerover', (e) => {
                    const composerLink = e.target.closest('a.composer-link');
                    if (composerLink && listContainer.contains(composerLink)) {
                        prefetchDictionaryExampleLink(composerLink);
                    }
                });
                listContainer.addEventListener('focusin', (e) => {
                    const composerLink = e.target.closest('a.composer-link');
                    if (composerLink && listContainer.contains(composerLink)) {
                        prefetchDictionaryExampleLink(composerLink);
                    }
                });
                listContainer.addEventListener('click', (e) => {
                    const abbreviationLink = e.target.closest('a.abbr-link');
                    if (abbreviationLink && listContainer.contains(abbreviationLink)) {
                        e.preventDefault();
                        const sourceRow = abbreviationLink.closest('.row');
                        const sourceTerm = sourceRow ? sourceRow.querySelector('.german') : null;
                        const targetId = decodeURIComponent(abbreviationLink.getAttribute('href').slice(1));
                        const returnTarget = abbreviationLink.getAttribute('data-return-target') || (sourceRow && sourceRow.id);

                        navigateToHash(targetId, {
                            dictionaryReturn: {
                                termId: returnTarget,
                                termLabel: sourceTerm ? sourceTerm.textContent.trim() : ''
                            }
                        });
                        return;
                    }

                    // リンク自体のクリック時はアコーディオン開閉処理を行わない
                    if (e.target.closest('a')) {
                        return;
                    }
                    const dt = e.target.closest('dt');
                    if (dt) {
                        const row = dt.closest('.row');
                        if (row) {
                            const isOpening = !row.classList.contains('accordion-open');
                            row.classList.toggle('accordion-open');
                            if (isOpening) {
                                prefetchDictionaryExamples(row);
                            }
                        }
                    }
                });
            }

            const returnButton = document.getElementById('abbrReturnButton');
            if (returnButton) {
                returnButton.addEventListener('click', function () {
                    const panel = document.getElementById('abbrReturnPanel');
                    const returnTarget = panel && panel.getAttribute('data-return-target');
                    if (returnTarget) {
                        navigateToHash(returnTarget, null);
                    }
                });
            }

            handleHashChange();
        });

        window.addEventListener('hashchange', handleHashChange);

        let hashScrollSequence = 0;

        function getHashScrollOffset() {
            const navToggle = document.querySelector('.nav-toggle');
            if (navToggle && window.getComputedStyle(navToggle).display !== 'none') {
                return Math.ceil(navToggle.getBoundingClientRect().bottom + 12);
            }

            // タブレット・スマホでは右上の固定ボタンに隠れない位置にする
            return window.matchMedia('(max-width: 768px)').matches ? 58 : 16;
        }

        function alignHashTarget(targetElement) {
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - getHashScrollOffset();

            window.scrollTo({
                top: Math.max(0, offsetPosition),
                behavior: 'auto'
            });
        }

        function scrollToHashTarget(targetElement) {
            const sequence = ++hashScrollSequence;
            const realign = function () {
                if (sequence === hashScrollSequence && document.contains(targetElement)) {
                    alignHashTarget(targetElement);
                }
            };

            // content-visibility による長い一覧の再レイアウト後も同じ単語へ合わせ直す
            realign();
            window.requestAnimationFrame(function () {
                realign();
                window.requestAnimationFrame(realign);
            });
            window.setTimeout(realign, 150);
            window.setTimeout(realign, 500);
        }

        function handleHashChange() {
            const hash = window.location.hash;

            document.querySelectorAll('.row.highlight-active').forEach(el => el.classList.remove('highlight-active'));
            clearAbbreviationHighlights();

            if (!hash) {
                hideAbbreviationReturnPanel();
                return;
            }

            const targetId = decodeURIComponent(hash.substring(1));

            let targetElement = document.getElementById(targetId);

            if (!targetElement) {
                hideAbbreviationReturnPanel();
                return;
            }

            const isAbbreviationTarget = targetId.startsWith('abbr-');
            let scrollTargetElement = targetElement;

            // 単語直接指定ジャンプ（term-xxxx）の場合のみ親行のアコーディオンを開く
            if (!targetId.startsWith('letter-') && !isAbbreviationTarget) {
                const targetRow = targetElement.closest('.row') || (targetElement.classList.contains('row') ? targetElement : null);
                if (targetRow) {
                    targetRow.classList.add('accordion-open');
                }
            }

            if (isAbbreviationTarget) {
                const returnInfo = window.history.state && window.history.state.dictionaryReturn;
                const returnPanel = showAbbreviationReturnPanel(targetElement, returnInfo);
                if (returnPanel) {
                    scrollTargetElement = returnPanel;
                }
            } else {
                hideAbbreviationReturnPanel();
            }

            scrollToHashTarget(scrollTargetElement);

            if (isAbbreviationTarget) {
                const abbreviationTargets = getAbbreviationTargets(targetId);
                setTimeout(function () {
                    abbreviationTargets.forEach(function (element) {
                        element.classList.add('abbr-target-active');
                    });
                    targetElement.focus({ preventScroll: true });
                }, 50);
            } else {
                // Trigger term/letter animation
                const highlightElement = targetElement.closest('.row') || targetElement;
                highlightElement.classList.remove('highlight-active');
                void highlightElement.offsetWidth;

                setTimeout(() => {
                    highlightElement.classList.add('highlight-active');
                }, 50);
            }
        }

        // ページトップへスクロール
        function scrollToTop() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }

        // Optimized scroll event handler with debounce for buttons
        const handleScroll = debounce(() => {
            const topBtn = document.getElementById('scrollToTop');
            const homeBtn = document.getElementById('floating-home-btn');
            const scrollPos = window.scrollY;

            if (topBtn) {
                if (scrollPos > 300) {
                    topBtn.style.display = 'block';
                } else {
                    topBtn.style.display = 'none';
                }
            }

            if (homeBtn) {
                if (scrollPos > 500) {
                    homeBtn.classList.add('show');
                } else {
                    homeBtn.classList.remove('show');
                }
            }
        }, 100);

        window.addEventListener('scroll', handleScroll);

        function toggleNav() {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('active');
        }

        document.addEventListener('DOMContentLoaded', function () {
            const alphaBar = document.getElementById('alpha-floating-bar');
            if (!alphaBar) {
                return;
            }

            alphaBar.addEventListener('click', function (event) {
                const link = event.target.closest('a[href^="#letter-"]');
                if (!link || !alphaBar.contains(link)) {
                    return;
                }

                const targetId = link.getAttribute('href').slice(1);
                if (!/^letter-(?:[A-Z]|OTHER)$/.test(targetId)) {
                    return;
                }

                event.preventDefault();

                const letter = targetId.replace(/^letter-/, '');

                if (typeof window.gtag === 'function') {
                    window.gtag('event', 'dictionary_jump', {
                        letter: letter,
                        page_path: location.pathname
                    });
                }

                const nextHash = '#' + targetId;
                if (window.location.hash !== nextHash) {
                    window.history.pushState(null, '', nextHash);
                }
                handleHashChange();
            });
        });

        // サイドバー外をクリックしたら閉じる（スマホのみ）
        document.addEventListener('click', function (event) {
            if (window.innerWidth <= 768) {
                const sidebar = document.getElementById('sidebar');
                const toggle = document.querySelector('.nav-toggle');
                if (sidebar && toggle && !sidebar.contains(event.target) && !toggle.contains(event.target)) {
                    sidebar.classList.remove('active');
                }
            }
        });


    </script>
</head>

<body>
    <button class="nav-toggle" onclick="toggleNav()">☰ メニュー</button>

    <!-- サイドバーナビゲーション -->
    <nav class="sidebar" id="sidebar">
        <h3 class="sidebar-home"><a href="../index.html">🏠 HOME</a></h3>
        <h3>Richard Wagner (RW)</h3>
        <ul>
            <li><a href="richard_wagner.html">曲名から検索</a></li>
            <li><a href="rw_terms_search.html">用語から検索</a></li>
            <li><a href="rw_synopsis.html">あらすじ集</a></li>
        </ul>

        <h3>Gustav Mahler (GM)</h3>
        <ul>
            <li><a href="mahler.html">曲名と楽器等から検索</a></li>
            <li><a href="terms_search.html">用語から検索</a></li>
        </ul>

        <h3>Richard Strauss (RS)</h3>
        <ul>
            <li><a href="richard_strauss.html">曲名から検索</a></li>
            <li><a href="rs_terms_search.html">用語から検索</a></li>
            <li><a href="rs_synopsis.html">あらすじ集</a></li>
        </ul>

        <h3>用語集</h3>
        <ul>
            <li><a href="dic.html">ドイツ語の音楽用語集</a></li>
        </ul>


    </nav>

    <div class="page-wrapper">
        <div class="container">
            <nav class="breadcrumb" aria-label="パンくずリスト">
                <ol>
                    <li><a href="../index.html">HOME</a></li>
                    <li aria-current="page">ドイツ語の音楽用語集</li>
                </ol>
            </nav>
            <h1>ドイツ語の音楽用語集</h1>

            <p style="font-size: 0.85rem; color: #555; margin-top: 0.5em; margin-bottom: 1em;">
                このページは，Richard Wagner (RW)，Gustav Mahler (GM)，Richard Strauss (RS)，Anton Bruckner，Paul Hindemith などで使用されているドイツ語の訳例やコメント集（ほんの一部だけイタリア語，フランス語等を含む）．[GM]などの略記については「<a href="#abbrListContainer">略記一覧</a>」を参照のこと．ただし，”実例を見る”ではRichard Straussの場合，オペラのみに対応しているので注意．
            </p>

            <!-- Info Notice Section -->
            <div class="info-notice">
                <div class="info-notice-content">
                    <p>💡 <strong>より詳細な検索：</strong>作品名や楽器，ページ番号，指示対象などから直接検索したい場合はメイン検索へ．</p>
                </div>
                <div class="info-notice-action">
                    <a href="../index.html" class="btn-notice">🔍 メイン検索</a>
                </div>
            </div>

            <!-- Accordion Controls -->
            <div class="accordion-controls">
                <button type="button" class="btn-accordion" onclick="openAllAccordions()">📂 すべて開く</button>
                <button type="button" class="btn-accordion" onclick="closeAllAccordions()">📁 すべて閉じる</button>
            </div>

            <div id="listContainer">
${dicListHtml}
            </div>



            <hr class="section-divider">

            <div id="abbrListContainer">
                <div id="abbrReturnPanel" class="abbr-return-panel" hidden>
                    <button type="button" id="abbrReturnButton" class="abbr-return-button">← <span id="abbrReturnLabel">元の見出し語に戻る</span></button>
                </div>
                <div class="top-message" id="abbrMessage">(*)は特記すべきドイツ語はなし</div>
                <div id="abbrContent">
${abbrListHtml}
                </div>
            </div>
        </div>
    </div>

    <!-- Floating Alphabet Bar -->
    <div id="alpha-floating-bar">
        <a href="#abbrListContainer">略記一覧</a>
        <script>
            // アルファベットリンクを生成
            const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
            letters.forEach(l => {
                document.write(\`<a href="#letter-\${l}">\${l}</a>\`);
            });
            // 数字・記号のリンクを追加
            document.write(\`<a href="#letter-OTHER">数字・記号</a>\`);
        </script>
    </div>

    <div id="scrollToTop" onclick="scrollToTop()">▲ ページのトップへ戻る</div>
    <a href="../index.html" id="floating-home-btn">🏠 メイン検索へ</a>

    <script>
        // Dynamic Floating Bar Position Adjustment
        (function() {
            const alphaBar = document.getElementById('alpha-floating-bar');
            if (!alphaBar) return;

            let adjustTimer = null;

            function adjustFloatingBarPosition() {
                const visualViewport = window.visualViewport;
                const windowHeight = window.innerHeight;
                
                let bottomPosition = 40;
                let viewportHeight = windowHeight;
                let uiBarHeight = 0;
                
                if (visualViewport) {
                    viewportHeight = visualViewport.height;
                    uiBarHeight = windowHeight - viewportHeight;
                    bottomPosition = Math.max(uiBarHeight + 40, 40);
                    alphaBar.style.bottom = \`\${bottomPosition}px\`;
                } else {
                    alphaBar.style.bottom = '40px';
                }
            }
            
            function debouncedAdjust() {
                clearTimeout(adjustTimer);
                adjustTimer = setTimeout(adjustFloatingBarPosition, 100);
            }
            
            adjustFloatingBarPosition();
            
            window.addEventListener('scroll', debouncedAdjust, { passive: true });
            window.addEventListener('resize', debouncedAdjust, { passive: true });
            window.addEventListener('orientationchange', adjustFloatingBarPosition);
            
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', debouncedAdjust);
                window.visualViewport.addEventListener('scroll', debouncedAdjust);
            }
        })();
    </script>
</body>

</html>
<!-- Generated deterministically from the spreadsheet source. -->`;

  return html;

}

/**
 * テスト用関数：小規模なデータでHTML生成をテスト
 */
function testGenerateDicHtml() {
  // テストデータ
  const testDicData = [
    ['Wald', '森', 'GM1'],
    ['Baum', '木', 'GM2'],
    ['Ähre', '穂', 'GM3'],
    ['Zeit', '時間', 'GM4'],
    ['1. Satz', '第1楽章', 'GM5']
  ];
  
  const testAbbrData = [
    [1, 'オペラ', ''],
    ['', 'RS', 'Richard Strauss'],
    ['', 'RW', 'Richard Wagner'],
    [2, '楽曲', ''],
    ['', 'Symph.', 'Symphony（交響曲）']
  ];
  
  const html = generateDicHtml(testDicData, testAbbrData);
  
  Logger.log('=== テスト結果 ===');
  Logger.log('HTML長さ: ' + html.length + ' 文字');
  Logger.log('');
  Logger.log('含まれているか確認:');
  Logger.log('- <div class="row": ' + (html.includes('<div class="row"') ? '✓' : '✗'));
  Logger.log('- Wald: ' + (html.includes('Wald') ? '✓' : '✗'));
  Logger.log('- 森: ' + (html.includes('森') ? '✓' : '✗'));
  Logger.log('- id="letter-W": ' + (html.includes('id="letter-W"') ? '✓' : '✗'));
  Logger.log('- id="letter-A": ' + (html.includes('id="letter-A"') ? '✓' : '✗'));
  Logger.log('- id="letter-OTHER": ' + (html.includes('id="letter-OTHER"') ? '✓' : '✗'));
  Logger.log('- abbr-title: ' + (html.includes('abbr-title') ? '✓' : '✗'));
  Logger.log('- Richard Strauss: ' + (html.includes('Richard Strauss') ? '✓' : '✗'));
  
  Logger.log('');
  Logger.log('生成されたHTMLの最初の1000文字:');
  Logger.log(html.substring(0, 1000));
  
  return html;
}

/**
 * 実データでHTML生成（ログ出力用）
 * スプレッドシートから実際のデータを読み込んでHTMLを生成
 * 生成されたHTMLをログに出力してコピー可能にする
 */
function generateDicHtmlFromSpreadsheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Notesシートから用語データを取得
  const dicNotesSheet = ss.getSheetByName('Notes');
  let dicNotesData = [];
  if (dicNotesSheet) {
    const data = dicNotesSheet.getDataRange().getValues();
    // ヘッダー行をスキップして、A, B, C列のみ取得
    dicNotesData = data.slice(1).map(row => [row[0], row[1], row[2]]);
  }
  
  // 略記一覧シートからデータを取得
  const abbrSheet = ss.getSheetByName('略記一覧');
  let abbrData = [];
  if (abbrSheet) {
    const data = abbrSheet.getDataRange().getValues();
    // ヘッダー行をスキップして、A, B, C列のみ取得
    abbrData = data.slice(1).map(row => [row[0], row[1], row[2]]);
  }
  
  Logger.log('=== スプレッドシートからデータ取得 ===');
  Logger.log('用語データ: ' + dicNotesData.length + ' 行');
  Logger.log('略記データ: ' + abbrData.length + ' 行');
  Logger.log('');
  
  // HTML生成
  const html = generateDicHtml(dicNotesData, abbrData);
  
  Logger.log('=== HTML生成完了 ===');
  Logger.log('HTML長さ: ' + html.length + ' 文字 (' + Math.round(html.length / 1024) + ' KB)');
  Logger.log('');
  Logger.log('このHTMLを以下からコピーして、ローカルファイル "dic_generated.html" として保存してください:');
  Logger.log('==================================================');
  Logger.log(html);
  Logger.log('==================================================');
  
  return html;
}
