'use strict';
// Finished survey may be removed; normal aliases and source lookup must remain independent.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
for(const f of ['morphology_survey_review.js','morphology_survey_dialog.html'])assert(!fs.existsSync(path.join(root,'src',f)));
const sources=fs.readdirSync(path.join(root,'src')).filter(f=>/\.(js|html)$/.test(f)).map(f=>read('src/'+f)).join('\n');
assert(!/\b(?:morphologySurvey\w*|showMorphologySurveyReview)\s*\(/.test(sources));assert(!sources.includes('語形対応_一括調査'));assert(!sources.includes('辞書語形・検索対応_仕様'));
assert.match(sources,/function maintenanceAliasApply\(/);assert.match(sources,/function refreshDictionarySourceMarkersForMappingsFromMenu\(/);
const handlers=[],c=vm.createContext({addSheetRowNavigationMenu_(){},SpreadsheetApp:{getUi:()=>({createMenu(){const m={addItem(label,handler){handlers.push({label,handler});return m;},addSeparator(){return m;},addToUi(){return m;}};return m;}})}});
vm.runInContext(read('src/setup_credentials.js'),c);c.onOpen();assert(!handlers.some(h=>/一括調査|R列/.test(h.label)));
assert(handlers.some(h=>h.handler==='showMaintenanceAliases'));assert(handlers.some(h=>h.handler==='refreshDictionarySourceMarkersForMappingsFromMenu'));
console.log('Finished survey retirement: dedicated code/menu removed; normal term mapping/source maintenance retained. No live calls.');
