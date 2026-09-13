# C-Suite · Executive Search — Web Sitesi

Tanıtım sitesi projesi. Kaynak tasarım tek, kendi kendine yeten bir HTML dosyasıdır.

## Dizin yapısı

| Yol | İçerik |
|---|---|
| `site/C-Suite_Ideal_Revize.html` | Kaynak site (75.434 bayt, tek dosya) |
| `docs/` | İş paketi raporları |
| `docs/img/` | Doğrulama ekran görüntüleri |
| `tools/render-check.mjs` | Render + etkileşim testi (Playwright) |

## Sitenin teknik özeti

- Tek dosya; **harici görsel/CSS/JS bağımlılığı yok**
- Harici bağımlılık yalnızca: Google Fonts (Poppins) ve `api.web3forms.com`
- Bölümler: hero → `#neden` → `#network` → `#surec` → `#guven` → `#iletisim`
- İşveren/Aday persona geçişi 10 içerik bloğunu ve iletişim formunu yeniden yazar

## Raporlar

- [İş Paketi 1 — Wix Bağlantısı ve Uygulanabilirlik](docs/01-wix-baglanti-ve-uygulanabilirlik.md)

## Testi çalıştırma

`tools/render-check.mjs` içindeki `PROJECT_ROOT` yolunu güncelledikten sonra:

```bash
npm i playwright
node tools/render-check.mjs
```
