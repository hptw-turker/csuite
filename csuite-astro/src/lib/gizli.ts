import { auth } from '@wix/essentials';
import { secrets } from '@wix/secrets';
import { getSecret } from 'astro:env/server';

/**
 * Gizli değer çözümleyici.
 *
 * İki depo aynı şey DEĞİLDİR:
 *  - **Wix Secrets Manager** (pano › Developer Tools › Secrets Manager): site sahibinin
 *    terminal kullanmadan değer girdiği yer. Sunucudan `secrets.getSecretValue()` ile okunur
 *    ve çalışma anında sorgulandığı için yeni değer, yeniden dağıtım gerektirmez.
 *  - **CLI ortam değişkeni** (`wix env set`): dağıtım anında gömülür; değişiklik ancak yeni
 *    bir `wix preview` / `wix release` ile etkili olur (ölçüldü).
 *
 * Sıra: önce Secrets Manager, sonra ortam değişkeni. Değer HİÇBİR yere yazdırılmaz;
 * dışarıya yalnızca "var mı ve hangi depodan geldi" bilgisi çıkar.
 */

export type Kaynak = 'secrets-manager' | 'env' | null;

type Girdi = { deger: string; kaynak: Kaynak; t: number };
const onbellek = new Map<string, Girdi>();
const TTL_MS = 60_000;

export async function gizliOku(ad: string): Promise<{ deger: string; kaynak: Kaynak }> {
  const now = Date.now();
  const hit = onbellek.get(ad);
  if (hit && now - hit.t < TTL_MS) return { deger: hit.deger, kaynak: hit.kaynak };

  let deger = '';
  let kaynak: Kaynak = null;

  try {
    const r = await auth.elevate(secrets.getSecretValue)(ad);
    const v = (r as { value?: string })?.value ?? '';
    if (v) {
      deger = v;
      kaynak = 'secrets-manager';
    }
  } catch {
    // Secret yoksa veya okunamıyorsa ortam değişkenine düşülür.
  }

  if (!deger) {
    const v = getSecret(ad) ?? '';
    if (v) {
      deger = v;
      kaynak = 'env';
    }
  }

  onbellek.set(ad, { deger, kaynak, t: now });
  return { deger, kaynak };
}

/** Yalnızca varlık/kaynak bilgisi — değer asla dönmez. */
export async function gizliDurum(ad: string): Promise<Kaynak> {
  return (await gizliOku(ad)).kaynak;
}
