const fs = require('fs');
const path = require('path');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const DEFAULT_INPUT_PATH = path.join(__dirname, 'fixtures', 'jev-advisory-input.json');
const DEFAULT_OUTPUT_PATH = path.join(REPOSITORY_ROOT, 'tmp', 'jev-advisory-report.json');
const DEFAULT_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const JEV_ADVISORY_SHEET_NAME = 'Jev判定_正規化テスト';
const JEV_ADVISORY_SHEET_HEADERS = [
    '判定ID', '入力語形', '文脈', '正規化語形', '判定経路',
    '処理状態', '分類', '対応見出し', '対応見出しID', '分類確信度',
    '対応確信度', '候補一覧', '人による確認', '確認メモ', '生成日時'
];
const CATEGORY_CRITERIA = {
    INFLECTION: 'A grammatically valid inflected or conjugated form of one candidate headword.',
    ORTHOGRAPHIC_VARIANT: 'A historical spelling, alternate spelling, or orthographic variant of one candidate headword.',
    TYPO: 'An unintended misspelling or input error whose intended form is one candidate headword.',
    NEW_TERM_CANDIDATE: 'A plausible German music term that is not represented by the candidate headwords.',
    UNCERTAIN: 'The evidence is insufficient, ambiguous, or does not support a reliable classification.'
};
const REUSABLE_REVIEW_CATEGORIES = new Set(['INFLECTION', 'ORTHOGRAPHIC_VARIANT', 'TYPO']);
const FORBIDDEN_OBSERVATION_KEYS = new Set([
    'email', 'ip', 'ipaddress', 'notifyemail', 'searchhistory', 'useragent'
]);

function normalizeGermanTerm(value) {
    return String(value || '')
        .normalize('NFC')
        .toLowerCase()
        .replace(/ä/g, 'ae')
        .replace(/ö/g, 'oe')
        .replace(/ü/g, 'ue')
        .replace(/ß/g, 'ss')
        .trim();
}

function normalizeGermanId(value) {
    return normalizeGermanTerm(value)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function levenshteinDistance(left, right) {
    const a = String(left || '');
    const b = String(right || '');
    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    const current = new Array(b.length + 1);

    for (let i = 1; i <= a.length; i++) {
        current[0] = i;
        for (let j = 1; j <= b.length; j++) {
            current[j] = Math.min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
        for (let j = 0; j <= b.length; j++) previous[j] = current[j];
    }
    return previous[b.length];
}

function truncate(value, maxLength) {
    const text = String(value || '').trim();
    return text.length <= maxLength ? text : text.slice(0, maxLength);
}

function dictionaryEntry(row, index) {
    if (Array.isArray(row)) {
        const headword = String(row[0] || '').trim();
        const normalizedId = normalizeGermanId(headword);
        return {
            id: normalizedId ? `term-${normalizedId}` : `dictionary-${index + 1}`,
            headword,
            translation: truncate(row[1], 240),
            source: truncate(row[2], 120)
        };
    }
    const headword = String(row && row.headword || '').trim();
    const normalizedId = normalizeGermanId(headword);
    return {
        id: String(row && row.id || (normalizedId ? `term-${normalizedId}` : `dictionary-${index + 1}`)),
        headword,
        translation: truncate(row && row.translation, 240),
        source: truncate(row && row.source, 120)
    };
}

function assertObservationSafety(observation) {
    Object.keys(observation || {}).forEach(key => {
        if (FORBIDDEN_OBSERVATION_KEYS.has(key.toLowerCase())) {
            throw new Error(`Jev入力に送信禁止項目が含まれています: ${key}`);
        }
    });
}

function buildApprovedReviewCache(reviewSheetRows, dictionary) {
    const rows = Array.isArray(reviewSheetRows) ? reviewSheetRows : [];
    const emptyResult = {
        byNormalized: new Map(),
        approvedRows: 0,
        acceptedRows: 0,
        warnings: []
    };
    if (!rows.length) return emptyResult;

    const header = Array.isArray(rows[0]) ? rows[0].map(value => String(value || '').trim()) : [];
    const columnIndex = {};
    JEV_ADVISORY_SHEET_HEADERS.forEach(name => {
        const index = header.indexOf(name);
        if (index < 0) throw new Error(`Jev判定シートの必須列がありません: ${name}`);
        columnIndex[name] = index;
    });

    const dictionaryGroups = new Map();
    (dictionary || []).forEach(entry => {
        const normalized = entry.normalized || normalizeGermanTerm(entry.headword);
        const values = dictionaryGroups.get(normalized) || [];
        values.push(entry);
        dictionaryGroups.set(normalized, values);
    });

    const approvedGroups = new Map();
    let approvedRows = 0;
    rows.slice(1).forEach((row, rowOffset) => {
        if (!Array.isArray(row)) return;
        if (String(row[columnIndex['人による確認']] || '').trim() !== '採用') return;
        approvedRows++;
        const rowNumber = rowOffset + 2;
        const observedForm = String(row[columnIndex['入力語形']] || '').trim();
        const normalizedForm = normalizeGermanTerm(observedForm);
        if (!normalizedForm) {
            emptyResult.warnings.push({
                row: rowNumber,
                code: 'EMPTY_OBSERVED_FORM',
                message: '採用行の入力語形が空です'
            });
            return;
        }
        const values = approvedGroups.get(normalizedForm) || [];
        values.push({ row, rowNumber, observedForm, normalizedForm });
        approvedGroups.set(normalizedForm, values);
    });

    const byNormalized = new Map();
    approvedGroups.forEach((group, normalizedForm) => {
        if (group.length !== 1) {
            emptyResult.warnings.push({
                rows: group.map(item => item.rowNumber),
                code: 'DUPLICATE_APPROVED_FORM',
                message: `同じ入力語形の採用行が重複しています: ${group[0].observedForm}`
            });
            return;
        }

        const item = group[0];
        const row = item.row;
        const storedNormalized = normalizeGermanTerm(row[columnIndex['正規化語形']]);
        const route = String(row[columnIndex['判定経路']] || '').trim();
        const status = String(row[columnIndex['処理状態']] || '').trim();
        const category = String(row[columnIndex['分類']] || '').trim();
        const targetHeadword = String(row[columnIndex['対応見出し']] || '').trim();
        const targetId = String(row[columnIndex['対応見出しID']] || '').trim();

        if (storedNormalized && storedNormalized !== normalizedForm) {
            emptyResult.warnings.push({
                row: item.rowNumber,
                code: 'NORMALIZED_FORM_MISMATCH',
                message: `正規化語形が入力語形と一致しません: ${item.observedForm}`
            });
            return;
        }
        if (route !== 'Jev' || status !== 'ADVISORY') {
            emptyResult.warnings.push({
                row: item.rowNumber,
                code: 'UNSUPPORTED_REVIEW_STATE',
                message: `JevのADVISORY行ではありません: ${item.observedForm}`
            });
            return;
        }
        if (!REUSABLE_REVIEW_CATEGORIES.has(category)) {
            emptyResult.warnings.push({
                row: item.rowNumber,
                code: 'NON_REUSABLE_CATEGORY',
                message: `再利用対象外の分類です: ${category || '(空欄)'}`
            });
            return;
        }

        const targets = dictionaryGroups.get(normalizeGermanTerm(targetHeadword)) || [];
        if (targets.length !== 1) {
            emptyResult.warnings.push({
                row: item.rowNumber,
                code: 'TARGET_NOT_UNIQUE',
                message: `対応見出しを辞書で一意に確認できません: ${targetHeadword || '(空欄)'}`
            });
            return;
        }
        const target = targets[0];
        if (targetId && targetId !== target.id) {
            emptyResult.warnings.push({
                row: item.rowNumber,
                code: 'TARGET_ID_MISMATCH',
                message: `対応見出しIDが現在の辞書と一致しません: ${targetId}`
            });
            return;
        }

        byNormalized.set(normalizedForm, {
            observedForm: item.observedForm,
            normalizedForm,
            category,
            headword: target.headword,
            dictionaryId: target.id,
            sourceRow: item.rowNumber
        });
    });

    return {
        byNormalized,
        approvedRows,
        acceptedRows: byNormalized.size,
        warnings: emptyResult.warnings
    };
}

function prepareAdvisoryBatch(input, options = {}) {
    const maxCandidates = Math.max(1, Math.min(5, Number(options.maxCandidates) || 5));
    const dictionary = (input && input.dictionary || [])
        .map(dictionaryEntry)
        .filter(entry => entry.headword)
        .map(entry => Object.assign(entry, { normalized: normalizeGermanTerm(entry.headword) }));
    const dictionaryByNormalized = new Map(dictionary.map(entry => [entry.normalized, entry]));
    const aliasByNormalized = new Map();

    (input && input.aliases || []).forEach(row => {
        const alias = Array.isArray(row) ? row[0] : row && row.alias;
        const canonical = Array.isArray(row) ? row[1] : row && row.canonical;
        const canonicalEntry = dictionaryByNormalized.get(normalizeGermanTerm(canonical));
        const aliasKey = normalizeGermanTerm(alias);
        if (aliasKey && canonicalEntry && !dictionaryByNormalized.has(aliasKey)) {
            aliasByNormalized.set(aliasKey, canonicalEntry);
        }
    });

    const approvedCache = buildApprovedReviewCache(input && input.reviewSheetRows, dictionary);

    const seenIds = new Set();
    const codeResolutions = [];
    const cacheResolutions = [];
    const jevItems = [];

    (input && input.observations || []).forEach((observation, index) => {
        assertObservationSafety(observation);
        const id = String(observation && observation.id || `observation-${index + 1}`);
        if (seenIds.has(id)) throw new Error(`Jev入力のIDが重複しています: ${id}`);
        seenIds.add(id);

        const observedForm = String(observation && observation.form || '').trim();
        const normalizedForm = normalizeGermanTerm(observedForm);
        if (!normalizedForm) throw new Error(`Jev入力の語形が空です: ${id}`);

        const exact = dictionaryByNormalized.get(normalizedForm);
        const alias = aliasByNormalized.get(normalizedForm);
        if (exact || alias) {
            const matched = exact || alias;
            codeResolutions.push({
                id,
                observedForm,
                context: truncate(observation && observation.context, 500),
                normalizedForm,
                resolution: exact ? 'EXACT_HEADWORD' : 'REGISTERED_ALIAS',
                headword: matched.headword,
                dictionaryId: matched.id
            });
            return;
        }

        const cached = approvedCache.byNormalized.get(normalizedForm);
        if (cached) {
            cacheResolutions.push({
                id,
                observedForm,
                context: truncate(observation && observation.context, 500),
                normalizedForm,
                resolution: 'APPROVED_JEV_CACHE',
                category: cached.category,
                headword: cached.headword,
                dictionaryId: cached.dictionaryId,
                sourceRow: cached.sourceRow
            });
            return;
        }

        const candidates = dictionary.map(entry => ({
            dictionaryId: entry.id,
            headword: entry.headword,
            translation: entry.translation,
            source: entry.source,
            distance: levenshteinDistance(normalizedForm, entry.normalized)
        })).sort((a, b) => a.distance - b.distance || a.headword.localeCompare(b.headword, 'de'))
            .slice(0, maxCandidates)
            .map((candidate, candidateIndex) => Object.assign({
                option: `candidate_${candidateIndex + 1}`
            }, candidate));

        jevItems.push({
            id,
            observedForm,
            normalizedForm,
            context: truncate(observation && observation.context, 500),
            candidates
        });
    });

    return {
        codeResolutions,
        cacheResolutions,
        jevItems,
        cacheDiagnostics: {
            approvedRows: approvedCache.approvedRows,
            acceptedRows: approvedCache.acceptedRows,
            warnings: approvedCache.warnings
        }
    };
}

function buildTypeSafeRequest(item) {
    const candidateCriteria = { no_match: 'None of the listed dictionary headwords is the intended match.' };
    item.candidates.forEach(candidate => {
        candidateCriteria[candidate.option] = {
            headword: candidate.headword,
            translation: candidate.translation,
            source: candidate.source,
            normalized_edit_distance: candidate.distance
        };
    });

    return {
        state: {
            observed_form: item.observedForm,
            normalized_form: item.normalizedForm,
            german_context: item.context,
            candidate_headwords: item.candidates.map(candidate => ({
                option: candidate.option,
                headword: candidate.headword,
                translation: candidate.translation,
                source: candidate.source,
                normalized_edit_distance: candidate.distance
            }))
        },
        model: 'jev-latest',
        questions: {
            category: {
                type: 'choice',
                instructions: 'Classify the relationship between `observed_form` and the listed German dictionary headwords. Choose UNCERTAIN when the evidence is insufficient.',
                criteria: CATEGORY_CRITERIA
            },
            target: {
                type: 'choice',
                instructions: 'Which candidate headword, if any, is the intended dictionary headword for `observed_form` in `german_context`?',
                criteria: candidateCriteria
            }
        }
    };
}

function validateChoiceAnswer(answer, allowedChoices, label) {
    if (!answer || answer.type !== 'choice') throw new Error(`Jev応答の${label}がChoiceではありません`);
    if (!allowedChoices.includes(answer.choice)) throw new Error(`Jev応答の${label}が未定義の選択肢です`);
    if (!Number.isFinite(answer.confidence) || answer.confidence < 0 || answer.confidence > 1) {
        throw new Error(`Jev応答の${label} confidenceが不正です`);
    }
    if (!answer.probabilities || typeof answer.probabilities !== 'object') {
        throw new Error(`Jev応答の${label} probabilitiesがありません`);
    }
    const probabilities = allowedChoices.map(choice => Number(answer.probabilities[choice] || 0));
    if (probabilities.some(value => !Number.isFinite(value) || value < 0 || value > 1)) {
        throw new Error(`Jev応答の${label} probabilitiesが不正です`);
    }
    const sum = probabilities.reduce((total, value) => total + value, 0);
    if (Math.abs(sum - 1) > 0.02) throw new Error(`Jev応答の${label} probabilities合計が不正です`);
}

function validateTypeSafeResponse(response, item) {
    const answers = response && response.answers;
    validateChoiceAnswer(answers && answers.category, Object.keys(CATEGORY_CRITERIA), 'category');
    validateChoiceAnswer(
        answers && answers.target,
        ['no_match'].concat(item.candidates.map(candidate => candidate.option)),
        'target'
    );
    return response;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function callTypeSafe(request, options = {}) {
    const apiKey = String(options.apiKey || '').trim();
    if (!apiKey) throw new Error('TYPESAFE_API_KEYが設定されていません');
    const fetchImpl = options.fetchImpl || global.fetch;
    if (typeof fetchImpl !== 'function') throw new Error('fetchが利用できません');
    const endpoint = options.endpoint || DEFAULT_ENDPOINT;
    const retryDelays = options.retryDelays || [0, 500, 1500];
    let lastError;

    for (const waitMs of retryDelays) {
        if (waitMs) await (options.delay || delay)(waitMs);
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
            let response;
            try {
                response = await fetchImpl(endpoint, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(request),
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeout);
            }
            if (response.ok) return await response.json();
            const error = new Error(`TypeSafe API HTTP ${response.status}`);
            error.status = response.status;
            if (response.status !== 429 && response.status !== 529) throw error;
            lastError = error;
        } catch (error) {
            lastError = error;
            if (error && error.status && error.status !== 429 && error.status !== 529) throw error;
        }
    }
    throw lastError || new Error('TypeSafe API request failed');
}

function safeError(error) {
    const message = String(error && error.message || error || 'Unknown error');
    return message.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').slice(0, 240);
}

async function runAdvisoryBatch(input, options = {}) {
    const mode = options.mode === 'live' ? 'live' : 'dry-run';
    const prepared = prepareAdvisoryBatch(input, options);
    const evaluations = [];
    const provider = options.provider || (async (request, item) => {
        const response = await callTypeSafe(request, options);
        return validateTypeSafeResponse(response, item);
    });

    for (const item of prepared.jevItems) {
        const request = buildTypeSafeRequest(item);
        if (mode !== 'live') {
            evaluations.push({
                id: item.id,
                observedForm: item.observedForm,
                context: item.context,
                normalizedForm: item.normalizedForm,
                status: 'SKIPPED',
                reason: 'dry_run',
                candidates: item.candidates,
                request
            });
            continue;
        }

        try {
            const response = validateTypeSafeResponse(await provider(request, item), item);
            const category = response.answers.category;
            const target = response.answers.target;
            const selectedCandidate = item.candidates.find(candidate => candidate.option === target.choice) || null;
            evaluations.push({
                id: item.id,
                observedForm: item.observedForm,
                context: item.context,
                normalizedForm: item.normalizedForm,
                status: 'ADVISORY',
                category: category.choice,
                categoryConfidence: category.confidence,
                categoryProbabilities: category.probabilities,
                target: target.choice,
                targetHeadword: selectedCandidate && selectedCandidate.headword,
                targetDictionaryId: selectedCandidate && selectedCandidate.dictionaryId,
                targetConfidence: target.confidence,
                targetProbabilities: target.probabilities,
                candidates: item.candidates,
                model: response.model || ''
            });
        } catch (error) {
            evaluations.push({
                id: item.id,
                observedForm: item.observedForm,
                context: item.context,
                normalizedForm: item.normalizedForm,
                status: 'SKIPPED',
                reason: 'api_error',
                error: safeError(error),
                candidates: item.candidates
            });
        }
    }

    const report = {
        schemaVersion: 1,
        mode,
        generatedAt: new Date().toISOString(),
        summary: {
            resolvedByCode: prepared.codeResolutions.length,
            resolvedByApprovedCache: prepared.cacheResolutions.length,
            advisory: evaluations.filter(item => item.status === 'ADVISORY').length,
            skipped: evaluations.filter(item => item.status === 'SKIPPED').length
        },
        codeResolutions: prepared.codeResolutions,
        cacheResolutions: prepared.cacheResolutions,
        cacheDiagnostics: prepared.cacheDiagnostics,
        evaluations
    };
    report.sheetExport = {
        sheetName: JEV_ADVISORY_SHEET_NAME,
        headers: JEV_ADVISORY_SHEET_HEADERS,
        rows: buildAdvisorySheetRows(report)
    };
    return report;
}

function formatCandidateList(candidates) {
    return (candidates || []).map(candidate =>
        `${candidate.option}: ${candidate.headword}（距離 ${candidate.distance}）`
    ).join(' / ');
}

function buildAdvisorySheetRows(report) {
    const generatedAt = String(report && report.generatedAt || '');
    const codeRows = (report && report.codeResolutions || []).map(item => [
        item.id,
        item.observedForm,
        item.context || '',
        item.normalizedForm || normalizeGermanTerm(item.observedForm),
        '通常コード',
        'RESOLVED',
        item.resolution,
        item.headword,
        item.dictionaryId,
        '',
        '',
        '',
        '未確認',
        '',
        generatedAt
    ]);
    const advisoryRows = (report && report.evaluations || []).map(item => [
        item.id,
        item.observedForm,
        item.context || '',
        item.normalizedForm || normalizeGermanTerm(item.observedForm),
        'Jev',
        item.status,
        item.category || '',
        item.targetHeadword || '',
        item.targetDictionaryId || '',
        Number.isFinite(item.categoryConfidence) ? item.categoryConfidence : '',
        Number.isFinite(item.targetConfidence) ? item.targetConfidence : '',
        formatCandidateList(item.candidates),
        '未確認',
        '',
        generatedAt
    ]);
    return codeRows.concat(advisoryRows);
}

function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const result = {};
    fs.readFileSync(filePath, 'utf8').split(/\r?\n/).forEach(line => {
        const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (match) result[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    });
    return result;
}

function parseArguments(args) {
    const options = {
        mode: 'dry-run',
        input: DEFAULT_INPUT_PATH,
        output: DEFAULT_OUTPUT_PATH,
        reviewCache: ''
    };
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--live') options.mode = 'live';
        else if (args[i] === '--dry-run') options.mode = 'dry-run';
        else if (args[i] === '--input' && args[i + 1]) options.input = path.resolve(args[++i]);
        else if (args[i] === '--output' && args[i + 1]) options.output = path.resolve(args[++i]);
        else if (args[i] === '--review-cache' && args[i + 1]) options.reviewCache = path.resolve(args[++i]);
        else throw new Error(`未対応の引数です: ${args[i]}`);
    }
    return options;
}

async function main() {
    const cli = parseArguments(process.argv.slice(2));
    const input = JSON.parse(fs.readFileSync(cli.input, 'utf8'));
    if (cli.reviewCache) {
        const reviewCache = JSON.parse(fs.readFileSync(cli.reviewCache, 'utf8'));
        input.reviewSheetRows = Array.isArray(reviewCache) ? reviewCache : reviewCache.rows;
        if (!Array.isArray(input.reviewSheetRows)) {
            throw new Error('--review-cache は行配列または rows 行配列を含むJSONが必要です');
        }
    }
    const env = Object.assign(parseEnvFile(path.join(REPOSITORY_ROOT, '.env')), process.env);
    if (cli.mode === 'live' && !env.TYPESAFE_API_KEY) {
        throw new Error('--live には .env または環境変数の TYPESAFE_API_KEY が必要です');
    }
    const report = await runAdvisoryBatch(input, {
        mode: cli.mode,
        apiKey: env.TYPESAFE_API_KEY
    });
    fs.mkdirSync(path.dirname(cli.output), { recursive: true });
    fs.writeFileSync(cli.output, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(`Jev助言バッチ: code=${report.summary.resolvedByCode}, cache=${report.summary.resolvedByApprovedCache}, advisory=${report.summary.advisory}, skipped=${report.summary.skipped}`);
    if (report.cacheDiagnostics.warnings.length) {
        console.warn(`確認済みキャッシュ警告: ${report.cacheDiagnostics.warnings.length} 件`);
    }
    console.log(`確認用レポート: ${cli.output}`);
}

if (require.main === module) {
    main().catch(error => {
        console.error(`Jev助言バッチを開始できません: ${safeError(error)}`);
        process.exitCode = 1;
    });
}

module.exports = {
    CATEGORY_CRITERIA,
    REUSABLE_REVIEW_CATEGORIES,
    JEV_ADVISORY_SHEET_NAME,
    JEV_ADVISORY_SHEET_HEADERS,
    normalizeGermanTerm,
    normalizeGermanId,
    levenshteinDistance,
    buildApprovedReviewCache,
    prepareAdvisoryBatch,
    buildTypeSafeRequest,
    validateTypeSafeResponse,
    callTypeSafe,
    runAdvisoryBatch,
    buildAdvisorySheetRows,
    parseArguments
};
