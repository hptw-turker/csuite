// Gerçek tarayıcı tekrarı: Chromium'un TÜM istekleri curl üzerinden (çıkış vekiliyle)
// karşılanır, böylece sayfa gerçek adresinden açılır ve reCAPTCHA gerçek token üretir.
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';

const SITE = process.argv[2];
const TAG = process.argv[3] ?? 'CSUITE-REPRO-0913';
if (!SITE) { console.error('kullanım: node tools/browser-repro.mjs <site-url> [etiket]'); process.exit(1); }

const tmp = (s) => `/tmp/repro-${Date.now()}-${Math.random().toString(36).slice(2)}.${s}`;
const DROP = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive']);

function fetchViaCurl(url, method, headers, postDataBuffer) {
  const hf = tmp('h'), bf = tmp('b');
  const args = ['-s', '-D', hf, '-o', bf, '--compressed', '-X', method, url, '--max-time', '45'];
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase().startsWith(':')) continue;
    args.push('-H', `${k}: ${v}`);
  }
  let pf = null;
  if (postDataBuffer && postDataBuffer.length) { pf = tmp('p'); writeFileSync(pf, postDataBuffer); args.push('--data-binary', `@${pf}`); }
  try { execFileSync('curl', args, { maxBuffer: 64 * 1024 * 1024 }); }
  catch { /* curl'un çıkış kodu önemsiz; gövde/başlık dosyalarına bakılır */ }
  let raw = ''; let body = Buffer.alloc(0);
  try { raw = readFileSync(hf, 'utf8'); } catch {}
  try { body = readFileSync(bf); } catch {}
  for (const f of [hf, bf, pf]) { if (f) { try { unlinkSync(f); } catch {} } }
  const blocks = raw.split(/\r\n\r\n/).filter((b) => b.trim().startsWith('HTTP/'));
  const last = blocks[blocks.length - 1] ?? 'HTTP/1.1 200 OK';
  const lines = last.split(/\r?\n/);
  const status = parseInt((lines[0] || '').split(' ')[1], 10) || 200;
  const out = {};
  for (const l of lines.slice(1)) {
    const i = l.indexOf(':'); if (i < 1) continue;
    const k = l.slice(0, i).trim().toLowerCase();
    if (DROP.has(k)) continue;
    out[k] = l.slice(i + 1).trim();
  }
  return { status, headers: out, body };
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.route('**/*', async (route) => {
  const req = route.request();
  try {
    const r = fetchViaCurl(req.url(), req.method(), req.headers(), req.postDataBuffer());
    await route.fulfill({ status: r.status, headers: r.headers, body: r.body });
  } catch (e) { await route.abort(); }
});

const page = await ctx.newPage();
const apiOlaylar = [];
ctx.on('response', async (res) => {
  const ilgi = res.url().includes('/api/') || res.status() >= 400;
  if (!ilgi) return;
  if (res.status() >= 400) console.log(`  [>=400] ${res.status()} ${res.url().slice(0, 160)}`);
  let t = ''; try { t = (await res.text()).slice(0, 300); } catch {}
  apiOlaylar.push({ url: res.url().replace(SITE, ''), status: res.status(), body: t });
});
page.on('requestfailed', (r) => apiOlaylar.push({ url: r.url().replace(SITE, ''), status: 'BAŞARISIZ', body: String(r.failure()?.errorText) }));
page.on('console', (m) => { if (m.type() === 'error') console.log('  [konsol]', m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('  [sayfa hatası]', String(e.message).slice(0, 200)));

await page.goto(SITE, { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(4000);
console.log('captcha yapılandırması yüklendi mi:', await page.evaluate(() => (typeof CAPTCHA !== 'undefined' && CAPTCHA) ? CAPTCHA.provider : null).catch(() => 'okunamadı'));
console.log('grecaptcha yüklendi mi           :', await page.evaluate(() => typeof window.grecaptcha !== 'undefined'));

if (process.env.SADECE_YUKLE === '1') {
  console.log('\nSADECE YÜKLEME — form gönderilmedi');
  console.log('AĞ OLAYLARI (api veya >=400):');
  for (const e of apiOlaylar) console.log(` ${e.status}  ${e.url}\n     ${e.body}`);
  const tok = await page.evaluate(async () => { try { return (await window.grecaptcha.execute(CAPTCHA.siteKey,{action:'talep'})).length; } catch (e) { return 'HATA: '+e.message; } });
  console.log('grecaptcha.execute token uzunluğu:', tok);
  await browser.close(); process.exit(0);
}
await page.fill('#ad', process.env.T_AD ?? 'TEST Kayit');
await page.fill('#sirket', process.env.T_SIRKET ?? 'TEST');
await page.fill('#eposta', process.env.T_EPOSTA ?? 'csuite04@gmail.com');
await page.fill('#telefon', '');
await page.fill('#mesaj', process.env.T_MESAJ ?? TAG);
await page.click('#formBtn');
await page.waitForFunction(() => document.getElementById('formMsg').textContent.trim().length > 0, { timeout: 90000 });
await page.waitForTimeout(600);

const sonuc = await page.evaluate(() => ({
  sinif: document.getElementById('formMsg').className,
  mesaj: document.getElementById('formMsg').textContent.trim().slice(0, 200),
  adAlani: document.getElementById('ad').value,
}));
console.log('\nFORM SONUCU:', JSON.stringify(sonuc, null, 1));
console.log('\nAPI TRAFİĞİ:');
for (const e of apiOlaylar) console.log(` ${e.status}  ${e.url}\n     ${e.body}`);
await browser.close();
