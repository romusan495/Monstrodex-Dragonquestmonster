const FILE=require('url').pathToFileURL(require('path').resolve('dist/carnet.html')).href;
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({});
const p=await b.newPage({viewport:{width:1100,height:1400}});const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(FILE);await p.waitForTimeout(600);
await p.click('#tab-syn');
// plan mode
await p.click('[data-mode=plan]');await p.fill('#pt','Mortamor');await p.waitForTimeout(400);
let d=await p.$('#plan-out details.node');await (await d.$('summary')).click({position:{x:20,y:10}});await p.waitForTimeout(300);
console.log('plan open',await d.evaluate(x=>x.open));
let mini=await p.$$('#plan-out .ownbtn.mini');console.log('minis',mini.length);
await mini[0].click();await p.waitForTimeout(300);console.log('still open',await d.evaluate(x=>x.open),'owned text',await mini[0].textContent());
// ult mode
await p.click('[data-mode=ult]');await p.fill('#ut','Mortamor');await p.fill('#ut1','Bonus de PV IV');await p.waitForTimeout(900);
await p.waitForFunction(()=>/au total/.test(document.getElementById('ult-out').textContent));
console.log((await p.textContent('#ult-out')).match(/(\d+) fusions? au total/)[0]);
let ms=await p.$$('#ult-out .ownbtn.mini');console.log('ult minis',ms.length);
const before=await p.textContent('#ult-out');
await ms[ms.length-1].click();await p.waitForTimeout(1200);
await p.waitForFunction(()=>/au total/.test(document.getElementById('ult-out').textContent));
console.log('changed',before!==await p.textContent('#ult-out'),(await p.textContent('#ult-out')).match(/(\d+) fusions? au total/)[0]);
await p.screenshot({path:'dist/shot_ult3.png',fullPage:true});
console.log(e);await b.close();})();
