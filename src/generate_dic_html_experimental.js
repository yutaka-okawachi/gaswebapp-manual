/**
 * dic_experimental.html 静的HTML生成スクリプト（実験版）
 * 
 * generate_dic_html.js をベースに、用語集リンク機能のための
 * 個別用語IDを追加した実験版
 * 
 * 主な変更点：
 * - 各用語に一意のIDを付与（id="term-単語"）
 * - 生成されるファイル名は dic_experimental.html
 * - 本番用関数（generateDicHtml）には影響を与えない
 */

/**
 * HTMLエスケープ関数
 * @param {string} text - エスケープする文字列
 * @return {string} エスケープされた文字列
 */
function escapeHtmlExp(text) {
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
function escapeHtmlWithBreaksExp(text) {
  if (!text) return '';
  return escapeHtmlExp(text).replace(/\n/g, '<br>');
}

/**
 * ドイツ語文字列から最初の文字を取得（ソート用）
 * @param {string} str - ドイツ語文字列
 * @return {string} ソート用の文字（A-Z または OTHER）
 */
function getSortLetterExp(str) {
  if (!str || typeof str !== 'string') return 'OTHER';
  
  const trimmed = str.trim();
  if (!trimmed) return 'OTHER';
  
  let firstChar = trimmed.charAt(0).toUpperCase();
  
  const umlautMap = {
    'Ä': 'A', 'Ö': 'O', 'Ü': 'U', 'ẞ': 'S'
  };
  
  if (umlautMap[firstChar]) {
    firstChar = umlautMap[firstChar];
  }
  
  if (firstChar >= 'A' && firstChar <= 'Z') {
    return firstChar;
  }
  
  return 'OTHER';
}

/**
 * ドイツ語文字列をID用に正規化
 * ウムラウトを変換し、URLで使用できる形式にする
 * @param {string} str - ドイツ語文字列
 * @return {string} ID用に正規化された文字列
 */
function normalizeForId(str) {
  if (!str || typeof str !== 'string') return '';
  
  // ウムラウトと特殊文字を変換（dic_linking.js と統一）
  let normalized = str.toLowerCase();
  
  const umlautMap = {
    'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss'
  };
  
  Object.keys(umlautMap).forEach(key => {
    normalized = normalized.replace(new RegExp(key, 'g'), umlautMap[key]);
  });
  
  // スペースをハイフンに置換（URLハッシュ対応）
  normalized = normalized.replace(/\s+/g, '-');
  
  // 英数字とハイフンのみ残し、他を削除
  normalized = normalized.replace(/[^a-z0-9\-]/g, '');
  
  // 連続するハイフンを1つに
  normalized = normalized.replace(/-+/g, '-');
  
  return normalized.trim().replace(/^-+|-+$/g, '');
}

/**
 * 用語データをソート
 * @param {Array} data - ソートするデータ配列
 * @return {Array} ソート済みデータ
 */
function sortDicDataExp(data) {
  return data.sort((a, b) => {
    const strA = String(a[0] || '').toLowerCase();
    const strB = String(b[0] || '').toLowerCase();
    return strA.localeCompare(strB, 'de');
  });
}

/**
 * 用語リストのHTMLを生成（実験版：個別IDを付与）
 * @param {Array} dicData - 用語データ [[german, translation, source], ...]
 * @return {string} 生成されたHTML
 */
function generateDicListHtmlExp(dicData) {
  if (!dicData || dicData.length === 0) {
    return '<div class="result-message">データが存在しません。</div>';
  }
  
  const sortedData = sortDicDataExp(dicData);
  
  let html = '';
  let prevLetter = null;
  
  sortedData.forEach((row, index) => {
    const [german, translation, source] = row;
    
    if (!german && !translation) return;
    
    const currentLetter = getSortLetterExp(german);
    
    // アルファベット用のアンカーIDを追加
    let anchorId = '';
    if (currentLetter !== prevLetter && (currentLetter === 'OTHER' || (currentLetter >= 'A' && currentLetter <= 'Z'))) {
      anchorId = ` id="letter-${currentLetter}"`;
      prevLetter = currentLetter;
    }
    
    // 個別用語用のIDを生成（スペースを含む場合も対応）
    let termId = '';
    if (german && typeof german === 'string') {
      const normalizedId = normalizeForId(german);
      if (normalizedId) {
        // anchorIdがある場合は両方設定できないので、data属性として保持
        if (anchorId) {
          termId = ` data-term-id="term-${normalizedId}"`;
        } else {
          termId = ` id="term-${normalizedId}"`;
        }
      }
    }
    
    // rowのHTML生成
    html += `<div class="row"${anchorId}${termId}>
  <div>
    <span class="german">${escapeHtmlExp(german)}</span><span class="source">${escapeHtmlExp(source)}</span>
  </div>
  <div class="translation">${escapeHtmlWithBreaksExp(translation)}</div>
</div>\n`;
  });
  
  return html;
}

/**
 * 略記一覧のHTMLを生成
 * @param {Array} abbrData - 略記データ
 * @return {string} 生成されたHTML
 */
function generateAbbrListHtmlExp(abbrData) {
  if (!abbrData || abbrData.length === 0) {
    return '<p>（略記一覧のデータが存在しませんでした）</p>';
  }
  
  let html = '';
  
  abbrData.forEach(row => {
    const [colA, colB, colC] = row;
    
    if (colA && !isNaN(parseInt(colA))) {
      html += `<div class="abbr-title">${escapeHtmlExp(colB)}</div>\n`;
    } else if (colB || colC) {
      html += `<div class="abbr-row">
  <span class="abbr-short">${escapeHtmlExp(colB)}</span><span class="abbr-long">${escapeHtmlExp(colC)}</span>
</div>\n`;
    }
  });
  
  return html;
}

/**
 * 完全なdic_experimental.htmlを生成
 * @param {Array} dicData - 用語データ
 * @param {Array} abbrData - 略記データ
 * @return {string} 完全なHTMLファイルの内容
 */
function generateDicHtmlExperimental(dicData, abbrData) {
  const dicListHtml = generateDicListHtmlExp(dicData);
  const abbrListHtml = generateAbbrListHtmlExp(abbrData);
  
  const timestamp = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  
  const html = `<!DOCTYPE html>
<html>

<head>
    <!-- Google Search Console Verification -->
    <meta name="google-site-verification" content="oMTfhSgc1nOrF9dVnBCR_YGcwCDYlrqNmyYn-UJuBJc" />
    
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZT6MPW5MNG"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'G-ZT6MPW5MNG');
    </script>
    <meta charset="UTF-8">
    <title>用語集（実験版）</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
            scroll-margin-top: 20px;
        }

        /* ハッシュリンクで飛んできた時のハイライト */
        .row.highlight {
            background-color: #ffffcc;
            transition: background-color 0.5s ease;
        }

        .german {
            font-weight: bold;
            font-size: 1.0rem;
            display: block;
            font-family: 'Lora', serif;
        }

        .translation {
            margin-left: 1em;
            font-family: 'Lora', serif;
            font-size: 0.85rem;
        }

        .source {
            font-size: 0.75rem;
            color: #555;
            margin-left: 0.5em;
            font-family: 'Lora', serif;
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
    </style>
    <script>
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

        // ハッシュ変更時のナビゲーション処理
        window.addEventListener('DOMContentLoaded', () => {
            handleHashChange();
        });

        window.addEventListener('hashchange', handleHashChange);

        function handleHashChange() {
            const hash = window.location.hash;
            if (!hash) {
                return;
            }

            // 以前のハイライトをクリア
            document.querySelectorAll('.row.highlight').forEach(el => {
                el.classList.remove('highlight');
            });

            // 略記一覧へのリンク
            if (hash === '#abbrListContainer') {
                const targetElement = document.getElementById('abbrListContainer');
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
                return;
            }

            // 用語へのリンク（term-XXX）
            if (hash.startsWith('#term-')) {
                const termId = hash.substring(1);
                let targetElement = document.getElementById(termId);
                
                // IDが直接見つからない場合、data-term-id属性を検索
                if (!targetElement) {
                    targetElement = document.querySelector(\`[data-term-id="\${termId}"]\`);
                }
                
                if (targetElement) {
                    targetElement.classList.add('highlight');
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    
                    // 3秒後にハイライトを解除
                    setTimeout(() => {
                        targetElement.classList.remove('highlight');
                    }, 3000);
                }
                return;
            }

            // アルファベットリンク
            if (hash.startsWith('#letter-')) {
                const targetElement = document.getElementById(hash.substring(1));
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        }

        function scrollToTop() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }

        const handleScroll = debounce(() => {
            const btn = document.getElementById('scrollToTop');
            if (btn) {
                if (window.scrollY > 300) {
                    btn.style.display = 'block';
                } else {
                    btn.style.display = 'none';
                }
            }
        }, 100);

        window.addEventListener('scroll', handleScroll);
    </script>
</head>

<body>
    <div class="container">
        <h1>用語集（実験版）</h1>
        <div id="listContainer">
${dicListHtml}
        </div>

        <hr class="section-divider">

        <div id="abbrListContainer">
            <div class="top-message" id="abbrMessage">(*)は特記すべきドイツ語はなし</div>
            <div id="abbrContent">
${abbrListHtml}
            </div>
        </div>
    </div>

    <!-- Floating Alphabet Bar -->
    <div id="alpha-floating-bar">
        <a href="#abbrListContainer">略記一覧</a>
        <script>
            const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
            letters.forEach(l => {
                document.write(\`<a href="#letter-\${l}">\${l}</a>\`);
            });
            document.write(\`<a href="#letter-OTHER">数字・記号</a>\`);
        </script>
    </div>

    <div id="scrollToTop" onclick="scrollToTop()">▲ ページのトップへ戻る</div>

    <script>
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
<!-- Generated: ${timestamp} (Experimental) -->`;

  return html;
}

/**
 * 用語インデックス（リンク用）を生成
 * 半角スペースを含まない単語のみを含める
 * @param {Array} dicData - 用語データ
 * @return {Object} 用語インデックス（小文字化されたドイツ語 -> ID）
 */
function generateDicTermsIndex(dicData) {
  const termsIndex = {};
  
  if (!dicData || dicData.length === 0) {
    return termsIndex;
  }
  
  dicData.forEach(row => {
    const [german] = row;
    
    // ドイツ語単語が存在する場合にIDを生成
    if (german && typeof german === 'string') {
      const normalizedId = normalizeForId(german);
      if (normalizedId) {
        const key = normalizedId; // normalizedIdそのものをキーとして使用
        // 重複がある場合は最初の出現を優先
        if (!termsIndex[key]) {
          termsIndex[key] = `term-${normalizedId}`;
        }
      }
    }
  });
  
  return termsIndex;
}
