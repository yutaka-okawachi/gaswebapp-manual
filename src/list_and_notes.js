/**
 * list.html と notes.html で使用されるサーバーサイド関数
 */

/**
 * 「略記一覧」シートからデータを取得する
 * @returns {Array<Array<string>>} 略記一覧のデータ
 */
function getAbbrListData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetName = '略記一覧';
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`シート「${sheetName}」が見つかりません。`);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const dataRange = sheet.getRange(2, 1, lastRow - 1, 3);
  return dataRange.getValues();
}

/**
 * 「マーラー以外のドイツ語」シートからデータを取得する
 * @returns {Array<Array<string>>} データ配列
 */
function getListData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetName = 'マーラー以外のドイツ語';
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("指定されたシートが存在しません: " + sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const dataRange = sheet.getRange(2, 1, lastRow - 1, 3);
  const data = dataRange.getValues();
  return data.filter(row => row[0] !== null && row[0].toString().trim() !== "");
}

/**
 * 「訳出についての覚書」シートからデータを取得する
 * @returns {Array<Array<string>>} データ配列
 */
function getNotesData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('訳出についての覚書');
  if (!sheet) throw new Error('指定されたシートが存在しません。');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  return data.filter(row => row[0] !== null && row[0].toString().trim() !== '');
}