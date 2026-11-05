// Genera guia-rapida.pdf (A5, frente y dorso) a partir de guia-rapida.html.
// Uso: node docs/guia-rapida/generar-pdf.cjs
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.join(__dirname, 'guia-rapida.html'));
  await page.pdf({
    path: path.join(__dirname, 'guia-rapida.pdf'),
    format: 'A5',
    printBackground: true,
    margin: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  await browser.close();
})();
