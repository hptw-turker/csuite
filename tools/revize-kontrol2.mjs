// Revizyon doğrulaması: masaüstü/mobil × İşveren/Aday.
// Form GÖNDERİLMEZ. Ölçülenler: taraf içeriği, sekme geçişinde bayat metin,
// ortak bölüm tutarlılığı, kırpılma/yatay taşma, 01-02-03 okunaklılığı,
// üst düğme etiketi, forma kaydırma konumu, sabit CTA, form düğmesi ve bağlantılar.
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FILE = process.argv[2];
const OUT = process.argv[3] ?? '/tmp/sshot';
const GF = 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,500&display=swap';
const sh = (c) => execFileSync('bash', ['-lc', c], { maxBuffer: 64 * 1024 * 1024 });
let css = sh(`curl -s --compressed -A 'Mozilla/5.0' '${GF}'`).toString();
const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) ?? [])];
const fonts = new Map();
urls.forEach((u, i) => { fonts.set(`/gs/${i}`, sh(`curl -s '${u}'`)); css = css.split(u).join(`http://127.0.0.1:8904/gs/${i}`); });
const page0 = Buffer.from(readFileSync(FILE, 'utf8').split(GF).join('http://127.0.0.1:8904/gf.css'));
const srv = createServer((rq, rs) => {
  const u = rq.url.split('?')[0];
  if (u === '/gf.css') { rs.writeHead(200, { 'Content-Type': 'text/css' }); return rs.end(css); }
  if (fonts.has(u)) { rs.writeHead(200, { 'Content-Type': 'font/woff2' }); return rs.end(fonts.get(u)); }
  if (u.startsWith('/api/')) { rs.writeHead(200, { 'Content-Type': 'application/json' }); return rs.end('{"captcha":null,"yapilandirma":{"siteKey":null,"secret":null}}'); }
  rs.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); rs.end(page0);
}).listen(8904);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const VPS = [{ n: 'masaustu', w: 1440, h: 900 }, { n: 'mobil', w: 390, h: 844 }];
const rows = [], notlar = [];

const oku = () => {
  const gor = [...document.querySelectorAll('.persona')].filter(e => e.classList.contains('show'));
  const aktif = gor.map(e => e.dataset.persona);
  // görünür (offsetParent!=null) taraf metinleri
  const metin = (sel) => [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null)
    .map(e => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return {
    aktif, tabEmp: document.getElementById('tab-emp').classList.contains('active'),
    tabCand: document.getElementById('tab-cand').classList.contains('active'),
    gorunurTaraflar: [...new Set([...document.querySelectorAll('[data-persona]')]
      .filter(e => e.offsetParent !== null).map(e => e.dataset.persona))],
    navCta: document.getElementById('navCta').textContent.replace(/\s+/g, ' ').trim(),
    mnavCta: document.getElementById('mnavCta').textContent.replace(/\s+/g, ' ').trim(),
    kartlar: metin('.persona.show .art .abody h4'),
    adimlar: metin('.persona.show .step h4, .persona.show .step .sh'),
    formBtn: document.getElementById('btnText').textContent.trim(),
    taraf: document.getElementById('formTaraf').value,
    konu: document.getElementById('formSubject').value,
  };
};

for (const vp of VPS) {
  for (const persona of ['emp', 'cand']) {
    const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
    p.on('console', (m) => { if (m.type() === 'error') errs.push('console:' + m.text().slice(0, 90)); });
    await p.goto('http://127.0.0.1:8904/', { waitUntil: 'load' });
    await p.waitForTimeout(900);

    // ileri-geri sekme geçişi: emp -> cand -> emp -> hedef
    await p.click('#tab-cand'); await p.waitForTimeout(450);
    await p.click('#tab-emp');  await p.waitForTimeout(450);
    await p.click(persona === 'cand' ? '#tab-cand' : '#tab-emp'); await p.waitForTimeout(700);

    const s = await p.evaluate(oku);
    const bayat = s.gorunurTaraflar.filter(x => x !== persona);

    // sayfa geneli ölçümler
    const g = await p.evaluate(() => {
      const tasma = document.body.scrollWidth - document.body.clientWidth;
      const kes = [...document.querySelectorAll('.art .abody p,.step p,.crow div,.titem p,.sec-sub,.lede,.btn,.art h4,.step h4,.stat .lab,.stat .desc,th,td')]
        .filter(e => e.offsetParent !== null && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1))
        .map(e => (e.className || e.tagName) + ':' + e.textContent.replace(/\s+/g, ' ').trim().slice(0, 40));
      const nums = [...document.querySelectorAll('.persona.show .art .athumb')].map(t => {
        const ai = t.querySelector('.ai');
        return { n: ai.textContent.trim(), renk: getComputedStyle(ai).color, zemin: getComputedStyle(t).backgroundImage.slice(0, 80) };
      });
      return { tasma, kes, nums, mctaVar: !!document.getElementById('mcta'),
        baglantilar: [...document.querySelectorAll('nav a[href^="#"], footer a[href^="#"]')].map(a => a.getAttribute('href')),
        formBtnVar: !!document.getElementById('formBtn') };
    });

    // 01-02-03 kart başlıklarının ekran görüntüsü (okunaklılık)
    await p.evaluate(() => document.querySelector('.persona.show .arts')?.scrollIntoView({ block: 'center' }));
    await p.waitForTimeout(600);
    const arts = await p.$('.persona.show .arts');
    if (arts) await arts.screenshot({ path: `${OUT}/${vp.n}-${persona}-kartlar.png` });

    // üst görüşme düğmesi -> forma kaydırma
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
    if (vp.w <= 920) { await p.click('#burger'); await p.waitForTimeout(450); await p.click('#mnavCta'); }
    else { await p.click('#navCta'); }
    await p.waitForTimeout(1800);
    const f = await p.evaluate(() => {
      const navH = document.getElementById('nav').getBoundingClientRect().height;
      const card = document.getElementById('formTop').getBoundingClientRect();
      const lbl = document.querySelector('#formTop label[for="ad"]').getBoundingClientRect();
      const ad = document.getElementById('ad').getBoundingClientRect();
      const e2 = document.getElementById('eposta')?.getBoundingClientRect();
      return { navH: Math.round(navH), kartUst: Math.round(card.top), etiketUst: Math.round(lbl.top),
               ilkAlanAlt: Math.round(ad.bottom), ikinciAlanAlt: e2 ? Math.round(e2.bottom) : null,
               vh: innerHeight };
    });
    await p.screenshot({ path: `${OUT}/${vp.n}-${persona}-form.png` });

    rows.push({
      gorunum: `${vp.n}/${persona}`,
      'gorunur taraf': s.gorunurTaraflar.join(','),
      'bayat metin': bayat.length ? 'VAR:' + bayat.join(',') : 'yok',
      'ust dugme': s.navCta, 'mobil dugme': s.mnavCta,
      'form dugmesi': s.formBtn, taraf: s.taraf,
      'yatay tasma': g.tasma, 'kirpilma': g.kes.length,
      'sabit CTA': g.mctaVar ? 'VAR' : 'yok',
      'navH': f.navH, 'kart ust': f.kartUst, 'etiket ust': f.etiketUst,
      'menu ortuyor': f.etiketUst < f.navH ? 'EVET' : 'hayir',
      'ilk 2 alan gorunur': (f.ikinciAlanAlt ?? 1e9) < f.vh ? 'evet' : 'HAYIR',
      'js hata': errs.length,
    });
    notlar.push({ gorunum: `${vp.n}/${persona}`, kartlar: s.kartlar, adimlar: s.adimlar,
      konu: s.konu, nums: g.nums, kes: g.kes, errs, baglantilar: [...new Set(g.baglantilar)] });
    await ctx.close();
  }
}
console.table(rows);
writeFileSync(`${OUT}/notlar.json`, JSON.stringify(notlar, null, 1));
for (const n of notlar) console.log(n.gorunum, '| kartlar:', n.kartlar.join(' / '), '| adimlar:', n.adimlar.join(' / '), '| konu:', n.konu);
console.log('numaralar:', JSON.stringify(notlar[0].nums));
console.log('baglantilar:', notlar[0].baglantilar.join(' '));
if (notlar.some(n => n.kes.length)) console.log('KIRPILMA:', JSON.stringify(notlar.map(n => n.kes)));
if (notlar.some(n => n.errs.length)) console.log('HATA:', JSON.stringify(notlar.map(n => n.errs)));
await b.close(); srv.close();
