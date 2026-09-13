> ## ⚠️ BU RAPOR GÜNCELLENDİ
>
> Bkz. **[05-spam-korumasi-pending-yayin-ve-bildirim.md](05-spam-korumasi-pending-yayin-ve-bildirim.md)**.
> 1. `NONE` **nihai çözüm değil.** Nedensellik HTTP 428 ile kanıtlandı; görünmez reCAPTCHA
>    entegre edildi (görünür bileşen varsayımı yanlıştı). Seviye, gerçek tarayıcıda
>    doğrulanana kadar `NONE` bırakıldı.
> 2. **PENDING'de buton artık süresiz kilitlenmiyor** — 15 sn sınırlı bekleme + uyarı.
>    `lastSubmissionId`'nin sayfa yenileme ve ağ kesintisinde koruma sağlamadığı ölçüldü.
> 3. **"Published" çelişkisi çözüldü:** production adresi **404**; yalnızca `wix preview`
>    çalıştırıldı, `wix release` hiç çalıştırılmadı.
> 4. **Bildirim otomasyonu okundu** (doğru API: `automations-service/v2`): `ACTIVE`, doğru
>    forma filtreli, alıcı site işbirlikçileri. Teslimat hâlâ doğrulanmadı.

# İş Paketi 2b — Form Kayıt Sorunu: Kök Neden ve Düzeltme

**Tarih:** 2026-09-13
**Durum:** Çözüldü, kalıcı kayıt kanıtlandı. Canlı yayın **yapılmadı**.
**Önizleme:** https://aer0gu-csuite-headless-csuite04-0f08.wix-site-host.com

---

## 0. Önceki raporun düzeltilen sonuçları

### 0.1 "HTTP 200 ve gönderim ID'si = başarı" — YANLIŞTI

`POST /submissions` her seferinde 200 ve geçerli bir GUID döndürüyordu, ama kayıt
**kalıcı değildi**. Doğru başarı ölçütü yalnızca şudur: **kaydın sahip yetkisiyle,
ID üzerinden, `CONFIRMED` durumda geri okunabilmesi.** Rapor artık bu ölçütü kullanıyor.

### 0.2 "Siteyi yayımlamak tek çözüm" — DOĞRULANMAMIŞ VARSAYIMDI, ÜSTELİK YANLIŞTI

Yetkili `dynamic-context` çağrısı sitenin durumunu **`Published`** olarak veriyor:

```
## 1. Csuite Headless
**ID**: 72b257e3-0db0-4579-8795-64e51b3f42a6
**URL**: https://csuite-headless-csuite04-0f08.wix-site-host.com/
**Status**: Published
```

Site zaten yayımlanmıştı; sorun yayın durumu değildi. Varsayımı kanıt olmadan
öne sürmek hataydı.

### 0.3 Ek düzeltme: "hesapta 0 site vardı" — YANLIŞTI

Önceki raporda `site-list/v2/sites/query` boş döndüğü için "0 mevcut site" yazmıştım.
Yetkili `dynamic-context` çağrısı **2 site** gösteriyor:

| Site | ID | Durum | Oluşturma |
|---|---|---|---|
| Csuite Headless (bizim) | `72b257e3-…` | Published | 13 Eyl 09:28 |
| **My Site 1** (bizden önce vardı) | `bec82285-…` | Draft | 13 Eyl **08:15** |

`My Site 1` bu oturumdan önce mevcuttu ve **hiç dokunulmadı**. Kullandığım sorgu
endpoint'i yanlıştı; "boş yanıt = yok" çıkarımı hatalıydı.

---

## 1. Sistematik teşhis — ne elendi

Her adım gerçekten çalıştırıldı:

| # | Hipotez | Test | Sonuç |
|---|---|---|---|
| 1 | Yanlış siteId / formId / clientId | Config'ten okunan tek kaynak, tüm çağrılarda aynı | ✅ Tutarlı — sorun değil |
| 2 | Kimlik bağlamı farkı | Aynı gönderim 3 bağlamda: ziyaretçi / ziyaretçi+site header / sahip+site header | ❌ **Üçü de PENDING** — sorun değil |
| 3 | REST ↔ SDK farkı | Resmî `@wix/sdk` + `@wix/forms` ile `createSubmission` | ❌ **SDK de PENDING** — sorun değil |
| 4 | Yanlış namespace / uygulama bağlantısı | Form geri okundu: `namespace: wix.form_app.form`, `enabled: true`, `properties.disabled: false` | ✅ Doğru — sorun değil |
| 5 | "Uygulama kurulu değil" | Yetkili `dynamic-context`: **Wix Forms (225dd912-…) kurulu** | ✅ Kurulu — sorun değil |
| 6 | Site yayımlanmamış | `dynamic-context` → **Status: Published** | ❌ Varsayım çürüdü |
| 7 | CORS / Origin | `Origin` + `Referer` başlıklarıyla gönderim | ❌ Değişmedi — sorun değil |
| 8 | Yanlış okuma endpoint'i | `/submissions/query` → `/submissions/namespace/query` + `onlyYourOwn` | ⚠️ **Kısmen doğru** (aşağıda) |
| 9 | **Spam filtresi** | Kontrollü deney | ✅ **KÖK NEDEN** |

### 1.1 Okuma tarafındaki ikinci hata (madde 8)

İki ayrı hata vardı:

1. **Yanlış endpoint.** `/submissions/query` yerine resmî `/submissions/namespace/query`
   kullanılmalıydı ([Query Submissions By Namespace](https://dev.wix.com/docs/api-reference/crm/forms/form-submissions/query-submissions-by-namespace.md)).
2. **`onlyYourOwn` bayrağı.** `true` ise yalnızca çağıran uygulamanın kendi kayıtları
   döner. Sahip yetkisiyle tüm kayıtları görmek için **`false`** gerekir.

Ancak bu düzeltmeler tek başına sorunu çözmedi — kayıtlar zaten silinmiş oluyordu.

### 1.2 Neden `create` sonrası `GET` 404 veriyordu

Belirleyici gözlem: aynı ID'ye **ilk `confirm` 200**, ikincisi **404** verdi.
Yani varlık kısa süre yaşayıp yok oluyordu. Resmî doküman bunu açıklıyor
([Submission status](https://dev.wix.com/docs/api-reference/crm/forms/form-submissions/introduction.md)):

> "A `PENDING` submission **isn't recorded yet** and isn't shown to the Wix user…
> and is **deleted automatically if it isn't confirmed in time**."

---

## 2. KÖK NEDEN

> **`spamFilterProtectionLevel` ADVANCED (varsayılan) veya BASIC iken, CAPTCHA token'ı
> taşımayan gönderimler `PENDING` durumunda tutuluyor ve bir dakika içinde sessizce
> siliniyor.** API hiçbir aşamada hata döndürmüyor — `create` 200 veriyor, ID üretiyor,
> sonra kayıt yok oluyor.

### Kontrollü deney (her seviye: gönder → 40 sn bekle → kalıcılığı say)

| `spamFilterProtectionLevel` | `create` yanıtı | Kalıcı kayıt |
|---|---|---|
| `ADVANCED` (varsayılan) | `PENDING` | ❌ **HAYIR** |
| `BASIC` | `PENDING` | ❌ **HAYIR** |
| **`NONE`** | `PENDING` | ✅ **EVET → `CONFIRMED`** |

Deney iki kez tekrarlandı, sonuç aynı.

### Destekleyici resmî kaynak

[Confirm Submission](https://dev.wix.com/docs/api-reference/crm/forms/form-submissions/confirm-submission.md):

> "When using forms from the **Wix Forms app, the default form submission status is
> `CONFIRMED`**."

Bizim formumuz Wix Forms namespace'inde olmasına rağmen `PENDING` dönüyordu — yani
dokümante edilen varsayılandan sapma vardı. Sapmanın nedeni spam filtresiydi.

> **Not:** `create` yanıtı `NONE` seviyesinde de `PENDING` döner; durum asenkron olarak
> `CONFIRMED`'a geçer. Bu yüzden `create` yanıtındaki durum tek başına ölçüt değildir.

---

## 3. UYGULANAN DÜZELTME

```
PATCH /form-schema-service/v4/forms/a5807409-660c-47c4-8a66-6cf43f5086d3
{"form":{"spamFilterProtectionLevel":"NONE", ...}}   → HTTP 200, revision 8
```

### Neden `NONE` seçildi

`ADVANCED`/`BASIC` çalışmak için `createSubmission(submission, { captchaToken })`
bekliyor. CAPTCHA token'ı üretmek sayfaya **görünür bir CAPTCHA bileşeni** eklemeyi
gerektirir — bu **tasarımı değiştirir** ve açıkça yasaklanmıştı.

**Kalan koruma:** Kaynak tasarımdaki **honeypot alanı (`botcheck`) korunuyor** ve
JS tarafında kontrol ediliyor; işaretliyse gönderim yapılmıyor.

**Güvenlik ödünleşmesi — açıkça belirtiyorum:** Wix'in sunucu tarafı spam filtresi bu
form için devre dışı. Spam gelirse seçenekler: (a) seviyeyi `BASIC`'e çıkarıp gerçek
tarayıcıdan yeniden test etmek, (b) tasarıma CAPTCHA eklemeyi kabul etmek,
(c) Wix Forms kurallarıyla filtrelemek. Karar sizindir.

---

## 4. KALICI KAYIT KANITI

Ön yüzden **İşveren** ve **Aday** için birer TEST kaydı üretildi ve her biri
**sahip yetkisiyle, ID üzerinden** geri okundu:

### İşveren — `8c377108-e22f-41d6-bda1-31fe2c0d3602`
```
GET /form-submission-service/v4/submissions/8c377108-…   → HTTP 200
durum   : CONFIRMED
taraf   : İşveren
ad      : TEST KAYIT - Isveren Dogrulama
sirket  : TEST - Kurmaca Sirket (silinebilir)
email   : test@example.com | tel: +902160000000
```

### Aday — `74eb7f3e-36e9-43d0-a604-0de2f5fe8c0a`
```
GET /form-submission-service/v4/submissions/74eb7f3e-…   → HTTP 200
durum   : CONFIRMED
taraf   : Aday
ad      : TEST KAYIT - Aday Dogrulama
sirket  : TEST - Kurmaca Kurum (silinebilir)
email   : test@example.com | tel: (boş — isteğe bağlı alan)
```

**Alan karşılaştırması:** gönderilen ile okunan tüm değerler birebir aynı.
`taraf` bilgisi her iki tarafta da doğru. Telefon, İşveren'de dolu / Aday'da boş —
gönderildiği gibi.

### Namespace sorgusu — toplam kalıcı kayıt

```
POST /form-submission-service/v4/submissions/namespace/query  (onlyYourOwn:false)
→ 5 kayıt, tümü CONFIRMED
```

Beşincisi **gerçek tarayıcıdan** yapılan gönderimdir
(`TEST KAYIT - Tarayici Isveren Son`, taraf=İşveren, tel=+902160000000).

---

## 5. Ön yüz düzeltmesi — PENDING'de aşırı iddia yok

Artık:

| Durum | Davranış |
|---|---|
| `CONFIRMED` | Başarı mesajı + form sıfırlanır + buton 4 sn sonra açılır |
| `PENDING` / `PAYMENT_WAITING` | Mesaj gösterilir, **alanlar KORUNUR**, **buton kilitli kalır** |
| Hata | Hata dalı, buton açılır |

Ek olarak `lastSubmissionId` koruması: bir gönderim başarılıysa aynı oturumda ikinci
istek **hiç gönderilmez** — mükerrer kayıt üretilmez.

Tarayıcı testi doğruladı:
```
{"cls":"formmsg ok","btn":"Gönderildi ✓","disabled":true,"adKorundu":true,"taraf":"İşveren"}
sayfa hataları: YOK
```
`adKorundu: true` → alanlar temizlenmedi.

**Tasarım değişmedi:** `<style>` bloğu kaynakla **bayt bayt aynı**; görünür markup'ta
tek fark gizli alanlar ve `name` öznitelikleri.

---

## 6. ⚠️ BİLDİRİM — DOĞRULANMADI

| Kontrol | Sonuç |
|---|---|
| Otomasyon **var mı** | ✅ Form nesnesinde `extendedFields.namespaces["@forms/form-app"].automationId = 7bc07c88-…` |
| Otomasyonun **alıcı yapılandırması** | ❌ **Okunamadı** — denenen `automations/v1`/`v2` uçları 404 |
| E-posta **teslimatı** | ❌ **Kanıt yok** |

Bir otomasyon kimliği formda kayıtlı; bu, bildirim altyapısının bağlandığına işaret eder
ama **yapılandırmasını ve çalıştığını kanıtlamaz**.

Test adresinin `example.com` olması bildirimin gitmediğini göstermez — bildirim **site
sahibine** gider, gönderene değil. Ancak site sahibinin gelen kutusunu göremediğim için
**teslimatı doğrulanmış saymıyorum**.

**Doğrulama yolu:** `csuite04@gmail.com` gelen kutusunu (ve spam klasörünü)
`notifications@wix-forms.com` adresinden gelen ileti için kontrol edin. Yukarıdaki 5 test
kaydı 10:06–10:15 UTC arasında oluştu.

---

## 7. Test yönteminin sınırı — açıkça

**Yerel röle testi, gerçek önizleme adresindeki tarayıcı/CORS davranışını doğrulamaz.**

Bu ortamda Chromium ajan vekilini kullanamıyor (`ERR_PROXY_CONNECTION_FAILED`; ham CONNECT
zinciri de reddedildi), bu yüzden tarayıcı testleri yayındaki sayfanın **indirilmiş
kopyası** üzerinde, `127.0.0.1:8899` origin'inden koştu. Bu düzenek JS mantığını gerçek
API yanıtlarına karşı doğrular, ancak şunları **doğrulamaz**: gerçek origin'den CORS,
tarayıcı çerez/oturum davranışı, Wix'in origin'e bağlı işlemleri.

**Buna karşılık gerçek origin'den CORS ayrıca doğrulandı** (yerel röle değil, doğrudan
gerçek önizleme adresiyle preflight):

```
OPTIONS https://www.wixapis.com/form-submission-service/v4/submissions
  Origin: https://aer0gu-csuite-headless-csuite04-0f08.wix-site-host.com
→ HTTP 204
  access-control-allow-origin: https://aer0gu-csuite-headless-csuite04-0f08.wix-site-host.com
  access-control-allow-methods: POST, GET, PUT, DELETE, PATCH, OPTIONS
  access-control-allow-headers: …, authorization, …, Content-Type, …
```

Aynı sonuç `/oauth2/token` için de alındı. OAuth uygulamasının izinli alan adları da
doğru: `https://(.*)-csuite-headless-csuite04-0f08.wix-site-host.com` ve yayın adresi.

**Kalan boşluk:** gerçek bir tarayıcının gerçek önizleme adresinde form doldurup
göndermesi. Bunu siz bir dakikada yapabilirsiniz — önizleme bağlantısını açıp formu
TEST verisiyle gönderin; ben kaydı ID ile geri okuyup doğrularım.

---

## 8. Test kayıtları

5 kayıt, tümü açıkça `TEST` etiketli, `test@example.com` (IANA'nın test için ayırdığı,
teslim edilemeyen alan adı). Gerçek kişi verisi kullanılmadı.

Yayına geçmeden önce bu kayıtların silinmesi gerekir:
`DELETE /form-submission-service/v4/submissions/{id}` — isterseniz yaparım.

---

## 9. Yapılmayanlar

- ❌ Canlı yayın (`wix release`) — **yapılmadı**
- ❌ Ücretli paket — gerekmedi, alınmadı
- ❌ Alan adı değişikliği — yapılmadı
- ❌ Tasarım değişikliği — yapılmadı (CSS bayt bayt aynı)
- ❌ Gizli token kodda/log'da/Git'te — paylaşılmadı
