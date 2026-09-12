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
Aşama ≤3 denetimi, `B-088`…`B-096`, ve backend beklemeyen beş iş (SEO,
a11y taraması, tema, `canAddAlternatives`, bağımlılıklar). Burada yalnız
**hâlâ geçerli olanlar** var.

## Kasıtlı boşluklar — sorulmadan "düzeltilmez"

| Boşluk | Neden böyle |
|---|---|
| **Sonuç ekranında PDF önizlemesi yok** | Ölçülmüş bir karar: react-pdf ~300 KB ve gösterebileceği tek yeni şey PDF'in kendisi. *(Aynı satır bir zamanlar uygunluk raporunu da sayıyordu; rapor `B-041` ile indi ve 2026-08-25'te gerçek uca karşı doğrulandı. Kasıtlı boşluk listesi bayatlayabiliyor — denetlenmesi gerekiyor.)* |
| **"Bir sayfadan kısa CV" notu yazılmadı** | `pageCount` tam sayı ve sunucu "sayfa dolmadı" diye bir sinyal göndermiyor. Sinyalsiz yazılırsa her CV'de çıkar. |
| **`keep_top_pinned` düğmesi çizilmiyor** | Şema sabitlenmiş atomları isteğe koyacak bir alan yayımlamıyor; çizilse basılınca hiçbir şey yapmazdı. |
| **Metin düzenleme düz metin, mark'ları düşürüyor** | Mark farkında editör kural 4'ün lazy-load edeceği bileşen ve henüz yok. Kabul edilebilir olmasının tek sebebi **söylenmesi**: atomun gerçekten mark'ı varsa kaydetmeden **önce** uyarı çıkıyor (P8). |
| **Sözcükleme tek başına silinemiyor** | Sunucuda iki ayrı kural var (B-036); silinmek istenen şey madde. Uç fonksiyonu ve iki reddi de üreten mock duruyor. |
| **Profil başında dil eksenleri düzenlenemiyor** | `sourceLanguage`/`enabledLanguages` **içerik dili** ekseni (Bölüm 38.1), arayüz dili değil. Form ikisini de olduğu gibi geçiriyor ve ikisi de gövdede zorunlu (B-035). ⚠ **Gerekçesi bayatladı ve düzeltildi (2026-09-08):** satır "hangi diller sunulabilir `capabilities`'e bağlı ve o yayımlanmadı" diyordu — `allowedLanguages` yayımlanıyor ve okunuyor, gerçek uca karşı `["en","tr"]`. Bekleyen bağımlılık yok; kalan şey **çizilmemiş bir kontrol**, yani karar. Denetimde 8 satırın 7'si doğru çıktı, bu biri değil. |
| **Bölüm düzeni seçtiren arayüz yok** | `sections.layout` beş değer alıyor (`B-073` ile `paragraph` da) ama hiçbir ekran onu göstermiyor ya da seçtirmiyor; sunucu her bölüm türü için doğrusunu zaten yazıyor. Çizilecekse beşinin de ICU adı ve About için `paragraph` varsayılanı gerekir — yarım hâli kullanıcıya anlamını bilmediği bir seçim verir. |
| **Elle aç/kapa arayüzü yok** | Hangi atomların tartıldığını yayımlayan uç yok (`F-031`). Profil atomlarından çizilse, tartılmamış atom `400` döndüğü için basılamayacak düğmeler olurdu. İstemci fonksiyonu hazır. |
| **Emekli üretimden halefe bağlantı yok** | Telde işaret yok, geçmiş de emekli satırı listelemiyor. Not yazılıyor, bağlantı yazılmıyor — aynı `F-031`. |
| **"Yeniden hesaplanıyor…" göstergesi yok** | § 33.3 istiyor, durumu yayımlayan uç yok, ve `B-091` ekranda bir şey gerekmediğini söylüyor. Beklenmeyen bir iş için bekleme hissi üretmek olurdu. |
| **`format=source` düğmesi yok** | Uç bugün `400` dönüyor (`B-094`). Çizilse hata paneline basardı; mock reddi üretiyor ki bir gün çağıran olursa orada görülsün. |
| **Başvurularda duruma göre süzme yok** | `B-093`: sayfalama gerektiğinde birlikte geliyor. Filtresi olmayan bir liste, filtresi olan bir ucın taklidinden iyidir. |

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
  105). Elle ölçülenler: sonuç 219.3, unsubscribe 213.6.