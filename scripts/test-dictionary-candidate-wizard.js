const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/dictionary_candidate_wizard.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src/dictionary_candidate_dialog.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/appsscript.json'), 'utf8'));
const context = { console, JEV_CANDIDATE_CATEGORIES: {
  INFLECTION: '', ORTHOGRAPHIC_VARIANT: '', TYPO: '', NEW_TERM_CANDIDATE: '', UNCERTAIN: ''
} };
vm.createContext(context);
vm.runInContext(source, context);

assert.throws(() => context.candidateWizardRunJev('observation-abc', false), /課金確認/);
assert.throws(() => context.candidateWizardCreateDraft('observation-abc', false), /課金確認/);
assert.throws(() => context.candidateWizardPromote('observation-abc', false), /移送の確認/);
assert.throws(() => context.candidateWizardReopenExperimental('observation-abc', false), /再開の確認/);
assert.throws(() => context.candidateWizardRegisterExperimental('observation-abc', '', '', false), /登録確認/);
assert.throws(() => context.candidateWizardSaveReview('', '採用', 'UNCERTAIN', '', ''), /判断保留/);
assert.throws(() => context.candidateWizardSafeText('=IMPORTXML("https://example.com")', '見出し', 120, true), /見出し/);
assert.strictEqual(context.candidateWizardSafeText('喧騒、騒ぎ。', '訳語', 120, true), '喧騒，騒ぎ．');
assert.strictEqual(context.candidateWizardDraftSchema().required.length, 11);
const body = context.candidateWizardSuggestedBody({ english: 'side, page', italian: 'lato, pagina',
  inflections: 'Seite は名詞の原形．', translation: '側，脇\nページ',
  musicExamples: '舞台の脇で\n楽譜の105ページ', comment: '' });
assert.ok(body.startsWith('(≒ side, page / lato, pagina)\nSeite は名詞の原形．'));
assert.ok(body.includes('① 側，脇．\n② ページ．'));
assert.ok(body.includes('【音楽用語としての訳例】\n「舞台の脇で」，「楽譜の105ページ」'));
assert.ok(!body.includes('未確認'));
const nounBody = context.candidateWizardSuggestedBody({ english: 'side', italian: 'lato',
  partOfSpeech: '女性名詞',
  inflections: 'Seite は女性名詞の単数主格（die Seite）．単数属格は der Seite，複数主格は die Seiten．',
  translation: '側', musicExamples: '一方から', comment: '' });
assert.ok(nounBody.includes('\nSeite は女性名詞の単数主格（die Seite）．単数属格は der Seite，複数主格は die Seiten．\n'));
assert.ok(!nounBody.includes('女性名詞．Seite'));
assert.throws(() => context.candidateWizardValidateMorphology('Substantiv，feminin', ''), /品詞は日本語/);
assert.throws(() => context.candidateWizardValidateMorphology('', 'die Seite，der Seite，die Seiten'), /語形・格変化/);
assert.doesNotThrow(() => context.candidateWizardValidateMorphology('女性名詞', 'Seite は女性名詞の単数主格．'));
assert.strictEqual(context.candidateWizardFormatInflections([
  'Seite は女性名詞の単数主格．', '単数属格は der Seite．', '複数主格は die Seiten．'
]), 'Seite は女性名詞の単数主格．単数属格は der Seite．複数主格は die Seiten．');
assert.throws(() => context.candidateWizardFormatInflections(['die Seite', 'der Seite']), /語形・格変化/);
assert.throws(() => context.candidateWizardValidateBodyMorphology(
  '(≒ side / lato)\nSubstantiv，feminin．die Seite，der Seite，die Seiten\n【一般的な意味】\n① 側．'), /語形・格変化/);
assert.doesNotThrow(() => context.candidateWizardValidateBodyMorphology(nounBody));
assert.strictEqual(context.candidateWizardDraftDetails(JSON.stringify({
  english: 'side', italian: 'lato', musicExamples: '舞台の脇で', comment: ''
})).italian, 'lato');
assert.ok(manifest.oauthScopes.includes('https://www.googleapis.com/auth/script.container.ui'));

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.strictEqual(scripts.length, 1);
new vm.Script(scripts[0][1], { filename: 'dictionary_candidate_dialog.html' });
for (const label of ['Jevで判定する', 'この1件だけを移送する', 'この候補の編集を再開する',
  'OpenAI APIで草案を作る',
  '英語の類語', 'イタリア語の類語', '音楽用語としての訳例',
  'この内容でNotesに登録する']) assert.ok(html.includes(label));

assert.ok(source.includes('notes.insertRowBefore(rowNumber)'));

console.log('辞書候補ダイアログ：構文・確認ゲート OK');
