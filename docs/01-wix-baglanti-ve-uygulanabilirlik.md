> ## ⚠️ BU RAPORUN DÖRT SONUCU DÜZELTİLMİŞTİR
>
> Bkz. **[02-duzeltme-managed-headless-ve-ag-engeli.md](02-duzeltme-managed-headless-ve-ag-engeli.md)**.
> Özetle geçersiz olanlar:
> 1. "Wix CLI'de site yayımlama komutu yok" — **YANLIŞ.** `wix publish` / `wix preview` / `wix dev`
>    komutları bir Wix proje dizininde mevcuttur (doğrudan testle kanıtlandı).
> 2. "Birebir sadakat için tek yol Premium + alan adı" — **GERİ ÇEKİLDİ** (kanıtı yoktu).
> 3. "iframe yolunda Web3Forms zorunlu" — **GERİ ÇEKİLDİ.** Saf statik ön yüz Wix Forms'a
>    doğrudan gönderim yapabilir.
> 4. "Yerel Wix öğeleri + Velo" önerisi — **ARTIK ÖNERİLMİYOR.** Yerine Managed Headless
>    `connect` + statik HTML.
>
> Bölüm 5 (dosya analizi) ve Bölüm 6 (yerel render testleri) geçerliliğini korur —
> ancak Bölüm 6'nın form teslimatını doğrulamadığına dikkat edin (02, Bölüm 4).

# İş Paketi 1 — Wix Bağlantısı ve Uygulanabilirlik Raporu

**Tarih:** 2026-09-13
**Kapsam:** Bağlantı kurulumu + aktarım yolu uygulanabilirlik değerlendirmesi
**Kapsam dışı (bilerek yapılmadı):** ücretli paket alımı, ödeme, alan adı değişikliği, canlı yayın, tam site geliştirmesi

---

## 1. Özet

| Adım | Durum |
|---|---|
| Çalışma ortamı incelendi | ✅ Tamamlandı |
| Resmî Wix araçları kuruldu (`@wix/cli`, `@wix/mcp`) | ✅ Tamamlandı |
| Wix MCP sunucusu Claude Code'a tanımlandı | ✅ Tamamlandı |
| Hesap bağlantısı (OAuth) | ❌ **Engellendi** — ağ politikası `wix.com` alan adlarını kapatıyor |
| Hesap/site erişim kontrolü (salt okunur) | ❌ **Yapılamadı** — bağlantı kurulamadığı için |
| HTML dosyasının tam analizi | ✅ Tamamlandı |
| Yerel render + etkileşim denemesi | ✅ Tamamlandı |
| Yol A / Yol B değerlendirmesi ve öneri | ✅ Tamamlandı |

**Tek kritik engel:** Bu oturumun ağ çıkış politikası tüm `wix.com` alan adlarını reddediyor. Wix hesabına bağlanmak bu ortamdan mümkün değil. Ayrıntı ve çözüm: [Bölüm 4](#4-hesap-bağlantısı--engellendi) ve [Bölüm 12](#12-sizin-tamamlamanız-gereken-zorunlu-adım).

---

## 2. Çalışma ortamı

| Öğe | Değer |
|---|---|
| Dizin | `/home/user/csuite` (git deposu, bağlantı öncesi boştu) |
| Node.js / npm | v22.22.2 / 10.9.7 |
| Tarayıcı | Chromium (Playwright ile ön yüklü) |
| Ağ | Tüm HTTPS trafiği politika uygulayan bir çıkış vekili üzerinden |
| Önceden kurulu Wix aracı | **Yok** — sıfırdan kuruldu |

---

## 3. Kurulan araçlar (doğrulandı)

Her ikisi de Wix'in npm üzerinde yayımladığı resmî paketlerdir:

| Paket | Sürüm | Sonuç |
|---|---|---|
| `@wix/cli` | **1.1.245** | ✅ Kuruldu, `wix --version` çalışıyor |
| `@wix/mcp` | **1.0.80** | ✅ Kuruldu |
| Wix Remote MCP (`https://mcp.wix.com/mcp`) | — | ✅ Claude Code'a kaydedildi |

`wix --help` ile doğrulanan **gerçek komut listesi**:

```
account    Manage your Wix account
login      Log in to your Wix account
logout     Log out of your Wix account
telemetry  Opt in/out of telemetry
token      Print the current access token
whoami     Display the email of the logged in Wix user
```

> **Önemli bulgu:** Bu sürümde Wix CLI **yalnızca kimlik doğrulama ve hesap yönetimi** içeriyor.
> **Site yayımlama, dağıtma (deploy) veya HTML yükleme komutu yok.** Yani "HTML dosyasını CLI ile
> Wix'e yükleyip yayımlama" diye bir yol mevcut değil. Wix siteleri Wix editöründen yayımlanır.
> Bu, Yol B değerlendirmesini doğrudan etkiliyor.

MCP kayıt sonucu:

```
wix: https://mcp.wix.com/mcp (HTTP) - ! Needs authentication
```

MCP sunucusu tanımlandı, ancak kimlik doğrulaması yapılamadı (aşağıdaki engel).

---

## 4. Hesap bağlantısı — ENGELLENDİ

Resmî giriş akışı (OAuth device-code) **gerçekten çalıştırıldı**. Sonuç:

```
$ wix login
× An error occurred while logging in: Failed to issue a login device code.
FailedToGetDeviceCode: FailedToGetDeviceCode
    at AuthClient.requestDeviceCode
caused by: Error: Request failed with status code 403
```

`wix login --api-key ...` (CI yolu) da aynı noktada, aynı hatayla düştü.

**Kök neden** — çıkış vekilinin kendi kaydı:

```json
{ "kind": "connect_rejected",
  "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
  "host": "manage.wix.com:443" }
```

Hata Wix kaynaklı değil; **bu oturumun ağ politikası** kaynaklı. Reddedilen alan adları (tek tek test edildi):

| Alan adı | Sonuç | Ne için gerekli |
|---|---|---|
| `manage.wix.com` | ❌ 403 | OAuth giriş / hesap paneli |
| `mcp.wix.com` | ❌ 403 | Wix MCP sunucusu |
| `www.wix.com` | ❌ 403 | Genel |
| `dev.wix.com` | ❌ 403 | Resmî geliştirici dokümanları |
| `support.wix.com` | ❌ 403 | Resmî yardım merkezi |
| `users.wix.com` | ❌ 403 | Kimlik doğrulama |
| `editor.wix.com` | ❌ 403 | Editör |
| `static.parastorage.com` | ❌ 403 | Wix statik varlık CDN'i |
| `frog.wix.com`, `bo.wix.com` | ❌ 403 | Telemetri / MCP arka uç |

Karşılaştırma için erişilebilen alan adları: `registry.npmjs.org` ✅, `github.com` ✅,
`fonts.googleapis.com` ✅, `fonts.gstatic.com` ✅.

> Ağ politikasını aşmaya çalışmadım — bu ortamda doğru davranış engeli raporlamaktır.

### 4.1 Erişim kontrolü — yapılamadı

İş paketinin 4. maddesi (bağlantı sonrası hesabı ve siteleri salt okunur doğrulama)
**gerçekleştirilemedi.** Bağlantı kurulamadığı için:

- Hesapta hangi sitelerin olduğu **doğrulanmadı**.
- Ücretsiz hesabın gerçek paket durumu **doğrulanmadı**.
- Hesapta hiçbir şey **değiştirilmedi** (zaten erişim yoktu).

Bu maddeyi yapılmış gibi raporlamıyorum. Erişim açıldığında çalıştırılacak komutlar:
`wix login` → `wix whoami` → `wix account` (hepsi salt okunur).

---

## 5. HTML dosyasının analizi

Dosya Google Drive'dan alındı (`C-Suite_Ideal_Revize.html`), byte-byte doğrulandı ve
depoya `site/` altına konuldu.

| Ölçüm | Değer |
|---|---|
| Toplam boyut | **75.434 bayt** / 774 satır |
| Gövde (HTML) | 45.764 karakter |
| Satır içi `<style>` | 18.511 karakter |
| Satır içi `<script>` | 4.808 karakter (tek blok) |
| base64 gömülü görsel | 3 adet, 28.524 karakter (favicon + 2 logo) |
| Satır içi SVG ikon | 12 |
| **Harici görsel dosyası** | **0 — hiç yok** |

**Harici bağımlılıklar yalnızca iki tane:**
1. Google Fonts — Poppins (300–800, italik dahil)
2. `api.web3forms.com` — form gönderimi

> Bu, aktarım açısından çok elverişli: site **tek, kendi kendine yeten bir dosya**.
> Taşınacak görsel klasörü, CSS/JS bağımlılığı, build adımı yok.

### 5.1 Tasarım jetonları (CSS değişkenleri)

```css
--red:#CF051E;  --red-deep:#A50418;  --yellow:#F8BA3F;
--black:#231A15; --black-2:#2E241E;  --ink:#1A130F;
--white:#FFFFFF; --grey:#9A9088;     --grey-2:#6E655F;
--sans:'Poppins',sans-serif;
```

### 5.2 Bölüm sırası

`hero (#top)` → `#neden` → `#network` → `#surec` → `#guven` → `#iletisim` → `footer`

### 5.3 Etkileşimli davranışlar (JS'den çıkarıldı)

| # | Davranış | Uygulama |
|---|---|---|
| 1 | Scroll'da nav arka planı | `scrollY>40` → `.scrolled` |
| 2 | Mobil menü | `body.menu-open` + ARIA |
| 3 | **İşveren/Aday geçişi** | `.persona[data-persona]` → `.show` |
| 4 | **Persona'ya bağlı form değişimi** | `syncForm()` — etiket, placeholder, buton, konu, taraf |
| 5 | Web3Forms gönderimi | `fetch` + başarı/hata durumları |
| 6 | Mobil sabit CTA | Hero'dan sonra görünür, forma yaklaşınca gizlenir |
| 7 | Scroll reveal | `IntersectionObserver`, kademeli 50ms gecikme |

**Persona geçişi 10 içerik bloğunu yönetiyor** (5 işveren + 5 aday) ve **aynı anda formu
yeniden yazıyor**. Aktarımın en kritik ve en zor parçası budur.

### 5.4 Form alanları

| Alan | `name` | Tip | Zorunlu |
|---|---|---|---|
| Ad Soyad | `Ad Soyad` | text | ✅ |
| Şirket / Mevcut kurum | `Şirket / Mevcut Kurum` | text | ✅ (etiket persona'ya göre değişir) |
| E-posta | `E-posta` | email | ✅ |
| Telefon | `Telefon` | tel | ➖ isteğe bağlı |
| Mesaj | `Mesaj` | textarea | ✅ (etiket persona'ya göre değişir) |

Gizli alanlar: `access_key`, `subject`, `from_name`, `taraf` + `botcheck` (honeypot spam koruması).

İstenen alan listesiyle **birebir uyumlu.**

> **Not:** Web3Forms `access_key` değeri HTML kaynağında açıkta. Bu Web3Forms'un tasarımı gereğidir
> (istemci tarafı genel anahtar), gizli bir sır değildir; ancak anahtarı bilen herkes o forma gönderim
> yapabilir. Honeypot alanı temel spam korumasını sağlıyor.

---

## 6. Yerel deneme — gerçekten çalıştırıldı

Sayfa başsız Chromium'da açıldı ve etkileşimler programatik olarak test edildi
(`tools/render-check.mjs`). Sonuçlar:

| Test | Sonuç |
|---|---|
| Sayfa hatasız yükleniyor | ✅ |
| 7 bölümün tamamı mevcut | ✅ |
| İşveren görünümü: 5 persona bloğu | ✅ |
| Aday görünümü: 5 persona bloğu | ✅ |
| **Persona geçişi formu yeniden yazıyor** | ✅ `Şirket*` → `Mevcut kurum*`, `İşveren` → `Aday` |
| Buton metni değişiyor | ✅ `Ön görüşme talep edin` → `Gizli görüşme talep edin` |
| Scroll reveal | ✅ 32 öğe animasyonla göründü |
| Mobil menü (390×844) | ✅ Açılıyor |
| Mobil sabit CTA | ✅ Doğru noktada görünüyor |
| Form doğrulaması | ✅ 4 zorunlu alan |

Ekran görüntüleri: `docs/img/`.

> **Tipografi hakkında dürüst not:** Sanal ortamdaki Chromium çıkış vekilini kullanamadığı için
> ekran görüntülerinde Poppins yerine sistem yazı tipi görünüyor. Bu bir site hatası **değil**:
> Poppins CSS'i (HTTP 200) ve `.woff2` font dosyası (HTTP 200, 39.660 bayt) bu ağdan `curl` ile
> doğrulandı. Gerçek tarayıcıda Poppins normal yüklenir.

---

## 7. Yol A ve Yol B değerlendirmesi

> **Temel gerçek:** Wix'in HTML dosyasını otomatik olarak editör öğelerine çeviren bir içe
> aktarma aracı **yoktur**. Hiçbir yol "dosyayı yükle, bitti" değildir. Bunu varsaymıyorum.

### Yol A — Wix görsel editöründe yeniden kurulum

Sayfa Wix editöründe yerel Wix öğeleriyle (bölüm, metin, buton, form) elle yeniden kurulur.

| | |
|---|---|
| ✅ | Her öğe Wix panelinden düzenlenebilir — metin, renk, görsel, sıra |
| ✅ | **Wix Forms** kullanılabilir: gönderimler panelde saklanır, e-posta bildirimi hazır gelir |
| ✅ | Gerçek responsive davranış; SEO düzgün (içerik doğrudan indekslenir) |
| ✅ | Ücretsiz pakette çalışır |
| ⚠️ | **Elle yeniden kurulum gerekir** — otomatik dönüşüm yok |
| ⚠️ | Birebir görsel eşitlik garanti değil: degrade arka planlar, kayan yazı şeridi, kademeli reveal animasyonları yaklaşık olur |
| ⚠️ | **İşveren/Aday geçişinin yerel karşılığı yok** → Velo kodu gerekir |

### Yol B — Tasarımın kodla korunması

Wix altyapısında kodu koruyarak yayımlamanın **üç teknik yolu** var; üçü de sınırlı:

**B1 — Embed HTML (iframe)** · *ücretsiz pakette çalışır*
- ✅ Tasarım iframe içinde %100 korunur, sıfır yeniden kurulum
- ❌ iframe **responsive değil** — mobilde ciddi sorun; bu sitenin mobil menüsü ve sabit CTA'sı var
- ❌ Arama motorları iframe içeriğini iyi indeksleyemez; Wix Site Search hiç göremez
- ❌ Sabit yükseklik; sayfa içi bağlantılar (`#neden` vb.) iframe dışına çıkamaz
- ❌ Wix panelinden **hiçbir şey** düzenlenemez — tek bir kod bloğu görünür

**B2 — Velo Custom Element**
- ✅ iframe'den daha temiz entegrasyon
- ❌ **Canlı sitede kullanmak için Premium paket + bağlı alan adı + reklamsız site gerekir**
- ❌ Yani **ücretsiz hesapta bu yol kapalı** (bu iş paketinin kapsamı dışında)

**B3 — Wix Headless**
- ❌ Wix editör sitesi olmaktan çıkar; ayrı barındırma ve build gerekir. Bu proje için aşırı.

---

## 8. Öneri

**Önerilen: Yol A tabanlı hibrit — yerel Wix öğeleri + geçiş için Velo + Wix Forms.**

Gerekçe, istenen üç ölçüte göre:

| Ölçüt | Kazanan | Neden |
|---|---|---|
| **Tasarıma sadakat** | Yol B1 (kısa vadede) | iframe pikseli korur — ama mobil ve SEO'yu bozar |
| **Form yönetimi** | **Yol A** | Wix Forms: gönderimler panelde, bildirim hazır. B1'de Wix Forms kullanılamaz |
| **Kullanıcıya düşen iş** | **Yol A (uzun vadede)** | B1'de her metin değişikliği için kod düzenlemek gerekir |

Belirleyici nokta: bu bir **tanıtım sitesi**. En çok ihtiyaç duyduğu iki şey mobil uyum ve
arama görünürlüğü — B1 iframe tam olarak bu ikisini feda ediyor. Ayrıca sitenin kendi
mobil menüsü ve sabit CTA'sı iframe içinde doğru çalışmaz.

Velo, **ücretsiz pakette dahil** olduğu için İşveren/Aday geçişi (tek gerçek teknik zorluk)
yerel öğeler üzerinde kodla birebir yeniden üretilebilir. Böylece hem geçiş korunur, hem
metinler panelden düzenlenebilir kalır.

**Dürüst uyarı:** Yol A birebir piksel kopyası **değildir**; degrade arka planlar, kayan
şerit ve kademeli animasyonlar yaklaşık olur. Birebir sadakat mutlak öncelikse tek gerçek
yol B2'dir ve o da Premium + alan adı ister.

**Ayrıca belirtmem gereken bir nokta:** Bu dosya tek, kendi kendine yeten bir HTML. Statik bir
barındırma hizmetinde (Netlify, Cloudflare Pages, GitHub Pages) **%100 sadakatle ve dakikalar
içinde**, sıfır yeniden kurulumla yayına alınabilirdi. Wix tercihi sizin kararınız; yukarıdaki
Wix değerlendirmesi eksiksizdir ve o karara göre ilerlemeye hazırım.

---

## 9. Wix panelinden neler düzenlenebilir?

**Yol A (önerilen) seçilirse:**

| Düzenlenebilir | Nasıl |
|---|---|
| Tüm metinler, başlıklar | Editörde tıkla-yaz |
| Renkler, tipografi | Site tasarım paneli (tasarım jetonları Wix temasına aktarılır) |
| Logo, görseller | Medya yöneticisi |
| Bölüm sırası | Editörde sürükle-bırak |
| Menü ve sayfa içi bağlantılar | Menü yöneticisi |
| Form alanları | Wix Forms düzenleyicisi |
| **Persona geçişinin metinleri** | Velo kod dosyasından (panelden değil) |

**Yol B1 seçilirse:** panelden hiçbir şey düzenlenemez — her değişiklik HTML kodunda yapılır.

---

## 10. Formların kaydı, yönetimi ve bildirimler

İki seçenek:

**Seçenek 1 — Wix Forms'a geçiş (Yol A ile önerilen)**
- Gönderimler Wix panelinde **Forms & Submissions** bölümünde saklanır
- Gönderim anında site sahibine **otomatik e-posta** gider (`notifications@wix-forms.com`)
- **Wix Automations** ile ek bildirim alıcıları, Wix Inbox'a düşürme ve gönderene otomatik yanıt kurulabilir
- Gönderenler Wix Kişiler (CRM) listesine kaydedilir
- Kayıt sonrası dışa aktarma mümkün

**Seçenek 2 — Web3Forms'u korumak**
- Bugün çalışan kurulum; hiçbir değişiklik gerekmez
- Gönderimler Web3Forms tarafında toplanır, e-posta ile iletilir
- Wix panelinde **görünmez**, Wix CRM'e kişi yazmaz
- B1 (iframe) yolunda **zorunlu** seçenektir

**Değerlendirme:** Yol A seçilirse Wix Forms'a geçiş mantıklı — form yönetimi, bildirim ve kişi
kaydı tek panelde toplanır. Persona'ya göre değişen etiketler Velo ile korunabilir. Geçiş
uygulanabilir; ancak bu iş paketinde henüz uygulanmadı.

---

## 11. Ücretsiz hesapta imkânlar ve kısıtlar

> ⚠️ Aşağıdakiler Wix'in genel ücretsiz paket koşullarıdır. **Sizin hesabınızda
> doğrulanmadı** — bağlantı engellendiği için. Hesap açıldığında teyit edilmeli.

| Konu | Ücretsiz pakette |
|---|---|
| Alan adı | Yalnızca `kullanici.wixsite.com/site` alt alan adı |
| Wix reklamları | **Her sayfada görünür** — tanıtım sitesi için ciddi dezavantaj |
| Depolama / bant genişliği | 500 MB / 1 GB |
| Velo (Dev Mode) | ✅ **Dahil** — persona geçişi için kritik |
| Wix Forms | ✅ Kullanılabilir |
| Embed HTML (iframe) | ✅ Kullanılabilir |
| **Velo Custom Element (canlı sitede)** | ❌ **Premium + bağlı alan adı + reklamsız gerekir** |
| Özel alan adı | ❌ Premium gerekir |

**Somut kısıt:** Tanıtım sitesi için iki gerçek engel Wix reklam bandı ve `wixsite.com`
adresidir. Kurumsal bir executive search markası için ikisi de sorun yaratır. Bunları kaldırmak
Premium gerektirir — bu iş paketinin kapsamı dışında, sizin kararınız.

---

## 12. Sizin tamamlamanız gereken zorunlu adım

**Tek bir zorunlu adım var** ve teknik değil, yetki gerektiren bir adım:

> ### Bu ortamın ağ politikasında `wix.com` alan adlarının açılması
>
> Şu anda bu oturum `wix.com` altındaki hiçbir adrese çıkamıyor. Bu yüzden Wix hesabına
> bağlanamıyorum. Açılması gereken alan adları:
>
> ```
> manage.wix.com      users.wix.com       mcp.wix.com
> www.wix.com         dev.wix.com         support.wix.com
> editor.wix.com      static.parastorage.com
> ```
>
> Bu ayar, Claude Code ortamının oluşturulurken seçilen ağ erişim politikasında yapılır.
> Referans: https://code.claude.com/docs/en/claude-code-on-the-web

**Seçenekleriniz:**

1. **Ağ politikasını güncelleyin** (önerilen) — sonra ben `wix login` ile bağlanır, hesabı ve
   siteleri salt okunur doğrular, Bölüm 4.1'i tamamlarım.
2. **Bağlantıyı kendi bilgisayarınızda kurun** — `npm i -g @wix/cli` sonra `wix login`.
   Tarayıcıda Wix hesabınızla giriş yaparsınız.

**Sohbette parola veya erişim anahtarı paylaşmayın** — gerekmiyor; giriş yalnızca sizin
tamamlayacağınız tarayıcı tabanlı OAuth akışıyla yapılır.

---

## 13. Bu depodaki dosyalar

```
site/C-Suite_Ideal_Revize.html   Kaynak dosya (75.434 bayt, doğrulandı)
docs/01-...-uygulanabilirlik.md  Bu rapor
docs/img/                        Yerel denemenin ekran görüntüleri
tools/render-check.mjs           Çalıştırılabilir render + etkileşim testi
```

`tools/render-check.mjs` içindeki `PROJECT_ROOT` yolunu kendi dizininizle değiştirip
`node tools/render-check.mjs` ile testi tekrar çalıştırabilirsiniz.

---

## 14. Kaynaklar

- [The Wix MCP — dev.wix.com](https://dev.wix.com/docs/overview/ai-the-wix-platform/the-wix-mcp)
- [Wix Studio — Official MCP Server](https://www.wix.com/studio/developers/mcp-server)
- [Wix Editor: Adding a Custom Element](https://support.wix.com/en/article/wix-editor-adding-a-custom-element-to-your-site)
- [Velo: Custom Element Introduction](https://dev.wix.com/docs/velo/velo-only-apis/$w/custom-element/introduction)
- [Velo: About Premium Plans](https://dev.wix.com/docs/develop-websites/articles/coding-with-velo/premium-plans/about-premium-plans)
- [Studio Editor: Adding an HTML iFrame Element](https://support.wix.com/en/article/studio-editor-adding-an-html-iframe-element)
- [Wix Forms: An Overview](https://support.wix.com/en/article/wix-forms-an-overview)
- [Wix Forms: Choosing Who Gets Notified](https://support.wix.com/en/article/wix-forms-choosing-who-gets-notified-about-form-submissions)
- [Wix Forms: Automated Email Responses](https://support.wix.com/en/article/wix-forms-creating-automated-responses-for-form-submissions)
- [Claude Code on the web — ortam ve ağ politikası](https://code.claude.com/docs/en/claude-code-on-the-web)

> Not: `dev.wix.com` ve `support.wix.com` bu ortamdan engellendiği için bu kaynaklar doğrudan
> açılamadı; içerikleri web araması üzerinden doğrulandı. Ağ açıldığında resmî dokümanlar
> birinci elden teyit edilmelidir.
