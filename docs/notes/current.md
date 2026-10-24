# İnşa Notları — Aktif (frontend)

> Kural: bu dosya **400 satırı geçmez**. Aşama bitince `archive/`'a taşınır.
> Bu dosya **backend'e senkronize edilmez** — repo-yerel.
>
> Aşama 3'ün tam kaydı `archive/stage-3.md`'de, Aşama 2'ninki
> `archive/stage-2.md`'de. Aşağıdakiler oradan **taşınanlar**: hâlâ geçerli
> olan kurallar ve kasıtlı boşluklar. Bir şeyin *neden* öyle olduğunu
> arıyorsan önce burası, sonra `rg` ile arşiv.

---

## Aşama 4 — olgunlaşma (sürekli)

Plan: `spec/14-build-guide.md` § XI-A.7. **Sabit bir sıra yok** — öncelik
kullanıcı geri bildirimiyle geliştiricinin kendi kararından çıkıyor; § 55'in
listesi referans. Önerilen sıranın başı Faz G (doğal dil düzenleme), sonra ek
şablonlar ve başvuru takibi.

Aşama 3 iki tarafta da kapandı (2026-09-02): on üç dilim, açık `B-nnn` de
`F-nnn` de yok, ve dağıtım isteyen ikisi dışında her yol gerçek uca karşı
ölçüldü.

### Kapanış sırası — karar 2026-09-20

**D1…D14 kapandı ve kaydı `archive/stage-4.md`'de** (oraya 2026-09-21'de
taşındı, 400 satır sınırı yüzünden). Bir dilimde neyin neden öyle yapıldığını
arıyorsan `rg -n "D1 kapandı" docs/notes/archive/`.

**Hâlâ geçerli olan tek şey kapsam kararıydı:** § XI-A.7 "sabit sıra yok"
diyor ve bu doğru; o serbestlik bir kez kullanıldı, ve kapsam § 55'in `[F]`
kalemlerinin tamamıydı — kasıtlı boşluklar dahil. Blog ve üçüncü arayüz dili
kapsam dışı bırakıldı, ikisi de frontend'in kendi kararıyla; gerekçeleri
arşivde.

### Kapanış denetimi ve son arayüz (2026-10-23 / 10-24)

**Üç paralel denetim** (spec↔kod, tel kapsaması, arayüz) işlevleri neredeyse
tam buldu ve görsel katmanı değil: stok gri shadcn, `src`'de 7 responsive
sınıf, 375px'te taşan bir başlık, kart/rozet/iskelet/boş durum yok. Görsel yön
**monokrom ve cilalı** seçildi (kullanıcı kararı): kırık beyaz sayfa üstünde
beyaz kartlar, tek renk hâlâ yıkıcı kırmızı. Kayıt satır satır commit'lerde;
burada yalnız sonradan sorulacak olanlar.

- **Kabuk.** `lg`'den yukarı yapışkan kenar çubuğu, altında başlık + `Sheet`;
  ikisi de tek `AppSidebar`. Sheet kapalıyken içeriği DOM'da yok — bu yüzden
  link adları iki kez görünmüyor. Footer kök layout'tan çıktı, her alan kendi
  çiziyor. Arayüz dili için `LocaleSwitcher` (uygulama) ve düz linkler
  (pazarlama, 0 KB JS korunuyor).
- **Ekleme — `NativeSelect`.** Dokuz el yapımı `<select>` tek stile indi; Radix
  select değil, çünkü telefonda platform seçicisi daha iyi ve popper her rotaya
  kilobayt eklerdi.
- **Ekleme — atom kartı katlanır.** Kontroller "Ayrıntılar"ın arkasında,
  durumları rozet olarak görünür. Testler `tests/support/atomDetails.ts` ile
  düğmeye basarak açıyor.
- **Sapma — başvuru takibi "varsayılan açık" değil, tek basış.** Konsept § 9
  "varsayılan açık" diyor; sonuç ekranı ilanın rolü/şirketiyle (`B-124`) ön
  dolu bir kart sunuyor ve basılmayı bekliyor: gönderilmeyebilecek bir
  başvurunun kaydını kendiliğinden yazmak kişinin planı hakkında bir tahmin olurdu.
- **PDF önizleme isteğe bağlı yükleniyor**: her indirme belgeyi yeniden derliyor
  (§ 57.4, saklama yok), kendiliğinden yüklenen önizleme her ziyarette bir
  derleme olurdu. CSP `frame-src blob:` backend'de eklendi.
- **Başvuruda `generationId` yoksa artık bir şey iddia edilmiyor.** "O CV
  silindi" diyordu; elle eklenen her satırda da `null`, tel ikisini ayıramaz.
- **Profili silme** (`DELETE /profile`) — şema ölçüldü: `generations` ve
  `template_customizations` `profiles`'tan `CASCADE`, başvurular `SET NULL`.
  Onay metni bunu söylüyor.
- **Backend'e bu turda giden düzeltmeler:** `B-120`…`B-124` (yazı tipi
  sözlüğü, mektup dili, içe aktarma fazları, `keepPinned`, sonuçta rol/şirket +
  misafire giriş/bölüm kontrolleri kapalı), OTLP log anahtarı, script modları,
  log rotasyonu, frontend health-check, `APP_BASE_URL` muhafızı.
- **İkinci tur (2026-10-24) — konseptte olup kimsenin görmediği beş şey.**
  (1) **ATS doğrulaması** (konsept § 10.1) her PDF'te koşuyordu, sonucu yalnız
  bir sayaca gidiyordu: backend V18 ile saklıyor (`B-125`), sonuç ekranında
  "Makine okunabilirliği" kartı. Kusur cümlesi şablonu suçluyor, CV'yi değil
  (§ 23.2: raporlar, reddetmez). (2) **`verified`** hiçbir ekrandan
  yazılamıyordu; genel modda skorun %15'i. Misafire de açık — sunucu onu
  kontrol saymıyor. İpucu yalnız genel modu vaat ediyor, çünkü ilanlı skorlama
  onu okumuyor. (3) **Başvuruyu sonradan CV'ye bağlama** (`ApplicationUpdate.generationId`);
  bağ koparılamıyor (alan yok), bu yüzden "bağlı değil" yalnız bağsız satıra
  sunuluyor. (4) **Metni yapıştırma**: `.txt` olarak aynı yüklemeden gidiyor
  (sunucu `TXT` okuyor) — aynı challenge, kota ve retler. (5) Mektubu
  **`.txt` indirme**, istemcide: sunucunun render edeceği bir şey yok.
  Ayrıca GitHub önerilerinde yıldız/bağlantı/diller, form id'leri `useId`
  (iki form aynı anda açıkken çakışıyordu), dokuz ölü çeviri anahtarı silindi.

### Dağıtım günü — sırayla denenecekler

Kod tarafında hiçbiri beklemiyor; hepsi **ölçüm** bekliyor.

1. **İmajı `--build-arg NEXT_PUBLIC_SITE_URL=…` ve
   `--build-arg NEXT_PUBLIC_TURNSTILE_SITE_KEY=…` ile kur** (Dockerfile,
   2026-10-24). İkisi de derlemede gömülüyor; konteynere sonradan verilen ortam
   değişkeni hiçbir şeyi değiştirmez. Site URL'si yoksa canonical, hreflang,
   `robots.txt` ve `sitemap.xml` localhost'u adlandırır; site anahtarı yoksa
   widget çizilmez ve prod — challenge'ı zorunlu tutan — her girişi ve misafir
   işlemini `CHALLENGE_FAILED` ile reddeder. Dockerfile bu argümanları
   **almıyordu** (kapanış turunda bulundu).
2. **CSP'yi gözle** (`B-100`). Politika `default-src 'self'` idi ve
   Turnstile'ın script'iyle iframe'ini sessizce blokluyordu — düzeltildi, ve
   düzeldiğinin tek kanıtı widget'ın çizilmesi.
3. **OAuth sıçraması** (`B-048`), **sihirli bağlantının Turnstile'ı**
   (`B-050`), **`B-083`'ün challenge'ı.** Üçü de bugüne kadar yalnız mock'a
   karşı doğrulandı. `B-100` üçünün önündeki kapıyı açtı, yani sıra bu.
4. **Yayımlanan gizlilik sayfasını `ProcessorAudit`'in açılış satırına karşı
   oku** (`B-076`'dan kalan tek şey).
5. **Analitik kararı yeniden açılır.** Umami, huni ölçümü — artık ölçümü
   alacak bir yer var.
6. **Sentry kararı da yeniden açılır** (2026-09-21). Aynı gerekçe, ve şimdiye
   kadar hiçbir yerde yazılı değildi — aşağıdaki tabloya bak.
7. **`deploy.yml`.** CI action'ları `@v5` ve bu yalnız push'ta doğrulanabilir;
   `@v4` revert.

### Aşama 3'ten devrolan açıklar

- ~~**Gizlilik politikasının sağlayıcı listesi eksik.**~~ **Bayat çıktı
  (2026-09-12).** Satır "hangi LLM'e ne gittiği yazılamıyor, model seçimi
  ürün kararı olarak duruyor" diyordu; `Legal.privacy.shareBody` **OpenRouter
  ile arkasındaki dört sağlayıcıyı adıyla saydığı gibi modeli de yazıyor**
  (`openai/gpt-5.6-sol`), ve karar 09-09'da kapanmıştı. Kalan tek şey
  **dağıtım işi**: yayımlanan sayfayı `ProcessorAudit`'in açılış satırına
  karşı okumak. — *İkinci bayat satır bu; listenin kendisi denetlenmek
  istiyor, ve 2026-09-08'de bir tanesi zaten böyle yakalanmıştı.*
- **OAuth sıçraması ile Turnstile hâlâ ölçülmedi.** İkisi de kendi
  anahtarlarıyla yapılandırılmış bir dağıtım istiyor; bugün doğrulanan şey
  mock'a karşı. Dağıtım ayağa kalktığında ilk ölçülecek ikisi bunlar.
- **Alan adı yok.** `NEXT_PUBLIC_SITE_URL` yoksa localhost'a düşüyor, ve
  canonical / hreflang / `robots.txt` / `sitemap.xml` hepsi ondan kuruluyor.
  Dağıtım ayarlayacak (2026-09-12).

### Kapanan dilimlerin kaydı

`archive/stage-4.md`'de, dilim ölçeğinde: `B-071`-`B-074`, `B-075`-`B-084`,
Aşama ≤3 denetimi, `B-088`…`B-096`, backend beklemeyen beş iş (SEO, a11y
taraması, tema, `canAddAlternatives`, bağımlılıklar), **D1…D14'ün tamamı** ve
`B-097`-`B-099`. Burada yalnız **hâlâ geçerli olanlar** var.

## Kasıtlı boşluklar — sorulmadan "düzeltilmez"

**2026-10-24'te baştan sayıldı.** Tablonun on üç satırından dokuzu ya kapandı ya
zaten bayattı (kodda vardı): PDF önizleme, `keep_top_pinned` (`B-123`),
`fontFamily`'nin dördüncüsü (`B-120`), başvuru filtresi, mark farkında editör
(D13), profil dil eksenleri (D13), bölüm düzeni (D13), sözcüklemeyi tek başına
silme (D13), "bir sayfadan kısa" notu (`B-118`). Kalanlar:

| Boşluk | Neden böyle |
|---|---|
| **"Yeniden hesaplanıyor…" göstergesi yok** | § 33.3/§ 37.5 istiyor, durumu yayımlayan uç yok, ve `B-091` ekranda bir şey gerekmediğini söylüyor. Beklenmeyen bir iş için bekleme hissi üretmek olurdu. |
| **Atom başına skor gösterilmiyor** | Konsept § 10.3 "skor görünürlüğü" diyor; § 35.3.1 skoru **bilerek** yayımlamıyor (madde yanındaki sayı kişinin kendi emeği hakkında bir hüküm gibi okunur). Eşleşen terimler ve dışarıda kalma nedeni gösteriliyor. |
| **Sentry bağlı değil** | Gönderilecek yer yokken yazılan kod çalıştığını hiç görmeyeceğimiz bakım yükü; dağıtım günü listesinde. |
| **Uygulama içi sürüm duyurusu yok** | Bir sürümü yayımlayan uç yok; banner iki tarafın da sahip olmadığı bir doğruluk kaynağı olurdu. `CHANGELOG.md` var. |
| **Profil tamamlanma eşiği üretim düğmesini önceden kilitlemiyor** | Şema yalnız `completeness` (yüzde) veriyor, hangi şartın eksik olduğunu değil; ret `INSUFFICIENT_PROFILE` + `complete_profile` çözümüyle geliyor. Eksik listesi yayımlanırsa düğme önceden konuşabilir. |


---

## Dosyalar arasına yayılan değişmezler

Tek bir dosyaya bakarak görülmeyenler. Çağrı yerlerindeki yorumlar ayrıntıyı
taşıyor; burada yalnız **nerede olduğu** var. Aşama 1'in profil değişmezleri
`archive/stage-1.md`'de, Aşama 2'ninkiler `archive/stage-2.md`'de.

- **Sürüm cache'ten gelir, çağırandan değil**, ve sunucunun sürüm artırdığı her
  yerde önbellek **yazılarak** tazelenir — yalnız invalidate edilerek değil.
- **Atomlar öğe başına cache'lenir, write-through, asla invalidate edilmez.**
  `useAtom`'un `queryFn`'i kasten fırlatıyor.
- **Invalidation gözlemcisiz çalışmaz.** Etkin gözlemcisi olmayan bir sorgu
  refetch edilmez; `setQueryData` ile seed'lenmiş bir anahtarın `queryFn`'i
  hiç yoktur. **`clear()`'dan sonra `refetchQueries` de çalışmaz** — ortada
  sorgu kalmamıştır; oturumu geri okumak için `fetchQuery`.
- **Akış ile `GET /jobs/{id}` tek anahtara yazar.** Geri düşüş ikinci bir
  doğruluk kaynağı değil, aynı kaynağın başka taşıyıcıyla doldurulması.
- **Boş `label` tek bir yerde yutulur** (`toProgress`) — `F-010` orada
  savunuluyor, çağrı yerlerinde değil.
- **`Idempotency-Key` kullanıcının kastettiği deneme başınadır**, çağrı başına
  değil.
- **`If-Match` tırnaklı olmalı ve onu yalnız `toIfMatch` kurar.**
- **`PUT /profile` istisnasız değiştirir**; `PATCH` yokluğu "dokunma" demek.
- **Silme cascade'lidir** ve onay metni sayı vermek zorunda.
- **`Accept` başlığı süs değil.** Spring onunla içerik pazarlığı yapıyor ve
  karşılayamadığını **reddediyor**: PDF üreten uca JSON istemek 406. `getFile`
  bu yüzden `*/*` gönderiyor, ve mock artık aynı reddi üretiyor.
- **Türkçe metni shell argümanından geçirme.** Sondaları dosyaya yazıp `node`
  ile çalıştır.
- **Adlandırılmış tarih formatları `lib/i18n/formats.ts`'te.** next-intl'in
  yerleşiği yok; tanımsız bir ad hata vermiyor, logluyor ve yedeğe düşüyor.
- **Profilin tamamı değiştiğinde `invalidateWholeProfile`**, asla
  `profileKeys.all`: o anahtar atom başına anahtarların da öneki ve onların
  arkasında uç yok. İki çağıranı var, aynı anlamda — cascade silme ve içe
  aktarma.
- **Terminal yük yayılarak saklanıyor**, alan adları sayılarak değil: `B-067`
  sonrası `JobStatus` iki iş türünü de tarif ediyor, ve burada isim saymak
  şemayla adım uydurulacak ikinci bir liste olurdu.
- **Uyarı kodu kapalı sözlük ama açık okunur** (`domain.ts`), çünkü alan telde
  `String`: düşen bir uyarı `warningCount` iddiasını bozar.
- **Uyarının yeri `displayOrder`'dır, id değil**, ve elimizdeki profile karşı
  çözülür — `ReviewGate` bunun için satır okumaya geri gitmiyor.
- **Multipart'ta `Content-Type`'a dokunulmaz.** Boundary'yi tarayıcı yazar.
- **Hesap silmenin ikinci basışı `204` değil `401`.** Uç idempotent, ama ilk
  yanıt çerezi sildiği için ikinci basış oraya ulaşmıyor; silinmiş hesabı
  gösteren oturum oturum değil (`F-027`). Mock da bunu üretiyor.
- **İşveren adı ilanın içerdiği bir addır ya da alan yoktur** (§ 18.4.1).
  İstemcide yer tutucu ifade kara listesi yok ve olmayacak; mock da aynı
  içerme kontrolünü uyguluyor, `roleTitle` kasten kuralın dışında.
- **Mock'ta "hesap mı" sorusu `isAccount()`'a sorulur.** Modül bayrağı
  tarayıcıda yanlış cevap verir.
- **Seçim listesi bir enstantanedir, profilin görünümü değil.** `text` o CV'nin
  bastığı metindir; bugünkü profilden çizilen bir liste sayfada olmayan bir
  cümleyi kaldırmayı teklif eder. Mock da üretim anında donduruyor, ve
  düzenleme listeyi yeniden tartmıyor — toggle'ları taşıyor.
- **Yalnız yeri değişen satır gönderilir.** İki kez basılmış bir switch
  sunucunun koyduğu yerdedir; onu göndermek "bunu kendisiyle değiştir" demek
  olur, ki uç `202` cevaplayıp aynı belgeyi geri verir — § 24.4'ün üretmeyi
  reddettiği tek sonuç. Ekran bu yüzden **taşınanları** tutuyor, listenin bir
  kopyasını değil.
- **Terminal yük tek yerde üretilir** (`completedOutcome`). § 35.3 artık işin
  `result`'ına yazılan her anahtarın `JobStatusResponse`'ta bir alan olduğunu
  söylüyor, yani akış ile poll aynı nesneyi yaymalı; iki ayrı gövde yazmak
  `F-032`'nin kusurunu geri getirmenin yoludur.

---

## Test ve ölçüm

- **Geçen bir test bir şey kanıtlamaz.** Aşama 2'de iki kez daha ısırdı; ikisi
  de `archive/stage-2.md`'de. Yeni bir değişmez sabitlerken **negatif kontrol
  yap**: düzeltmeyi geri al, testin kırıldığını gör.
- **`role="alert"` iki yerde.** Announcer'ın assertive bölgesi de `alert`, ve
  hep belgede. Kapsamsız bir sorgu önce onu bulur ve içinde düğme olmayan bir
  panel görür — bir kontrolün hiçbir şey kanıtlamadan geçmesinin yolu.
- **Ölçüm gerçek uca karşı yapılır, MSW kapalı.** Aşama 2'nin kapanışında on
  kontrol tarayıcıdan geçti; ikisi gerçek hata buldu (406, ve dev proxy'nin
  SSE'yi tamponlaması).
- **Bütçe betiği yalnız prerender edilmiş rotaları ölçüyor.** Dinamik bir
  rotanın HTML dosyası yok, o yüzden `searchParams` okuyan her sayfa
  (`/login`, `/verify`, `/auth/*`, `/onboarding/review`) sayının dışında
  kalıyor ve elle ölçülüyor: `next start`, aynı gzip yöntemi.
- **Bundle (2026-09-11):** `/[locale]/profile` **253.2 / 84.9 KB**,
  `/[locale]/settings` **240.0 / 71.7** (görünüş bölümü ile +11.5),
  `/[locale]/generate` **222.9 / 54.5**, `/[locale]/onboarding` **219.8 /
  51.5**, `/[locale]/applications` **215.6 / 47.2** (yeni),
  `/[locale]/history` **214.3 / 46.0** (tavan `bundle-budget.json`: 280 /
  105). Elle ölçülenler: sonuç **224.4** (elle toggle ile, 2026-09-12), unsubscribe 213.6.