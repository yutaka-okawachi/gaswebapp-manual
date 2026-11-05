/** Current adopted ja/en style only. Never learn from ja_old or review-workspace columns. */
const MAINTENANCE_STYLE_VERSION = '2026-11-05';
const MAINTENANCE_STYLE_EXAMPLE_TERMS = Object.freeze({
  GM: ['(Anm. f. d. Dirig. ) : Alle Betonungen consequent durchführen', '＋ Zeichen für einzelne gestopfte Töne'],
  RW: ['Farzana und Zemina treten hervor.', 'Die Feen und Geister versammeln sich um beide.'],
  RS: ['drohend', 'gut ausgehalten'],
  Notes: ['Bogen', 'allgemein', 'atmen', 'abwärts', 'AV']
});
function maintenanceStyleCatalogue_(headword) { return /^(?:AV|TrV)$/i.test(String(headword).trim()); }
function maintenanceStyleProfile_(tab, values) {
  if (tab !== 'Notes') return 'contextual_translation';
  if (maintenanceStyleCatalogue_(values.de)) return 'catalogue';
  if (values.ja) return /【一般的な意味】/.test(values.ja) ? 'dictionary' : 'annotation';
  return String(values.de).trim().split(/\s+/).length <= 5 && String(values.de).length <= 100 ? 'dictionary' : 'annotation';
}
function maintenanceStyleProtectedTransform_(value, transform) {
  // Quoted originals, URL/code, markup and notation remain byte-for-byte unchanged.
  const re = /\[\[score:[^\]\r\n]+\]\]|https?:\/\/[^\s<>"']+|<[^>]+>|`[^`]*`|"[^"\n]*"|(?<![A-Za-z0-9])'[^'\n]*'(?![A-Za-z0-9])|„[^“]*“|“[^”]*”|«[^»]*»|「[^」]*」|『[^』]*』/g;
  const text = String(value); let end = 0, output = '';
  let match;
  while ((match = re.exec(text))) { output += transform(text.slice(end, match.index), false) + match[0]; end = re.lastIndex; }
  return output + transform(text.slice(end), true);
}
function maintenanceStylePunctuation_(value) {
  return maintenanceStyleProtectedTransform_(value, function (part) { return part.replace(/。/g, '．').replace(/、/g, '，'); });
}
function maintenanceStyleSentenceStem_(value) {
  return maintenanceStyleProtectedTransform_(String(value), function (part, last) { return last ? part.replace(/[．。]+$/, '') : part; });
}
function maintenanceStyleSentence_(value) {
  const stem = maintenanceStyleSentenceStem_(value);
  return /https?:\/\/[^\s<>"']+$|\[\[score:[^\]]+\]\]$|`[^`]*`$/.test(stem) ? stem : stem + '．';
}
function maintenanceStyleForeignList_(value) {
  const parts = (Array.isArray(value) ? value : [value || '']).flatMap(function (item) { return String(item).split(/[,，、;\r\n]+/); });
  return Array.from(new Set(parts.map(function (part) { return part.trim(); }).filter(Boolean))).join(', ');
}
function maintenanceStyleEquivalents_(text) {
  const result = { english: '', italian: '', groups: [] }, first = String(text || '').trim().split(/\n\s*\n/)[0];
  if (!/^(?:【英】|【伊】|Italian:)/.test(first)) return result;
  first.split('\n').forEach(function (line) {
    if (!/^(?:【英】|【伊】|Italian:)/.test(line)) return;
    const english = line.match(/【英】(.*?)(?=／?【伊】|$)/), italian = line.match(/【伊】(.*)$/), enItalian = line.match(/^Italian:\s*(.*)$/);
    const group = { english: english ? maintenanceStyleForeignList_(english[1].replace(/／$/, '')) : '',
      italian: maintenanceStyleForeignList_(italian ? italian[1] : enItalian ? enItalian[1] : '') };
    result.groups.push(group);
  });
  result.english = maintenanceStyleForeignList_(result.groups.map(function (group) { return group.english; }));
  result.italian = maintenanceStyleForeignList_(result.groups.map(function (group) { return group.italian; }));
  return result;
}
function maintenanceStyleKnown_(ja, en) {
  const a = maintenanceStyleEquivalents_(ja), b = maintenanceStyleEquivalents_(en);
  return { english: a.english, italian: maintenanceStyleForeignList_((a.italian || b.italian).replace(/〔[^〕]*〕/g, '')),
    groups: a.groups.length ? a.groups : b.groups };
}
function maintenanceStyleNotesPrefix_(english, italian, headword) {
  if (maintenanceStyleCatalogue_(headword)) return '';
  const en = maintenanceStyleForeignList_(english), it = maintenanceStyleForeignList_(italian);
  return [en ? '【英】' + en : '', it ? '【伊】' + it : ''].filter(Boolean).join('／');
}
function maintenanceStyleNotesBody_(candidate) {
  const meanings = String(candidate.translation || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
  if (meanings.length > 10) throw new Error('一般的な意味は10項目以内にしてください．');
  if (maintenanceStyleCatalogue_(candidate.headword)) {
    return maintenanceStylePunctuation_(meanings.join('\n') + (candidate.comment ? '\n\n' + candidate.comment : ''));
  }
  const numbers = '①②③④⑤⑥⑦⑧⑨⑩';
  const numbered = meanings.map(function (line, i) { return numbers[i] + ' ' + maintenanceStyleSentence_(line.replace(/^[①-⑩]\s*/, '')); }).join('\n');
  const music = String(candidate.musicExamples || '').split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean)
    .map(function (x) { return /^「[^]*」$/.test(x) ? x : '「' + maintenanceStyleSentenceStem_(x) + '」'; }).join('，');
  const part = maintenanceStyleSentenceStem_(String(candidate.partOfSpeech || '').trim()), inflections = maintenanceStyleSentenceStem_(String(candidate.inflections || '').trim());
  const morphology = inflections && part && inflections.includes(part) ? inflections : [part, inflections].filter(Boolean).join('．');
  return maintenanceStylePunctuation_([
    maintenanceStyleNotesPrefix_(candidate.english, candidate.italian, candidate.headword),
    morphology ? maintenanceStyleSentence_(morphology) : '', '【一般的な意味】\n' + numbered,
    music ? '【音楽用語としての訳例】\n' + music : ''
  ].filter(Boolean).join('\n\n') + (candidate.comment ? '\n\n' + candidate.comment : ''));
}
function maintenanceStyleReferenceTokens_(text) {
  return String(text).match(/\[\[score:[^\]\r\n]+\]\]|https?:\/\/[^\s<>"'\)）]+|<\/?[a-zA-Z][^>]*>|《[^》]+》|\[(?!\[)[A-Z][A-Za-z0-9_-]*(?::[^\]\r\n]+)?\]/g) || [];
}
function maintenanceStyleRules_(tab, profile) {
  const common = [
    'APIはこの会話や現行シートを自動では知らない．ここに渡すルールと採用済みja/en例だけを様式の根拠にする．',
    '例は書式・粒度だけの見本．例の内容，登場人物，作品，出典，頁や解説を新項目へ流用しない．',
    '日本語の本文は「，」「．」．外国語原文・引用・URL・コード・譜例トークン・HTMLは機械的に変換しない．',
    '固有名詞は原語．作曲者はRS，Hindemith，Bruckner，Karg-Elert等の現行表記を使い，日本語の前後は半角スペースで区切る．',
    '曲名は入力文脈のOthers採用表記を原綴りのまま保持し，入力にない曲名表記・plate番号を補わない．出典・曲・楽章・小節・頁・PDFリンクを捏造しない．',
    '「意味が近い表現を挙げている．」等の一般的な断り書き，独自の参考説明，ボタン用文言を追加しない．項目固有の意味・用法説明は保持する．'
  ];
  if (tab === 'Notes') return common.concat([
    'Notesは辞書本文または項目固有の注記．短訳用の汎用テンプレートでは処理しない．現在のprofile=' + profile + 'に従う．',
    '日本語の外国語列挙は【英】…／【伊】…から開始し，「対応する表現：」を付けない．列挙の区切りはASCII comma+space ", "．',
    '英語本文に英語対応の列挙は不要．根拠のある既存または新規提案のイタリア語対応はItalian: …を先頭に置く．Corresponding expressions:は不要．',
    '複数行・複数義に分かれた既存の対応はknown_equivalents.groupsを見てすべて保持する．Italian:行は根拠のある語をcomma+spaceで並べ，意味ごとの固有注記は本文で訳して残す．',
    '既存本文の英訳・注記では元々ない英伊対応を形式のために追加しない．ただしnew_dictionary=trueの新規辞書項目は別で，見出し語そのものの確かな英伊対応をnotes_supportに根拠説明付きで提案する．空欄だからという理由だけで省略しない．不確かな対応は保留し，模範例の対応語を流用しない．',
    '新規辞書項目の音楽用例を出典別に分ける場合，独立した見出しは[GM]，[RW: Oper]，[RS: Oper]を使う．sourceとusage_idsで確認できる採用実例の範囲だけを示し，文中の出典記号・譜例・URL・引用・HTMLは変更しない．',
    '新規Notesの音楽用語としての訳例では，原文使用例とその訳だけで伝わる箇所はその対だけを示す．「舞台指示では〜を表す使用例がある」等，続く用例の内容を先取り・言い換える説明的な導入文は付けない．日本語・英語とも同じ方針にする．',
    'ただし個別の用例だけでは伝わらない奏法上の意味・条件等，入力に根拠のある必要な情報は保持し，説明を一律に削らない．原文使用例は渡された採用実例の原文を保持し，その文脈に忠実な訳と対応させる．原文・使用例・出典・使用箇所や根拠を作り足さない．既存本文や保存済み草案をこの方針で自動改稿しない．',
    'AV/TrV等の作品目録略号に対応表現欄を作らない．',
    profile === 'dictionary' ? '辞書項目は一般義と音楽語義を区別する．新規日本語は【一般的な意味】，英語は【General meanings】を置く．usage_examplesがあれば【音楽用語としての訳例】／【Musical translation examples】で使用文脈ごとの訳を扱う．一語訳だけで済ませず，渡された原文使用例と文脈に合う訳を示す．弦名・開放弦・調弦・奏法等の違いも，用例と訳で伝わる内容を重ねて説明しない．既存本文の英訳は段落・意味の粒度を保持し，新しい解説を足さない．' : '既存の項目固有説明・注記の構成を保持する．不要な辞書見出しや意味区分を一律に足さない．'
  ]);
  return common.concat([
    tab + 'の原文翻訳．Notes風の【一般的な意味】・外国語対応欄・長い辞書解説を追加しない．',
    '短い語句は採用例同様に短い訳語・演奏指示とし，括弧・段落・文末は原文と現行例の粒度に合わせる．短い指示句に句点を一律追加しない．',
    tab === 'GM' ? 'GMのdataは入力された使用箇所の文脈だけに使い，楽器・小節や指示対象を推測して追加しない．' : tab + 'のOper/Aufzug/Szene/page/whom/whom_enをこのタブの文脈として使う．別作品・別タブから人物や指示対象を増減しない．'
  ]);
}
function maintenanceStyleExamples_(book, tab, excludedRow, profile) {
  const sheet = book.getSheetByName(tab), terms = MAINTENANCE_STYLE_EXAMPLE_TERMS[tab];
  if (!sheet || !terms) throw new Error('現行採用例を確認できません．');
  const count = Math.min(tab === 'Notes' ? 2000 : 200, Math.max(0, sheet.getLastRow() - 1));
  const rows = namedSheetRead_(sheet, ['de', 'ja', 'en'], 2, count).values;
  const examples = [];
  const wanted = tab === 'Notes' && profile === 'catalogue' ? ['AV'] : terms.filter(function (term) { return term !== 'AV'; });
  wanted.forEach(function (term) {
    if (examples.length >= 2) return;
    const index = rows.findIndex(function (r, i) { return r[0] === term && i + 2 !== excludedRow && r[1] && r[2]; });
    if (index < 0) return;
    const row = rows[index];
    const ja = profile === 'catalogue' ? String(row[1]).split(/\n\s*\n/)[0] : String(row[1]);
    const en = profile === 'catalogue' ? String(row[2]).split(/\n\s*\n/)[0] : String(row[2]);
    if (ja.length > 700 || en.length > 900 || /https?:|\S+@\S+|対応する表現：|Corresponding expressions:|意味が近い表現を挙げ/.test(ja + en)) return;
    examples.push({ de: term, ja: ja, en: en, purpose: 'style_only', columns: 'current ja/en', excerpt: profile === 'catalogue' });
  });
  if (!examples.length) throw new Error('安全な現行ja/en採用例が見つかりません．原文・訳文と見出しを確認してください．');
  return examples;
}
function maintenanceStyleValidate_(text, language, options) {
  const value = String(text), basis = String(options.basis || ''), notes = options.tab === 'Notes';
  let prose = '';
  maintenanceStyleProtectedTransform_(value, function (part) { prose += part; return part; });
  if (/対応する表現\s*[:：]|Corresponding expressions\s*:/i.test(prose)) throw new Error('対応表現の前置きは現行書式では使用しません．');
  const disclaimer = /意味が近い表現を挙げている|意味の近い表現を挙げている|用法に応じて，意味が近い表現を挙げている|expressions? (?:with|of) similar meanings? (?:are|have been) (?:listed|given)|these expressions are similar in meaning|the choice depends on the sense and context/i;
  if (disclaimer.test(prose)) throw new Error('一般的な断り書きを追加しないでください．');
  if (language === 'ja') {
    const withoutLists = value.split('\n').filter(function (line) { return !/^(?:【英】|【伊】)/.test(line); }).join('\n');
    if (maintenanceStylePunctuation_(withoutLists) !== withoutLists) throw new Error('日本語本文の句読点は「，」「．」にしてください（引用・URL等は保持）．');
    if (/[\u3040-\u30ff\u3400-\u9fff][,.]|[,.][\u3040-\u30ff\u3400-\u9fff]/.test(prose.split('\n').filter(function (line) { return !/^(?:【英】|【伊】)/.test(line); }).join('\n'))) throw new Error('日本語本文にASCIIの句読点を一律使用しないでください．');
    const unquoted = maintenanceStyleProtectedTransform_(value, function (part) { return part.replace(/シュトラウス|ヒンデミット|ブルックナー|カルク[＝・\-]?エラート/g, '\u0001'); });
    if (unquoted.includes('\u0001')) throw new Error('作曲者の固有名詞は現行の原語表記にしてください．');
    if (/[\u3040-\u30ff\u3400-\u9fff](?:RS|Hindemith|Bruckner|Karg-Elert)|(?:RS|Hindemith|Bruckner|Karg-Elert)[\u3040-\u30ff\u3400-\u9fff]/.test(prose)) throw new Error('日本語と原語の固有名詞の間に半角スペースを入れてください．');
  }
  if (/\bplate\s*(?:no\.?|number|\d)|プレート番号/i.test(value) && !/\bplate\b|プレート番号/i.test(basis)) throw new Error('plate番号を付け足さないでください．');
  if (!notes) {
    if (/^(?:訳(?:文)?|日本語訳|Translation|Meaning|意味|説明)\s*[:：]/i.test(value) && !/^(?:訳(?:文)?|日本語訳|Translation|Meaning|意味|説明)\s*[:：]/i.test(basis)) throw new Error('訳文に独自の見出しを付け足さないでください．');
    if (/【(?:一般的な意味|音楽用語としての訳例|英|伊)】|Italian:|General meanings|Musical translation examples/.test(value)) throw new Error('演奏指示にNotes用の辞書書式を追加しないでください．');
    const short = String(options.de || '').length < 80 && String(options.de || '').trim().split(/\s+/).length <= 4 && !/[.!?;:]\s*$/.test(String(options.de || '')) && !/\n/.test(basis);
    if (short && (/\n/.test(value) || value.length > Math.max(100, basis.length * 5))) throw new Error('短い演奏指示に冗長な説明を追加しないでください．');
    if (language === 'ja' && short && /[．。.]$/.test(value) && !/[．。.]$/.test(basis)) throw new Error('短い指示句の文末に句点を一律追加しないでください．');
    return text;
  }
  const equivalents = maintenanceStyleEquivalents_(value), known = options.known || { english: '', italian: '' };
  if (/^\s*[(（]≒/.test(value)) throw new Error('旧様式の対応語行ではなく現行の【英】／【伊】書式を使用してください．');
  if (maintenanceStyleCatalogue_(options.de) && /【英】|【伊】|^Italian:|^English:/m.test(prose)) throw new Error('作品目録略号に対応表現欄は不要です．');
  if (language === 'en' && /【英】|【伊】|^English:/m.test(prose)) throw new Error('英語本文に英語対応の列挙は不要です．');
  if (/【英】|【伊】|^Italian:/m.test(prose)) {
    const first = value.split('\n')[0];
    const expected = language === 'ja' ? maintenanceStyleNotesPrefix_(equivalents.english, equivalents.italian, options.de) : 'Italian: ' + equivalents.italian;
    if (first !== expected || !expected.trim()) throw new Error('外国語列挙は現行の先頭行とASCII comma+spaceで記述してください．');
    if (options.restrictEquivalents && ((equivalents.english && equivalents.english !== known.english) || (equivalents.italian && equivalents.italian !== known.italian))) throw new Error('根拠のない英伊対応を追加しないでください．');
  }
  if (language === 'en' && known.italian && !maintenanceStyleCatalogue_(options.de) && !value.startsWith('Italian: ' + known.italian + '\n')) throw new Error('入力にあるイタリア語対応をItalian:で保持してください．');
  if (options.requireEquivalents && language === 'ja' && (known.english || known.italian) &&
      !value.startsWith(maintenanceStyleNotesPrefix_(known.english, known.italian, options.de) + '\n')) throw new Error('確認用の英伊対応語案を日本語本文の先頭に保持してください．');
  if (options.newBody && options.profile === 'dictionary' && !value.includes(language === 'ja' ? '【一般的な意味】' : '【General meanings】')) throw new Error('新規Notesの辞書本文に一般的な意味の見出しがありません．');
  if (options.requireMusicExamples && !value.includes(language === 'ja' ? '【音楽用語としての訳例】' : '【Musical translation examples】')) throw new Error('採用実例を踏まえた音楽用語の訳例を確認してください．');
  return text;
}
