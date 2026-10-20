'use strict';
const {sha256}=require('./core');
const names=Object.freeze([
 'english_review_metadata_auto','english_review_metadata_export','english_review_metadata_notes','english_review_metadata_notes_deadline','english_review_metadata_notes_recovery','english_review_metadata_resume',
 'english_translation_dialog','english_translation_review','english_translation_sync','japanese_english_draft_binding','japanese_english_existing_review','japanese_english_manual_batch','japanese_english_mobile_review','japanese_english_proposals','japanese_english_retranslation','japanese_english_sheet_review','legacy_english_binding_cleanup','notes_english_api','notes_english_dialog','notes_english_workflow','source_english_api','source_english_workflow'
]);
const html=new Set(['english_translation_dialog','notes_english_dialog']);
function approvedFiles(local,head,published,context){
 if(!context)return new Set();
 const approval=context.approval;
 const expectedKeys=['baselineCommit','baselineVersion','files','id','projectHash','schemaVersion'].sort();
 if(!approval||JSON.stringify(Object.keys(approval).sort())!==JSON.stringify(expectedKeys)||approval.schemaVersion!==1||approval.id!=='english-workflow-20261020'||approval.baselineVersion!==1668||!/^[a-f0-9]{40}$/.test(approval.baselineCommit)||approval.projectHash!==sha256(String(context.scriptId))||!Array.isArray(approval.files)||approval.files.length!==names.length)throw Error('英訳機能廃止マニフェストの対象・プロジェクト・基準版が不正です。');
 const reviewed=new Map();
 for(const file of approval.files){const type=html.has(file?.name)?'HTML':'SERVER_JS';if(!file||JSON.stringify(Object.keys(file).sort())!==JSON.stringify(['hash','name','type'])||!names.includes(file.name)||reviewed.has(file.name)||file.type!==type||!/^[a-f0-9]{64}$/.test(file.hash))throw Error('廃止対象名・種類・ハッシュが不正または重複しています。');reviewed.set(file.name,file);}
 if(local.some(file=>reviewed.has(file.name)))throw Error('廃止対象がローカル送信元に残っています。部分的な廃止は許可しません。');
 const h=head.filter(file=>reviewed.has(file.name)),p=published.filter(file=>reviewed.has(file.name));
 if(!h.length&&!p.length)return new Set(); // Both remote copies already retired; ordinary guard applies.
 if(p.length!==names.length||context.version!==approval.baselineVersion||![0,names.length].includes(h.length))throw Error('廃止前の固定公開版またはHEADの構成が承認済み基準と異なります。');
 for(const file of [...h,...p]){const expected=reviewed.get(file.name);if(file.type!==expected.type||file.hash!==expected.hash)throw Error('廃止対象に未確認の変更があります: '+file.name);}
 return new Set(h.map(file=>file.name));
}
module.exports={names,approvedFiles};
