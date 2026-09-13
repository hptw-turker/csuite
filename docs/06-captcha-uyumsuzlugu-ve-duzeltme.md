# İş Paketi 2d — CAPTCHA Uyumsuzluğu: Kanıt ve Düzeltme

**Önizleme:** https://icqvct-csuite-headless-csuite04-0f08.wix-site-host.com

## 1. Kullanıcı testi: kayıt oluştu mu?

**Hayır.** `CSUITE-TEST-0913-7A96E369` etiketiyle **hiçbir kayıt oluşmadı**
(namespace sorgusu: 7 kayıt, en yenisi 10:35 — kullanıcının 10:55 UTC gönderimi yok).
Kullanıcı hata görürken sessizce kayıt oluşmuş olasılığı da böylece elendi.

## 2. Kanıtlanan hata nedeni

Ekran görüntüsündeki mesaj **genel** hata mesajıydı, CAPTCHA'ya özel olan değil.
Yani akış CAPTCHA kapısını **geçmişti** (token üretilmişti) ve **Forms gönderimi**
aşamasında düştü.

Aşama ayrıştırması (her biri gerçek istekle ölçüldü):

| Aşama | Sonuç |
|---|---|
| Ziyaretçi yetkilendirme | ✅ Anonim token alınıyor (811 karakter) |
| CAPTCHA üretimi | ✅ Token üretiliyor (505 karakter, v2-invisible) |
| **Forms gönderimi** | ❌ **HTTP 428 `INVALID_CAPTCHA`** |
| Yanıt işleme | ✅ Hata dalı doğru çalışıyor |

### Belirleyici deney — token her seviyede reddediliyor

| Seviye | Tokensız | Sahte/uyumsuz `captchaToken` |
|---|---|---|
| ADVANCED | HTTP 200, `PENDING` | **HTTP 428 `INVALID_CAPTCHA`** |
| BASIC | HTTP 200, `PENDING` | **HTTP 428 `INVALID_CAPTCHA`** |
| **NONE** | HTTP 200, `PENDING` → kalıcı | **HTTP 428 `INVALID_CAPTCHA`** |

**`NONE` seviyesinde bile token doğrulanıyor ve reddediliyor.** Yani `captchaToken`
göndermek gönderimi **her koşulda bozuyor**, hiçbir koşulda iyileştirmiyor.

### Anahtar uyumsuzluğu — resmî kaynak

`auth.captchaInvisibleSiteKey`, Wix dokümantasyonunda yalnızca **üye kimlik doğrulama**
için belgeleniyor (`register`/`login`, `captchaTokens: { invisibleRecaptchaToken }`) —
[Add reCAPTCHA to a Custom Login Page](https://dev.wix.com/docs/go-headless/authentication/members/custom-login-page/re-captcha/add-re-captcha-to-a-custom-login-page-js-sdk.md).
Forms gönderimi ise farklı bir parametre (`captchaToken`, düz string) ve farklı bir
doğrulama yolu kullanıyor. İki yolun aynı token'ı paylaştığına dair **resmî bir ifade yok**;
ölçüm de paylaşmadıklarını gösteriyor.

Ayrıca [Captcha API Introduction](https://dev.wix.com/docs/api-reference/business-management/captcha/introduction.md):

> "If you're working in **Wix Headless** or using our **REST APIs**, you **can't use this API**."

Ve Wix Yardım Merkezi, Wix Forms'un korumasının **kendi form widget'ına gömülü**
olduğunu söylüyor: *"already integrated with spam filters and with a site viewer CAPTCHA…
not visible in the form but analyze a site visitor's behavior"*.

**Sonuç:** Headless özel HTML formundan Wix Forms'un sunucu tarafı spam korumasını
besleyebilecek bir CAPTCHA token'ı üretmek, Wix'in headless'a açtığı araçlarla
**mümkün değil**.

## 3. Uygulanan düzeltme

1. **`captchaToken` gönderim yolundan tamamen kaldırıldı** — her seviyede 428 üretiyordu.
2. reCAPTCHA betiği ve kabı sayfadan çıkarıldı → **Google rozeti de kalktı**, tasarım
   kaynak dosyaya daha da yakınlaştı (`<style>` bayt bayt aynı).
3. `spamFilterProtectionLevel: NONE` — kayıtların kalıcı olduğu tek seviye (revision 17,
   geri okunarak doğrulandı).
4. **Kısa hata referansı** eklendi: hata mesajında `(Hata ref: <HTTP>/<WixKodu>)` görünür.
   Token veya kişisel veri içermez; konsol gerekmez.
5. Honeypot korunuyor ve gerçekten kontrol ediliyor (0 istek ölçüldü).

## 4. Açıkça belirtilen sınır

Bu, spam korumasını "kapatarak işi bitirmek" değil; **kanıtlanmış bir platform sınırı**.
Headless özel formda Wix'in ADVANCED/BASIC koruması çalıştırılamıyor.

Gerçek koruma isteniyorsa tek resmî yol **Wix'in kendi form widget'ını kullanmaktır** —
bu, form alanının görünümünü değiştirir (sayfanın geri kalanı korunur). Bu bir ürün
kararıdır; onayınız olmadan yapmadım.

Mevcut koruma: honeypot (istemci tarafı) + Wix Forms'un `submissionLimitPerUser` gibi
şema düzeyi kuralları (kurulmadı, kapsam dışı).
