'use strict';
// Retired one-time model migration UI must not reappear or touch the configured model.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),entries=[];
assert.equal(fs.existsSync(path.join(root,'src/maintenance_model.js')),false);
const c=vm.createContext({addSheetRowNavigationMenu_(){},SpreadsheetApp:{getUi:()=>({createMenu(){const m={addItem(label,handler){entries.push({label,handler});return m;},addSeparator(){return m;},addToUi(){return m;}};return m;}})}});
vm.runInContext(read('src/setup_credentials.js'),c);c.onOpen();
for(const label of ['選択行の空欄を補完','前回の処理結果を確認','モデル検査の状態を確認（API送信なし）','gpt-6.1-solを検査して使用する','一括調査の語形対応を確認'])assert(!entries.some(e=>e.label===label),label);
assert(entries.some(e=>e.handler==='showMaintenanceWorkbench'));assert(entries.some(e=>e.handler==='showMaintenanceAliases'));
const source=fs.readdirSync(path.join(root,'src')).filter(f=>/\.(js|html)$/.test(f)).map(f=>read('src/'+f)).join('\n');
assert(!/\b(?:maintenanceModel\w*|maintenanceCheckRequestedModel_|maintenanceUseRequestedModel\w*|showMaintenanceModelStatus|showLastRowCompletion|showRowCompletion)\s*\(/.test(source));
assert(!/api\.openai\.com\/v1\/models\//.test(source));
const workbench=read('src/maintenance_workbench.js');assert(!/setProperty\(['"]OPENAI|maintenance-model-check-v1/.test(workbench));
assert.match(read('src/row_completion.js'),/getProperty\('OPENAI_DRAFT_MODEL'\)/);
console.log('Retired model/menu UI: no probe or configuration setter; unified entry and configured generation model retained. No live calls.');
