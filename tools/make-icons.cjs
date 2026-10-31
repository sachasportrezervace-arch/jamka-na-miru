// node tools/make-icons.cjs – vyrenderuje icons/icon.svg do PNG (192, 512, maskable 512, apple-touch 180) přes Playwright Chromium.
// Vzor: ../ovocny-souboj/tools/make-icons.cjs (pozadí maskable ikony je trávník místo tmavé modré).
const path = require("path"), fs = require("fs");
const { chromium } = require(process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright"));
const root = path.join(__dirname, "..", "icons"), svg = fs.readFileSync(path.join(root, "icon.svg"), "utf8");
const BG = "#57B947";
const out = [["icon-192.png", 192, 1], ["icon-512.png", 512, 1], ["icon-maskable-512.png", 512, 0.78], ["apple-touch-icon.png", 180, 1]];
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  for (const [name, size, k] of out) {
    await p.setViewportSize({ width: size, height: size });
    // maskable: motiv zmenšený do bezpečné zóny, okraj dobarvený pozadím
    await p.setContent(`<body style="margin:0;background:${BG};display:grid;place-items:center;width:${size}px;height:${size}px;overflow:hidden"><div style="width:${size * k}px;height:${size * k}px">${svg.replace("<svg ", '<svg width="100%" height="100%" ')}</div></body>`);
    await p.screenshot({ path: path.join(root, name) });
    console.log(name, size);
  }
  await b.close();
})();
