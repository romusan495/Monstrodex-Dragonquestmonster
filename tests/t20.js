const FILE=require('url').pathToFileURL(require('path').resolve('dist/carnet.html')).href;
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({});
const p=await b.newPage({viewport:{width:1280,height:800}});const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(FILE);await p.waitForTimeout(3000);
await p.screenshot({path:'dist/shot_bg_desktop.png'});
const m=await b.newPage({viewport:{width:390,height:800}});await m.goto(FILE);await m.waitForTimeout(2500);await m.screenshot({path:'dist/shot_bg_phone.png'});
await p.click('#tab-syn');await p.waitForTimeout(500);await p.screenshot({path:'dist/shot_bg_syn.png'});
console.log(e);await b.close()})();
