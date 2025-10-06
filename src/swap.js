/**
 * スプレッドシートを開いたときにカスタムメニューを追加します。
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("セル操作")
    .addItem("選択範囲の両端を入れ替え（内容のみ）", "swapOuterCellsContents")
    .addItem("選択範囲の両端を入れ替え（書式も含む）", "swapOuterCellsWithFormat")
    .addToUi();
}

/**
 * 選択範囲の最初と最後のセル（両端）を取得するヘルパー関数。
 * @returns {Array<GoogleAppsScript.Spreadsheet.Range>|null} 最初のセルと最後のセルの配列、または無効な選択の場合はnull。
 */
const getOuterCells = () => {
  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();

  // 範囲が選択されていない、またはセルが1つ以下の場合は処理しない
  if (!range || range.getNumRows() * range.getNumColumns() <= 1) {
    return null;
  }

  // 選択範囲の左上のセル (1, 1) を「最初のセル」とする
  const firstCell = range.getCell(1, 1);
  // 選択範囲の右下のセルを「最後のセル」とする
  const lastCell = range.getCell(range.getNumRows(), range.getNumColumns());

  return [firstCell, lastCell];
};

/**
 * 選択範囲の両端のセルの内容（値／数式）を入れ替えます。書式は変更されません。
 */
function swapOuterCellsContents() {
  const ui = SpreadsheetApp.getUi();
  const cells = getOuterCells();

  if (!cells) {
    ui.alert("2セル以上の範囲を選択してください。");
    return;
  }
  const [firstCell, lastCell] = cells;

  // 数式を保持するためにgetFormulaを使用
  const firstContent = firstCell.getFormula() || firstCell.getValue();
  const lastContent = lastCell.getFormula() || lastCell.getValue();

  firstCell.setValue(lastContent);
  lastCell.setValue(firstContent);
}

/**
 * 選択範囲の両端のセルを完全に入れ替えます（書式、データ検証、メモなどすべて含む）。
 */
function swapOuterCellsWithFormat() {
  const ui = SpreadsheetApp.getUi();
  const cells = getOuterCells();

  if (!cells) {
    ui.alert("2セル以上の範囲を選択してください。");
    return;
  }
  const [firstCell, lastCell] = cells;

  const ss = SpreadsheetApp.getActive();
  let tmpSheet = null;
  try {
    // 一時的なシートを作成して、そこに片方のセルの全情報をコピー
    tmpSheet = ss.insertSheet("__tmp_swap__");
    const tmpCell = tmpSheet.getRange("A1");

    firstCell.copyTo(tmpCell);  // firstを一時セルに退避
    lastCell.copyTo(firstCell); // lastをfirstにコピー
    tmpCell.copyTo(lastCell);   // 一時セル（元first）をlastにコピー
  } finally {
    // 処理が完了したら、一時シートを必ず削除
    if (tmpSheet) {
      ss.deleteSheet(tmpSheet);
    }
  }
}