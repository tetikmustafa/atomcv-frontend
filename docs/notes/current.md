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

Dilim 0 (temel), 1 (oturum), 2a-2b (giriş), 3a (CV yükleme + zorunlu geçit),
4 (cover letter), 5 (bayat sözcükleme), 6 (maddesiz entry) ve 7a (geri
bildirim) kapandı; kayıtları `archive/stage-3-slices-0-2.md`'de. Bu
dosya 400 satırla sınırlı ve aşama sürüyor, o yüzden kapanan her dilim
oraya taşınıyor — aynı kural, aşama yerine dilim ölçeğinde.

### Dilim 7b — hesap silme ve gizlilik politikası · 2026-08-29

`B-057` ve `B-059` kapandı. Bununla backend'in bütün maddeleri bitti;
kalan tek iş `F-018`'in cevabına bağlı olan § 31.6 yarısı.

**Onay ekranı sayıyor, ve saymadığı bir şeyi de uydurmuyor.** Bölüm ile madde
sayısı profilin kendisinden geliyor; **üretim sayısı verilmiyor**, çünkü onu
yayımlayan bir uç yok. Geri alınamayan tek yerde yanlış bir sayı, hiç sayı
olmamasından kötü.

**İki şey kaldığı ekranda söyleniyor**, yalnız politikada değil: maliyet kaydı
bağı koparılmış olarak, ve suppression kaydı **adrese** ait olduğu için. Bunlar
politikaya da yazıldı; okuyanın gerçekten okuduğu yer ise onay kutusu.

**Kapı `capabilities` değil `authenticated`.** Anonim birinin bu özelliğin dar
bir sürümü yok — hesabı yok. Yetenek kümesi bunu söylemiyor ve söylememeli.

**Ve burada gerçek bir hata ölçüldü: `clear()` + `refetchQueries` gözlemcisiz
çalışmıyor.** Notlardaki değişmezin ta kendisi, ve bu dilime kadar
farkedilmemişti: `useLogout` çalışıyordu **yalnızca** oturumu okuyan bileşenin
kendi sebebiyle yeniden render olması sayesinde. Silme düğmesi oturumu okuyan
bileşenin **altında** duruyor, o render hiç gelmiyor, ve ekran artık var
olmayan bir hesabı göstermeye devam ediyordu. Üç hook da `fetchQuery`'ye
geçti — o, gözlemciye ihtiyaç duymadan girdiyi kuruyor.

**Gizlilik politikası artık e-posta yolunu adıyla sayıyor:** Resend, altta AWS
SES `ap-northeast-1` (Tokyo), yani adres ve gönderim üstverisi **AB dışında**
işleniyor. "AB'de işlenir" diyen bir cümle yoktu; eksik olan listeydi. Silme
bölümü de neyin kaldığını ve sağlayıcıların kısa ömürlü kayıt tutabildiğini
söylüyor.

**Bütçe:** `/en/settings` **228.5 / 60.1 KB** (yeni), profil 252.2 → **252.3**,
üretim 219.4 → **219.5**, onboarding 217.0 → **217.1**.

### Dilim 8 — backend'in cevapları · 2026-08-29

`B-062`, `B-063`, `B-064`, `B-065`, `B-067` kapandı; `B-066`'nın yarısı
kapandı ve sorusuna `F-022` ile cevap verildi. Beş `F-nnn`'in beşi de
cevaplanmış olarak döndü, ve **üçünde soru backend'de bir kusur ortaya
çıkardı** — `path`'in iki ayrı hatası, `userEdited`'ın `500`'ü, ve
`Retry-After`'ın yayımlanmamış olması.

**Dakika hesabı tek yerde.** Mektup reddi de kota kapılarıyla aynı yoldan
geçiyor: `retryAfterFrom` başlığı okuyor (yalnız delta-saniye biçimi),
`toRetryMinutes` dakikaya yuvarlıyor. Üç kapıda üç hesap olsaydı biri
bayatlardı.

**Kapalı sözlükler ICU'da adlandırılıyor, ama açık okunuyor.**
`COVER_LETTER_REJECTED`'ın altı `issues` değeri `errorValues.{code}.{value}`
altında; `nameVocabularies` tanımadığını **ham geçiriyor**. Kapalı bir enum,
`gen:api`'nin en son çalıştığı günün fotoğrafıdır — `ResolutionAction`'da
verilen kararın aynısı.

**Terminal yükü genişleten `result` alanı silindi.** `JobStatusResponse` artık
her iki iş türünü de tarif ediyor (`B-067`), yani `useJob`'ın `completed`
işleyicisi yükü **yayarak** yazıyor: alan adlarını burada saymak, şemayla adım
uydurulacak ikinci bir liste olurdu.

**§ 31.6'nın iki kuralı da yerine oturdu.** Sorunlu bölümler otomatik açılıyor
— uyarının `sectionOrder`'ı **elimizdeki** profilin `displayOrder`'ına
çözülüyor, uç satırları adlandırmak için geri okunmuyor — ve Onayla hep aktif,
artık § 31.6.4'ün açık kararı olarak. Fixture'ın `displayOrder`'ı dizideki
sırayla aynı olduğu için test ikisini **ayırıyor**: bir bölümün sırası
değiştirilip listedeki yeri bırakılıyor.

**Açılma toplayıcı, atayıcı değil.** Geçit ekrana her dönüşte uyarılarını
yeniden çözüyor; atayan bir `expandSections` elle açılmış bölümü her dönüşte
kapatırdı. Negatif kontrolün ilk hâli bunu **yakalamadı** — tek bir mount
içinde etki bir kez çalışıyor, yani iddia orada gözlemlenebilir değildi. Test
mount'u yeniden kurmaya çevrildikten sonra ısırdı.

**Uyarılar sayılıyor ve yerleri açılıyor, ama adlandırılmıyor:** şema
`ImportWarning.code`'u düz `string` yayımlıyor. Altı ICU anahtarını tahminle
yazmak `B-067`'nin faz çevirileri için verdiği gerekçenin aynısıyla yanlış
olurdu — `F-023`.

### Dilim 9 — geçmiş ekranı · 2026-08-30

`B-066` kapandı; bununla backend'in bütün maddeleri bitti. `/history`
listeliyor, nav'da duruyor (yalnız URL ile ulaşılan bir rota ulaşılabilir
değil), ve `useInfiniteQuery` ile sayfalanıyor.

**Cursor'ın yokluğu geçmişin sonu.** Boş bir `items` beklemek bir istek geç
kalmak olurdu: okuyan kişi, yükleyecek şeyi kalmamış bir "daha göster"
düğmesi görürdü. Değer opak ve hiçbir yerde ayrıştırılmıyor.

**`total` hesabın sayısı, satır sayısı değil.** Testi 21 satırla kuruldu —
üçle kurulsaydı iki sayı eşit olur ve "sayfadan sayan" bir hata geçerdi.

**Anonim oturuma kilitli kapı yok**, ne aldığını söyleyen bir not var; ve kapı
üç durumlu, çünkü oturum cevap vermeden önce iki cümlenin de yanlış olduğu bir
an var.

**Tamamlanmayan üretimin satırı bağlantı değil.** Arkasında açılacak belge
yok; götüreceği tek ekran, etiketin zaten söylediği hatayı gösterirdi.

**Satır etiketsiz, ve uydurulmadı.** Rol ve şirket `F-022`'de; geldiklerinde
satıra eklenecekler. Bugün satırı adlandıran şey kendi olguları — bağlantının
erişilebilir adı da o, çünkü ekran okuyucuya "aç, aç, aç" diye üç satır
okumak bir liste değildir.

**Ve duran bir kusur çıktı: next-intl'in hiçbir tarih formatı yok.**
`format.dateTime(date, 'short')` `MISSING_FORMAT` logluyor ve bir yedeğe
düşüyor — yani ekran çalışıyor **görünüyor** ve yalnız sunucu günlüğü itiraz
ediyor. Geri bildirim panelinin grant tarihi bunu zaten yaşıyormuş, ve e2e
çalıştırmasının çıktısı olmasa görülmezdi. `formats` artık
`lib/i18n/formats.ts`'te, ve test sarmalayıcıları da aynı nesneyi geçiyor:
testte bir türlü, tarayıcıda başka türlü biçimlenen bir tarih hiçbir şeyin
yakalamayacağı bir fark.

**Bütçe:** `/en/history` **213.8 / 45.5 KB** (yeni). Ötekiler formats ile
birlikte kıpırdadı: profil 252.5, üretim 220.3, onboarding 217.3, ayarlar
229.8, paylaşılan 168.4.

### Dilim 10 — gerçek uca karşı doğrulama · 2026-08-30

Backend ayakta (`make record`), MSW yok, `curl` ile. `npm run gen:api` **fark
üretmedi** — telde duran şema, commit'lediğimizle aynı.

**İçe aktarmanın kapı sırası ölçüldü, ve yazdığımız sıra yanlıştı.** Bizde
415 → 413 → 409 vardı; telde **413 → 409 → 415/422**. Sebep "hangisi ucuz"
değil, **hangisi nerede yaşıyor**: 413 Spring'in kendi multipart sınırı ve
controller'a girilmeden ateşliyor, 409'u da controller dosyaya bakmadan önce
soruyor. Mock düzeltildi. **Bunu iddia eden bir test vardı ve geçiyordu** —
§ 31.2'nin okuma sırasını doğru varsayıp sabitlemişti; şimdi ölçülen sırayı
sabitliyor ve gerekçesi testin içinde duruyor.

**Telde doğrulananlar:** `{"userEdited": true}` → `400` + `fields`
(`B-064`); `405`, `406`, `415` (`B-063`) ve dördünün de katalogda mesajı var;
`rating: 0` → `400`, `rating: 1` → `200`, ve `GET /generations/{id}` gövdesinde
`feedback` (`B-065`); cursor'lu ikinci sayfa, bozuk cursor'ın
`400 fields:["cursor"]`'ı, `limit` kırpması ve hesabın `total`'i (`B-066`);
CSRF'siz yazma `403 CSRF_TOKEN_INVALID` (`B-044`, ilk kez telde); mektup
ucunun `400 fields:["style"]` ve `404 RESOURCE_NOT_FOUND` redleri.

**Bir kusur çıktı:** `file` parçası olmayan içe aktarma isteği `500`
dönüyor — `B-064`'ün aynısı, başka bir istisnayla. Arayüzümüzden ulaşılmıyor;
`F-024`.

**Üçü hâlâ ölçülmedi, ve sebepleri farklı:** OAuth ile Turnstile kendi
anahtarlarıyla yapılandırılmış bir dağıtım istiyor; **hesap silme ile mektup
üretimi ise kasten çalıştırılmadı** — biri geliştiricinin yerel hesabını
gerçekten siler, öteki bir LLM çağrısı harcar. İkisinin de reddedilen yolları
ölçüldü, başarı yolları ölçülmedi.

### Dilim 11 — uyarıların adı, satırın etiketi · 2026-08-30

`B-068`, `B-069`, `B-070` kapandı. `F-022`-`F-024`'ün üçü de cevaplanmış
döndü ve ikisi iki ekranın eksiğini kapattı.

**Kapalı sözlük açık okunuyor, ve bu sefer gerekçe sunucudan geldi.**
`ImportWarning.code` şemada enum, telde `String`: değer JSONB'den geri
okunuyor ve adı sonradan değişmiş bir kod taşıyan eski satır, tip enum olsa
düşerdi — düşen uyarı da `warningCount == warnings.length` iddiasını bozardı.
`domain.ts` `ImportWarningCode`'u `ResolutionAction` kalıbıyla açıyor,
`JobStatus` `warnings`'i onunla değiştiriyor, tanınmayan kod genel cümleye
düşüyor. Mock'un `imported.warnings`'i de açık tipte — kapalı olsaydı mock, bu
davranışın var olduğu tek durumu üretemezdi.

**Satırdaki iki adı bir tire ile birleştirmedik, ve sebebi ölçüm.** Telde
duran bir `roleTitle` `"Integration Engineer — Legacy Systems"`. Birleştirilmiş
bir etiket *"… — Legacy Systems — Acme"* olurdu ve hangi tirenin bizim olduğu
belli olmazdı. İki ayrı öğe; erişilebilir ad virgülle birleştiriyor.

**Ve aynı ölçüm bir kusur çıkardı:** `companyName` bir satırda `"not
specified"` — `""` değil, yani "boş dize dönmez" kuralı tutmuyor. İstemcide
çözmek yer tutucu ifade kara listesi demek olurdu (`"belirtilmemiş"`, `"N/A"`,
ve modelin yarın yazacağı); `F-025`'e yazıldı, ekran bugün geleni gösteriyor.

**Bütçe:** `/en/history` 213.8 → **213.9**, ötekiler değişmedi.

### Dilim 12 — kalan iki yol da ölçüldü · 2026-08-30

Geliştiricinin onayıyla, `make record` ayaktayken: **mektup üretimi** (gerçek
LLM çağrıları) ve **hesap silme** (yerel hesabı gerçekten siler). Bunlarla
birlikte, dağıtım isteyen ikisi (OAuth, Turnstile) dışında her yol telde
görüldü.

**Mektup: dört taslağın dördü de reddedildi.** `default`, `shorter`,
`shorter`, `more_formal`+`companyNote` — ilk üçü `number_invented` +
`length_out_of_range`, dördüncüsü üstüne `cliche`. Dördüncünün farklı çıkması,
tek bir fixture'ın tekrar oynatılmadığını gösteriyor. **Ekranımız doğru
davrandı**: iki değer `errorValues`'tan adlandırılıp `Intl.ListFormat` ile
birleşti, panel kırmızı değil, `retry` zaten ekrandaki düğme. Yanlış olan,
metnimizin "tekrar istemek genelde geçer" iddiası — **yumuşatmadık**, çünkü tek
profil ve tek model yapılandırmasına bakarak ürün metnini değiştirmek
ölçtüğümüzden fazlasını iddia etmek olurdu. `F-026`.

**Mock'un `issues`'u tek elemanlıydı ve uydurmaydı.** Ölçülen çiftle
değiştirildi: tek elemanlı bir liste `Intl.ListFormat`'ı hiç sınamıyor, yani
"iki sebebin ikisi de yazılıyor mu" sorusu test edilmemişti. Şimdi ediliyor.

**Silme tam olarak belgelendiği gibi:** `204`, `sid` çerezi `Max-Age=0` ile
siliniyor, `GET /generations` `{"items":[],"total":0}`. Mock'umuz zaten aynı
şeyi üretiyordu; değiştirilecek bir şey çıkmadı.

**Ama silmenin ardındaki durum bozuk:** aynı kimlikle yapılan **her profil
okuması `500`** (`/profile`, `/sections`, `/atoms`, `/entries`), oysa
`/account/usage` ile `/generations` `200`. Yerelde bunu dev auth stub'ı
üretiyor, **ama üretimde de ulaşılabilir**: hesabı bir cihazda silen kişinin
öteki sekmesinde eski çerez duruyor ve o sekme `401` yerine `500` alıyor.
`F-027`.

**Yerel veri geri gelir:** `DevSeeder` idempotent ve `local` profilinde
açılışta çalışıyor — backend yeniden başlatıldığında altın profil geri
seed'leniyor. Silinen 45 üretim geri gelmiyor; onlar zaten deneme koşuları.

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
