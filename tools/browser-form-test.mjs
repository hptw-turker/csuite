// Tarayıcıda gerçek form akışını sınar: sayfanın kendi JavaScript'i ile gönderim.
// Chromium bu ortamda çıkış vekilini kullanamadığı için /api/* çağrıları,
// yerel bir aktarıcı üzerinden gerçek Wix önizlemesine curl ile iletilir.
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { createServer } from 'node:http';
import { readFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const LIVE_HTML = process.argv[2];
const LIVE_ORIGIN = process.argv[3];
if (!LIVE_HTML || !LIVE_ORIGIN) { console.error('kullanım: node tools/browser-form-test.mjs <indirilmis-html> <onizleme-origin>'); process.exit(1); }

const html = readFileSync(LIVE_HTML);
const srv = createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u.startsWith('/api/')) {
    let body = '';
    req.on('data', (d) => (body += d));
    req.on('end', () => {
      try {
        // Durum kodunu ve gövdeyi ayrı al: vekil sunucunun CONNECT yanıtı başlıkları karıştırıyor.
        const tmp = `/tmp/relay-${Date.now()}-${Math.random().toString(36).slice(2)}.out`;
        const args = ['-s', '-o', tmp, '-w', '%{http_code}', `${LIVE_ORIGIN}${req.url}`, '-X', req.method];
        if (body) args.push('-H', 'Content-Type: application/json', '--data-binary', body);
        const status = parseInt(execFileSync('curl', args, { maxBuffer: 1024 * 1024 }).toString().trim(), 10) || 502;
        const payload = readFileSync(tmp);
        unlinkSync(tmp);
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(payload);
      } catch (e) { res.writeHead(502); res.end('{"error":"RELAY"}'); }
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}).listen(8902);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });

async function run(vp, persona, data) {
  const ctx = await browser.newContext({ viewport: vp });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8902/', { waitUntil: 'load' });
  if (persona === 'cand') { await p.click('#tab-cand'); await p.waitForTimeout(600); }
  await p.fill('#ad', data.ad);
  await p.fill('#sirket', data.sirket);
  await p.fill('#eposta', data.eposta);
  await p.fill('#telefon', data.telefon ?? '');
  await p.fill('#mesaj', data.mesaj);
  const taraf = await p.inputValue('#formTaraf');
  await p.click('#formBtn');
  await p.waitForFunction(() => document.getElementById('formMsg').textContent.trim().length > 0, { timeout: 45000 });
  await p.waitForTimeout(400);
  const out = await p.evaluate(() => ({
    sinif: document.getElementById('formMsg').className,
    mesaj: document.getElementById('formMsg').textContent.trim().slice(0, 120),
    buton: document.getElementById('btnText').textContent.trim(),
    butonKapali: document.getElementById('formBtn').disabled,
    adAlani: document.getElementById('ad').value,
  }));
  await ctx.close();
  return { persona, taraf, ...out };
}

const rows = [];
rows.push(await run({ width: 1440, height: 960 }, 'emp', {
  ad: 'CSUITE-TEST Tarayici Isveren', sirket: 'CSUITE-TEST A.S.', eposta: 'csuite04+br1@gmail.com',
  telefon: '+90 216 234 13 26', mesaj: 'CSUITE-TEST-B-0913 — tarayici uzerinden Isveren gonderimi. Gercek talep degildir.' }));
rows.push(await run({ width: 390, height: 844 }, 'cand', {
  ad: 'CSUITE-TEST Tarayici Aday', sirket: 'CSUITE-TEST Mevcut Kurum', eposta: 'csuite04+br2@gmail.com',
  mesaj: 'CSUITE-TEST-B-0913 — tarayici uzerinden Aday gonderimi (mobil). Gercek talep degildir.' }));
// hatalı gönderim: sunucu doğrulaması devreye girsin (taraf alanı bozulur)
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:8902/', { waitUntil: 'load' });
await p.fill('#ad', 'X'); await p.fill('#sirket', 'Y'); await p.fill('#eposta', 'a@b.co');
await p.fill('#mesaj', 'kisa');
await p.evaluate(() => { document.getElementById('formTaraf').value = 'GECERSIZ'; });
await p.click('#formBtn');
await p.waitForFunction(() => document.getElementById('formMsg').textContent.trim().length > 0, { timeout: 45000 });
rows.push({ persona: 'hatalı-giriş', taraf: 'GECERSIZ', ...(await p.evaluate(() => ({
  sinif: document.getElementById('formMsg').className,
  mesaj: document.getElementById('formMsg').textContent.trim().slice(0, 120),
  buton: document.getElementById('btnText').textContent.trim(),
  butonKapali: document.getElementById('formBtn').disabled,
  adAlani: document.getElementById('ad').value,
}))) });
await ctx.close();

console.table(rows);
await browser.close();
srv.close();
