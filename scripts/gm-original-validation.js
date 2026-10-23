'use strict';
// The one deferred source correction is identified by both content and location,
// never by a mutable Sheet row number. It remains visible in both languages.
const deferred = Object.freeze({data:'M-4-3-283-all&',de:'𝅘𝅥 wie vorher 付点𝅗𝅥',de_normalized:'𝅘𝅥 wie vorher 付点𝅗𝅥'});
const japanese = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;
function validateGmOriginals(rows) {
    const warnings = [];
    let deferredCount = 0;
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!japanese.test(String(row.de || '')) && !japanese.test(String(row.de_normalized || ''))) continue;
        if (Object.keys(deferred).every(key => row[key] === deferred[key]) && ++deferredCount === 1) {
            warnings.push('GM2575 source correction deferred; original German field remains unchanged and visible ('+deferred.data+').');
            continue;
        }
        throw Error('Japanese text in GM original/search field: Sheet row '+(row.__row || i + 2)+'. Correct the source before English generation.');
    }
    return warnings;
}
module.exports = {validateGmOriginals};
