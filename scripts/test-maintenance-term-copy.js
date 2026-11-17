'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'frontend/state-and-notifications.js'),'utf8');
const code=source.match(/function showMaintenanceTermCopy[\s\S]*?window.showMaintenanceTermCopy[^;]+;/)[0];
function fixture(admin,lang,fail){let copied='',oldRemoved=0;const elements=[];const element=()=>({children:[],appendChild(x){this.children.push(x)},setAttribute(){},addEventListener(_,fn){this.click=fn}});const document={documentElement:{lang},getElementById(){return {remove(){oldRemoved++}}},createElement(){const x=element();elements.push(x);return x}};const c={document,window:{isAdminDeviceOptOut:()=>admin},navigator:{clipboard:{async writeText(t){if(fail)throw Error('denied');copied=t}}}};vm.createContext(c);vm.runInContext(code,c);const container=element();return {c,container,elements,copied:()=>copied,removed:()=>oldRemoved};}
(async()=>{
let f=fixture(false,'ja');f.c.showMaintenanceTermCopy('See',f.container);assert.equal(f.container.children.length,0);
f=fixture(true,'ja');f.c.showMaintenanceTermCopy('  grossem  ',f.container);assert.equal(f.container.children.length,1);assert.equal(f.elements[1].textContent,'整備する語をコピー');await f.elements[1].click();assert.equal(f.copied(),'grossem');assert.match(f.elements[2].textContent,/コピーした/);
f=fixture(true,'en');f.c.showMaintenanceTermCopy('kind',f.container);assert.equal(f.elements[1].textContent,'Copy term for maintenance');await f.elements[1].click();assert.equal(f.copied(),'kind');
f=fixture(true,'ja',true);f.c.showMaintenanceTermCopy('See',f.container);await f.elements[1].click();assert.match(f.elements[2].textContent,/See/);
assert(!source.includes('observe_unregistered_result_term'));
console.log('Maintenance term copy: admin gating, clipboard, fallback and no observation passed');
})().catch(e=>{console.error(e);process.exitCode=1});
