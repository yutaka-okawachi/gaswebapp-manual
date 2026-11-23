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
 * 用語インデックスを生成
 * @param {Array} dicData - 用語データ [[german, translation, source], ...]
 * @param {Array} mappingData - 検索対応 [[headword, related, type, termSearch, exampleSearch, note], ...]
 * @return {Object} 用語インデックス（正規化キー → IDまたは検索対応情報）
 */
function generateDicTermsIndex(dicData, mappingData) {
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

  const entryId = entry => typeof entry === 'string' ? entry : entry && entry.id;
  const exampleVariantsByHeadword = new Map();
  (mappingData || []).forEach(row => {
    const headword = String(row && row[0] || '').trim();
    const related = String(row && row[1] || '').trim();
    if (!headword || !related || String(row && row[4] || '').trim() !== '対象') return;
    const headwordKey = normalizeForId(headword);
    if (!headwordKey || !entryId(termsIndex[headwordKey])) return;
    const variants = exampleVariantsByHeadword.get(headwordKey) || [];
    if (!variants.some(item => normalizeForId(item.form) === normalizeForId(related))) {
      variants.push({ form: related, type: String(row && row[2] || '').trim() });
    }
    exampleVariantsByHeadword.set(headwordKey, variants);
  });

  exampleVariantsByHeadword.forEach((variants, headwordKey) => {
    const current = termsIndex[headwordKey];
    const id = entryId(current);
    if (!id) return;
    termsIndex[headwordKey] = Object.assign(
      typeof current === 'object' && current ? current : { id },
      {
        exampleVariants: variants.map(item => item.form),
        exampleVariantDetails: variants
      }
    );
  });

  // 用語検索が「対象」の関連語形だけを見出しへ結び付ける．
  // 関連語形自体が独立見出しの場合は，独立見出しを常に優先する．
  (mappingData || []).forEach(row => {
    const headword = String(row && row[0] || '').trim();
    const related = String(row && row[1] || '').trim();
    const relatedKey = normalizeForId(related);
    const headwordKey = normalizeForId(headword);
    const canonicalEntry = termsIndex[headwordKey];
    const canonicalId = entryId(canonicalEntry);
    if (
      !relatedKey || !canonicalId || termsIndex[relatedKey] ||
      String(row && row[3] || '').trim() !== '対象'
    ) return;
    termsIndex[relatedKey] = {
      id: canonicalId,
      original: related,
      canonical: headword,
      type: String(row && row[2] || '').trim()
    };
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
    abbreviationSegments.every(segment => /^[a-z0-9]{1,3}$/i.test(segment)) &&
    (!originalTerm || String(originalTerm).includes('.'));
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
function prepareTermMatchers(termsIndex) {
  return Object.keys(termsIndex).sort((a, b) => b.length - a.length).map(term => {
    const entry = termsIndex[term];
    const id = typeof entry === 'string' ? entry : entry && entry.id;
    const original = typeof entry === 'object' && entry ? String(entry.original || '') : '';
    if (Math.max(term.length, original.length) < 3 || !id) return null;
    const pattern = generateTermPattern(term, original);
    if (!pattern) return null;
    try {
      return { id, regex: new RegExp(`(?<![a-zA-Z0-9äöüßÄÖÜ])(${pattern})(?![a-zA-Z0-9äöüßÄÖÜ])`, 'gi') };
    } catch (e) {
      // Ignore invalid regex, as in the uncached rendering path.
      return null;
    }
  }).filter(Boolean);
}
function linkTermsInTranslation(text, termsIndex, preparedMatchers) {
  if (!text || !termsIndex || Object.keys(termsIndex).length === 0) {
    return escapeHtmlWithBreaks(text);
  }
  
  let escaped = escapeHtml(text);
  const placeholders = [];
  (preparedMatchers || prepareTermMatchers(termsIndex)).forEach(({ id: termId, regex }) => {
    try {
      regex.lastIndex = 0;
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
/**
 * YUT-44 transitional repair: exact reviewed English contexts only.
 * This is NOT a language detector and does not solve future homographs.
 * Fail closed on changed text, target, spelling, occurrence count or duplicate
 * source lines. Unknown contexts retain existing links pending review.
 */
const REVIEWED_ENGLISH_LINK_CONTEXTS = [
  {"headword":"abdämpfen","line":"On percussion instruments, damping reduces or stops the after-ring by restraining the vibration of the head, metal plate or other vibrating part. On timpani, for example, the after-ring can be stopped by touching the head with the hand. The method and timing depend on the instrument, notation and musical context.","links":[["#term-ring","ring",2],["#term-hand","hand",1]]},
  {"headword":"Allmählich wieder ins schnelle Tempo","line":"Gradually (return) to the fast tempo.","links":[["#term-fast","fast",1]]},
  {"headword":"Almosenier","line":"For the servants in Der Rosenkavalier Op.59, see the entry “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"angehalten","line":"See the entry for anhalten.","links":[["#term-see","See",1]]},
  {"headword":"ängstlich","line":"See the entry for Angst.","links":[["#term-see","See",1]]},
  {"headword":"anhalten","line":"Gehalten can refer to sustaining tone and phrasing, in a sense close to tenuto or sostenuto, as well as to restraining the tempo or expression. Its distinction from anhalten depends on the particular use and the surrounding context. See also the entry for gehalten.","links":[["#term-see","See",1],["#term-also","also",1]]},
  {"headword":"Arm","line":"① An arm.","links":[["#term-arm","arm",1]]},
  {"headword":"Arm","line":"② An arm-like projection; a branch of a river or similar feature.","links":[["#term-arm","arm",1]]},
  {"headword":"Arm","line":"English: Takes her by the arm.","links":[["#term-arm","arm",1]]},
  {"headword":"Art","line":"④ A kind or type; in biology, a species.","links":[["#term-kind","kind",1]]},
  {"headword":"Art","line":"English: Matteo has emerged on the left at the same time as Adelaide; Zdenka follows shyly behind him in boy's clothes, a kind of black tailcoat, sheltering behind a column.","links":[["#term-kind","kind",1]]},
  {"headword":"aufstellen","line":"English: He gestures to the vassals towards the Rhine. Some of them hurry up onto the rise, while others take their places along the bank to see those arriving.","links":[["#term-see","see",1]]},
  {"headword":"aufzustellen","line":"The zu-infinitive of aufstellen. See the entry “aufstellen.”","links":[["#term-see","See",1]]},
  {"headword":"ausgelassen","line":"English: In exuberant high spirits, Siegfried puts his arm around Gutrune and draws her with him into the hall. The vassals and women, carried away by his example, follow him.","links":[["#term-arm","arm",1]]},
  {"headword":"ausholen","line":"① To draw one's arm back (for a blow or throw), gather momentum, or prepare oneself.","links":[["#term-arm","arm",1]]},
  {"headword":"ausser sich","line":"See the entry for “außer sich.”","links":[["#term-see","See",1]]},
  {"headword":"äusserst","line":"See the entry for “äußerst.”","links":[["#term-see","See",1]]},
  {"headword":"bedeutend","line":"English: The quarter notes considerably faster than before, though not twice as fast.","links":[["#term-fast","fast",1]]},
  {"headword":"Bediente","line":"For the servants in Der Rosenkavalier Op.59, see “Haushofmeister.”","links":[["#term-see","see",1]]},
  {"headword":"beinahe doppelt so schnell","line":"Almost twice as fast.","links":[["#term-fast","fast",1]]},
  {"headword":"beiseite","line":"See also für sich and vor sich.","links":[["#term-see","See",1],["#term-also","also",1]]},
  {"headword":"bereits","line":"English: Startled, she pauses for a moment; meanwhile, Guntram, who has quickly regained his composure, has already hurried after her and holds her fast.","links":[["#term-fast","fast",1]]},
  {"headword":"besetzt","line":"Past participle of besetzen. See the entry for “besetzen.”","links":[["#term-see","See",1]]},
  {"headword":"Bett","line":"English: Lit by this glow, the three Rhinemaidens can be seen swimming in a circle on the calmer waves of the Rhine, which has gradually returned to its bed, playing merrily with the ring.","links":[["#term-ring","ring",1]]},
  {"headword":"bispigliando","line":"See the entry for bisbigliando.","links":[["#term-see","See",1]]},
  {"headword":"Blatt","line":"③ A playing card, a hand of cards, or a pack.","links":[["#term-hand","hand",1]]},
  {"headword":"Blitz","line":"English: Darkness, a flash; the nurse leads the apparition of the young man forward by the hand.","links":[["#term-hand","hand",1]]},
  {"headword":"bloß","line":"English: Menelas, bare sword in hand, steps behind Helena.","links":[["#term-hand","hand",1]]},
  {"headword":"Bord","line":"English: The girls hand their baskets over the side of the ship to the sailors.","links":[["#term-hand","hand",1]]},
  {"headword":"Cäsur","line":"For a break involving a breath, see also “Luftpause.”","links":[["#term-see","see",1],["#term-also","also",1]]},
  {"headword":"cuivrez","line":"This is French. See “schmetternd.”","links":[["#term-see","See",1]]},
  {"headword":"dahinhuschend","line":"In an alternative reference edition of Karg-Elert’s 30 Capricen für Flöte solo Op.107, No. 30, Variation XIII, dahinhuschend accompanies “So rasch als möglich” (as fast as possible), alongside “Presto il più possibile.”","links":[["#term-fast","fast",1]]},
  {"headword":"Dämpfer","line":"For removable mutes, mit Dämpfer means “with the mute on” (con sordino), and Dämpfer ab / weg means “remove the mute” (senza sordino). See also “Dämpfer auf.”","links":[["#term-see","See",1],["#term-also","also",1]]},
  {"headword":"Dämpfer ab","line":"Short for “Dämpfer abnehmen” or “Dämpfer absetzen.” See “Dämpfer auf.”","links":[["#term-see","See",1]]},
  {"headword":"Dämpfer auf","line":"On the other hand, auf can also generally mean 「open」. When offen (open) or gestopft (stopped) is indicated for brass instruments, its relationship to open tones, hand-stopping, the use of a mute, and so forth must be interpreted according to the instrument and the surrounding context. The auf in Dämpfer auf does not denote this sense of 「open」, but rather the fitting of the mute.","links":[["#term-hand","hand",2],["#term-also","also",1]]},
  {"headword":"Dämpfer weg","line":"It means “remove the mute,” but there are no examples of Dämpfer weg in GM. Weg means “taken away” or “removed.” See “Dämpfer auf.”","links":[["#term-see","See",1]]},
  {"headword":"decken","line":"English: Matteo has emerged on the left at the same time as Adelaide; Zdenka follows shyly behind him in boy's clothes, a kind of black tailcoat, sheltering behind a column.","links":[["#term-kind","kind",1]]},
  {"headword":"devot","line":"This comparison describes a relative tendency in connotation: demütig can also express submissiveness or self-abasement. Sense ② of devot represents historical usage and should be distinguished from its modern general meaning. The examples “as if rubbing one’s hands in ingratiation” and “bowing and scraping” figuratively convey an excessively deferential manner; devot itself does not necessarily prescribe hand-rubbing or bowing.","links":[["#term-hand","hand",1],["#term-also","also",1]]},
  {"headword":"Diener","line":"For the servants in Der Rosenkavalier Op.59, see the entry \"Haushofmeister.\"","links":[["#term-see","see",1]]},
  {"headword":"Dienerschaft","line":"For the servants in Der Rosenkavalier Op.59, see the entry \"Haushofmeister.\"","links":[["#term-see","see",1]]},
  {"headword":"doppelt","line":"English: The quarter notes considerably faster than before, though not twice as fast.","links":[["#term-fast","fast",1]]},
  {"headword":"doppelt","line":"In GM, the examples concern doubling the players or instruments assigned to a part. As a tempo instruction, for example, \"doppelt so schnell (langsam)\" means \"twice as fast (at half the speed)\".","links":[["#term-fast","fast",1]]},
  {"headword":"Duenna","line":"For the servants in Der Rosenkavalier Op.59, see the entry for Haushofmeister.","links":[["#term-see","see",1]]},
  {"headword":"eigenhändig","line":"① With one’s own hand; personally; directly (without an intermediary).","links":[["#term-hand","hand",1]]},
  {"headword":"Eintragung","line":"English: Vocal part, bars 83–85: possibly tacet, according to an annotation in Mahler’s own hand in a performance score.","links":[["#term-hand","hand",1]]},
  {"headword":"entschlossen","line":"English: He quickly and decisively takes Matteo's hand and leads him towards Waldner.","links":[["#term-hand","hand",1]]},
  {"headword":"entsprechen","line":"English: The differing dynamics of the first violins (relative to the others) reflect a correction in Mahler’s own hand.","links":[["#term-hand","hand",1]]},
  {"headword":"erblicken","line":"② To see or regard someone or something as something.","links":[["#term-see","see",1]]},
  {"headword":"erhobener","line":"See the entry for “erhobner.”","links":[["#term-see","See",1]]},
  {"headword":"erhobner","line":"English: The lights dim; only moonlight comes in from outside. A beam falls on Helena's face. Menelas, his dagger raised to strike her in the throat, stands spellbound by her beauty. His arm holding the weapon sinks.","links":[["#term-arm","arm",1]]},
  {"headword":"ermüdet","line":"English: He looks elegant but tired and short of sleep, crosses the room as if he did not see the others, and sinks into an armchair at the front right.","links":[["#term-see","see",1]]},
  {"headword":"erreicht","line":"③ To get in touch with someone or something; to reach (with the hand, etc.).","links":[["#term-hand","hand",1],["#term-get","get",1]]},
  {"headword":"Fackel","line":"English: Elektra takes the torch from the ring, runs down towards him (Ägisth) and bows before him.","links":[["#term-ring","ring",1]]},
  {"headword":"fest","line":"English: Startled, she pauses for a moment; meanwhile, Guntram, who has quickly regained his composure, has already hurried after her and holds her fast.","links":[["#term-fast","fast",1]]},
  {"headword":"Finger","line":"English: He takes his ring off his finger, kisses it, and holds it out threateningly.","links":[["#term-ring","ring",1],["#term-finger","finger",1]]},
  {"headword":"freundlich","line":"① Friendly, kind or amiable in dealing with others. Stage directions describe a friendly expression, tone or gesture.","links":[["#term-kind","kind",1]]},
  {"headword":"führend","line":"English: Baron Ochs appears with his arm in a sling, leading Octavian with his left hand, with the personal footman behind him. The Baron surveys the room. Octavian looks around, runs to the mirror, and arranges his hair.","links":[["#term-arm","arm",1],["#term-hand","hand",1]]},
  {"headword":"gehalten","line":"See also the entry “anhalten.”","links":[["#term-see","See",1],["#term-also","also",1]]},
  {"headword":"geleiten","line":"English: Taking him under the arm and escorting him.","links":[["#term-arm","arm",1]]},
  {"headword":"genau","line":"English: Juts his head forward, as shortsighted people do, to see the major-domo more clearly.","links":[["#term-see","see",1]]},
  {"headword":"geschrieen","line":"Historical spelling of geschrien, the past participle of schreien. See “geschrien”. In GM, the only occurrence is in “Revelge” from Des Knaben Wunderhorn.","links":[["#term-see","See",1]]},
  {"headword":"geschwind","line":"① Fast, swift, or quick.","links":[["#term-fast","Fast",1]]},
  {"headword":"Geschwindmarsch","line":"“Quick march”. Geschwind means “fast” or “swift”.","links":[["#term-fast","fast",1]]},
  {"headword":"gespr.","line":"See “gesprochen”.","links":[["#term-see","See",1]]},
  {"headword":"gesprochen","line":"English: Spoken: The woman is mad! Light a fire so I can see her face!","links":[["#term-see","see",1]]},
  {"headword":"gestossen","line":"Swiss spelling of gestoßen, or a spelling that substitutes ss for ß. See “gestoßen”.","links":[["#term-see","See",1]]},
  {"headword":"get.","line":"Abbreviation of geteilt. See “geteilt”.","links":[["#term-see","See",1]]},
  {"headword":"geth.","line":"Abbreviation of getheilt. See “geteilt”.","links":[["#term-see","See",1]]},
  {"headword":"getheilt","line":"Historical spelling of geteilt. See “geteilt”.","links":[["#term-see","See",1]]},
  {"headword":"gewonnen","line":"English: Flosshilde, swimming ahead of the others towards the back of the stage, holds the ring she has won aloft in triumph.","links":[["#term-ring","ring",1]]},
  {"headword":"gewonnen","line":"See “gewinnen”. In Wagner’s Tannhäuser, it has been translated as “prevailed over”.","links":[["#term-see","See",1]]},
  {"headword":"gezogen","line":"For the relationship between the two terms and the score example, see the entry for 「gestrichen」.","links":[["#term-see","see",1]]},
  {"headword":"Glas","line":"English: Everyone clinks glasses; the glasses ring, and they drink them dry. Silence.","links":[["#term-ring","ring",1]]},
  {"headword":"halblaut","line":"English: Looking at herself in the hand mirror, in a low voice.","links":[["#term-hand","hand",1]]},
  {"headword":"Hand","line":"① A hand.","links":[["#term-hand","hand",1]]},
  {"headword":"Hand","line":"English: He kisses her hand.","links":[["#term-hand","hand",1]]},
  {"headword":"hastig","line":"English: Still equally fast and hurried (but in 4/4).","links":[["#term-fast","fast",1]]},
  {"headword":"Hausknecht","line":"For the servants in Der Rosenkavalier Op.59, see “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"Hess","line":"See also “WoO”.","links":[["#term-see","See",1],["#term-also","also",1]]},
  {"headword":"Himmel","line":"English: Gurnemanz raises his right arm and looks up to heaven.","links":[["#term-arm","arm",1]]},
  {"headword":"jedoch","line":"English: At this point Lohengrin has disappeared from the audience’s view behind the trees at the bend in the river on the right; the performers on stage, however, see him coming ever closer on the right side of the stage.","links":[["#term-see","see",1]]},
  {"headword":"Kammerdiener","line":"For the servants in Der Rosenkavalier Op.59, see “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"Kammerlakai","line":"For the servants in Der Rosenkavalier Op.59, see “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"kaum","line":"English: As Barak raises his right hand as if taking an oath, a flashing sword falls from the air into it. The brothers together scarcely have the strength to restrain him.","links":[["#term-hand","hand",1]]},
  {"headword":"Kellner","line":"For the servants in Der Rosenkavalier Op.59, see “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"kleiner Neger","line":"For the servants in Der Rosenkavalier Op.59, see the entry “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"klingen","line":"① To sound, ring, resonate, or echo.","links":[["#term-ring","ring",1],["#term-echo","echo",1]]},
  {"headword":"klingen","line":"English: Always let it ring.","links":[["#term-ring","ring",1]]},
  {"headword":"klingen","line":"English: Everyone clinks glasses; the glasses ring, and they drink them dry. Silence.","links":[["#term-ring","ring",1]]},
  {"headword":"Lady Macbeth. O, eile! Eile her! damit ich meinen Geist in deinen giesse, durch meine tapfere Zunge diese Zweifel und Furchtgespenster aus dem Felde schlage, die dich wegschrecken von dem goldnen Reif, womit das Glück dich gern bekrönen möchte.","line":"The scene can be interpreted as follows. Having read Macbeth’s letter describing the witches’ prophecy, Lady Macbeth sees that her husband is “too kind to resolve to become king”. She decides to take on the task of pouring that resolve into him and driving out his hesitation through words. Here, “Geist” (“spirit”) means courage, boldness, and the ability to make ruthless decisions, while “tapfere Zunge” (“valiant tongue”) shows her awareness of the power of manipulative language as a weapon. “Goldner Reif” (“golden circlet”) is an indirect expression for the crown, while “Glück” (“fortune” or “luck”) can also be read as a perilous turn of phrase that presents the temptation to sin as though it were fate’s blessing.","links":[["#term-kind","kind",1],["#term-also","also",1]]},
  {"headword":"Lakai","line":"For the servants in Der Rosenkavalier Op.59, see “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"lebhaft","line":"As a tempo indication, it can also be rendered “at a fairly fast tempo”.","links":[["#term-fast","fast",1],["#term-also","also",1]]},
  {"headword":"Leibjäger","line":"For the servants in Der Rosenkavalier Op.59, see “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"Leibkammerdiener","line":"For the servants in Der Rosenkavalier Op.59, see “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"Leiblakai","line":"For the servants in Der Rosenkavalier Op.59, see “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"Leute","line":"For the servants in Der Rosenkavalier Op.59, see “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"liebenswürdig","line":"① Amiable, pleasant, or kind.","links":[["#term-kind","kind",1]]},
  {"headword":"liebevoll","line":"② Gentle, considerate, or kind.","links":[["#term-kind","kind",1]]},
  {"headword":"links","line":"② (Colloquially) With the left hand.","links":[["#term-hand","hand",1]]},
  {"headword":"Livree","line":"For the servants in Der Rosenkavalier Op.59, see the entry “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"Lümmel","line":"For the servants in Der Rosenkavalier Op.59, see the entry “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"m.d.","line":"In the relevant keyboard-instrument examples in GM, the abbreviation stands for Italian mano destra and indicates “with the right hand”.","links":[["#term-hand","hand",1]]},
  {"headword":"m.Dpf.","line":"An abbreviation of mit Dämpfer (“with a mute”). See the entry “mit Dämpfer”.","links":[["#term-see","See",1]]},
  {"headword":"m.s.","line":"In the relevant keyboard-instrument examples in GM, the abbreviation stands for Italian mano sinistra and indicates “with the left hand”.","links":[["#term-hand","hand",1]]},
  {"headword":"Magd","line":"For the servants in Der Rosenkavalier Op.59, see the entry “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"mässig","line":"See the entry for “mäßig”.","links":[["#term-see","See",1]]},
  {"headword":"Meer","line":"English: The shepherd turns and peers out towards the sea, shading his eyes with his hand.","links":[["#term-hand","hand",1]]},
  {"headword":"Mehr schnell","line":"The opening marking of the finale of Bruckner’s II. SYMPHONIE C-MOLL (1877 version). Literally it may suggest “faster”, but here “mehr” is best understood as characterizing the tempo, “rather fast”, rather than asking for an increase from a preceding speed.","links":[["#term-fast","fast",1]]},
  {"headword":"murmeln","line":"English: Alberich touches the ring with his lips and secretly murmurs a command.","links":[["#term-ring","ring",1]]},
  {"headword":"NB","line":"See the entry “N.B.”.","links":[["#term-see","See",1]]},
  {"headword":"Nicht zu schnell. Keinefalls schleppend","line":"Not too fast. Never dragging.","links":[["#term-fast","fast",1]]},
  {"headword":"nimmt","line":"English: Welko deftly takes the empty tray from her hand and disappears.","links":[["#term-hand","hand",1]]},
  {"headword":"nimmt","line":"When an instrument is specified, senses ① and ② may be rendered as “changes to” that instrument. See the entry for “nehmen”.","links":[["#term-see","See",1]]},
  {"headword":"noch einmal","line":"English: Note for the conductor: By this point, through the imperceptible increase, the tempo has become approximately twice as fast as at the beginning (but still conduct in quarter notes).","links":[["#term-fast","fast",1]]},
  {"headword":"offen","line":"As a playing instruction, offen: open (cease hand-stopping, or remove the mute).","links":[["#term-hand","hand",1]]},
  {"headword":"Paar","line":"English: The door remains open. Outside, it is a spring night. The full moon shines into the room, casting its bright light on the couple, who can now suddenly see each other with complete clarity.","links":[["#term-see","see",1]]},
  {"headword":"recht","line":"③ Right; right-hand.","links":[["#term-hand","hand",1]]},
  {"headword":"recht","line":"English: Loge unties the loop around his right hand.","links":[["#term-hand","hand",1]]},
  {"headword":"Ring","line":"anello; cerchio; ring","links":[["#term-ring","ring",1]]},
  {"headword":"Ring","line":"① A ring or circular object or part.","links":[["#term-ring","ring",1]]},
  {"headword":"Ring","line":"② A finger ring.","links":[["#term-ring","ring",1],["#term-finger","finger",1]]},
  {"headword":"Ring","line":"④ An arena or ring for a contest or fight.","links":[["#term-ring","ring",1]]},
  {"headword":"Ring","line":"⑤ A ring road or circular district.","links":[["#term-ring","ring",1]]},
  {"headword":"Ring","line":"English: Siegfried looks intently at the ring on his finger.","links":[["#term-ring","ring",1],["#term-finger","finger",1]]},
  {"headword":"Ring","line":"English: They form a ring around David and dance around him.","links":[["#term-ring","ring",1]]},
  {"headword":"Ring","line":"English: The maid (one of the servants) fastens the torch to an iron ring in the doorpost.","links":[["#term-ring","ring",1]]},
  {"headword":"RONDO\nAllegro ma non troppo (in cominciando un poco esitando)","line":"Rondo. Allegro, but not too fast; a little hesitant at the beginning.","links":[["#term-fast","fast",1]]},
  {"headword":"Ruhebett","line":"English: Standing, supporting herself with one hand on the couch.","links":[["#term-hand","hand",1]]},
  {"headword":"Saal","line":"English: At this point the creditors break through the line of guards and rush wildly into the hall towards the rickety throne, papers in hand.","links":[["#term-hand","hand",1]]},
  {"headword":"sämmtlich","line":"An older spelling of “sämtlich”. See the entry for “sämtlich”.","links":[["#term-see","See",1]]},
  {"headword":"Schale","line":"English: Isolde does not throw the cup away; instead, it slips from her gradually opening hand.","links":[["#term-hand","hand",1]]},
  {"headword":"Schallbecher","line":"A general term for the end of a woodwind or brass instrument and for the resonator of certain organ reed pipes. In wind-instrument contexts, it is broadly synonymous with Schalltrichter and Schallstück. On the horn, it denotes the part into which the right hand is inserted for stopped playing or tone modification.","links":[["#term-hand","hand",1]]},
  {"headword":"Schemel","line":"English: Octavian kneels on a footstool in front of the bed, half embracing the Marschallin, who is lying in bed. Her face cannot be seen, only her very beautiful hand and the arm from which her lace nightdress has slipped.","links":[["#term-hand","hand",1],["#term-arm","arm",1]]},
  {"headword":"Schlag","line":"See also the entry for “Takt”.","links":[["#term-see","See",1],["#term-also","also",1]]},
  {"headword":"schleichen","line":"English: Annina has entered through the anteroom and stealthily creeps closer, a letter in her hand.","links":[["#term-hand","hand",1]]},
  {"headword":"Schluss","line":"English: “For the Paris version of this ending, see Appendix V, page 568.”","links":[["#term-see","see",1]]},
  {"headword":"schnell","line":"Fast; quick; rapid.","links":[["#term-fast","Fast",1]]},
  {"headword":"Schwanendreher","line":"In his 1938 concert notes, Hindemith is said to have explained that this folk song apparently mocked a person who turned a swan on a spit in the kitchen. The translation above follows this interpretation. Another theory holds that the word refers to a player of a hand-cranked organ decorated with a swan.","links":[["#term-hand","hand",1]]},
  {"headword":"Seil","line":"English: Kunrad pulls himself up a little on the rope and, with his arm outstretched, just manages to catch hold of the ends of a few strands of her hair.","links":[["#term-arm","arm",1]]},
  {"headword":"später","line":"English: The woodwind figures, and later the violins’ figures, always equally fast, disregarding the slow tempo of the passage.","links":[["#term-fast","fast",1]]},
  {"headword":"spielend","line":"As an expression marking: playfully, frolicsomely, or merrily. At the opening of No.17 of Karg-Elert’s 30 Capricen für Flöte solo Op.107, “Leggero veloce, giocoso.” appears alongside “Leicht, spielend, sehr rasch.” (lightly, playfully, very fast).","links":[["#term-fast","fast",1]]},
  {"headword":"spitzig","line":"An adjective related in meaning to spitz. See the entry for “spitz”.","links":[["#term-see","See",1]]},
  {"headword":"spottend","line":"The degree and tone of mockery depend on the context; it is not necessarily milder than direct ridicule. It may carry contempt, indifference, or coldness. See also “spöttisch”.","links":[["#term-see","See",1],["#term-also","also",1]]},
  {"headword":"spöttisch","line":"See also “spottend”.","links":[["#term-see","See",1],["#term-also","also",1]]},
  {"headword":"steigen","line":"English: He turns to leave, hesitates, then turns to go again, dejectedly. Arabella appears upstairs, looks down to see whether he is still there, and her face lights up. She takes the glass and slowly comes down with it, Welko following her. Mandryka, almost gone, turns and sees Arabella descending slowly and solemnly, carrying the glass on a tray held in both hands. Startled with joy, he steps back.","links":[["#term-see","see",1]]},
  {"headword":"Stille","line":"English: Everyone clinks glasses; the glasses ring, and they drink them dry. Silence.","links":[["#term-ring","ring",1]]},
  {"headword":"streichelt","line":"See “streicheln”.","links":[["#term-see","See",1]]},
  {"headword":"Stufe","line":"English: She pulls the resisting Eva by the arm up the steps to the door.","links":[["#term-arm","arm",1]]},
  {"headword":"überhetzt","line":"By contrast, “überhitzt”, for which no example was found in GM, has a different meaning. The word itself means “overheated”; figuratively, it describes excessive emotional or expressive excitement. It does not in itself specify a fast tempo. In such a context, possible translations include “emotionally overheated”, “as if feverish”, or “with excessive intensity”.","links":[["#term-fast","fast",1]]},
  {"headword":"übermüthig","line":"See the entry for “übermütig”.","links":[["#term-see","See",1]]},
  {"headword":"übernimmt","line":"See the entry for “übernehmen”.","links":[["#term-see","See",1]]},
  {"headword":"übernommen","line":"See the entry for “übernehmen”.","links":[["#term-see","See",1]]},
  {"headword":"überreicht","line":"① To hand over, offer, or present an object; as a past participle, handed over, offered, or presented.","links":[["#term-hand","hand",1]]},
  {"headword":"überreicht","line":"② To submit or hand over a document; as a past participle, submitted or handed over.","links":[["#term-hand","hand",1]]},
  {"headword":"übrig","line":"English: Gunther, who has let go of Brünnhilde's violently trembling hand, and everyone else stand transfixed in dismay at her behaviour.","links":[["#term-hand","hand",1]]},
  {"headword":"umgeben","line":"English: She lays a blue cloak, which had hung folded over her arm, around Apollo's shoulders. It unfolds, enveloping him broadly and majestically. At the same time a strange light plays around him.","links":[["#term-arm","arm",1]]},
  {"headword":"Umstände","line":"See the entry for “Umstand”.","links":[["#term-see","See",1]]},
  {"headword":"Variationen \"Seid ihr nicht der Schwanendreher\"","line":"\"Schwanendreher\" is translated here as “the person who turns a swan on a spit to roast it”. See the entry for \"Schwanendreher\".","links":[["#term-see","See",1]]},
  {"headword":"vgl.","line":"(= vergleiche) See …; refer to …","links":[["#term-see","See",1]]},
  {"headword":"Vgl. Kritischer Bericht: Bewertung","line":"“For further details, see the ‘Evaluation’ section of the critical report.”","links":[["#term-see","see",1]]},
  {"headword":"Vgl. Kritischer Bericht: Lesaerten","line":"“For further details, see the ‘Variant readings’ section of the critical report.”","links":[["#term-see","see",1]]},
  {"headword":"vide","line":"The imperative of the Latin videre (“to see”).","links":[["#term-see","see",1]]},
  {"headword":"vide","line":"“See”, “refer to” or “see the specified passage”.","links":[["#term-see","See",1],["#term-see","see",1]]},
  {"headword":"Waffe","line":"English: The lights dim; only moonlight comes in from outside. A beam falls on Helena's face. Menelas, his dagger raised to strike her in the throat, stands spellbound by her beauty. His arm holding the weapon sinks.","links":[["#term-arm","arm",1]]},
  {"headword":"Wald","line":"English: Robert offers Freihild his hand and leads her off towards the wood; the old Duke goes with them.","links":[["#term-hand","hand",1]]},
  {"headword":"warm","line":"① Warm; mild (of the climate).","links":[["#term-warm","Warm",1]]},
  {"headword":"warm","line":"② Warm-hearted, kind or affectionate (in feeling).","links":[["#term-warm","Warm",1],["#term-kind","kind",1]]},
  {"headword":"warm","line":"③ Warm (of colours); having a warm quality.","links":[["#term-warm","Warm",1],["#term-warm","warm",1]]},
  {"headword":"Wärme","line":"mit Wärme: with warm feeling.","links":[["#term-warm","warm",1]]},
  {"headword":"Wink","line":"① A signal or gesture made with the hand, eyes, head, or similar movement.","links":[["#term-hand","hand",1]]},
  {"headword":"WoO","line":"See also “Hess”.","links":[["#term-see","See",1],["#term-also","also",1]]},
  {"headword":"Zofe","line":"For the servants in Der Rosenkavalier Op.59, see “Haushofmeister.”","links":[["#term-see","see",1]]},
  {"headword":"zögernd","line":"English: Flowing, but not fast. In the opening bars, still somewhat hesitant.","links":[["#term-fast","fast",1]]},
  {"headword":"zornig","line":"English: The door opens and the wigmaker staggers out, just receiving a slap from the tenor. Dressed as Bacchus, but with his head bare and the curly wig in his hand, the tenor follows him out angrily.","links":[["#term-hand","hand",1]]},
  {"headword":"zu","line":"“Nicht zu schnell”: not too fast (similar in sense to Non troppo allegro).","links":[["#term-fast","fast",1]]},
  {"headword":"zu","line":"“Dämpfer zu”: interpreted here as meaning to put on the mute (sense ③). Incidentally, “Dämpfer auf” in GM also means to put on the mute. See the entry “Dämpfer auf.”","links":[["#term-see","See",1],["#term-also","also",1]]},
  {"headword":"zugleich","line":"English: She signals to the vassals to carry Siegfried’s body onto the pyre; at the same time, she removes the ring from Siegfried’s finger and contemplates it, lost in thought.","links":[["#term-ring","ring",1],["#term-finger","finger",1]]},
  {"headword":"zuletzt","line":"English: The three orphans, and finally their mother too, have kissed the Marschallin’s hand.","links":[["#term-hand","hand",1]]},
  {"headword":"Zungenschlag","line":"There is no example in the GM entries. In Variation II of [RS: Qui], where a flock of sheep is imitated, the term presumably means “flutter-tonguing” (quite apart from the brass, asking the clarinets to do the same at p or pp is diabolically demanding). An early orchestral example of flute flutter-tonguing occurs in Tchaikovsky's The Nutcracker. See also “Zungenstoß.”","links":[["#term-see","See",1],["#term-also","also",1]]},
  {"headword":"zus.","line":"See the entry for zusammen.","links":[["#term-see","See",1]]},
  {"headword":"abwechselnd","line":"Adverb; also the present participle of abwechseln, inflected when used attributively.","links":[["#term-also","also",1]]},
  {"headword":"allmählich","line":"In [RW: Oper], the spelling “allmälig” is also found; in [RS: Oper], “allmählig” is also found.","links":[["#term-also","also",2]]},
  {"headword":"Andacht","line":"Mit Andacht: “devoutly”; “prayerfully”; “with reverence”; also “with deep concentration.”","links":[["#term-also","also",1]]},
  {"headword":"Anfang","line":"Anfangs is the genitive form of the noun Anfang, while anfangs is also an adverb meaning “at first” or “initially.” Searches for examples from this entry also include occurrences of this adverb.","links":[["#term-also","also",2]]},
  {"headword":"Angst","line":"Fear; anxiety; dread; terror. Also distress caused by intense anxiety.","links":[["#term-also","Also",1]]},
  {"headword":"angstvoll","line":"Adjective, also used adverbially; inflected when attributive.","links":[["#term-also","also",1]]},
  {"headword":"anhalten","line":"This brief pause can also be understood as applying the brakes to the forward motion of the music and momentarily holding it back. One possible performance interpretation is restraint accompanied by an inner tension, like deliberately holding one's breath (Atem anhalten).","links":[["#term-also","also",1],["#term-brief","brief",1],["#term-pause","pause",1]]},
  {"headword":"antworten","line":"The related noun Antwort means “answer” or “reply.” It is not an inflected form of antworten, but searches for examples from this entry also include occurrences of this noun.","links":[["#term-also","also",1]]},
  {"headword":"ärgerlich","line":"Adjective, also used adverbially. Comparative ärgerlicher; superlative am ärgerlichsten. Ärgerliche is an inflected form; Aergerlich spells Ä as Ae.","links":[["#term-also","also",1]]},
  {"headword":"atemlos","line":"Adjective; comparative atemloser, superlative am atemlosesten. Also used adverbially.","links":[["#term-also","Also",1]]},
  {"headword":"aufdringlich","line":"In GM’s Revelge, bar 89, the snare-drum direction stark, aber nicht aufdringlich means “Strongly, but without intruding.” The score consulted also gives forte ma non troppo risaltato.","links":[["#term-also","also",1]]},
  {"headword":"aufmerksam","line":"Adjective, also used adverbially. Comparative aufmerksamer; superlative am aufmerksamsten. Aufmerksamer may also be an inflected attributive form.","links":[["#term-also","also",2]]},
  {"headword":"aufstellen","line":"The related noun Aufstellung means “positioning,” “arrangement,” or “setting up,” among other senses. It is not an inflected form of aufstellen, but searches for examples from this entry also include occurrences of this noun.","links":[["#term-also","also",1]]},
  {"headword":"außer sich","line":"One can be beside oneself with joy, but also lose self-control under powerful impulses such as anger, fear, or despair. Renderings such as “out of one's senses” or “out of one's mind” can describe intense emotion figuratively.","links":[["#term-also","also",1]]},
  {"headword":"AV","line":"Characteristics and role: Incorporating research and information about the works that followed the publication of Müller von Asow's catalogue, this catalogue reorganized the works as a whole in order of composition (chronological order). Its chronological arrangement (from the earliest studies of 1870 to the final works of 1949) is useful for tracing the development of Richard Strauss's creative activity and establishing and identifying dates of composition. The Richard-Strauss-Quellenverzeichnis (Richard Strauss Sources Catalogue / RSQV) takes TrV as its starting point and corrects and supplements the information about the works. TrV is also referenced in research and scholarly editions such as Richard Strauss Werke. Kritische Ausgabe (the critical edition of Richard Strauss's works), although information based on either catalogue may require correction in the light of subsequent research.","links":[["#term-also","also",1]]},
  {"headword":"AV","line":"Thus, the catalogues differ in their origins and organization: an earlier, detailed thematic catalogue (AV), followed by a catalogue (TrV) that reorganized the works as a whole chronologically in light of subsequent research. However, AV also uses chronological ordering within its categories, and versions of TrV from 1993 onward also contain thematic incipits. They are consulted as complementary resources, and there are examples of both numbers appearing together in the official list of works.","links":[["#term-also","also",2]]},
  {"headword":"Bandes","line":"② das Band (neuter): a band, ribbon, or bond. The plural form Bande can also mean bonds or fetters.","links":[["#term-also","also",1]]},
  {"headword":"barsch","line":"The Middle Low German source word also had a sense referring to a strong or sharp taste.","links":[["#term-also","also",1]]},
  {"headword":"barsch","line":"The vocal direction in “Lob des hohen Verstands” from Des Knaben Wunderhorn is rendered here as “sharply”. There are also examples in RW. Depending on the context, “gruffly”, “in a harsh tone”, or “speaking with cold abruptness” may be appropriate.","links":[["#term-also","also",1]]},
  {"headword":"bedeuten","line":"The related noun Bedeutung means “meaning,” “significance,” or “importance.” It is not an inflected form of bedeuten, but searches for examples from this entry also include occurrences of this noun.","links":[["#term-also","also",1]]},
  {"headword":"bedeutend","line":"Present participle of bedeuten, also used as an adjective or adverb.","links":[["#term-also","also",1]]},
  {"headword":"befehlend","line":"The related noun Befehl means “command” or “order,” and Befehle is its plural. It is not an inflected form of befehlend, but searches for examples from this entry also include occurrences of this noun.","links":[["#term-also","also",1]]},
  {"headword":"befremdet","line":"Past participle of befremden. The same spelling also occurs in finite forms, including the third-person singular present indicative.","links":[["#term-also","also",1]]},
  {"headword":"Befremdung","line":"Although Befremdung is a noun, it may also be rendered as “with puzzlement”, “with a sense of strangeness”, “suspiciously”, “in perplexity”, “with a feeling of unease”, or “as if something were not quite right”, depending on the construction and context.","links":[["#term-also","also",1]]},
  {"headword":"Befremdung","line":"The related noun Befremden also means “puzzlement,” “bewilderment,” or “unease.” It is not an inflected form of Befremdung, but searches for examples from this entry also include occurrences of Befremden.","links":[["#term-also","also",2]]},
  {"headword":"Begeisterung","line":"The related adjective and past participle begeistert means ‘enthusiastic’ or ‘delighted’ and has forms such as begeisterter, begeistertem, begeisterte, and begeisterten. Begeisterter can also be a comparative form. These are not inflected forms of the noun Begeisterung, but searches for examples from this entry also include these usages.","links":[["#term-also","also",2]]},
  {"headword":"begleitend","line":"The related noun Begleitung means “accompaniment,” “company,” or “an accompanying person,” among other senses. It is not an inflected form of begleitend, but searches for examples from this entry also include occurrences of this noun.","links":[["#term-also","also",1]]},
  {"headword":"Begriff","line":"The related expression in … begriffen sein means ‘to be engaged in’ or ‘to be in the process of.’ Begriffen is not an inflected form of the noun Begriff. Searches for examples from this entry also include occurrences of this expression.","links":[["#term-also","also",1]]},
  {"headword":"beleben","line":"Weak verb. Third-person singular present: belebt; past: belebte; past participle: belebt. The perfect is hat belebt; the present participle is belebend. Sich beleben is reflexive. The participles also function as adjectives; the comparative of belebt is belebter. In musical directions, belebend means becoming more animated, belebt means animated or lively, and belebter means more animated.","links":[["#term-also","also",1]]},
  {"headword":"beschleunigen","line":"In a performance direction, it can also suggest “with haste.” A gradual increase in tempo corresponds to accelerando. Nicht beschleunigen means “without speeding up; without rushing.”","links":[["#term-also","also",1]]},
  {"headword":"beschleunigen","line":"The related noun Beschleunigung means ‘acceleration’ or ‘an increase in speed.’ It is not an inflected form of beschleunigen, but searches for examples from this entry also include occurrences of this noun.","links":[["#term-also","also",1]]},
  {"headword":"beschwingt","line":"Past participle of beschwingen; also used as an adjective.","links":[["#term-also","also",1]]},
  {"headword":"beschwingt","line":"② Uplifted, light-hearted, buoyant, full of vitality; also used of light, lively steps or rhythms.","links":[["#term-also","also",1]]},
  {"headword":"betreffen","line":"In betreff (modern spelling: in Betreff) is an expression meaning “with regard to,” not an inflected form of betreffen. Searches for examples from this entry also include occurrences of this expression.","links":[["#term-also","also",1]]},
  {"headword":"Bett","line":"Neuter noun (das Bett). Genitive singular des Betts or des Bettes; nominative plural die Betten; dative plural den Betten. The riverbed sense also has plural Bette.","links":[["#term-also","also",1]]},
  {"headword":"bezeichnen","line":"The related noun Bezeichnung means “designation,” “name,” or “indication,” among other senses; Bezeichnungen is its plural. These are not inflected forms of the verb bezeichnen, but searches for examples from this entry also include these noun forms.","links":[["#term-also","also",1]]},
  {"headword":"Bindebogen","line":"Bindebogen is also used more broadly to include a tie joining notes of the same pitch. Haltebogen means “tie”: the joined notes are played as one note with their durations added together.","links":[["#term-also","also",1]]},
  {"headword":"bisbigliando","line":"The gerundio (a non-finite verb form that can be used adverbially) of Italian bisbigliare, meaning to whisper, speak softly, or whisper in someone's ear. As a direction, it means “in a whispering manner” and can also suggest a soft rustling or murmuring sound, like leaves or water.","links":[["#term-also","also",1]]},
  {"headword":"Blechbläser","line":"Holzbläser means “woodwind player”; in the plural, it can also mean “woodwind instruments” or “the woodwind section.”","links":[["#term-also","also",1]]},
  {"headword":"bleich","line":"Adjective, also used adverbially. Comparative bleicher; superlative am bleichsten; inflected when attributive.","links":[["#term-also","also",1]]},
  {"headword":"Blitz","line":"Masculine noun (der Blitz). Genitive singular des Blitzes; nominative plural die Blitze; dative plural den Blitzen.Blitze can also be a literary dative singular.","links":[["#term-also","also",1]]},
  {"headword":"breit","line":"It is often translated into Japanese as 「幅広く」 (“broadly”), but as that can seem rather unclear, I use 「ゆったりと」 (“unhurriedly”). Its nuance may be close to allargando. However, allargando describes a gradual slowing of the tempo, whereas breit does not necessarily call for such a change. When applied to string playing, “breit gestrichen” means something like “with broad bow strokes”. For breit alone, “with a sense of breadth” may also be suitable. “nicht breit” may also suggest keeping the tempo taut. It may, however, ask a particular part not to broaden its notes or rhythm too much, rather than require a change in the overall tempo.","links":[["#term-also","also",2]]},
  {"headword":"Charakter","line":"② Capacity or title associated with an office or social status (in older usage); also, a role or character in literature or drama.","links":[["#term-also","also",1]]},
  {"headword":"D. H., d. H.","line":"At the end of a footnote, this abbreviation identifies a note by the editor. Depending on context, Herausgeber can also mean “publisher,” but it does not by itself denote someone who combines both roles.","links":[["#term-also","also",1]]},
  {"headword":"dasselbe","line":"There is also a use different from the above. In somewhat older or more formal prose, such as that found in [RW: Oper] and [RS: Oper], dasselbe (“that very thing,” “the aforementioned thing”) may be used instead of es (“it”), to refer back to the object and avoid repeating the noun. This use does not necessarily emphasize the referent.","links":[["#term-also","also",1]]},
  {"headword":"demütig","line":"This comparison describes a relative tendency in connotation: demütig can also express submissiveness or self-abasement, while devot has an older sense meaning “humble”. Bowing the head is not an inherent requirement of demütig itself.","links":[["#term-also","also",1]]},
  {"headword":"Der Klavierauszug dient nur zum Einstudieren und darf nicht für Aufführungen benutzt werden.","line":"(Verified location in the reference score: Hindemith, Konzertmusik für Klavier, Blechbläser, und Harfen Op.49: movement I: bottom footnote; Klavierauszug also staff label)","links":[["#term-also","also",1]]},
  {"headword":"dicht","line":"Adjective, also used adverbially. Comparative dichter; superlative am dichtesten.","links":[["#term-also","also",1]]},
  {"headword":"Diener","line":"Dienerin is the feminine noun corresponding to Diener and denotes a female servant or attendant. Searches for examples from this entry also include occurrences of Dienerin.","links":[["#term-also","also",1]]},
  {"headword":"dient","line":"(Verified location in the reference score: Hindemith, Konzertmusik für Klavier, Blechbläser, und Harfen Op.49: movement I: bottom footnote; Klavierauszug also staff label)","links":[["#term-also","also",1]]},
  {"headword":"dunkel","line":"The related verb dunkeln means ‘to grow dark,’ among other senses, and dunkelt is an inflected form of that verb. By contrast, Dunkeln in im Dunkeln (‘in the dark’) is a nominalized form, not a verb. Searches for examples from this entry also include these usages.","links":[["#term-also","also",1]]},
  {"headword":"dünnen","line":"Historical dictionaries also record a verb dünnen meaning “to thin out or weaken.”","links":[["#term-also","also",1]]},
  {"headword":"durchaus","line":"In musical directions, durchaus and durchweg (also durchwegs) can overlap in the sense of “throughout” or “consistently”.","links":[["#term-also","also",1]]},
  {"headword":"durchaus","line":"Emphasizes degree or thoroughness, as in “absolutely” or “without fail”. It can reinforce determination, a state or a quality, and can also be rendered “throughout” in music.","links":[["#term-also","also",1]]},
  {"headword":"durchweg","line":"In musical directions, durchaus and durchweg (also durchwegs) can overlap in the sense of “throughout” or “consistently”.","links":[["#term-also","also",1]]},
  {"headword":"durchweg","line":"Emphasizes degree or thoroughness, as in “absolutely” or “without fail”. It can reinforce determination, a state or a quality, and can also be rendered “throughout” in music.","links":[["#term-also","also",1]]},
  {"headword":"ebenfalls","line":"① Likewise; similarly; also; as well.","links":[["#term-also","also",1]]},
  {"headword":"Echo","line":"In Richard Strauss’s Ariadne auf Naxos, Echo also occurs as the name of a nymph. In these passages, it refers to the character rather than an echo as a sound phenomenon.","links":[["#term-also","also",1],["#term-echo","echo",1]]},
  {"headword":"eifrig","line":"Adjective, also used adverbially. Comparative eifriger; superlative am eifrigsten.","links":[["#term-also","also",1]]},
  {"headword":"einfach","line":"As an expressive direction, it indicates simplicity or an unadorned manner. In the GM entries, it means “simple” or “plain.” When accompanied by ohne Sentimentalität or ohne Pathos, it also calls for the avoidance of sentimentality or exaggerated emotion.","links":[["#term-also","also",1]]},
  {"headword":"einhalten","line":"In the GM entries, the present participle einhaltend directs the performers to hold back and ease the music’s forward movement, and is translated as “slacken the tempo.” In stage directions, it can also mean to stop playing or pause in an action. The wording and surrounding context show what is to be maintained, what action is to stop, or what movement is to be checked.","links":[["#term-also","also",1],["#term-pause","pause",1]]},
  {"headword":"einhalten","line":"The related noun Einhalt is used in the expressions Einhalt tun and Einhalt gebieten, meaning “to stop” or “to put a check on.” It is not simply an inflected form of einhalten, but searches for examples from this entry also include occurrences of this noun.","links":[["#term-also","also",1]]},
  {"headword":"Einstudiren","line":"(Verified location in the reference score: Hindemith, Konzertmusik für Klavier, Blechbläser, und Harfen Op.49: movement I, footnote at the bottom of the page; Klavierauszug also appears as a staff label)","links":[["#term-also","also",1]]},
  {"headword":"Empfindung","line":"Mit Empfindung means “with feeling” (con sentimento), or “with deeply felt emotion.” In the GM examples, Empfindung is rendered in Japanese with a word meaning “feeling”. In RS, mit Empfindung is also translated as “with feeling”.","links":[["#term-also","also",1]]},
  {"headword":"energisch","line":"Adjective, also used adverbially. Comparative energischer; superlative am energischsten.","links":[["#term-also","also",1]]},
  {"headword":"Entfernung","line":"The related verb entfernen means “to remove,” while the reflexive form sich entfernen means “to move away” or “to leave.” Entfernend is its present participle. These are not inflected forms of the noun Entfernung, but searches for examples from this entry also include these verbal forms.","links":[["#term-also","also",1]]},
  {"headword":"entschlossen","line":"The related noun Entschluss (older spelling Entschluß) means “resolution” or “decision.” It is not simply an inflected form of entschlossen, but searches for examples from this entry also include occurrences of this noun.","links":[["#term-also","also",1]]},
  {"headword":"entstellt","line":"In [RS: Till], it appears as an expressive direction attached to a clarinet phrase. In stage directions, it can also describe a person’s appearance: in Tannhäuser in [RW: Oper], sein Antlitz ist bleich und entstellt is translated as “his face is pale and haggard.”","links":[["#term-also","also",1]]},
  {"headword":"entzückt","line":"The related noun Entzücken means “delight,” “joy,” or “rapture.” It is not simply an inflected form of entzückt, but searches for examples from this entry also include occurrences of this noun.","links":[["#term-also","also",1]]},
  {"headword":"ergriffen","line":"In stage directions, it may also mean “seized” or “captured.”","links":[["#term-also","also",1]]},
  {"headword":"erregt","line":"Depending on the context, it can also suggest agitation tinged with impatience.","links":[["#term-also","also",1]]},
  {"headword":"erreicht","line":"The past participle of “erreichen.” It also has the same form as the present tense in expressions such as “er erreicht” (“he reaches”).","links":[["#term-also","also",1]]},
  {"headword":"ersterbend","line":"In GM, I translate this as “as though dying,” although “fading away” would also work. GM also uses morendo in many passages, alongside ersterbend. Personally, I feel an emotional, introspective nuance in ersterbend, whereas morendo (which also derives from morire, “to die”) suggests “moving towards silence” or “fading away naturally.” I wonder what difference in nuance Mahler himself felt between them.","links":[["#term-also","also",3]]},
  {"headword":"etwas","line":"In performance directions, etwas modifies an adjective or adverb to temper its degree, and is translated as “somewhat,” “a little,” or similar expressions. In stage directions, it can also express a small difference in distance or position.","links":[["#term-also","also",1]]},
  {"headword":"fahren","line":"For stage action, sense ② can be rendered as “to move swiftly.” Zurückfahren means “to recoil,” and fortfahren means “to continue.” Fahren lassen can also mean “to let go” or “to abandon.”","links":[["#term-also","also",1]]},
  {"headword":"Fassung","line":"For a composition, Fassung means a version or draft. It may refer to a revised version of an opera, for example, or a translated version of a vocal text. “A revised version” can be expressed as “revidierte Fassung,” but the context may also allow Fassung alone to refer to a particular revision or draft.","links":[["#term-also","also",1]]},
  {"headword":"ferne","line":"In addition to being a comparative meaning “farther” or an inflected adjective, ferner is also used as an adverb meaning “furthermore” or “in addition.” Searches for examples from this entry also include this adverbial usage.","links":[["#term-also","also",2]]},
  {"headword":"fest","line":"The noun Feste means “fortress” or “stronghold” and is distinct from feste, an inflected form of the adjective fest. Searches for examples from this entry also include occurrences of this identically spelled noun.","links":[["#term-also","also",1]]},
  {"headword":"finster","line":"Adjective, also used adverbially. The comparative is finsterer or finstrer and the superlative am finstersten. Inflected forms include finstere or finstre, finsteres or finstres, and finsterem or finstrem.","links":[["#term-also","also",1]]},
  {"headword":"fließend","line":"In RS's Elektra Op.58, it is also translated here as “blending into one another” in one passage.","links":[["#term-also","also",1]]},
  {"headword":"freudig","line":"Adjective, also used adverbially. The comparative is freudiger and the superlative am freudigsten.","links":[["#term-also","also",1]]},
  {"headword":"freundlich","line":"Adjective, also used adverbially. Comparative freundlicher; superlative am freundlichsten. Freundlichem, freundlichen and freundlicher can be inflected attributive forms.","links":[["#term-also","also",1]]},
  {"headword":"freundlich","line":"② Well-disposed or amicable; also pleasant, cheerful or inviting, as of weather, rooms or colours.","links":[["#term-also","also",1]]},
  {"headword":"furchtbar","line":"The word can also convey strong emphasis. In musical contexts referring to force or intensity, as in mit furchtbarer Gewalt, possible translations include “with tremendous force” or “violently.”","links":[["#term-also","also",1]]},
  {"headword":"galant","line":"At the opening of [RS: Qui], ritterlich und galant can be read as expressing a knightly spirit and an elegant manner. In operatic stage directions, galant also describes courteous treatment of another person or a graceful bow.","links":[["#term-also","also",1]]},
  {"headword":"gänzlich","line":"Adjective, also used adverbially, emphasizing completeness.","links":[["#term-also","also",1]]},
  {"headword":"Gasse","line":"① A narrow street or alley between buildings; also a passage opened between people or other obstacles.","links":[["#term-also","also",1]]},
  {"headword":"gebunden","line":"When referring to notes joined by a slur, it may also be translated as “slurred.”","links":[["#term-also","also",1]]},
  {"headword":"gedehnt","line":"In GM, it is translated here as “stretched out.” Depending on the context, it may approach allargando or largamente. The German verbreitern may also be similar.","links":[["#term-also","also",1]]},
  {"headword":"gefühlvoll","line":"The related noun Gefühl also occurs in GM.","links":[["#term-also","also",1]]},
  {"headword":"gehalten","line":"The comparative form gehaltener also conveys the sense of “more” or “even more.”","links":[["#term-also","also",1]]},
  {"headword":"gemässigt","line":"Past participle of mäßigen. Also written gemäßigt; Swiss spelling uses ss in place of ß.","links":[["#term-also","Also",1]]},
  {"headword":"gemässigt","line":"In GM, it is translated here as “calmly,” but “with restraint” may also be appropriate.","links":[["#term-also","also",1]]},
  {"headword":"Genehmigung","line":"① Permission, approval, authorisation, consent; also used for permission to publish or perform, and for consent in copyright notices.","links":[["#term-also","also",1]]},
  {"headword":"gesellen","line":"③ Gesellen can also mean companions or fellows.","links":[["#term-also","also",1]]},
  {"headword":"gesellen","line":"English: As soon as the night watchman’s horn sounds (3/4 time), the women pour strong streams of water from jugs, pitchers and basins out of all the windows onto those fighting below. This, together with the particularly powerful sound of the horn, strikes everyone with panic. Neighbours, apprentices, craftsmen and masters flee in haste in all directions, so that the stage is very soon completely empty. The house doors are hurriedly shut; the female neighbours also disappear from the windows, slamming them shut.","links":[["#term-also","also",1]]},
  {"headword":"gestoßen","line":"The degree of separation and emphasis depends on the instrument and the surrounding directions. The passage above also carries the marking p marcato. Strong articulation does not necessarily mean a loud dynamic.","links":[["#term-also","also",1]]},
  {"headword":"gestrichen","line":"The word can also refer to octave notation. The prime sign (′) placed to the upper right of a note name is called a Strich (stroke); the number of these strokes indicates which octave the note belongs to. For example, dreimal gestrichenes C means “three-line C”.","links":[["#term-also","also",1]]},
  {"headword":"gestrichen","line":"There are also examples such as breit gestrichen, kurz gestrichen, and lang gestrichen that describe the breadth or length of the bow stroke. For example, breit gestrichen is translated here as “With broad bow strokes” and kurz gestrichen as “With short bow strokes”.","links":[["#term-also","also",1]]},
  {"headword":"gewirbelt","line":"In the GM example at bar 860 of SYMPHONIE III, movement I, this means rolling a cymbal (with a sponge-headed mallet). Mit Schwammschlägel specifies the mallet; gewirbelt itself does not prescribe timpani mallets. In practice, suspended-cymbal mallets rather than timpani mallets also seem to be used.","links":[["#term-also","also",1]]},
  {"headword":"geziert","line":"Past participle of zieren, also used as an adjective.","links":[["#term-also","also",1]]},
  {"headword":"gleichfalls","line":"① Likewise, in the same way, also, or too.","links":[["#term-also","also",1]]},
  {"headword":"gleichfalls","line":"English: Mandryka also stands up.","links":[["#term-also","also",1]]},
  {"headword":"gleichzeitig","line":"② Less commonly, also or in addition.","links":[["#term-also","also",1]]},
  {"headword":"grell","line":"In GM, it is translated as “stridently”, “shrilly”, and similar expressions. For instructions concerning the voice in RW and RS, “in a shrieking voice” may also be suitable.","links":[["#term-also","also",1]]},
  {"headword":"groß","line":"It has many meanings and is difficult to translate. In GM, mit großem Ton and similar expressions are translated as “with a full tone”. “With a grand tone” or “with a powerful sound” might also be suitable.","links":[["#term-also","also",1]]},
  {"headword":"Grund","line":"It also appears to have the meaning “root (in harmony).” Ralph Dunstan’s music dictionary defines Grund as a “fundamental note, generator,” among other meanings.","links":[["#term-also","also",1]]},
  {"headword":"halbe","line":"Half; partial; incomplete. eine halbe Stunde means “half an hour”; the noun denoting the thing halved can also be omitted.","links":[["#term-also","also",1]]},
  {"headword":"halblaut","line":"It can describe lowering the voice out of consideration for others. In singing or speech, suitable renderings include “at half voice” and “with the voice lowered”. a mezza voce is a corresponding expression; sotto voce is also close in its sense of a low or subdued delivery.","links":[["#term-also","also",1]]},
  {"headword":"Haltebogen","line":"Bindebogen generally means “slur”, but is also used more broadly to include a tie joining notes of the same pitch.","links":[["#term-also","also",1]]},
  {"headword":"hastig","line":"Adjective, also used adverbially. Comparative hastiger; superlative am hastigsten.","links":[["#term-also","also",1]]},
  {"headword":"Hauptzeitmaß","line":"In GM, it can be used to indicate a return to the principal tempo of the movement or section after changes of tempo within the music. Depending on the context, it can also refer to the basic tempo in contrast to local changes of speed, rather than necessarily to the tempo at the very beginning.","links":[["#term-also","also",1]]},
  {"headword":"Haushofmeister","line":"The following is a guide to servants, attendants, and domestic workers in RS’s Der Rosenkavalier Op.59. Even the same terms—Diener, Lakai, and Livree—can have substantially different functions depending on whose household they belong to. It is therefore useful to distinguish the Marschallin’s household, Faninal’s household, Baron Ochs’s entourage, and the inn staff. Octavian’s own attendants, who appear in Act II, must also be distinguished. Since differentiating every term in translation would become extremely cumbersome, some are grouped together on the search page.","links":[["#term-also","also",1]]},
  {"headword":"Haushofmeister","line":"The group of footmen serving in the Marschallin’s residence. In Act I, they try to prevent Baron Ochs from forcing his way in and guard the boundary between the bedroom and the antechamber. During the morning reception, they also open and close doors, move furniture, organize visitors, and coordinate the movements of the Friseur, Sänger, and others.","links":[["#term-also","also",1]]},
  {"headword":"Haushofmeister","line":"【Rank: middle to lower / servants in a great aristocratic residence】They belong to a separate organization from servants of the Faninal household and Baron Ochs’s attendants. They show that the Marschallin’s residence, although the setting is her private bedroom, is also a highly organized aristocratic space.","links":[["#term-also","also",1]]},
  {"headword":"Haushofmeister","line":"A lower-ranking footman in a residence. Responsible for miscellaneous duties such as opening and closing doors, showing visitors in, and running errands; he is often also stationed for ceremonial purposes or visual effect.","links":[["#term-also","also",1]]},
  {"headword":"Haushofmeister","line":"【Rank: special (low)】He carries the case for the silver rose, accompanies the Baron to his secret rendezvous at the inn, and tries to clear a path for the Baron’s departure near the end. He is also implied to be the Baron’s illegitimate son and visually conveys the private, disorderly domestic arrangements of the Lerchenau household.","links":[["#term-also","also",1]]},
  {"headword":"Heiligen","line":"Example searches from this entry also include uses of the related adjective heilig (“holy”).","links":[["#term-also","also",1]]},
  {"headword":"hell","line":"Adjective, also used adverbially. Comparative heller; superlative am hellsten.","links":[["#term-also","also",1]]},
  {"headword":"herbei","line":"Adverb, also used as a separable particle with verbs of movement.","links":[["#term-also","also",1]]},
  {"headword":"Herd","line":"Masculine noun (der Herd). Genitive singular des Herdes / des Herds; nominative plural die Herde; dative plural den Herden.Herde can also be a literary dative singular. The feminine noun Herde (herd or flock) is a different word.","links":[["#term-also","also",1],["#term-herd","herd",1]]},
  {"headword":"hervortretend","line":"In performance directions, it describes bringing a line, especially a melody, into relief or to the fore. In GM, it is translated as “bring out”. In stage directions in [RW: Oper], [RS: Oper], and similar sources, it can also mean “stepping forward into the foreground of the stage”.","links":[["#term-also","also",1]]},
  {"headword":"Hess","line":"The Hess catalogue was not compiled simply to classify works without opus numbers. It catalogues works and materials omitted from the old Beethoven complete edition published by Breitkopf & Härtel in the nineteenth century. It therefore includes not only independent, completed works but also first versions, alternative versions, arrangements and reworkings, unfinished works, fragments, sketches, and composition exercises. Hess numbers can also be assigned to alternative versions or arrangements of works that have opus or WoO numbers, so the Hess, Op., and WoO systems are not mutually exclusive.","links":[["#term-also","also",2]]},
  {"headword":"Hess","line":"Whereas WoO numbers are used to classify works without opus numbers, Hess numbers are supplementary catalogue numbers for works and creative materials omitted from the old complete edition. The two catalogues have different inclusion criteria, and neither simply contains the other. The Hess catalogue includes completed works as well as alternative versions, arrangements and reworkings, unfinished works, fragments, sketches, and composition exercises; WoO also includes unfinished works.","links":[["#term-also","also",1]]},
  {"headword":"Himmel","line":"③ A canopy of fabric or similar material; also a vehicle’s roof lining.","links":[["#term-also","also",1]]},
  {"headword":"hinab","line":"Directional adverb, invariable, with no normal comparative or superlative. Also used as a separable verbal prefix, often more literary than hinunter.","links":[["#term-also","Also",1]]},
  {"headword":"Hob.","line":"An abbreviation for the catalogue of Joseph Haydn's works (Hoboken-Verzeichnis) compiled by the Dutch musicologist Anthony van Hoboken. Works are classified by genre and identified by a Roman-numeral group number followed by a number within that group. For example, Symphony No. 100 in G major is Hob. I:100. An overview of groups I–XXXI is given below; subsidiary categories such as Ia are omitted. There is also a group XXXII for pasticcios (works assembled from pre-existing pieces).","links":[["#term-also","also",1]]},
  {"headword":"horcht","line":"Third-person singular present of horchen; the same form also serves as the second-person plural present and imperative.","links":[["#term-also","also",1]]},
  {"headword":"immer","line":"In GM, immer can indicate continuation of an earlier manner of playing or an existing state, as in “Immer ff” (“Continue ff.”) and “immer am Steg” (“Continue playing near the bridge.”). The term is also frequently used with a comparative in sense ②.","links":[["#term-also","also",1]]},
  {"headword":"intensiv","line":"When describing tone colour, it can also be rendered as “with an intense tone colour”.","links":[["#term-also","also",1]]},
  {"headword":"kläglich","line":"① Arousing pity; pitiable, distressing, or lamentable. Also plaintive or expressing helpless distress or fear.","links":[["#term-also","Also",1]]},
  {"headword":"Klavierauszug","line":"(Verified location in the reference score: Hindemith, Konzertmusik für Klavier, Blechbläser, und Harfen Op.49: movement I: bottom footnote; Klavierauszug also staff label)","links":[["#term-also","also",1]]},
  {"headword":"kleiner Neger","line":"A related musical work is Claude Debussy’s Golliwogg’s Cake-walk. It is the sixth piece in the suite Children’s Corner, and the Golliwogg in its title refers to a rag doll caricaturing a Black person. The figure became widely known through a picture book published in 1895 and illustrated by Florence Kate Upton, and was also popular as a children’s toy. Its features, including its black face, large eyes and exaggerated lips, are connected with the imagery of contemporary minstrel shows, in which performers blackened their faces to portray Black people, and embody racial stereotypes.","links":[["#term-also","also",1]]},
  {"headword":"kleiner Neger","line":"The cakewalk is a dance that developed among enslaved Black people in America. One aspect of it involved imitating and satirizing the affected gestures and dances of the white upper classes. Its name derives from the practice of awarding a cake to the winner of a dance competition. It later spread through Europe and America as a form of stage entertainment and was also incorporated into Debussy’s music. In Golliwogg’s Cake-walk, both the dance and the doll bring together the reception of Black culture and representations of Black people at the time.","links":[["#term-also","also",1]]},
  {"headword":"kleiner Neger","line":"Debussy also composed a separate short piano piece using cakewalk rhythms, Le petit nègre (the little Black person).","links":[["#term-also","also",1]]},
  {"headword":"Klöppel","line":"In the Glockenspiel part in the first movement of Mahler's SYMPHONIE VII, the instruction \"mit Klöppeln\" appears and is translated there as “with mallets”. From a modern perspective, however, playing the Glockenspiel “with mallets” is a matter of course. Yet the “keyboard glockenspiel (Tastenglockenspiel)” was also in use in GM's time, and it is highly likely that SYMPHONIE VII likewise presupposes a keyboard glockenspiel (for example, the aria No.20 in Mozart's “The Magic Flute” (Bärenreiter p.258) bears the designation \"Strumento d'acciaio (Glockenspiel)\" (“instrument of steel”) and contains many multiple-note combinations and rapid passages, making it highly likely that a keyboard glockenspiel was intended). In that light, an instruction to play with “mallets” rather than a “keyboard” makes sense.","links":[["#term-also","also",1]]},
  {"headword":"Knabe","line":"Masculine noun (der Knabe). Genitive singular des Knaben; nominative plural die Knaben; dative plural den Knaben. A weak noun; the accusative and dative singular are also Knaben.","links":[["#term-also","also",1]]},
  {"headword":"Knie","line":"Neuter noun (das Knie). Genitive singular des Knies; nominative plural die Knie; dative plural den Knien. The corpus also uses the older plural spellings Kniee and Knieen.","links":[["#term-also","also",1]]},
  {"headword":"kurz","line":"As an articulation instruction, it can also be rendered “somewhat staccato”.","links":[["#term-also","also",1]]},
  {"headword":"Lager","line":"Neuter noun (das Lager). Genitive singular des Lagers; nominative plural die Lager; dative plural den Lagern. In commercial usage, Läger is also used for warehouses or stocks.","links":[["#term-also","also",1]]},
  {"headword":"Lager","line":"④ A warehouse, stock, or warehouse staff; also short for lager beer.","links":[["#term-also","also",1],["#term-stoecken","stock",1],["#term-lager","lager",1]]},
  {"headword":"langsam","line":"In GM, it is mostly used in sense ① and rendered as “slowly”. There are also examples of sense ③, such as “Langsam steigern!” (“Build up slowly!”) in the fourth movement of SYMPHONIE I.","links":[["#term-also","also",1]]},
  {"headword":"lautlos","line":"Adjective, also used adverbially; attributive forms include lautlosen.","links":[["#term-also","also",1]]},
  {"headword":"lebhaft","line":"It may also be close to “allegro”.","links":[["#term-also","also",1]]},
  {"headword":"leise","line":"In GM, leise is rendered as “quietly”. Depending on context, “with restraint” might also be appropriate.","links":[["#term-also","also",1]]},
  {"headword":"m.d.","line":"The spaced form “m. d.” is also used.","links":[["#term-also","also",1]]},
  {"headword":"m.Dpf.","line":"The spaced form “m. Dpf.” is also used.","links":[["#term-also","also",1]]},
  {"headword":"m.s.","line":"The spaced form “m. s.” is also used.","links":[["#term-also","also",1]]},
  {"headword":"markig","line":"In GM it is rendered with expressions such as “with weight” and “forcefully”, though “firmly”, “with a rugged quality”, “with a firm core to the sound”, or “with robust strength” may also be suitable.","links":[["#term-also","also",1]]},
  {"headword":"mäßig","line":"Besides the meanings “moderate” and “at a moderate speed” (approximately moderato), the related verb “mäßigen” means to restrain, subdue, or exercise moderation, which can make the choice of translation difficult. In GM, the tempo indication “Mässig” is rendered as “Calmly (at a moderate tempo).” Depending on context, “with self-restraint”, “holding back”, or “with restraint” may suit other uses. The suffix “-mäßig” also means “-like”, “in the style of”, “having the character of”, or “suited to”.","links":[["#term-also","also",1]]},
  {"headword":"mäßigen","line":"In GM, “Sich mäßigend” is rendered as “Holding back (the tempo).” Depending on the context, “mäßigen” can also be an inflected form of the adjective “mäßig”.","links":[["#term-also","also",1]]},
  {"headword":"Meer","line":"Neuter noun (das Meer). Genitive singular des Meers or des Meeres; nominative plural die Meere; dative plural den Meeren. Meere is also an older dative singular.","links":[["#term-also","also",1]]},
  {"headword":"mehrfach","line":"In GM, “mehrfach besetzt” is rendered as “With several players.” It can also be paraphrased as “with multiple players assigned”.","links":[["#term-also","also",1]]},
  {"headword":"Mund","line":"Masculine noun (der Mund). Genitive singular des Munds or des Mundes; plural die Münder, dative den Mündern; rare plurals Munde or Münde. Munde also occurs as an older dative singular.","links":[["#term-also","also",1]]},
  {"headword":"Nachahmung","line":"The related verb nachahmen means “to imitate” or “to mimic”; nachahmend is its present participle. Example searches from this entry also include uses of these verb forms.","links":[["#term-also","also",1]]},
  {"headword":"NB Die erste Trompete Kann im Notfalle auch die unteren Noten nehmen.","line":"N.B. If necessary, trumpet 1 may also play the lower notes (in small print).","links":[["#term-also","also",1]]},
  {"headword":"noch immer","line":"“Immer noch” is also used with the same meaning.","links":[["#term-also","also",1]]},
  {"headword":"ohnmächtig","line":"“Weakly (as though scarcely able to breathe)” and “unable to resist (one’s emotions, for example)” describe different states, but both relate to a loss of strength or agency. However, “ohnmächtig” alone does not mean “intensely”. In RW there are descriptions close to sense ①, while RS also has uses corresponding to sense ②.","links":[["#term-also","also",1]]},
  {"headword":"pastos","line":"① Paste-like, pasty, or viscous (of paint, for example); also, thickly applied (of paint).","links":[["#term-also","also",1]]},
  {"headword":"pompös","line":"In [RS: Oper], the word is used in sense ②. [RS: Bur] also contains the Italian direction “pomposo”. This probably has sense ② as well.","links":[["#term-also","also",1]]},
  {"headword":"Potpourri","line":"RS’s “Die schweigsame Frau Op.80” also opens with a “Potpourri”.","links":[["#term-also","also",1]]},
  {"headword":"Quelle","line":"The related masculine noun Quell also means “spring” or “source”. It is not simply an inflected form of the feminine noun Quelle, but example searches from this entry also include uses of Quell.","links":[["#term-also","also",2]]},
  {"headword":"quer","line":"Adverb; also used, less commonly, as an adjective.","links":[["#term-also","also",1]]},
  {"headword":"regungslos","line":"Adjective, also used adverbially. Attributive forms include regungslose and regungsloser.","links":[["#term-also","also",1]]},
  {"headword":"Ring","line":"Masculine noun (der Ring). Genitive singular des Rings / des Ringes; nominative plural die Ringe; dative plural den Ringen. Ringe may also be an old dative singular.","links":[["#term-also","also",1]]},
  {"headword":"sämtlich","line":"English: Note: all the envoys may also be represented solely by extras.","links":[["#term-also","also",1]]},
  {"headword":"sanft","line":"In GM, sanft is rendered as “gently”, while mäßig as a tempo indication is rendered as “calmly (at a moderate tempo)”. In RW and RS, sanft can also describe gentle physical actions in stage directions. The meanings of sanft, weich, and zart overlap, so the choice of rendering depends on context.","links":[["#term-also","also",1]]},
  {"headword":"Schalltrichter","line":"The bell is also called Schallbecher. No occurrence of Schallbecher has been found in the GM material under investigation, although the word does occur in other score material. In the [RW: Oper] material examined here, Schalltrichter occurs only in Tristan und Isolde WWV 90.","links":[["#term-also","also",1]]},
  {"headword":"schaudernd","line":"The related noun Schauder means “a shudder” or “a feeling of dread”. Example searches from this entry also include uses of this noun.","links":[["#term-also","also",1]]},
  {"headword":"schäumend","line":"Expressive renderings include “raging” and “with tremendous force”. In RS, schäumend is rendered as “In a rage.” in sense ②. RW also has “vor Wuth schäumend”, rendered as “foaming with rage”.","links":[["#term-also","also",1]]},
  {"headword":"scheu","line":"Adjective, also used adverbially. Comparative scheuer; superlative am scheuesten.","links":[["#term-also","also",1]]},
  {"headword":"Schild","line":"Masculine noun (der Schild). The genitive singular is des Schilds or des Schildes, the nominative plural die Schilde, and the dative plural den Schilden. Schilde can also be an older dative singular. Distinguish the neuter das Schild, meaning a sign, whose plural is die Schilder.","links":[["#term-also","also",1]]},
  {"headword":"Schlag","line":"The related verb schlagen means “to hit” or “to strike”, among other senses; schlägt is one of its present-tense forms. Example searches from this entry also include uses of these verb forms.","links":[["#term-also","also",1]]},
  {"headword":"schmeicheln","line":"In the dated reflexive use “sich schmeicheln”, the verb can also mean “to flatter oneself”.","links":[["#term-also","also",1]]},
  {"headword":"schmerzlich","line":"Adjective, also used adverbially. Comparative schmerzlicher; superlative am schmerzlichsten.","links":[["#term-also","also",1]]},
  {"headword":"schmetternd","line":"“Brilliantly” is also an expressive musical rendering.","links":[["#term-also","also",1]]},
  {"headword":"schmetternd","line":"In GM, schmetternd is rendered as “resoundingly”, or “ringingly” in a phrase such as “schnell und schmetternd wie eine Fanfare” (“Quickly and ringingly, like a fanfare.”). “Blaringly” may also suit some contexts.","links":[["#term-also","also",1]]},
  {"headword":"schnell","line":"schnellen can be an inflected form of the adjective schnell, but it is also a verb meaning “to dart” or “to spring”, among other senses. Example searches from this entry also include uses of the identically spelled verb.","links":[["#term-also","also",2]]},
  {"headword":"schon","line":"With a following “aber”, it can also mean “admittedly …, but …”.","links":[["#term-also","also",1]]},
  {"headword":"Schwung","line":"② Vitality; energy; vigour. In expressions such as “in Schwung sein”, also high spirits.","links":[["#term-also","also",1]]},
  {"headword":"Schwung","line":"In the GM entries, “mit Schwung” is rendered as “With spirit.”, “schwungvoll” as “full of life”, and “Mit Aufschwung” as “With uplift.” “Lively” may also suit schwungvoll in some contexts.","links":[["#term-also","also",1]]},
  {"headword":"sehr","line":"Very; greatly; extremely; very much. Intensifies adjectives and adverbs, and also indicates a high degree with verbs.","links":[["#term-also","also",1]]},
  {"headword":"Seil","line":"Neuter noun (das Seil). Genitive singular des Seils or des Seiles; nominative plural die Seile; dative plural den Seilen. Seile can also be an older dative singular.","links":[["#term-also","also",1]]},
  {"headword":"seitwärts","line":"Invariable adverb; also a literary preposition governing the genitive.","links":[["#term-also","also",1]]},
  {"headword":"sichtbar","line":"Adjective, also used adverbially. Comparative sichtbarer; superlative am sichtbarsten. Inflected forms include sichtbare and sichtbaren.","links":[["#term-also","also",1]]},
  {"headword":"Speer","line":"Masculine noun (der Speer). Genitive singular des Speers / des Speeres; nominative plural die Speere; dative plural den Speeren. Speere may also be an old dative singular.","links":[["#term-also","also",1]]},
  {"headword":"Sprachrohr","line":"● In Der fliegende Holländer WWV 63, the Steuermann is directed to put the Sprachrohr quickly to his mouth and call out over the side of the ship. Elsewhere in the same work, there is also a direction to call out with both hands held to the mouth.","links":[["#term-also","also",1]]},
  {"headword":"Sprachrohr","line":"● For Fafner in Siegfried WWV 86C, Wagner himself gives the direction “durch ein starkes Sprachrohr” (“through a powerful speaking trumpet”). In a later scene, there is also a direction to sing from an opening in the stage floor through a Sprachrohr led to the monster’s mouth from inside. These directions specify the device or route through which the voice passes; specific changes in pitch or timbre need to be considered in light of production documentation and other relevant materials.","links":[["#term-also","also",1]]},
  {"headword":"starr","line":"Adjective, also used adverbially. Comparative starrer; superlative am starrsten.","links":[["#term-also","also",1]]},
  {"headword":"steigern","line":"The word can encompass heightening emotion, quickening the tempo, increasing the volume, or building up the music as a whole. In GM, steigernd is rendered as “with increasing intensity (of feeling, etc.)”; related phrases use “building up” or refer to a quickening of the tempo. In RW and RS, “with increasing intensity” and “with increasing emotional intensity” also occur. The choice needs to be made according to context.","links":[["#term-also","also",1]]},
  {"headword":"Stöcken","line":"② The homonym Stock also means a storey of a building, but its usual plural is Stock or Stockwerke.","links":[["#term-also","also",1]]},
  {"headword":"Straße","line":"② By extension, the residents of a street; also a strait in geography or a sequence of cards or dice.","links":[["#term-also","also",1]]},
  {"headword":"streichelt","line":"The third-person singular present form of “streicheln”. Depending on context, it can also be the second-person plural present or the second-person plural imperative.","links":[["#term-also","also",1]]},
  {"headword":"Stuhl","line":"Masculine noun (der Stuhl). Genitive singular des Stuhles / des Stuhls; nominative plural die Stühle; dative plural den Stühlen.Stuhle is also a literary dative singular.","links":[["#term-also","also",1]]},
  {"headword":"stumm","line":"Adjective, also used adverbially. Comparative stummer; superlative am stummsten.","links":[["#term-also","also",1]]},
  {"headword":"stürmisch","line":"Adjective; comparative stürmischer, superlative am stürmischsten. Also used adverbially.","links":[["#term-also","Also",1]]},
  {"headword":"Takt","line":"“Schlag” can also mean a beat. From its sense of a blow or stroke, it refers in music to an individual beat or conducting stroke. The expression “in one beat (one conducting beat to a bar)” is “In einem Schlag”; it describes the action of giving one conducting beat per bar.","links":[["#term-also","also",1]]},
  {"headword":"thätig","line":"In older German writings and scores, such as those of J. S. Bach, the word may also refer to an instrument’s stops or mechanisms being “in operation (switched on).” In Mahler’s SYMPHONIE II, “1. 2. 3. 4. Horn in F in der Ferne; sind an den in der Partitur bemerkten Stellen mit im Orch. thätig.” describes a rule governing placement: “Horns 1, 2, 3 and 4 in F are placed in the distance, but at the passages indicated in the score, they also take part in the main orchestra’s performance.”","links":[["#term-also","also",2],["#term-bache","Bach",1]]},
  {"headword":"Tisch","line":"Masculine noun (der Tisch). Genitive singular des Tischs / des Tisches; nominative plural die Tische; dative plural den Tischen. Tische may also be an old dative singular.","links":[["#term-also","also",1]]},
  {"headword":"tobend","line":"When describing force or impetus, it may also be rendered “with tremendous force”.","links":[["#term-also","also",1]]},
  {"headword":"Transposition","line":"In RS's Die Liebe der Danae Op.83, the score contains six numbered transposition directions. These concern the vocal passages of Jupiter (baritone), Danae (soprano) and Midas (tenor). RS himself is reported to have agreed “quite reluctantly” to transpositions intended to accommodate Jupiter's high tessitura. There have also been performances in which the role of Jupiter was sung in the original key. In performance, besides deciding uniformly for the entire work whether or not to transpose, another possible approach is to make that choice for each Transposition passage according to the singers' vocal ranges. The specific treatment needs to be understood in light of the documentation for each individual production.","links":[["#term-also","also",1],["#term-transposition","transposition",1]]},
  {"headword":"treibend","line":"In music, it conveys an urgent, forward-driving impetus. Where a change of speed is intended, it may also be rendered “quickening the pace”. At the opening of No. 6 of Karg-Elert's 30 Capricen für Flöte solo Op.107, Appassionato e stretto appears alongside Leidenschaftlich, treibend (rasche ganze Takte.).","links":[["#term-also","also",1]]},
  {"headword":"Trommelst., Trommelstöcken","line":"(Verified location in the reference score: Hindemith, Symphonie in Es für großes Orchester: Movement I: mit Trommelst. at rehearsal 4 on printed p. 8; mit Trommelstöcken also appears at the first bar of printed p. 5.)","links":[["#term-also","also",1]]},
  {"headword":"trotzig","line":"Where it expresses a firm resolve to resist, it may also be rendered “resolutely”. In the GM entries, the only recorded occurrence is in the third movement of SYMPHONIE IX.","links":[["#term-also","also",1]]},
  {"headword":"TrV","line":"AV also arranges works chronologically within groups separated by opus-number status and other categories; TrV places compositions in chronological order across those divisions.","links":[["#term-also","also",1]]},
  {"headword":"TrV","line":"Building on earlier research, this catalogue arranges the works broadly in order of composition, including early works and fragments. Its chronological arrangement surveys Strauss’s output from his early to his late years, making it useful for tracing his creative development and identifying the dates of works. TrV is also used to identify works in Richard Strauss Werke. Kritische Ausgabe and has been adopted as a standard work-number system in library cataloguing.","links":[["#term-also","also",1]]},
  {"headword":"übergehen","line":"Sfumare is an approximate equivalent where the transition also involves a gradual fading of the sound; it does not apply to every direction to move into something else.","links":[["#term-also","also",1]]},
  {"headword":"übernehmen","line":"In GM, “übernimmt” (third-person singular present indicative) can describe switching instruments or taking over another part: “4. Fl. übernimmt 2te kl. Flöte” is rendered as “Flute 4 switches to piccolo 2.” The past participle “übernommen” can describe a role or passage being taken by another performer, as in “Alto voice (may also, if appropriate, be taken by a baritone).” In RW, “die Wacht übernommen” means “taken over the watch”. RS also uses the verb for receiving objects, as when medicines and water are taken by Sophie through a gap in the door.","links":[["#term-also","also",2]]},
  {"headword":"überrascht","line":"Adjective derived from the past participle of überraschen, also used adverbially. Distinguish the identical present-tense verb form.","links":[["#term-also","also",1]]},
  {"headword":"ungeheuer","line":"The noun Ungeheuer means “monster”; Ungeheuers is its genitive form. Example searches from this entry also include uses of the related noun.","links":[["#term-also","also",1]]},
  {"headword":"ungestüm","line":"Adjective; comparative ungestümer, superlative am ungestümsten. Also used adverbially. Distinguish the noun das Ungestüm.","links":[["#term-also","Also",1]]},
  {"headword":"unverwandt","line":"Adjective, also used adverbially.","links":[["#term-also","also",1]]},
  {"headword":"vehemenz","line":"Mahler’s SYMPHONIE V uses the noun Vehemenz at the opening of the second movement, rendered as “With the utmost vehemence.” Directions to the violins in the first and second movements also use the adjective vehement. “Geigen so vehement als möglich!” in the Peters score (plate 8951, page 49) is an example of the latter.","links":[["#term-also","also",1]]},
  {"headword":"verbergen","line":"Strong verb: third-person singular verbirgt, past verbarg, past participle verborgen; perfect hat verborgen. Also used reflexively as sich verbergen.","links":[["#term-also","Also",1]]},
  {"headword":"vergnügt","line":"Adjective, also used adverbially; identical in form to the past participle of vergnügen.","links":[["#term-also","also",1]]},
  {"headword":"Verlangsamen","line":"Infinitive of verlangsamen; also used as a nominalized infinitive.","links":[["#term-also","also",1]]},
  {"headword":"verlegen","line":"Adjective, also used adverbially. Comparative verlegener; superlative am verlegensten.","links":[["#term-also","also",1]]},
  {"headword":"verlöschen","line":"The form “verlöscht” also occurs in RW.","links":[["#term-also","also",1]]},
  {"headword":"verschwinden","line":"① To disappear, pass out of sight, vanish or cease to be present; also rendered “as if vanishing from sight”.","links":[["#term-also","also",1]]},
  {"headword":"verschwinden","line":"② To fade away or disappear, as of feelings or sound; of sound, also “dying away” or “for the sound to cease”.","links":[["#term-also","also",1]]},
  {"headword":"versucht","line":"Past participle or third-person singular present form of versuchen; also the second-person plural present form or plural imperative.","links":[["#term-also","also",1]]},
  {"headword":"verweht","line":"① Blown or swept away by the wind; covered by windblown sand or snow. Also rendered “as if blown away by the wind”.","links":[["#term-also","Also",1]]},
  {"headword":"verweht","line":"② Faded, dispersed or effaced, as of tracks, memories or sounds; of sound, also “fading faintly away”, “as if fading into the distance” or “indistinctly”.","links":[["#term-also","also",1]]},
  {"headword":"vor sich","line":"An action may be expressed “outwardly” (including self-directed speech or a low voice), but the phrase need not involve speaking: it can also describe silent reflection or looking ahead.","links":[["#term-also","also",1]]},
  {"headword":"vorwärts","line":"In Mahler, if “vorwärts” follows “ritardando,” it may be understood as asking the performer to restore the tempo and regain the flow. “With forward motion” or “with renewed impetus” may also be suitable.","links":[["#term-also","also",1]]},
  {"headword":"Wein","line":"Masculine noun (der Wein). Genitive singular des Weins or des Weines; nominative plural die Weine; dative plural den Weinen. Weine also occurs as an older dative singular.","links":[["#term-also","also",1]]},
  {"headword":"weinerlich","line":"The piano/vocal score of “Trost im Unglück”, however, also contains this phrase.","links":[["#term-also","also",1]]},
  {"headword":"weit","line":"In GM, the uninflected word “weit” occurs only in the first movement of SYMPHONIE IX, where “so weit … als nötig” is translated as “as much as necessary.” Inflected forms such as “weiter” and “weitester” also occur in other works.","links":[["#term-also","also",1]]},
  {"headword":"WoO","line":"For Robert Schumann, WoO numbers were also used in the earlier catalogue by Kurt Hofmann and Siegmar Keil. However, the principal modern scholarly catalogue, Robert Schumann: Thematisch-Bibliographisches Werkverzeichnis, edited by Margit L. McCorkle and commonly known as the Robert-Schumann-Werkverzeichnis (RSW, 2003), assigns WoO 1–8 to works without opus numbers that Schumann published or prepared for publication, while other fragments, unpublished works, projects and similar materials are classified chiefly in the Anhang (appendix).","links":[["#term-also","also",1]]},
  {"headword":"WoO","line":"WoO numbers are also sometimes used for certain works by Felix Mendelssohn Bartholdy in older scores and recording documentation. However, the current standard catalogue, the Mendelssohn-Werkverzeichnis (MWV, 2009), uses its own genre-based numbering system, such as MWV U 136, rather than WoO as its principal formal classification.","links":[["#term-also","also",1]]},
  {"headword":"Wort","line":"Neuter noun (das Wort). Genitive singular des Worts/des Wortes. Wörter usually counts separate words; Worte usually refers to connected utterances or meaningful expressions. Dative plurals are Wörtern and Worten. Worte can also be an old dative singular.","links":[["#term-also","also",1]]},
  {"headword":"wuchtig","line":"② Powerful, forceful or vigorous; also rendered “with a powerful impact” or “with immense force”.","links":[["#term-also","also",1]]},
  {"headword":"Wut","line":"① Intense anger, rage or indignation; also rendered “with furious anger” or “raging”.","links":[["#term-also","also",1]]},
  {"headword":"zaghaft","line":"③ Indecisive in taking action; also rendered “with uncertainty”.","links":[["#term-also","also",1]]},
  {"headword":"zart","line":"In GM, zart is rendered as “delicately” and weich as “softly”, reflecting their combination in zart und weich in movement VI, bar 245 of DAS LIED VON DER ERDE. Depending on context, “tenderly” may also suit zart, while “gracefully” is possible where gracefulness is intended. The meanings of sanft, weich and zart overlap and require choices according to context.","links":[["#term-also","also",1]]},
  {"headword":"Zeit lassen","line":"① In sich Zeit lassen, to take one's time, not to hurry or to proceed at leisure; also rendered “allow plenty of time” or “at leisure”.","links":[["#term-also","also",1]]},
  {"headword":"ziemlich","line":"English: Note: The stage band must be placed at a considerable distance from the stage here. Nevertheless, the individual entries must be played very loudly, to create the effect of the din of battle being carried over in intermittent gusts of wind. Each entry must therefore also be accompanied by gusting-wind sound effects.","links":[["#term-also","also",1]]},
  {"headword":"zischend","line":"Depending on the operatic context, “in a sharp whisper,” “spitting the words out,” or “with a sharply rasping voice” may also work.","links":[["#term-also","also",1]]},
  {"headword":"Zorn","line":"In Wagner’s Die Meistersinger von Nürnberg, Zorn also occurs as a character’s name. In these passages, it is a proper name rather than the common noun meaning “anger”.","links":[["#term-also","also",1]]},
  {"headword":"Zug","line":"Both RW and RS contain examples of sense ④. In musical contexts, the word can also denote:","links":[["#term-also","also",1]]},
  {"headword":"zugleich","line":"② Also; equally or at the same time in another respect.","links":[["#term-also","Also",1]]},
  {"headword":"Zungenstoß","line":"In GM, this is translated as “with sharp tonguing.” Some interpret it in the fifth movement of Mahler’s SYMPHONIE II as “flutter-tonguing.” Since GM explicitly writes “Flatterzunge” elsewhere, I have translated it here as “with sharp tonguing.” However, around bar 402 of the fifth movement, “Zungenstoss” or its abbreviation appears above notes bearing three tremolo strokes, so the precise playing technique still needs to be checked. Still, I think it unlikely that GM, who was also an excellent conductor and thoroughly familiar with the playing techniques of each instrument, would have requested flutter-tonguing from the reed instruments, on which that technique is difficult. I suspect that he was asking for an “extreme” form of tonguing beyond the standard technique; nevertheless, the passage is very loud, and part of me wonders whether there is really any need to work oneself into a frenzy over it.","links":[["#term-also","also",1]]},
  {"headword":"zurückhaltend","line":"In GM, it is used mainly where the tempo becomes slower than before, so I have translated it as “slowing down.” I wonder whether simply translating it as “slowly” is slightly inaccurate. If anything, I feel that “ritenuto” may be more appropriate than “rallentando” or “ritardando.” In stage directions in RW and RS, it can also mean “reservedly,” “restraining someone,” or “with restraint.”","links":[["#term-also","also",1]]},
  {"headword":"anhalten","line":"English: Note for the conductor and singer: Here the symbol 𝄐 indicates only a brief pause at the barline, not a fermata (Mahler’s note).","links":[["#term-brief","brief",1],["#term-pause","pause",1]],"notationMarkup":"<img class=\"gm-music-notation dictionary-music-notation\" data-notation=\"short-pause\" src=\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2039%2048%22%20width%3D%2239%22%20height%3D%2248%22%3E%3Cpath%20d%3D%22M5%2028%20C8%207%2031%207%2034%2028%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%222.3%22%2F%3E%3Ccircle%20cx%3D%2219.5%22%20cy%3D%2227%22%20r%3D%222.5%22%2F%3E%3C%2Fsvg%3E\" width=\"39\" height=\"48\" alt=\"Sign for a brief pause at the barline, without a sustained hold\" aria-label=\"Sign for a brief pause at the barline, without a sustained hold\" title=\"𝄐\">","notationText":"𝄐"},
  {"headword":"anhalten","line":"English: With a slight pause.","links":[["#term-pause","pause",1]]},
  {"headword":"anhalten","line":"“To hold back (the tempo)”; “to restrain (ritenuto)”; “to pause”; “to sustain (a note).”","links":[["#term-pause","pause",1]]},
  {"headword":"anhalten","line":"In GM, anhalten is rendered as “slower”; in RW, as “with a pause,” among other translations. It can describe holding back or momentarily stopping something already in motion. In musical contexts, its nuance can be close to the Italian ritenuto (slower; restrained), firmly holding the tempo back at that moment.","links":[["#term-pause","pause",1]]},
  {"headword":"anhalten","line":"The noun Anhalten is rendered here as “a pause.” A footnote to Mahler's Das himmlische Leben, a setting of a poem from Des Knaben Wunderhorn, reads “𝄐 bedeutet hier nur ein kurzes Anhalten auf dem Taktstrich und nicht etwa eine Fermate.” In the GM entry, this passage is translated as “Here the symbol 𝄐 indicates only a brief pause at the barline, not a fermata”.","links":[["#term-pause","pause",2],["#term-brief","brief",1]]},
  {"headword":"Anmerkung","line":"② A brief comment, opinion, or observation on a subject.","links":[["#term-brief","brief",1]]},
  {"headword":"antworten","line":"English: The singing of the sirens answers the increasingly wild dance, as if in an echo.","links":[["#term-wild","wild",1],["#term-echo","echo",1]]},
  {"headword":"atmen","line":"“Breathe,” “take a breath (when playing a wind instrument or singing),” “pause for a breath (between phrases).”","links":[["#term-pause","pause",1]]},
  {"headword":"Cäsur","line":"A division in the musical phrasing, marked by a pause or by other means and functioning as musical punctuation.","links":[["#term-pause","pause",1]]},
  {"headword":"deutlich","line":"English: Deliver this brief exchange very clearly.","links":[["#term-brief","brief",1]]},
  {"headword":"ebenso","line":"English: Note: The fermatas do not indicate a pause, only a slight lengthening; likewise, “drängend (with a sense of urgency)” is merely a phrasing instruction and should be carried out very discreetly.","links":[["#term-pause","pause",1]]},
  {"headword":"Echo","line":"① An echo or reflected sound.","links":[["#term-echo","echo",1]]},
  {"headword":"Echo","line":"English: Like an echo.","links":[["#term-echo","echo",1]]},
  {"headword":"Echo","line":"English: Long pause: the echo is heard repeating the call twice.","links":[["#term-pause","pause",1],["#term-echo","echo",1]]},
  {"headword":"einhalten","line":"② To stop an action temporarily; to interrupt or pause.","links":[["#term-pause","pause",1]]},
  {"headword":"einhalten","line":"“Keep the prescribed tempo or rhythm”; “observe the instruction”; “pause in playing or in an action”; “hold back or slacken the tempo.”","links":[["#term-pause","pause",1]]},
  {"headword":"einzuhalten","line":"② To stop an action, interrupt it, or pause.","links":[["#term-pause","pause",1]]},
  {"headword":"Erscheinung","line":"③ An apparition, vision, or ghostly figure.","links":[["#term-vision","vision",1]]},
  {"headword":"Finger","line":"① A finger.","links":[["#term-finger","finger",1]]},
  {"headword":"Finger","line":"② The part of a glove enclosing a finger.","links":[["#term-finger","finger",1]]},
  {"headword":"Finger","line":"English: These grace notes are always to be played glissando (sliding with one finger).","links":[["#term-finger","finger",1]]},
  {"headword":"flüchtig","line":"① Fleeting or short-lived; brief or done in passing.","links":[["#term-brief","brief",1]]},
  {"headword":"Gesicht","line":"④ (Older usage) Sight or vision.","links":[["#term-vision","vision",1]]},
  {"headword":"Gesicht","line":"⑤ (Literary) A vision, apparition, or premonition.","links":[["#term-vision","vision",1]]},
  {"headword":"Gewölk","line":"English: Black clouds settle low, close to the edge of the rock; a wild noise can be heard from the fir forest.","links":[["#term-wild","wild",1]]},
  {"headword":"groß","line":"English: A procession of bacchantes comes rushing from the background in a wild dance. With drunken gestures, they pass through the groups of nymphs and loving couples, who are soon swept along by them into even greater impetuosity.","links":[["#term-wild","wild",1]]},
  {"headword":"immer fort","line":"② Keeping on, or continuing without pause.","links":[["#term-pause","pause",1]]},
  {"headword":"kapriziös","line":"② In art and similar contexts, fanciful, eccentric, or imaginative.","links":[["#term-art","art",1]]},
  {"headword":"knapp","line":"③ Concise, brief, or curt.","links":[["#term-brief","brief",1]]},
  {"headword":"kurz","line":"② Concise or brief, with expression or content condensed.","links":[["#term-brief","brief",1]]},
  {"headword":"kurz","line":"English: Only a brief pause.","links":[["#term-brief","brief",1],["#term-pause","pause",1]]},
  {"headword":"leidenschaftlich","line":"English: Venus has turned her face, covered with both hands, away from Tannhäuser with intense emotion; after a pause she turns it back towards him, smiling and wearing a seductive expression.","links":[["#term-pause","pause",1]]},
  {"headword":"liebevoll","line":"English: After a brief pause, looking at her lovingly.","links":[["#term-brief","brief",1],["#term-pause","pause",1]]},
  {"headword":"Luftpause","line":"① A short pause for breath; a breathing space.","links":[["#term-pause","pause",1]]},
  {"headword":"Luftpause","line":"② Figuratively, a brief interruption.","links":[["#term-brief","brief",1]]},
  {"headword":"Luftpause","line":"In music, a breath pause: a pause for breathing, or an analogous brief break in the musical flow.","links":[["#term-pause","pause",2],["#term-brief","brief",1]]},
  {"headword":"Musik","line":"① Music as an art; a musical work or its performance.","links":[["#term-art","art",1]]},
  {"headword":"Nachahmung","line":"② A reproduction or copy (of a work of art).","links":[["#term-art","art",1]]},
  {"headword":"Nachahmung","line":"English: A short pause; then mocking shrieks from the children, imitations of a rooster’s crow, and banging against the front door.","links":[["#term-pause","pause",1]]},
  {"headword":"naiv","line":"② Artless or unaffected (in art, etc.).","links":[["#term-art","art",1]]},
  {"headword":"ohnmächtig","line":"English: She tries to tear herself away from Guntram; after a brief, futile struggle, during which Guntram has pushed her further towards the front of the stage, she sinks to the ground half unconscious.","links":[["#term-brief","brief",1]]},
  {"headword":"Pathos","line":"① Deep, solemn emotion or an impassioned, elevated expression of feeling (in literature, speeches, or art); in expressive directions, “with deep feeling” or “passionate expression”.","links":[["#term-art","art",1]]},
  {"headword":"Pause","line":"② A pause in speech or action, or a period of silence.","links":[["#term-pause","pause",1]]},
  {"headword":"Pause","line":"English: Senta, overwhelmed by the intensity of her emotion, sinks back into her chair. After a pause, the girls, deeply moved, continue singing softly.","links":[["#term-pause","pause",1]]},
  {"headword":"Pause","line":"English: A solemn pause: Guntram is completely absorbed in himself; in anxious anticipation, Freihild keeps her gaze fixed on Friedhold, who seems to be praying quietly.","links":[["#term-pause","pause",1]]},
  {"headword":"Richtung","line":"② A tendency or school of thought or art.","links":[["#term-art","art",1]]},
  {"headword":"schauerlich","line":"English: A long, spine-chilling pause.","links":[["#term-pause","pause",1]]},
  {"headword":"schelmisch","line":"English: Gradually this vision too fades. At last the haze clears completely, revealing the whole grotto, lonely and still. The three Graces bow playfully before Venus and slowly withdraw to the grotto of love. The deepest stillness. The positions and poses of Venus and Tannhäuser remain unchanged.","links":[["#term-vision","vision",1]]},
  {"headword":"Stille","line":"“stillness”, “silence”, “a pause”.","links":[["#term-pause","pause",1]]},
  {"headword":"Stuhl","line":"English: Senta, overwhelmed by the intensity of her emotion, sinks back into her chair. After a pause, the girls, deeply moved, continue singing softly.","links":[["#term-pause","pause",1]]},
  {"headword":"Tanz","line":"English: The singing of the sirens answers the increasingly wild dance, as if in an echo.","links":[["#term-wild","wild",1],["#term-echo","echo",1]]},
  {"headword":"Theater","line":"② Drama as an art; colloquially, exaggerated behaviour or a fuss.","links":[["#term-art","art",1],["#term-fuss","fuss",1]]},
  {"headword":"tobend","line":"② Raging or running wild, of a storm, sea, etc.","links":[["#term-wild","wild",1]]},
  {"headword":"ungeheuer","line":"① Huge or terrifying; in historical or figurative contexts, wild or monstrous.","links":[["#term-wild","wild",1]]},
  {"headword":"ungestüm","line":"② Of natural forces, wild or violent.","links":[["#term-wild","wild",1]]},
  {"headword":"unterbrechen","line":"② To suspend an action or activity temporarily; to pause.","links":[["#term-pause","pause",1]]},
  {"headword":"Unterbrechung","line":"① Interruption, pause; an interjection in a conversation.","links":[["#term-pause","pause",1]]},
  {"headword":"Verwirrung","line":"English: An embarrassed pause.","links":[["#term-pause","pause",1]]},
  {"headword":"Vision","line":"③ Sight or field of vision (said to be an old usage).","links":[["#term-vision","vision",1]]},
  {"headword":"visionär","line":"① Visionary, fantastic or dreamlike; adverbially, “with a visionary quality”, “in a dreamlike manner” or “as if seeing a vision”.","links":[["#term-vision","vision",1]]},
  {"headword":"visionär","line":"English: As if seeing a vision.","links":[["#term-vision","vision",1]]},
  {"headword":"Waffe","line":"③ (Hunting, plural) A boar’s tusks or the claws of certain wild cats and birds of prey.","links":[["#term-wild","wild",1]]},
  {"headword":"wiegend","line":"English: Now Salome draws herself up to her full height and signals to the musicians; the wild rhythm is immediately subdued and gives way to a gently swaying melody.","links":[["#term-wild","wild",1]]},
  {"headword":"wild","line":"① Wild or uncultivated; in dated or derogatory usage, savage or uncivilized.","links":[["#term-wild","Wild",1]]},
  {"headword":"wild","line":"② Rough, violent or fierce; adverbially, “wildly”, “furiously”, “with wild abandon” or “violently”.","links":[["#term-wild","wild",1]]},
  {"headword":"wild","line":"English: The singing of the sirens answers the increasingly wild dance, as if in an echo.","links":[["#term-wild","wild",1],["#term-echo","echo",1]]},
  {"headword":"Wort","line":"③ A saying or brief expression.","links":[["#term-brief","brief",1]]},
  {"headword":"Zitat","line":"② By extension in art or music, the borrowing or quotation of an existing work or motif.","links":[["#term-art","art",1]]},
  {"headword":"Pause","line":"English: Pause here for at least five minutes.","links":[["#term-pause","Pause",1]]},
  {"headword":"atemlos","line":"English: The duenna rushes off and soon returns breathless, laden with linen; behind her come two maids with a sponge and basin of water. They surround the Baron, busily helping him.","links":[["#term-duenna","duenna",1]]},
  {"headword":"beruhigen","line":"English: The Steersman starts up and checks whether the ship has suffered any damage. Reassured, he sits down again by the helm and sings. He grows more and more drowsy.","links":[["#term-helm","helm",1]]},
  {"headword":"bitter","line":"① (Of taste) Bitter.","links":[["#term-bitter","Bitter",1]]},
  {"headword":"bitter","line":"English: Cruelly bitter.","links":[["#term-bitter","bitter",1]]},
  {"headword":"Brief","line":"② (Stock exchange) The asking price.","links":[["#term-stoecken","Stock",1]]},
  {"headword":"brutal","line":"② Stark, unvarnished, rough-hewn, merciless (of facts, etc.).","links":[["#term-stark","Stark",1]]},
  {"headword":"empor","line":"in su, all’insù, in alto","links":[["#term-ins","ins",1]]},
  {"headword":"Finger","line":"dito","links":[["#term-dito","dito",1]]},
  {"headword":"flüchtig","line":"English: Tannhäuser, who has quickly sprung up in surprise, regains his composure and, after casting a fleeting glance at the Landgrave and the singers, bows silently to the Landgrave.","links":[["#term-sprung","sprung",1]]},
  {"headword":"geschehen","line":"English: The Steersman starts up and looks at the helm; satisfied that nothing has happened, he sits down again and hums the beginning of his song.","links":[["#term-helm","helm",1]]},
  {"headword":"grausam","line":"English: Cruelly bitter.","links":[["#term-bitter","bitter",1]]},
  {"headword":"höllisch","line":"① Of hell, hellish, or demonic; adverbially, “hellishly”, “diabolically”.","links":[["#term-hell","hell",1]]},
  {"headword":"Hütte","line":"① A small, simple hut or cabin; a mountain refuge.","links":[["#term-hut","hut",1]]},
  {"headword":"Hütte","line":"English: Pointing towards the hut.","links":[["#term-hut","hut",1]]},
  {"headword":"Kampf","line":"English: In bitter inner conflict.","links":[["#term-bitter","bitter",1]]},
  {"headword":"Knabe","line":"English: The girls have quickly sprung up, and a small group of slender young men, scarcely more than boys, among them Da-ud, has taken their place and kneels before Helena with bowed heads.","links":[["#term-sprung","sprung",1]]},
  {"headword":"Kulisse","line":"③ In mechanics, a slotted-link mechanism; in stock-exchange usage, unofficial dealing or its participants.","links":[["#term-stoecken","stock",1]]},
  {"headword":"matt","line":"① Without a sheen: matt, dull, or muted.","links":[["#term-matt","matt",1]]},
  {"headword":"Potpourri","line":"① Potpourri: a mixture of dried flowers or other aromatic substances.","links":[["#term-potpourri","Potpourri",1]]},
  {"headword":"schlicht","line":"English: In the foreground, on the forest side, is a spring; opposite it, slightly lower down, is a simple hermit’s hut leaning against a boulder.","links":[["#term-hut","hut",1]]},
  {"headword":"schwer","line":"English: In bitter inner conflict.","links":[["#term-bitter","bitter",1]]},
  {"headword":"Spitz","line":"② A spitz dog.","links":[["#term-spitz","spitz",1]]},
  {"headword":"Staunen","line":"English: Gurnemanz gazes at Parsifal with astonishment and emotion. He beckons over Kundry, who has just come out of the hut again.","links":[["#term-hut","hut",1]]},
  {"headword":"steigen","line":"② To get into or onto a vehicle.","links":[["#term-get","get",1]]},
  {"headword":"strahlen","line":"English: From the Lateran Basilica, whose windows now shine in the full red glow of dawn, the organ is heard to begin; at its sound, the tumult of the people subsides at once, and the entire street as far as the Lateran Basilica is covered with kneeling people.","links":[["#term-tumult","tumult",1]]},
  {"headword":"Takt","line":"④ Social tact; consideration.","links":[["#term-takt","tact",1]]},
  {"headword":"Transposition","line":"① Replacement, interchange, substitution or transposition (of positions, order, elements, etc.).","links":[["#term-transposition","transposition",1]]},
  {"headword":"Transposition","line":"② Transposition, interchange or displacement (in specialist fields such as mathematics and linguistics).","links":[["#term-transposition","Transposition",1]]},
  {"headword":"Transposition","line":"“transposition”; “shifting to a different pitch level (of a theme, motif, etc.)”.","links":[["#term-transposition","transposition",1]]},
  {"headword":"Tumult","line":"English: A herald enters the stage, and a trumpeter at his side sounds a long-held note. Adriano and Irene have already stepped aside. The inhabitants rush out of every house, so that the whole square as far as the Lateran Basilica is suddenly covered by a great crowd, which fills it with the most joyful tumult.","links":[["#term-tumult","tumult",1]]},
  {"headword":"Tumult","line":"English: The Barber quiets the tumult.","links":[["#term-tumult","tumult",1]]},
  {"headword":"Vorhang","line":"English: Inside the donkey driver's hut, very modest but neatly kept. A large bed, a low table with seats, and many colourful cloths in Eastern style. An old carpet hangs across the doorway. Bright sunlight streams in everywhere, through the open window and the hanging at the entrance.","links":[["#term-hut","hut",1]]}
];

function withoutLeadingSenseNumber(line) {
  return line.replace(/^[①-⑳]\s*/, '');
}

function removeReviewedEnglishTermLinks(rendered, headword, sourceText, language) {
  if (language !== 'en' || !rendered || typeof sourceText !== 'string') return rendered;
  const sourceLines = sourceText.replace(/\[\[nolink:([^\[\]\r\n]{1,120})\]\]/g,'$1').split(/\r?\n/).map(withoutLeadingSenseNumber);
  const rules = REVIEWED_ENGLISH_LINK_CONTEXTS.filter(rule => rule.headword === headword &&
    sourceLines.filter(line => line === withoutLeadingSenseNumber(rule.line)).length === 1);
  if (!rules.length) return rendered;
  return rendered.split('<br>').map(line => {
    // Compare the visible wording exactly, ignoring only a leading sense number.
    // Only generated tags are stripped for comparison; source HTML is escaped.
    const literal = line.replace(/<[^>]*>/g, '');
    for (const rule of rules) {
      let reviewedLiteral = literal;
      if (rule.notationMarkup) {
        if (line.split(rule.notationMarkup).length - 1 !== 1) continue;
        reviewedLiteral = line.replace(rule.notationMarkup, escapeHtml(rule.notationText)).replace(/<[^>]*>/g, '');
      }
      if (withoutLeadingSenseNumber(reviewedLiteral) !== escapeHtml(withoutLeadingSenseNumber(rule.line))) continue;
      const replacements = rule.links.map(([target, text, count]) => ({
        anchor: `<a href="${escapeHtml(target)}" class="term-link">${escapeHtml(text)}</a>`,
        text: escapeHtml(text), count
      }));
      if (!replacements.every(item => line.split(item.anchor).length - 1 === item.count)) continue;
      for (const item of replacements) line = line.split(item.anchor).join(item.text);
    }
    return line;
  }).join('<br>');
}

function generateDicListHtml(dicData, termsIndex, abbreviationIndex, dictionaryExampleIndex, language) {
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
  
  // Scope compiled matchers to this build: never reuse them across changed Notes or mappings.
  const preparedMatchers = prepareTermMatchers(termsIndex || {});
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
    const renderPlainTranslation = part => termsIndex ? linkTermsInTranslation(part, termsIndex, preparedMatchers) : escapeHtmlWithBreaks(part);
    const renderTranslation = part => typeof renderDictionaryReferenceText === 'function' ? renderDictionaryReferenceText(part, renderPlainTranslation) : renderPlainTranslation(part);
    const linkedTranslation = typeof renderDictionaryNotationText === 'function'
      ? renderDictionaryNotationText(translation, german, source, language, renderTranslation) : renderTranslation(translation);
    
    // 略記から対象作曲家を判定し、実例リンクを生成
    const hasGM = source && source.includes('[GM]');
    const hasRW = source && source.includes('[RW: Oper]');
    const hasRS = source && source.includes('[RS: Oper]');
    const hasExample = hasGM || hasRW || hasRS;

    let toggleArea = '';

    if (hasExample) {
      const queryParam = encodeURIComponent(String(german).replace(/\[\[score:[a-z][a-z0-9-]{0,95}\]\]/gi,'').trim());
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
    html += `<div class="row"${termIdAttr} data-notes-heading="${escapeHtml(german)}" data-notes-source="${escapeHtml(source)}">
  <dt${letterAnchorAttr}>
    <div class="dt-main">
      <dfn class="german">${typeof renderDictionaryNotationText === 'function' ? renderDictionaryNotationText(german, german, source, language) : escapeHtml(german)}</dfn>
    </div>
    <div class="dt-details">
      ${toggleArea}
      ${source ? `<span class="source">${linkAbbreviationsInSource(source, abbreviationIndex, termId)}</span>` : ''}
    </div>
  </dt>
  <dd class="translation">${removeReviewedEnglishTermLinks(typeof renderNotesEnglishLayout === 'function' ? renderNotesEnglishLayout(linkedTranslation, language) : linkedTranslation, german, translation, language)}</dd>
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
 * @param {Array} mappingData - 検索対応データ
 * @return {string} 完全なHTMLファイルの内容
 */
function generateDicHtml(dicData, abbrData, dictionaryExampleIndex, mappingData, options) {
  const language = options && options.language === 'en' ? 'en' : 'ja';
  // 用語インデックスを生成
  const termsIndex = generateDicTermsIndex(dicData, mappingData);
  const abbreviationIndex = generateAbbreviationIndex(abbrData);
  
  const dicListHtml = generateDicListHtml(dicData, termsIndex, abbreviationIndex, dictionaryExampleIndex, language);
  const abbrListHtml = generateAbbrListHtml(abbrData);

  // 構造化データの生成 (SEO対策)
  const definedTerms = (dicData || [])
    .filter(row => row[0]) // 有効な行のみ
    .map(row => {
      // 翻訳文からHTMLタグを除去してプレーンテキストにする
      const plainTranslation = String(row[1] || '').replace(/\[\[score:[a-z][a-z0-9-]{0,95}\]\]/gi,'').replace(/<[^>]*>?/gm, '').trim();
      return {
        "@type": "DefinedTerm",
        "termCode": normalizeForId(row[0]),
        "name": String(row[0]).replace(/\[\[score:[a-z][a-z0-9-]{0,95}\]\]/gi,'').trim(),
        "description": plainTranslation || "ドイツ語の音楽用語"
      };
    });

  const entryCount = definedTerms.length;
  const entryCountHtml = language === 'en'
    ? `<strong>${entryCount.toLocaleString('en-US')}</strong> dictionary ${entryCount === 1 ? 'entry' : 'entries'}`
    : `収録項目数：<strong>${entryCount}</strong>件`;

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
<script src="js/analytics.js"></script>
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
    <meta property="og:description" content="ワーグナー，マーラー，R.シュトラウス，ブルックナー等の作品に登場するドイツ語音楽用語を1000語以上収録．専門的な訳例や詳細な解釈をまとめた，楽譜の指示を正確に理解するための網羅的な用語集・辞書一覧．">
    <meta property="og:url" content="https://yutaka-okawachi.github.io/gaswebapp-manual/mahler-search-app/dic.html">
    <meta property="og:image" content="https://yutaka-okawachi.github.io/gaswebapp-manual/ogp.png">
    <meta name="twitter:card" content="summary">
    <title>ドイツ語の音楽用語集</title>
    <link rel="icon" href="https://yutaka-okawachi.github.io/gaswebapp-manual/favicon.png">
    <link rel="apple-touch-icon" href="https://yutaka-okawachi.github.io/gaswebapp-manual/apple-touch-icon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="ワーグナー，マーラー，R.シュトラウス，ブルックナー等の作品に登場するドイツ語音楽用語を1000語以上収録．専門的な訳例や詳細な解釈をまとめた，楽譜の指示を正確に理解するための網羅的な用語集・辞書一覧．">
    
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
            font-family: 'Lora', 'Meiryo', 'メイリオ', sans-serif;
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
            font-family: 'Lora', 'Meiryo', 'メイリオ', sans-serif;
            font-size: 0.9rem;
        }

        .abbr-long {
            flex: 1;
            margin-left: 1em;
            font-family: 'Lora', 'Meiryo', 'メイリオ', sans-serif;
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
            font-family: 'Lora', 'Meiryo', 'メイリオ', sans-serif;
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
            font-family: 'Lora', 'Meiryo', 'メイリオ', sans-serif;
            display: block;
            margin-bottom: 2px;
        }

        .example-wrapper {
            display: flex;
            align-items: baseline;
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
            flex-wrap: wrap;
            gap: 6px;
            font-size: 1.0rem;
            font-family: 'Lora', 'Meiryo', 'メイリオ', sans-serif;
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
            font-family: var(--font-sans);
        }

        .info-notice-content p {
            margin: 0;
            font-size: 0.9rem;
            color: #333;
            line-height: 1.5;
            font-family: var(--font-sans);
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
            font-family: var(--font-sans);
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

                    const composerLink = e.target.closest('a.composer-link');
                    if (composerLink && listContainer.contains(composerLink)) {
                        const sourceRow = composerLink.closest('.row');
                        if (sourceRow && sourceRow.id) {
                            const termId = sourceRow.id;
                            try {
                                window.sessionStorage.setItem('dictionary_example_return_target', termId);
                            } catch (err) {}
                            try {
                                if ('scrollRestoration' in window.history) {
                                    window.history.scrollRestoration = 'manual';
                                }
                                window.history.replaceState(
                                    Object.assign({}, window.history.state, { dictionaryExampleReturnTarget: termId }),
                                    '',
                                    '#' + encodeURIComponent(termId)
                                );
                            } catch (err) {}
                        }
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
        window.addEventListener('popstate', handleHashChange);
        window.addEventListener('pageshow', (event) => {
            const isBackForward = event.persisted ||
                (window.performance && window.performance.getEntriesByType &&
                    window.performance.getEntriesByType('navigation')[0] &&
                    window.performance.getEntriesByType('navigation')[0].type === 'back_forward');
            if (isBackForward || (window.location.hash && window.location.hash.startsWith('#term-'))) {
                handleHashChange();
            }
        });

        let hashScrollSequence = 0;

        function cancelHashScroll() {
            hashScrollSequence++;
        }

        window.addEventListener('wheel', cancelHashScroll, { passive: true });
        window.addEventListener('touchstart', cancelHashScroll, { passive: true });
        window.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Space', 'Home', 'End'].includes(e.code)) {
                cancelHashScroll();
            }
        }, { passive: true });

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
            window.setTimeout(realign, 300);
            window.setTimeout(realign, 600);
            window.setTimeout(realign, 1000);
        }

        function getPendingExampleReturnTarget() {
            try {
                const target = window.sessionStorage.getItem('dictionary_example_return_target');
                if (target) {
                    window.sessionStorage.removeItem('dictionary_example_return_target');
                    return target;
                }
            } catch (err) {}
            if (window.history.state && window.history.state.dictionaryExampleReturnTarget) {
                return window.history.state.dictionaryExampleReturnTarget;
            }
            return null;
        }

        function handleHashChange() {
            let hash = window.location.hash;
            const pendingReturnTarget = getPendingExampleReturnTarget();

            if (!hash && pendingReturnTarget) {
                hash = '#' + encodeURIComponent(pendingReturnTarget);
                try {
                    window.history.replaceState(
                        Object.assign({}, window.history.state, { dictionaryExampleReturnTarget: pendingReturnTarget }),
                        '',
                        hash
                    );
                } catch (err) {}
            }

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

            if ('scrollRestoration' in window.history) {
                window.history.scrollRestoration = 'manual';
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

            <p class="page-description" style="font-size: 0.85rem; color: #555; margin-top: 0.5em; margin-bottom: 1em;">
                <span class="dictionary-entry-count">${entryCountHtml}</span><br>
                スコアで確認したドイツ語の一般的な意味，音楽用語としての訳例・コメント・出典を一覧で確認可能．アルファベットから用語を探し，「実例を見る」から各作曲家の検索結果へ移動可能．
            </p>
            <p class="page-description" style="font-size: 0.85rem; color: #555; margin-top: 0; margin-bottom: 1em;">※「実例を見る」は，Richard Strauss についてはオペラのみ対応．</p>

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
            document.write(\`<a href="#letter-OTHER">${options && options.language === 'en' ? 'Other' : '数字・記号'}</a>\`);
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
 * 実データでHTML生成（ログ出力用）
 * スプレッドシートから実際のデータを読み込んでHTMLを生成
 * 生成されたHTMLをログに出力してコピー可能にする
 */
function generateDicHtmlFromSpreadsheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (typeof maintenanceSortAssertIdle_ === 'function') maintenanceSortAssertIdle_(ss);
  
  // Notesシートから用語データを取得（見出し名 de / ja / source で列を特定し、列の並べ替えに追従する）
  const readByHeaders = (sheet, name) => {
    const values = sheet.getDataRange().getValues();
    const header = values[0].map(normalizeExportHeader_);
    return pickExportRows_({ values: values, columns: resolveExportColumns_(name, header, EXPORT_SHEET_HEADERS[name]) });
  };
  const dicNotesSheet = ss.getSheetByName('Notes');
  let dicNotesData = [];
  if (dicNotesSheet) {
    dicNotesData = notesSheetRows_(dicNotesSheet.getDataRange().getValues()).filter(row => row.values.de.trim())
      .map(row => [row.values.de, row.values.ja, row.values.source]);
  }

  const termMappingSheet = ss.getSheetByName('語形対応');
  const termMappingData = termMappingSheet
    ? readByHeaders(termMappingSheet, '語形対応')
      .filter(row => String(row[0] || '').trim() && String(row[1] || '').trim())
    : [];
  validateDictionaryTermMapping_(dicNotesData, termMappingData);
  
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
  const html = generateDicHtml(dicNotesData, abbrData, null, termMappingData);
  
  Logger.log('=== HTML生成完了 ===');
  Logger.log('HTML長さ: ' + html.length + ' 文字 (' + Math.round(html.length / 1024) + ' KB)');
  Logger.log('');
  Logger.log('このHTMLを以下からコピーして、ローカルファイル "dic_generated.html" として保存してください:');
  Logger.log('==================================================');
  Logger.log(html);
  Logger.log('==================================================');
  
  return html;
}
