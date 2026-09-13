// İçerik revizyonu kontrolü: masaüstü/mobil × İşveren/Aday.
// Form GÖNDERİLMEZ; yalnızca metinler, taşma, düğme çakışması ve
// üst görüşme düğmesinin forma kaydırma davranışı ölçülür.
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FILE = process.argv[2];
const GF = 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,500&display=swap';
const sh = (c) => execFileSync('bash', ['-lc', c], { maxBuffer: 64 * 1024 * 1024 });
let css = sh(`curl -s --compressed -A 'Mozilla/5.0' '${GF}'`).toString();
const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) ?? [])];
const fonts = new Map();
urls.forEach((u, i) => { fonts.set(`/gs/${i}`, sh(`curl -s '${u}'`)); css = css.split(u).join(`http://127.0.0.1:8903/gs/${i}`); });
const page0 = Buffer.from(readFileSync(FILE, 'utf8').split(GF).join('http://127.0.0.1:8903/gf.css'));
const srv = createServer((rq, rs) => {
  const u = rq.url.split('?')[0];
  if (u === '/gf.css') { rs.writeHead(200, { 'Content-Type': 'text/css' }); return rs.end(css); }
  if (fonts.has(u)) { rs.writeHead(200, { 'Content-Type': 'font/woff2' }); return rs.end(fonts.get(u)); }
  if (u.startsWith('/api/')) { rs.writeHead(200, { 'Content-Type': 'application/json' }); return rs.end('{"captcha":null,"yapilandirma":{"siteKey":null,"secret":null}}'); }
  rs.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); rs.end(page0);
}).listen(8903);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const VPS = [{ n: 'masaüstü', w: 1440, h: 900 }, { n: 'mobil', w: 390, h: 844 }];
const rows = [];
for (const vp of VPS) {
  for (const persona of ['emp', 'cand']) {
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 90)));
    await p.goto('http://127.0.0.1:8903/', { waitUntil: 'load' });
    await p.waitForTimeout(900);
    if (persona === 'cand') { await p.click('#tab-cand'); await p.waitForTimeout(700); }

    // üstteki görüşme düğmesine tıkla (mobilde menüden)
    if (vp.w <= 680) { await p.click('#burger'); await p.waitForTimeout(400); await p.click('#mnavCta'); }
    else { await p.click('#navCta'); }
    await p.waitForTimeout(1600);

    const m = await p.evaluate(() => {
      const navH = document.getElementById('nav').getBoundingClientRect().height;
      const card = document.getElementById('formTop').getBoundingClientRect();
      const ad = document.getElementById('ad').getBoundingClientRect();
      const lbl = document.querySelector('#formTop label[for="ad"]').getBoundingClientRect();
      const btn = document.getElementById('formBtn').getBoundingClientRect();
      const govde = document.body;
      // yatay taşma ve düğme çakışması
      const tasma = govde.scrollWidth - govde.clientWidth;
      const kesik = [...document.querySelectorAll('.art .abody p,.step p,.crow div,.titem p,.sec-sub,.lede,.btn')]
        .filter(e => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).length;
      const cakisma = (() => { const a = document.getElementById('formBtn').getBoundingClientRect();
        const n = document.querySelector('#formTop .formnote')?.getBoundingClientRect();
        return n ? (a.bottom > n.top + 1) : false; })();
      return { navH: Math.round(navH), kartUst: Math.round(card.top), etiketUst: Math.round(lbl.top),
               ilkAlanUst: Math.round(ad.top), butonAlt: Math.round(btn.bottom), tasma, kesik, cakisma,
               sirket: document.getElementById('sirketLabel').textContent.trim(),
               btn: document.getElementById('btnText').textContent.trim(),
               taraf: document.getElementById('formTaraf').value,
               kart01: document.querySelector('.persona.show[data-persona="' + (document.getElementById('tab-cand').classList.contains('active') ? 'cand' : 'emp') + '"] .art .abody h4')?.textContent.trim(),
               aiRenk: getComputedStyle(document.querySelector('.art .athumb .ai')).color,
               surecBaslik: document.querySelector('#surec .sec-title').textContent.trim(),
               mctaVar: !!document.getElementById('mcta') };
    });
    rows.push({ görünüm: `${vp.n}/${persona}`, 'nav yük.': m.navH, 'form kartı üst': m.kartUst,
      'etiket üst': m.etiketUst, 'ilk alan üst': m.ilkAlanUst,
      'menü örtüyor mu': m.etiketUst < m.navH ? 'EVET' : 'hayır',
      'yatay taşma': m.tasma, 'kesik metin': m.kesik, 'düğme çakışma': m.cakisma ? 'VAR' : 'yok',
      'sabit CTA': m.mctaVar ? 'VAR' : 'yok', 'js hata': errs.length,
      'şirket etiketi': m.sirket, 'buton': m.btn, taraf: m.taraf, '01 kart': m.kart01, 'ai renk': m.aiRenk });
    if (errs.length) console.log(' js hataları:', errs);
    if (vp.n === 'masaüstü' && persona === 'emp') console.log('süreç başlığı:', m.surecBaslik);
    await ctx.close();
  }
}
console.table(rows);
await b.close(); srv.close();
