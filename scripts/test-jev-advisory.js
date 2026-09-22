const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    normalizeGermanTerm,
    normalizeGermanId,
    levenshteinDistance,
    prepareAdvisoryBatch,
    buildApprovedReviewCache,
    buildTypeSafeRequest,
    validateTypeSafeResponse,
    runAdvisoryBatch,
    JEV_ADVISORY_SHEET_NAME,
    JEV_ADVISORY_SHEET_HEADERS
} = require('./jev-advisory');

const input = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'fixtures', 'jev-advisory-input.json'),
    'utf8'
));

assert.strictEqual(normalizeGermanTerm(' Dämpfern '), 'daempfern');
assert.strictEqual(normalizeGermanTerm('STÜRZT'), 'stuerzt');
assert.strictEqual(normalizeGermanId('mäßig, aber markiert'), 'maessig-aber-markiert');
assert.strictEqual(levenshteinDistance('kraeftigen', 'kraeftig'), 2);

const prepared = prepareAdvisoryBatch(input);
assert.deepStrictEqual(prepared.codeResolutions, [{
    id: 'registered-alias',
    observedForm: 'stürzt',
    context: 'Er stürzt zu Boden.',
    normalizedForm: 'stuerzt',
    resolution: 'REGISTERED_ALIAS',
    headword: 'stürzen',
    dictionaryId: 'term-stuerzen'
}]);
assert.strictEqual(prepared.jevItems.length, 4);
assert.deepStrictEqual(prepared.cacheDiagnostics, {
    approvedRows: 0,
    acceptedRows: 0,
    warnings: []
});
assert.strictEqual(prepared.jevItems.find(item => item.id === 'inflection-kraeftig').candidates[0].headword, 'kräftig');
assert.strictEqual(prepared.jevItems.find(item => item.id === 'plural-daempfer').candidates[0].headword, 'Dämpfer');
assert.strictEqual(prepared.jevItems.find(item => item.id === 'typo-markieren').candidates[0].headword, 'markieren');
assert.ok(
    prepared.jevItems.find(item => item.id === 'typo-markieren').candidates.length > 1,
    '曖昧な語形には複数の既存見出し候補を提示すること'
);

const request = buildTypeSafeRequest(prepared.jevItems[0]);
assert.strictEqual(request.model, 'jev-latest');
assert.deepStrictEqual(Object.keys(request.questions.category.criteria), [
    'INFLECTION', 'ORTHOGRAPHIC_VARIANT', 'TYPO', 'NEW_TERM_CANDIDATE', 'UNCERTAIN'
]);
assert.ok(request.questions.target.criteria.no_match);
assert.ok(!JSON.stringify(request).toLowerCase().includes('useragent'));

function reviewRow(values) {
    return JEV_ADVISORY_SHEET_HEADERS.map(header => values[header] === undefined ? '' : values[header]);
}

const approvedRow = reviewRow({
    判定ID: 'approved-kraeftigen',
    入力語形: 'kräftigen',
    文脈: 'mit kräftigen Ausdruck',
    正規化語形: 'kraeftigen',
    判定経路: 'Jev',
    処理状態: 'ADVISORY',
    分類: 'INFLECTION',
    対応見出し: 'kräftig',
    対応見出しID: 'term-kraeftig',
    分類確信度: 0.96,
    対応確信度: 0.98,
    人による確認: '採用'
});
const reviewInput = JSON.parse(JSON.stringify(input));
reviewInput.reviewSheetRows.push(approvedRow);
const reviewPrepared = prepareAdvisoryBatch(reviewInput);
assert.strictEqual(reviewPrepared.cacheResolutions.length, 1);
assert.deepStrictEqual(reviewPrepared.cacheResolutions[0], {
    id: 'inflection-kraeftig',
    observedForm: 'kräftigen',
    context: 'mit kräftigen Ausdruck',
    normalizedForm: 'kraeftigen',
    resolution: 'APPROVED_JEV_CACHE',
    category: 'INFLECTION',
    headword: 'kräftig',
    dictionaryId: 'term-kraeftig',
    sourceRow: 2
});
assert.ok(!reviewPrepared.jevItems.some(item => item.id === 'inflection-kraeftig'));
assert.deepStrictEqual(reviewPrepared.cacheDiagnostics, {
    approvedRows: 1,
    acceptedRows: 1,
    warnings: []
});

const unconfirmedInput = JSON.parse(JSON.stringify(reviewInput));
unconfirmedInput.reviewSheetRows[1][12] = '未確認';
assert.strictEqual(prepareAdvisoryBatch(unconfirmedInput).cacheResolutions.length, 0);

const duplicateRows = [input.reviewSheetRows[0], approvedRow, approvedRow.slice()];
const duplicateCache = buildApprovedReviewCache(
    duplicateRows,
    input.dictionary.map((row, index) => Object.assign({}, row, {
        normalized: normalizeGermanTerm(row.headword),
        id: row.id || `dictionary-${index + 1}`
    }))
);
assert.strictEqual(duplicateCache.acceptedRows, 0);
assert.strictEqual(duplicateCache.warnings[0].code, 'DUPLICATE_APPROVED_FORM');

function choice(choice, choices, confidence = 0.9) {
    const probabilities = Object.fromEntries(choices.map(value => [value, value === choice ? 1 : 0]));
    return { type: 'choice', choice, confidence, probabilities };
}

function fakeResponse(requestBody) {
    const form = requestBody.state.observed_form;
    const targetChoices = Object.keys(requestBody.questions.target.criteria);
    const firstCandidate = targetChoices.find(value => value !== 'no_match');
    const category = form === 'markiren'
        ? 'TYPO'
        : form === 'zartfließend' ? 'NEW_TERM_CANDIDATE' : 'INFLECTION';
    const target = form === 'zartfließend' ? 'no_match' : firstCandidate;
    return {
        model: 'jev-test',
        answers: {
            category: choice(category, Object.keys(requestBody.questions.category.criteria)),
            target: choice(target, targetChoices)
        },
        usage: { input_tokens: 1, output_tokens: 1 }
    };
}

(async () => {
    const dryRun = await runAdvisoryBatch(input, { mode: 'dry-run' });
    assert.strictEqual(dryRun.summary.resolvedByCode, 1);
    assert.strictEqual(dryRun.summary.resolvedByApprovedCache, 0);
    assert.strictEqual(dryRun.summary.advisory, 0);
    assert.strictEqual(dryRun.summary.skipped, 4);
    assert.ok(dryRun.evaluations.every(item => item.reason === 'dry_run'));
    assert.strictEqual(dryRun.sheetExport.sheetName, JEV_ADVISORY_SHEET_NAME);
    assert.deepStrictEqual(dryRun.sheetExport.headers, JEV_ADVISORY_SHEET_HEADERS);
    assert.strictEqual(dryRun.sheetExport.rows.length, 5);
    assert.strictEqual(dryRun.sheetExport.rows[0][0], 'registered-alias');
    assert.strictEqual(dryRun.sheetExport.rows[0][4], '通常コード');
    assert.strictEqual(dryRun.sheetExport.rows[0][12], '未確認');
    assert.strictEqual(dryRun.sheetExport.rows[1][4], 'Jev');
    assert.strictEqual(dryRun.sheetExport.rows[1][5], 'SKIPPED');
    assert.strictEqual(dryRun.sheetExport.rows[1].length, JEV_ADVISORY_SHEET_HEADERS.length);

    const live = await runAdvisoryBatch(input, {
        mode: 'live',
        provider: async (requestBody, item) => validateTypeSafeResponse(fakeResponse(requestBody), item)
    });
    assert.strictEqual(live.summary.resolvedByCode, 1);
    assert.strictEqual(live.summary.resolvedByApprovedCache, 0);
    assert.strictEqual(live.summary.advisory, 4);
    assert.strictEqual(live.summary.skipped, 0);
    assert.strictEqual(live.evaluations.find(item => item.id === 'typo-markieren').category, 'TYPO');
    assert.strictEqual(live.evaluations.find(item => item.id === 'unknown-term').target, 'no_match');
    assert.strictEqual(live.sheetExport.rows.find(row => row[0] === 'typo-markieren')[6], 'TYPO');
    assert.strictEqual(live.sheetExport.rows.find(row => row[0] === 'typo-markieren')[12], '未確認');

    let cachedProviderCalls = 0;
    const cachedLive = await runAdvisoryBatch(reviewInput, {
        mode: 'live',
        provider: async (requestBody, item) => {
            cachedProviderCalls++;
            return validateTypeSafeResponse(fakeResponse(requestBody), item);
        }
    });
    assert.strictEqual(cachedLive.summary.resolvedByApprovedCache, 1);
    assert.strictEqual(cachedLive.summary.advisory, 3);
    assert.strictEqual(cachedProviderCalls, 3);
    assert.ok(!cachedLive.sheetExport.rows.some(row => row[0] === 'inflection-kraeftig'));

    const failed = await runAdvisoryBatch(input, {
        mode: 'live',
        provider: async () => { throw new Error('temporary failure Bearer secret-value'); }
    });
    assert.strictEqual(failed.summary.resolvedByCode, 1);
    assert.strictEqual(failed.summary.advisory, 0);
    assert.strictEqual(failed.summary.skipped, 4);
    assert.ok(failed.evaluations.every(item => item.status === 'SKIPPED'));
    assert.ok(failed.evaluations.every(item => !JSON.stringify(item).includes('secret-value')));

    const generalGermanInput = JSON.parse(JSON.stringify(input));
    generalGermanInput.observations = [{
        id: 'general-german-word',
        form: 'Kartoffel',
        context: 'Das ist eine Kartoffel.'
    }];
    const generalGerman = await runAdvisoryBatch(generalGermanInput, {
        mode: 'live',
        provider: async (requestBody, item) => ({
            model: 'jev-test',
            answers: {
                category: choice('UNCERTAIN', Object.keys(requestBody.questions.category.criteria)),
                target: choice('no_match', Object.keys(requestBody.questions.target.criteria))
            }
        })
    });
    assert.strictEqual(generalGerman.summary.advisory, 1);
    assert.strictEqual(generalGerman.evaluations[0].category, 'UNCERTAIN');
    assert.strictEqual(generalGerman.evaluations[0].target, 'no_match');

    assert.throws(
        () => prepareAdvisoryBatch({ dictionary: [], observations: [{ form: 'x', userAgent: 'private' }] }),
        /送信禁止項目/
    );
    assert.throws(
        () => prepareAdvisoryBatch({
            dictionary: [],
            observations: [{ id: 'duplicate', form: 'eins' }, { id: 'duplicate', form: 'zwei' }]
        }),
        /IDが重複/
    );
    console.log('Jev advisory batch tests: OK');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
