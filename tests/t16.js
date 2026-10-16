const FILE=require('url').pathToFileURL(require('path').resolve('dist/carnet.html')).href;
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({});
const p=await b.newPage({viewport:{width:1100,height:1400}});const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(FILE);await p.waitForTimeout(600);
await p.click('#tab-tips');await p.waitForTimeout(300);
console.log(await p.$$eval('#tips-body .chip, #tips-body [data-cat]',a=>a.map(x=>x.textContent).join('|')));
const chips=await p.$$('#tips-body [data-cat]');for(const c of chips){if((await c.textContent()).includes('Builds')){await c.click();break}}
await p.waitForTimeout(300);
const txt=await p.textContent('#tips-body');
console.log(txt.includes('{{'));const m=txt.match(/[A-Za-z' -]+(?= \()/g);
await p.screenshot({path:'dist/shot_builds.png',fullPage:true});
console.log(e);await b.close();})();
