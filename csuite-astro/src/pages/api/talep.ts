import type { APIRoute } from 'astro';
import { auth, httpClient } from '@wix/essentials';
import { items } from '@wix/data';
import { gizliOku } from '../../lib/gizli';

/**
 * Görüşme talebi alım ucu  —  POST /api/talep
 *
 * Güvenlik modeli
 * ---------------
 *  1) Depolama: kayıt, tüm izinleri ADMIN olan `GorusmeTalepleri` koleksiyonuna
 *     YALNIZCA bu route üzerinden auth.elevate() ile yazılır. Anonim ziyaretçinin
 *     koleksiyona doğrudan yazması/okuması Wix tarafından reddedilir (403 / WDE0027).
 *  2) Bu route herkese açıktır; bu yüzden kendi korumasını da uygular:
 *     honeypot → alan doğrulama → SÜRELİ gönderim sınırı → CAPTCHA.
 *     (ADMIN izinli koleksiyon tek başına spam koruması değildir.)
 *  3) Gizli anahtar yalnızca Wix sunucu ortam değişkeninden okunur (`wix env set`).
 *     Frontend'e, depoya ve loglara girmez. IP ham olarak saklanmaz.
 */

const COLLECTION = 'GorusmeTalepleri';

/** Süreli sınır: kalıcı kota DEĞİL — pencere dolunca kendiliğinden kalkar. */
const WINDOW_MS = 15 * 60 * 1000; // 15 dakika
const MAX_PER_WINDOW = 3;         // aynı gönderenden pencere başına en fazla 3 talep

/**
 * Gönderen kimliği: IP ham olarak saklanmaz, yalnızca geri döndürülemez kısa özet tutulur.
 *
 * Başlık seçimi ölçüldü (yayımlanan önizlemede): Wix kenar katmanı `true-client-ip` ve
 * `x-forwarded-for` değerlerini kendisi yazar — istemcinin gönderdiği sahte değerler
 * worker'a ULAŞMIYOR. Buna karşılık `cf-connecting-ip` ve `x-real-ip` istemciden
 * olduğu gibi geçiyor; bu yüzden o ikisi kimlik için KULLANILMAZ.
 */
async function hash8(raw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${raw}|csuite`));
  return Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function submitterKey(req: Request): Promise<string> {
  const raw =
    req.headers.get('true-client-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  return hash8(raw);
}

/**
 * Süreli sınır, worker izolasyonları arasında paylaşılmayan bellek yerine
 * kalıcı depoya dayanır: pencere içinde aynı gönderenden kaç kayıt oluştuğunu sayar.
 * Sayım yapılamazsa meşru kullanıcıyı kilitlememek için geçişe izin verilir.
 */
async function overLimit(key: string, eposta: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  // auth.elevate() bir SDK modül tanımlayıcısı bekler (rastgele closure değil):
  // items.query yükseltilir, döndürdüğü sorgu kurucusu yükseltilmiş istemciyi kullanır.
  const query = auth.elevate(items.query);
  const countBy = (field: string, value: string) =>
    query(COLLECTION).eq(field, value).ge('_createdDate', since).count();
  try {
    // İki boyut: ağ kimliği (özet) ve e-posta. Biri bile sınırı aşarsa gönderim durur;
    // böylece ağ değiştirerek veya aynı adresle seri gönderim yapılamaz.
    const [byIp, byMail] = await Promise.all([
      countBy('gonderenOzet', key),
      countBy('epostaKey', eposta),
    ]);
    return Math.max(byIp, byMail) >= MAX_PER_WINDOW;
  } catch {
    // Sayım yapılamazsa meşru kullanıcı kilitlenmez.
    return false;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function validate(b: Record<string, unknown>) {
  const data = {
    adSoyad: s(b.adSoyad, 120),
    sirket: s(b.sirket, 160),
    eposta: s(b.eposta, 160),
    telefon: s(b.telefon, 40),
    mesaj: s(b.mesaj, 4000),
    taraf: s(b.taraf, 20),
  };
  const errors: string[] = [];
  if (data.adSoyad.length < 2) errors.push('adSoyad');
  if (data.sirket.length < 2) errors.push('sirket');
  if (!EMAIL_RE.test(data.eposta)) errors.push('eposta');
  if (data.mesaj.length < 5) errors.push('mesaj');
  if (data.taraf !== 'İşveren' && data.taraf !== 'Aday') errors.push('taraf');
  return { data, errors };
}

/**
 * CAPTCHA — reCAPTCHA **v3 (score based / classic)**, sunucuda doğrulanır.
 *
 * Sözleşme (Google reCAPTCHA v3):
 *   tarayıcı : api.js?render=<SITE_KEY> → grecaptcha.execute(SITE_KEY, {action: 'talep'})
 *   sunucu   : POST https://www.google.com/recaptcha/api/siteverify
 *              gövde: secret=<SECRET_KEY>&response=<token>
 *              yanıt: { success, score, action, challenge_ts, hostname, "error-codes" }
 *
 * Uygulanan denetimler — hepsi geçmezse kayıt OLUŞMAZ:
 *   1) success === true                     → token geçerli ve daha önce kullanılmamış
 *   2) action === 'talep'                   → başka bir sayfadan alınan token tekrar kullanılamaz
 *   3) hostname == bu sitenin TAM konak adı  → çalınan site anahtarı başka adreste işe yaramaz
 *   4) challenge_ts tazeliği ≤ 2 dk         → eski token tekrar oynatılamaz (v3 tokenı zaten 2 dk yaşar)
 *   5) score ≥ eşik (öntanımlı 0.5)         → v3 puan denetimi
 *
 * `remoteip` BİLEREK gönderilmez: ziyaretçinin IP'si üçüncü tarafa aktarılmaz;
 * alan isteğe bağlıdır ve puanlama onsuz da çalışır.
 *
 * Yapılandırma eksikse (anahtar çifti yoksa) istek REDDEDİLİR — sessizce kabul edilmez.
 */
const CAPTCHA_ACTION = 'talep';
const DEFAULT_SCORE_THRESHOLD = 0.5;
const MAX_TOKEN_AGE_MS = 2 * 60 * 1000;

/**
 * Hostname izin listesi — **joker yok, ortak ana alan adı yok**.
 * İzinli olan tek şey: isteğin geldiği bu sitenin TAM konak adı, artı
 * `RECAPTCHA_ALLOWED_HOSTS` ile açıkça yazılmış TAM konak adları
 * (virgülle ayrılır; ör. yeni bir önizleme adresi ya da ileride bağlanacak alan adı).
 * Böylece başka bir Wix sitesinde çözülmüş bir token kabul edilmez.
 */
async function hostAllowed(hostname: string, req: Request): Promise<boolean> {
  if (!hostname) return false;
  const h = hostname.toLowerCase();

  const ownHost = (req.headers.get('host') ?? '').split(':')[0].trim().toLowerCase();
  const extra = (await gizliOku('RECAPTCHA_ALLOWED_HOSTS')).deger
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  const allow = [ownHost, ...extra].filter(Boolean);
  return allow.includes(h);
}

type CaptchaResult = { ok: boolean; reason?: 'NOT_CONFIGURED' | 'MISSING_TOKEN' | 'INVALID' };

async function captchaOk(token: string, req: Request): Promise<CaptchaResult> {
  // Sağlayıcı ancak ÇİFT tanımlıysa kuruludur: site anahtarı tarayıcıya verilir
  // (/api/talep-config), gizli anahtar yalnızca burada kullanılır.
  const secret = (await gizliOku('RECAPTCHA_SECRET_KEY')).deger;
  const siteKey = (await gizliOku('RECAPTCHA_SITE_KEY')).deger;
  if (!secret || !siteKey) return { ok: false, reason: 'NOT_CONFIGURED' };
  if (!token) return { ok: false, reason: 'MISSING_TOKEN' };

  let j: {
    success?: boolean;
    score?: number;
    action?: string;
    challenge_ts?: string;
    hostname?: string;
  };
  try {
    const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    if (!r.ok) return { ok: false, reason: 'INVALID' };
    j = await r.json();
  } catch {
    return { ok: false, reason: 'INVALID' };
  }

  if (j?.success !== true) return { ok: false, reason: 'INVALID' };
  if (j.action !== CAPTCHA_ACTION) return { ok: false, reason: 'INVALID' };
  if (!(await hostAllowed(j.hostname ?? '', req))) return { ok: false, reason: 'INVALID' };

  const ts = Date.parse(j.challenge_ts ?? '');
  if (!Number.isFinite(ts) || Date.now() - ts > MAX_TOKEN_AGE_MS) {
    return { ok: false, reason: 'INVALID' };
  }

  const thresholdRaw = Number((await gizliOku('RECAPTCHA_MIN_SCORE')).deger);
  const threshold = Number.isFinite(thresholdRaw) && thresholdRaw > 0 && thresholdRaw <= 1
    ? thresholdRaw
    : DEFAULT_SCORE_THRESHOLD;
  if (typeof j.score !== 'number' || j.score < threshold) return { ok: false, reason: 'INVALID' };

  return { ok: true };
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'BAD_JSON' }, 400);
  }

  // 1) honeypot
  if (s(body.botcheck, 10)) return json({ error: 'REJECTED' }, 400);

  // 2) alan doğrulama
  const { data, errors } = validate(body);
  if (errors.length) return json({ error: 'VALIDATION', fields: errors }, 400);

  // 3) süreli gönderim sınırı
  const key = await submitterKey(request);
  if (await overLimit(key, data.eposta.toLowerCase())) {
    return json({ error: 'RATE_LIMIT', retryAfterMinutes: Math.ceil(WINDOW_MS / 60000) }, 429);
  }

  // 4) CAPTCHA — geçmezse hiçbir kayıt oluşturulmaz. Yapılandırma eksikse de reddedilir;
  //    sessiz kabul (fail-open) bırakılmaz.
  const cap = await captchaOk(s(body.captchaToken, 5000), request);
  if (!cap.ok) {
    return cap.reason === 'NOT_CONFIGURED'
      ? json({ error: 'CAPTCHA_NOT_CONFIGURED' }, 503)
      : json({ error: 'CAPTCHA' }, 403);
  }

  // 5) kalıcı kayıt
  let itemId = '';
  try {
    const created = await auth.elevate(items.insert)(COLLECTION, {
      ...data,
      // Görüntülenen e-posta kullanıcının yazdığı gibi kalır; sınır karşılaştırması
      // büyük/küçük harften bağımsız olsun diye normalleştirilmiş kopya ayrıca tutulur.
      epostaKey: data.eposta.toLowerCase(),
      kaynak: 'web',
      gonderenOzet: key,
      captchaDogrulandi: true, // bu noktaya yalnızca doğrulama geçtiyse gelinir
    });
    itemId = (created as { _id?: string })?._id ?? '';
    if (!itemId) throw new Error('no id');
  } catch {
    return json({ error: 'STORE_FAILED' }, 502);
  }

  // 6) bildirim — kayıttan BAĞIMSIZ ele alınır. Bildirim başarısız olsa bile
  //    kullanıcıya gönderim hatası gösterilmez; aksi hâlde mükerrer kayıt oluşur.
  let notified = false;
  try {
    notified = await notify(data, itemId);
  } catch {
    notified = false;
  }

  return json({ ok: true, id: itemId, notified }, 200);
};

/**
 * Site sahibine bildirim — Wix Automations.
 *
 * Otomasyon: "C-suite · Yeni görüşme talebi (CMS)"  (id: NOTIFY_AUTOMATION_ID)
 *   • bu sitenin uygulaması tarafından oluşturuldu,
 *   • eylemi, daha önce çalışan bildirimle aynı olan tetiklenmiş e-posta eylemidir;
 *     alıcı kitle "site katkıda bulunanları" (site sahibi) rolüdür,
 *   • sunucu route'u onu Run Automation ile doğrudan çalıştırır.
 *
 * Bu çağrı kayıttan BAĞIMSIZDIR: başarısız olsa bile kullanıcıya hata gösterilmez.
 */
const NOTIFY_AUTOMATION_ID = 'b727e976-205b-4d68-b004-8eaf16c8f95b';

async function notify(data: Record<string, string>, itemId: string): Promise<boolean> {
  const siteId = (await gizliOku('WIX_SITE_ID')).deger || '72b257e3-0db0-4579-8795-64e51b3f42a6';
  const kayitBaglantisi = `https://manage.wix.com/dashboard/${siteId}/database/data/${COLLECTION}`;

  const submissions = [
    { label: 'Taraf', value: data.taraf },
    { label: 'Ad Soyad', value: data.adSoyad },
    { label: data.taraf === 'Aday' ? 'Mevcut Kurum' : 'Şirket', value: data.sirket },
    { label: 'E-posta', value: data.eposta },
    { label: 'Telefon', value: data.telefon || '-' },
    { label: 'Mesaj', value: data.mesaj },
    { label: 'CMS kayıt no', value: itemId },
  ];

  const elevatedFetch = auth.elevate(httpClient.fetchWithAuth);
  const r = await elevatedFetch('https://www.wixapis.com/automations/v1/events/run-automation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifierType: 'AUTOMATION',
      automationIdentifier: { automationId: NOTIFY_AUTOMATION_ID },
      payload: {
        formName: `C-suite · Görüşme talebi (${data.taraf})`,
        submissionsLink: kayitBaglantisi,
        submissions,
      },
    }),
  });
  if (!r.ok) return false;
  // Boş activationId, otomasyonun gerçekte çalışmadığı anlamına gelir (ölçüldü).
  const out = (await r.json()) as { activationId?: string };
  return Boolean(out?.activationId);
}

export const GET: APIRoute = async () => json({ error: 'METHOD_NOT_ALLOWED' }, 405);
