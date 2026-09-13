# 10 — B seçeneği: Wix CMS + korumalı sunucu gönderimi + yeniden kurulan bildirim

Tarih: 13 Eylül 2026 · Hesap: csuite04@gmail.com · Site: **Csuite Headless**
(`72b257e3-0db0-4579-8795-64e51b3f42a6`, Premium) · Uygulama/clientId: `2909f5b9-3dce-4e1a-b91f-728e47938e4e`

Bu belge, onaylanan **B seçeneğinin** uygulanışını ve her maddenin nasıl **ölçülerek**
doğrulandığını kaydeder. Doğrulanmamış hiçbir madde "yapıldı" olarak yazılmamıştır.

---

## 1. Mimari

```
Tarayıcı (tasarım birebir korunmuş tek HTML)
        │  POST /api/talep   (JSON)
        ▼
Wix Managed Headless · Astro sunucu route'u          ← herkese açık, kendi korumasını uygular
        │  honeypot → alan doğrulama → süreli sınır → CAPTCHA
        │  auth.elevate(items.insert)
        ▼
Wix CMS koleksiyonu "GorusmeTalepleri"               ← insert/update/remove/read = ADMIN
        │  (kayıttan BAĞIMSIZ)
        ▼
Wix Automations · "C-suite · Yeni görüşme talebi (CMS)"  → site sahibine e-posta
```

Kullanılan resmi araç zinciri:

| Bileşen | Paket / uç | Not |
|---|---|---|
| Çatı | `astro` 5.18.2 | |
| Wix tümleşiği | `@wix/astro` 2.72.0 | |
| Barındırma adaptörü | `@wix/astro-wix-hosting-adapter` 2.0.0 | Wix'in kendi referans projelerinde kilitlenen adaptör; içeride `@astrojs/cloudflare` kullanır |
| Veri | `@wix/data` (`items`) | |
| Yetki yükseltme | `@wix/essentials` (`auth.elevate`) | |
| Yayım | `wix preview` | **`wix release` çalıştırılmadı** |

HTTP ucunun yeri tahmin edilmedi: Wix CLI'ın kendi üretici kodu, Astro projelerinde HTTP
uçlarını `src/pages/api/` altına koyar ve `/api/<ad>` yoluna bağlar
(`@wix/cli` → `getAstroHttpEndpointsDir`, `resolveHttpEndpointsTarget`). Ayrıcalıklı işlem
deseni de Wix'in kendi yönergesinden alınmıştır: *"Privileged Wix operation — on Wix-managed
Astro, create a narrow `src/pages/api/` endpoint … before elevating the one SDK call with
`auth.elevate()`"* (`@wix/agent-skills` → `references/shared/CUSTOM_OPERATIONS.md`).

---

## 2. Depolama ve erişim politikası

Koleksiyon `GorusmeTalepleri` izinleri (API'den okunan gerçek değerler):

```json
{"insert": "ADMIN", "update": "ADMIN", "remove": "ADMIN", "read": "ADMIN"}
```

Alanlar panelde görünecek biçimde tanımlıdır:
`adSoyad, sirket, eposta, telefon, mesaj, taraf, epostaKey, gonderenOzet, kaynak, captchaDogrulandi`.
**`taraf` ayrı bir alan olarak saklanır** (İşveren / Aday).

### Ölçüm — anonim ziyaretçinin doğrudan erişimi

Anonim ziyaretçi jetonu (`POST /oauth2/token`, `grantType: anonymous`, herkese açık clientId ile) alındı:

| Deneme | Sonuç |
|---|---|
| `POST /wix-data/v2/items` (yazma) | **HTTP 403** · `WDE0027: The current user does not have permissions to insert on the GorusmeTalepleri collection.` |
| `POST /wix-data/v2/items/query` (okuma) | **HTTP 403** · `WDE0027: … does not have permissions to read on the GorusmeTalepleri collection.` |

`update` ve `remove` de aynı ADMIN politikasına tabidir.

---

## 3. Herkese açık route'un kendi koruması

`src/pages/api/talep.ts` sırasıyla uygular:

1. **Honeypot** — `botcheck` doluysa 400 `REJECTED`.
2. **Alan doğrulama** — ad soyad ≥ 2, şirket/mevcut kurum ≥ 2, e-posta biçimi, mesaj ≥ 5,
   `taraf ∈ {İşveren, Aday}`. Hata → 400 `VALIDATION` (+ hangi alanlar).
3. **Süreli gönderim sınırı** — 15 dakikalık pencerede aynı gönderenden en çok 3 talep.
   Kalıcı kota **değildir**; pencere dolunca kendiliğinden kalkar.
4. **CAPTCHA** — sunucuda doğrulanır (aşağıda).
5. **Kayıt** — `auth.elevate(items.insert)`.
6. **Bildirim** — kayıttan bağımsız; başarısızlığı kullanıcıya hata olarak yansıtılmaz.

### Gönderen kimliği hangi başlıktan alınır — ölçüldü

Yayımlanan önizlemeye geçici bir tanı ucu konularak istemcinin başlık sahteciliği denendi:

| Başlık | İstemci gönderirse | Sonuç |
|---|---|---|
| `x-forwarded-for` | kenar katman kendi değerini yazıyor | **sahtecilik worker'a ulaşmıyor** |
| `true-client-ip` | kenar katman kendi değerini yazıyor | **sahtecilik worker'a ulaşmıyor** |
| `cf-connecting-ip` | olduğu gibi geçiyor | **kullanılmıyor** |
| `x-real-ip` | olduğu gibi geçiyor | **kullanılmıyor** |

Bu yüzden kimlik `true-client-ip` → `x-forwarded-for[0]` sırasıyla alınır. IP **ham olarak
saklanmaz**; yalnızca geri döndürülemez SHA-256 özetinin ilk 8 baytı (`gonderenOzet`) tutulur.

### Sınır neden bellekte değil

Sunucu route'u Cloudflare tabanlı worker'da çalışır; izolasyonlar bellek paylaşmaz. Sınır bu
yüzden **kalıcı depoya** dayanır: pencere içinde `gonderenOzet` ve normalleştirilmiş e-posta
(`epostaKey`) için kayıt sayısı sorgulanır, büyük olan sınırla karşılaştırılır.

### Ölçüm — sınır uygulanıyor ve kalkıyor

| Saat (UTC) | Deneme | Sonuç |
|---|---|---|
| 12:00–12:01 | aynı e-postayla 5 gönderim | 5× **200** (kayıt oluştu) |
| 12:01 | 6. gönderim | **429** `RATE_LIMIT`, `retryAfterMinutes: 15` |
| 12:01 | aynı adres, büyük harfli varyant | **429** (normalleştirme çalışıyor) |
| 12:01 | **farklı** e-posta | **200** — sınır herkesi kilitlemiyor |
| 12:17 | ilk adres yeniden denendi | **200** — *pencere dolduğu için sınır kendiliğinden kalktı* |

---

## 4. CAPTCHA — sunucuda doğrulama

- Site anahtarı ve gizli anahtar **yalnızca Wix sunucu ortam değişkenlerinde** tutulur
  (`wix env set`). `astro:env/server` → `getSecret()` ile çalışma anında okunur.
  Depoda, `.env.local`'de veya istemci paketinde **gizli anahtar yoktur**
  (`dist/` içinde yalnızca değişken *adı* geçer, değeri geçmez).
- Tarayıcı, site anahtarını `GET /api/talep-config` ucundan alır. Bu uç **gizli anahtarı asla
  döndürmez**; sağlayıcı kurulu değilse `{"captcha": null}` döner ve sayfa hiçbir betik yüklemez
  (tasarım aynen kalır).
- Sağlayıcı yalnızca **iki anahtar da** tanımlıysa etkin sayılır. Tek başına gizli anahtar
  tanımlanırsa tarayıcı token üretemeyeceği için form kilitlenirdi; bu durum kodda engellenmiştir.
- **Doğrulama başarısızsa Wix'e kayıt gönderilmez.**

### Ölçüm — yayımlanan önizleme üzerinde

| Yapılandırma | İstek | Sonuç | Koleksiyon |
|---|---|---|---|
| Gizli anahtar geçersiz | uydurma token | **403** `CAPTCHA` | kayıt sayısı **12 → 12** (değişmedi) |
| Google'ın yayımlanmış test anahtar çifti | token gönderildi | **200**, kayıt oluştu | **12 → 13** |
| Google'ın test gizli anahtarı | token **yok** | **403** `CAPTCHA` | değişmedi |

> Test anahtarları Google'ın belgelediği herkese açık test çiftidir; doğrulama turu bittikten
> sonra ortamdan kaldırılmıştır. Şu anki durumda sağlayıcı **kurulu değil**
> (`/api/talep-config` → `{"captcha": null}`), kayıtlarda `captchaDogrulandi: false` görünür.

### Ölçüm — ortam değişkeni ne zaman etkili olur

Değişken değiştirildikten sonra **çalışan dağıtım eski değeri görmeye devam ediyor**; yeni değer
ancak **yeni bir `wix preview` / `wix release`** ile etkili oluyor. (Değer değiştirilip aynı
dağıtım sorgulandı: eski değer döndü.)

---

## 5. Bildirim

Yeni otomasyon **site uygulamasının kimliğiyle** oluşturuldu:

- Ad: **C-suite · Yeni görüşme talebi (CMS)**
- Id: `b727e976-205b-4d68-b004-8eaf16c8f95b` · Durum: **ACTIVE** · `createdBy.appId = 2909f5b9-…`
- Eylem: daha önce çalışan bildirimle **aynı** tetiklenmiş e-posta eylemi
  (`appId 135c3d92-…`, `actionKey: triggered-emails`), alıcı kitle **site katkıda bulunanları**
  (site sahibi) rolü.
- Sunucu route'u onu `POST /automations/v1/events/run-automation` ile doğrudan çalıştırır.
- Gönderilen veri: taraf, ad soyad, şirket/mevcut kurum, e-posta, telefon, mesaj, **CMS kayıt no**
  ve **CMS koleksiyonuna bağlantı** (`…/dashboard/<siteId>/database/data/GorusmeTalepleri`).

### Ölçüm

| Deneme | Sonuç |
|---|---|
| Wix Forms'a ait eski otomasyonu çalıştırma | `activationId: ""` → **çalışmadı** (başka uygulamanın tetikleyicisi) |
| Tetikleyicisi başka uygulamaya çevrilen kopya | `activationId: ""` → **çalışmadı** |
| Tetikleyicisi kendi uygulamamıza ait olan yeni otomasyon | `activationId: "01db6b7b-…"` → **çalıştı** |
| Uçtan uca gönderim (İşveren) | `{"ok":true,"id":"…","notified":true}` |
| Uçtan uca gönderim (Aday) | `{"ok":true,"id":"…","notified":true}` |

> **Teslim kanıtı yoktur.** Wix, aktivasyonun kabul edildiğini bildirir; e-postanın
> `csuite04@gmail.com` kutusuna düştüğünü doğrulayan herkese açık bir uç bulunmadığı için
> **teslimi doğrulanmamıştır**. Gelen kutusu kontrolü ürün sahibindedir.

### Kayıt ile bildirim ayrı ele alınır

`notify()` ayrı `try/catch` içindedir. Bildirim başarısız olsa bile yanıt `{"ok":true, …,
"notified":false}` olur ve kullanıcıya **gönderim hatası gösterilmez** — aksi hâlde kullanıcı
tekrar gönderir ve mükerrer kayıt oluşurdu.

---

## 6. Eski Wix Forms yolunun kapatılması

1. **Ön yüz:** sayfada Wix Forms'a ait hiçbir çağrı kalmadı
   (`wixapis`, `oauth2`, `WIX_FORM_ID`, `csuite_vt` → 0 eşleşme).
2. **Anonim gönderim yolu fiilen kapatıldı** — yalnızca bağlantı kaldırılmadı:
   form `a5807409-660c-47c4-8a66-6cf43f5086d3` **devre dışı** bırakıldı
   (`enabled: false`, `properties.disabled: true`, revizyon 23 → 24).

### Ölçüm — kapatma öncesi ve sonrası (aynı anonim jeton yöntemiyle)

| Zaman | İstek | Sonuç |
|---|---|---|
| Kapatmadan önce | anonim `POST /form-submission-service/v4/submissions` | **200** — gönderim oluştu |
| Kapatmadan sonra | aynı istek | **400** · `DISABLED_FORM_ERROR: "Form is disabled and not accepting submissions"` |

3. **Eski TEST kayıtları korundu:** formun gönderimleri sorgulandı — **22 gönderim, hepsi
   `CONFIRMED`**, hiçbiri silinmedi.
4. **Eski otomasyon** (`7bc07c88-…`, `wix_form_app-form_submitted`) yeni bildirim doğrulandıktan
   **sonra** `INACTIVE` yapıldı. Geri almak için tek adım yeterlidir:
   `configuration.status` → `ACTIVE`.

---

## 7. Tasarımın korunduğunun ölçümü

- Sayfanın CSS bloğu kaynak dosyayla **bayt bayt aynı** (18.511 karakter, birebir eşit).
- `<body>` içeriği, yalnızca artık kullanılmayan **iki görünmez** Web3Forms alanı
  (`access_key`, `from_name`) çıkarılmış hâliyle kaynakla **aynı**. Görünür hiçbir öğe,
  metin, sıra veya `name` değeri değişmedi (alan adları kaynaktaki özgün hâline geri alındı).
- Yayımlanan sayfanın baytları, yerel dosyayla **aynı MD5**'e sahip.

### Piksel karşılaştırması (animasyonlar sabitlenerek, gerçek Poppins yüklenerek)

| Görünüm | Kaynak ↔ yayımlanan piksel farkı | Sayfa yüksekliği (kaynak/yayımlanan) |
|---|---|---|
| Masaüstü 1440×960 · İşveren | **0.0000 %** | 6037 / 6037 |
| Masaüstü 1440×960 · Aday | **0.0000 %** | 5840 / 5840 |
| Mobil 390×844 · İşveren | **0.0000 %** | 9011 / 9011 |
| Mobil 390×844 · Aday | **0.0000 %** | 8870 / 8870 |

Renk değişkenleri her görünümde `--red:#CF051E`, `--yellow:#F8BA3F`. İşveren/Aday geçişi
etiketleri ve buton metinlerini beklendiği gibi değiştiriyor
("Şirket *" / "Ön görüşme talep edin" ↔ "Mevcut kurum *" / "Gizli görüşme talep edin").

---

## 8. Tarayıcıda gerçek form akışı

Sayfanın kendi JavaScript'i ile, gerçek yayımlanmış route'a karşı:

| Senaryo | Sonuç |
|---|---|
| İşveren (masaüstü) | başarı mesajı, form sıfırlandı, buton "Gönderildi ✓" |
| Aday (mobil 390px) | başarı mesajı, form sıfırlandı, buton "Gönderildi ✓" |
| Geçersiz giriş | "Lütfen zorunlu alanları eksiksiz ve doğru doldurun." — **alanlar korundu**, buton yeniden denemeye açık |

Diğer uçlar: `GET /api/talep` → **405**, honeypot dolu → **400 `REJECTED`**.

---

## 9. Gizlilik ve sır yönetimi

- Sohbette hiçbir parola/gizli anahtar istenmedi.
- Gizli anahtarlar yalnızca Wix sunucu yapılandırmasında (`wix env set`) tutuldu; depoya ve
  `.env.local`'e girmedi (`.env.local` yalnızca herkese açık `WIX_CLIENT_ID` ve `WIX_SITE_ID`
  içerir ve `.gitignore`'dadır).
- Kod hiçbir jetonu veya kişisel veriyi loglamaz (`console.*` kullanılmaz); hata yanıtları
  yalnızca kısa kod döndürür (`VALIDATION`, `RATE_LIMIT`, `CAPTCHA`, `STORE_FAILED`).
- Ham IP saklanmaz.
- Doğrulama turunda kullanılan geçici, anahtarla korunmuş tanı uçları
  (`/api/adm`, `/api/diag`, `/api/verify`) **kaldırıldı** ve anahtarları ortamdan silindi;
  son önizlemede üçü de **404** döndürüyor.

---

## 10. Kapsam dışı bırakılanlar

- `wix release` çalıştırılmadı — yalnızca önizleme yayımlandı.
- Alan adı/DNS değiştirilmedi, ücretli hizmet satın alınmadı.
- Ek CRM entegrasyonu kurulmadı; üyelik, kullanıcı paneli, ödeme, aday havuzu eklenmedi.
- Eski TEST kayıtları silinmedi.

## 11. Ürün sahibinden beklenen tek adım

reCAPTCHA anahtarları Google hesabı gerektirir; bu yüzden onları **yalnızca ürün sahibi**
oluşturabilir. Anahtarlar hazır olduğunda ikisi de sunucu ortamına yazılır
(`RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY`) ve **yeni bir önizleme alınır** — kodda
değişiklik gerekmez; route CAPTCHA'yı o anda zorunlu kılmaya başlar.
