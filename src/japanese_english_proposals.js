/** Private proposal review. Writes only J and U:Z; never publishes or changes source text. */
const ENGLISH_PROPOSAL_HEADERS = [
  '確認ID', 'ドイツ語', '修正前の日本語', '現在の日本語（修正案）', '修正点', '改訂英訳候補',
  'イタリア語の比較', '根拠・未解決点', '準備状態', 'ユーザー判断', '原文本体の照合',
  '変更前の英訳候補', '元タブ', '元行（参考）', '使用箇所・出典（作成時）', '提案版',
  '元行ID（参照）', '原文控えJSON', '提案控えJSON', '作成日時',
  '確認時原文JSON', '確認時提案JSON', '確認日時', '保存操作ID', '確認の有効性', '再確認理由'
];
const ENGLISH_PROPOSAL_DECISIONS = ['未確認', '修正希望', '採用希望', '見送り'];

// Hash the exact pre-existing proposal object, including every A:I / L:T field and R/S.
// The body stays in its original cells; only newly written V receipts use this compact form.
function englishProposalProof_(proposalText,decision) {
  const proposal=JSON.parse(proposalText);
  return JSON.stringify({schema:2,algorithm:'sha256-json-proposal-v1',id:proposal.id,version:proposal.version,
    proposalDigest:englishReviewDigest_(proposal),decision:decision});
}
function englishProposalProofContentMatches_(text,proposalText) {
  try {
    const proof=JSON.parse(text);
    if(!proof||typeof proof!=='object'||Array.isArray(proof))return false;
    if(proof.schema===undefined)return JSON.stringify(proof.proposal)===proposalText;
    const proposal=JSON.parse(proposalText);
    return proof.schema===2&&proof.algorithm==='sha256-json-proposal-v1'&&proof.id===proposal.id&&proof.version===proposal.version&&
      typeof proof.proposalDigest==='string'&&/^[a-f0-9]{64}$/.test(proof.proposalDigest)&&proof.proposalDigest===englishReviewDigest_(proposal);
  }catch(_){return false;}
}
function englishProposalProofMatches_(text,proposalText,decision) {
  try{return englishProposalProofContentMatches_(text,proposalText)&&JSON.parse(text).decision===decision;}catch(_){return false;}
}

function englishProposalSnapshot_(text) {
  try {
    const value = JSON.parse(text);
    if (!value || !Array.isArray(value.row) || !Array.isArray(value.notes) ||
        value.row.length !== value.notes.length || !value.row.length ||
        value.row.concat(value.notes).some(function (v) { return typeof v !== 'string'; })) return '';
    return JSON.stringify({ row: value.row, notes: value.notes });
  } catch (_) { return ''; }
}

function englishProposalIndexRead_(read){return typeof englishManualMeasure_==='function'?englishManualMeasure_('index',read):read();}
function englishProposalRead_(selectedKeys, manualBatch) {
  const legacy = englishReviewSheet_(), workbook = legacy.workbook;
  const sheet = workbook.getSheetByName('日英修正案');
  if (!sheet || sheet.getMaxColumns() < 26 || sheet.getLastRow() < 4) {
    throw new Error('「日英修正案」の準備ができていません。クラウド側で列契約と候補を準備してください。');
  }
  const headers = sheet.getRange(4, 1, 1, 26).getDisplayValues()[0];
  if (headers.some(function (v, i) { return v !== ENGLISH_PROPOSAL_HEADERS[i]; })) {
    throw new Error('日英修正案の列構成が契約と異なります。書込みを停止しました。');
  }
  const count = Math.max(0, sheet.getLastRow() - 4);
  if (count > 20000) throw new Error('日英修正案の件数が上限を超えています。');
  let rows, formulas, rowNumbers, info, indexedLatest, proposalNotes, requests;
  if (selectedKeys !== undefined) {
    if (!Array.isArray(selectedKeys) || !selectedKeys.length || selectedKeys.length > (manualBatch===true?50:20) || new Set(selectedKeys).size !== selectedKeys.length ||
        selectedKeys.some(function (k) { return typeof k !== 'string' || !/^EN-\d{6}\/v[1-9]\d{0,5}$/.test(k); })) throw new Error('選択IDが不正です。');
    const identity=englishProposalIndexRead_(function(){return {ids:count?sheet.getRange(5,1,count,1).getDisplayValues():[],versions:count?sheet.getRange(5,16,count,1).getDisplayValues():[]};});
    const ids=identity.ids,versions=identity.versions;
    const positions = Object.create(null); indexedLatest = Object.create(null);
    ids.forEach(function (r,i) {
      const id=r[0],version=versions[i][0],key=id+'/'+version;
      if (!id && !version) return;
      if (!/^EN-\d{6}$/.test(id) || !/^v[1-9]\d{0,5}$/.test(version) || positions[key]) throw new Error('確認ID・提案版が不正または重複しています。');
      positions[key]=i+5; indexedLatest[id]=Math.max(indexedLatest[id]||0,Number(version.slice(1)));
    });
    rowNumbers=selectedKeys.filter(function (key) { return positions[key]; }).map(function (key) { return positions[key]; }).sort(function(a,b){return a-b;});
    rows=[]; formulas=[]; proposalNotes=[];requests=[];
    const groups=[];rowNumbers.forEach(function(n){const last=groups[groups.length-1];if(last&&last.first+last.count===n)last.count++;else groups.push({first:n,count:1});});
    groups.forEach(function (part) { const range=sheet.getRange(part.first,1,part.count,manualBatch===true?30:26),v=range.getDisplayValues(),f=range.getFormulas(),n=range.getNotes();
      rows=rows.concat(v.map(function(a){return a.slice(0,26);}));formulas=formulas.concat(f.map(function(a){return a.slice(0,26);}));proposalNotes=proposalNotes.concat(n.map(function(a){return a.slice(0,26);}));
      v.forEach(function(a,i){requests.push({values:a.slice(26),formulas:f[i].slice(26),notes:n[i].slice(26)});});
    });
    if(rows.some(function (r) { return selectedKeys.indexOf(r[0]+'/'+r[15])<0; }))throw new Error('読込み中に行位置が変わりました。もう一度選択してください。');
    info={tags:Object.create(null)};
    if (!englishReviewAutoLayout_(legacy.sheet,false)) throw new Error('元行IDの管理列がありません。');
    const requestedIds=Array.from(new Set(rows.map(function (r) { return r[16]; })));
    requestedIds.forEach(function (id) {
      if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id)<1) return;
      const tags=workbook.createDeveloperMetadataFinder().withKey(ENGLISH_REVIEW_METADATA_KEY).withId(Number(id)).find();
      if(tags.length!==1)return;const tag=tags[0],location=tag.getLocation().getRow();
      if(location)info.tags[id]={id:tag.getValue(),tab:location.getSheet().getName(),rowNumber:location.getRow()};
    });
  } else {
    const range = count ? sheet.getRange(5, 1, count, 26) : null;
    rows = range ? range.getDisplayValues() : []; formulas = range ? range.getFormulas() : [];
    rowNumbers=rows.map(function (_,i) { return i+5; }); info=englishReviewAutoInfo_(legacy,false);
  }
  const legacyCount = Math.max(0, legacy.sheet.getLastRow() - 1);
  const registry=englishProposalIndexRead_(function(){return {rows:legacyCount?legacy.sheet.getRange(2,1,legacyCount,2).getDisplayValues():[],tags:legacyCount?legacy.sheet.getRange(2,20,legacyCount,1).getDisplayValues():[]};});
  const legacyRows=registry.rows,legacyTags=registry.tags;
  const legacyById = Object.create(null);
  legacyRows.forEach(function (r, i) {
    if (!r[0]) return;
    if (legacyById[r[0]]) legacyById[r[0]].count++;
    else legacyById[r[0]] = { count: 1, tab: r[1], metadataId: legacyTags[i][0] };
  });
  const sourceRows=selectedKeys ? Object.create(null) : undefined;
  if(sourceRows)Object.keys(info.tags).forEach(function (id) { const tag=info.tags[id];(sourceRows[tag.tab]||(sourceRows[tag.tab]=[])).push(tag.rowNumber); });
  const sources = englishReviewSources_(workbook, rows.filter(function (r) { return r[0]; })
    .map(function (r) { return r[12]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }),sourceRows);
  const seen = Object.create(null), latest = Object.create(null);
  const records = rows.map(function (row, index) {
    if (!row[0]) {
      if (row.some(function (v) { return v; })) throw new Error('確認IDのない提案行があります。対応を確認してください。');
      return null;
    }
    const id = row[0], version = row[15], key = id + '/' + version;
    if (!/^EN-\d{6}$/.test(id) || !/^v[1-9]\d{0,5}$/.test(version) || seen[key]) {
      throw new Error('確認ID・提案版が不正、重複、または版順を確定できません。書込みを停止しました。');
    }
    seen[key] = true;
    latest[id] = Math.max(latest[id] || 0, Number(version.slice(1)));
    if (['確認待ち', '保留'].indexOf(row[8]) < 0 || ENGLISH_PROPOSAL_DECISIONS.indexOf(row[9]) < 0 ||
        ['未確認', '確認済（本番未反映）', '再確認が必要'].indexOf(row[24]) < 0) {
      throw new Error('準備状態・ユーザー判断・確認の有効性に未対応の値があります。');
    }
    const matched = legacyById[id];
    const tag = info && info.tags[row[16]], tab = row[12];
    const unbound=typeof englishDraftUnbound_==='function'&&englishDraftUnbound_(workbook.getId(),row);
    const source = !unbound && matched && matched.count === 1 && matched.tab === tab && matched.metadataId === row[16] &&
      tag && tag.id === id && tag.tab === tab ? sources[tab].byRow[tag.rowNumber] : null;
    const sourceText = source ? JSON.stringify({ id: id, tab: tab, metadataId: row[16],
      row: source.row, notes: source.notes }) : '';
    const atCreation = englishProposalSnapshot_(row[17]);
    const creation = { id: id, version: version, ja: row[3], en: row[5], italian: row[6], changes: row[4], evidence: row[7] };
    let creationMatches = false;
    try {
      const saved = JSON.parse(row[18]);
      creationMatches = !!saved && Object.keys(creation).every(function (k) { return saved[k] === creation[k]; });
    } catch (_) {}
    const proposalText = JSON.stringify({ id: id, version: version, fields: row.slice(0, 9).concat(row.slice(11, 20)) });
    let reason = !source ? '元行ID・既存確認IDの対応を確定できません。' :
      !atCreation || atCreation !== englishReviewSourceSnapshot_(tab, source) ? '原文・日本語・使用箇所・補足が作成時から変わっています。新版を依頼してください。' : '';
    if(unbound&&englishDraftPlan_(row))reason=ENGLISH_DRAFT_WAIT;
    if (!reason && (row[1] !== source.row[tab === 'RW' || tab === 'RS' ? 5 : 0] ||
        row[2] !== source.row[tab === 'Notes' ? 1 : tab === 'GM' ? 2 : 7] ||
        row[14] !== (tab === 'Notes' ? source.row[2] : tab === 'GM' ? source.row[3] : JSON.stringify(source.row.slice(0, 5))))) {
      reason = '提案のドイツ語・修正前日本語・出典が原文控えと一致しません。';
    }
    if (!creationMatches) reason = '提案本文が作成時控えと一致しません。同じ版を変更せず新版を依頼してください。';
    const confirmedProposal = englishProposalProofContentMatches_(row[21],proposalText);
    // A confirmed version is immutable, even if its creation snapshot was also edited.
    if (row[21] && !confirmedProposal) reason = '確認済みの提案版が編集されています。新版を依頼してください。';
    const changed = row[20] && row[20] !== sourceText ? '確認後に原文・補足が変更されました。再確認が必要です。' : '';
    const proofMatches = row[20] === sourceText && confirmedProposal && englishProposalProofMatches_(row[21],proposalText,row[9]) && !!row[22] && !!row[23] && row[9] !== '未確認';
    const invalidReason = reason || changed || (row[24] === '確認済（本番未反映）' && !proofMatches ? '確認記録が一致しません。再確認してください。' : '') ||
      (row[9] === '採用希望' && row[8] === '保留' ? '準備状態が保留です。根拠・未解決点を確認してください。' : '');
    const pendingOnly=unbound&&reason===ENGLISH_DRAFT_WAIT&&row[24]==='未確認'&&!row.slice(20,24).some(Boolean);
    return { key: key, id: id, version: version, rowNumber: rowNumbers[index], row: row, formulas: formulas[index], proposalNotes: proposalNotes ? proposalNotes[index] : [],request:requests?requests[index]:null,
      de: row[1], beforeJa: row[2], ja: row[3], changes: row[4], english: row[5], italian: row[6], evidence: row[7],
      preparation: row[8], decision: row[9], sourceCheck: row[10], previousEnglish: row[11], tab: tab, context: row[14],
      supplements: source ? englishReviewSourceDetails_(tab, JSON.stringify({ row: source.row, notes: source.notes })) : '',
      sourceText: sourceText, proposalText: proposalText, reason: invalidReason || row[25], blocked: !!reason,
      validity: pendingOnly?'未確認':invalidReason || row[24] === '再確認が必要' ? '再確認が必要' : row[24],
      mustInvalidate: !pendingOnly && !!invalidReason && row[24] !== '再確認が必要',
      revision: englishReviewDigest_([row, formulas[index], sourceText]), latest: false };
  }).filter(function (r) { return r; });
  records.forEach(function (r) { r.latest = Number(r.version.slice(1)) === (indexedLatest || latest)[r.id]; });
  return { sheet: sheet, records: records, legacyIds: legacyRows.filter(function (r) { return r[0]; }).map(function (r) { return r[0]; }) };
}

function englishProposalPublic_(data, selectedRecords) {
  const ids = Array.from(new Set(data.records.map(function (r) { return r.id; })));
  const idSet = new Set(ids), legacyIds = Array.from(new Set(data.legacyIds));
  return { legacyCount: legacyIds.length, proposalCount: ids.length,
    unpreparedCount: legacyIds.filter(function (id) { return !idSet.has(id); }).length,
    records: (selectedRecords || data.records).map(function (r) {
    const item = {};
    ['key','id','version','de','beforeJa','ja','changes','english','italian','evidence','preparation','decision',
      'sourceCheck','previousEnglish','tab','context','supplements','reason','blocked','validity','revision','latest'].forEach(function (k) { item[k] = r[k]; });
    item.category = englishProposalCategory_(r);
    return item;
  }), decisions: ENGLISH_PROPOSAL_DECISIONS.slice() };
}

function englishProposalWrite_(sheet, row, column, values) {
  // Preserve this feature's hide ownership through legacy dialog/native status updates too.
  if(typeof ENGLISH_SIMPLE_HIDDEN!=='undefined'&&column<=26&&column+values.length>26){
    const prior=sheet.getRange(row,26,1,1).getDisplayValues()[0][0],offset=26-column;
    if(prior.indexOf(ENGLISH_SIMPLE_HIDDEN)>=0&&values[offset].indexOf(ENGLISH_SIMPLE_HIDDEN)<0){values=values.slice();values[offset]+=' '+ENGLISH_SIMPLE_HIDDEN;}
  }
  englishReviewAutoWrite_(sheet, row, column, values);
}

function englishProposalCategory_(record) {
  // The contract contains no verified small-edit classification. Never infer it from wording or length.
  return !record.blocked && record.preparation !== '保留' && record.beforeJa === record.ja ? 'unchanged' : 'review';
}

function englishProposalPageOptions_(request) {
  const value = request === undefined ? {} : request;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('表示条件が不正です。');
  const page = value.page === undefined ? 0 : value.page, filter = value.filter === undefined ? 'all' : value.filter;
  const includeHistory = value.includeHistory === undefined ? false : value.includeHistory;
  if (!Number.isInteger(page) || page < 0 || page > 1000 || ['all','unchanged','small','review'].indexOf(filter) < 0 ||
      typeof includeHistory !== 'boolean') throw new Error('表示条件が不正です。');
  return { page: page, filter: filter, includeHistory: includeHistory };
}

function englishProposalPage_(data, options) {
  const available = data.records.filter(function (r) { return options.includeHistory || r.latest; });
  const categories = { unchanged: 0, small: 0, review: 0 };
  available.forEach(function (r) { categories[englishProposalCategory_(r)]++; });
  const filtered = available.filter(function (r) { return options.filter === 'all' || englishProposalCategory_(r) === options.filter; });
  filtered.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : Number(b.version.slice(1)) - Number(a.version.slice(1)); });
  const totalPages = Math.max(1, Math.ceil(filtered.length / 20)), page = Math.min(options.page, totalPages - 1);
  return Object.assign(englishProposalPublic_(data, filtered.slice(page * 20, page * 20 + 20)), {
    page: page, pageSize: 20, totalItems: filtered.length, totalPages: totalPages, versionCount: data.records.length,
    categories: categories, filter: options.filter, includeHistory: options.includeHistory
  });
}

function getJapaneseEnglishProposalPage(request) {
  const options = englishProposalPageOptions_(request), lock = LockService.getDocumentLock();
  if (!lock || !lock.tryLock(10000)) throw new Error('保存処理が実行中です。少し待って読み直してください。');
  try { return englishProposalPage_(englishProposalRefresh_(), options); }
  finally { lock.releaseLock(); }
}

function saveJapaneseEnglishProposalSelection(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request) || request.confirmed !== true ||
      !Array.isArray(request.items) || !request.items.length || request.items.length > 20 ||
      ['修正希望','採用希望','見送り'].indexOf(request.decision) < 0 ||
      typeof request.operationId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(request.operationId)) {
    throw new Error('確認した表示中の提案を1〜20件選び、判断を明示してください。');
  }
  const seen = new Set(), options = englishProposalPageOptions_(request);
  request.items.forEach(function (item) {
    if (!item || typeof item.key !== 'string' || !/^EN-\d{6}\/v[1-9]\d{0,5}$/.test(item.key) ||
        typeof item.revision !== 'string' || !/^[a-f0-9]{64}$/.test(item.revision) || seen.has(item.key)) {
      throw new Error('選択した提案の識別が不正または重複しています。');
    }
    seen.add(item.key);
  });
  const lock = LockService.getDocumentLock();
  if (!lock || !lock.tryLock(10000)) throw new Error('ほかの保存処理が実行中です。');
  try {
    let data = englishProposalRefresh_(), active = [];
    const outcomes = Object.create(null);
    function index(current) { const map = Object.create(null); current.records.forEach(function (r) { map[r.key] = r; }); return map; }
    const initial = index(data), visible = new Set(englishProposalPage_(data, options).records.map(function (r) { return r.key; }));
    request.items.forEach(function (item) {
      const r = initial[item.key];
      let reason = !r || !visible.has(item.key) ? '現在の表示ページにない提案です。読み直してください。' : '';
      if (!reason && (!r.latest || r.blocked)) reason = r.reason || '旧版へは保存できません。';
      if (!reason && request.decision === '採用希望' && (r.preparation === '保留' || !r.ja.trim() || !r.english.trim())) reason = '保留中または日本語・英訳が空欄のため採用希望を確定できません。';
      if (reason) { outcomes[item.key] = {key:item.key,status:'blocked',reason:reason}; return; }
      if (r.row[23] === request.operationId && r.decision === request.decision && r.validity === '確認済（本番未反映）') {
        outcomes[item.key] = {key:item.key,status:'saved',reason:'同じ操作の保存を確認しました。'}; return;
      }
      if (r.revision !== item.revision || r.row[23] === request.operationId) {
        outcomes[item.key] = {key:item.key,status:'conflict',reason:'原文・提案・判断または前回の保存結果が変わっています。再確認してください。'}; return;
      }
      const proof = englishProposalProof_(r.proposalText,request.decision);
      if (r.sourceText.length > 45000 || proof.length > 45000) {
        outcomes[item.key] = {key:item.key,status:'blocked',reason:'確認記録の保存上限を超えています。'}; return;
      }
      active.push({original:r,current:r,proof:proof});
    });
    const hadActive = active.length > 0;
    let finalChecked = false;
    function invalidate(item, reason) {
      englishProposalWrite_(data.sheet, englishProposalRow_(data.sheet,item.current),25,['再確認が必要',reason]);
    }
    function fail(item, reason) {
      outcomes[item.original.key] = {key:item.original.key,status:'conflict',reason:reason};
      try { invalidate(item,reason); }
      catch (_) { outcomes[item.original.key] = {key:item.original.key,status:'unknown',reason:'保存結果と失効処理を確認できません。再読込みしてください。'}; }
    }
    function same(r,item) { return r && r.latest && !r.blocked && r.sourceText === item.original.sourceText && r.proposalText === item.original.proposalText; }
    function proofMatches(r,item) { return r.row[20] === item.original.sourceText && r.row[21] === item.proof && r.row[23] === request.operationId; }
    function stage(validate, write, refresh) {
      if (!active.length) return;
      try { data = refresh ? englishProposalRefresh_() : englishProposalRead_(); if (refresh) finalChecked = true; }
      catch (_) { active.forEach(function (item) { fail(item,'保存中の再照合に失敗しました。再確認してください。'); }); active=[]; return; }
      const map = index(data), next = [];
      active.forEach(function (item) {
        const r = map[item.original.key]; if (r) item.current=r;
        if (!same(r,item) || !validate(r,item)) { fail(item,'保存中に原文・提案・判断が変わりました。再確認してください。'); return; }
        try { write(r,item); next.push(item); }
        catch (_) { fail(item,'保存処理が完了しませんでした。再確認してください。'); }
      });
      active=next; SpreadsheetApp.flush();
    }
    active = active.filter(function (item) {
      try { invalidate(item,'判断を保存しています。未完了の場合は再確認してください。'); return true; }
      catch (_) { fail(item,'保存開始時の照合に失敗しました。'); return false; }
    });
    SpreadsheetApp.flush();
    stage(function (r,item) { return r.decision === item.original.decision; }, function (r,item) {
      englishProposalWrite_(data.sheet,englishProposalRow_(data.sheet,r),21,[item.original.sourceText,item.proof,new Date().toISOString(),request.operationId]);
    });
    stage(function (r,item) { return proofMatches(r,item) && r.decision === item.original.decision; }, function (r,item) {
      const row=englishProposalRow_(data.sheet,r);
      if (data.sheet.getRange(row,10,1,1).getDisplayValues()[0][0] !== item.original.decision) throw new Error('判断が変更されました。');
      englishProposalWrite_(data.sheet,row,10,[request.decision]);
    });
    stage(function (r,item) { return proofMatches(r,item) && r.decision === request.decision; }, function (r) {
      englishProposalWrite_(data.sheet,englishProposalRow_(data.sheet,r),25,['確認済（本番未反映）','']);
    });
    stage(function (r,item) { return proofMatches(r,item) && r.decision === request.decision && r.validity === '確認済（本番未反映）'; }, function (r) {
      outcomes[r.key]={key:r.key,status:'saved',reason:''};
    },true);
    // If every new write failed, the final stage had no active rows. Replayed successes
    // still need a fresh check: a direct edit may have happened during the failed writes.
    if (hadActive && !finalChecked && Object.keys(outcomes).some(function (key) { return outcomes[key].status === 'saved'; })) {
      try { data = englishProposalRefresh_(); }
      catch (_) {
        Object.keys(outcomes).forEach(function (key) {
          if (outcomes[key].status === 'saved') outcomes[key]={key:key,status:'unknown',reason:'前回の保存結果を最新の原文と照合できません。再読込みしてください。'};
        });
      }
    }
    const final=index(data);
    Object.keys(outcomes).forEach(function (key) {
      const result=outcomes[key],r=final[key];
      if (result.status === 'saved' && (!r || !r.latest || r.blocked || r.validity !== '確認済（本番未反映）' || r.decision !== request.decision || r.row[23] !== request.operationId)) {
        outcomes[key]={key:key,status:'conflict',reason:'保存後に状態が変わりました。再確認してください。'};
      }
    });
    const results=request.items.map(function (item) { return outcomes[item.key]; });
    const saved=results.filter(function (r) { return r.status === 'saved'; });
    return Object.assign(englishProposalPublic_(data,saved.map(function (r) { return final[r.key]; })), {
      results:results,savedCount:saved.length,operationId:request.operationId,requiresReload:saved.length !== results.length
    });
  } finally { lock.releaseLock(); }
}

function englishProposalRow_(sheet, record) {
  // Recheck identity immediately before writing. A moved row triggers a key-only rescan.
  function matches(row) { return sheet.getRange(row, 1, 1, 1).getDisplayValues()[0][0] === record.id &&
    sheet.getRange(row, 16, 1, 1).getDisplayValues()[0][0] === record.version; }
  if (matches(record.rowNumber)) return record.rowNumber;
  const count = Math.max(0, sheet.getLastRow() - 4);
  const ids = count ? sheet.getRange(5, 1, count, 1).getDisplayValues() : [];
  const versions = count ? sheet.getRange(5, 16, count, 1).getDisplayValues() : [];
  const matchesAt = [];
  ids.forEach(function (r, i) { if (r[0] === record.id && versions[i][0] === record.version) matchesAt.push(i + 5); });
  if (matchesAt.length !== 1 || !matches(matchesAt[0])) throw new Error('提案行の対応が変わりました。再読込みしてください。');
  return matchesAt[0];
}

function englishProposalInvalidate_(data, record, reason) {
  if(typeof englishSimpleInvalidate_==='function')englishSimpleInvalidate_(data.sheet,record,reason);
  else englishProposalWrite_(data.sheet, englishProposalRow_(data.sheet, record), 25, ['再確認が必要', reason]);
  SpreadsheetApp.flush();
}

function englishProposalRefresh_() {
  const data = englishProposalRead_();
  const invalid = data.records.filter(function (r) { return r.mustInvalidate; });
  if (!invalid.length) return data;
  invalid.forEach(function (r) {
    englishProposalInvalidate_(data, r, r.reason);
  });
  return englishProposalRead_();
}

function getJapaneseEnglishProposals() {
  const lock = LockService.getDocumentLock();
  if (!lock || !lock.tryLock(10000)) throw new Error('保存処理が実行中です。少し待って読み直してください。');
  try { return englishProposalPublic_(englishProposalRefresh_()); }
  finally { lock.releaseLock(); }
}

function saveJapaneseEnglishProposal(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request) ||
      typeof request.key !== 'string' || !/^EN-\d{6}\/v[1-9]\d{0,5}$/.test(request.key) ||
      typeof request.revision !== 'string' || !/^[a-f0-9]{64}$/.test(request.revision) ||
      typeof request.operationId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(request.operationId) ||
      ENGLISH_PROPOSAL_DECISIONS.indexOf(request.decision) < 0 || request.decision === '未確認' || request.confirmed !== true) {
    throw new Error('提案内容を確認し、判断を明示して保存してください。');
  }
  const lock = LockService.getDocumentLock();
  if (!lock || !lock.tryLock(10000)) throw new Error('ほかの保存処理が実行中です。');
  try {
    const before = englishProposalRefresh_();
    const record = before.records.filter(function (r) { return r.key === request.key; })[0];
    if (!record) throw new Error('提案が見つかりません。読み直してください。');
    if (record.row[23] === request.operationId) {
      if (record.decision !== request.decision || record.validity !== '確認済（本番未反映）' || record.blocked || !record.latest) {
        throw new Error('前の保存後に状態が変わっています。再読込みして確認してください。');
      }
      return Object.assign(englishProposalPublic_(before), { savedKey: record.key, notice: '' });
    }
    if (record.revision !== request.revision) throw new Error('原文・提案・判断が別の画面で変わりました。表示と入力を保持し、再読込みしてください。');
    if (!record.latest || record.blocked) throw new Error(record.reason || '旧版には判断を保存できません。最新版を確認してください。');
    if (request.decision === '採用希望' && (record.preparation === '保留' || !record.ja.trim() || !record.english.trim())) {
      throw new Error('保留中または日本語・英訳が空欄のため採用希望を確定できません。根拠・未解決点を確認してください。');
    }
    if (record.sourceText.length > 45000) throw new Error('確認記録の保存上限を超えています。');
    // Invalidate first; any interrupted write remains closed. Do not touch A:I or K:T.
    englishProposalInvalidate_(before, record, '判断を保存しています。未完了の場合は再確認してください。');
    let notice = '';
    try {
      const target = englishProposalRead_().records.filter(function (r) { return r.key === record.key; })[0];
      if (!target || target.sourceText !== record.sourceText || target.proposalText !== record.proposalText ||
          target.decision !== record.decision || !target.latest || target.blocked) throw new Error('保存直前に原文または提案が変更されました。');
      const confirmationText = englishProposalProof_(record.proposalText,request.decision);
      if (confirmationText.length > 45000) throw new Error('確認記録の保存上限を超えています。');
      englishProposalWrite_(before.sheet, target.rowNumber, 21, [record.sourceText, confirmationText, new Date().toISOString(), request.operationId]);
      const judgementTarget = englishProposalRead_().records.filter(function (r) { return r.key === record.key; })[0];
      if (!judgementTarget || judgementTarget.sourceText !== record.sourceText || judgementTarget.proposalText !== record.proposalText ||
          judgementTarget.row[20] !== record.sourceText || judgementTarget.row[21] !== confirmationText ||
          judgementTarget.row[23] !== request.operationId || judgementTarget.decision !== record.decision || !judgementTarget.latest || judgementTarget.blocked) {
        throw new Error('確認記録の保存中に原文・提案・判断が変更されました。');
      }
      englishProposalWrite_(before.sheet, judgementTarget.rowNumber, 10, [request.decision]);
      SpreadsheetApp.flush();
      const saved = englishProposalRead_().records.filter(function (r) { return r.key === record.key; })[0];
      if (!saved || saved.sourceText !== record.sourceText || saved.proposalText !== record.proposalText || !saved.latest || saved.blocked ||
          saved.row[20] !== record.sourceText || saved.row[21] !== confirmationText || saved.row[23] !== request.operationId || saved.decision !== request.decision) {
        throw new Error('保存中に原文・提案・判断が変更されました。');
      }
      englishProposalWrite_(before.sheet, saved.rowNumber, 25, ['確認済（本番未反映）', '']);
      SpreadsheetApp.flush();
      const final = englishProposalRefresh_();
      const checked = final.records.filter(function (r) { return r.key === record.key; })[0];
      if (!checked || checked.validity !== '確認済（本番未反映）' || checked.decision !== request.decision ||
          checked.row[23] !== request.operationId || !checked.latest) throw new Error('保存後の再照合で変更を検出しました。');
      return Object.assign(englishProposalPublic_(final), { savedKey: record.key, notice: '' });
    } catch (error) {
      notice = (error.message || '保存に失敗しました。') + ' 判断は有効扱いにしていません。再読込みして確認してください。';
      englishProposalInvalidate_(before, record, notice);
      throw new Error(notice);
    }
  } finally { lock.releaseLock(); }
}
