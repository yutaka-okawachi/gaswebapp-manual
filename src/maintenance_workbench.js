/** Unified maintenance. Confirm complete content before one Notes row write. */
function maintenanceNotesObservation_(id) {
  rowCompletionBook_();
  return candidateWizardFindObservation(id);
}
function maintenanceNotesSource_(book, term) {
  const normalized = normalizeObservedTerm(term), preferred = String(term).trim().normalize('NFC');
  if (!/^[a-z0-9][a-z0-9 -]{1,119}$/.test(normalized)) throw rowCompletionError_('原文の語・句を確認できません．Notesは追加していません．');
  const formsToFind = [normalized, normalized + 'n', normalized + 'en', normalized + 's', normalized + 'es'];
  const boundary = '[^\\p{L}\\p{M}\\p{N}]';
  const pattern = new RegExp('(^|' + boundary + ')(?:' + formsToFind.map(function (form) { return form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')($|' + boundary + ')', 'iu');
  const proof = [], forms = [], markers = [];
  [['RS', '[RS: Oper]'], ['RW', '[RW: Oper]'], ['GM', '[GM]']].forEach(function (definition) {
    const tab = definition[0], sheet = book.getSheetByName(tab);
    if (!sheet || sheet.getLastRow() < 2) return;
    if (sheet.getLastRow() > 6001) throw rowCompletionError_('出典調査の上限を超えています．不確かな出典でNotesを追加しません．');
    const fields = tab === 'GM' ? ['de', 'data'] : ['de', 'Oper', 'Aufzug', 'Szene', 'page', 'whom'];
    const rows = namedSheetRead_(sheet, fields, 2, sheet.getLastRow() - 1).values;
    let selected = null;
    rows.forEach(function (values, index) {
      if (!pattern.test(normalizeObservedTerm(values[0]))) return;
      if (tab === 'GM') {
        if (!String(values[1] || '').trim() || /^(?:不明|未確認|未定|[?？-]+)$/.test(String(values[1]).trim())) return;
      } else if (!String(values[1] || '').trim() || !/^(?:0|[1-9][0-9]{0,5})$/.test(String(values[4]).trim())) return;
      const original = String(values[0]);
      const location = tab === 'GM' ? String(values[1] || '').split('&').filter(Boolean).slice(0, 2).join('&') :
        values.slice(1).map(String).filter(Boolean).join(' / ');
      if (!location || original.length > 6000 || location.length > 240) return;
      const tokens = Array.from(original.matchAll(/[\p{L}\p{M}]+/gu)), rowForms = [];
      for (let i = 0; i < tokens.length; i++) {
        for (let n = 1; n <= 10 && i + n <= tokens.length; n++) {
          const last = tokens[i + n - 1], candidate = original.slice(tokens[i].index, last.index + last[0].length);
          if (normalizeObservedTerm(candidate) === normalized) { rowForms.push(candidate); break; }
        }
      }
      rowForms.forEach(function (form) { forms.push(form); });
      // Inspect every eligible row: a suffix-only hit must not hide a later base form.
      // Prefer the actual requested spelling, then another case of the base form.
      const rank = rowForms.some(function (form) { return form.normalize('NFC') === preferred; }) ? 2 : rowForms.length ? 1 : 0;
      if (!selected || rank > selected.rank) selected = { values: values, index: index, original: original, location: location, rank: rank };
    });
    if (!selected) return;
    markers.push(definition[1]);
    proof.push({ tab: tab, sheetId: sheet.getSheetId(), number: selected.index + 2, fields: fields,
      hash: rowCompletionHash_(selected.values), german: selected.original.slice(0, 1200), location: selected.location });
  });
  if (!proof.length) throw rowCompletionError_('実例と使用箇所から出典を特定できません．Notesは追加していません．');
  if (!forms.length) throw rowCompletionError_('入力した形そのものを原文で確認できません．見出しを推測せず，語形対応で確認してください．');
  const unique = Array.from(new Set(forms.map(function (form) { return form.normalize('NFC'); })));
  if (new Set(unique.map(function (form) { return form.toLowerCase(); })).size > 1) throw rowCompletionError_('原綴りが複数あります．Notesは追加せず，語形対応で確認してください．');
  const headword = unique.find(function (form) { return form === preferred; }) || unique[0];
  return { de: headword, source: markers.join(', '), proof: proof };
}
function maintenanceNotesVerifySource_(book, plan) {
  plan.proof.forEach(function (item) {
    const sheet = book.getSheetByName(item.tab);
    if (!sheet || sheet.getSheetId() !== item.sheetId) throw rowCompletionError_('出典の対象タブが変わりました．下書きの状態を確認してください．');
    if (rowCompletionHash_(namedSheetRead_(sheet, item.fields, item.number, 1).values[0]) === item.hash) return;
    // A sort can change the position, but never substitute different source text or context.
    if (sheet.getLastRow() > 10000) throw rowCompletionError_('出典の照合範囲を確認できません．');
    const rows = namedSheetRead_(sheet, item.fields, 2, Math.max(0, sheet.getLastRow() - 1)).values;
    const matches = [];
    rows.forEach(function (values, index) { if (rowCompletionHash_(values) === item.hash) matches.push(index + 2); });
    if (matches.length !== 1) throw rowCompletionError_('出典の原文・使用箇所が変わったか，一意に照合できません．下書きの状態を確認してください．');
    item.number = matches[0];
  });
}
function maintenanceNotesNoDuplicate_(book, headword, ownId) {
  const notes = book.getSheetByName('Notes'), normalized = normalizeObservedTerm(headword);
  if (!notes) throw rowCompletionError_('Notesがありません．');
  const duplicates = notesRegistrationRead_(notes).rows.filter(function (row) {
    return normalizeObservedTerm(row.values.de) === normalized && (!ownId || row.entryId !== ownId);
  });
  if (duplicates.length) throw rowCompletionError_('同じ見出しがNotesにあります．新しい行やAPI生成を重ねず，既存行を確認してください．');
  const mapping = book.getSheetByName(EXPERIMENTAL_TERM_MAPPING_SHEET_NAME);
  if (mapping && mapping.getLastRow() > 1 && namedSheetRead_(mapping, ['見出し', '関連語形'], 2, mapping.getLastRow() - 1).values.some(function (r) {
    return normalizeObservedTerm(r[1]) === normalized;
  })) throw rowCompletionError_('登録済みの語形対応があります．Notesを重複登録せず，語形対応を確認してください．');
}
function maintenanceNotesOldWork_(found) {
  const book = found.spreadsheet, reviewSheet = typeof maintenanceLedgerOptionalSheet_ === 'function' ?
    maintenanceLedgerOptionalSheet_(book, JEV_REVIEW_SHEET_NAME, JEV_REVIEW_HEADERS) : book.getSheetByName(JEV_REVIEW_SHEET_NAME);
  if (reviewSheet && found.row[9]) {
    const review = candidateWizardFindLinked(reviewSheet, JEV_REVIEW_HEADERS.length, found.row[9]);
    if (review && review.row[12] === '採用' && review.row[6] !== 'NEW_TERM_CANDIDATE') {
      throw rowCompletionError_('既存見出しへの判定があります．語形対応の確認へ進んでください．');
    }
  }
  const sheet = typeof maintenanceLedgerOptionalSheet_ === 'function' ?
    maintenanceLedgerOptionalSheet_(book, UNREGISTERED_TERM_CANDIDATE_SHEET_NAME, UNREGISTERED_TERM_CANDIDATE_HEADERS) : book.getSheetByName(UNREGISTERED_TERM_CANDIDATE_SHEET_NAME);
  if (!sheet) return;
  const id = dictionaryCandidateRecordId('candidate', normalizeObservedTerm(found.row[2] || found.row[1]));
  const candidate = candidateWizardFindLinked(sheet, UNREGISTERED_TERM_CANDIDATE_HEADERS.length, id);
  if (candidate && typeof maintenanceLedgerAssertCandidateProduction_ === 'function') maintenanceLedgerAssertCandidateProduction_(candidate.row);
  if (candidate && (candidate.row[13] || ['生成中', '結果要確認', '作成済み'].includes(candidate.row[12]))) {
    if (['生成中', '結果要確認'].includes(candidate.row[12])) throw rowCompletionError_('旧草案のAPI結果を先に確認してください．自動再送しません．');
    const details = Object.assign({ headword: String(candidate.row[16] || ''), partOfSpeech: String(candidate.row[17] || ''), inflections: String(candidate.row[18] || ''), translation: String(candidate.row[19] || '') }, candidateWizardDraftDetails(candidate.row[13]));
    if (!details.headword) throw rowCompletionError_('旧候補台帳の草案の内容を確認できません．記録を保持して停止しました．');
    return details;
  }
}
function maintenanceNotesRow_(sheet, entryId) {
  const matches = notesRegistrationRead_(sheet).rows.filter(function (row) { return row.entryId === entryId; });
  if (matches.length > 1) throw rowCompletionError_('管理IDが重複しています．変更せず確認してください．');
  return matches[0] || null;
}
function maintenanceNotesDraftCurrent_(job, row) {
  const book = rowCompletionBook_(), sheet = book.getSheetByName('Notes');
  if (!sheet || sheet.getSheetId() !== job.sheetId || row.number !== 0 ||
      namedSheetColumns_(sheet, ROW_COMPLETION_FIELDS.Notes).signature !== row.snapshot.layout ||
      row.snapshot.values.de !== job.intake.plan.de || row.snapshot.values.source !== job.intake.plan.source) {
    throw rowCompletionError_('原文・出典またはNotesの列構成が変わりました．生成せず確認してください．');
  }
  maintenanceNotesVerifySource_(book, job.intake.plan);
  maintenanceNotesNoDuplicate_(book, job.intake.plan.de, job.intake.entryId);
  return sheet;
}
function maintenanceNotesPrepare_(observationId) {
  return rowCompletionLock_(function () {
    const book = rowCompletionBook_(), previous = rowCompletionStored_(), existing = previous && previous.job;
    if (existing && existing.intake && existing.intake.observationId === observationId) return existing;
    if (existing && !existing.closed) throw rowCompletionError_('別の語または選択行の処理中です．その内容を確認し，登録または終了してから切り替えてください．');
    const found = maintenanceNotesObservation_(observationId);
    const legacy = maintenanceNotesOldWork_(found);
    if (!legacy && !rowCompletionSettings_().ready) throw rowCompletionError_('OpenAIの既存キー・モデルが未設定です．Notesは追加していません．');
    const plan = maintenanceNotesSource_(book, String(found.row[1] || ''));
    maintenanceNotesNoDuplicate_(book, plan.de);
    const sheet = book.getSheetByName('Notes'), snapshot = {
      values: { de: plan.de, ja: '', en: '', source: plan.source },
      formulas: { de: '', ja: '', en: '', source: '' },
      layout: namedSheetColumns_(sheet, ROW_COMPLETION_FIELDS.Notes).signature
    };
    const job = { id: Utilities.getUuid(), book: book.getId(), tab: 'Notes', sheetId: sheet.getSheetId(),
      created: new Date().toISOString(), closed: false, rows: [{
        tab: 'Notes', number: 0, snapshot: snapshot, hash: rowCompletionHash_(snapshot),
        status: 'pending', message: '出典を確認しました．本文案を生成します．Notesはまだ変更していません．',
        draft: {}, targets: ['ja', 'en']
      }], intake: { observationId: observationId, entryId: 'notes-' + Utilities.getUuid(),
        flow: 'review_before_insert', phase: 'ready', plan: plan,
        message: '出典調査と日英案の生成を続けます．内容を承認するまでNotesには登録しません．' } };
    if (legacy) {
      if (normalizeObservedTerm(legacy.headword) !== normalizeObservedTerm(plan.de)) throw rowCompletionError_('旧草案と現在の見出しが一致しません．記録を保持して停止しました．');
      const draftRow = job.rows[0], known = maintenanceStyleKnown_(candidateWizardSuggestedBody(legacy), '');
      draftRow.draft = { ja: candidateWizardSuggestedBody(legacy), en: '' }; draftRow.status = 'needs_review';
      draftRow.notesSupport = { kind: 'new_dictionary_proposal', english: known.english, italian: known.italian,
        rationale: '旧保存草案の対応語です．現在の出典と日英本文を人が確認してください．', usageIds: [], examples: [], humanReviewed: false };
      const intakeMessage = '旧保存草案を確認画面へ読み込みました．英語本文を補い，出典・日英本文を確認して登録してください．APIは呼び出していません．';
      job.intake.message = intakeMessage;
    }
    const claim = ROW_COMPLETION_PREFIX + 'claim:' + rowCompletionHash_(['notes-intake', book.getId(), normalizeObservedTerm(plan.de)]);
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty(claim)) throw rowCompletionError_('同じ見出しの処理記録があります．既存の作業・Notesを確認してください．');
    job.intake.claim = claim; rowCompletionSave_(job); props.setProperty(claim, job.id);
    if (props.getProperty(claim) !== job.id) throw rowCompletionError_('処理予約を確認できません．');
    return job;
  });
}
function maintenanceNotesDraftErrors_(row, fields) {
  const errors = [];
  ['ja', 'en'].forEach(function (field) {
    try { rowCompletionValidateText_(row, field, fields[field]); }
    catch (error) {
      const detail = String(error && error.message || '').split('ROW_COMPLETION: ')[1];
      errors.push({ field: field, message: detail ? detail.slice(0, 300) : '本文の形式を確認できません．' });
    }
  });
  return errors;
}
function maintenanceNotesValidateDraft(id, expectedHash, fields) {
  // Read-only preview. Do not save drafts, approve terms, reserve rows, or call a generation API.
  const job = rowCompletionJob_(id), row = Array.isArray(job.rows) && job.rows[0];
  if (!job.intake || job.closed || job.intake.intent || !row ||
      !['draft', 'needs_review', 'applied'].includes(row.status) || rowCompletionHash_(job) !== expectedHash) {
    throw rowCompletionError_('表示後に処理状態が変わりました．保存状態を確認してください．');
  }
  if (!fields || JSON.stringify(Object.keys(fields).sort()) !== JSON.stringify(['en', 'ja']) ||
      ['ja', 'en'].some(function (field) { return typeof fields[field] !== 'string' || fields[field].length > 6000; })) {
    throw rowCompletionError_('日英本文の項目・長さを確認してください．');
  }
  // The review helper changes only its copy; actual approval and all current-row guards remain in Register.
  const reviewed = rowCompletionReviewNotes_(row, fields);
  return { jobId: job.id, jobHash: expectedHash, validationErrors: maintenanceNotesDraftErrors_(reviewed, fields) };
}
function maintenanceNotesRun(observationId) {
  let job = maintenanceNotesPrepare_(observationId);
  // Old de/source-only rows and their saved responses remain intact. Run never writes Notes.
  if (!job.closed && job.rows[0] && job.rows[0].status === 'pending') {
    maintenanceNotesVerifySource_(rowCompletionBook_(), job.intake.plan);
    rowCompletionGenerate(job.id, job.rows[0].number);
  }
  return maintenanceWorkbenchState(observationId);
}
function maintenanceNotesWriteIntent_(job, sheet) {
  const intake = job.intake, intent = intake.intent;
  const managed = maintenanceNotesRow_(sheet, intake.entryId), number = intake.number;
  if (managed && (managed.number !== number || !['', intake.observationId].includes(managed.observationId))) throw rowCompletionError_('登録先の識別情報が変わりました．上書きせず停止しました．');
  if (number > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), number - sheet.getMaxRows());
  const range = sheet.getRange(number, 1, 1, sheet.getLastColumn()), before = range.getValues()[0], formulas = range.getFormulas()[0];
  if (!managed && before.some(function (value) { return value !== ''; })) throw rowCompletionError_('登録予定の行が使用中です．別行へ重複追加せず停止しました．');
  const columns = notesRegistrationColumns_(notesRegistrationHeader_(sheet));
  ['de', 'source', 'ja', 'en'].forEach(function (field) {
    const value = notesRegistrationString_(before[columns[field]]);
    if (columns[field] < 0 || !['', intent[field]].includes(value) || !rowCompletionWritable_(sheet, field, number)) throw rowCompletionError_('登録先に既存入力・数式・保護があります．変更せず停止しました．');
  });
  if (managed && managed.observationId === intake.observationId && notesRegistrationHash_(managed.values) === notesRegistrationHash_(intent)) return managed;
  if (formulas.some(Boolean) || !range.canEdit() || range.isPartOfMerge()) throw rowCompletionError_('登録行に数式・保護・結合セルがあります．変更せず停止しました．');
  maintenanceNotesVerifySource_(rowCompletionBook_(), intake.plan);
  const next = before.map(sheetLiteralValue_);
  Object.keys(intent).forEach(function (field) { next[columns[field]] = sheetLiteralValue_(intent[field]); });
  next[columns.maintenance_id] = sheetLiteralValue_(intake.entryId);
  next[columns.maintenance_observation_id] = sheetLiteralValue_(intake.observationId);
  if (JSON.stringify(range.getValues()[0]) !== JSON.stringify(before) || range.getFormulas()[0].some(Boolean)) throw rowCompletionError_('登録直前に行が変わりました．保存状態を確認してください．');
  // The complete confirmed content and retry IDs are written together. No de-only draft row.
  range.setValues([next]); SpreadsheetApp.flush();
  const saved = maintenanceNotesRow_(sheet, intake.entryId);
  if (!saved || saved.number !== number || saved.observationId !== intake.observationId || notesRegistrationHash_(saved.values) !== notesRegistrationHash_(intent)) throw rowCompletionError_('登録結果を確認できません．再生成せず保存状態を確認してください．');
  return saved;
}
function maintenanceNotesRegister(id, expectedHash, fields, checked) {
  if (checked !== true) throw rowCompletionError_('日英本文・対応語・出典を確認してから登録を承認してください．');
  return rowCompletionLock_(function () {
    const job = rowCompletionJob_(id), intake = job.intake, row = job.rows[0], book = rowCompletionBook_(), sheet = book.getSheetByName('Notes');
    if (!intake || !row || rowCompletionHash_(job) !== expectedHash) throw rowCompletionError_('表示後に処理状態が変わりました．保存状態を確認してください．');
    if (!sheet || sheet.getSheetId() !== job.sheetId) throw rowCompletionError_('Notesの対象タブが変わりました．');
    if (job.closed) {
      if (intake.phase === 'registered') return maintenanceWorkbenchState(intake.observationId);
      throw rowCompletionError_('この語の作業は終了済みです．保存済み案を変更せず確認してください．');
    }
    if (!['draft', 'needs_review', 'applying', 'partial', 'applied'].includes(row.status)) throw rowCompletionError_('確認できる本文案がありません．APIを再送せず保存状態を確認してください．');
    if (!fields || JSON.stringify(Object.keys(fields).sort()) !== JSON.stringify(['en', 'ja'])) throw rowCompletionError_('日英本文の項目が一致しません．');
    maintenanceNotesVerifySource_(book, intake.plan);
    maintenanceNotesNoDuplicate_(book, intake.plan.de, intake.entryId);
    if (!intake.intent) {
      const reviewed = rowCompletionReviewNotes_(row, fields), errors = maintenanceNotesDraftErrors_(reviewed, fields);
      if (errors.length) throw rowCompletionError_(errors.map(function (error) { return (error.field === 'ja' ? '日本語本文：' : '英語本文：') + error.message; }).join('\n'));
      if (intake.number) {
        // Compatibility: resume only this task's own old draft, never append a second heading.
        const current = rowCompletionRead_(sheet, row.number), accepted = {};
        ['ja', 'en'].forEach(function (field) { if (!current.formulas[field] && current.values[field] === row.draft[field]) accepted[field] = row.draft[field]; });
        rowCompletionCurrent_(job, row, accepted);
      } else maintenanceNotesDraftCurrent_(job, row);
      intake.intent = { de: intake.plan.de, source: intake.plan.source, ja: fields.ja, en: fields.en };
      intake.generationClaim = row.claim || rowCompletionClaimKey_(job, row);
      row.draft = { ja: fields.ja, en: fields.en }; row.notesSupport = reviewed.notesSupport; row.reviewed = true;
      intake.phase = 'registering'; row.status = 'applying';
      // The accepted text and row reservation survive every subsequent write.
      if (!intake.number) intake.number = sheet.getLastRow() + 1;
      rowCompletionSave_(job);
    } else if (fields.ja !== intake.intent.ja || fields.en !== intake.intent.en) {
      throw rowCompletionError_('登録途中です．承認済みの内容だけを再開できます．既存入力は上書きしません．');
    }
    try {
      notesRegistrationEnsureColumns_(sheet);
      const managed = maintenanceNotesWriteIntent_(job, sheet);
      row.number = managed.number; row.status = 'applied'; row.written = ['ja', 'en'];
      intake.phase = 'registered'; intake.message = '承認した原文・出典・日英本文をNotesに登録しました．サイトへの反映は別途の同期で行います．';
      row.message = intake.message; job.closed = true; rowCompletionSave_(job);
      notesEntryGuardRemember_(book, managed.number, true);
    } catch (error) {
      const detail = String(error && error.message || '').split('ROW_COMPLETION: ')[1];
      row.status = 'partial'; job.closed = false; intake.phase = 'registering';
      intake.message = (detail ? detail.slice(0, 300) + '\n' : '') + '登録は完了未確認です．保存済みの承認内容だけで再開し，APIは再送しません．';
      row.message = intake.message; rowCompletionSave_(job);
    }
    if (intake.phase === 'registered') {
      const props = PropertiesService.getScriptProperties();
      [intake.claim, intake.generationClaim].filter(Boolean).forEach(function (claim) { if (props.getProperty(claim) === job.id) props.deleteProperty(claim); });
    }
    return maintenanceWorkbenchState(intake.observationId);
  });
}
function maintenanceWorkbenchState(observationId) {
  const book = rowCompletionBook_(), state = rowCompletionState(), sheet = book.getSheetByName('Notes');
  const observations = candidateWizardBootstrap(), stored = state.job;
  const selected = observationId || (stored && stored.intake && !stored.closed ? stored.intake.observationId : observations.length ? observations[0].id : '');
  const job = stored && stored.intake && stored.intake.observationId === selected ? stored : null;
  const row = job && job.rows[0], entry = job && sheet ? maintenanceNotesRow_(sheet, job.intake.entryId) : null;
  let message = job ? job.intake.message : '';
  if (row && ['generating', 'uncertain'].includes(row.status)) {
    message = 'APIは' + (row.status === 'generating' ? '処理中または応答待ち' : '結果不明') +
      'です．利用状況を確認するまで再送しません．' + (entry ? '既存のNotes行は変更していません．' : 'Notesにはまだ登録していません．');
  }
  return { observations: observations, selectedObservationId: selected, job: job,
    jobHash: job ? rowCompletionHash_(job) : '', apiReady: state.apiReady, message: message,
    otherWorkPending: Boolean(stored && !stored.closed && stored !== job),
    validationErrors: row && Object.keys(row.draft || {}).length && !job.intake.intent ? maintenanceNotesDraftErrors_(row, row.draft) : [],
    entry: entry ? { number: entry.number, values: entry.values, hash: notesRegistrationHash_(entry.values) } : null };
}
function maintenanceWorkbenchFinish(id, checked) {
  const job = rowCompletionJob_(id);
  if (job.intake && job.intake.phase === 'preparing' && checked !== true) throw rowCompletionError_('追加途中の下書きがあります．保存状態を確認し，同じ実行操作で再開してください．');
  rowCompletionFinish(id, checked);
  return maintenanceWorkbenchState();
}
function showMaintenanceWorkbench() {
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('maintenance_workbench_dialog').setWidth(780).setHeight(720), '未登録語からNotesを準備・確認');
}
function maintenanceAliasesState() {
  const book = rowCompletionBook_(), published = notesRegistrationRead_(book.getSheetByName('Notes')).rows.filter(function (row) { return row.values.de.trim(); });
  return { observations: candidateWizardBootstrap(), headwords: published.map(function (row) { return row.values.de; }) };
}
function maintenanceAliasApply(observationId, headword, category, checked) {
  if (checked !== true || !Object.prototype.hasOwnProperty.call(RELATED_FORM_JEV_CATEGORIES, category)) throw rowCompletionError_('見出し・語形区分を確認してください．');
  return rowCompletionLock_(function () {
    const found = maintenanceNotesObservation_(observationId), book = found.spreadsheet;
    const normalized = normalizeObservedTerm(headword), notes = notesRegistrationRead_(book.getSheetByName('Notes')).rows.filter(function (row) { return row.values.de.trim(); });
    const targets = notes.filter(function (row) { return normalizeObservedTerm(row.values.de) === normalized; });
    if (targets.length !== 1) throw rowCompletionError_('Notesの対応見出しを一意に確認できません．');
    const proof = maintenanceNotesSource_(book, String(found.row[1] || '')), term = proof.de;
    if (normalizeObservedTerm(term) === normalized) throw rowCompletionError_('見出しと同じ語形を重複登録しません．');
    const mapping = requireSheetWithHeaders(book, EXPERIMENTAL_TERM_MAPPING_SHEET_NAME, EXPERIMENTAL_TERM_MAPPING_HEADERS);
    const rows = readSheetRows(mapping, EXPERIMENTAL_TERM_MAPPING_HEADERS.length);
    const related = rows.filter(function (row) { return normalizeObservedTerm(row[1]) === normalizeObservedTerm(term); });
    if (related.some(function (row) { return normalizeObservedTerm(row[0]) !== normalized; })) throw rowCompletionError_('別見出しへの語形対応が既にあります．上書きせず確認してください．');
    const duplicate = related.some(function (row) { return normalizeObservedTerm(row[0]) === normalized; });
    if (!duplicate) {
      const note = '日常保守で人が確認．観測ID：' + observationId + ' 出典：' + proof.source;
      mapping.appendRow([targets[0].values.de, term, RELATED_FORM_JEV_CATEGORIES[category], '対象', '対象', note].map(sheetLiteralValue_));
      SpreadsheetApp.flush();
    }
    const result = maintenanceAliasesState(); result.message = duplicate ? '同じ語形対応は登録済みです．追加していません．' : '確認した語形対応を追加しました．Jev・OpenAIは呼び出していません．';
    return result;
  });
}
function showMaintenanceAliases() {
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutputFromFile('maintenance_alias_dialog').setWidth(720).setHeight(650), '既存見出しへの語形対応');
}
