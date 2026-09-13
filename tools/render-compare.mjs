// Kaynak HTML ile yayımlanan önizleme sayfasını aynı koşullarda çizip karşılaştırır.
// Amaç: tasarımın masaüstü ve mobilde birebir korunduğunu ölçmek.
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const LIVE_HTML = process.argv[2];
if (!LIVE_HTML) { console.error('kullanım: node tools/render-compare.mjs <indirilmis-canli-html>'); process.exit(1); }

const SRC = '/home/user/csuite/site/C-Suite_Ideal_Revize.html';
const DEPLOYED = '/home/user/csuite/csuite-astro/public/index.html';
mkdirSync('/home/user/csuite/docs/img', { recursive: true });

// Yerel sunucu: karşılaştırılan üç sürümü de aynı şema (http) altında sunar.
// Chromium bu ortamda çıkış vekilini kullanamadığı için Google Fonts da yerelden verilir;
// bu sayede Poppins gerçekten yüklenir ve karşılaştırma tasarımı temsil eder.
const GF_URL = 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,500&display=swap';
const sh = (cmd) => execFileSync('bash', ['-lc', cmd], { maxBuffer: 64 * 1024 * 1024 });
let gfCss = sh(`curl -s --compressed -A 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36' '${GF_URL}'`).toString();
const fontUrls = [...new Set(gfCss.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) ?? [])];
const fontBytes = new Map();
fontUrls.forEach((u, i) => {
  fontBytes.set(`/gs/${i}`, sh(`curl -s '${u}'`));
  gfCss = gfCss.split(u).join(`http://127.0.0.1:8901/gs/${i}`);
});
console.log('yerel font önbelleği:', fontUrls.length, 'dosya');

const localize = (buf) => Buffer.from(buf.toString('utf8').split(GF_URL).join('http://127.0.0.1:8901/gf.css'));
const pages = {
  '/src.html': localize(readFileSync(SRC)),
  '/dep.html': localize(readFileSync(DEPLOYED)),
  '/live.html': localize(readFileSync(LIVE_HTML)),
};
const srv = createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/gf.css') { res.writeHead(200, { 'Content-Type': 'text/css' }); return res.end(gfCss); }
  if (fontBytes.has(u)) { res.writeHead(200, { 'Content-Type': 'font/woff2' }); return res.end(fontBytes.get(u)); }
  const b = pages[u];
  if (!b) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(b);
}).listen(8901);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:33047', '--ignore-certificate-errors'],
});

const VIEWPORTS = [
  { name: 'masaustu', width: 1440, height: 960 },
  { name: 'mobil', width: 390, height: 844 },
];

async function shoot(url, label, vp, persona) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  p.on('requestfailed', (r) => errs.push('İSTEK BAŞARISIZ: ' + r.url()));
  p.on('response', (r) => { if (r.status() >= 400) errs.push(`HTTP ${r.status()} ${r.url()}`); });
  await p.goto(url, { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(1200);
  if (persona === 'cand') { await p.click('#tab-cand'); await p.waitForTimeout(800); }
  // Çizimi belirleyici kıl: geçiş/animasyonları kapat, tüm reveal öğelerini görünür yap,
  // kaydırmayı başa al. Böylece fark ölçümü zamanlamadan değil, yalnızca tasarımdan gelir.
  await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}html{scroll-behavior:auto!important}' });
  await p.evaluate(() => {
    document.querySelectorAll('.reveal').forEach((e) => e.classList.add('in'));
    document.querySelectorAll('.step').forEach((e) => e.classList.add('in'));
    window.scrollTo(0, 0);
  });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(600);
  const png = await p.screenshot({ fullPage: true });
  const state = await p.evaluate(() => ({
    font: getComputedStyle(document.body).fontFamily,
    sections: [...document.querySelectorAll('section.block')].map((e) => e.id),
    sirket: document.getElementById('sirketLabel').textContent.trim(),
    mesaj: document.getElementById('mesajLabel').textContent.trim(),
    btn: document.getElementById('btnText').textContent.trim(),
    taraf: document.getElementById('formTaraf').value,
    red: getComputedStyle(document.documentElement).getPropertyValue('--red').trim(),
    yellow: getComputedStyle(document.documentElement).getPropertyValue('--yellow').trim(),
    height: document.documentElement.scrollHeight,
  }));
  await ctx.close();
  return { png, state, errs, label: `${label}-${vp.name}-${persona}` };
}

const rows = [];
for (const vp of VIEWPORTS) {
  for (const persona of ['emp', 'cand']) {
    const a = await shoot(`http://127.0.0.1:8901/src.html`, 'kaynak', vp, persona);
    const b = await shoot(`http://127.0.0.1:8901/dep.html`, 'yerel-dagitim', vp, persona);
    const c = await shoot(`http://127.0.0.1:8901/live.html`, 'canli', vp, persona);
    const pxDiff = async (x, y) => {
      const ctx = await browser.newContext();
      const pg = await ctx.newPage();
      const r = await pg.evaluate(async ([a, b]) => {
        const load = (d) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + d; });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        if (ia.width !== ib.width || ia.height !== ib.height) return { boyutFarkli: true, ia: [ia.width, ia.height], ib: [ib.width, ib.height] };
        const mk = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); return c.getContext('2d').getImageData(0, 0, im.width, im.height).data; };
        const da = mk(ia), db = mk(ib);
        let diff = 0;
        for (let i = 0; i < da.length; i += 4) {
          if (Math.abs(da[i] - db[i]) > 8 || Math.abs(da[i+1] - db[i+1]) > 8 || Math.abs(da[i+2] - db[i+2]) > 8) diff++;
        }
        return { boyutFarkli: false, toplam: da.length / 4, farkli: diff };
      }, [x.toString('base64'), y.toString('base64')]);
      await ctx.close();
      return r;
    };
    const same = (x, y) => Buffer.compare(x, y) === 0;
    const dAC = await pxDiff(a.png, c.png);
    const dAB = await pxDiff(a.png, b.png);
    const pct = (d) => (d.boyutFarkli ? 'BOYUT FARKLI' : `${((d.farkli / d.toplam) * 100).toFixed(4)}%`);
    rows.push({
      görünüm: `${vp.name}/${persona}`,
      'kaynak↔yerel piksel farkı': pct(dAB),
      'kaynak↔canlı piksel farkı': pct(dAC),
      'kaynak==yerel(bayt)': same(a.png, b.png),
      'kaynak==canlı(bayt)': same(a.png, c.png),
      'yükseklik(kaynak/canlı)': `${a.state.height}/${c.state.height}`,
      'taraf(canlı)': c.state.taraf,
      'şirket etiketi(canlı)': c.state.sirket.replace(/\s+/g, ' '),
      'buton(canlı)': c.state.btn,
      'renk(canlı)': `${c.state.red}|${c.state.yellow}`,
      'js hatası(canlı)': c.errs.length,
    });
    writeFileSync(`/home/user/csuite/docs/img/kars-${vp.name}-${persona}-kaynak.png`, a.png);
    writeFileSync(`/home/user/csuite/docs/img/kars-${vp.name}-${persona}-canli.png`, c.png);
    if (c.errs.length) console.log(`  [${vp.name}/${persona}] canlı sayfa uyarıları:`, [...new Set(c.errs)].slice(0, 4));
  }
}
console.table(rows);
await browser.close();
srv.close();
