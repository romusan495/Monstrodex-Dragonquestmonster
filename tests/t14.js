const FILE=require('url').pathToFileURL(require('path').resolve('dist/carnet.html')).href;
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({});
const p=await b.newPage({viewport:{width:1100,height:1400}});const e=[];p.on('pageerror',x=>e.push(x.message));
await p.goto(FILE);await p.waitForTimeout(600);
await p.click('#tab-syn');await p.click('[data-mode=ult]');
let k=0;
for(const [m,t] of [['Mortamor',['Bonus de PV IV']],['Mortamor',['Esthète de Flamme','Trombe']],['Mortamor',['Bûcher-charcuteur']],['Zoma',['Pyromane','Frigo','Marmule']],['Mortamor',['Pentacliste']]]){
 await p.fill('#ut',m);for(let i=0;i<3;i++)await p.fill('#ut'+(i+1),t[i]||'');
 const t0=Date.now();await p.waitForTimeout(450);await p.waitForFunction(()=>/au total|arbre|reconnu/.test(document.getElementById('ult-out').textContent),null,{timeout:120000});
 console.log(m,t,(await p.textContent('#ult-out')).match(/(\d+) fusions? au total|Aucun arbre/)?.[0],Date.now()-t0,'ms');
 if(k++==0)await p.screenshot({path:'dist/shot_ult2.png',fullPage:true});
}
console.log(e);await b.close();})();
