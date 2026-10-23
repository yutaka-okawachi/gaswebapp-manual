'use strict';
// Report only a fixed classification, never response text, redirect query, or credentials.
async function parseGasResponse(response, action) {
    const text=await response.text();
    try {
        const result=JSON.parse(text);
        if(result&&typeof result==='object'&&!Array.isArray(result))return result;
    } catch (_) { /* classify without copying the parse error or its source snippet */ }
    let host='';try{host=new URL(response.url).hostname;}catch{}
    const html=/^\s*(?:<!doctype|<html)/i.test(text);
    const authentication=host==='accounts.google.com'||/<title>[^<]*(?:Sign in|ログイン)[^<]*<\/title>/i.test(text);
    const captcha=/captcha|unusual traffic/i.test(text);
    const quota=/quota|service invoked too many times|Too Many Requests|割り当て|利用上限/i.test(text);
    const scriptTimeout=/Exceeded maximum execution time|最大実行時間|実行時間の上限/i.test(text);
    const category=authentication?'authentication':captcha?'captcha':quota?'quota':scriptTimeout?'script-timeout':
        /Google Drive|Google ドライブ|Google Docs/i.test(text)?'google-document-error':
        /Service Unavailable|temporar(?:ily|y)/i.test(text)?'temporary-server-error':html?'unexpected-html':'invalid-json';
    const content=String(response.headers?.get('content-type')||'');
    const mime=/^application\/json\b/i.test(content)?'application/json':/^text\/html\b/i.test(content)?'text/html':/^text\/plain\b/i.test(content)?'text/plain':'other';
    const safeAction=String(action).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,40);
    const error=Error('GAS '+safeAction+': JSON応答を確認できません (HTTP '+Number(response.status||0)+'; '+mime+'; '+category+'). 更新・公開せず停止します。');
    error.responseClass=category;
    error.retryable=!(authentication||captcha||quota||scriptTimeout);
    throw error;
}
module.exports={parseGasResponse};
