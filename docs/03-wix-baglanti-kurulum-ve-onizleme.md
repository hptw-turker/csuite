# İş Paketi 2 — Wix Bağlantısı, Kurulum ve Önizleme

**Tarih:** 2026-09-13
**Kapsam:** Bağlantı doğrulama → Managed Headless kurulumu → form bağlantısı → önizleme
**Kapsam dışı (bilerek yapılmadı):** ücretli paket, alan adı, **canlı yayın (`wix release`)**

---

## 1. Önizleme bağlantısı

**https://zipdbh-csuite-headless-csuite04-0f08.wix-site-host.com**

Pano: `https://manage.wix.com/dashboard/72b257e3-0db0-4579-8795-64e51b3f42a6`

> Wix her `wix preview` çağrısında **yeni bir sürüm URL'i** üretir. Yukarıdaki, bu turun son sürümüdür.

---

## 2. Ağ erişimi — çözüldü

Önceki turda tüm `wix.com` alan adları 403 veriyordu. Ayar güncellendikten sonra:

| Alan adı | Önce | Sonra |
|---|---|---|
| `manage.wix.com` | ❌ 403 | ✅ 301 |
| `www.wix.com` | ❌ 403 | ✅ 200 |
| `dev.wix.com` | ❌ 403 | ✅ 200 |
| `users.wix.com` | ❌ 403 | ✅ 301 |
| `mcp.wix.com` | ❌ 403 | ✅ 302 |
| `www.wixapis.com` | ❌ 403 | ✅ 404 (erişilebilir) |
| `static.parastorage.com` | ❌ 403 | ✅ 200 |
| `editor.wix.com` | ❌ 403 | ✅ 301 |

---

## 3. Hesap doğrulaması (salt okunur)

```
wix login  → device-code akışı, kullanıcı tarayıcıda onayladı
wix whoami → Logged in as csuite04@gmail.com
```

| Öğe | Değer |
|---|---|
| Hesap | `csuite04@gmail.com` |
| userId | `3f5825f9-39c0-4a18-8f2e-e6975c46f01f` |
| **Bağlantı öncesi mevcut site sayısı** | **0** (boş hesap — bozulacak bir şey yoktu) |

Hesapta hiçbir mevcut varlık değiştirilmedi.

---

## 4. Kurulan proje

| Öğe | Değer |
|---|---|
| Dizin | `csuite-headless/` |
| Komut | `npm create @wix/new@latest init` |
| `siteId` | `72b257e3-0db0-4579-8795-64e51b3f42a6` |
| `appId` (= public clientId) | `2909f5b9-3dce-4e1a-b91f-728e47938e4e` |
| `site.outputDirectory` | `./dist` |
| Giriş dosyası | `dist/index.html` |

> **Not:** İlk `init` denemesi `"The business name cannot contain 'wix'"` hatasıyla reddedildi —
> iş adı dizin adından türetiliyor. Dizin `wix-site` → `csuite-headless` olarak değiştirildi.

### CLI komut yüzeyi — proje bağlamında

Önceki raporun düzeltmesi burada da doğrulandı. Proje dizininde:

```
dev       Open the Local Editor that runs your local code
preview   Create a preview version of your application
release   Release a new version of your application
```

`release` **mevcut ve çalışır durumda** — bu turda bilerek **çağrılmadı** (canlı yayın kapsam dışı).

---

## 5. Tasarım sadakati — kanıtlanmış

İlk `wix preview` sonrası, yayındaki sayfa kaynak dosyayla **bayt bayt karşılaştırıldı**:

```
kaynak  : 75.434 bayt   sha256 d176d71af3c620d0…
yayında : 75.434 bayt   sha256 d176d71af3c620d0…
SONUÇ   : BİREBİR AYNI
```

Form bağlantısı yapıldıktan sonra da **görsel katman hiç değişmedi**:

| Katman | Durum |
|---|---|
| `<style>` bloğu (18.511 karakter) | ✅ **Bayt bayt aynı** |
| Görünür gövde markup'ı | ✅ Değişmedi |
| Değişen tek şey | 5 `name` özniteliği + 2 gizli input kaldırıldı + `<script>` gönderim mantığı |

Değişikliklerin tamamı **görünmez**: `name` öznitelikleri ve `type="hidden"` alanlar
hiçbir piksel etkilemez.

---

## 6. Wix Forms bağlantısı

### 6.1 Kurulum

Wix Forms uygulaması kuruldu (`appDefId 225dd912-…`, HTTP 200, `installed: true`).

Form şeması: **`a5807409-660c-47c4-8a66-6cf43f5086d3`** — "C-suite · Görüşme Talebi"

| Tasarımdaki alan | Şema `target` | `identifier` | Zorunlu |
|---|---|---|---|
| Ad Soyad | `first_name` | `CONTACTS_FIRST_NAME` | ✅ |
| Şirket / Mevcut kurum | `company` | `CONTACTS_COMPANY` | ✅ |
| E-posta | `email` | `CONTACTS_EMAIL` | ✅ |
| Telefon | `phone` | `CONTACTS_PHONE` | ➖ isteğe bağlı |
| Mesaj | `message` | `TEXT_AREA` | ✅ |
| **Taraf (İşveren/Aday)** | `taraf` | `TEXT_INPUT` | ✅ |

`first_name`, `company`, `email`, `phone` alanları Wix Kişiler'e (CRM) eşlendi.

**Doğrulama (tarifin zorunlu adımları):**
- Liste okuması: 1 form, 1 adım, **7 alanın tamamı yerleşmiş**
- `summary.fields`: **tam 6 input** (pano gerçeği — form boş açılmayacak)
- Zorunluluk bayrakları geri okundu: 5 zorunlu + 1 isteğe bağlı — gönderilenle **birebir**

> İki hata bu doğrulama sayesinde yakalandı ve düzeltildi:
> `submitSettings` eksik `thankYouMessageOptions`, ve e-posta alanının
> `validation.format: "EMAIL"` zorunluluğu.

### 6.2 Ön yüz bağlantısı

Tarif, şema-güdümlü render'ı varsayılan sayar ama açık bir istisna tanımlar:

> "The ONLY exception is a brief that is **explicitly design-led** — the visual design is the whole
> point… There you may hardcode `<input name="<target>">`, but **read the actual `target`s from the
> schema — never guess**."

Bu iş paketi tam olarak o istisnadır (tasarım esas, pano düzenlenebilirliği istenmedi). `target`
değerleri **şemadan okundu**, tahmin edilmedi.

Akış: public `clientId` → anonim ziyaretçi token (`/oauth2/token`, `grantType: anonymous`) →
`POST /form-submission-service/v4/submissions`. Sunucu, arka uç veya gizli anahtar yok.
Token istemcide önbelleğe alınıyor (4 saat).

---

## 7. Tarayıcı testleri — gerçekten koşuldu

Chromium bu ortamda ajan vekilini kullanamıyor (`ERR_PROXY_CONNECTION_FAILED`; ham CONNECT
zinciri de reddedildi). Politikayı **aşmaya çalışmadım**. Bunun yerine yayındaki sayfa indirilip
yerelde sunuldu; API ve font çağrıları **aynı onaylı vekil üzerinden** iletildi. JS mantığı
gerçek API yanıtlarına karşı çalıştı.

| # | Test | Sonuç |
|---|---|---|
| 1 | Sayfa yükleniyor | ✅ HTTP 200, başlık doğru |
| 2 | **Poppins gerçekten render ediliyor** | ✅ `true` — **13 font face yüklü** (glif genişliği ölçümü) |
| 3 | Persona geçişi | ✅ `Şirket*`→`Mevcut kurum*`, `taraf` `İşveren`→`Aday`, 5+5 blok |
| 4 | Buton metni değişimi | ✅ `Ön görüşme talep edin` → `Gizli görüşme talep edin` |
| 5 | **Zorunlu alan doğrulaması** | ✅ Boş form gönderilemedi |
| 6 | **Aday olarak gönderim** | ✅ Başarı kutusu çıktı, form sıfırlandı |
| 7 | **İşveren olarak gönderim** | ✅ Başarı kutusu çıktı |
| 8 | **Tekrar gönderim davranışı** | ✅ 4 sn sonra buton eski metnine döndü, `disabled=false` |
| 9 | **Hata dalı** | ✅ Geçersiz formId → HTTP 404, hata yolu tetiklendi |
| 10 | Token önbelleği | ✅ 2 gönderim için **tek** `/oauth2/token` çağrısı |
| 11 | Mobil menü (390×844) | ✅ Açılıyor |
| 12 | Mobil sabit CTA | ✅ Doğru noktada görünüyor |
| 13 | Scroll reveal | ✅ Çalışıyor |
| 14 | Konsol hataları | ✅ Yalnızca 9. testin kasıtlı 404'ü |

Ekran görüntüleri: `docs/img/onizleme-desktop.png`, `docs/img/onizleme-mobil.png`

---

## 8. ⚠️ DOĞRULANAMAYAN: gönderimlerin panoya kaydı ve e-posta bildirimi

**Bunu başarılı saymıyorum.**

Gönderim API'si her seferinde **HTTP 200** döndürdü ve gerçek submission id üretti — ancak
sahip tarafından **hiçbiri okunamıyor**:

| Kontrol | Sonuç |
|---|---|
| `POST /submissions` (create) | ✅ HTTP 200, id üretildi, `status: PENDING` |
| `POST /submissions/{id}/confirm` | ✅ HTTP 200, `status: CONFIRMED` oldu |
| `GET /submissions/{id}` (onaylanmış) | ❌ **HTTP 404 — Entity not found** |
| `POST /submissions/query` (formId ile) | ❌ **0 kayıt** |
| `POST /submissions/query` (yalnız namespace) | ❌ **0 kayıt** |
| `POST /submissions/count` | ❌ **`formsSubmissionsCount: []`** |

Resmî doküman ([Submission status](https://dev.wix.com/docs/api-reference/crm/forms/form-submissions/introduction.md)):

> `CONFIRMED` — "The submission is recorded and visible to the Wix user.
> **Most namespaces, including Wix Forms, create submissions this way.**"
> `PENDING` — "isn't recorded yet and isn't shown to the Wix user… is **deleted automatically**
> if it isn't confirmed in time."

Bizim Wix Forms gönderimlerimiz dokümanın aksine `PENDING` dönüyor, ve elle `CONFIRMED`
yapıldıktan sonra bile okunamıyor.

**En olası neden:** site yalnızca **önizlemede**; hiç **yayımlanmadı** (`wix release`
çağrılmadı, kapsam dışı). Wix Forms'un kayıtları canlı siteye bağlaması beklenir.
Bunu doğrulamak için yayına almak gerekiyordu — **bilerek yapmadım**.

Uygulama sağlama sorunu elendi: Forms app `installed: true`, `enabled: true`.

**Sonuç olarak doğrulanmamış kalanlar:**
1. Gönderimin Wix panosunda görünmesi
2. E-posta bildirimi gitmesi
3. Kişinin Wix CRM'e yazılması

Bu üçü **yayın sonrası ilk turda** doğrulanmalıdır.

---

## 9. Üretilen test kayıtları

Tümü **açıkça TEST etiketli kurmaca veri** (`test@example.com` — IANA'nın test için ayırdığı,
teslim edilemeyen alan adı). Gerçek kişi verisi kullanılmadı, gerçek e-posta gönderilmedi.

| Kaynak | Adet | Etiket |
|---|---|---|
| Doğrudan API testi | 2 | `TEST KAYIT - Otomatik Dogrulama` |
| Tarayıcı testi | 2 | `TEST KAYIT - Tarayici Aday / Isveren` |
| Confirm akışı testi | 1 | `TEST - Confirm Denemesi` |

Hiçbiri sahip tarafından okunabilir durumda değil (Bölüm 8). Yayın sonrası görünürlerse
silinmeleri gerekir.

---

## 10. Açık kalan engeller

| # | Konu | Durum |
|---|---|---|
| 1 | Gönderimlerin panoya kaydı | ❌ Doğrulanamadı — muhtemelen yayın gerekiyor |
| 2 | E-posta bildirimi | ❌ Doğrulanamadı (1'e bağlı) |
| 3 | Ücretsiz pakette Wix reklam bandı | ❓ Önizlemede görülmedi; canlı yayında teyit gerekir |
| 4 | Wix Forms ücretsiz paket alan sınırı | ✅ 6 input sorunsuz kabul edildi |
| 5 | Chromium ↔ ajan vekili | ⚠️ Ortam kısıtı; yerel düzenekle aşıldı, politika aşılmadı |

**Ücretli paket gerektiren bir işlemle karşılaşılmadı.** Kurulum, form oluşturma, gönderim ve
önizlemenin tamamı mevcut ücretsiz hesapta çalıştı.

---

## 11. Sonraki adım için öneri

Gönderim kaydını doğrulamanın tek yolu siteyi bir kez yayına almaktır (`wix release`).
Bu, ücretli paket gerektirmez ve alan adı değiştirmez — yalnızca sitenin Wix alt alan adında
canlıya çıkmasıdır. **Onayınız olmadan yapmadım.** Onay verirseniz:

1. `wix release` → canlı URL
2. Formdan tek bir TEST gönderimi
3. `submissions/query` ile panoda kaydı doğrulama
4. E-posta bildiriminin gelip gelmediğini doğrulama
5. Test kayıtlarını silme
