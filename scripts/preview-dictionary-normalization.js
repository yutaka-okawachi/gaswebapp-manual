const { startPreview } = require('./preview-site');
const { dictionaryData, aliasData } = require('./fixtures/dictionary-normalization');
const { spawnSync } = require('child_process');

function readWorkbookPreviewData(workbookPath) {
  const python = process.env.PREVIEW_PYTHON || 'python';
  const extractor = String.raw`
import json
import openpyxl
import sys

workbook = openpyxl.load_workbook(sys.argv[1], read_only=True, data_only=True)

def read_rows(sheet_name, width):
    sheet = workbook[sheet_name]
    rows = []
    for values in sheet.iter_rows(min_row=2, max_col=width, values_only=True):
        row = ['' if value is None else str(value) for value in values]
        if any(value.strip() for value in row):
            rows.append(row)
    return rows

notes = read_rows('Notes_正規化テスト', 3)
aliases = [row for row in read_rows('語形対応_正規化テスト', 4) if row[0].strip() and row[1].strip()]
print(json.dumps({'dictionaryData': notes, 'aliasData': aliases}, ensure_ascii=False))
`;
  const result = spawnSync(python, ['-c', extractor, workbookPath], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PYTHONUTF8: '1' }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || '実験用ワークブックを読み込めませんでした。');
  return JSON.parse(result.stdout);
}

async function main() {
  const workbookFlag = process.argv.indexOf('--workbook');
  const workbookPath = workbookFlag >= 0 ? process.argv[workbookFlag + 1] : '';
  if (workbookFlag >= 0 && !workbookPath) throw new Error('--workbook の後にエクスポートした .xlsx ファイルを指定してください。');
  const previewData = workbookPath ? readWorkbookPreviewData(workbookPath) : { dictionaryData, aliasData };
  const preview = await startPreview(previewData);
  const dictionaryUrl = new URL('/mahler-search-app/dic.html', preview.url).href;
  console.log(`正規化テスト用語集: ${dictionaryUrl}`);
  console.log(`正規見出し: ${previewData.dictionaryData.length}語 ／ 語形・別綴り: ${previewData.aliasData.length}件`);
  console.log('終了するには Ctrl+C を押してください．');

  const close = async () => {
    await preview.close();
    process.exit(0);
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
