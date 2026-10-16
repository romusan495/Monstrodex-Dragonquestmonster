const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:1920,height:1080}});
await p.goto('file://'+process.cwd()+'/scene.svg');await p.waitForTimeout(1500);
await p.screenshot({path:'scene.png'});await b.close()})();
