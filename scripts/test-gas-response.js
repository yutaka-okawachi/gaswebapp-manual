'use strict';
const assert=require('assert/strict'),{parseGasResponse}=require('./sync/gas-response');
(async()=>{
 const make=(body,type='text/html',url='https://script.googleusercontent.com/macros/echo?SECRET=must-not-log')=>({status:200,url,headers:new Headers({'content-type':type}),text:async()=>body});
 assert.deepEqual(await parseGasResponse(make('{"status":"success","files":{"a":"retained"}}','application/json'),'exportSnapshot'),{status:'success',files:{a:'retained'}});
 assert.equal((await parseGasResponse(make('{"status":"success"}','text/plain'),'exportSnapshot')).status,'success','Valid JSON is accepted independently of MIME');
 for(const [body,url,category,retry]of [
  ['<!doctype html><title>Sign in - Google Accounts</title>PRIVATE_TOKEN','https://accounts.google.com/ServiceLogin','authentication',false],
  ['<!doctype html>captcha PRIVATE_TOKEN','','captcha',false],
  ['<!doctype html>Service invoked too many times: quota PRIVATE_TOKEN','','quota',false],
  ['<!doctype html>Exceeded maximum execution time PRIVATE_TOKEN','','script-timeout',false],
  ['<!doctype html><title>Google Drive</title>PRIVATE_TOKEN','','google-document-error',true],
  ['<!doctype html>Service Unavailable PRIVATE_TOKEN','','temporary-server-error',true],
  ['<!doctype html>other PRIVATE_TOKEN','','unexpected-html',true],
  ['{"PRIVATE_TOKEN":','','invalid-json',true],
  ['null','','invalid-json',true]
 ])await assert.rejects(()=>parseGasResponse(make(body,'text/html',url),'exportSnapshot'),error=>error.responseClass===category&&error.retryable===retry&&error.message.includes('HTTP 200')&&!/PRIVATE_TOKEN|SECRET|ServiceLogin|doctype/i.test(error.message));
 console.log('GAS response: JSON preservation, HTML/auth/captcha/quota/time-limit classification and secret-free diagnostics passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
