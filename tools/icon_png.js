// Rend assets/site/favicon.svg en PNG 180 x 180 (apple-touch-icon) : deno run -A tools/icon_png.js
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
(async () => {
  const svg = fs.readFileSync(path.resolve('assets/site/favicon.svg'), 'utf8');
  const b = await chromium.launch({});
  const p = await b.newPage({ viewport: { width: 180, height: 180 } });
  await p.setContent(`<body style="margin:0;background:#0d0828">${svg.replace('<svg ', '<svg width="180" height="180" ')}</body>`);
  await p.screenshot({ path: 'assets/site/apple-touch-icon.png', clip: { x: 0, y: 0, width: 180, height: 180 } });
  await b.close();
})();
