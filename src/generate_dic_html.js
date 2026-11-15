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
  {"headword":"anhalten","line":"Gehalten can refer to sustaining tone and phrasing, in a sense close to tenuto or sostenuto, as well as to restraining the tempo or expression. Its distinction from anhalten depends on the particular use and the surrounding context. See also the entry for gehalten.","links":[["#term-see","See",1]]},
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
  {"headword":"beiseite","line":"See also für sich and vor sich.","links":[["#term-see","See",1]]},
  {"headword":"bereits","line":"English: Startled, she pauses for a moment; meanwhile, Guntram, who has quickly regained his composure, has already hurried after her and holds her fast.","links":[["#term-fast","fast",1]]},
  {"headword":"besetzt","line":"Past participle of besetzen. See the entry for “besetzen.”","links":[["#term-see","See",1]]},
  {"headword":"Bett","line":"English: Lit by this glow, the three Rhinemaidens can be seen swimming in a circle on the calmer waves of the Rhine, which has gradually returned to its bed, playing merrily with the ring.","links":[["#term-ring","ring",1]]},
  {"headword":"bispigliando","line":"See the entry for bisbigliando.","links":[["#term-see","See",1]]},
  {"headword":"Blatt","line":"③ A playing card, a hand of cards, or a pack.","links":[["#term-hand","hand",1]]},
  {"headword":"Blitz","line":"English: Darkness, a flash; the nurse leads the apparition of the young man forward by the hand.","links":[["#term-hand","hand",1]]},
  {"headword":"bloß","line":"English: Menelas, bare sword in hand, steps behind Helena.","links":[["#term-hand","hand",1]]},
  {"headword":"Bord","line":"English: The girls hand their baskets over the side of the ship to the sailors.","links":[["#term-hand","hand",1]]},
  {"headword":"Cäsur","line":"For a break involving a breath, see also “Luftpause.”","links":[["#term-see","see",1]]},
  {"headword":"cuivrez","line":"This is French. See “schmetternd.”","links":[["#term-see","See",1]]},
  {"headword":"dahinhuschend","line":"In an alternative reference edition of Karg-Elert’s 30 Capricen für Flöte solo Op.107, No. 30, Variation XIII, dahinhuschend accompanies “So rasch als möglich” (as fast as possible), alongside “Presto il più possibile.”","links":[["#term-fast","fast",1]]},
  {"headword":"Dämpfer","line":"For removable mutes, mit Dämpfer means “with the mute on” (con sordino), and Dämpfer ab / weg means “remove the mute” (senza sordino). See also “Dämpfer auf.”","links":[["#term-see","See",1]]},
  {"headword":"Dämpfer ab","line":"Short for “Dämpfer abnehmen” or “Dämpfer absetzen.” See “Dämpfer auf.”","links":[["#term-see","See",1]]},
  {"headword":"Dämpfer auf","line":"On the other hand, auf can also generally mean 「open」. When offen (open) or gestopft (stopped) is indicated for brass instruments, its relationship to open tones, hand-stopping, the use of a mute, and so forth must be interpreted according to the instrument and the surrounding context. The auf in Dämpfer auf does not denote this sense of 「open」, but rather the fitting of the mute.","links":[["#term-hand","hand",2]]},
  {"headword":"Dämpfer weg","line":"It means “remove the mute,” but there are no examples of Dämpfer weg in GM. Weg means “taken away” or “removed.” See “Dämpfer auf.”","links":[["#term-see","See",1]]},
  {"headword":"decken","line":"English: Matteo has emerged on the left at the same time as Adelaide; Zdenka follows shyly behind him in boy's clothes, a kind of black tailcoat, sheltering behind a column.","links":[["#term-kind","kind",1]]},
  {"headword":"devot","line":"This comparison describes a relative tendency in connotation: demütig can also express submissiveness or self-abasement. Sense ② of devot represents historical usage and should be distinguished from its modern general meaning. The examples “as if rubbing one’s hands in ingratiation” and “bowing and scraping” figuratively convey an excessively deferential manner; devot itself does not necessarily prescribe hand-rubbing or bowing.","links":[["#term-hand","hand",1]]},
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
  {"headword":"erreicht","line":"③ To get in touch with someone or something; to reach (with the hand, etc.).","links":[["#term-hand","hand",1]]},
  {"headword":"Fackel","line":"English: Elektra takes the torch from the ring, runs down towards him (Ägisth) and bows before him.","links":[["#term-ring","ring",1]]},
  {"headword":"fest","line":"English: Startled, she pauses for a moment; meanwhile, Guntram, who has quickly regained his composure, has already hurried after her and holds her fast.","links":[["#term-fast","fast",1]]},
  {"headword":"Finger","line":"English: He takes his ring off his finger, kisses it, and holds it out threateningly.","links":[["#term-ring","ring",1]]},
  {"headword":"freundlich","line":"① Friendly, kind or amiable in dealing with others. Stage directions describe a friendly expression, tone or gesture.","links":[["#term-kind","kind",1]]},
  {"headword":"führend","line":"English: Baron Ochs appears with his arm in a sling, leading Octavian with his left hand, with the personal footman behind him. The Baron surveys the room. Octavian looks around, runs to the mirror, and arranges his hair.","links":[["#term-arm","arm",1],["#term-hand","hand",1]]},
  {"headword":"gehalten","line":"See also the entry “anhalten.”","links":[["#term-see","See",1]]},
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
  {"headword":"Hess","line":"See also “WoO”.","links":[["#term-see","See",1]]},
  {"headword":"Himmel","line":"English: Gurnemanz raises his right arm and looks up to heaven.","links":[["#term-arm","arm",1]]},
  {"headword":"jedoch","line":"English: At this point Lohengrin has disappeared from the audience’s view behind the trees at the bend in the river on the right; the performers on stage, however, see him coming ever closer on the right side of the stage.","links":[["#term-see","see",1]]},
  {"headword":"Kammerdiener","line":"For the servants in Der Rosenkavalier Op.59, see “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"Kammerlakai","line":"For the servants in Der Rosenkavalier Op.59, see “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"kaum","line":"English: As Barak raises his right hand as if taking an oath, a flashing sword falls from the air into it. The brothers together scarcely have the strength to restrain him.","links":[["#term-hand","hand",1]]},
  {"headword":"Kellner","line":"For the servants in Der Rosenkavalier Op.59, see “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"kleiner Neger","line":"For the servants in Der Rosenkavalier Op.59, see the entry “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"klingen","line":"① To sound, ring, resonate, or echo.","links":[["#term-ring","ring",1]]},
  {"headword":"klingen","line":"English: Always let it ring.","links":[["#term-ring","ring",1]]},
  {"headword":"klingen","line":"English: Everyone clinks glasses; the glasses ring, and they drink them dry. Silence.","links":[["#term-ring","ring",1]]},
  {"headword":"Lady Macbeth. O, eile! Eile her! damit ich meinen Geist in deinen giesse, durch meine tapfere Zunge diese Zweifel und Furchtgespenster aus dem Felde schlage, die dich wegschrecken von dem goldnen Reif, womit das Glück dich gern bekrönen möchte.","line":"The scene can be interpreted as follows. Having read Macbeth’s letter describing the witches’ prophecy, Lady Macbeth sees that her husband is “too kind to resolve to become king”. She decides to take on the task of pouring that resolve into him and driving out his hesitation through words. Here, “Geist” (“spirit”) means courage, boldness, and the ability to make ruthless decisions, while “tapfere Zunge” (“valiant tongue”) shows her awareness of the power of manipulative language as a weapon. “Goldner Reif” (“golden circlet”) is an indirect expression for the crown, while “Glück” (“fortune” or “luck”) can also be read as a perilous turn of phrase that presents the temptation to sin as though it were fate’s blessing.","links":[["#term-kind","kind",1]]},
  {"headword":"Lakai","line":"For the servants in Der Rosenkavalier Op.59, see “Haushofmeister”.","links":[["#term-see","see",1]]},
  {"headword":"lebhaft","line":"As a tempo indication, it can also be rendered “at a fairly fast tempo”.","links":[["#term-fast","fast",1]]},
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
  {"headword":"Ring","line":"② A finger ring.","links":[["#term-ring","ring",1]]},
  {"headword":"Ring","line":"④ An arena or ring for a contest or fight.","links":[["#term-ring","ring",1]]},
  {"headword":"Ring","line":"⑤ A ring road or circular district.","links":[["#term-ring","ring",1]]},
  {"headword":"Ring","line":"English: Siegfried looks intently at the ring on his finger.","links":[["#term-ring","ring",1]]},
  {"headword":"Ring","line":"English: They form a ring around David and dance around him.","links":[["#term-ring","ring",1]]},
  {"headword":"Ring","line":"English: The maid (one of the servants) fastens the torch to an iron ring in the doorpost.","links":[["#term-ring","ring",1]]},
  {"headword":"RONDO\nAllegro ma non troppo (in cominciando un poco esitando)","line":"Rondo. Allegro, but not too fast; a little hesitant at the beginning.","links":[["#term-fast","fast",1]]},
  {"headword":"Ruhebett","line":"English: Standing, supporting herself with one hand on the couch.","links":[["#term-hand","hand",1]]},
  {"headword":"Saal","line":"English: At this point the creditors break through the line of guards and rush wildly into the hall towards the rickety throne, papers in hand.","links":[["#term-hand","hand",1]]},
  {"headword":"sämmtlich","line":"An older spelling of “sämtlich”. See the entry for “sämtlich”.","links":[["#term-see","See",1]]},
  {"headword":"Schale","line":"English: Isolde does not throw the cup away; instead, it slips from her gradually opening hand.","links":[["#term-hand","hand",1]]},
  {"headword":"Schallbecher","line":"A general term for the end of a woodwind or brass instrument and for the resonator of certain organ reed pipes. In wind-instrument contexts, it is broadly synonymous with Schalltrichter and Schallstück. On the horn, it denotes the part into which the right hand is inserted for stopped playing or tone modification.","links":[["#term-hand","hand",1]]},
  {"headword":"Schemel","line":"English: Octavian kneels on a footstool in front of the bed, half embracing the Marschallin, who is lying in bed. Her face cannot be seen, only her very beautiful hand and the arm from which her lace nightdress has slipped.","links":[["#term-hand","hand",1],["#term-arm","arm",1]]},
  {"headword":"Schlag","line":"See also the entry for “Takt”.","links":[["#term-see","See",1]]},
  {"headword":"schleichen","line":"English: Annina has entered through the anteroom and stealthily creeps closer, a letter in her hand.","links":[["#term-hand","hand",1]]},
  {"headword":"Schluss","line":"English: “For the Paris version of this ending, see Appendix V, page 568.”","links":[["#term-see","see",1]]},
  {"headword":"schnell","line":"Fast; quick; rapid.","links":[["#term-fast","Fast",1]]},
  {"headword":"Schwanendreher","line":"In his 1938 concert notes, Hindemith is said to have explained that this folk song apparently mocked a person who turned a swan on a spit in the kitchen. The translation above follows this interpretation. Another theory holds that the word refers to a player of a hand-cranked organ decorated with a swan.","links":[["#term-hand","hand",1]]},
  {"headword":"Seil","line":"English: Kunrad pulls himself up a little on the rope and, with his arm outstretched, just manages to catch hold of the ends of a few strands of her hair.","links":[["#term-arm","arm",1]]},
  {"headword":"später","line":"English: The woodwind figures, and later the violins’ figures, always equally fast, disregarding the slow tempo of the passage.","links":[["#term-fast","fast",1]]},
  {"headword":"spielend","line":"As an expression marking: playfully, frolicsomely, or merrily. At the opening of No.17 of Karg-Elert’s 30 Capricen für Flöte solo Op.107, “Leggero veloce, giocoso.” appears alongside “Leicht, spielend, sehr rasch.” (lightly, playfully, very fast).","links":[["#term-fast","fast",1]]},
  {"headword":"spitzig","line":"An adjective related in meaning to spitz. See the entry for “spitz”.","links":[["#term-see","See",1]]},
  {"headword":"spottend","line":"The degree and tone of mockery depend on the context; it is not necessarily milder than direct ridicule. It may carry contempt, indifference, or coldness. See also “spöttisch”.","links":[["#term-see","See",1]]},
  {"headword":"spöttisch","line":"See also “spottend”.","links":[["#term-see","See",1]]},
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
  {"headword":"WoO","line":"See also “Hess”.","links":[["#term-see","See",1]]},
  {"headword":"Zofe","line":"For the servants in Der Rosenkavalier Op.59, see “Haushofmeister.”","links":[["#term-see","see",1]]},
  {"headword":"zögernd","line":"English: Flowing, but not fast. In the opening bars, still somewhat hesitant.","links":[["#term-fast","fast",1]]},
  {"headword":"zornig","line":"English: The door opens and the wigmaker staggers out, just receiving a slap from the tenor. Dressed as Bacchus, but with his head bare and the curly wig in his hand, the tenor follows him out angrily.","links":[["#term-hand","hand",1]]},
  {"headword":"zu","line":"“Nicht zu schnell”: not too fast (similar in sense to Non troppo allegro).","links":[["#term-fast","fast",1]]},
  {"headword":"zu","line":"“Dämpfer zu”: interpreted here as meaning to put on the mute (sense ③). Incidentally, “Dämpfer auf” in GM also means to put on the mute. See the entry “Dämpfer auf.”","links":[["#term-see","See",1]]},
  {"headword":"zugleich","line":"English: She signals to the vassals to carry Siegfried’s body onto the pyre; at the same time, she removes the ring from Siegfried’s finger and contemplates it, lost in thought.","links":[["#term-ring","ring",1]]},
  {"headword":"zuletzt","line":"English: The three orphans, and finally their mother too, have kissed the Marschallin’s hand.","links":[["#term-hand","hand",1]]},
  {"headword":"Zungenschlag","line":"There is no example in the GM entries. In Variation II of [RS: Qui], where a flock of sheep is imitated, the term presumably means “flutter-tonguing” (quite apart from the brass, asking the clarinets to do the same at p or pp is diabolically demanding). An early orchestral example of flute flutter-tonguing occurs in Tchaikovsky's The Nutcracker. See also “Zungenstoß.”","links":[["#term-see","See",1]]},
  {"headword":"zus.","line":"See the entry for zusammen.","links":[["#term-see","See",1]]}
];

function removeReviewedEnglishTermLinks(rendered, headword, sourceText, language) {
  if (language !== 'en' || !rendered || typeof sourceText !== 'string') return rendered;
  const sourceLines = sourceText.split(/\r?\n/);
  const rules = REVIEWED_ENGLISH_LINK_CONTEXTS.filter(rule => rule.headword === headword &&
    sourceLines.filter(line => line === rule.line).length === 1);
  if (!rules.length) return rendered;
  return rendered.split('<br>').map(line => {
    // Compare exact visible source text after the existing escaping/rendering.
    // Only generated tags are stripped for comparison; source HTML is escaped.
    const literal = line.replace(/<[^>]*>/g, '');
    for (const rule of rules) {
      if (literal !== escapeHtml(rule.line)) continue;
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
  // 用語インデックスを生成
  const termsIndex = generateDicTermsIndex(dicData, mappingData);
  const abbreviationIndex = generateAbbreviationIndex(abbrData);
  
  const dicListHtml = generateDicListHtml(dicData, termsIndex, abbreviationIndex, dictionaryExampleIndex, options && options.language === 'en' ? 'en' : 'ja');
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
