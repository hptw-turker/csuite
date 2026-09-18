// Gerçek tarayıcıda canlı alan adında reCAPTCHA token'ı üretip yerel tanı route'una gönderir.
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
const SITE = process.argv[2];
const tmp = (s) => `/tmp/tk-${Date.now()}-${Math.random().toString(36).slice(2)}.${s}`;
const DROP = new Set(['content-encoding','content-length','transfer-encoding','connection','keep-alive']);
function viaCurl(url, method, headers, post) {
  const hf = tmp('h'), bf = tmp('b');
  const args = ['-s','-D',hf,'-o',bf,'--compressed','-X',method,url,'--max-time','45'];
  for (const [k,v] of Object.entries(headers)) if (!k.startsWith(':')) args.push('-H', `${k}: ${v}`);
  let pf=null; if (post && post.length) { pf=tmp('p'); writeFileSync(pf,post); args.push('--data-binary',`@${pf}`); }
  try { execFileSync('curl', args, { maxBuffer: 64*1024*1024 }); } catch {}
  let raw='', body=Buffer.alloc(0);
  try { raw = readFileSync(hf,'utf8'); } catch {}
  try { body = readFileSync(bf); } catch {}
  for (const f of [hf,bf,pf]) if (f) { try { unlinkSync(f); } catch {} }
  const blocks = raw.split(/\r\n\r\n/).filter(b=>b.trim().startsWith('HTTP/'));
  const last = blocks[blocks.length-1] ?? 'HTTP/1.1 200 OK';
  const lines = last.split(/\r?\n/);
  const status = parseInt((lines[0]||'').split(' ')[1],10) || 200;
  const out = {};
  for (const l of lines.slice(1)) { const i=l.indexOf(':'); if (i<1) continue;
    const k=l.slice(0,i).trim().toLowerCase(); if (!DROP.has(k)) out[k]=l.slice(i+1).trim(); }
  return { status, headers: out, body };
}
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true }); // gerçek TLS doğrulamasını curl yapıyor
await ctx.route('**/*', async (route) => {
  const q = route.request();
  try { const r = viaCurl(q.url(), q.method(), q.headers(), q.postDataBuffer());
        await route.fulfill({ status: r.status, headers: r.headers, body: r.body }); }
  catch { await route.abort(); }
});
const p = await ctx.newPage();
await p.goto(SITE, { waitUntil: 'load', timeout: 90000 });
await p.waitForTimeout(4000);
const tok = await p.evaluate(async () => {
  try { return await window.grecaptcha.execute(CAPTCHA.siteKey, { action: 'talep' }); }
  catch (e) { return 'HATA:' + e.message; }
});
console.log('token uzunluğu:', String(tok).length, String(tok).startsWith('HATA:') ? tok : '');
await b.close();
if (!String(tok).startsWith('HATA:')) {
  writeFileSync('/tmp/claude-0/-home-user-csuite/0c59bfa0-d975-5dba-9b7e-f2d86f4699ef/scratchpad/tok.json', JSON.stringify({ token: tok }));
  console.log('token yazıldı');
}
