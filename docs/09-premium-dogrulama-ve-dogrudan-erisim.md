# İş Paketi 3b — Premium Doğrulama, Form Durumu ve Doğrudan Erişim Açığı

## 1. Paket doğrulaması

`dynamic-context` (yetkili, salt okunur):

```
## 1. Csuite Headless
**ID**: 72b257e3-0db0-4579-8795-64e51b3f42a6
**Status**: Published · Plan: Premium
**Updated**: Sep 13, 2026, 11:25
```

✅ Paket **doğru siteye** uygulanmış (`Csuite Headless`), durum **etkin**.

⚠️ **Tam paket adını (Light/Core/Business vb.) API vermiyor** — yalnızca `Plan: Premium`.
`premium/*` ve `billing/*` uçları 404, `wix account` CLI'sinde paket komutu yok. Tam adı
tahmin etmiyorum; faturanızda veya panelde görünür.

## 2. Ücretli paket CAPTCHA sorununu çözmedi — ölçüldü

Varsaymadım, kontrollü deneyi Premium'da tekrarladım (tokensız gönderim, 45 sn bekleme):

| Seviye | create | Kalıcı kayıt |
|---|---|---|
| `ADVANCED` | `PENDING` | ❌ 20 → 20 |
| `BASIC` | `PENDING` | ❌ 20 → 20 |

Davranış ücretsiz paketle **aynı**. Bu bir paket sınırı değil, mimari sınır.
Belgesiz anahtarlarla yeni CAPTCHA denemesi yapılmadı.

## 3. Kalıcı kota kaldırıldı

Önceki `submissionLimitPerUser` (5, sonra 20) **kalıcıydı** — sıfırlanma süresi yok, meşru
ziyaretçiyi zamanla kalıcı engellerdi. **Kaldırıldı** (`limitationRule: {}`, revision 23).

**Wix Forms'ta süreli (zaman pencereli) gönderim sınırı yok** — `limitationRule` yalnızca
kalıcı sayaç, tarih sınırı ve kalıcı kişi başı kota sunuyor. Süreli sınır ancak kendi
sunucu route'umuzda uygulanabilir (Bölüm 5).

## 4. ⚠️ DOĞRUDAN ERİŞİM AÇIĞI — kanıtlandı, kapatılamadı

Sayfayı **hiç ziyaret etmeden**, yalnızca herkese açık `clientId` ile:

```
POST /form-submission-service/v4/submissions   →  HTTP 200, kayıt oluştu (id 277e9585…)
```

Yani **sayfaya konulacak herhangi bir sunucu kontrolü atlanabilir.** Bu nedenle mevcut
çözümü "korumalı" olarak raporlamıyorum.

**Form düzeyinde kapatılamıyor:** `submissionAccess` alanının resmî tanımı —
*"Controls who can **read** submissions"* (enum: `OWNER_AND_COLLABORATORS, MEMBERS, PUBLIC`).
**Yazmayı kısıtlayan bir ayar yok.** Bu, headless Wix Forms'un yapısal özelliği; Wix'in kendi
headless bileşeni (`@wix/headless-forms`) de aynı açık uca yazıyor.

## 5. Açığı KAPATAN yöntem — mekanizma kanıtlandı

Uygun kayıt yöntemi: **Wix Data (CMS) koleksiyonu, `insert: ADMIN`.**

Doğrulama koleksiyonu `GorusmeTalepleri` oluşturuldu ve test edildi:

| Kim | İşlem | Sonuç |
|---|---|---|
| Anonim ziyaretçi (public clientId) | INSERT | ❌ **HTTP 403 `WDE0027`** — *"does not have permissions to insert"* |
| Sahip / elevated backend | INSERT | ✅ HTTP 200 |

Managed Headless'ın **Astro sunucu route'u** (`src/pages/api/*.ts` + `auth.elevate()`)
resmî olarak destekleniyor. Tam mimari:

```
Tarayıcı → /api/talep (Astro, sunucu)
             ├─ alan doğrulama + honeypot
             ├─ süreli hız sınırı (IP/oturum bazlı)   ← Wix Forms'ta yoktu
             ├─ (opsiyonel) kendi reCAPTCHA anahtarlarımızla doğrulama
             └─ auth.elevate() → CMS koleksiyonuna INSERT   ← ziyaretçi yazamaz
```

### ⚠️ Bu geçişin bedeli — ürün kararı

| Kaybedilen | Neden |
|---|---|
| Wix Forms gönderim panosu | Kayıtlar CMS koleksiyonunda tutulur |
| **Çalışan bildirim otomasyonu** | Tetikleyicisi `wix_form_app-form_submitted` — CMS yazımında tetiklenmez |
| Kişiler (CRM) eşlemesi | `postSubmissionTriggers.upsertContact` forma bağlı |

Talimatınızda **"Bildirim otomasyonunu koru"** yazıyordu. CMS'e geçiş bunu bozar. Bu iki
gereksinim çeliştiği için mimariyi **tek taraflı değiştirmedim**; koleksiyonu hazır bıraktım
ve kararı size getiriyorum.

**Seçenekler:**
- **A)** Mevcut yapıda kal — pano + bildirim + CRM çalışır, doğrudan erişim açık kalır
- **B)** CMS'e geç — açık kapanır, pano/bildirim/CRM yeniden kurulur (bildirim için CMS
  tetikleyicili yeni otomasyon veya sunucudan e-posta)
- **C)** İkisi birden — sunucu hem korumalı koleksiyona hem Wix Forms'a yazar; koleksiyon
  temiz kalır, pano/bildirim korunur, ama Forms panosuna doğrudan spam düşebilir

## 6. Mevcut durum (korunuyor)

| Öğe | Durum |
|---|---|
| Form | `spam: NONE`, `limitationRule: {}`, `enabled: true` |
| Alanlar | `first_name, company, email, phone, message, taraf` ✅ |
| Kalıcı kayıt | **21, hepsi `CONFIRMED`** |
| **TEST / gerçek ayrımı** | **21 TEST · 0 gerçek talep** — hiçbiri silinmedi |
| Bildirim otomasyonu | ✅ `ACTIVE`, tetik `wix_form_app-form_submitted` |
| Tasarım | `<style>` bloğu kaynakla **bayt bayt aynı** |
| Koruma | Honeypot (istemci) + Wix'in `NONE` seviyesi. **Sunucu tarafı koruma yok** |

## 7. Test ortamının sınırı

Chromium bu ortamda ajan vekilini kullanamıyor; tarayıcı testleri yayındaki sayfanın
kopyası üzerinde yerel röleyle koşuyor. Gerçek önizleme adresinde tarayıcı davranışı
(çerez/oturum) doğrulanmadı. Bildirim **teslimatı** için gelen kutusu erişimim yok —
otomasyonun `ACTIVE` olduğu doğrulandı, e-postanın ulaştığı **doğrulanmadı**.
