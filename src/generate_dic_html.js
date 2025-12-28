/**
 * dic.html 静的HTML生成スクリプト
 * スプレッドシートのデータから完全なHTMLファイルを生成
 * リンク機能付き版
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
        termsIndex[normalizedId] = `term-${normalizedId}`;
      }
    }
  });
  
  return termsIndex;
}

/**
 * 正規化された用語から正規表現パターンを生成
 * @param {string} normalizedTerm - 正規化された用語
 * @return {string} 正規表現パターン
 */
function generateTermPattern(normalizedTerm) {
  if (!normalizedTerm) return null;
  let pattern = normalizedTerm;
  pattern = pattern.split('ae').join('(?:ae|ä)');
  pattern = pattern.split('oe').join('(?:oe|ö)');
  pattern = pattern.split('ue').join('(?:ue|ü)');
  pattern = pattern.split('ss').join('(?:ss|ß)');
  pattern = pattern.split('-').join('[\\s\\-]?');
  return pattern;
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
    if (term.length < 3) return;
    const termId = termsIndex[term];
    const termPattern = generateTermPattern(term);
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
    const strA = String(a[0] || '').toLowerCase();
    const strB = String(b[0] || '').toLowerCase();
    
    // ドイツ語の特殊文字を考慮したソート
    return strA.localeCompare(strB, 'de');
  });
}

/**
 * 用語リストのHTMLを生成（リンク機能付き）
 * @param {Array} dicData - 用語データ [[german, translation, source], ...]
 * @param {Object} termsIndex - 用語インデックス（正規化キー → ID）
 * @return {string} 生成されたHTML
 */
function generateDicListHtml(dicData, termsIndex) {
  if (!dicData || dicData.length === 0) {
    return '<div class="result-message">データが存在しません。</div>';
  }
  
  // データをソート
  const sortedData = sortDicData(dicData);
  
  let html = '';
  let prevLetter = null;
  
  sortedData.forEach((row, index) => {
    const [german, translation, source] = row;
    
    if (!german && !translation) return; // 空行をスキップ
    
    const currentLetter = getSortLetter(german);
    
    // 最初の出現時にアルファベットIDを追加
    let anchorId = '';
    if (currentLetter !== prevLetter && (currentLetter === 'OTHER' || (currentLetter >= 'A' && currentLetter <= 'Z'))) {
      anchorId = ` id="letter-${currentLetter}"`;
      prevLetter = currentLetter;
    }
    
    // 個別用語のID生成
    const termId = german ? normalizeForId(german) : '';
    const termIdAttr = termId ? (anchorId ? ` data-term-id="term-${termId}"` : ` id="term-${termId}"`) : '';
    
    // translationにリンクを適用
    const linkedTranslation = termsIndex ? linkTermsInTranslation(translation, termsIndex) : escapeHtmlWithBreaks(translation);
    
    // rowのHTML生成
    html += `<div class="row"${anchorId}${termIdAttr}>
  <div>
    <span class="german">${escapeHtml(german)}</span><span class="source">${escapeHtml(source)}</span>
  </div>
  <div class="translation">${linkedTranslation}</div>
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
  
  abbrData.forEach(row => {
    const [colA, colB, colC] = row;
    
    // colAが数字の場合はタイトル
    if (colA && !isNaN(parseInt(colA))) {
      html += `<div class="abbr-title">${escapeHtml(colB)}</div>\n`;
    } else if (colB || colC) {
      // 通常の略記エントリー
      html += `<div class="abbr-row">
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
function generateDicHtml(dicData, abbrData) {
  // 用語インデックスを生成
  const termsIndex = generateDicTermsIndex(dicData);
  
  const dicListHtml = generateDicListHtml(dicData, termsIndex);
  const abbrListHtml = generateAbbrListHtml(abbrData);
  
  // タイムスタンプをコメントに追加
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
    <title>用語集</title>
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

            const targetId = hash.substring(1);
            
            // Remove previous highlights
            document.querySelectorAll('.highlight-target').forEach(el => el.classList.remove('highlight-target'));

            let targetElement = document.getElementById(targetId);

            // If not found by ID (happens when it's the first term of an alphabet section), 
            // check data-term-id attribute.
            if (!targetElement) {
                targetElement = document.querySelector(\`[data-term-id="\${targetId}"]\`);
                if (targetElement) {
                    targetElement.classList.add('highlight-target');
                }
            }

            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        // ページトップへスクロール
        function scrollToTop() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }

        // Optimized scroll event handler with debounce for scrollToTop button
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

        function toggleNav() {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('active');
        }

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
        <h3 class="sidebar-home"><a href="home.html">🏠 HOME</a></h3>
        <h3>Richard Wagner (RW)</h3>
        <ul>
            <li><a href="richard_wagner.html">曲名から検索</a></li>
            <li><a href="rw_terms_search.html">用語から検索</a></li>
        </ul>

        <h3>Gustav Mahler (GM)</h3>
        <ul>
            <li><a href="index.html">曲名と楽器等から検索</a></li>
            <li><a href="terms_search.html">用語から検索</a></li>
        </ul>

        <h3>Richard Strauss (RS)</h3>
        <ul>
            <li><a href="richard_strauss.html">曲名から検索</a></li>
            <li><a href="rs_terms_search.html">用語から検索</a></li>
        </ul>

        <h3>用語集</h3>
        <ul>
            <li><a href="dic.html">用語集ページ</a></li>
        </ul>

        <h3>その他</h3>
        <ul>
            <!-- 今後追加予定 -->
        </ul>
    </nav>

    <div class="page-wrapper">
        <div class="container">
            <div class="home-link"><a href="home.html">HOME</a></div>
            <h1>用語集</h1>
            <p style="font-size: 0.85rem; color: #555; margin-top: 0.5em; margin-bottom: 1em;">
                RSの管弦楽曲，Anton Bruckner，Paul Hindemith, Sigfrid Karg-Elert については楽譜に記されている2語以上のものについては最初の単語で検索
            </p>
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
<!-- Generated: ${timestamp} -->`;

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




