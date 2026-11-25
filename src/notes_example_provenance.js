/** Deterministic example-level provenance. No API, saved state, or writes while preparing text. */
function notesExampleKey_(value) { return String(value || '').normalize('NFC').replace(/\r\n/g, '\n').trim(); }
function notesExampleWorks_(book) {
  const map = Object.create(null), sheet = book.getSheetByName('楽譜情報');
  if (!sheet) return map;
  const rows = sheet.getDataRange().getValues(), header = rows[0] || [];
  const columns = ['Oper', 'Composer', 'Opera_Title', 'Work_Number'].map(function (key) { return header.indexOf(key); });
  if (columns.some(function (i) { return i < 0; })) return map;
  rows.slice(1).forEach(function (row) {
    const code = notesExampleKey_(row[columns[0]]), composer = notesExampleKey_(row[columns[1]]);
    const title = notesExampleKey_(row[columns[2]]), number = notesExampleKey_(row[columns[3]]);
    // Japanese catalogue titles supply the original-language title in final parentheses.
    const match = title.match(/[（(]([^（）()]+)[）)]$/);
    const original = match ? match[1].trim() : /^[A-Za-zÀ-ž]/.test(title) && !/[\u3040-\u30ff\u3400-\u9fff]/.test(title) ? title : '';
    const tab = composer === 'Richard Wagner' ? 'RW' : composer === 'Richard Strauss' ? 'RS' : '';
    if (!code || !tab || !original || /[\r\n<>]|\[\[/.test(original + number)) return;
    const key = tab + ':' + code, work = { title: original, number: number };
    if (!Object.prototype.hasOwnProperty.call(map, key)) map[key] = work;
    else if (JSON.stringify(map[key]) !== JSON.stringify(work)) map[key] = null;
  });
  return map;
}
function notesExampleGmWorks_(data, catalogTitles) {
  const names = { a: 'Das Lied von der Erde', b1: 'Das klagende Lied（1880年版）', b2: 'Das klagende Lied（1899年版）',
    c: 'Lieder eines fahrenden Gesellen', d: 'Des Knaben Wunderhorn', e: 'Kindertotenlieder',
    f: 'Fünf Rückert-Lieder', g: 'Blumine', h: 'Totenfeier' };
  // Canonical new-entry labels follow 「使用楽譜」, including the two distinct tenth-symphony entries.
  const catalog = {
    1: 'SYMPHONIE I (Revidierte Fassung)', 2: 'SYMPHONIE II (Revidierte Fassung)',
    3: 'SYMPHONIE III (Revidierte Fassung)', 4: 'SYMPHONIE IV (Endgültige Fassung)',
    5: 'SYMPHONIE V (Revidierte Fassung)', 6: 'SYMPHONIE VI (Revidierte Ausgabe)',
    7: 'SYMPHONIE VII (Revidierte Fassung)', 8: 'SYMPHONIE VIII (Revidierte Fassung)',
    9: 'SYMPHONIE IX (Revidierte Fassung)', 101: 'Adagio aus der Symphonie Nr. 10',
    102: 'a performing version of the draft for the TENTH SYMPHONY（Deryck Cooke）',
    a: 'DAS LIED VON DER ERDE', b1: 'Das Klagende Lied Fassung 1880 in drei Sätzen',
    b2: 'Das Klagende Lied Fassung 1899 in zwei Sätzen', f: 'Lieder nach Texten von Friedrich Rückert',
    g: 'Symphonischer Satz „Blumine“'
  };
  const works = [];
  for (const record of String(data || '').split('&').filter(Boolean)) {
    const match = record.trim().match(/^M-(1|2|3|4|5|6|7|8|9|101|102|a|b1|b2|c|d|e|f|g|h)-[^\s]+$/);
    if (!match) return []; // Never label only the known part of a mixed/unknown work cell.
    const code = match[1], title = (catalogTitles && catalog[code]) || names[code] || ('Symphonie Nr. ' + (code === '101' || code === '102' ? '10' : code));
    works.push({ title: title, number: '' });
  }
  return works;
}
function notesExampleEvidence_(book, fields, catalogTitles) {
  const evidence = [], text = String(fields.ja || '') + '\n' + String(fields.en || '');
  if (typeof namedSheetRead_ !== 'function') return evidence;
  const works = notesExampleWorks_(book);
  ['GM', 'RW', 'RS'].forEach(function (tab) {
    if (!(tab === 'GM' ? /(?:^|\n)\[GM\](?:\r?\n|$)/ : new RegExp('(?:^|\\n)\\[' + tab + ': Oper\\](?:\\r?\\n|$)')).test(text)) return;
    const sheet = book.getSheetByName(tab);
    if (!sheet || sheet.getLastRow() < 2 || sheet.getLastRow() > 10001) return;
    const names = tab === 'GM' ? ['de', 'ja', 'en', 'data'] : ['de', 'ja', 'en', 'Oper'];
    let rows;
    try { rows = namedSheetRead_(sheet, names, 2, sheet.getLastRow() - 1).values; } catch (_) { return; }
    rows.forEach(function (row) {
      const titles = tab === 'GM' ? notesExampleGmWorks_(row[3], catalogTitles) : [works[tab + ':' + notesExampleKey_(row[3])]].filter(Boolean);
      if (!notesExampleKey_(row[0])) return;
      evidence.push({ tab: tab, de: notesExampleKey_(row[0]), ja: notesExampleKey_(row[1]), en: notesExampleKey_(row[2]), works: titles });
    });
  });
  return evidence;
}
function notesExampleCitation_(works, language) {
  return works.map(function (work) {
    const title = language === 'en' ? work.title.replace('（1880年版）', ' (1880 version)').replace('（1899年版）', ' (1899 version)') : work.title;
    return language === 'ja' ? '《' + title + '》' + (work.number ? ' ' + work.number : '') : title + (work.number ? ', ' + work.number : '');
  }).join(language === 'ja' ? ' ／ ' : '; ');
}
function notesExamplePlan_(text, language, evidence, previous) {
  const lines = String(text || '').split('\n'), changes = [], ranges = [], oldPairs = new Set();
  const groups = Object.create(null), originals = Object.create(null);
  evidence.forEach(function (example) {
    const key = JSON.stringify([example.tab, example.de]);
    if (!originals[key]) originals[key] = { tab: example.tab, de: example.de, works: [], unknown: false };
    const original = originals[key];
    if (!example.works.length) original.unknown = true;
    example.works.forEach(function (work) {
      if (!original.works.some(function (w) { return JSON.stringify(w) === JSON.stringify(work); })) original.works.push(work);
    });
  });
  evidence.forEach(function (example) {
    if (!example[language]) return;
    const key = JSON.stringify([example.tab, example.de, example[language]]);
    if (!groups[key]) groups[key] = { tab: example.tab, de: example.de, translation: example[language], works: [], unknown: false, key: key };
    if (!example.works.length) groups[key].unknown = true;
    example.works.forEach(function (work) {
      if (!groups[key].works.some(function (w) { return JSON.stringify(w) === JSON.stringify(work); })) groups[key].works.push(work);
    });
  });
  // Translation variants must never attribute the same original to conflicting works.
  const all = Object.keys(groups).map(function (key) { return groups[key]; }).filter(function (group) {
    const original = originals[JSON.stringify([group.tab, group.de])];
    return !original.unknown && group.works.length === original.works.length && original.works.every(function (work) {
      return group.works.some(function (w) { return JSON.stringify(w) === JSON.stringify(work); });
    });
  });
  const unique = Object.keys(originals).map(function (key) { return originals[key]; }).filter(function (original) {
    return !original.unknown && original.works.length === 1;
  });
  function matchesAt(input, start, content, label) {
    const expected = content.split('\n');
    if (start + expected.length > input.length) return false;
    return expected.every(function (value, i) {
      const actual = i === 0 && label ? input[start + i].replace(label, '') : input[start + i];
      return notesExampleKey_(actual.replace(/\[\[nolink:([^\]\r\n]+)\]\]/g, '$1')) === value;
    });
  }
  function scan(input, visit) {
    let tab = '', fence = '';
    for (let i = 0; i < input.length; i++) {
      const line = input[i].trim(), delimiter = line.match(/^(`{3,}|~{3,})/);
      if (delimiter) { if (!fence) fence = delimiter[1][0]; else if (delimiter[1][0] === fence) fence = ''; continue; }
      if (fence) continue;
      const marker = line.match(/^\[(GM|RW: Oper|RS: Oper)\]$/);
      if (marker) { tab = marker[1].slice(0, 2); continue; }
      if (/^【[^】]+】$/.test(line)) { tab = ''; continue; }
      if (!tab) continue;
      let matches = all.filter(function (group) {
        if (group.tab !== tab || !matchesAt(input, i, group.de, language === 'en' ? /^\s*German:\s*/ : null)) return false;
        return matchesAt(input, i + group.de.split('\n').length, group.translation, language === 'en' ? /^\s*English:\s*/ : null);
      });
      if (!matches.length) {
        matches = unique.filter(function (original) {
          return original.tab === tab && matchesAt(input, i, original.de, language === 'en' ? /^\s*German:\s*/ : null);
        }).map(function (original) {
          const translation = input[i + original.de.split('\n').length] || '';
          const value = notesExampleKey_(translation.replace(language === 'en' ? /^\s*English:\s*/ : /$^/, ''));
          // Unknown multiline boundaries and citation-only blocks are left untouched.
          if (!value || /^\[|^【|^《|^(?:German|Source|Work):/.test(value) || original.works.some(function (work) { return value.startsWith(work.title); })) return null;
          return { tab: original.tab, de: original.de, translation: value, works: original.works, unknown: false,
            key: JSON.stringify([original.tab, original.de, value]) };
        }).filter(Boolean);
      }
      if (matches.length !== 1) continue;
      const group = matches[0], end = i + group.de.split('\n').length + group.translation.split('\n').length;
      visit(group, end, input); i = end - 1;
    }
  }
  if (typeof previous === 'string') scan(previous.split('\n'), function (group) { oldPairs.add(group.key); });
  scan(lines, function (group, end, input) {
    if (!group.works.length || group.unknown) return;
    const citation = notesExampleCitation_(group.works, language), next = input[end] || '';
    if (notesExampleKey_(next) === citation) { ranges.push({ line: end, text: next }); return; }
    if (oldPairs.has(group.key)) return;
    // An existing immediate continuation/citation belongs to the user; never replace it.
    if (next.trim() && !/^\[(?:GM|RW: Oper|RS: Oper)\]$|^【[^】]+】$/.test(next.trim())) return;
    const later = input.slice(end).find(function (line) { return line.trim(); }) || '';
    if (/^\s*(?:《|出典[:：]|Source:|Work:)/.test(later) || notesExampleKey_(later) === citation ||
        group.works.some(function (work) { return later.trim().startsWith(work.title); })) return;
    changes.push({ line: end, text: citation });
  });
  // Offsets are UTF-16, matching Apps Script RichTextValue offsets.
  let output = '', styled = [];
  for (let i = 0; i <= lines.length; i++) {
    changes.filter(function (x) { return x.line === i; }).forEach(function (change) {
      if (output && !output.endsWith('\n')) output += '\n';
      const start = output.length; output += change.text + '\n'; styled.push({ start: start, end: start + change.text.length });
    });
    if (i === lines.length) break;
    const range = ranges.find(function (x) { return x.line === i; });
    if (range) styled.push({ start: output.length, end: output.length + lines[i].length });
    output += lines[i] + (i < lines.length - 1 ? '\n' : '');
  }
  if (changes.some(function (x) { return x.line === lines.length; })) output = output.replace(/\n$/, '');
  return { text: output, ranges: styled, added: changes.length };
}
function notesExamplePrepare_(book, fields, previous, catalogTitles) {
  const evidence = notesExampleEvidence_(book, fields, catalogTitles), result = {};
  ['ja', 'en'].forEach(function (field) { result[field] = notesExamplePlan_(fields[field], field, evidence, previous && previous[field]); });
  return result;
}
function notesExampleRich_(plan, language, old) {
  const builder = SpreadsheetApp.newRichTextValue().setText(plan.text);
  // Preserve links/styles in unchanged prefixes and suffixes of an edited cell.
  if (old && old.getText && old.getRuns) {
    const before = old.getText(); let prefix = 0, suffix = 0;
    while (prefix < before.length && prefix < plan.text.length && before[prefix] === plan.text[prefix]) prefix++;
    while (suffix < before.length - prefix && suffix < plan.text.length - prefix && before[before.length - 1 - suffix] === plan.text[plan.text.length - 1 - suffix]) suffix++;
    const segments = [[0, prefix, 0], [before.length - suffix, before.length, plan.text.length - before.length]];
    // Multiple insertions need more than prefix/suffix preservation: retain unique unchanged interior lines too.
    function locations(value) {
      const found = Object.create(null); let offset = 0;
      value.split('\n').forEach(function (line) { if (line) { if (!found[line]) found[line] = []; found[line].push(offset); } offset += line.length + 1; });
      return found;
    }
    const oldLines = locations(before), newLines = locations(plan.text);
    Object.keys(oldLines).forEach(function (line) {
      if (oldLines[line].length === 1 && newLines[line] && newLines[line].length === 1) {
        const start = oldLines[line][0];
        if (start >= prefix && start + line.length <= before.length - suffix) segments.push([start, start + line.length, newLines[line][0] - start]);
      }
    });
    old.getRuns().forEach(function (run) {
      segments.forEach(function (part) {
        const start = Math.max(run.getStartIndex(), part[0]), end = Math.min(run.getEndIndex(), part[1]);
        if (end <= start) return;
        builder.setTextStyle(start + part[2], end + part[2], run.getTextStyle());
        if (run.getLinkUrl()) builder.setLinkUrl(start + part[2], end + part[2], run.getLinkUrl());
      });
    });
  }
  const style = SpreadsheetApp.newTextStyle().setFontFamily(language === 'ja' ? 'Noto Sans JP' : 'Arial').setFontSize(8).setItalic(language === 'en').build();
  plan.ranges.forEach(function (range) { builder.setTextStyle(range.start, range.end, style); });
  return builder.build();
}
