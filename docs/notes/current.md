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

### Aşama 3'ten devrolan iki açık

Kod işi değil, ikisi de bir ürün ya da altyapı kararını bekliyor:

- **Gizlilik politikasının sağlayıcı listesi eksik.** E-posta yolu adıyla
  yazılı (Resend → AWS SES `ap-northeast-1`), ama **hangi LLM'e ne gittiği**
  yazılamıyor: model seçimi ürün kararı olarak duruyor ve o paragraf onunla
  birlikte yazılacak. Yayın öncesi kontrol listesi bu yüzden açık.
- **OAuth sıçraması ile Turnstile hiç ölçülmedi.** İkisi de kendi
  anahtarlarıyla yapılandırılmış bir dağıtım istiyor; bugün doğrulanan şey
  mock'a karşı. Dağıtım ayağa kalktığında ilk ölçülecek ikisi bunlar.

### `B-071`-`B-074` kapandı (2026-09-08)

Backend'in kapanış sonrası dilimlerinden gelen dört madde. İkisi kod işi
çıkardı, ikisi çıkarmadı — ve çıkarmama sebepleri kayda değer.

- **Yedinci `ExtractionWarningCode` (`unsupported_by_source`) yalnız bir ICU
  dalı istedi.** `ImportWarning.code` `B-069`'dan beri **açık** okunuyor, o
  yüzden tip tarafı sessizdi: dal gelene kadar uyarı `other`'a düşüyor ve
  "bir şey netleştirilemedi" diyordu. Kırık bir şey yok, yalnızca söylenmeyen
  bir şey vardı — açık okunan her sözlükte aynı boşluk mümkün.
- **`no_responsibilities` telden kalkınca bir test nöbeti kayboluyordu.**
  `F-016`'nın kontrolü — refüzün *sayımı suçlamaması* — `wireErrors`'ta tam o
  yakalanmış yükün üzerinde duruyordu (18 yetenek bulunmuş, yine reddedilmiş).
  Yük silinince kontrol `errorCatalogue`'a taşındı ve artık `too_few_skills`
  dışındaki **her** nedene karşı koşuyor. Yakalanmış yük dosyasına uydurma bir
  yük konmadı: o dosyanın tek değeri gövdelerin gerçekten gönderilmiş olması.
- **`paragraph` ile yedinci kod yalnızca `npm run gen:api` ile geldi.** İkisi
  de üretilen birliği genişletmekten başka bir şey yapmadı; canlı şemada
  `no_responsibilities` hiç geçmiyor — neden sözlüğü zaten şemada değil, hata
  kataloğunda.
- **Ortak fixture'a hiçbir şey eklenmedi.** Ne yedinci uyarı ne de bir `about`
  bölümü: ikisi de ekrandaki davranışı değiştirmiyor, ama `warningCount` ve
  `sectionCount` bekleyen birim + e2e testlerini oynatırdı. Fixture bir örnek
  listesi değil, davranış taşıyor — yeni bir kod, yeni bir davranış değil.

### Aşama ≤3 denetimi (2026-09-08)

"Bir eksik kaldı mı" sorusuna karşı, backend ayaktayken. Bulunan tek şey bir
**gerekçe**, bir eksik değil — aşağıdaki dil ekseni satırı.

- **İki kanal da boş.** `to-frontend.md`'de `OPEN` yok; `to-backend.md`'de de
  yok (`F-025`-`F-027` cevaplandı, dosya yalnız cevapları taşıdığı için sınırın
  üstünde).
- **`contracts.ts` kuralına uyuyor.** Geriye yalnız üç SSE olayı kaldı ve
  şema `text/event-stream`'i `unknown` olarak üretiyor — yani şemanın taşıdığı
  bir ucu tarif etmiyor. Boşaltacak tip yok.
- **§ 31.6.4'ün "kritik uyarı" kuralı spec'ten kaldırılmıştı**, ve orada
  "yedinci bir kod gerçekten engelleyici olursa karar burada verilir" yazıyor.
  `B-071` yedinciyi getirdi ve **engelleyici değil** dedi; Onayla hep aktif
  kalıyor, yani ekran hâlâ spec'in dediği şeyi yapıyor.
- **Kapılar:** typecheck · 658 birim · 51 e2e · lint · prettier · bütçe
  (`npm run size` — hepsi tavanın altında) · üretim chunk'larında `setupWorker`
  yok (MSW sızıntısı kontrolü).
- **Aşama 3'ten devrolan tek kod işi hâlâ açık ve kasıtlı:** `MockJob` iki iş
  türünü birden taşıyor, `generationFixture`'ı bölmek ertelendi
  (`archive/stage-3.md`, dilim 3a). Davranış değil, isimlendirme.

---

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
| **Dark mode bağlı değil** | CLAUDE.md · *Deferred by Decision*. Yarım uygulamak kullanıcıya değiştiremeyeceği bir tema verir. |

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
- **Bundle:** `/[locale]/profile` **252.3 / 83.9 KB**, `/[locale]/generate`
  **219.5 / 51.1 KB**, `/[locale]/onboarding` **217.1 / 48.7 KB**,
  `/[locale]/settings` **228.5 / 60.1 KB** (tavan `bundle-budget.json`:
  280 / 105). Elle ölçülenler: review 252.2, sonuç 216.3, verify 212.5,
  login 210.4 KB.
