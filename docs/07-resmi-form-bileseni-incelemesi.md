# İş Paketi 2e — Resmî Form Bileşeni İncelemesi ve Sunucu Tarafı Koruma

**Önizleme:** https://js9dub-csuite-headless-csuite04-0f08.wix-site-host.com

## 1. Resmî bileşen incelendi: `@wix/headless-forms`

Wix'in headless form bileşeni **mevcut ve entegre edilebilir**: `@wix/headless-forms@0.0.45`
("Headless React components for rendering and managing forms").

**Ama spam koruması içermiyor.** Paketin gönderim çağrısı (`dist/services/form-service.js`):

```js
async function defaultSubmitHandler(formId, formValues) {
    await submissions.createSubmission({
        formId,
        submissions: formValues,
    });
```

`captchaToken` yok, ek seçenek yok — **bizim uygulamamızla birebir aynı çağrı**.
Pakette `captcha` kelimesi hiç geçmiyor. `fetchSiteConfig` yalnızca locale/para birimi
çekiyor (render için), spam ile ilgisi yok.

**Sonuç:** Bu bileşene geçmek korumayı etkinleştirmez; yalnızca formu React ile yeniden
render eder ve tasarımı bozar. Bu yüzden **önizlemesini üretmedim** — kullanıcının koşulu
"spam koruması etkin" bileşendi, bu koşul sağlanmıyor.

## 2. Barındırılan/gömülebilir Wix formu var mı? — Hayır

CRM ▸ Forms API yüzeyinin tamamı tarandı: yalnızca şema CRUD (`Create/Get/Update/Delete/
Query/List/Clone Form`, `Get Form Summary`, çöp kutusu işlemleri) ve gönderim uçları var.
**Barındırılan form, paylaşım bağlantısı veya gömme (embed) ucu yok.**

`forms/v4/standalone-forms/site-properties` ucu mevcut ve çalışıyor (HTTP 200) ama
yalnızca `{paymentCurrency, localeLanguageCode, localeCountry}` döndürüyor — barındırılan
bir form değil, render yardımcısı.

## 3. Neden CAPTCHA yolu kapalı (kaynakla)

- [Captcha API Introduction](https://dev.wix.com/docs/api-reference/business-management/captcha/introduction.md):
  *"If you're working in **Wix Headless** or using our **REST APIs**, you **can't use this API**."*
- `auth.captchaInvisibleSiteKey` yalnızca **üye kimlik doğrulama** için belgeleniyor
  (`captchaTokens: { invisibleRecaptchaToken }`), Forms için değil.
- Wix Yardım Merkezi: Wix Forms koruması **kendi form widget'ına gömülü**
  (*"site viewer CAPTCHA… analyze a site visitor's behavior"*).
- Ölçüm: uyumsuz `captchaToken` **ADVANCED, BASIC ve NONE** seviyelerinin **hepsinde**
  HTTP 428 `INVALID_CAPTCHA` üretiyor.

> **Bu bulgu "headless'ta hiçbir korumalı çözüm yok" anlamına gelmiyor.** Aşağıdaki
> sunucu tarafı koruma headless'ta çalışıyor ve kanıtlandı.

## 4. Uygulanan çözüm: sunucu tarafı `limitationRule`

Wix Forms şemasının **sunucu tarafı** kısıtlama kuralı — CAPTCHA gerektirmez,
headless'ta çalışır:

```
PATCH /form-schema-service/v4/forms/{formId}
{"form":{"limitationRule":{"submissionLimitPerUser":5}}}   → HTTP 200, revision 18
```

### Kanıt — gerçekten uygulanıyor

Aynı ziyaretçi kimliğiyle 7 gönderim:

| Gönderim | Sonuç |
|---|---|
| 1–5 | HTTP 200 |
| **6–7** | **HTTP 400 `PER_USER_SUBMISSION_LIMIT_EXCEEDED`** |

### Ziyaretçi kimliği kalıcı kılındı

İlk ölçümde **taze ziyaretçi token'ı limiti sıfırlıyordu** (her sayfa açılışında yeni
`visitorId`). Bu, kuralı etkisiz bırakıyordu. Düzeltme: ziyaretçi token'ı `localStorage`'da
saklanıyor (`csuite_vt`), böylece `visitorId` tarayıcı başına sabit kalıyor ve kural
gerçekten bağlıyor. Bu token **herkese açık ziyaretçi token'ıdır**, gizli anahtar değildir.

### Gerçek tarayıcı doğrulaması (yerel röle üzerinden)

| Adım | Sonuç |
|---|---|
| 1. gönderim | ✅ başarılı |
| Sayfa yenileme sonrası token saklandı | ✅ `true` |
| 2–5. gönderim (yenileme sonrası, aynı kimlik) | ✅ başarılı |
| **6. gönderim** | ✅ **engellendi** — *"Bu tarayıcıdan gönderebileceğiniz talep sayısına ulaştınız"* |
| Alanlar korundu | ✅ hepsinde |
| Sayfa hatası | ✅ yok |

## 5. Tasarımdan somut farklar

**Görsel fark yok.** reCAPTCHA entegrasyonu kaldırıldığı için Google rozeti de gitti;
form alanı ve sayfanın geri kalanı kaynak tasarımla aynı. `<style>` bloğu **bayt bayt aynı**.

Değişenler yalnızca görünmez katmanda:
- 5 `name` özniteliği (şema `target`'ları)
- 2 Web3Forms gizli alanı kaldırıldı
- `<script>` gönderim mantığı
- Hata durumunda küçük bir `(Hata ref: HTTP/WixKodu)` etiketi — token/kişisel veri içermez

**İşveren/Aday geçişi ve beş form alanı korundu.** Şema alanları geri okundu:
`first_name, company, email, phone, message, taraf`.

## 6. Doğrulanan / doğrulanamayan

| Konu | Durum |
|---|---|
| Sunucu tarafı koruma etkin | ✅ `submissionLimitPerUser: 5`, 400 ile engelliyor |
| Kalıcı kayıt | ✅ 20 kayıt, hepsi `CONFIRMED` |
| İşveren/Aday + 5 alan | ✅ Şemadan geri okundu |
| Bildirim yapılandırması | ✅ `ACTIVE`, tetik `wix_form_app-form_submitted` (yeniden kurulmadı) |
| **E-posta teslimatı** | ❌ Gelen kutusu erişimi yok — doğrulanmadı |
| **Gerçek önizleme adresinde tarayıcı testi** | ❌ Chromium ajan vekilini kullanamıyor; testler yayındaki sayfanın kopyası üzerinde yerel röleyle koştu |

## 7. Kalan sınır — açıkça

`spamFilterProtectionLevel` ADVANCED/BASIC bu mimaride kullanılamıyor (Bölüm 3).
Mevcut koruma katmanları:

1. **Sunucu tarafı:** `submissionLimitPerUser` (kanıtlandı)
2. **İstemci tarafı:** honeypot (`botcheck`) — sunucu korumasının yerine geçmez
3. Kullanılabilir ama kurulmadı: `limitationRule.maxAllowedSubmissions`, `dateTimeDeadline`

Tam Wix spam filtresi isteniyorsa tek yol Wix'in kendi form widget'ıdır; bu, headless
mimariden çıkmayı ve formun görünümünü değiştirmeyi gerektirir.

## 8. Not — Safari hatası

Kullanıcının Safari'deki gerçek HTTP yanıtı yakalanmadı. 428 `INVALID_CAPTCHA`,
**aynı koşulların yeniden üretildiği deneyde gözlenen** hatadır; Safari oturumunun
kesin yanıt kodu olarak raporlanmıyor.
