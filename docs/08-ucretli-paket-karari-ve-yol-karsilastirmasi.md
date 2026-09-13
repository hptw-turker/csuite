# İş Paketi 3 — Ücretli Paket Kararı ve Yol Karşılaştırması

**Mevcut çalışan önizleme (korunuyor):** https://js9dub-csuite-headless-csuite04-0f08.wix-site-host.com
**Site:** `Csuite Headless` · `siteId 72b257e3-0db0-4579-8795-64e51b3f42a6`

---

## 1. ÖNCEKİ RAPORUN DÜZELTİLMESİ — `submissionLimitPerUser`

Önceki raporda bunu "sunucu tarafı spam koruması" olarak sundum. **Bu tanım yanlıştı.**

| İddia | Doğrusu |
|---|---|
| "Sunucu tarafı spam koruması" | **Gönderim kotasıdır.** Botu durdurmaz. |
| "localStorage bunu bağlayıcı yapıyor" | **Yalnızca dürüst tarayıcılar için.** Bot token'ı saklamaz, her istekte yeni `visitorId` alır ve kotayı sıfırlar. Ölçtüm: taze token ile gönderim HTTP 200. |

### Sıfırlanma koşulu — doğrulandı

[Form Object](https://dev.wix.com/docs/api-reference/crm/forms/form-schemas/form-object.md) tanımı:

> `submissionLimitPerUser` — *"Limitation per user submission count, **disables form** when a set
> amount of submissions per user is reached."*

**Hiçbir sıfırlanma süresi veya periyodu belgelenmemiş** — kota kalıcıdır. Yani 5'lik sınır,
zamanla 5 talep gönderen **meşru bir ziyaretçiyi kalıcı olarak engellerdi**. Bu keyfî sınırı
nihai çözüm yapmıyorum: **5 → 20'ye çıkarıldı** (revision 19), kötüye kullanımı sınırlar ama
gerçek bir ziyaretçiyi pratikte engellemez.

**Doğru tanım:** kötüye kullanım kotası. Kapsamlı spam koruması **değildir**.

---

## 2. Headless spam koruması — doğru kapsam

Captcha Authorize API'sinin headless'ta kullanılamaması, **tüm** seçeneklerin kapalı olduğu
anlamına gelmiyor. Gerçek durum:

| Seçenek | Headless'ta | Durum |
|---|---|---|
| `spamFilterProtectionLevel` ADVANCED/BASIC | ❌ | Wix'in kendi form widget'ının CAPTCHA'sını bekler |
| Belgesiz anahtarlarla CAPTCHA denemesi | ❌ | Denenmeyecek (428 `INVALID_CAPTCHA`, her seviyede) |
| `limitationRule` kotaları | ✅ | Kuruldu (kota — koruma değil) |
| Honeypot | ✅ | Kurulu, çalıştığı ölçüldü (istemci tarafı) |
| **Astro sunucu route'u + kendi reCAPTCHA'mız** | ✅ | **Mümkün — doğrulandı** (aşağıda) |
| Üye girişi zorunluluğu (headless reCAPTCHA destekli) | ✅ | Mümkün ama tanıtım formu için UX'i bozar |

### Doğrulanan kaçış yolu

Managed Headless **Astro sunucu route'larını destekliyor**
(`src/pages/api/*.ts`, `export const GET: APIRoute` — Wix'in kendi headless referansı).

Yani spam gerçek bir sorun olursa: statik HTML aynı Managed Headless sitede Astro'ya taşınır,
bir sunucu route'u **kendi Google reCAPTCHA anahtarlarımızla** token doğrular, sonra
`createSubmission` çağrılır. **Tasarım korunur** (aynı HTML), **ücretli paket gerekmez**,
kurulumu ben yaparım. Şu an gerekli değil; gerekirse yol açık.

---

## 3. İKİ YOLUN KARŞILAŞTIRMASI

| Ölçüt | **A) Managed Headless (mevcut)** | **B) Wix Studio/Editor + yerel Wix Forms** |
|---|---|---|
| **Tasarıma sadakat** | ✅ **Bayt bayt aynı** (sha256 `d176d71a…` kanıtlandı) | ⚠️ Yeniden kurulum; özel CSS ile yaklaşılır, birebir değil. Form bir Wix widget'ı — kendi görünümünü getirir |
| **Kalıcı kayıt** | ✅ Kanıtlandı (20 kayıt, hepsi `CONFIRMED`) | ✅ Yerel akış |
| **Spam koruması** | ⚠️ Kota + honeypot. ADVANCED/BASIC çalışmıyor | ✅ **Yerel görünmez CAPTCHA + Wix spam filtreleri çalışır** |
| **Bildirim** | ✅ Otomasyon `ACTIVE`, doğru forma filtreli | ✅ Aynı altyapı |
| **Panelden yönetim** | ⚠️ Yalnızca arka uç (gönderimler, kişiler). Sayfa görsel editörde düzenlenemez | ✅ Tam görsel editör |
| **Kurulumu BEN yapabilir miyim?** | ✅ **Evet** — CLI + API ile uçtan uca | ❌ **Hayır.** Editör sayfalarını API ile kurmanın yolu yok; görsel editör işi kullanıcıya kalır |

> **Tüm sayfayı iframe'e gömme** seçeneğini değerlendirip **elemekteyim**: mobil uyumu ve
> arama görünürlüğünü bozar, sayfa içi bağlantıları kırar (İş Paketi 1'de ölçüldü).

### Belirleyici iki nokta

1. **Tasarıma birebir sadakat** projenin 1 numaralı önceliği olarak tekrar tekrar belirtildi.
   Yol B bunu yapısal olarak veremez.
2. **Yol B'yi teknik olarak ben gerçekleştiremem.** Wix Editor/Studio sayfaları görsel editörde
   kurulur; içeriklerini programatik olarak oluşturan bir API yok. Bu, size iş yüklemek demek —
   çalışma düzenimize aykırı.

---

## 4. ÖNERİ

> **Yol A'da kalın.** Mevcut Managed Headless site korunur; ücretli paket **reklam bandını
> kaldırmak ve özel alan adını bağlamak** için alınır.

**Ücretli paket bu sorunları çözer:**
- Wix reklam bandı (kurumsal bir executive search sitesinde kabul edilemez)
- `wixsite.com`/`wix-site-host.com` adresi yerine **c-suite.com.tr** (sitenin içeriği zaten bu
  alan adına atıfta bulunuyor)
- Depolama/bant genişliği sınırları

**Ücretli paket bu sorunu ÇÖZMEZ:**
- ❌ **CAPTCHA / ADVANCED–BASIC spam filtresi.** Bu bir paket sınırı değil, **mimari sınır**:
  headless özel form, Wix Forms'un beklediği CAPTCHA token'ını üretemiyor. Ücretli pakete
  geçmek bunu değiştirmez. Gerekirse çözüm Bölüm 2'deki Astro sunucu route'udur ve o da
  paket gerektirmez.

---

## 5. SATIN ALINACAK PAKET

**Uygulanacak site:** `Csuite Headless` — `siteId 72b257e3-0db0-4579-8795-64e51b3f42a6`

> ⚠️ **Yanlış siteye almayın.** Hesapta ikinci bir site var: `My Site 1`
> (`bec82285-60c4-48e9-a532-2d0a30313c47`, Draft). Paket **site bazlıdır** ve başka bir site
> türüne aktarılabileceğini varsaymayın. Satın alma ekranında site adının
> **"Csuite Headless"** olduğunu doğrulayın.

**Doğru satın alma ekranı (site kapsamlı):**

```
https://manage.wix.com/dashboard/72b257e3-0db0-4579-8795-64e51b3f42a6/premium-plans
```

Alternatif: `https://www.wix.com/upgrade/website?siteGuid=72b257e3-0db0-4579-8795-64e51b3f42a6`

**Önerilen tür:** Wix'in **web sitesi (Website) paketlerinin giriş seviyesi** — reklamsız
yayın + özel alan adı bağlama için yeterlidir.
**E-ticaret/ödeme içeren üst paketleri seçmeyin** — bu sitede satış, ödeme veya ürün yok;
ek maliyet karşılıksız kalır.

### ⚠️ Fiyat bilgisi — okuyamadım

Hesabın paket ve fiyat bilgisini programatik olarak **çekemedim**:

| Deneme | Sonuç |
|---|---|
| `premium/v1/products`, `premium-store/v1/products`, `premium/v2/products`, `billing/v1/subscriptions` | HTTP **404** |
| `manage.wix.com/.../premium-plans` | HTTP **302** (oturum kapılı) |
| `wix account` CLI | Yalnızca `domain` alt komutu var |
| `dynamic-context` | Paket bilgisi döndürmüyor |

**Bu yüzden fiyat, para birimi, faturalama dönemi, vergi ve yenileme bilgisini tahmin
etmiyorum.** Bunlar yukarıdaki satın alma ekranında, hesabınızın ülkesine göre görünür.
Ekrandaki değerleri bana iletirseniz karşılaştırmayı netleştiririm.

---

## 6. SATIN ALMADAN ÖNCE HAZIRLANAN DURUM

Hepsi tamamlandı, satın alma gerektirmiyor:

- ✅ Site kurulu ve çalışıyor: `Csuite Headless`, Managed Headless, statik HTML
- ✅ Tasarım bayt bayt korunuyor (`<style>` bloğu kaynakla aynı)
- ✅ İşveren/Aday geçişi + 5 form alanı + `taraf` çalışıyor
- ✅ Wix Forms şeması kurulu (`a5807409-…`), 6 alan, zorunluluklar doğrulandı
- ✅ Gönderimler kalıcı `CONFIRMED` (20 kayıt)
- ✅ Bildirim otomasyonu `ACTIVE`, doğru forma filtreli
- ✅ Kota 20'ye ayarlandı, honeypot çalışıyor
- ✅ Önizleme yayında (production yayını yapılmadı)

---

## 7. ÖDEME SONRASI — BENİM YAPACAKLARIM

1. Paketin **doğru siteye** uygulandığını API'den doğrula (`siteId 72b257e3-…`)
2. Reklam bandının kalktığını yayındaki sayfadan doğrula
3. `c-suite.com.tr` alan adı bağlama adımlarını hazırla — DNS kayıtlarını çıkar
   (**alan adı değişikliğini sizin onayınız olmadan yapmam**)
4. Paket sonrası Wix Forms alan/adım/form sınırlarının değişip değişmediğini geri okuyarak
   kontrol et
5. `spamFilterProtectionLevel`'ı ücretli pakette **yeniden ölç** — paketin bunu çözmesini
   beklemiyorum, ama varsayım yerine ölçümle kapatırım
6. Production yayınına (`wix release`) hazır hale getir ve **onayınızı bekle**
7. Yayın sonrası tek bir TEST gönderimiyle kalıcı kaydı ve **e-posta teslimatını** doğrula
   (teslimat hâlâ tek doğrulanmamış madde)
8. Test kayıtlarını temizle
