# İş Paketi 2c — Spam Koruması, PENDING, Yayın Durumu ve Bildirim

**Tarih:** 2026-09-13
**Önizleme:** https://fly8a0-csuite-headless-csuite04-0f08.wix-site-host.com
**Spam seviyesi (mevcut):** `NONE` — reCAPTCHA entegrasyonu kodda hazır, **uçtan uca doğrulanamadı**

---

## 1. SPAM KORUMASI

### 1.1 Nedensellik resmî sözleşmeyle kanıtlandı

Önceki turda "spam koruması ile kayıt kaybı arasında ilişki var" demiştim; nedeni kanıtlamamıştım.
Şimdi kanıtlandı. `spamFilterProtectionLevel: ADVANCED` altında aynı gönderim:

| Gönderim | Sonuç |
|---|---|
| `captchaToken` **yok** | HTTP **200** → `PENDING` → bir dakika içinde silinir |
| `captchaToken` **geçersiz** | HTTP **428** — `Invalid Recaptcha token: … MALFORMED` |

**HTTP 428 (Precondition Required)** sunucunun bu seviyede geçerli bir reCAPTCHA token'ını
**zorunlu tuttuğunun** doğrudan kanıtıdır. Token eksikse hata verilmiyor, sessizce atılıyor —
asıl tehlikeli davranış bu.

Resmî sözleşme ayrıca `captchaToken`'ı belgeliyor
([Create Submission](https://dev.wix.com/docs/api-reference/crm/forms/form-submissions/create-submission.md)):

```
param name: captchaToken | description: Captcha token. | validation: minLength 1, maxLength 3000
```

### 1.2 Görünür bileşen varsayımı yanlıştı — görünmez reCAPTCHA uygulandı

CAPTCHA'nın kalıcı görünür bileşen gerektirdiği varsayımım yanlıştı. Wix resmî olarak
**görünmez reCAPTCHA**'yı destekliyor ve **kendi site anahtarlarını** veriyor
([Add reCAPTCHA to a Custom Login Page](https://dev.wix.com/docs/go-headless/authentication/members/custom-login-page/re-captcha/add-re-captcha-to-a-custom-login-page-js-sdk.md)):

> "Use a **Wix site key**, not your own... You can get Wix keys from the `captchaVisibleSiteKey`
> and `captchaInvisibleSiteKey` properties in the SDK."
> "For **invisible reCAPTCHA, the component is hidden** and only triggers when needed."

SDK'dan okunan anahtar: `captchaInvisibleSiteKey = 6LdoPaUfAAAAAJphvHoUoOob7mx0KDlXyXlgrx5v`

**Uygulanan entegrasyon** (`dist/index.html`):
- `<head>`'e `recaptcha/enterprise.js?render=explicit`
- Forma boş `<div id="recaptchaBox">` — **satır içi yer kaplamaz**
- Widget **sayfa açılırken** hazırlanır (`load` olayında), gönderimde bekleme olmaz
- `execute()` **8 sn zaman aşımıyla** sarılı — form hiçbir koşulda askıda kalmaz
- Token varsa `payload.captchaToken` olarak eklenir

**Tek görsel ek:** Google'ın standart reCAPTCHA rozeti (sağ altta, sabit). Sayfa yerleşimine
dokunmaz, `<style>` bloğu **bayt bayt aynı** kaldı.

### 1.3 ⚠️ Neden seviye hâlâ `NONE`

Kullanıcı talimatı: *"Koruma seviyesini yeniden yükseltmeden önce gerçek entegrasyonu tamamla."*

Entegrasyonu tamamladım ama **uçtan uca doğrulayamadım**:

| Adım | Sonuç |
|---|---|
| reCAPTCHA betiği yükleniyor | ✅ `grecaptcha.enterprise` hazır |
| Token üretiliyor | ✅ **505 karakterlik gerçek token alındı** |
| Token ADVANCED altında kabul ediliyor | ❌ **HTTP 428 MALFORMED** |

**Neden:** Token `http://127.0.0.1:8899` origin'inde üretildi. Wix'in site anahtarı yalnızca
Wix alan adları için kayıtlı; başka origin'de üretilen token doğrulamayı geçmiyor. Bu ortamda
Chromium gerçek önizleme adresine erişemediği için (bkz. Bölüm 5) doğru origin'de token
üretilemiyor.

Bu nedenle seviyeyi `ADVANCED`'a **yükseltmedim** — yükseltseydim form sessizce kayıt kaybetmeye
devam ederdi. Kod hazır; doğrulama gerçek tarayıcıda yapılmalı.

**Doğrulama yolu (1 dakika):** Önizlemeyi gerçek tarayıcıda açıp TEST verisiyle gönderin.
Kayıt kalıcı olursa seviyeyi `ADVANCED`'a çıkarırım.

### 1.4 Honeypot gerçekten kontrol ediliyor — test edildi

Kodda var olması yeterli değildi; çalıştığını ölçtüm:

```
botcheck işaretli → gönderim isteği sayısı: 0   (beklenen: 0)
```

Sunucuya **hiç istek gitmiyor**. Ancak bu **istemci tarafı** bir kontroldür ve sunucu tarafı
korumanın yerine geçmez — JS'i atlayan bir bot doğrudan API'ye gönderebilir. Gerçek sunucu
tarafı koruma, 1.3'teki reCAPTCHA doğrulaması tamamlandığında devreye girer.

---

## 2. PENDING VE TEKRAR GÖNDERİM

### 2.1 Süresiz kilit kaldırıldı

Ziyaretçi gönderimi geri okuyamaz — okuma `SCOPE.FORMS.MANAGE-SUBMISSIONS` (sahip) yetkisi ister.
Sahip token'ını frontend'e **koymadım** ve koymayacağım. Dolayısıyla sonucu istemciden
doğrulamak mümkün değil; bunun yerine sınırlı bekleme uygulandı:

| Durum | Davranış |
|---|---|
| `CONFIRMED` | Başarı mesajı, form sıfırlanır, 4 sn sonra buton açılır |
| `PENDING` | **Alanlar korunur**, açık mesaj: *"Talebiniz iletildi, ancak kaydı şu anda doğrulayamıyoruz…"*, **15 sn** sonra buton açılır ve mesaj *"Tekrar göndermek mükerrer kayıt oluşturabilir"* uyarısına döner |
| Hata | Hata dalı, buton hemen açılır |

### 2.2 `lastSubmissionId`'nin gerçek koruma sınırı — test edildi

| Senaryo | Koruma | Ölçüm |
|---|---|---|
| Aynı sayfada arka arkaya tıklama | ✅ **Var** | 2. tıklama istek üretmedi (sayaç 1'de kaldı) |
| 15 sn sonra yeni talep | ✅ İzin verilir | İstek 1→2, yeni kayıt oluştu |
| **Sayfa yenileme** | ❌ **YOK** | `lastSubmissionId=null`, buton açık — koruma sıfırlanır |
| **Ağ kesintisi / yanıt alınamaması** | ❌ **YOK** | Yanıt gelmezse `lastSubmissionId` hiç atanmaz |

`lastSubmissionId` yalnızca **aynı sayfa oturumunda, yanıt alınmış bir gönderimden sonraki**
tekrar tıklamayı engeller. Sayfa yenileme veya ağ kesintisinde mükerrer kaydı **önlemez** —
bunu koruma sağlıyormuş gibi raporlamıyorum. Gerçek mükerrer koruması sunucu tarafında
(idempotency anahtarı veya Wix Forms `submissionLimitPerUser`) kurulmalıdır; bu turda kapsam
dışı bırakıldı.

---

## 3. GERÇEK YAYIN DURUMU — çelişki çözüldü

Önceki raporda "Status: Published" ile "canlı yayın yapılmadı" yan yana duruyordu. Ölçümler:

| Adres | HTTP | Ne sunuyor |
|---|---|---|
| `csuite-headless-csuite04-0f08.wix-site-host.com` (**production**) | **404** | *"Page wasn't found"* — **bizim içeriğimiz yok** |
| `u5jx3r-…` (önizleme v1) | 200 | İlk statik sürüm |
| `zipdbh-…` (önizleme v2) | 200 | Wix Forms bağlantılı sürüm |
| `aer0gu-…` (önizleme v3) | 200 | PENDING mantığı düzeltilmiş sürüm |
| `ze8ney-…` / **`fly8a0-…`** (v4/v5) | 200 | reCAPTCHA entegrasyonlu sürümler |

**Uzlaştırma:** `dynamic-context`'in **`Status: Published`** değeri **metasite'ın** sağlanmış
(provisioned) durumunu anlatıyor — `init` sırasında oluşan durum, `Updated: 09:30`. Bizim
içeriğimizin production origin'inde yayında olduğunu **göstermiyor**; o adres 404 veriyor.

**Hangi işlem hangi sürümü yayımladı:** Yalnızca `wix preview` çalıştırıldı (5 kez), her biri
kendi ön ekli sürüm adresini üretti. **`wix release` hiç çalıştırılmadı** — bu yüzden production
origin boş. Bu turda da yeni bir yayın işlemi yapılmadı.

---

## 4. BİLDİRİM — otomasyon okundu

Önceki 404'lerim yanlış yoldan geliyordu (`automations/v1|v2/automations/{id}`). Doğru API:

```
GET https://www.wixapis.com/automations-service/v2/automations/{automationId}
Scope: SCOPE.CRM.SETUP-AUTOMATIONS
```

**Sonuç: HTTP 200** — otomasyon gerçekten okunabiliyor:

| Alan | Değer |
|---|---|
| Ad | `New submission received for C-suite · Görüşme Talebi` |
| **Durum** | **`ACTIVE`** |
| `archived` | `false` |
| Tetikleyici | `wix_form_app-form_submitted`, **filtre: tam bizim `formId`** |
| Eylem | `triggered-emails` (Wix tetiklenen e-posta), `transactional: true` |
| **Alıcı** | `CollaboratorRoles` → `roleIds: ["6601492336091027458"]` — **site işbirlikçileri (sahip)** |
| `replyTo` | `{{var("contact.email")}}` — yanıtlar gönderene gider |
| `triggerContactExcluded` | `true` — **gönderene e-posta gitmez** |

Bu, önceki turdaki "`automationId` var" gözleminden çok daha güçlü: otomasyon **etkin**, **doğru
forma bağlı** ve **site sahibine** adreslenmiş. `triggerContactExcluded: true` olduğu için
`test@example.com` adresine zaten bildirim gitmez — bu beklenen davranıştır.

**Yine de teslimat DOĞRULANMADI.** Gelen kutusu erişimim yok. `csuite04@gmail.com` hesabına
`notifications@wix-forms.com` adresinden ileti gelip gelmediğini yalnızca siz görebilirsiniz;
kayıtlar 10:06–10:35 UTC arasında oluştu. Sizden teknik kurulum istemiyorum — yalnızca gelen
kutusu kontrolü.

---

## 5. SON DOĞRULAMA

### 5.1 Koşulan testler

| Test | Sonuç |
|---|---|
| İşveren gönderimi | ✅ `taraf=İşveren`, kalıcı `CONFIRMED` |
| Aday gönderimi | ✅ `taraf=Aday`, kalıcı `CONFIRMED` |
| ID ile sahip yetkisiyle geri okuma | ✅ HTTP 200, alanlar birebir |
| Kalıcı kayıt toplamı | ✅ **7 kayıt, tümü `CONFIRMED`** |
| PENDING'den çıkış | ✅ 15 sn sonra buton açılıyor, uyarı mesajı değişiyor |
| Hata sonrası yeniden deneme | ✅ Hata dalında buton hemen açılıyor |
| Yeni talep oluşturulabilme | ✅ İstek 1→2, yeni kayıt oluştu |
| Honeypot | ✅ 0 istek |
| reCAPTCHA betiği + token üretimi | ✅ Yükleniyor, 505 karakter token |
| reCAPTCHA + ADVANCED uçtan uca | ❌ **Doğrulanamadı** (origin kısıtı) |
| Tasarım bütünlüğü | ✅ `<style>` bloğu **bayt bayt aynı** |

### 5.2 Gerçek önizleme adresinde tarayıcı testi — YAPILAMADI

Chromium bu ortamda ajan vekilini kullanamıyor; gerçek önizleme adresine
`ERR_CONNECTION_RESET` veriyor. Ham CONNECT zinciri de vekil tarafından reddedildi.
Politikayı aşmaya çalışmadım.

**Yerel röle ve preflight sonuçlarını bunun yerine geçmiş saymıyorum.** Aşağıdakiler
**doğrulanmamıştır** ve yalnızca gerçek tarayıcıda gerçek önizleme adresinde doğrulanabilir:

1. reCAPTCHA token'ının doğru origin'de üretilip ADVANCED altında kabul edilmesi
2. Gerçek tarayıcı çerez/oturum davranışının gönderime etkisi
3. Sayfanın gerçek ağ koşullarındaki yükleme süresi

---

## 6. Gerçekten açık kalan noktalar

| # | Konu | Durum |
|---|---|---|
| 1 | reCAPTCHA + ADVANCED uçtan uca | ❌ Kod hazır, **gerçek tarayıcıda doğrulanmalı** |
| 2 | E-posta teslimatı | ❌ Otomasyon ACTIVE, **teslimat kanıtı yok** |
| 3 | Sunucu tarafı mükerrer koruması | ❌ Kurulmadı (kapsam dışı bırakıldı) |
| 4 | Gerçek önizleme adresinde tarayıcı testi | ❌ Ortam kısıtı |
| 5 | Production yayını | ❌ Bilerek yapılmadı |

## 7. Yapılmayanlar

- ❌ Ücretli paket, alan adı değişikliği, yeni production yayını
- ❌ Sahip token'ı / yönetici okuma yetkisi frontend'e konmadı
- ❌ Tasarım değişikliği (tek ek: Google reCAPTCHA rozeti)
- ✅ 7 TEST kaydı **korundu** (silinmedi)
