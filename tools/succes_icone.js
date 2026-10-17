// Rend succes/icone.svg en PNG (16 à 256 px) et les assemble en succes/icone.ico pour l'exe : deno run -A tools/succes_icone.js
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const TAILLES = [16, 24, 32, 48, 64, 128, 256];
(async () => {
  const svg = fs.readFileSync(path.resolve('succes/icone.svg'), 'utf8');
  const b = await chromium.launch({});
  const pngs = [];
  for (const t of TAILLES) {
    const p = await b.newPage({ viewport: { width: t, height: t } });
    await p.setContent(`<body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${t}" height="${t}" `)}</body>`);
    pngs.push(await p.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: t, height: t } }));
    await p.close();
  }
  await b.close();
  // ICO : en-tête (6 octets), une entrée de 16 octets par taille, puis les PNG.
  const entete = Buffer.alloc(6 + 16 * pngs.length);
  entete.writeUInt16LE(0, 0); entete.writeUInt16LE(1, 2); entete.writeUInt16LE(pngs.length, 4);
  let decalage = entete.length;
  pngs.forEach((png, i) => {
    const o = 6 + 16 * i, t = TAILLES[i];
    entete.writeUInt8(t >= 256 ? 0 : t, o); entete.writeUInt8(t >= 256 ? 0 : t, o + 1);
    entete.writeUInt16LE(1, o + 4); entete.writeUInt16LE(32, o + 6);
    entete.writeUInt32LE(png.length, o + 8); entete.writeUInt32LE(decalage, o + 12);
    decalage += png.length;
  });
  fs.writeFileSync('succes/icone.ico', Buffer.concat([entete, ...pngs]));
  fs.writeFileSync('succes/icone-256.png', pngs[pngs.length - 1]);
  console.log('succes/icone.ico :', TAILLES.join(', '), 'px');
})();
