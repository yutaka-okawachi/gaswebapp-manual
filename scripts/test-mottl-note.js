const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `${name} should exist`);
  const openBrace = source.indexOf('{', start);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`${name} closing brace was not found`);
}

const wagnerStraussSource = read('mahler-search-app/js/wagner_strauss.js');
const context = {};
vm.createContext(context);
vm.runInContext(extractFunction(wagnerStraussSource, 'injectMottlNote'), context);

const mockBannerWithMeta = [
  '<div class="score-info-banner" style="text-align: left; padding: 12px; font-size: 0.85em; line-height: 1.6;">',
  '  <div style="font-weight: bold; border-bottom: 1px solid #ccc; margin-bottom: 8px; padding-bottom: 4px;">楽譜情報 (Score Information)</div>',
  '  <div><strong>Publisher:</strong> C.F. Peters</div>',
  '  <div><strong>Plate No.:</strong> 9904</div>',
  '  <div style="margin-top: 4px; font-style: italic; color: #555;">Historical editions on IMSLP.</div>',
  '  <div style="margin-top: 8px;"><a href="https://example.com" target="_blank">IMSLP Project Page ↗</a></div>',
  '</div>',
  '<div class="scene-header">前奏曲</div>'
].join('\n');

const mockSimpleBanner = [
  '<div class="score-info-banner">楽譜情報: C.F. Peters</div>',
  '<div class="scene-header">前奏曲</div>'
].join('\n');

// 1. 対象オペラ（tristan, walküre, walkuere, tann_dresden, tann_paris, parsifal）で注記が挿入されること
const targetOperas = ['tristan', 'walküre', 'walkuere', 'tann_dresden', 'tann_paris', 'parsifal'];
for (const opera of targetOperas) {
  const result = context.injectMottlNote(mockBannerWithMeta, opera);
  assert(
    result.includes('Felix Mottl による指示も含む'),
    `Mottl note should be inserted for target opera: ${opera}`
  );
  // score-info-bannerの終端とscene-headerの間に挿入されていること
  const bannerEndIdx = result.indexOf('</div><div style="font-family:');
  const sceneHeaderIdx = result.indexOf('<div class="scene-header">前奏曲</div>');
  assert(bannerEndIdx !== -1, `Mottl note should be placed immediately after the banner for ${opera}`);
  assert(sceneHeaderIdx > bannerEndIdx, `Mottl note should precede the scene content for ${opera}`);
}

// 2. 単純なバナー（属性なし・子要素なし）でも正しく挿入されること
{
  const result = context.injectMottlNote(mockSimpleBanner, 'tristan');
  assert(result.includes('Felix Mottl による指示も含む'), 'Mottl note should be inserted for simple banner');
  assert(result.indexOf('楽譜情報: C.F. Peters</div><div style=') !== -1, 'Mottl note should follow simple banner end');
}

// 3. 対象外オペラ（lohengrin, meister, siegfried, goetter, feen 等）では注記が挿入されないこと
const nonTargetOperas = ['lohengrin', 'meister', 'siegfried', 'götter', 'feen', 'rheingold'];
for (const opera of nonTargetOperas) {
  const result = context.injectMottlNote(mockBannerWithMeta, opera);
  assert(
    !result.includes('Felix Mottl による指示も含む'),
    `Mottl note should NOT be inserted for non-target opera: ${opera}`
  );
  assert.strictEqual(result, mockBannerWithMeta, `HTML should remain unchanged for ${opera}`);
}

// 4. 空文字や不正な入力時の挙動
assert.strictEqual(context.injectMottlNote('', 'tristan'), '');
assert.strictEqual(context.injectMottlNote(null, 'tristan'), null);

console.log('Mottl注記の注入テスト（test-mottl-note.js）に成功しました。');
