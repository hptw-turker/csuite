import type { APIRoute } from 'astro';
import { getSecret } from 'astro:env/server';

/**
 * GET /api/talep-config
 *
 * Formun ihtiyaç duyduğu YALNIZCA herkese açık yapılandırmayı döndürür.
 * reCAPTCHA "site key" tanım gereği geneldir (sayfa kaynağında görünür);
 * "secret key" buradan ASLA dönmez, yalnızca /api/talep içinde sunucuda kullanılır.
 * Sağlayıcı kurulmadıysa captcha=null döner ve sayfa hiçbir betik yüklemez.
 */
export const GET: APIRoute = async () => {
  const siteKey = getSecret('RECAPTCHA_SITE_KEY') ?? '';
  const enabled = Boolean(siteKey) && Boolean(getSecret('RECAPTCHA_SECRET_KEY'));
  return new Response(
    JSON.stringify({ captcha: enabled ? { provider: 'recaptcha-v3', siteKey } : null }),
    { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  );
};
