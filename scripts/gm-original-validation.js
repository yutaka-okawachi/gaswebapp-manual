'use strict';
const japanese=/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
function validateGmOriginals(rows){
 for(let i=0;i<rows.length;i++){const row=rows[i];if(japanese.test(String(row.de||''))||japanese.test(String(row.de_normalized||'')))throw Error('Japanese text in GM original/search field: Sheet row '+(row.__row||i+2)+'. Correct the source before English generation.');}
 return [];
}
module.exports={validateGmOriginals};
