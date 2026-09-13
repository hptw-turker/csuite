# İş Paketi 1 — Revizyon: Managed Headless Bulgusu ve Ağ Engeli

**Tarih:** 2026-09-13
**Durum:** `01-wix-baglanti-ve-uygulanabilirlik.md` raporundaki dört sonucu **düzeltir**.
**Kaynak:** Wix'in resmî [`wix/skills`](https://github.com/wix/skills) deposu (plugin v1.19.0) + doğrudan CLI testi.

---

## 0. Referans dosya doğrulaması

Ek olarak gönderilen `C-Suite_Ideal_Revize.html`, önceki turda Drive'dan alınan dosyayla
**bayt bayt aynıdır**:

```
SHA256  d176d71af3c620d0474d926f7d0d6c2086755fce705505162ed01dacaac15136   (ek)
SHA256  d176d71af3c620d0474d926f7d0d6c2086755fce705505162ed01dacaac15136   (depo)
75.434 bayt / 774 satır — diff: fark yok
```

Bu nedenle dosya analizi ve yerel render testleri **tekrarlanmadı**; önceki turun sonuçları geçerli.

---

## 1. DÜZELTME — Wix CLI'nin yayımlama komutu **vardır**

Önceki raporda "Wix CLI'de site yayımlama komutu yok" dedim. **Bu yanlıştı.**

Komutlar **bağlama duyarlıdır**: boş dizinde yalnızca hesap/kimlik komutları görünür, bir Wix
projesi dizininde (`wix.config.json` mevcutken) yayımlama komutları kaydolur. Doğrudan test:

```
$ wix --help            # boş dizinde
account, login, logout, telemetry, token, whoami

$ wix --help            # wix.config.json içeren dizinde
account      Manage your Wix account
dev          Open the Local Editor that runs your local code
install      Install a supported NPM package
login        Log in to your Wix account
preview      Create a shareable version of your site before going live
publish      Publish your site to production          ← YAYIMLAMA KOMUTU
token        Print the current access token
uninstall    Uninstall an NPM package
whoami       Display the email of the logged in Wix user
```

Resmî `wix/skills` deposu ayrıca `wix build`, `wix release`, `wix dev`, `wix preview`
komutlarını kullanıyor (`npx @wix/cli@latest release`). Kurduğum sürümde karşılığı `publish`
görünüyor; bu isimlendirme farkı canlı bağlantı kurulduğunda teyit edilmeli.

**Sonuç:** Wix'in gerçek geliştirme ve yayımlama yolu, ilk raporda değerlendirdiğimden çok daha
geniş. Aşağıdaki bölüm bunun ne anlama geldiğini anlatıyor.

---

## 2. YENİ BULGU — Managed Headless: tasarımı birebir koruyan gerçek yayımlama yolu

`wix/skills` deposundaki `wix-headless` becerisi, ilk raporda hiç değerlendirilmemiş bir yol
tanımlıyor: **Managed Headless — `connect` işlemi.**

Beceri dosyasının kendi tanımı:

> **connect** → "The user **brings a design not yet connected to Wix and wants it wired**…
> or language like 'connect this / implement this design / **host this on Wix** / deploy this to Wix'"

Ve barındırma tablosu:

| Proje tipi | Barındırma |
|---|---|
| `managed` | **Wix altyapısı (Wix tarafından işletilir)** |
| `self-managed` | kullanıcının kendi sunucusu |
| `stripe` | Stripe Projects ile sağlanan kendi sunucusu |

### 2.1 Statik, düz HTML resmen destekleniyor

`managed/DEPLOYMENT.md` dosyasında **"Static frontends (no build step)"** başlıklı ayrı bir bölüm var:

> "These two fixes are **Wix-hosting facts** — they apply to a connected **static** site
> (**plain HTML, no bundler**) on the managed path."
>
> - **Giriş dosyasının adı `index.html` olmalıdır.** Başka bir adla (örn. `"My Design.html"`)
>   yayım "başarılı" görünür ama canlı sitede 500/404 verir.
> - **`site.outputDirectory`, `index.html`'i içeren dizini göstermelidir.** `init` varsayılan
>   olarak `./dist` yazar; statik sitede bu yanlıştır ve kök dizin 404 verir.

**Bu, C-Suite dosyası için tam isabet:** elimizdeki şey zaten tek parça, derleme gerektirmeyen,
düz bir HTML. Wix onu **olduğu gibi** sunar.

### 2.2 Akış

```
1. Tasarımı çalışma dizinine koy   (C-Suite_Ideal_Revize.html → index.html)
2. npm create @wix/new@latest init  → wix.config.json + siteId + headless OAuth app
3. Kimlik doğrulama                 (wix login)
4. (opsiyonel) Wix uygulamalarını kur + içerik tohumla   → örn. Wix Forms
5. (opsiyonel) Formu Wix Forms'a bağla
6. wix.config.json → outputDirectory = index.html'in dizini
7. npx @wix/cli@latest release      → Wix altyapısında yayına alır, URL'i yazdırır
```

Yayım sonrası iki bağlantı verilir: canlı site URL'i ve
`https://manage.wix.com/dashboard/<SITE_ID>` (headless sitede editör düğmesi olmadığı için
sahibin arka uca tek girişi budur).

### 2.3 Tasarım sadakati

Bu yolda **HTML/CSS/JS dosyanızın kendisi sunulur**. Yeniden kurulum, öğe dönüştürme veya
yaklaşıklaştırma yoktur. Degradeler, kayan şerit, kademeli reveal animasyonları, İşveren/Aday
geçişi, mobil menü, sabit CTA — hepsi yazıldığı gibi çalışır. **Sadakat tanım gereği %100'dür.**

### 2.4 `wix-headless-replatform` neden bu iş için uygun değil

Depoda ayrıca `wix-headless-replatform` becerisi var. Onun kendi tanımı:

> "Drive a **close-enough**, visually polished Wix Headless frontend from a source website."
> Kullanılan yığın: Astro + TypeScript + Tailwind.

Bu beceri **canlı bir URL'i tarayıcıyla inceleyip yeniden inşa etmek** içindir ve çıktısı
"yeterince yakın"dır, birebir değil. Bizde kaynak HTML'in kendisi elimizde olduğu için
`connect` + statik yolu **daha yüksek sadakat** verir. Replatform bu iş için gereksiz ve
sadakat açısından geriye adımdır.

---

## 3. GERİ ÇEKİLEN İDDİALAR

Aşağıdaki üç ifade önceki raporda kesin sonuç olarak yazılmıştı. **Yeterli teknik kanıtları
yoktu; geri çekiyorum.**

### 3.1 "Birebir sadakat için tek yol Premium + alan adı" — GERİ ÇEKİLDİ

Bu iddia yalnızca **Velo Custom Element**'in premium koşuluna dayanıyordu ve Managed Headless
yolunu hiç hesaba katmıyordu. Managed Headless, Custom Element kullanmaz; dolayısıyla o koşul
bu yol için geçerli değildir.

**Dürüst sınır:** Resmî beceri dokümanlarında `release`/`publish` için bir premium koşulu
**geçmiyor** — premium ibareleri yalnızca belirli iş özelliklerine bağlı (restoran siparişi,
ücretli bilet, e-ticaret ödemesi, AI kredileri, Wix Forms alan/adım sayısı üst sınırları).
Ancak **ücretsiz bir hesapta `release`'in gerçekten çalıştığını doğrulayamadım** — Wix'e
bağlanamadığım için. Bunu "çalışır" diye raporlamıyorum; "dokümanlarda engelleyici bir koşul
görünmüyor, canlı doğrulama bekliyor" diye raporluyorum.

### 3.2 "iframe yolunda Web3Forms zorunlu" — GERİ ÇEKİLDİ

İki nedenle geçersiz:

1. Managed Headless yolunda **iframe hiç kullanılmıyor**, dolayısıyla önerme konusuz kalıyor.
2. Daha önemlisi: **saf statik bir ön yüz Wix Forms'a doğrudan gönderim yapabiliyor.**
   `how-to-code-forms.md`'den:

   > "An anonymous visitor **can** create a submission on the plain visitor token
   > (it stamps `submitter.visitorId`). A pure SPA/static frontend has **no server and cannot
   > elevate** anyway."
   >
   > "Schema-driven rendering is therefore **universal — every framework, including a pure
   > static SPA, with no server or proxy.**"

   Gerekli olan tek şey **herkese açık `clientId`** (gizli anahtar değil):

   ```js
   import { createClient, OAuthStrategy } from '@wix/sdk';
   import { forms, submissions } from '@wix/forms';
   const client = createClient({
     modules: { forms, submissions },
     auth: OAuthStrategy({ clientId: /* public */ }),
   });
   ```

   Gönderim site sahibinin panosuna düşer. **Not:** gönderimleri geri okumak (listelemek)
   sahip yetkisi ister; ön yüzden okunamaz — başarı sinyali `submit` sözünün çözülmesidir.

**Sonuç:** C-Suite formu, **özel tasarımını hiç bozmadan** Wix Forms'a bağlanabilir. Bu, ilk
raporda "Wix Forms istiyorsan tasarımı yeniden kur" şeklindeki ödünleşmeyi ortadan kaldırıyor.

### 3.3 "Yerel Wix öğeleri + Velo" önerisi — ONAYLANMIŞ KARAR DEĞİL

İlk raporda bunu öneri olarak sundum. Kullanıcı önceliği **tasarımın birebir korunması**
olduğu ve görsel editörde her öğeyi düzenleme şartı **henüz verilmediği** için bu yaklaşım
artık önerilmiyor. Yaklaşık tasarım üreten bir yöntem, verilmemiş bir şart uğruna verilmiş
bir önceliği feda ediyordu. Öneri Bölüm 2'deki Managed Headless `connect` yoludur.

---

## 4. AYRI RAPOR — Form gönderiminin gerçek teslimatı DOĞRULANMADI

Önceki turdaki yerel testler yalnızca **istemci tarafı davranışı** doğruladı:

| Doğrulanan (yerel) | Doğrulanmayan |
|---|---|
| Persona geçişi form etiketlerini yeniden yazıyor | Gerçek bir gönderimin Web3Forms'a ulaşması |
| 4 zorunlu alanın tarayıcı doğrulaması | E-posta teslimatı |
| Buton/durum metinlerinin değişmesi | `access_key`'in geçerli olduğu |
| Honeypot alanının varlığı | Başarı/hata dallarının gerçek yanıtla çalışması |

**Neden doğrulanmadı:** `api.web3forms.com` bu ortamın ağ politikası tarafından engelli
(bağlantı kurulamıyor). Hiçbir gerçek gönderim yapılmadı.

Yerel etkileşim testlerinin geçmesi, formun uçtan uca çalıştığı anlamına **gelmez**. Bu
ayrım önceki raporda yeterince net değildi; burada düzeltiliyor. Uçtan uca doğrulama ağ
açıldıktan sonra yapılmalıdır.

---

## 5. AĞ ENGELİ — durum ve çözüm

### 5.1 Kendim çözemiyorum — nedeni

Ortam: `env_01FJvFvTfuMtw6KH8As1dSxD` · "Default — trusted network access" · `anthropic_cloud`

Bu oturumun araç setinde ortamın ağ erişim ayarını **değiştirebilecek bir araç yok**
(mevcut olan yalnızca `list_environments` — salt okunur). Ayar, konteynerin içinden değil,
claude.ai arayüzünden yönetiliyor. Politikayı aşmaya **çalışmadım**; resmî yapılandırma
yolu aşağıdadır.

### 5.2 Sizin yapmanız gereken — tam olarak bu

Resmî dokümana göre (`cloud-environments` → Network access), dört erişim seviyesi var:
**None**, **Trusted** (şu anki), **Full**, **Custom**.

> **Ortamı düzenlemeye açın** (bulut simgesi ağ seçicisini açar) → **Network access**
> alanını **Custom** yapın → **Allowed domains** kutusuna **her satıra bir alan adı** olacak
> şekilde şunları girin:
>
> ```
> wix.com
> *.wix.com
> wixapis.com
> *.wixapis.com
> *.parastorage.com
> *.wixstatic.com
> *.wixsite.com
> ```
>
> → **"Also include default list of common package managers"** kutusunu **işaretleyin**
> (npm ve diğer paket kaynakları çalışmaya devam etsin diye).

Baştaki `*.` tüm alt alan adlarını kapsar; bu liste `manage`, `users`, `mcp`, `dev`,
`support`, `editor` ve `www` alt alan adlarını birlikte açar.

**Daha hızlı alternatif:** **Network access** alanını **Full** yapmak. Tek adımdır ve liste
gerektirmez; buna karşılık oturumu tüm internete açar. Kurumsal tercihe göre karar verin —
ben **Custom** listesini öneriyorum.

> Not: MCP bağlayıcıları (connectors) bu listeden bağımsız çalışır; trafikleri Anthropic
> sunucuları üzerinden gider. Wix MCP'yi bu şekilde bağlamak da bir seçenek olabilir, ancak
> `wix login` ve `release` komutları oturumun kendi ağını kullandığı için **alan adı listesi
> yine de gereklidir.**

### 5.3 Ağ açıldığında ne yapacağım

1. `wix login` → resmî OAuth (tarayıcı adımını yalnızca siz tamamlarsınız)
2. `wix whoami` + hesap/site listesi → **salt okunur doğrulama**, hiçbir değişiklik yapmadan
3. Ücretsiz hesapta `release`/`publish` koşullarını **canlı olarak** teyit
4. Wix Forms alan sınırlarının 5 alanlık formumuzu karşıladığını teyit
5. Bulguları raporlayıp önerilen yolu uygulamaya hazır hale getirme

---

## 6. Güncel öneri (canlı doğrulama beklemede)

**Managed Headless `connect` + statik HTML + Wix Forms.**

| Ölçüt | Bu yol |
|---|---|
| **Tasarıma birebir sadakat** | ✅ Dosyanın kendisi sunulur — yeniden kurulum yok |
| **Gerçek yayımlama desteği** | ✅ Resmî CLI (`release`/`publish`), Wix altyapısında barındırma |
| **Form yönetimi** | ✅ Wix Forms; gönderimler Wix panosunda, bildirim/otomasyon hazır |
| **Wix panosundan yönetim** | ✅ Arka uç `manage.wix.com/dashboard/<SITE_ID>` üzerinden |
| **Görsel editörde öğe düzenleme** | ❌ Bu yol onu vermez — ama böyle bir şart verilmedi |

Görsel editörde öğe düzenleme ileride şart haline gelirse, bu karar yeniden değerlendirilmeli:
o şart ile birebir sadakat Wix üzerinde aynı anda sağlanamıyor ve ödünleşme açıkça konuşulmalı.

### Doğrulanmamış kalan noktalar (dürüst liste)

1. Ücretsiz hesapta `release`/`publish` gerçekten çalışıyor mu — **canlı teyit bekliyor**
2. Ücretsiz pakette Wix reklam bandının headless sitede görünüp görünmediği — **teyit bekliyor**
3. Wix Forms'un ücretsiz paket alan/form sayısı sınırları — **teyit bekliyor**
4. `release` mi `publish` mi — CLI sürüm farkı — **teyit bekliyor**
5. Form uçtan uca teslimat — **hiç test edilmedi** (Bölüm 4)

Bunların hiçbirini çalışıyor diye raporlamıyorum. Hepsi ağ açıldıktan sonraki ilk turda
kapatılacak.
