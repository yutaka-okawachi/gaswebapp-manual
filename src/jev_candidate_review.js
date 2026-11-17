/** 観測済みの1語だけを，明示操作と課金確認後にJevへ送る． */
const JEV_CANDIDATE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const JEV_CANDIDATE_CATEGORIES = Object.freeze({
  INFLECTION: 'A grammatically valid inflected or conjugated form of a candidate headword.',
  ORTHOGRAPHIC_VARIANT: 'A historical or alternate spelling of a candidate headword.',
  TYPO: 'An unintended misspelling of a candidate headword.',
  NEW_TERM_CANDIDATE: 'A plausible German music term not represented by the candidate headwords.',
  UNCERTAIN: 'The evidence is insufficient or ambiguous.'
});

function jevCandidateDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1,
        previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
    }
    for (let j = 0; j < current.length; j++) previous[j] = current[j];
  }
  return previous[right.length];
}

function jevCandidateHeadwords(notesRows, term) {
  const normalized = normalizeObservedTerm(term);
  return notesRows.map(row => {
    const headword = String(row[0] || '').normalize('NFC').trim();
    const key = normalizeObservedTerm(headword);
    return {
      headword,
      dictionaryId: 'term-' + key.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      translation: String(row[1] || '').slice(0, 240),
      source: String(row[2] || '').slice(0, 120),
      distance: jevCandidateDistance(normalized, key)
    };
  }).filter(item => item.headword)
    .sort((a, b) => a.distance - b.distance || a.headword.localeCompare(b.headword, 'de'))
    .slice(0, 5).map((item, index) => Object.assign({ option: 'candidate_' + (index + 1) }, item));
}

function buildJevCandidateRequest(term, context, candidates) {
  const criteria = { no_match: 'None of the listed headwords is the intended match.' };
  candidates.forEach(item => {
    criteria[item.option] = {
      headword: item.headword,
      translation: item.translation,
      source: item.source,
      normalized_edit_distance: item.distance
    };
  });
  return {
    model: 'jev-latest',
    state: {
      observed_form: term,
      normalized_form: normalizeObservedTerm(term),
      german_context: context,
      candidate_headwords: candidates.map(item => ({
        option: item.option,
        headword: item.headword,
        translation: item.translation,
        source: item.source,
        normalized_edit_distance: item.distance
      }))
    },
    questions: {
      category: {
        type: 'choice',
        instructions: 'Classify the relationship between the observed German form and the candidate dictionary headwords. Choose UNCERTAIN when evidence is insufficient.',
        criteria: JEV_CANDIDATE_CATEGORIES
      },
      target: {
        type: 'choice',
        instructions: 'Which candidate headword, if any, is the intended dictionary headword in this context?',
        criteria
      }
    }
  };
}

function validateJevCandidateChoice(answer, allowed) {
  if (!answer || answer.type !== 'choice' || allowed.indexOf(answer.choice) === -1 ||
      !Number.isFinite(answer.confidence) || answer.confidence < 0 || answer.confidence > 1) {
    throw new Error('Jevの回答形式が不正です．観測行を再実行する前に利用状況を確認してください．');
  }
  return answer;
}

function jevCandidateContext(spreadsheet, observation) {
  const page = String(observation[6] || '');
  const source = page.indexOf('RW') !== -1 ? 'RW' : page.indexOf('RS') !== -1 ? 'RS' :
    page.indexOf('GM') !== -1 ? 'GM' : '';
  const sheet = source && spreadsheet.getSheetByName(source);
  if (!sheet || sheet.getLastRow() < 2) return '';
  const layout = namedSheetColumns_(sheet, ['de', 'de_normalized']);
  const deColumn = layout.positions[0] + 1, normalizedColumn = layout.positions[1] + 1;
  const lookupColumn = normalizedColumn;
  const term = normalizedColumn
    ? normalizeObservedTerm(observation[2] || observation[1])
    : String(observation[1] || '');
  const range = sheet.getRange(2, lookupColumn, sheet.getLastRow() - 1, 1);
  const match = range.createTextFinder(term).matchCase(false).findNext();
  namedSheetAssertLayout_(sheet, layout);
  return match ? String(sheet.getRange(match.getRow(), deColumn).getValue() || '').slice(0, 500) : '';
}

function jevCandidateSheetText(value) {
  const text = String(value || '');
  return /^[=+@-]/.test(text) ? "'" + text : text;
}

function callJevForCandidate(request, apiKey) {
  const response = UrlFetchApp.fetch(JEV_CANDIDATE_ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(request),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Jev APIがHTTP ' + response.getResponseCode() + 'を返しました．');
  }
  let result;
  try { result = JSON.parse(response.getContentText()); }
  catch (_) { throw new Error('Jevの応答を読み取れませんでした．'); }
  const answers = result && result.answers;
  const category = validateJevCandidateChoice(answers && answers.category,
    Object.keys(JEV_CANDIDATE_CATEGORIES));
  const target = validateJevCandidateChoice(answers && answers.target,
    ['no_match'].concat(request.state.candidate_headwords.map(item => item.option)));
  return { category, target };
}
