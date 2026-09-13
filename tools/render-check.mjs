import { chromium } from 'playwright';
const FILE = 'file://PROJECT_ROOT/site/C-Suite_Ideal_Revize.html';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--proxy-server=http://127.0.0.1:33047','--ignore-certificate-errors'] });
const errs = [];
const ctx = await b.newContext({ viewport: { width: 1440, height: 960 } });
const p = await ctx.newPage();
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await p.goto(FILE, { waitUntil: 'networkidle' });

// font actually applied?
const font = await p.evaluate(() => getComputedStyle(document.body).fontFamily);
const poppinsLoaded = await p.evaluate(() => document.fonts.check('16px Poppins'));
console.log('body font-family :', font);
console.log('Poppins loaded   :', poppinsLoaded);

// sections present
const secs = await p.$$eval('section.block', els => els.map(e => e.id));
console.log('sections         :', secs.join(', '));

// ---- persona toggle test (EMPLOYER default) ----
const empState = await p.evaluate(() => ({
  sirket: document.getElementById('sirketLabel').textContent.trim(),
  mesaj : document.getElementById('mesajLabel').textContent.trim(),
  btn   : document.getElementById('btnText').textContent.trim(),
  subject: document.getElementById('formSubject').value,
  taraf : document.getElementById('formTaraf').value,
  visible: document.querySelectorAll('.persona.show[data-persona="emp"]').length,
}));
console.log('\n[EMPLOYER] ', JSON.stringify(empState, null, 0));
await p.screenshot({ path: 'shot-desktop-employer.png', fullPage: false });

// switch to CANDIDATE
await p.click('#tab-cand');
await p.waitForTimeout(700);
const candState = await p.evaluate(() => ({
  sirket: document.getElementById('sirketLabel').textContent.trim(),
  mesaj : document.getElementById('mesajLabel').textContent.trim(),
  btn   : document.getElementById('btnText').textContent.trim(),
  subject: document.getElementById('formSubject').value,
  taraf : document.getElementById('formTaraf').value,
  visible: document.querySelectorAll('.persona.show[data-persona="cand"]').length,
}));
console.log('[CANDIDATE]', JSON.stringify(candState, null, 0));
console.log('TOGGLE WORKS     :', empState.taraf !== candState.taraf && empState.sirket !== candState.sirket);

// scroll reveal
await p.evaluate(() => window.scrollTo(0, 1800));
await p.waitForTimeout(900);
const revealed = await p.$$eval('.reveal.in, .step.in', e => e.length);
console.log('revealed elements:', revealed);
await p.screenshot({ path: 'shot-desktop-candidate.png' });

// ---- MOBILE ----
const mctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await mctx.newPage();
await mp.goto(FILE, { waitUntil: 'networkidle' });
await mp.screenshot({ path: 'shot-mobile-top.png' });
await mp.click('#burger');
await mp.waitForTimeout(600);
const menuOpen = await mp.evaluate(() => document.body.classList.contains('menu-open'));
console.log('\nmobile menu opens:', menuOpen);
await mp.screenshot({ path: 'shot-mobile-menu.png' });
await mp.click('#burger');
await mp.evaluate(() => window.scrollTo(0, 1200));
await mp.waitForTimeout(700);
const stickyOn = await mp.evaluate(() => document.getElementById('mcta').classList.contains('on'));
console.log('sticky CTA shows :', stickyOn);

// required-field validation
const invalid = await mp.evaluate(() => {
  const f = document.getElementById('contactForm');
  return { valid: f.checkValidity(), required: f.querySelectorAll('[required]').length };
});
console.log('form validation  :', JSON.stringify(invalid));
console.log('\nconsole errors   :', errs.length ? errs.slice(0,5) : 'NONE');
await b.close();
