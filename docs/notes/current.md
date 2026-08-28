# İnşa Notları — Aktif (frontend)

> Kural: bu dosya **400 satırı geçmez**. Aşama bitince `archive/`'a taşınır.
> Bu dosya **backend'e senkronize edilmez** — repo-yerel.
>
> Aşama 2'nin tam kaydı `archive/stage-2.md`'de. Aşağıdakiler oradan
> **taşınanlar**: hâlâ geçerli olan kurallar ve kasıtlı boşluklar. Bir şeyin
> *neden* öyle olduğunu arıyorsan önce burası, sonra `rg` ile arşiv.

---

## Aşama 3 — hesap ve MVP

Plan: `spec/14-build-guide.md` § XI-A.6 · frontend sırası
`spec/15-repos-and-claude.md` § XI-B.9.2.

Aşama 2 tam olarak kapandı (uygunluk raporu dahil, `B-040` ve `B-041` ile).
Backend'in Aşama 3'ü telde: dilimleme `B-044`-`B-061`'i sekiz dilime bölüyor,
sıra **temel → oturum → giriş → yükleme → cover letter → bayat varyant →
editör → kapanış**. Sebebi tek cümlede: CSRF her yazma isteğinin önünde.

### Dilim 0 — temel · 2026-08-29

`B-044` · `B-045` · `B-047` · `B-055` kapandı; kayıtları
`handoff/resolved/to-frontend-2026-08.md`'de. Burada duran şey **koda dair
olan**, madde metni değil.

**`gen:api` çalıştı ve 728 satır getirdi — hiçbir şey kalkmadan.** Aşama 3'ün
tamamı yayımlanmış: on bir yeni operasyon (`session`, `logout`, `request`,
`verify`, `providers`, `start`, `callback`, `importCv`, `coverLetter`,
`feedback`, `delete_1`), dokuz yeni hata kodu, iki yeni resolution.

**Typecheck'in verdiği on hatanın onu da tasarlanmış alarmdı.** Kataloğun
tüketicilik kapısı (`Uncovered extends never`) dokuz kodu ve iki action'ı tek
tek saydı. Aşama 2'de yazılan kapının ilk gerçek işi buydu ve çalıştı: yeni bir
kod, kimsenin yazmadığı bir mesaj olarak değil, **derlemeyen bir dosya** olarak
geldi.

**`coverLetter` üretilen tipte zorunlu çıkıyor** — şemada `required` dizisi
yok, ama openapi-typescript `default`'u olan alanı zorunlu sayıyor;
`acknowledgePreflight` de aynı sebeple zaten öyleydi. Gövdeye `false` yazıldı,
opsiyonele çevrilmedi: `generations.ts`'in kendi yorumunun `acknowledgePreflight`
için verdiği gerekçe burada da geçerli — istemediğini **söyleyen** gövde
sürüklenemez.

**CSRF çerezi her istekte yeniden okunuyor, önbelleğe alınmıyor.** Sunucu
tokenı döndürürse önbellekli kopya tek reddi kalıcı redde çevirir; `B-044`'ün
"tekrar deneme, yeniden oku" cümlesinin koddaki karşılığı bu. Üç tuzak teste
yazıldı: yüzde-kodlanmış değer (`+`, `=` taşıyan base64 token ham gönderilirse
hiç eşleşmez), çerez yokken **başlığın hiç gönderilmemesi**, ve isim
karşılaştırmasının tam olması — `other=XSRF-TOKEN` diye bir çerez kavanozda
duruyorsa önek eşleşmesi onu bulur.

**Negatif kontrol yapıldı:** başlığı kuran üç satır kaldırılınca altı testin
dördü kırılıyor. Geçen ikisi *yokluk* iddiaları (GET'te başlık yok, çerezsizken
başlık yok) ve doğru davranışları bu — kırılmamaları beklenen sonuç.
**MSW başlığı hiç denetlemiyor**, yani bu davranış sessizce kaybolabilirdi;
testlerin var olma sebebi tam olarak bu.

**`contracts.ts` iki tip daha eksildi.** `Capabilities` ve `SessionResponse`
artık şemada; `lib/api/endpoints/auth.ts` ikisini de **türetiyor**. Türetme
düz `Required<>` değil: § 35.7 dört bayrağı, iki kotayı ve iki sayacı her iki
oturum türü için de garanti ediyor, o yüzden onlar zorunlu — bir yetenek kapısı
üç değerli olursa `undefined` sessizce "yapamaz" dalına düşer ve kullanıcının
sahip olduğu özelliği gizler. Gerçekten değişen üçü (`maxAtoms`,
`quotaResetsAt`, `anonymousExpiresAt`) opsiyonel kaldı: `B-046` hesapta
**JSON'da hiç yok** diyor, şema `nullable` diyor, ve ikisi de okunabiliyor.

**Mock artık `anonymousExpiresAt` gönderiyor ve her istekte yeniden hesaplıyor.**
Donmuş bir an, TTL'in kaydığını (§ 35.7) göremeyen bir ekranı da geçirirdi.

**`REWRITING` yalnız katalog anahtarı değildi.** Anahtarı eklemek `B-055`'in
istediği şeydi, ama fazı hiç görmemiş bir ekran %60'ta boş bir başlık çizer ve
bunu hiçbir test yakalamaz — o yüzden `SCHEDULE`'a da girdi. Bedeli iki birim
testi ve bir e2e sayısı; ödenmeye değer, çünkü ikisi de fazın **gerçekten**
aktığını doğruluyor.

**`COVER_LETTER_REJECTED`'ın mesajı `issues`'ı saymıyor, ve bu geçici.** Altı
değer makine belirteci (`unsupported_claim`, `cliche`…); ham basılırsa ekrana
`unsupported_claim ve cliche` çıkar. Aynı gerekçe `REWRITE_VALIDATION_FAILED`'da
da uygulanmıştı. Sözlüğün kapalı olup olmadığı `F-017` ile soruldu; cevap
gelince dilim 4'te (cover letter ekranı) altısı da adlandırılacak.

**`RATE_LIMITED` bugün `resetsAt`'ten kuruluyor, `Retry-After`'dan değil.**
`B-050` süreyi başlıktan kurmayı istiyor ve haklı — kullanıcının saati
yanlışsa doğru olan tek şey o. Ama `Retry-After` bir **başlık**, ve `toApiError`
bugün gövdeden başka bir şey okumuyor. Cümle o yüzden maddenin "yalnız şu
saatte tekrar deneyin yazacaksanız kullanın" dediği biçimde yazıldı; başlığı
okuyan hâli, onu ilk gerçekten gösterecek ekranla (dilim 2, magic link formu)
birlikte iniyor.

### Dilim 1 — oturum · 2026-08-29

`B-046` kapandı; madde kaydı `resolved/`'da. Kodda kalan şeyler:

**`useSession` iki varsayılanı geçiyor ve ikisi de gerekçeli.** `staleTime: 0`
— 30 sn'lik varsayılan editörün yüzlerce atom anahtarı için var ve içinde saat
olan bir değer için tam olarak yanlış. `refetchOnWindowFocus: true` — genelde
kapalı, çünkü autosave sekme değişimiyle kavga etmemeli; burada **tam da olay
bu**, doksan dakika sonra sekmeye dönen kişi süre bildiriminin yazıldığı kişi.

**Bildirim `Date.now()` okumuyor, `dataUpdatedAt` okuyor** — ve bunu lint
buldu (`react-hooks/purity`). Kural saflık için var ama asıl kazanç başka:
render sırasında saati okuyan bileşen, kimsenin planlamadığı bir render'da
saatin ne dediğini gösterir, yani bildirim geç, erken ya da hiç çıkmaz.
`dataUpdatedAt` pencereye tek bir anlam veriyor — **sunucunun söylediği anda
ne kadar kaldığını söylediği** — ve yeni cevap indiğinde yeniden
değerlendiriliyor. Yanılma yönü de güvenli: kişi çalışırken istekleri TTL'i
ileri kaydırıyor, bu sayı geride kalıyor, bildirim erken çıkıyor.

**Eşik on beş dakika, ve sebebi çıkış yolunun süresi.** Bildirimin işi girişe
yönlendirmek; giriş bir e-posta beklemek ve bir bağlantıya tıklamak demek.
Çaresinden kısa süre tanıyan bir uyarı yalnızca kaybın duyurusudur. Daha uzunu
iki saat boyunca duran, dolayısıyla okunmayan bir şerit olurdu.

**Kapı gizliyor, kilitlemiyor.** İki yüz atomun her birinin yanında tekrarlanan
kilitli bir kontrol, kişinin kendi çalışmasının ortasına konmuş bir satış
konuşmasıdır; § 9 **daha dar** bir ürün vaat ediyor, dırdır eden bir ürün
değil. Ve elle kontrol zaten isteğe bağlı — varsayılan çıktı iki halde de aynı.
Oturum yüklenirken kapı kapalı (`=== true`): görünüp kaybolan bir kaydırıcı
arada sürüklenebilir ve yazma reddedilir.

**`useCapabilities` atom başına çağrılıyor, prop olarak geçirilmiyor.** İki yüz
gözlemci tek bir cache girdisine bağlanıyor; takas bilinçli. Alternatif
capabilities'i bölüm listesinden her entry başlığına kadar taşımaktı, ve iletmeyi
unutan ilk bileşen sessizce kullanılamayacak bir kontrol çizerdi.

**Mock'un tarayıcı kanalı bir bayrak, sahte bir uç değil.** Playwright kendi
sürecinde koşuyor ve MSW handler'ları sayfada; modül durumuna erişemiyor.
`localStorage`'daki `atomcv-mock-session`'ı `addInitScript` yazıyor. Gerçek
backend'de olmayan bir "sahte giriş" ucu uydurmak, handler'lara telde karşılığı
olmayan bir şekil koymak olurdu — bu mock'ların yapmaması gereken tek şey.

**İki e2e testi hesaba taşındı, biri anonim olarak eklendi.** Kaydırıcı ve
toggle testleri hesabın kontrollerini deniyordu; artık `asAccount` ile
koşuyorlar. Yeni test anonim kapının **iki yarısını** da sınıyor: kontroller
yok, **sözcükleme duruyor**. Yokluk iddiası oturum yanıtı beklendikten sonra
yapılıyor — beklemeden yazılsaydı kapı silinse bile geçerdi.

**Negatif kontroller yapıldı:** kapı `true` yapılınca anonim testi kırılıyor,
eşik kaldırılınca "vakit varken bir şey söylemiyor" testi kırılıyor.

**Bundle:** profil 250.6 → **251.2**, üretim 214.8 → **215.6** KB. Pazarlama
rotaları 168.3'te sabit — `SessionNotice` yalnız `(app)` altında.

### `B-043` — bir kodun arkasındaki sekiz sebep

`F-016`'nın dönüşü. Sekiz sebep tek `errors.*` anahtarında, **ICU `select`**
ile — `Fit.level` ve `Usage.metric` ile aynı kalıp, resolver'a dokunmadan.

**Ölçülen ve koda yazılan şey:** next-intl'de eksik bir `select` argümanı
mesajı **kendi anahtar yoluna** çeviriyor (`errors.UNPARSEABLE_JOB_DESCRIPTION`
ekranda), bilinmeyen bir *değer* ise `other` dalına düşüyor. İkisi hiç
benzemiyor ve ilki sessiz: içinde süslü parantez olmadığı için katalog
testinin brace kontrolü onu **kaçırıyordu**.

- `useErrorMessage` artık `SELECT_DEFAULTS` ile `reason`'ı garanti ediyor.
  Gerçek params üstüne yazıyor, hiç ezmiyor.
- Katalog testi `rendered !== code` **ve** `errors.` içermemeyi de sınıyor.
  Negatif kontrolü yapıldı: `reason`'ı params'tan çıkarınca iki katalog da
  düşüyor, brace kontrolü ise geçiyor — delik tam oradaydı.
- Ön kontrol / kapı ayrımı kopyaya işlendi: ön kontrol **kullanıcının
  metnini** reddetti (yol göster), kapı **modelin cevabını** (metni suçlama).

**Mock artık kapıyı da taşıyor.** Önceden yalnız ön kontrol vardı ve o
senkron; kapı reddi **akıştan** geliyor ve **iki** resolution getiriyor.
`gateRefusal()` bunu üretiyor, `failNextJob(error?)` yerleştiriyor. Hata
**işin üstünde** taşınıyor, fixture'da değil: iş oluşturulurken alınıyor,
akış anında okunuyor, arada gelen ikinci bir iş bunun hatasını miras almasın.

**Testte ölçülen bir tuzak:** `user.type` karakter başına olay gönderiyor;
birkaç yüz karakterlik gerçek bir ilan 5 sn sınırını aşıyor, **ve yarıda
ölen test yarım yazılmış metni `too_short` yaptırıp geç bir POST'u bir
sonraki testin `bodies`'ine düşürüyor**. Üç yeni test kırılırken iki eski
test de onunla kırıldı. `user.paste`'e geçildi — ekranın kendi metni de
zaten "yapıştır" diyor.

**`gen:api` çalıştı: fark yok.** Tahmin doğruydu ama artık ölçüldü.

**Gerçek uca karşı üç red görüldü** — `too_short` (422, üç resolution),
`too_few_skills` ve `no_responsibilities` (ikisi de akıştan, iki resolution,
`continue_anyway` yok). Sonuncusu `F-016`'nın şikâyetinin kendisi: **güven 1,
18 beceri, yine de red.** Yükler `tests/unit/i18n/wireErrors.test.ts`'e
alındı — katalog testi *bildirilen* params'a karşı, o dosya *gerçekten gelen*
yüke karşı; `B-043` ikisinin ayrıştığı yerdi.

**`suspicious_output` telde görülemedi — ve görülememesi doğru sonuç.**
`gpt-4.1-nano` uzun beceri adlarını normalleştiriyor, üç ilan denendi. Backend
cevapladı (2026-08-25): bu bir *incelik* değil **şekil** denetimi — § 18.4'ün
uzunluk tavanları, ve tavanlar gerçek bir ilanın ürettiğinin çok üstünde
duruyor, çünkü uzun ama gerçek bir sorumluluğu reddeden bir kapı hiç kapı
olmamasından kötü. Kapıyı açan şey enjeksiyon; uslu bir modele ilan yazdırarak
açılması **beklenmiyor**. Backend'de `PlausibilityGateTest` onu kurgulanmış
analizle doğrudan sınıyor. **Açık uç değil, kapandı.**

**Kapı sırayla bakıyor** — `low_confidence` → `too_few_skills` →
`no_responsibilities` → uzunluk (§ 18.4, "Sıra önemlidir"). Sekiz dallı
`select` için anlamı: hem zayıf hem bozuk bir ilan bize `too_few_skills` olarak
gelir. `suspicious_output` "sayılar yerinde ama şekil bozuk" hâlinin adı — o
dalın telde neden nadir olduğunu açıklayan şey bu. Koda dokunmuyor.

### Aşama 2'ye sonradan eklenen: `B-042` — CV dilinin notu

Gerçek uca karşı test ederken çıktı, ve çıkış yolu kaydedilmeye değer:
**önce ekranda bir tuhaflık görüldü** (Türkçe maddelerin üstünde İngilizce ay
adları), sebebi backend'de bulundu (`F-013`), backend üçüncü bir çözüm seçti
ve alanları yayımladı, biz de cümleyi yazdık. Üç repo-turu, tek oturum.

Kural artık şu: **bir belge tek dilde yazılır**, ve `auto` ilanın diline
yalnız profil o dilde gerçekten yazılabiliyorsa çözülür. Yazılamıyorsa CV
profilin dilinde kalır ve `contentLanguage` ile `postingLanguage` ayrışır —
notun çizildiği tek durum bu.

- **Karşılaştırma birincil alt etiket üzerinden.** `en` ile `en-GB` bir
  dildir; ham `!==` kullanıcıya CV'sinin yanlış dilde çıktığını söylerdi.
- **`languageNames.ts` kuralın tek sahibi.** İkinci çağrı yeri olunca
  çıkarıldı; `VariantTabs` da oradan okuyor. Bir `Intl` kuralının ikinci
  kopyası ikisinin ayrışma yoludur.
- **Türkçe metin çekim eki almıyor** — "Türkçe yazıldı", "İngilizce değil".
  Dil adı yerine geçen bir kalıpta ek, ilk başka dilde kırılır.
- **Not, uyarı değil.** İnce profilin notuyla aynı gerekçe: bozulan bir şey
  yok, tekrar denenecek bir şey yok.

Bu geçici ve geçiciliği kasıtlı: § 21.8'in çeviren fazı indiğinde alanlar aynı
değeri taşımaya başlar ve not kendiliğinden çizilmez olur. Bayrak arkasına
konmadı — silinecek şey, kapatılacak şey değil.

---

## Kasıtlı boşluklar — sorulmadan "düzeltilmez"

| Boşluk | Neden böyle |
|---|---|
| **Sonuç ekranında PDF önizlemesi yok** | Ölçülmüş bir karar: react-pdf ~300 KB ve gösterebileceği tek yeni şey PDF'in kendisi. *(Aynı satır bir zamanlar uygunluk raporunu da sayıyordu; rapor `B-041` ile indi ve 2026-08-25'te gerçek uca karşı doğrulandı. Kasıtlı boşluk listesi bayatlayabiliyor — denetlenmesi gerekiyor.)* |
| **"Bir sayfadan kısa CV" notu yazılmadı** | `pageCount` tam sayı ve sunucu "sayfa dolmadı" diye bir sinyal göndermiyor. Sinyalsiz yazılırsa her CV'de çıkar. |
| **`keep_top_pinned` düğmesi çizilmiyor** | Şema sabitlenmiş atomları isteğe koyacak bir alan yayımlamıyor; çizilse basılınca hiçbir şey yapmazdı. |
| **Metin düzenleme düz metin, mark'ları düşürüyor** | Mark farkında editör kural 4'ün lazy-load edeceği bileşen ve henüz yok. Kabul edilebilir olmasının tek sebebi **söylenmesi**: atomun gerçekten mark'ı varsa kaydetmeden **önce** uyarı çıkıyor (P8). |
| **Bayat sözcüklemeyi yeniden üretecek kontrol yok** | Ne uç ne de `stale`'i true yapacak iş yayımlandı (B-024). Çalışamayacak düğme, zaten bir şeyin bozuk olduğunu söyleyen ekranda hiç yoktan kötü. |
| **Sözcükleme tek başına silinemiyor** | Sunucuda iki ayrı kural var (B-036); silinmek istenen şey madde. Uç fonksiyonu ve iki reddi de üreten mock duruyor. |
| **Profil başında dil eksenleri düzenlenemiyor** | `sourceLanguage`/`enabledLanguages` **içerik dili** ekseni (Bölüm 38.1), arayüz dili değil. Hangi dillerin sunulabileceği `capabilities`'e bağlı ve o yayımlanmadı. Form ikisini de olduğu gibi geçiriyor ve ikisi de gövdede zorunlu (B-035). |
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
  hiç yoktur.
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
- **Bundle:** `/[locale]/profile` **250.6 / 82.3 KB**, `/[locale]/generate`
  **214.8 / 46.4 KB** (tavan `bundle-budget.json`: 280 / 105).
