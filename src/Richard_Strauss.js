// ここにAPIキーを貼り付ける (以前と同じキーでOKです)
const API_KEY = 'AIzaSyCCweb7ydf6byQEe7zqCdww2y4GTvpkXx0';

// === ここから下は変更不要です ===

const Komponist = "リヒャルト・ワーグナー";
const Titel = "ラインの黄金";
const LINK = "https://opera-guide.ch/operas/die+schweigsame+frau/libretto/de/";
//const LINK = "http://www.murashev.com/opera/Parsifal_libretto_German_Act_2";
//const LINK = "https://opera-guide.ch/operas/arabella/libretto/de/";
//const LINK = "https://opera-guide.ch/operas/die+agyptische+helena/libretto/de/";

//const LINK = "http://www.murashev.com/opera/Die_Meistersinger_von_N%C3%BCrnberg_libretto_German_Act_2";
//const LINK = "https://opera-guide.ch/operas/intermezzo/libretto/de/";
//const LINK = "http://www.murashev.com/opera/Tristan_und_Isolde_libretto_German_Act_3";
//const LINK = "https://opera-guide.ch/en/operas/die+frau+ohne+schatten/libretto/de/";
//const LINK = "https://opera-guide.ch/en/operas/ariadne+auf+naxos/libretto/de/";


// テンプレートリテラルを使ってAPIキーを正しく埋め込むように修正
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${API_KEY}`;

/**
 * スプレッドシートを開いたときにカスタムメニューを追加する関数
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Gemini 高度な翻訳')
    .addItem('選択範囲を翻訳・検証', 'translateAndValidateSelection')
    .addItem('Geminiに質問', 'askGemini')
    .addToUi();
}

/**
 * 選択されたセルを翻訳・検証するメインの関数
 */
function translateAndValidateSelection() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getActiveRange();
  const ui = SpreadsheetApp.getUi();

  if (!range) {
    ui.alert('セルを選択してください。');
    return;
  }

  if (range.isBlank()) {
    ui.alert('翻訳するドイツ語が入力されたセル（B列）を選択してください。');
    return;
  }

  SpreadsheetApp.getActiveSpreadsheet().toast('翻訳と検証を開始します...', '処理中', -1);

  const startRow = range.getRow();
  const startCol = range.getColumn();
  const numRows = range.getNumRows();

  for (let i = 0; i < numRows; i++) {
    const currentRow = startRow + i;
    const germanCell = sheet.getRange(currentRow, startCol);
    const germanText = germanCell.getValue();

    if (!germanText) continue;

    const characterCell = germanCell.offset(0, -1);
    const characterName = characterCell.getValue() || '不明';

    // 「ページが書いてあるセルの左隣の情報」を取得
    // germanCell.offset(0, -2) は以前の scorePageCell に相当
    // そのさらに左隣なので offset(0, -3) が幕・場情報となる
    const sceneLocationCell = germanCell.offset(0, -3);
    const sceneLocation = sceneLocationCell.getValue() || ''; // 幕・場情報 (例: Schatten-1-1)

    const translationCell = germanCell.offset(0, 1);
    const noteCell = germanCell.offset(0, 2);

    try {
      // createPrompt に sceneLocation を渡す
      const prompt = createPrompt(characterName, germanText, sceneLocation);
      const geminiResponse = callGemini(prompt);

      translationCell.setValue(geminiResponse.translation || '翻訳エラー');
      noteCell.setValue(geminiResponse.notes || '');

      SpreadsheetApp.flush();
    } catch (e) {
      noteCell.setValue(`スクリプトエラー: ${e.message}`);
    }
  }

  SpreadsheetApp.getActiveSpreadsheet().toast('翻訳と検証が完了しました。', '完了', 5);
}

/**
 * Geminiに送信する詳細なプロンプトを作成する関数
 */
function createPrompt(characterName, germanInstruction, sceneLocation) {
  let locationInfoPrompt = '不明'; // デフォルト値

  // sceneLocation (例: Schatten-1-1) を解析
  if (sceneLocation && typeof sceneLocation === 'string' && sceneLocation.trim() !== '') {
    const parts = sceneLocation.split('-');
    if (parts.length === 3) {
      const act = parts[1]; // 幕
      const scene = parts[2]; // 場

      if (!isNaN(parseInt(act)) && !isNaN(parseInt(scene))) {
        // 有効な幕と場の情報がある場合
        locationInfoPrompt = `これはオペラ『${Titel}』の第${act}幕第${scene}場の場面に当たります。この情報も考慮して文脈を判断してください。`; // 「Webも検索して検証ください」を削除
      } else {
        // 数字ではない場合など、解析できなかった場合
        locationInfoPrompt = `これは楽譜の「${sceneLocation}」という箇所に対応する情報です。この情報も考慮して文脈を判断してください。`; // 「Webも検索して検証ください」を削除
      }
    } else {
      // ハイフン区切りではない場合や、パーツ数が3でない場合
      locationInfoPrompt = `これは楽譜の「${sceneLocation}」という箇所に対応する情報です。この情報も考慮して文脈を判断してください。`; // 「Webも検索して検証ください」を削除
    }
  }

  return `
あなたは${Komponist}のオペラ、特に『${Titel}』を専門とする音楽学者兼演出家です。
以下のタスクを厳密に実行してください。

# 事前情報
- 現在検証している指示が記述されている場所の情報: ${locationInfoPrompt} 

# タスク
与えられたドイツ語の舞台指示を、指定されたルールに従って日本語に翻訳し、内容を検証します。

# 入力情報
- 指示対象とされているキャラクター: 「${characterName}」
- ドイツ語の指示原文: 「${germanInstruction}」

# 実行手順
1.  **指示対象の検証**:
    - 上記の場面情報を考慮し、ドイツ語の指示内容が、指定されたキャラクター「${characterName}」に対するものとして妥当か、オペラ『${Titel}』の文脈を考慮して検証してください。
    - もし不適切、あるいは別のキャラクターへの指示である可能性が高い場合は、その旨を指摘してください。この結果は出力フォーマットの「【指示対象の妥当性】」に記述します。
2.  **翻訳**: 以下の日本語訳ルールに厳密に従って、指示を翻訳してください。
    - 句読点は全角の「，」を使用します。指示が名詞や短い動詞句で終わる場合など、文として完結していない場合は文末に句点「．」を付けないでください。完全な文章の場合は句点を付けます。
    - 固有名詞（人名、地名など）は原文のままアルファベットで表記し、前後に半角スペースを1つずつ入れる。（例:「Tannhäuser が登場する．」）
3.  **誤植のチェック**: ドイツ語の指示原文に誤植の可能性がある単語を見つけた場合、正しいと思われる単語とともに指摘してください。この結果は出力フォーマットの「【誤植の有無】」に記述します。

# 最重要参考資料（優先的に参照）
**必ず以下のリブレットのURLを最優先で参照し、与えられたドイツ語の指示原文（「${germanInstruction}」）の周辺の歌詞や文脈を確認し、翻訳と検証に活用してください。**
- **リブレットのURL:** ${LINK}

特に、このリブレットページ内の内容が、翻訳する舞台指示の解釈にどのように影響するかを明示してください。
もし指定のURLから関連情報が明確に得られない場合、もしくはURLが機能しない場合に限り、広範なWeb検索（必要であれば海外のサイトも含む）を許可します。その場合でも、その判断に至った経緯を説明してください。

# 出力フォーマット
いかなる場合も、以下のJSON形式のみで回答してください。説明文や前置きは一切不要です。
"notes"フィールドは、必ず以下の箇条書きフォーマットを使用し、改行を入れてください。各項目について言及することがない場合は「特になし」と記述してください。
{
    "translation": "（ここに手順2に従って作成した日本語訳を記述）",
    "notes": "【指示対象の妥当性】：（手順1の結果をここに記述）\\n【誤植の有無】：（手順3の結果をここに記述）\\n【翻訳に当たってのコメント】：**参照したリブレットの内容、それに基づいた翻訳の根拠や補足事項をここに記述**"
}
`;
}

/**
 * Gemini APIを呼び出し、JSONレスポンスを解析する関数 (翻訳＆検証用)
 */
function callGemini(prompt) {
  const payload = {
    "contents": [{ "parts": [{ "text": prompt }] }],
    "generationConfig": { "responseMimeType": "application/json" }
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(API_URL, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode === 200) {
    try {
      const parsedResponse = JSON.parse(responseBody);
      // textプロパティが存在しない場合のエラーを回避
      if (!parsedResponse.candidates || !parsedResponse.candidates[0].content.parts[0].text) {
        console.error("予期しないレスポンス形式です: ", responseBody);
        return { translation: "エラー: Geminiからの応答が空です。", notes: `空の応答を受信しました。` };
      }
      const innerJson = parsedResponse.candidates[0].content.parts[0].text;
      return JSON.parse(innerJson);
    } catch (e) {
      console.error("JSONの解析に失敗しました。レスポンス: " + responseBody);
      // 変数を正しく埋め込むように修正
      return { translation: "エラー: レスポンスの形式が不正です。", notes: `Geminiからの応答:\n${responseBody}` };
    }
  } else {
    console.error("API呼び出しエラー。コード: " + responseCode + ", ボディ: " + responseBody);
    // 変数を正しく埋め込むように修正
    return { translation: "APIエラーが発生しました。", notes: `エラーコード: ${responseCode}\n詳細: ${responseBody}` };
  }
}

// === ▼▼▼ ここからが「Geminiに質問」機能の改修部分です ▼▼▼ ===

/**
 * 質問入力用のカスタムダイアログを表示する関数
 */
function askGemini() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const range = sheet.getActiveRange();
  const ui = SpreadsheetApp.getUi();

  if (!range) {
    ui.alert('質問したいセル（ドイツ語の原文と日本語訳）を選択してください。');
    return;
  }
  if (range.getNumColumns() < 2) {
    ui.alert('ドイツ語の原文と日本語訳の2列を選択してください。\n（例: B列とC列のセルを2つ選択）');
    return;
  }

  const values = range.getValues()[0];
  const germanText = values[0];
  const japaneseText = values[1] || "";

  if (!germanText) {
    ui.alert('1列目（ドイツ語原文）が空です。');
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 10px; }
          .context { background-color: #f5f5f5; border: 1px solid #ddd; padding: 10px; margin-bottom: 15px; font-size: 13px; line-height: 1.5; word-break: break-all; }
          b { font-weight: 600; }
          #question { width: 98%; padding: 8px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; }
          .buttons { text-align: right; margin-top: 15px; }
          button { padding: 8px 16px; margin-left: 8px; border: none; border-radius: 4px; font-weight: 600; cursor: pointer; transition: background-color 0.2s; }
          button:disabled { background-color: #cccccc; cursor: not-allowed; }
          .ok { background-color: #4CAF50; color: white; }
          .cancel { background-color: #f1f1f1; color: black; }
        </style>
      </head>
      <body>
        <p>オペラの舞台指示についてGeminiに質問します。</p>
        <div class="context">
          <b>ドイツ語原文:</b><br>${germanText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
          <br><br>
          <b>現在の日本語訳:</b><br>${japaneseText.replace(/</g, "&lt;").replace(/>/g, "&gt;") || '(空欄)'}
        </div>
        <label for="question"><b>質問内容:</b></label><br>
        <input type="text" id="question" value="他の日本語訳を提示してください．">
        
        <div class="buttons">
          <button class="cancel" onclick="google.script.host.close();">キャンセル</button>
          <button id="submit-button" class="ok" onclick="sendQuestion()">質問する</button>
        </div>

        <script>
          function sendQuestion() {
            const button = document.getElementById('submit-button');
            button.innerHTML = '質問中...';
            button.disabled = true;

            const questionText = document.getElementById('question').value;
            google.script.run
                .withSuccessHandler(google.script.host.close)
                .processAskGemini(questionText, ${JSON.stringify(germanText)}, ${JSON.stringify(japaneseText)});
          }
          document.getElementById('question').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') { sendQuestion(); }
          });
        </script>
      </body>
    </html>
  `;
  const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(450)
    .setHeight(330);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Geminiに質問');
}

/**
 * Geminiに質問を送信し、構造化された回答をカスタムダイアログで表示する関数
 */
function processAskGemini(question, germanText, japaneseText) {
  const ui = SpreadsheetApp.getUi();
  try {
    const geminiPrompt = createAskPrompt(question, germanText, japaneseText);

    const payload = {
      "contents": [{ "parts": [{ "text": geminiPrompt }] }],
      "generationConfig": { "responseMimeType": "application/json" }
    };
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true
    };
    const response = UrlFetchApp.fetch(API_URL, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode !== 200) {
      // 変数を正しく埋め込むように修正
      throw new Error(`APIエラーが発生しました。\nコード: ${responseCode}\n詳細: ${responseBody}`);
    }

    let geminiData;
    try {
      const parsedResponse = JSON.parse(responseBody);
      // textプロパティが存在しない場合のエラーを回避
      if (!parsedResponse.candidates || !parsedResponse.candidates[0].content.parts[0].text) {
        throw new Error(`Geminiからの応答が空です。\n応答内容:\n${responseBody}`);
      }
      const contentText = parsedResponse.candidates[0].content.parts[0].text;
      geminiData = JSON.parse(contentText);
    } catch (e) {
      // 変数を正しく埋め込むように修正
      throw new Error(`Geminiからの応答(JSON)の解析に失敗しました。\n応答内容:\n${e.message}\n\n${responseBody}`);
    }

    const htmlOutput = createAnswerHtml(geminiData);
    ui.showModalDialog(htmlOutput, 'Geminiの回答');

  } catch (e) {
    ui.alert('エラー', `Geminiへの質問でエラーが発生しました: ${e.message}`, ui.ButtonSet.OK);
  }
}

/**
 * Geminiへの質問用プロンプトを生成する関数 (JSON形式の出力を要求)
 */
function createAskPrompt(question, germanText, japaneseText) {
  return `
あなたは${Komponist}のオペラ、特に『${Titel}』を専門とする音楽学者兼演出家です。
以下の情報と質問に基づき、専門的な見地から回答してください。

# 背景情報
これはオペラの舞台指示（ト書き）です。文脈を考慮して回答してください。
- ドイツ語原文: "${germanText}"
- 現在の日本語訳: "${japaneseText || '(空欄)'}"

# 質問
${question}

# 出力フォーマット
いかなる場合も、以下のJSON形式のみで回答してください。説明文や前置きは一切不要です。
複数の翻訳案を提示することが望ましいです。最低でも1つの翻訳案を提示してください。

{
  "translations": [
    {
      "text": "（ここに日本語訳の提案1を記述）",
      "reason": "（なぜこの訳になるのか、文脈やニュアンスを踏まえた解説）"
    },
    {
      "text": "（ここに日本語訳の提案2を記述）",
      "reason": "（なぜこの訳になるのか、文脈やニュアンスを踏まえた解説）"
    }
  ],
  "comment": "（全体的な補足や、その他の重要な指摘事項があれば記述。なければ空文字列にする）"
}

# 回答の書式ルール
- "text", "reason", "comment" の各フィールドの日本語は、以下のルールに厳密に従ってください。
  - 句読点は全角の「，」「．」を使用する。ただし、翻訳案("text"フィールド)において、指示が名詞や短い動詞句で終わる場合など、文として完結していない場合は文末に句点「．」を付けないでください。
  - 固有名詞（人名、地名など）は日本語に訳さず、原文のままアルファベットで表記する。
  - 固有名詞を表記する際は、句読点の直後等でなければその前後に必ず半角スペースを1つずつ入れる。（例:「Tannhäuser が登場する．」）
`;
}


/**
 * Geminiからの構造化された回答を基に、HTMLダイアログを生成する関数
 */
function createAnswerHtml(geminiData) {
  // HTMLとCSSの定義
  let html = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 0; padding: 20px; font-size: 14px; line-height: 1.6; }
          h3 { font-size: 16px; border-bottom: 2px solid #4CAF50; padding-bottom: 5px; margin-top: 20px; margin-bottom: 15px; }
          .translation-block { border: 1px solid #e0e0e0; border-radius: 5px; margin-bottom: 15px; background-color: #f9f9f9; }
          .translation-header { display: flex; justify-content: space-between; align-items: center; background-color: #f0f0f0; padding: 8px 12px; border-bottom: 1px solid #e0e0e0; }
          .translation-text { font-weight: 600; margin: 0; font-family: "Meiryo", "Hiragino Kaku Gothic ProN", sans-serif; }
          .translation-body { padding: 12px; }
          .reason { margin: 0; color: #333; }
          .reason b { color: #000; }
          .comment-block { margin-top: 20px; padding: 12px; background-color: #f5f5f5; border-radius: 5px; border: 1px solid #ddd; }
          button.copy-btn { padding: 5px 12px; font-size: 12px; cursor: pointer; border: 1px solid #ccc; background-color: #fff; border-radius: 4px; transition: background-color 0.2s, color 0.2s; }
          button.copy-btn:hover { background-color: #e6e6e6; }
        </style>
      </head>
      <body>`;

  // 翻訳案のセクション
  if (geminiData.translations && geminiData.translations.length > 0) {
    html += '<h3>翻訳の提案</h3>';
    geminiData.translations.forEach((trans, index) => {
      // 変数を正しく埋め込むように修正
      const textId = `translation-${index}`; // index を使ってユニークなIDを生成
      // HTMLインジェクション対策でエスケープ
      const safeText = trans.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
      const safeReason = trans.reason.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      html += `
        <div class="translation-block">
          <div class="translation-header">
            <p id="${textId}" class="translation-text">${safeText}</p>
            <button class="copy-btn" onclick="copyToClipboard(this, '${textId}')">コピー</button>
          </div>
          <div class="translation-body">
            <p class="reason"><b>理由:</b> ${safeReason}</p>
          </div>
        </div>
      `;
    });
  }

  // 補足コメントのセクション
  if (geminiData.comment) {
    const safeComment = geminiData.comment.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html += `
      <div class="comment-block">
        <h3>補足コメント</h3>
        <p>${safeComment}</p>
      </div>
      `;
  }

  // クリップボードにコピーするためのスクリプト
  html += `
        <script>
          function copyToClipboard(button, elementId) {
            const textToCopy = document.getElementById(elementId).innerText;
            navigator.clipboard.writeText(textToCopy).then(() => {
              const originalText = button.innerText;
              button.innerText = 'コピー完了！';
              button.style.backgroundColor = '#4CAF50';
              button.style.color = 'white';
              setTimeout(() => {
                button.innerText = originalText;
                button.style.backgroundColor = '';
                button.style.color = '';
              }, 2000);
            }).catch(err => {
              console.error('コピーに失敗しました', err);
              button.innerText = '失敗';
            });
          }
        </script>
      </body>
    </html>
  `;

  return HtmlService.createHtmlOutput(html).setWidth(600).setHeight(500);
}
