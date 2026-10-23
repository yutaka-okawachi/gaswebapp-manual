'use strict';
// This command only reads an existing private response. It does not acquire locks, install, stage,
// call Google/Git, update environment/build markers, commit, push or deploy.
const fs=require('fs');
const {prepare,publicationPolicy}=require('./sync/bilingual'),{gasSourceFingerprint}=require('./sync/core');
function dryRun(snapshot){
 const prepared=prepare(snapshot,snapshot.requestId),policy=publicationPolicy();
 return {mode:'read-only bilingual dry-run',requestId:snapshot.requestId,sourceHash:snapshot.sourceHash,sourceMatchesCurrentCode:snapshot.sourceHash===gasSourceFingerprint(),japaneseFiles:Object.keys(prepared.japanese).length,englishFiles:Object.keys(prepared.english).length,englishStats:prepared.report.stats,untranslatedUi:prepared.report.untranslated.length,warnings:prepared.report.warnings,englishPublicationEnabled:policy.publishEnglish,plannedEnglishDestination:'.sync-state/english/'+prepared.report.buildHash,buildHash:prepared.report.buildHash,writes:0,networkCalls:0,gitCalls:0,deploymentCalls:0};
}
function main(args=process.argv.slice(2)){
 if(args.length!==1||!args[0].startsWith('--snapshot=')||args[0].length<=11)throw Error('非公開の取得済みJSONを --snapshot=<path> で指定してください。');
 const report=dryRun(JSON.parse(fs.readFileSync(args[0].slice(11),'utf8')));console.log(JSON.stringify(report,null,2));return report;
}
module.exports={dryRun,main};
if(require.main===module){try{main();}catch(e){console.error(e.message);process.exitCode=1;}}
