import type { APIRoute } from 'astro';
import { gizliOku, gizliDurum } from '../../lib/gizli';

/**
 * GET /api/talep-config
 *
 * Formun ihtiyaç duyduğu YALNIZCA herkese açık yapılandırmayı döndürür.
 * reCAPTCHA "site key" tanım gereği geneldir (sayfa kaynağında görünür);
 * "secret key" buradan ASLA dönmez — yalnızca var olup olmadığı ve hangi depodan
 * okunduğu bildirilir. Bu, gizli değeri çıktıya yazmadan erişimi doğrulamayı sağlar.
 */
export const GET: APIRoute = async () => {
  const site = await gizliOku('RECAPTCHA_SITE_KEY');
  const secretKaynak = await gizliDurum('RECAPTCHA_SECRET_KEY');
  const hazir = Boolean(site.deger) && secretKaynak !== null;

  return new Response(
    JSON.stringify({
      captcha: hazir ? { provider: 'recaptcha-v3', action: 'talep', siteKey: site.deger } : null,
      yapilandirma: { siteKey: site.kaynak, secret: secretKaynak },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  );
};
