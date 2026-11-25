/** Direct new Notes drafting. Drafts live in the dialog, never in a ledger. */
function directMaintenanceNotesText_(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 6000 || /^[=+@]/.test(value) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error('日英本文を入力してください（各6000文字以内）．');
  try { encodeURIComponent(value); } catch (_) { throw new Error('本文に不正な文字があります．'); }
  return value;
}
function directMaintenanceNotesExisting_(sheet, term) {
  return notesSheetRows_(sheet.getDataRange().getValues()).find(function (row) {
    return normalizeObservedTerm(row.values.de) === normalizeObservedTerm(term);
  });
}
// Public-facing examples come from the corpus, not from model-formatted location fields.
function directMaintenanceDraftExamples_(text, field, examples) {
  const en = field === 'en';
  const heading = en ? '【Examples in musical contexts】' : '【音楽用語としての訳例】';
  const aliases = [heading, en ? '【Musical translation examples】' : heading];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const body = [];
  let inExamples = false, insertion = -1;
  lines.forEach(function (line) {
    const section = line.trim().replace(/^〖([^〗]+)〗$/, '【$1】');
    if (aliases.includes(section)) {
      if (insertion === -1) insertion = body.length;
      inExamples = true;
      return;
    }
    if (section === '【参考資料】' || section === '【References】') {
      inExamples = true; // The API has no independently verified score pages to cite.
      return;
    }
    if (/^【[^】]+】$/.test(section)) inExamples = false;
    if (!inExamples) body.push(line);
  });
  if (!examples.length) return body.join('\n').trim();
  if (insertion === -1) {
    insertion = body.findIndex(function (line) { return /^(?:【|〖)(?:補足|Usage notes|参考資料|References)(?:】|〗)$/.test(line.trim()); });
    if (insertion === -1) insertion = body.length;
  }
  const block = [heading];
  const markers = { GM: '[GM]', RW: '[RW: Oper]', RS: '[RS: Oper]' };
  let previous = '';
  examples.forEach(function (example) {
    if (!Object.prototype.hasOwnProperty.call(markers, example.tab)) return;
    if (example.tab !== previous) block.push(markers[example.tab]);
    block.push((en ? 'German: ' : '') + example.de, (en ? 'English: ' : '') + example[field], '');
    previous = example.tab;
  });
  return body.slice(0, insertion).concat(block, body.slice(insertion)).join('\n').trim();
}
function directMaintenanceDraft(term) {
  term = directMaintenanceTerm_(term);
  const book = rowCompletionBook_(), sheet = book.getSheetByName('Notes');
  if (!sheet) throw new Error('Notesがありません．');
  if (directMaintenanceNotesExisting_(sheet, term)) throw new Error('Notesに登録済みです．既存項目の編集・補完へ進んでください．');
  const plan = maintenanceNotesSource_(book, term, 'alias');
  const row = { tab: 'Notes', number: 0, targets: ['ja', 'en'], draft: {},
    snapshot: { values: { de: plan.de, ja: '', en: '', source: plan.source }, formulas: {} } };
  const props = PropertiesService.getScriptProperties(), key = String(props.getProperty('OPENAI_API_KEY') || '').trim(), model = String(props.getProperty('OPENAI_DRAFT_MODEL') || '').trim();
  if (!key || !model) throw new Error('OpenAI APIのキー・モデルが未設定です．');
  const context = rowCompletionNotes_(book, row);
  let draft;
  try {
    const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
      method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + key },
      payload: JSON.stringify(rowCompletionRequest_({ tab: 'Notes', directNotesDraft: true }, row, model, context)), muteHttpExceptions: true });
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) throw new Error('http');
    const body = JSON.parse(response.getContentText());
    if (!body || body.status !== 'completed') throw new Error('incomplete');
    draft = JSON.parse((body.output || []).flatMap(function (item) { return item.content || []; })
      .filter(function (part) { return part.type === 'output_text'; }).map(function (part) { return part.text; }).join(''));
    directMaintenanceNotesText_(draft.ja); directMaintenanceNotesText_(draft.en);
  } catch (_) { throw new Error('APIから日英案を取得できませんでした．Notesは変更していません．再試行は草案作成ボタンから行えます．'); }
  const warnings = [];
  const examples = (context.domain && context.domain.usage_examples) || [];
  ['ja', 'en'].forEach(function (field) {
    draft[field] = directMaintenanceDraftExamples_(draft[field], field, examples);
    if (/https?:\/\//i.test(draft[field])) {
      throw new Error('未確認のURLが草案に含まれていました．Notesは変更していません．草案を作り直してください．');
    }
    const heading = field === 'ja' ? '補足' : 'Usage notes';
    if (examples.length && !draft[field].split('\n').some(function (line) {
      return line.trim() === '【' + heading + '】' || line.trim() === '〖' + heading + '〗';
    })) warnings.push(field === 'ja' ? '日本語の【補足】に，実例での意味・訳し分けを補ってください．' :
      '英語の【Usage notes】に，実例での意味・訳し分けを補ってください．');
  });
  // Style/evidence checks are editing advice, not a historical reservation or a new approval step.
  try {
    if (rowCompletionNewNotes_(row)) row.notesSupport = rowCompletionNotesSupport_(draft.notes_support, context);
    ['ja', 'en'].forEach(function (field) {
      draft[field] = rowCompletionNotesFormatHeadings_(row, field, draft[field]);
      try { rowCompletionValidateText_(row, field, draft[field]); } catch (error) { warnings.push(String(error.message)); }
    });
  } catch (error) { warnings.push(String(error.message)); }
  const provenance = notesExamplePrepare_(book, draft, null, true);
  if (examples.length && ['ja', 'en'].some(function (field) { return provenance[field].ranges.length < examples.length; })) {
    warnings.push('作品名を確定できない実例があります．管理番号の代わりに推測した作品名を入れず，実例と使用楽譜を確認してください．');
  }
  draft.ja = provenance.ja.text; draft.en = provenance.en.text;
  return { term: term, de: plan.de, source: plan.source, ja: draft.ja, en: draft.en,
    warnings: warnings, linkAdvisory: maintenanceNotesLinkAdvisory_(plan, draft.en) };
}
function directMaintenanceNotesSave(term, fields) {
  term = directMaintenanceTerm_(term);
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error('日英本文を確認してください．');
  let ja = directMaintenanceNotesText_(fields.ja), en = directMaintenanceNotesText_(fields.en);
  const book = rowCompletionBook_(), lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('別の保存中です．少し待って再度登録してください．');
  try {
    const sheet = book.getSheetByName('Notes');
    if (!sheet) throw new Error('Notesがありません．');
    const existing = directMaintenanceNotesExisting_(sheet, term);
    if (existing) return { status: 'existing', row: existing.number, term: existing.values.de };
    const plan = maintenanceNotesSource_(book, term, 'alias');
    const layout = namedSheetColumns_(sheet, ['de', 'ja', 'en', 'source']);
    const provenance = notesExamplePrepare_(book, { ja: ja, en: en }, null, true);
    ja = directMaintenanceNotesText_(provenance.ja.text); en = directMaintenanceNotesText_(provenance.en.text);
    const values = [plan.de, ja, en, plan.source], number = sheet.getLastRow() + 1;
    if (number > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 1);
    const cells = Array(sheet.getLastColumn()).fill('');
    layout.positions.forEach(function (column, i) { cells[column] = values[i]; });
    const range = sheet.getRange(number, 1, 1, cells.length);
    if ((typeof range.canEdit === 'function' && !range.canEdit()) || (typeof range.isPartOfMerge === 'function' && range.isPartOfMerge())) throw new Error('Notesの追加行へ書き込めません．');
    const rich = cells.map(function (value) { return SpreadsheetApp.newRichTextValue().setText(value).build(); });
    rich[layout.positions[1]] = notesExampleRich_(provenance.ja, 'ja');
    rich[layout.positions[2]] = notesExampleRich_(provenance.en, 'en');
    range.setRichTextValues([rich]);
    SpreadsheetApp.flush();
    const saved = directMaintenanceNotesExisting_(sheet, plan.de);
    if (!saved || saved.values.ja !== ja || saved.values.en !== en || saved.values.source !== plan.source) throw new Error('保存結果を確認できません．Notesを確認してください．再実行しても既存行は上書きしません．');
    return { status: 'saved', row: saved.number, term: plan.de };
  } finally { lock.releaseLock(); }
}
