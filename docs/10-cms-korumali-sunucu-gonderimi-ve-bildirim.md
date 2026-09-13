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

## 4. CAPTCHA — durum ve yapılan testlerin gerçek koşulları

### 4.1 Testler hangi yapılandırmada alındı (düzeltme)

Önceki raporda "CAPTCHA testleri geçti" satırı, hangi anahtarla alındığını yeterince
belirtmiyordu. Kesin durum:

| Test | Kullanılan gizli anahtar | Doğrulama nasıl yapıldı | Sonuç |
|---|---|---|---|
| Geçersiz doğrulama | **Bilerek geçersiz** bir dize (`GECERSIZ-TEST-…`) | **Gerçek** `google.com/recaptcha/api/siteverify` çağrısı; Google `success:false` döndürdü | 403, kayıt oluşmadı |
| Token yok | Google'ın **yayımlanmış test gizli anahtarı** | Google'a hiç gidilmedi (token boş olduğu için route zaten reddediyor) | 403, kayıt oluşmadı |
| Geçerli doğrulama | Google'ın **yayımlanmış test gizli anahtarı** (`6LeIxAcT…`) | **Gerçek** siteverify çağrısı; test anahtarı **her tokena** `success:true`, `hostname:"testkey.google.com"` döndürür | 200, kayıt oluştu |

- **Taklit (mock) yanıt kullanılmadı**; her seferinde gerçek Google ucu çağrıldı.
- Ancak **gerçek sağlayıcı doğrulaması da yapılmadı**: kullanılan anahtar çifti Google'ın
  belgelediği, herkese açık **test** çiftidir ve her tokenı geçerli sayar. Yani "geçerli
  doğrulama" testi, sözleşmenin ve kod yolunun çalıştığını gösterir; **gerçek bir bot/insan
  ayrımının çalıştığını göstermez.**
- Bu testler, C-suite hesabına ait **hiçbir gerçek reCAPTCHA anahtarıyla** yapılmamıştır.

### 4.2 Güncel önizlemenin durumu — açıkça

Doğrulama turundan sonra test anahtarları ortamdan kaldırıldı. Bu yüzden **son yayımlanan
önizlemede CAPTCHA koruması YOKTUR**:

- `GET /api/talep-config` → `{"captcha": null}`
- Anahtar tanımlı olmadığı için **gönderim CAPTCHA olmadan kabul edilir** ve kayıt oluşur
  (`captchaDogrulandi: false`).
- Bu durum **"CAPTCHA koruması etkin" olarak raporlanmamalıdır.** Şu an etkin olan koruma
  yalnızca: honeypot + alan doğrulama + süreli gönderim sınırı.

### 4.3 Kodun beklediği sözleşme (kesinleştirildi)

- **Tür/sürüm:** Google reCAPTCHA **v3 — "Score based (v3)"**, klasik reCAPTCHA
  (**Enterprise değil**, Cloud projesi gerekmez).
- **Tarayıcı:** `https://www.google.com/recaptcha/api.js?render=<SITE_KEY>` →
  `grecaptcha.execute(SITE_KEY, { action: 'talep' })`.
- **Sunucu:** `POST https://www.google.com/recaptcha/api/siteverify`,
  gövde `secret=<SECRET_KEY>&response=<token>`.
  Yanıt: `success`, `score`, `action`, `challenge_ts`, `hostname`, `error-codes`.
- **`remoteip` gönderilmez** — ziyaretçinin IP'si üçüncü tarafa aktarılmaz (alan isteğe bağlı).

### 4.4 Sunucuda uygulanan denetimler (bu pakette eklendi)

Aşağıdakilerin **hepsi** geçmezse kayıt oluşmaz:

1. `success === true` — token geçerli ve daha önce kullanılmamış.
2. `action === 'talep'` — başka bir sayfadan/eylemden alınan token kabul edilmez.
3. `hostname` **tam eşleşme** — joker yok, ortak ana alan adı yok. İzinli olan tek şey
   isteğin geldiği bu sitenin TAM konak adı; ek adresler `RECAPTCHA_ALLOWED_HOSTS`
   içine **tam konak adı** olarak virgülle yazılır. Böylece başka bir Wix sitesinde
   çözülmüş token kabul edilmez.
4. `challenge_ts` tazeliği ≤ 2 dakika — eski token tekrar oynatılamaz.
5. `score ≥ eşik` — öntanımlı 0.5, `RECAPTCHA_MIN_SCORE` ile değiştirilebilir.

### 4.5 Artık fail-open yok

Önceki davranış: anahtar tanımlı değilse gönderim sessizce kabul ediliyordu.
**Kaldırıldı.** Yeni davranış:

| Durum | Yanıt | Kayıt |
|---|---|---|
| Anahtar çifti tanımlı değil | **503 `CAPTCHA_NOT_CONFIGURED`** | oluşmaz |
| Token yok / geçersiz / action, hostname, tazelik veya puan denetimi başarısız | **403 `CAPTCHA`** | oluşmaz |

Her iki durumda da kullanıcıya anlaşılır Türkçe hata gösterilir, **form alanları korunur** ve
buton yeniden denemeye açık kalır. Test amaçlı hiçbir atlatma (bypass) kodda bırakılmamıştır.

### 4.6 Sağlayıcı kurulunca görünürlük

Sağlayıcı kurulu olmadığı sürece sayfa **hiçbir reCAPTCHA betiği yüklemez** ve tasarım birebir
aynı kalır (ölçüldü: masaüstü/mobil, İşveren/Aday → %0.0000 piksel farkı). Kurulduğunda
reCAPTCHA v3 görünmez çalışır; yüzen rozet gizlenir ve Google'ın zorunlu kıldığı kısa atıf
metni, formun **zaten var olan** açıklama satırının altına eklenir (düzeni değiştirmez).

### 4.7 Ortam değişkeni ne zaman etkili olur (ölçüldü)

Değişken değiştirildikten sonra **çalışan dağıtım eski değeri görmeye devam ediyor**; yeni değer
ancak **yeni bir `wix preview` / `wix release`** ile etkili oluyor.

### 4.9 Anahtarlar nereden okunuyor — Secrets Manager doğrulandı

İki depo aynı şey değildir ve kod ikisini ayrı ele alır:

| Depo | Nasıl okunuyor | Değişiklik ne zaman etkili |
|---|---|---|
| **Wix Secrets Manager** (pano) | `auth.elevate(secrets.getSecretValue)(ad)` — `@wix/secrets` | **Çalışma anında** — yeniden dağıtım gerekmez (≤ 60 sn önbellek) |
| CLI ortam değişkeni (`wix env set`) | `astro:env/server` → `getSecret()` | Yalnızca **yeni dağıtımda** (ölçüldü) |

Sıra: önce Secrets Manager, bulunamazsa ortam değişkeni.

**Erişim kanıtı (gizli değer hiçbir yere yazdırılmadan).** Yayımlanan route'a geçici,
anahtarla korunmuş bir uç konularak ölçüldü: uç, rastgele bir değerle `CSUITE_SM_PROBE`
adında bir secret **oluşturdu**, aynı istekte `getSecretValue` ile **geri okudu** ve değerin
birebir aynı olduğunu **yalnızca doğru/yanlış olarak** bildirdi; ardından secret silindi.

```
{ "olusturuldu": true, "okundu": true, "degerEslesti": true,
  "listelenebiliyor": true, "vadidekiAdlar": ["CSUITE_SM_PROBE"] }
…ikinci çağrı: { "silindi": true, "silmeSonrasiAdlar": [] }
```

Secret çalışma anında oluşturulup aynı anda okunabildiği için, **panodan eklenen değer de
çalışan dağıtım tarafından görülür** — bu yüzden anahtarlar girildikten sonra yeni bir
önizleme almak gerekmez ve **önizleme adresi değişmez.** Doğrulama ucu kaldırıldı; son
önizlemede `404` dönüyor.

Sürekli kullanılabilen, değer sızdırmayan kontrol: `GET /api/talep-config` →
`{"yapilandirma":{"siteKey":"secrets-manager|env|null","secret":"secrets-manager|env|null"}}`.

### 4.8 Wix'in kendi CAPTCHA'sı neden kullanılamıyor

Wix'in `POST /captcharator/api/v1/authorize` ucu resmî belgesinde açıkça
*"works with the Wix reCAPTCHA element … If you're developing a Wix site or a Blocks app"*
diyor. Bu, Velo/`$w` ön yüz bileşenine bağlıdır; Wix Managed Headless'ta sunduğumuz statik
sayfada böyle bir bileşen yoktur. Bu yüzden Google reCAPTCHA v3 seçildi.

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

## 11. Gerçek sağlayıcı anahtarlarıyla canlı doğrulama (13 Eylül 2026, 13:25–13:40 UTC)

Ürün sahibi reCAPTCHA anahtarlarını **Wix Secrets Manager**'a ekledi. Aşağıdakilerin tamamı,
yayımlanan önizleme `zbhson-csuite-headless-csuite04-0f08.wix-site-host.com` üzerinde,
**yeniden dağıtım yapılmadan** ölçüldü.

### 11.1 Yapılandırma

```
GET /api/talep-config
{"captcha":{"provider":"recaptcha-v3","action":"talep","siteKey":"…"},
 "yapilandirma":{"siteKey":"secrets-manager","secret":"secrets-manager"}}
```

İki anahtar da **Secrets Manager**'dan okunuyor (ortam değişkeninden değil). Gizli değer
hiçbir çıktıya yazılmadı; yalnızca kaynak bilgisi döndü.

### 11.2 Gerçek gönderim kabul edildi

Ürün sahibinin tarayıcıdan yaptığı İşveren gönderimi CMS'te bulundu:

| Alan | Değer |
|---|---|
| Kayıt no | `f07a18f4-7e56-4936-887c-123f3e0b1b81` |
| Tarih | `2026-09-13T13:25:57Z` |
| Taraf | **İşveren** |
| Etiket (mesaj) | `CSUITE-TEST-FINAL-0913-K482` |
| Kaynak | `web` |
| **captchaDogrulandi** | **true** |
| gonderenOzet | var (ham IP saklanmıyor) |

`captchaDogrulandi: true` yalnızca şu denetimlerin **hepsi** geçtiğinde yazılır:
`success` + `action === 'talep'` + `hostname` = bu önizlemenin tam konak adı +
`challenge_ts` ≤ 2 dk + `score` ≥ 0.5. Yani bu, **gerçek sağlayıcı doğrulamasıdır** —
test anahtarı ya da taklit yanıt değil.

### 11.3 Negatif testler — gerçek anahtarlar kuruluyken

Ürün sahibinin gönderiminden sonra, aynı yayımlanan uca:

| Deneme | Yanıt | CMS kaydı |
|---|---|---|
| `captchaToken` yok | **403 `CAPTCHA`** | yok |
| Uydurma `captchaToken` (gerçek siteverify çağrısı yapıldı) | **403 `CAPTCHA`** | yok |
| Honeypot dolu | **400 `REJECTED`** | yok |
| Eksik/geçersiz alanlar | **400 `VALIDATION`** | yok |

Dört etiketin de CMS'te araması **0 kayıt** döndü; koleksiyon toplamı **24**'te kaldı.

### 11.4 Bildirim aktivasyonu

Otomasyon `b727e976-205b-4d68-b004-8eaf16c8f95b` — **"C-suite · Yeni görüşme talebi (CMS)"**,
durum **ACTIVE**, `createdBy.appId = 2909f5b9-…`, eylem `triggered-emails`.
Ürün sahibinin kaydının verisiyle çalıştırıldı ve gerçek bir aktivasyon üretildi:
`activationId = 14fbf74b-9a80-4e26-9715-3c4db964517b`.

> **Sınır:** Bu bir **aktivasyon**tır, e-posta **teslimatı değildir**; ayrıca ürün sahibinin
> kendi gönderiminin aktivasyon ürettiği geriye dönük doğrulanamaz, çünkü route'un
> döndürdüğü `notified` değeri kayda yazılmıyor. Kayda `bildirimAktivasyonId` eklemek
> mümkündür; bu, yeni bir dağıtım (dolayısıyla yeni önizleme adresi) gerektirir.

### 11.5 Doğrulama nasıl yapıldı

Yayımlanan önizlemeye **hiçbir tanı ucu eklenmedi ve yeniden dağıtım yapılmadı** — böylece
Google'a kaydedilen konak adı değişmedi. CMS ve otomasyon okumaları, `wix dev` ile çalıştırılan
**yerel** geliştirme sunucusundaki, yalnızca `import.meta.env.DEV` altında çalışan geçici
uçlarla yapıldı; bu uçlar doğrulamadan sonra silindi. Yerel geliştirme için çekilen kimlik
bilgileri `.env.local`'den geri alındı; reCAPTCHA gizli değeri hiçbir aşamada okunmadı ve
diskte bırakılmadı.

## 12. Bildirim e-postasının gitmemesi — kök neden ve düzeltme (13 Eylül 2026, 14:00 UTC)

### 12.1 Belirti

Aktivasyonlar kabul ediliyordu (`activationId` dolu geliyordu) ama `csuite04@gmail.com`
kutusuna e-posta düşmüyordu. **Aktivasyon kabulü, e-posta gönderimi değildir.**

### 12.2 Aktivasyon sonucu okunabiliyor mu

Hayır. Aktivasyonun eylem sonucunu döndüren herkese açık bir uç bulunamadı; denenen sekiz
aday yol (`/automations/v1/activations/*`, `/automations-service/v2/activations/*`,
activity-log varyantları) **404** döndürdü. Yalnızca `RerunActivation` belgelenmiş.
Bu yüzden tanı, yapılandırma üzerinden yapıldı.

### 12.3 Kök neden

`triggered-emails` eyleminin **çağrı (invoke) şeması** resmî eylem kataloğundan okundu
(`POST /v1/actions/resolve`, app `135c3d92-…`). Şemanın kabul ettiği alanlar:

```
sendToUnsubscribed, transactional, uniqueRuleId, dynamicParams, templateId,
disabledAttachments, senderDetailsId, contactId, messageId, notificationTopicId
```

- **`contactId` → "The id of the contact to receive the mail"** — alıcıyı belirleyen alan budur.
- **`selectedAudience` şemada YOKTUR.** O, otomasyon düzenleyicisinin arayüz verisidir;
  eylemi çağırırken kullanılmaz.

Otomasyonu Wix Forms otomasyonundan kopyalarken `contactId` alınmamıştı (Forms onu
`{{var("contactId")}}` ile kendi tetikleyici yükünden dolduruyordu; bizim tetikleyicimizde
böyle bir değişken yok). Sonuç: **eylem çalıştı ama alıcısı yoktu → e-posta üretilmedi.**
Şablon tarafında sorun yoktu: kampanya `5e6485f3-…` **ACTIVE**, tür `AUTOMATION`,
yayımlanma 09:33:13Z.

### 12.4 Düzeltme (dağıtım gerektirmedi)

Otomasyon `b727e976-…` eyleminin `inputMapping` alanına eklendi (revizyon 3 → 4):

| Alan | Değer |
|---|---|
| `contactId` | `d90c4b1d-a3b8-4285-a2c4-f1273bc6d846` — **csuite04@gmail.com** kişisi (Contacts API ile bulundu, yeni kişi oluşturulmadı) |
| `uniqueRuleId` | yeni UUID (istatistik toplama alanı; şemanın alternatif zorunlusu) |
| `transactional` | `true` |
| `sendToUnsubscribed` | `true` — kişinin abonelik durumu boş olduğu için gönderimi engellemesin |

Kod değişmedi, yeni önizleme alınmadı; bu yüzden **Google'a kaydedilen konak adı aynı kaldı.**

### 12.5 E-postanın gerçek konusu

Kampanyanın konu satırı **otomasyonun adı değildir**:

```
emailSubject = "${formName} got a new submission"
```

Yani konu, route'un gönderdiği `formName` değerinden üretilir. Konu metni bu API yüzeyinden
değiştirilemiyor (kampanya güncelleme uçları 404); değiştirilmesi gerekirse panodan yapılır.

### 12.6 Kontrollü test (tek sefer)

| | |
|---|---|
| Gönderim zamanı | **2026-09-13 14:03:51 UTC** |
| Aktivasyon | `d1eaa990-1b2e-4e29-8b65-890a08c437b5` |
| Alıcı | **csuite04@gmail.com** (kişi `d90c4b1d-…`) |
| Beklenen konu | `C-suite · Yeni görüşme talebi (İşveren) · CSUITE-BILDIRIM-TEST-0913-N1 got a new submission` |
| Gövdeye konan etiket | `CSUITE-BILDIRIM-TEST-0913-N1` (ilk alan olarak) |

Etiket hem konuya (`formName` üzerinden) hem gövdeye (`submissions[0]`) konuldu; böylece
şablonun gövdedeki alan listesini gerçekten işleyip işlemediği de görülebilir.

### 12.7 Açık kalan

Form route'unun bildirimi **kendiliğinden** tetiklediği, elle çalıştırmadan ayrı olarak
doğrulanacak: gerçek bir form gönderimi sonrası e-postanın gelmesi tek geçerli kanıttır.
Route, otomasyonu aynı `run-automation` çağrısıyla tetikliyor; düzeltme otomasyon
yapılandırmasında olduğu için kodda değişiklik gerekmedi.

## 13. Bildirim teslimatı — ikinci tur teşhis (13 Eylül 2026, 14:20–14:45 UTC)

### 13.1 Önceki kök neden açıklaması geri çekiliyor

"Eylem çalıştı, alıcısı olmadığı için e-posta üretilmedi" **kanıtlanmış bir nedensellik
değildi**; elimdeki tek kanıt `contactId` alanının eksik olmasıydı. Alan eklendikten sonra da
teslimat olmadı. Aşağıdaki ölçümler gerçek nedeni gösteriyor.

### 13.2 Belgelenmiş uçlarla yapılan kontroller

| Kontrol | Uç (resmî dokümandan) | Sonuç |
|---|---|---|
| E-posta kotası | `GET /email-marketing/v1/account-details` | Paket **Free200**, aylık 200 e-posta, **kullanım 0** — kota dolu değil |
| Gönderici ayrıntıları | `GET /sender-details/v1/sender-details` | **boş liste** — tanımlı gönderici yok |
| Gönderici e-postaları | `GET /sender-emails/v1/sender-emails` | **boş liste** — doğrulanmış "gönderen" adresi yok |
| Alıcı kişi | `GET /contacts/v4/contacts/{id}` | `csuite04@gmail.com`, **birincil**, tam eşleşme |
| Abonelik durumu | aynı yanıt | **tanımsız (boş)** — *abonelikten çıkılmış değil*; ayrıca `sendToUnsubscribed: true` |
| Geri dönme / şikâyet | kampanya istatistikleri | `bounced: 0`, `complained: 0`, `notSent: 0` |
| Şablon | `GET /email-marketing/v1/campaigns/{id}` | **ACTIVE**, tür `AUTOMATION`, yayımlanmış |

### 13.3 Ayırt edici teşhis: kampanya istatistikleri

`GET /email-marketing/v1/campaigns/statistics?campaignIds=…` ve
`…/statistics/recipients?activity=…` ile ölçüldü:

- **`run-automation` ile üretilen beş aktivasyonun hiçbiri** e-posta servisinde iz bırakmadı:
  `delivered`, `bounced`, `notSent` hiç değişmedi. Yani **eylem hiç çalışmadı** — aktivasyon
  kabul edilip düşüyor. Bu, otomasyonun tetikleyici anahtarının kayıtlı olmamasıyla
  (`ValidateAutomation` → `TRIGGER_NOT_FOUND`) tutarlı.
- Buna karşılık **Wix Forms tetikleyicisiyle** yapılan gönderimler her seferinde ~9 saniye
  içinde teslimat kaydı üretti: **12:18:19Z, 14:36:03Z, 14:39:09Z**.

**Yani e-posta zinciri çalışıyor; çalışmayan şey, kayıtlı olmayan özel tetikleyiciyle
çağrılan otomasyondu.**

### 13.4 Yeni bulgu: alıcı kişi mevcut değil

Kampanyanın **tek** teslimat alıcısı `413c042d-3638-3b27-a626-6a5107c83d0f`.
`GET /contacts/v4/contacts/413c042d-…` → **404 `CONTACT_NOT_FOUND`**.
Yani tetiklenen e-postalar **var olmayan bir kişiye** adresleniyor; hiçbir gerçek gelen
kutusuna ulaşmıyor. Forms otomasyonunun `contactId` alanını site sahibinin gerçek kişisine
(literal `d90c4b1d-…`) çevirmek bunu **değiştirmedi**: 14:39 teslimatı yine aynı var olmayan
kişiye gitti. Alıcı, eylemin `inputMapping` alanından değil, tetikleyici bağlamından
çözülüyor ve burada bozuk çözülüyor.

### 13.5 Kişiden bağımsız, belgelenmiş gönderim yolu

`POST /email-marketing/v1/campaigns/{campaignId}/test` (**Send Test**) alıcıyı
`toEmailAddress` ile **doğrudan** alır — kişi çözümlemesi yoktur — ve konu satırı
`emailSubject` ile verilebilir.

### 13.6 Bu turda gönderilen e-postalar (üçü de kayıt altında)

| Zaman (UTC) | Yol | Alıcı | Konu | Sağlayıcı yanıtı |
|---|---|---|---|---|
| 14:34:22 | **Send Test** (kişiden bağımsız) | `csuite04@gmail.com` (doğrudan adres) | `C-suite bildirim kanali testi — CSUITE-MAIL-0913-T2` | **HTTP 200**, gövde `{}` (belgelenen `SendTestResponse` boştur) |
| 14:35:50 | Forms tetikleyicisi | var olmayan kişi `413c042d-…` | `C-suite · Görüşme Talebi got a new submission` | teslimat kaydı 14:36:03Z |
| 14:39:00 | Forms tetikleyicisi | var olmayan kişi `413c042d-…` | aynı | teslimat kaydı 14:39:09Z |

Yalnızca **ilk satırdaki** e-postanın gelen kutusuna ulaşması beklenir; diğer ikisi var olmayan
kişiye adreslendi.

### 13.7 Dinlenme durumu

- Forms otomasyonu `7bc07c88-…`: `contactId` özgün hâline (`{{var("contactId")}}`) geri alındı,
  durum **INACTIVE** (sürpriz e-posta üretmesin).
- Özel tetikleyicili otomasyon `b727e976-…`: durum **INACTIVE** (hiç çalışmıyor).
- Form `a5807409-…`: **devre dışı kalmaya devam ediyor** — anonim gönderim hâlâ reddediliyor.
  Ölçüldü: form devre dışıyken bile **uygulama kimliğiyle** gönderim HTTP 200 veriyor;
  yani gerekirse sunucu route'u bu kanalı anonim yolu açmadan kullanabilir.
- CMS, CAPTCHA, tasarım ve yayımlanan önizleme **değişmedi**; yeni dağıtım yapılmadı.

## 14. Kurulum adımı (tamamlandı)

### 11.1 Araç erişimi değerlendirildi

Bu oturumdaki bağlayıcılar tarandı: **Google Drive (yalnızca dosya), GitHub, Claude Code
Remote**. reCAPTCHA/Google Cloud yönetim aracı **yok**; `wix` MCP sunucusu yetkilendirilmemiş.
Wix CLI oturumu site ortam değişkeni yazabiliyor ama Google tarafında anahtar **üretemiyor**.
Bu yüzden anahtar üretimi ürün sahibinin Google oturumunu gerektiriyor — araç erişimi
denetlendikten sonra varılan sonuç.

### 11.2 Anahtarları oluşturma

1. https://www.google.com/recaptcha/admin/create
2. **Label:** `C-suite`
3. **reCAPTCHA type:** **Score based (v3)** — v2 veya Enterprise değil.
4. **Domains:** ortak ana alan adı **kullanılmayacak**. Yalnızca şu **tam konak adı**:

   ```
   zbhson-csuite-headless-csuite04-0f08.wix-site-host.com
   ```

   Bu adres, anahtarlar panodan girildiğinde **değişmez** (§4.9: panodan eklenen secret
   çalışan dağıtımca okunuyor, yeniden dağıtım gerekmiyor). İleride yeni bir dağıtım
   adresi ya da bağlanan bir alan adı olursa aynı ekrana eklenir ve sunucuda
   `RECAPTCHA_ALLOWED_HOSTS` içine tam konak adı olarak yazılır.
5. Submit → **Site key** ve **Secret key**.

### 11.3 Anahtarları güvenli ekrana girme (terminal yok, sohbete yazılmaz)

1. `https://manage.wix.com/dashboard/72b257e3-0db0-4579-8795-64e51b3f42a6`
2. **Developer Tools › Secrets Manager › Add Secret**
3. Adlar birebir:
   - `RECAPTCHA_SITE_KEY` → Site key
   - `RECAPTCHA_SECRET_KEY` → Secret key

Bu ekranın yayımlanan route tarafından gerçekten okunabildiği §4.9'da ölçülerek doğrulandı.

### 11.4 Sonrası

"İkisini de ekledim" bilgisi geldiğinde (≤ 60 sn içinde etkili olur) doğrulanacak:
geçerli gönderimin kaydedilmesi, eksik/geçersiz doğrulamada kayıt oluşmaması, bildirim
aktivasyonunun üretilmesi. Kodda değişiklik ve yeni dağıtım gerekmiyor.
