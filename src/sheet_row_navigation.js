/** Navigate within the open spreadsheet without reading or changing row data. */
function addSheetRowNavigationMenu_(ui) {
  ui.createMenu('指定行へ移動')
    .addItem('RW', 'goToRwRow')
    .addItem('RS', 'goToRsRow')
    .addItem('GM', 'goToGmRow')
    .addItem('Notes', 'goToNotesRow')
    .addToUi();
}

function goToRwRow() { sheetRowNavigation_('RW'); }
function goToRsRow() { sheetRowNavigation_('RS'); }
function goToGmRow() { sheetRowNavigation_('GM'); }
function goToNotesRow() { sheetRowNavigation_('Notes'); }

function sheetRowNavigation_(tabName) {
  const ui = SpreadsheetApp.getUi();
  if (!['RW', 'RS', 'GM', 'Notes'].includes(tabName)) {
    ui.alert('移動先はRW・RS・GM・Notesから選んでください。');
    return;
  }
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) {
    ui.alert('スプレッドシートを開いてから実行してください。');
    return;
  }
  try {
    const sheet = book.getSheetByName(tabName);
    if (!sheet) {
      ui.alert(tabName + 'タブが見つかりません。');
      return;
    }
    if (sheet.isSheetHidden()) {
      ui.alert(tabName + 'タブを表示してから実行してください。');
      return;
    }
    const sheetId = sheet.getSheetId();
    const response = ui.prompt(
      tabName + '：指定行へ移動',
      '行番号を半角数字で入力してください（1〜' + sheet.getMaxRows() + '）。\n指定した行のA列へ移動します。',
      ui.ButtonSet.OK_CANCEL
    );
    if (response.getSelectedButton() !== ui.Button.OK) return;
    const raw = response.getResponseText();
    const text = typeof raw === 'string' ? raw.trim() : '';
    const row = Number(text);
    if (!/^[0-9]{1,16}$/.test(text) || !Number.isSafeInteger(row) || row < 1) {
      ui.alert('行番号は1以上の整数を半角数字で入力してください。');
      return;
    }
    // A prompt suspends execution. Recheck the tab identity and bounds after it closes.
    const current = book.getSheetByName(tabName);
    if (!current || current.getSheetId() !== sheetId || current.isSheetHidden()) {
      ui.alert('移動先のタブが変更されました。タブを確認して、メニューから選び直してください。');
      return;
    }
    const maxRows = current.getMaxRows();
    if (row > maxRows) {
      ui.alert(tabName + 'の行番号は1〜' + maxRows + 'の範囲で入力してください。');
      return;
    }
    const cell = current.getRange(row, 1, 1, 1);
    book.setActiveSheet(current);
    book.setActiveRange(cell);
  } catch (_) {
    ui.alert('移動できませんでした。タブと行番号を確認して、メニューから選び直してください。');
  }
}
