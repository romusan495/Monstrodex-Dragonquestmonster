const FILE=require('url').pathToFileURL(require('path').resolve('dist/carnet.html')).href;
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({});
const p=await b.newPage();const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(require('url').pathToFileURL(require('path').resolve('docs/dqm3/index.html')).href);await p.waitForTimeout(800);
await p.check('.mon .mk.o input');
console.log(await p.textContent('#n-own'),await p.textContent('#sync'),e,await p.title());await b.close();})();
