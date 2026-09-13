// Canlı (production) doğrulama: gerçek tarayıcı, gerçek adres, gerçek ağ.
// Chromium'un tüm istekleri curl üzerinden karşılanır (ortamda Chromium
// çıkış vekilini doğrudan kullanamıyor). Form GÖNDERİLMEZ.
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const SITE = process.argv[2];
const OUT = process.argv[3] ?? '/tmp';
const tmp = (s) => `/tmp/cl-${Date.now()}-${Math.random().toString(36).slice(2)}.${s}`;
const DROP = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive']);
function viaCurl(url, method, headers, post) {
  const hf = tmp('h'), bf = tmp('b');
  const args = ['-s', '-D', hf, '-o', bf, '--compressed', '-X', method, url, '--max-time', '45'];
  for (const [k, v] of Object.entries(headers)) { if (!k.startsWith(':')) args.push('-H', `${k}: ${v}`); }
  let pf = null;
  if (post && post.length) { pf = tmp('p'); writeFileSync(pf, post); args.push('--data-binary', `@${pf}`); }
  try { execFileSync('curl', args, { maxBuffer: 64 * 1024 * 1024 }); } catch {}
  let raw = '', body = Buffer.alloc(0);
  try { raw = readFileSync(hf, 'utf8'); } catch {}
  try { body = readFileSync(bf); } catch {}
  for (const f of [hf, bf, pf]) if (f) { try { unlinkSync(f); } catch {} }
  const blocks = raw.split(/\r\n\r\n/).filter((b) => b.trim().startsWith('HTTP/'));
  const last = blocks[blocks.length - 1] ?? 'HTTP/1.1 200 OK';
  const lines = last.split(/\r?\n/);
  const status = parseInt((lines[0] || '').split(' ')[1], 10) || 200;
  const out = {};
  for (const l of lines.slice(1)) { const i = l.indexOf(':'); if (i < 1) continue;
    const k = l.slice(0, i).trim().toLowerCase(); if (!DROP.has(k)) out[k] = l.slice(i + 1).trim(); }
  return { status, headers: out, body };
}

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const rows = [], detay = [];
for (const [vn, w, h] of [['masaustu', 1440, 900], ['mobil', 390, 844]]) {
  for (const persona of ['emp', 'cand']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    await ctx.route('**/*', async (route) => {
      const q = route.request();
      try { const r = viaCurl(q.url(), q.method(), q.headers(), q.postDataBuffer());
        await route.fulfill({ status: r.status, headers: r.headers, body: r.body }); }
      catch { await route.abort(); }
    });
    const p = await ctx.newPage();
    const errs = [], api = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
    ctx.on('response', (res) => { if (res.url().includes('/api/')) api.push(res.status() + ' ' + res.url().split('/').pop()); });
    await p.goto(SITE, { waitUntil: 'load', timeout: 90000 });
    await p.waitForTimeout(3000);
    // ileri-geri sekme geçişi
    await p.click('#tab-cand'); await p.waitForTimeout(500);
    await p.click('#tab-emp');  await p.waitForTimeout(500);
    await p.click(persona === 'cand' ? '#tab-cand' : '#tab-emp'); await p.waitForTimeout(800);
    const s = await p.evaluate(() => ({
      gorunurTaraflar: [...new Set([...document.querySelectorAll('[data-persona]')].filter(e => e.offsetParent !== null).map(e => e.dataset.persona))],
      navCta: document.getElementById('navCta').textContent.replace(/\s+/g, ' ').trim(),
      mnavCta: document.getElementById('mnavCta').textContent.replace(/\s+/g, ' ').trim(),
      kartlar: [...document.querySelectorAll('.persona.show .art .abody h4')].map(e => e.textContent.trim()),
      adimlar: [...document.querySelectorAll('.persona.show .step h5')].map(e => e.textContent.trim()),
      satirlar: [...document.querySelectorAll('.persona.show .crow > div:first-child, .persona.show .ctable tbody th')].map(e => e.textContent.trim()),
      formBtn: document.getElementById('btnText').textContent.trim(),
      taraf: document.getElementById('formTaraf').value,
      surec: document.querySelector('#surec .sec-title')?.textContent.replace(/\s+/g,' ').trim(),
      aiRenk: getComputedStyle(document.querySelector('.persona.show .art .athumb .ai')).color,
      mctaVar: !!document.getElementById('mcta'),
      tasma: document.body.scrollWidth - document.body.clientWidth,
      kirp: [...document.querySelectorAll('.art .abody p,.step p,.crow div,.titem p,.sec-sub,.lede,.btn,.art h4,.step h5,.stat .lab,.stat .desc')]
        .filter(e => e.offsetParent !== null && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1)).length,
      captchaAtif: !!document.querySelector('.formcard .formnote [href*="policies.google.com"]'),
      grecaptcha: typeof window.grecaptcha !== 'undefined',
    }));
    // üst düğme -> forma kaydırma
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
    if (w <= 920) { await p.click('#burger'); await p.waitForTimeout(500); await p.click('#mnavCta'); }
    else { await p.click('#navCta'); }
    await p.waitForTimeout(1800);
    const f = await p.evaluate(() => {
      const navH = document.getElementById('nav').getBoundingClientRect().height;
      const lbl = document.querySelector('#formTop label[for="ad"]').getBoundingClientRect();
      const e2 = document.getElementById('eposta').getBoundingClientRect();
      const btn = document.getElementById('formBtn').getBoundingClientRect();
      return { navH: Math.round(navH), etiketUst: Math.round(lbl.top), ikiAlan: e2.bottom < innerHeight, btnVar: btn.height > 0 };
    });
    await p.screenshot({ path: `${OUT}/canli-${vn}-${persona}.png` });
    rows.push({ gorunum: `${vn}/${persona}`, taraf: s.gorunurTaraflar.join(','),
      'bayat metin': s.gorunurTaraflar.filter(x => x !== persona).join(',') || 'yok',
      'ust dugme': s.navCta, 'form dugmesi': s.formBtn, 'form tarafi': s.taraf,
      '01-03 renk': s.aiRenk, 'sabit CTA': s.mctaVar ? 'VAR' : 'yok',
      'yatay tasma': s.tasma, kirpilma: s.kirp,
      'menu ortuyor': f.etiketUst < f.navH ? 'EVET' : 'hayir', 'ilk 2 alan gorunur': f.ikiAlan ? 'evet' : 'HAYIR',
      'gonder dugmesi': f.btnVar ? 'var' : 'YOK',
      'recaptcha yuklu': s.grecaptcha ? 'evet' : 'HAYIR', 'js hata': errs.length });
    detay.push({ gorunum: `${vn}/${persona}`, kartlar: s.kartlar, adimlar: s.adimlar, satirlar: s.satirlar, surec: s.surec, api: [...new Set(api)], errs });
    await ctx.close();
  }
}
console.table(rows);
for (const d of detay) console.log(d.gorunum, '\n  kartlar:', d.kartlar.join(' / '), '\n  adimlar:', d.adimlar.join(' / '), '\n  satirlar:', d.satirlar.join(' / '), '\n  surec:', d.surec, '\n  api:', d.api.join(', '), d.errs.length ? '\n  HATA: ' + d.errs.join(' | ') : '');
await b.close();
