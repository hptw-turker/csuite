import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const FILE = process.argv[2], OUT = process.argv[3];
const GF = 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,500&display=swap';
const sh = (c) => execFileSync('bash', ['-lc', c], { maxBuffer: 64 * 1024 * 1024 });
let css = sh(`curl -s --compressed -A 'Mozilla/5.0' '${GF}'`).toString();
const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) ?? [])];
const fonts = new Map();
urls.forEach((u, i) => { fonts.set(`/gs/${i}`, sh(`curl -s '${u}'`)); css = css.split(u).join(`http://127.0.0.1:8905/gs/${i}`); });
const page0 = Buffer.from(readFileSync(FILE, 'utf8').split(GF).join('http://127.0.0.1:8905/gf.css'));
const srv = createServer((rq, rs) => {
  const u = rq.url.split('?')[0];
  if (u === '/gf.css') { rs.writeHead(200, { 'Content-Type': 'text/css' }); return rs.end(css); }
  if (fonts.has(u)) { rs.writeHead(200, { 'Content-Type': 'font/woff2' }); return rs.end(fonts.get(u)); }
  if (u.startsWith('/api/')) { rs.writeHead(200, { 'Content-Type': 'application/json' }); return rs.end('{"captcha":null,"yapilandirma":{"siteKey":null,"secret":null}}'); }
  rs.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); rs.end(page0);
}).listen(8905);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
for (const [vn, w, h] of [['masaustu', 1440, 900], ['mobil', 390, 844]]) {
  for (const persona of ['emp', 'cand']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8905/', { waitUntil: 'load' });
    await p.waitForTimeout(800);
    if (persona === 'cand') { await p.click('#tab-cand'); await p.waitForTimeout(700); }
    // tüm bölümleri görünür kıl (reveal animasyonu)
    await p.evaluate(() => { for (let y = 0; y < document.body.scrollHeight; y += 300) scrollTo(0, y); });
    await p.waitForTimeout(1200);
    for (const [ad, sel] of [['hero', '.persona.show .hero-copy, .persona.show header, #top'],
                             ['neden', '#neden'], ['network', '#network'], ['surec', '#surec'],
                             ['fark', '.persona.show .ctable, .persona.show table'], ['guven', '#guven']]) {
      const el = await p.$(sel.split(',')[0]) ?? await p.$(sel.split(',').pop().trim());
      if (el) { try { await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
        await el.screenshot({ path: `${OUT}/${vn}-${persona}-${ad}.png` }); } catch (e) { console.log('atla', ad, e.message.slice(0,60)); } }
      else console.log('bulunamadi', ad);
    }
    await ctx.close();
  }
}
await b.close(); srv.close();
