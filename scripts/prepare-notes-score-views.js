'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const model=require('../frontend/notes-score-model');
function prepare(manifest,ledger,root,mode='public') {
    const registry=model.registry(manifest,ledger,{mode}), items=[];
    for(const item of manifest.items){
        const approved=registry.get(item.id);if(!approved)continue;
        for(const page of approved.pages)for(const asset of [page.full,page.excerpt].filter(Boolean)){
            const file=path.resolve(root,'mahler-search-app',asset.path), prefix=path.resolve(root,'mahler-search-app','images','score-pages')+path.sep;
            if(!file.startsWith(prefix)||!fs.realpathSync(file).startsWith(fs.realpathSync(path.resolve(root,'mahler-search-app','images','score-pages'))+path.sep))throw Error('Image outside approved asset root');
            const bytes=fs.readFileSync(file);
            if(crypto.createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('Image digest mismatch: '+asset.path);
            if(asset.path.endsWith('.png')&&(bytes.toString('hex',0,8)!=='89504e470d0a1a0a'||bytes.readUInt32BE(16)!==asset.width||bytes.readUInt32BE(20)!==asset.height))throw Error('PNG dimensions mismatch: '+asset.path);
        }
        items.push(item);
    }
    const ids=new Set(items.map(item=>item.rightsRecordId));
    const records=ledger.records.filter(r=>ids.has(r.id)).map(r=>({id:r.id,referenceId:r.referenceId,reviewStatus:r.reviewStatus,privatePreviewApproved:r.privatePreviewApproved===true,publicReleaseApproved:r.publicReleaseApproved===true,sourcePdfSha256:r.sourcePdfSha256,pdfUrls:r.pdfUrls,assetSha256:r.assetSha256}));
    return {manifest:{schemaVersion:1,items},ledger:{schemaVersion:1,records}};
}
module.exports={prepare};
