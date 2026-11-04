/** Optional private review column; recipient translations come only from the approval table. */
const ROW_COMPLETION_REVIEW_FIELD = '理由・要確認事項';
function rowCompletionApiFields_(row) {
  return row.targets.filter(function (field) {
    return field !== ROW_COMPLETION_REVIEW_FIELD && field !== 'whom_en';
  });
}
function rowCompletionReviewRead_(sheet, number) {
  if (!['GM', 'RW', 'RS'].includes(sheet.getName())) return null;
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(namedSheetHeader_);
  if (!header.includes(ROW_COMPLETION_REVIEW_FIELD)) return null;
  const layout = namedSheetColumns_(sheet, [ROW_COMPLETION_REVIEW_FIELD]), cell = sheet.getRange(number, layout.positions[0] + 1);
  const value = String(cell.getValue() == null ? '' : cell.getValue()), formula = Boolean(cell.getFormula());
  // Do not copy old review histories into API input or private draft records.
  return { layout: layout.signature, hash: rowCompletionHash_(value), blank: value === '', formula: formula };
}
function rowCompletionReviewSchema_() {
  return { type: 'object', additionalProperties: false, required: ['reason', 'questions'],
    properties: { reason: { type: 'string' }, questions: { type: 'string' } } };
}
function rowCompletionReviewFormat_(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(['questions', 'reason']) ||
      ['reason', 'questions'].some(function (key) {
        return typeof value[key] !== 'string' || value[key].length > 900 || JSON.stringify(value[key]).length > 1802 ||
          /https?:|<[^>]*>|\[\[score:|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value[key]);
      })) throw rowCompletionError_('理由・要確認事項の形式を確認してください．');
  const reason = maintenanceStylePunctuation_(value.reason.trim()), questions = maintenanceStylePunctuation_(value.questions.trim());
  return reason || questions ? '【根拠・未解決点】\n' + [reason, questions ? '要確認事項：' + questions : ''].filter(Boolean).join('\n') : '';
}
function rowCompletionValidateReview_(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 4000 ||
      !text.startsWith('【根拠・未解決点】\n') ||
      /https?:|<[^>]*>|\[\[score:|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) {
    throw rowCompletionError_('理由欄は「【根拠・未解決点】」の形式で，未確認のリンク等を追加せず記録してください．');
  }
  return text;
}
