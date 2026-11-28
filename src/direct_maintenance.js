/** Bound-sheet direct maintenance. No observation, ledger or saved judgment required. */
function directMaintenanceTerm_(value) {
  if (typeof value !== 'string') throw new Error('調べる語を入力してください．');
  const term = value.normalize('NFC').trim();
  if (!term || term.length > 120 || /[\u0000-\u001f]/.test(term) || /^[=+@-]/.test(term)) throw new Error('120文字以内の語を入力してください．');
  return term;
}
function directMaintenanceWord_(value) { return /^[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*$/u.test(value); }
function directMaintenanceNotesRead_() {
  const book = rowCompletionBook_(), notesSheet = book.getSheetByName('Notes');
  if (!notesSheet) throw new Error('Notesタブがありません．');
  const notes = notesRegistrationRead_(notesSheet).rows.filter(r => r.values.de.trim());
  return {book,notesSheet,notes};
}
function directMaintenanceRead_(term) {
  const {book,notesSheet,notes} = directMaintenanceNotesRead_();
  const mapping = book.getSheetByName('語形対応');
  const headers = ['見出し','関連語形','語形区分','用語検索','実例検索','補足'];
  if (!mapping || JSON.stringify(mapping.getRange(1,1,1,6).getValues()[0]) !== JSON.stringify(headers)) throw new Error('語形対応タブの列を確認してください．');
  const mappings = mapping.getLastRow() > 1 ? mapping.getRange(2,1,mapping.getLastRow()-1,6).getValues() : [];
  return {book,notesSheet,notes,mapping,mappings};
}
function directMaintenanceInspect(term) {
  term = directMaintenanceTerm_(term);
  const s = directMaintenanceRead_(term), key = normalizeObservedTerm(term);
  const words = s.notes.filter(r => directMaintenanceWord_(r.values.de));
  let source = null, sourceError = '';
  try { source = maintenanceNotesSource_(s.book,term,'alias'); } catch(e) { sourceError = String(e.message || e); }
  return {term, notes:s.notes.filter(r => normalizeObservedTerm(r.values.de)===key).map(r=>({headword:r.values.de,number:r.number})),
    mappings:s.mappings.filter(r => normalizeObservedTerm(r[1])===key).map(r=>r.map(String)),
    candidates:jevCandidateHeadwords(words.map(r=>[r.values.de,r.values.ja,r.values.source]),term),
    headwords:words.map(r=>r.values.de), source, sourceError};
}
function directMaintenanceAdvice(term) {
  const s=directMaintenanceInspect(term);
  if(s.notes.length || s.mappings.length) throw new Error('登録済みです．表示されたNotes・語形対応を確認してください．');
  const key=String(PropertiesService.getScriptProperties().getProperty('TYPESAFE_API_KEY')||'').trim();
  if(!key) throw new Error('JevのAPIキーが未設定です．候補を選んで登録することはできます．');
  const context=s.source?s.source.proof.map(p=>p.german).join('\n').slice(0,1500):'';
  const answer=callJevForCandidate(buildJevCandidateRequest(s.term,context,s.candidates),key);
  const target=s.candidates.find(c=>c.option===answer.target.choice);
  return {category:answer.category.choice,headword:target?target.headword:'',confidence:answer.category.confidence};
}
function directMaintenanceAliasPreview(term,headword,category) {
  term=directMaintenanceTerm_(term);headword=directMaintenanceTerm_(headword);
  const categories={INFLECTION:'語形変化（要分類）',ORTHOGRAPHIC_VARIANT:'別綴り',TYPO:'誤記候補'};
  if(!Object.prototype.hasOwnProperty.call(categories,category)) throw new Error('語形区分を選んでください．');
  if(!directMaintenanceWord_(headword)) throw new Error('対応先には単語の見出しを選んでください．句・文章の見出しには対応を追加しません．');
  const s=directMaintenanceRead_(term), key=normalizeObservedTerm(term), targets=s.notes.filter(r=>normalizeObservedTerm(r.values.de)===normalizeObservedTerm(headword));
  if(targets.length!==1) throw new Error('対応するNotes見出しを一つ選んでください．');
  const target=targets[0];
  if(key===normalizeObservedTerm(target.values.de)) throw new Error('見出しと同じ形です．語形対応の追加は不要です．');
  const existing=s.mappings.filter(r=>normalizeObservedTerm(r[1])===key);
  if(existing.some(r=>normalizeObservedTerm(r[0])!==normalizeObservedTerm(headword))) throw new Error('この語形は別見出しに登録済みです：'+existing.map(r=>r[0]).join('，'));
  const source=maintenanceNotesSource_(s.book,term,'alias'), before=String(target.values.source||'');
  const markers=source.source.match(/\[[^\]\r\n]+\]/g)||[], present=before.match(/\[[^\]\r\n]+\]/g)||[];
  const missing=markers.filter(m=>!present.includes(m));
  const p={term,headword:target.values.de,category,mappingCategory:categories[category],existing:existing.map(r=>r.map(String)),sourceBefore:before,sourceAfter:before+(missing.length?(before?', ':'')+missing.join(', '):''),missing,proof:source.proof};
  p.signature=rowCompletionHash_(p);
  return p;
}
function directMaintenanceAliasSave(term,headword,category,signature) {
  return rowCompletionLock_(function(){
    const p=directMaintenanceAliasPreview(term,headword,category),s=directMaintenanceRead_(p.term);
    if(p.existing.length) return {saved:true,alreadyPresent:true,term:p.term,headword:p.headword,message:'この語形対応は登録済みです．重複追加していません．'};
    if(p.signature!==signature) throw new Error('表示後に登録先または出典が変わりました．「調べる」で最新状態を読み直してください．');
    const target=s.notes.find(r=>r.values.de===p.headword),col=notesRegistrationColumns_(notesRegistrationHeader_(s.notesSheet)).source+1;
    const cell=s.notesSheet.getRange(target.number,col);
    if(p.missing.length&&(cell.getFormula()||!cell.canEdit()||cell.isPartOfMerge())) throw new Error('出典セルが数式・保護・結合されています．');
    // Idempotent source union first; a retry never duplicates either source or pair.
    if(p.missing.length) cell.setValue(sheetLiteralValue_(p.sourceAfter));
    s.mapping.appendRow([p.headword,p.term,p.mappingCategory,'対象','対象',''].map(sheetLiteralValue_));
    SpreadsheetApp.flush();
    const saved=directMaintenanceRead_(p.term).mappings.some(r=>normalizeObservedTerm(r[0])===normalizeObservedTerm(p.headword)&&normalizeObservedTerm(r[1])===normalizeObservedTerm(p.term));
    if(!saved) throw new Error('書込み結果を確認できません．「調べる」で登録済みか確認してください．');
    return {saved:true,term:p.term,headword:p.headword,message:p.term+' → '+p.headword+' を登録しました．公開反映はsync-dataで行います．'};
  });
}
function directMaintenanceSelectedEntry() {
  const book = rowCompletionBook_(), range = book.getActiveRange(), sheet = book.getActiveSheet();
  if (!range || !sheet || sheet.getName() !== 'Notes' ||
      range.getSheet().getSheetId() !== sheet.getSheetId() || range.getNumRows() !== 1 || range.getRow() < 2) return null;
  const snapshot = rowCompletionRead_(sheet, range.getRow());
  if (!String(snapshot.values.de || '').trim()) return null;
  const entry = directMaintenanceEntry(snapshot.values.de);
  if (entry.row !== range.getRow()) throw new Error('選択した行と見出し語が一致しません．行を選び直してください．');
  entry.canFill = ['ja', 'en', 'source'].some(field => rowCompletionBlank_(snapshot, field) && rowCompletionWritable_(sheet, field, entry.row));
  return entry;
}
function directMaintenanceEntry_(term,s) {
  term=directMaintenanceTerm_(term);
  const rows=s.notes.filter(r=>normalizeObservedTerm(r.values.de)===normalizeObservedTerm(term));
  if(rows.length!==1) throw new Error('編集するNotes見出しを一つ指定してください．');
  const r=rows[0];return {term:r.values.de,de:r.values.de,source:r.values.source,ja:r.values.ja,en:r.values.en,signature:rowCompletionHash_(r.values),row:r.number};
}
function directMaintenanceEntry(term) { return directMaintenanceEntry_(term,directMaintenanceNotesRead_()); }
function directMaintenanceEdit(term,signature,fields) {
  term=directMaintenanceTerm_(term);
  if(!fields || !['ja','en'].every(k=>typeof fields[k]==='string'&&fields[k].length<=6000&&!/^[=+@]/.test(fields[k])&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(fields[k]))) throw new Error('日英本文を各6000文字以内で入力してください．');
  return rowCompletionLock_(function(){
    const s=directMaintenanceNotesRead_(),entry=directMaintenanceEntry_(term,s);
    if(entry.ja===fields.ja&&entry.en===fields.en)return {status:'saved',row:entry.row,term:entry.term};
    if(entry.signature!==signature)throw new Error('表示後に本文が変更されました．編集内容は画面に残しています．現在のNotesを確認してください．');
    const layout=namedSheetColumns_(s.notesSheet,['ja','en']);
    const cells=layout.positions.map(c=>s.notesSheet.getRange(entry.row,c+1));
    if(cells.some(c=>c.getFormula()||!c.canEdit()||c.isPartOfMerge()))throw new Error('編集先が数式・保護・結合されています．本文は変更していません．');
    const provenance = notesExamplePrepare_(s.book, fields, entry);
    const output = {};
    ['ja','en'].forEach(function (field) {
      output[field] = provenance[field].text;
      if (output[field].length > 6000) throw new Error('作品名を加えると本文が6000文字を超えます．本文を確認してください．');
    });
    const rich = cells.map(function (cell, i) {
      const field = ['ja','en'][i];
      return output[field] === entry[field] ? null : notesExampleRich_(provenance[field], field, cell.getRichTextValue());
    });
    cells.forEach(function (cell, i) { if (rich[i]) cell.setRichTextValue(rich[i]); });
    fields = output;
    SpreadsheetApp.flush();
    const saved=directMaintenanceEntry(term);
    if(saved.ja!==fields.ja||saved.en!==fields.en)throw new Error('保存結果を確認できません．画面の編集内容を保ったままNotesを確認してください．');
    return {status:'saved',row:saved.row,term:saved.term};
  });
}
