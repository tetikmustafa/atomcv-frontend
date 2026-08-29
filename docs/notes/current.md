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

### Kapanmış dilimlerin kaydı

Dilim 0 (temel), 1 (oturum), 2a (OAuth yolu) ve 2b (magic link, Turnstile,
`Retry-After`) kapandı; kayıtları `archive/stage-3-slices-0-2.md`'de. Bu
dosya 400 satırla sınırlı ve aşama sürüyor, o yüzden kapanan her dilim
oraya taşınıyor — aynı kural, aşama yerine dilim ölçeğinde.

### Dilim 3a — CV yükleme ve zorunlu geçit · 2026-08-29

`B-051`, `B-053`, `B-060` kapandı. § 31.6'nın gözden geçirme ekranı **yarım
indi ve yarısı inemez** — sebebi `F-018`.

**`F-018` açıldı, ve iki şey soruyor.** `JobStatusResponse` yalnız
`generationId` ile `pageCount` yayımlıyor; içe aktarma işinin terminal
alanları (`profileId`, üç sayı, `detectedLanguage`) şemada **yok**, yani
`GET /jobs/{id}` bir içe aktarmanın sonucunu hiç söyleyemiyor ve sayfa
yenilenince kayboluyor. `pageCount`'ın `B-041` öncesi hâlinin aynısı. İkincisi
daha ağır: § 31.6 "sorunlu bölümler otomatik açık" ve "kritik uyarılar
Onayla'yı kapalı tutar" diyor, ama telde yalnız bir **sayı** var — hangi
bölümün sorunlu olduğunu söyleyen hiçbir alan yok, ve § 31.4.1 zaten
`warnings[]`'in frontend'e çıkmadığını söylüyor. **Uydurmadık:** bölümler
kapalı, "şu kadar konuda emin olamadık" notu, Onayla hep aktif.

**Geçit bir kilit değil ve öyle olduğunu iddia etmiyor.** Sunucu tarafında
geçildiğini kaydeden bir şey yok — kaydedebilecek bir uç da yok. Ürünün
borcu, sunduğu hiçbir yolun bu ekranın etrafından dolaşmaması; adres çubuğuna
`/profile` yazan biri aynı editöre varır.

**Gözden geçirme ekranı editörün kendisi.** § 31.6 "ayrı moda geçme yok"
istiyor, ki `ProfileEditor` zaten o: bölümler kapalı başlıyor, alanlar kendini
kaydediyor. Salt-okunur bir kopyası, doğru tutulacak ikinci bir şey olurdu.

**Dosya seçici hiçbir şeyi filtrelemiyor.** `accept` cazip ve yanlış: kabul
listesinin tek sahibi var ve sunucu onu `415`'te yayımlıyor. Kopyayla süzen
bir seçici, sunucu yeni bir biçim okumaya başladığı gün onu gizlemeye devam
ederdi.

**`useJobStream` `useGeneration`'dan çıktı.** İçinde generation'a ait hiçbir
şey yoktu; ikinci bir iş türü gelince adı yalan oldu. `useJob.ts`'te, ve
terminal yükü artık **bütün** olarak saklanıyor (`result`) — çünkü içe
aktarmanın alanlarının `JobStatus`'ta yeri yok ve burada ikinci bir kopyasını
yazmak onları iki yerde tutmak olurdu.

**Multipart'ta `Content-Type`'ı biz yazmıyoruz.** Başlık **boundary** taşıyor
ve onu yalnız tarayıcının serileştiricisi biliyor; elle yazmak, parçaları tam
olan bir gövdeden "eksik parça" 400'ü aldırır. Negatif kontrol yapıldı: elle
yazınca uç uçtan uca ölüyor, on altı testin on altısı kırılıyor.

**Test ortamında `FormData`, `File` ve `Blob` Node'un.** Tarayıcıda seçtiğin
dosya ile onu yollayan `fetch` tek bir gerçeklemedir; burada iki: jsdom dosya
API'lerini, Node `fetch`'i veriyor. Ölçülen iki ayrı arıza — jsdom'un
`FormData.append`'i Node `Blob`'unu **reddediyor** ve Node `File`'ını sessizce
metne çeviriyor; jsdom `File`'ı Node'un serileştirdiği bir gövdede **akışı hiç
bitmeyen** bir istek üretiyor (`request.text()` çözülmüyor, beş saniyelik
timeout olarak geliyor). Üçü **birlikte** değiştirildi; yarım takas ilk
arızayı üretiyor. `FormData`'nın import edilecek bir modülü yok, `undici`'ye
uzanmak MSW'nin bağımlılık ağacına bağlanmak olurdu — sınıf bir `Response`'a
gövde ayrıştırtarak alınıyor.

**409 kontrolü `isAccount()`'tan geçiyor, modül bayrağından değil** — ve bunu
tarayıcı testi buldu. Handler önce `session.authenticated` okuyordu: Vitest'te
doğru, tarayıcıda yanlış, yani `PROFILE_ALREADY_EXISTS` orada hiç
ateşlenmiyordu. Dilim 2b'nin "depolama yarısı yalnız Playwright'ta sınanabilir"
kaydının ikinci örneği.

**`PROFILE_QUOTA_EXCEEDED` artık kime söylendiğine göre dallanıyor** (`B-053`).
Anonim hak **adrese** göre sayılıyor, yani "hakkını doldurdun" cümlesi
okuyucuyu aynı ofisteki bir yabancı için suçlar. Ayrımı sunucu yapamaz;
istemci yapar. `caller` `MESSAGE_DEFAULTS`'a girdi ve `useErrorMessage`
oturumu **önbellekten okuyor, abone olmuyor** — `useSession` `staleTime: 0`
olduğu için her hata paneli bir oturum isteği açardı, yani cümle yazan bir
şey sessizce istek atan bir şeye dönerdi. Bedeli üç testin sarmalayıcısına bir
`QueryClientProvider`; üretimde zaten hep var.

**İçe aktarma işi `label` göndermiyor ve mock da göndermiyor.** Yayımlanmış
bir faz anahtarı yok; `generation.phase.EXTRACTING` uydurmak, sunucunun hiç
göndermeyeceği bir belirteci hem tele hem kataloğa koymak olurdu. Ekran kendi
cümlesini yazıyor — kural 8 sunucunun sahip olduğu metni yönetiyor, ekranın
kendi hakkında söylediğini değil. `F-018`'in son sorusu bu.

**`MockJob` iki iş türünü birden taşıyor ve dosyanın adı bunu yalanlıyor.**
`generationFixture` artık her işin durumunu tutuyor, çünkü `GET /jobs/{id}`
iki yere bakamaz. Bölmek doğru olanı ve **ertelendi**, unutulmadı.

**Bütçe:** `/en/onboarding` **217.0** (statik, betiğin ölçtüğü), review
**252.2** KB (dinamik, elle). Ölçülenler: profil 251.3 → **251.7**, üretim
215.7 → **215.9**, pazarlama 168.4'te sabit.

### Dilim 4 — cover letter · 2026-08-29

`B-056` kapandı. Ekran sonuç sayfasında; üretim formuna bir anahtar eklendi.

**Reddedilen taslak kırmızı panelde çizilmiyor.** `COVER_LETTER_REJECTED`
isteğe değil **taslağa** verilmiş bir hüküm: mektubun arkasında orijinal yok,
o yüzden aşırıya kaçan bir cümlenin yerine basılacak bir şey de yok ve taslak
atılıyor. Okuyucu bir şey yanlış yapmadı, düzeltecek bir şey de yok. Kural 7
delinmiyor: panelin var olma sebebi *sunucunun* ne sunulacağına karar
vermesi, ve buradaki tek resolution `retry` — onu taşıyacak düğme zaten
ekranda duruyor ("başka bir taslak dene"). `declined`'da (`B-048`) verilen
kararın aynısı.

**`Accepts<>` düzeltildi ve sebebi tam olarak bu uç.** Gövdesi **bütünüyle**
opsiyonel bir uç `requestBody?` ilan ediyor (`{}` geçerli bir istek), ve eski
koşul yalnız `requestBody:` ile eşleşiyordu — sonuç `never`, ve çağrı yerinde
"argument of type … is not assignable to parameter of type never" diye
görünüyordu, gövdeyle ilgisi olduğu hiç belli olmadan. `NonNullable` ile
düzeldi; gövdesiz uçlar `requestBody?: never` ilan ettiği için etkilenmiyor.

**Mektup önbelleğe yazılıyor, yeniden çekilmiyor.** Yanıt mektubun kendisini
taşıyor ve sunucu saklananı değiştirdi. Bu, "sonuç ekranındaki düzenlemeler
yerel durum değildir" kuralının kapsadığı durum **değil**: o kural CV'yi
düzenlemenin Faz C'den itibaren boru hattını yeniden koşturmasıyla ilgili.
Mektup yalnız mektubu değiştiriyor.

**Bu uç `Retry-After` göndermiyor** ve mock da göndermiyor. `B-056` yalnız
`params.resetsAt` yayımlıyor, yani `429` cümlesi süreyi kuramıyor ve dilim
2b'de yazılan "birazdan tekrar dene" dalına düşüyor — o dalın gerçekten
kullanıldığı tek yer burası, ve testi de burada.

**`issues` hâlâ sayılmıyor** (`F-017` bekliyor). Altı değer makine belirteci;
sözlüğün kapalı olduğu doğrulanınca ICU'da adlandırılacak.

**Bütçe:** üretim 215.9 → **219.4** (Radix `Switch`), profil 251.7 →
**252.0**. Sonuç ekranı dinamik, elle **215.8** KB.

### Dilim 5 — bayat sözcükleme · 2026-08-29

`B-052` kapandı, ve kasıtlı boşluklardan biri **kapandı**: "bayat sözcüklemeyi
yeniden üretecek kontrol yok" satırı artık yanlış, çünkü hem uç hem de
`stale`'i true yapan iş yayımlandı.

**Mesaj bir çiftten kuruluyor, tek bayraktan değil** — ve ikisini birleştirmek
§ 32.2'nin önlemeye çalıştığı hata. Düzenlenen bir sözcüklemeden türeyen her
şey bayatlanıyor (kişi ayrıştıklarını bilmeye hak sahibi), ama yalnız kişinin
**yazmadıkları** kuyruğa giriyor: birinin kendi cümlesini, o kişi öteki dilde
bir yazım hatası düzeltti diye makine çevirisiyle değiştirmek ürünün onu
sessizce ezmesidir. Üçüncü satır bu yüzden soruyor.

**"Benim halimi koru" hiçbir şey göndermiyor**, ve sayfa yenilenince uyarı
geri geliyor. Eksik değil: satır gerçekten hâlâ bayat, kapatılan şey yalnız bu
okumaydı. Sunucuya kaydedilecek bir "reddettim" hâli de yok.

**Bileşen sekme şeridinin içinde değil, alanın yanında.** Tek sözcüklemeli bir
atomun şeridi yok — `VariantTabs` yalnız birden fazlada çiziliyor — ve orada
kalsaydı böyle bir atom bayat olduğunu hiç söyleyemezdi.

**"Yeniden yaz" ikinci uyarıya dönüşüyor, kaybolmuyor.** Sunucu bayrağı
temizliyor ama satır **bayat kalıyor**; yenileme arka plan işi. Mock'un da
`stale`'i temizlememesi bu yüzden önemli — temizleseydi ekranın mesajı olan tek
durum atlanırdı, ve negatif kontrol tam olarak onu yakalıyor.

**Mock `{userEdited: true}`'ü reddediyor** — istemci hiç göndermese de. Kabul
eden bir mock, istemciye çalıştığını öğretirdi. Reddin **şekli** bizim
okumamız (`400 VALIDATION_FAILED`), maddede yayımlanmış değil; hiçbir şey ona
bağlı olmadığı için sorun değil, ve yorumda öyle yazıyor.

**Bir test seçici yüzünden kırıldı ve düzeltmesi kayda değer.** `VariantTabs`
testi önizlemeyi "rol taşımayan paragraf" diye seçiyordu; `StaleWording` panele
kendi paragrafını koyunca o tarif başka bir şeyi gösterdi. Komşuluğu tarif eden
bir seçici, komşu değişince sessizce yanlış şeyi iddia ediyor — metnine ve
`span` seçicisine geçti.

**Bütçe:** profil 252.0 → **252.2**.

---

## Kasıtlı boşluklar — sorulmadan "düzeltilmez"

| Boşluk | Neden böyle |
|---|---|
| **Sonuç ekranında PDF önizlemesi yok** | Ölçülmüş bir karar: react-pdf ~300 KB ve gösterebileceği tek yeni şey PDF'in kendisi. *(Aynı satır bir zamanlar uygunluk raporunu da sayıyordu; rapor `B-041` ile indi ve 2026-08-25'te gerçek uca karşı doğrulandı. Kasıtlı boşluk listesi bayatlayabiliyor — denetlenmesi gerekiyor.)* |
| **"Bir sayfadan kısa CV" notu yazılmadı** | `pageCount` tam sayı ve sunucu "sayfa dolmadı" diye bir sinyal göndermiyor. Sinyalsiz yazılırsa her CV'de çıkar. |
| **`keep_top_pinned` düğmesi çizilmiyor** | Şema sabitlenmiş atomları isteğe koyacak bir alan yayımlamıyor; çizilse basılınca hiçbir şey yapmazdı. |
| **Metin düzenleme düz metin, mark'ları düşürüyor** | Mark farkında editör kural 4'ün lazy-load edeceği bileşen ve henüz yok. Kabul edilebilir olmasının tek sebebi **söylenmesi**: atomun gerçekten mark'ı varsa kaydetmeden **önce** uyarı çıkıyor (P8). |
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
- **Profilin tamamı değiştiğinde `invalidateWholeProfile`**, asla
  `profileKeys.all`: o anahtar atom başına anahtarların da öneki ve onların
  arkasında uç yok. İki çağıranı var, aynı anlamda — cascade silme ve içe
  aktarma.
- **Terminal yük bütün olarak saklanıyor** (`useJob`'ın `result`'ı). İki iş
  türü iki farklı şey söylüyor ve `JobStatus` yalnız birini tarif ediyor.
- **Multipart'ta `Content-Type`'a dokunulmaz.** Boundary'yi tarayıcı yazar.
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
- **Bundle:** `/[locale]/profile` **251.7 / 83.3 KB**, `/[locale]/generate`
  **215.9 / 47.5 KB**, `/[locale]/onboarding` **217.0 / 48.6 KB** (tavan
  `bundle-budget.json`: 280 / 105). Elle ölçülenler: review 252.2, verify
  212.5, login 210.4 KB.
