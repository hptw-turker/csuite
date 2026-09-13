# Word revize kontrol listesi (Musa TEKLER · 04.08.2026)

Kaynaklar
- `CSuite-İşveren_Sekmesi_Yorumlar_-Musa_TEKLER-04.08.2026.docx`
- `CSuite-Aday_Sekmesi_Yorumlar_-Musa_TEKLER-04.08.2026.docx`

Okuma yöntemi: her iki `.docx` ZIP olarak açılıp `word/document.xml` doğrudan
ayrıştırıldı (paragraflar + tablolar + biçim). Renk kodu: **kırmızı `EE0000`
(çoğu üstü çizili) = eski metin**, **yeşil `00B050` = önerilen yeni metin**,
sarı vurgulu "Sayfa N" = bölüm işareti. Her iki dosyada da
`word/comments.xml` yok; yani Word yorumu bulunmuyor, tüm talepler gövdede.
İzlenen değişiklik de yok (`w:ins`=0, `w:del`=0).

"Sayfa 1–6" tek sayfanın bölümleri olarak ele alındı; yeni sayfa açılmadı.

Durum kodları: **UYGULANDI** = kod bu turda doğrulandı ve belgedeki yeşil
metinle birebir eşleşiyor · **BU TUR** = bu turda eklendi/düzeltildi.

## İŞVEREN sekmesi

| # | Bölüm | İstenen değişiklik (yeşil metin) | Durum |
|---|-------|----------------------------------|-------|
| İ1 | Sayfa 1 · menü | `Neden C-suite` → **Neden C-Suite** | UYGULANDI (menü, mobil menü, footer) |
| İ2 | Sayfa 1 · hero | "Yanlış bir üst düzey atama; **şirketiniz için** yön, kültür ve rekabet gücü kaybıdır. Doğru lider çoğu zaman **açık iş ilanlarına başvurmaz.** Biz ona doğrudan ulaşır…" | UYGULANDI |
| İ3 | Sayfa 1 · CTA | Menüdeki sağ üst düğme kalsın, **Ön Görüşme Planlayın** olsun | UYGULANDI (`#navCta` / `#mnavCta`) |
| İ4 | Sayfa 1 · CTA | "Hem menü çubuğunda hem de sayfa altında … gerekli değil" → sayfa altındaki tekrar kaldırılsın | UYGULANDI (sabit mobil `.mcta` bloğu, CSS'i ve JS'i tamamen kaldırıldı) |
| İ5 | Sayfa 1 · CTA | Düğmeye basınca açılan ekran biraz yukarı taşınsın | UYGULANDI (`href="#formTop"`, `#formTop{scroll-margin-top:32px}`) |
| İ6 | Sayfa 2 · başlık | "Yanlış bir üst düzey atamanın riskini en baştan **azaltın**." (belgedeki "minimize edin/azaltın" ikilisinden seçilen) | UYGULANDI |
| İ7 | Sayfa 2 · açıklama | 2. seçenek: "Yanlış üst düzey atama bir gider kalemi değil; zaman, kültür ve performans kaybı yaratan stratejik bir risktir." | UYGULANDI (belgedeki fazladan kapanış tırnağı alınmadı) |
| İ8 | Sayfa 2 · kartlar | 01-02-03 numaraları **beyaz** olsun | UYGULANDI (`.art .athumb .ai{color:#fff}`; eski `.55` saydamlık istisnası kaldırıldı) |
| İ9 | Sayfa 2 · kart 01 | Başlık seçeneklerinden **Doğru Liderle Temas**; metin "Onlara **doğrudan ilişkiyle** ve gizlilikle ulaşırız." | UYGULANDI |
| İ10 | Sayfa 2 · kart 02 | **Kültürel Eşleştirme**; "**Bizim için önemli olan** "yapabilir mi?" değil, "burada başarılı olur mu?" sorusudur." | UYGULANDI (belgede eksik olan kapanış tırnağı tamamlandı) |
| İ11 | Sayfa 2 · kart 03 | **Kontrollü Süreç Yönetimi**; "… **iş dünyası tarafından fark edilmeyen** gizli arama." | UYGULANDI |
| İ12 | Sayfa 2 · CTA | "Aday haritası talep edin→" → **Lider Profilinizi Belirleyelim** | UYGULANDI |
| İ13 | Sayfa 3 · başlık | "Telefonu açan bir network" → **Doğrudan ulaşılabilen bir network** | UYGULANDI (ortak bölüm) |
| İ14 | Sayfa 3 · alt başlık | **Sadece veri tabanı değil, doğrudan yakın ilişki.** | UYGULANDI |
| İ15 | Sayfa 3 · açıklama | "…ekosistem**.** **Klasik hizmet sunan** search firmalarında bulunmayan kalıcı bir avantaj." | UYGULANDI (kısa çizgi kaldırıldı) |
| İ16 | Sayfa 3 · sayaçlar | Başlıklar büyük harfle: **Üst Düzey Yönetici / Aday Ekosistemi / HPTW Şirketi / İK Yöneticisi**, açıklamalar nokta ile biter, "ölçümlü"→**ölçümlenmiş** | UYGULANDI |
| İ17 | Sayfa 3 · vurgu | "Kopyalanamaz avantajımız: … sürecin **tam** içindedir. … **yetkinlik eksikliğinden** değil, kültürel uyumsuzluktan doğar." | UYGULANDI (baştaki "—" kaldırıldı) |
| İ18 | Sayfa 4 · başlık | **Hız için dijital altyapı, Karar için nitelikli danışman** | UYGULANDI |
| İ19 | Sayfa 4 | Alt başlıkların kelime başları büyük harf | UYGULANDI (Tanımlama / Ağdan Tarama / Kültürel Eşleştirme / Kısa Liste / Yerleştirme & Takip) |
| İ20 | Sayfa 4 · 01 | **Tanımlama** — "İhtiyaç, kültür ve başarı kriterleri netleşir." | UYGULANDI |
| İ21 | Sayfa 4 · 02 | **Ağdan Tarama** — "… pasif adaylar dahil **doğru lider aday havuzu** oluşturulur." | UYGULANDI |
| İ22 | Sayfa 4 · 03 | **Kültürel Eşleştirme** — "Adayın liderlik tarzı**nın** ve değerleri**nin** kurum kültürünüzle **uyumu** değerlendirilir." | UYGULANDI |
| İ23 | Sayfa 4 · 04 | **Kısa Liste** — "**Detaylı raporlarıyla birlikte size yalnızca en uygun adaylar sunulur.**" | UYGULANDI |
| İ24 | Sayfa 4 · 05 | **Yerleştirme & Takip** — "**İş teklifi, işe giriş ve oryantasyon süreci boyunca uyum tarafımızca yönetilir.**" | UYGULANDI (başlık, onaylanan büyük harfli biçimde) |
| İ25 | Sayfa 5 · tablo | Satır adları: **Adaylara Erişim / Kültürel Uyum / Gizlilik / Sonuç**; "Sezgisel tahmin**lere dayalı**", "**ölçümlenmiş** değerlendirme", "**Bilgi sızıntısı riski yüksek**", "KVKK uyumlu, **bilgi duvarlarıyla yönetilen gizli arama**" | UYGULANDI |
| İ26 | Sayfa 6 · gizlilik | Başlıklar büyük harf; "Kişisel veriler, **yalnızca belirlenen amaç kapsamında ve yetkili erişimle işlenir.**"; "… **şeffaflıkla ve etik** prensiplerle yönetilir." | UYGULANDI |

## ADAY sekmesi

| # | Bölüm | İstenen değişiklik (yeşil metin) | Durum |
|---|-------|----------------------------------|-------|
| A1 | Sayfa 1 · menü | **Neden C-Suite** | UYGULANDI |
| A2 | Sayfa 1 · hero | "… tam gizlilik içinde değerlendirin**.** **Her adım sizin onayınızla ilerlesin.**" (kısa çizgi yerine nokta) | UYGULANDI |
| A3 | Sayfa 1 · CTA | Menüdeki sağ üst düğme Aday tarafında **Gizli Görüşme Planlayın** olsun | UYGULANDI (`setView` etiketi tarafa göre değiştiriyor) |
| A4 | Sayfa 1 · CTA | Sayfa altındaki tekrar eden düğme kaldırılsın | UYGULANDI |
| A5 | Sayfa 1 · CTA | Açılan ekran biraz yukarı taşınsın | UYGULANDI |
| A6 | Sayfa 2 · başlık | **Gizliliğinizi koruyarak, doğru fırsatları değerlendirin.** | UYGULANDI |
| A7 | Sayfa 2 · açıklama | "… zayıflatır; **aktif bir şekilde iş aramak** ise mevcut rolünüzü riske atar." | UYGULANDI |
| A8 | Sayfa 2 · kartlar | 01-02-03 **beyaz** | UYGULANDI |
| A9 | Sayfa 2 · kartlar | Başlıklar büyük harf: **Tam Gizlilik / Yalnızca Doğru Fırsat / Kariyer Ortaklığı** | UYGULANDI |
| A10 | Sayfa 2 · kart 02 | Açıklama "getiririz" değil **"sunarız"** ile bitsin | UYGULANDI |
| A11 | Sayfa 3 | Network başlığı, alt başlığı ve açıklaması (İ13–İ15 ile aynı ortak bölüm) | UYGULANDI |
| A12 | Sayfa 3 · sayaçlar | 500+, CXO 100, 500+, 4000+ başlıkları büyük harf (İ16 ile aynı) | UYGULANDI |
| A13 | Sayfa 3 · vurgu | İ17 ile aynı | UYGULANDI |
| A14 | Sayfa 4 · başlık | **Hız için dijital altyapı, Karar için nitelikli danışman** | UYGULANDI |
| A15 | Sayfa 4 | Alt başlıkların kelime başları büyük harf | UYGULANDI |
| A16 | Sayfa 4 · 01 | "Tanışma" → **Tanımlama** — "Hedefleriniz ve hassasiyetleriniz gizli bir görüşmeyle anlaşılır." | UYGULANDI |
| A17 | Sayfa 4 · 02 | "Profil & yön" → **Profil & Kariyer** | UYGULANDI |
| A18 | Sayfa 4 · 03 | **Doğru Eşleşme** | UYGULANDI |
| A19 | Sayfa 4 · 04 | **Süreç Yönetimi** — "Görüşme, müzakere ve teklif **süreci sizinle birlikte** değerlendirilir." | UYGULANDI |
| A20 | Sayfa 4 · 05 | "Sonrası" → **Yerleştirme & Takip** — "**Yerleşim sonrası** oryantasyon boyunca uyumunuz takip edilir." | UYGULANDI |
| A21 | Sayfa 5 · tablo | Satır adları **Gizlilik / Fırsatlara Erişim / Eşleştirme / Uzun Vadeli İlişki**; "**İtibar ve mevcut kariyer riski**", "**Yalnızca onayınızla ilerleyen kontrollü süreç**", "**Herkese açık roller**", "**İlan yoluyla açıklanmayan ilişki temelli fırsatlar**", "Tek seferlik aracı**lık**", "**Kariyer boyu ortaklık**" | UYGULANDI |
| A22 | Sayfa 6 · gizlilik | İ26 ile aynı (ortak bölüm) | UYGULANDI |

## Belgedeki açık yazım/noktalama hataları (düzeltilerek uygulandı)

| Belge | Belgedeki hâli | Sayfadaki hâli |
|-------|----------------|----------------|
| İşveren · Sayfa 2 kart 02 | `"burada başarılı olur mu? sorusudur.` (kapanış tırnağı eksik) | `"burada başarılı olur mu?" sorusudur.` |
| İşveren · Sayfa 2 açıklama (2. seçenek) | Cümle sonunda açılmamış `”` var | Fazladan tırnak alınmadı |
| İşveren · Sayfa 4 · 05 | Başlık yeşil metinde `Yerleştirme & takip` yazılmış; aynı sayfadaki "alt başlıkların kelime başları büyük olmalı" notuyla çelişiyor | `Yerleştirme & Takip` |
| Aday · Sayfa 6 | `… yetkili erişimle işlenir` (nokta yok; İşveren belgesinde nokta var) | `… yetkili erişimle işlenir.` |

## Uygulanmayan / kapsam dışı bırakılan talep

Yok. Her iki belgedeki tüm kırmızı→yeşil metin değişiklikleri ve biçim notları
sayfaya işlendi. Belgelerde yeni sayfa, yeni istatistik veya yeni tasarım
yaklaşımı talebi bulunmuyor; bu yüzden hiçbir şey eklenmedi.
