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

### Gerçek uca karşı ölçüm, ve atlanmış bir madde (2026-09-20)

**`B-101` sıraya hiç girmemişti.** Analizde "küçük iş" diye durdu ve
D1…D14'ün hiçbirine yazılmadı; kapanış "on yedisi de kapandı" diye bildirildi
ve yanlıştı. Üstelik atlanan şey, `F-038`'de tekrar tekrar işaret edilen
muhafızın ta kendisi — **şemanın dokümanı geçmesine izin veren şeyin
yokluğu**. Bir kapanış listesinin kendi kalemini düşürmesi, listenin ölçülmesi
gereken şey olduğunu söylüyor.

Şimdi CI'da: `contract-check` backend'in `main/openapi.json`'ını çekiyor,
tipleri yeniden üretiyor ve commit'liyle farkta düşüyor. **`main`, `build`
değil** — maddenin asıl bulgusu buydu: eski URL üretilen ve gitignore'lu bir
yolu gösteriyordu, yani hep 404 veriyor ve iş hep "skipping" dalına gidiyordu.
**Atlayan bir muhafız, hiç olmayandan kötüdür: başarı bildirir.** `curl`
`--fail-with-body` ile, çünkü sessizlik bu işin ortadan kaldırmak için var
olduğu arıza biçimi. Yerelde koşuldu: backend'in commit'li şeması bizim
`api.d.ts`'imizle **birebir**.

**Yeni yüzeyin hepsi yalnız MSW'ye karşı doğrulanmıştı**, ve mock kendisiyle
çelişemez. `:8080`'e karşı bir sonda koşuldu (§ Test ve ölçüm'ün kuralı) —
etiketler, şablon registry'si, özelleştirmeler, GitHub önerileri, bölüm düzeni,
`emphasize`/`note` sınırları. 18 kontrolün 17'si geçti; "düşen" biri sondanın
kendi hatasıydı (`POST /auth/session` diye bir uç yok). **Üç fark çıktı.**

**1. Registry'nin sayıları § 33.5'in tablosundan farklı.** Klasik 53 (tablo
~54), modern 52 (tablo ~50). Bölüm kendi sayılarını "katalog için, yaklaşık"
diye yazıyor ve uç zaten **ölçülmüş** cevabı vermek için var — yani çelişki
değil, ama mock tabloyu kopyalamıştı. Kopyalanmış bir tablo *doğru görünür*:
fark, ekranın sunucunun hiç göndermediği bir rakamı basması için yeterli.
Mock artık ölçülen değerleri taşıyor, ve **sürümler de aynı değil** (klasik 6,
modern 3, kompakt 2 — ilk taslak üçüne de 6 vermişti).

**2. `POST /customizations` yankılamıyor, çözüyor.** Yalnız `fontSizePt`
gönderilen bir istek, kenar boşluğu, satır aralığı, aile ve vurgu rengi
şablonun kendisinden doldurulmuş olarak geri geliyor. Yankılayan bir mock,
ekranın **boşluklara** karşı yazılıp üretimde gerçek sayılarla karşılaşmasına
izin verirdi — sürprizin yanlış yönü: geliştirmede "—", dağıtımda "0.55in"
gösteren bir liste, canlıya çıkana kadar kimsenin bulmadığı bir kusurdur.

**3. Bilinmeyen bir `customizationId` reddedilmiyor** — `202`, iş kuyruğa
giriyor. Uç açıklaması "başkasına ait bir set bulunamaz" diyor. Bu
`B-116`'nın `two_column`'uyla **aynı şekil**: kişi bir şey seçiyor, hiçbir şey
söylenmiyor, belgesi başkasını basıyor. `F-040`.

**Bir de küçük bir alan adı farkı:** çok uzun bir terim `emphasize[0]` diye
geri geliyor, `emphasize` diye değil — listeyi adlandıran bir cümleyle
içindeki girdiyi adlandıran cümle arasındaki fark.

**Kapasite testi sayıya değil iddiaya bağlandı.** Ölçülen değerleri teste
yazmak, bir rakamı sabitlemek olurdu; test artık ucu okuyup ekranın **onu**
bastığını doğruluyor — birisi makul görünen bir sayıyı koda gömdüğü gün düşer.

**`B-100`…`B-116` ACK'lendi ve indi.** `to-frontend.md` 347 → **43 satır**;
satır satır kayıt `resolved/to-frontend-2026-09.md`'de.

### `B-117`…`B-119` — backend'in üç cevabı (2026-09-21)

**`B-117` kod yazdırmadı:** dördü de D6 ve D12'de inmişti (`note`,
`customizationId`, `GET /templates`, `/customizations` + 20 tavanı).

**Sapma — tipler koşan sunucudan değil, backend'in commit'li şemasından
üretildi.** `:8080`'deki derleme bayattı: `npm run gen:api` `api.d.ts`'i **hiç
değiştirmedi**, ne `maxPages` ne `language` içindeydi. Kaynak
`../atomcv-backend/openapi.json` (CI'ın `contract-check`'i de `main`'den onu
çekiyor). **Bayat bir sunucu, eksik bir şemadan ayırt edilemez** — ikisi de
"alan yok" der, ve dokümanın yanıldığı sonucuna götürür. Ayırt eden şey,
şemanın **iki kopyasının** olması oldu.

**`B-119` bir politikayı tersine çevirdi, kuralı değil.** `B-114` kaydı
"`choose_language` çizilmiyor" diyor ve gerekçesi *cevabın gidecek alanı yok*
idi; alan geldi, düğme çizildi. Yokluğunu doğrulayan test silinmedi,
**yerine geçeni yazıldı** — o test zaten "alan indiği gün bu düğme borçtur"
demek için vardı. Dropping kuralı yerinde: `keep_top_pinned` hâlâ düşüyor.
Seçicinin listesi **iki yarısı da sunucunun**: reddin `detectedCandidates`'i
önce (onaylanması en olası cevap), sonra `capabilities.allowedLanguages`.
Beyan **dosya değişince düşer** — bir CV hakkında verilen cevap ötekini
bağlamaz, üstelik beyan tespiti atlattığı için sessizce yanlış dil yazardı.

**`B-118`'in notu yalnız üretimin kendi sınırına karşı çiziliyor.** `maxPages`
yoksa not yok: eksik bir alan "sınır bir sayfaydı" demek değil. Satırda da
**tek olgu** — sayfa sayısının yanına "kısa" rozeti aynı şeyi ikinci kez, ve
doğru çıkmış bir belgeden daha yüksek sesle söylerdi. Bayat bir
`customizationId`'nin `404`'ünde ekran **cümle yazmıyor**: paneli sunucunun
metni çiziyor, ekranın yaptığı yalnız ölü seçimi düşürüp listeyi tazelemek —
onarım, hata arayüzü değil (kural 7). Onarılmazsa bir sonraki basış aynı ölü
id'yi yollar, yani çıkış değil döngü olur.

**Kapı sırası ölçüldü, madde açılmadı.** Backend yeniden başlayınca üç sonda:
11 MB + `language=zz` → **`413`**; `.png` + `language=zz` → **`400`,
`fields:["language"]`** (`415` değil); aynı `.png` dilsiz → **`409`**. Sıra
**413 → `400` → 409 → 415**; mock `language`'ı 413'ün önüne koymuştu,
düzeltildi. Sorulacak değil bakılacak bir şeydi — `B-051`'de kapı sırası bir
kez varsayılmış ve yanlış çıkmıştı. Aynı koşuda `gen:api` commit'li şemadan
üretilenle **bayt bayt aynı** dosyayı verdi, yani yukarıdaki sapma kapandı.

### Doküman–kod denetimi: üç yüzey telde vardı, ekranda yoktu (2026-09-21)

**Bütün dokümanlar koda karşı ölçüldü** — spec'in 19 dosyası, ürün konsept
dokümanı, handoff, notlar — ve taban sağlam çıktı: 61/61 uç bağlı, şemanın 198
alanının 193'ü okunuyor, 40/40 hata kodu iki dilde, 605/605 çeviri anahtarı,
34 kapalı sözlükte karşılıksız değer yok.

**Ama üç yüzey kasıtlı boşluk tablosunda da değildi, yani unutulmuşlardı.**
Aradaki fark önemli: bu tablodaki her satır bir karardır, kaydı olmayan bir
eksik ise kimsenin vermediği bir karardır.

- **Veri export.** İstemci fonksiyonları iki aşama önce yazılmış,
  **çağıran yoktu** — oysa üç ayrı kullanıcıya görünen cümle o hakkı vaat
  ediyor (gizlilik politikasının hakları, şartların bildirim süresi,
  `GENERATION_PAUSED`'ın kendi metni), § 58.2 "en önemli güvence" diyor ve
  EK C.1 yayın kapısına kutu koymuş. `DataExport` indi, herkese — anonim
  dahil, çünkü uç `401` beyan etmiyor ve iki saatte sönecek bir profil
  kopyalanmaya en çok değer olan.
- **Çıktı dili — § 38.1'in üçüncü ekseni.** `GenerationRequest.language`
  gönderilmiyordu, `defaults.cvLanguage` ve `coverLetterLanguage` hiç
  okunmuyordu. `GenerateScreen`'in yorumu "sayfa bütçesi ve dil profilin karar
  verdiği yerde kalır" diyordu — **profilde de o kararı verdirecek bir kontrol
  yoktu**, yani zincir iki ucundan da kopuktu. Artık üretim başına
  (`Directives`, kapalı panelde) **ve** varsayılan olarak seçilebiliyor.
- **Yazım stili.** `writingStyle`'ın dördü de yazılabilirdi; frontend'deki tek
  izi `CvAppearance`'ın onları **silinmekten koruması** idi.

**Dördüncüsü uygularken çıktı: `defaults.maxPages`.** Ürünün merkezî vaadi, ve
yalnızca sunucu `increase_page_limit` çözümünü gönderdiğinde isteğe
ulaşıyordu. Aynı bölüme girdi.

**Seçeneklerin kaynağı `enabledLanguages`, `allowedLanguages` değil.** İkincisi
profilin hangi dilleri *tutabileceğini* söyler; ekranda sorulan şey bu CV'nin
hangi dilde basılacağı. Sözcüklemesi olmayan bir dil seçtiren liste,
sunucunun karşılayamayacağı bir seçim sunar. Tek dil varsa seçici çizilmiyor —
anonim oturumun hâli bu.

**`useReplacePreferences` artık birleştiriyor.** İki ekran tercih yazdığı anda
"sahip olmadığın alanları da taşı" kuralı iki yerde hatırlanmak zorunda
kalıyordu, ve unutan kopya bir bölümü sessizce sıfırlardı. `writingStyle`
**değiştiriliyor** (tek sahibi var, boşaltılan kutu bir silmedir), `defaults`
**birleştiriliyor** (iki sahibi var), `defaults.appearance` o birleşmenin bir
anahtarı olduğu için yine bütün gidiyor — "sıfırlama bir eksiltmedir" böyle
doğru kalıyor. Muhafızı negatif kontrolle doğrulandı: birleştirme geri
alındığında test düşüyor.

**Bundle:** ayarlar 243.8 → **245.9**, üretim 227.5 → **229.5**, onboarding
221.6 → **224.0** (tavan 280 / kendi payı 105). `next/dynamic` gerekmedi.

**Backend'e beş madde** — `F-041`…`F-045`. Dördü onların sahip olduğu metin,
biri gerçek bir tel sorusu (cover letter'ın dili istek başına seçilemiyor).

### Dağıtım günü — sırayla denenecekler

Kod tarafında hiçbiri beklemiyor; hepsi **ölçüm** bekliyor.

1. **`NEXT_PUBLIC_SITE_URL`'i ayarla.** Canonical, hreflang, `robots.txt` ve
   `sitemap.xml` hepsi ondan kuruluyor; ayarlanmazsa localhost'a düşüyor.
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

| Boşluk | Neden böyle |
|---|---|
| **Sonuç ekranında PDF önizlemesi yok** | Ölçülmüş bir karar: react-pdf ~300 KB ve gösterebileceği tek yeni şey PDF'in kendisi. *(Aynı satır bir zamanlar uygunluk raporunu da sayıyordu; rapor `B-041` ile indi ve 2026-08-25'te gerçek uca karşı doğrulandı. Kasıtlı boşluk listesi bayatlayabiliyor — denetlenmesi gerekiyor.)* |
| **"Bir sayfadan kısa CV" notu yazılmadı** | `pageCount` tam sayı ve sunucu "sayfa dolmadı" diye bir sinyal göndermiyor. Sinyalsiz yazılırsa her CV'de çıkar. |
| **`keep_top_pinned` düğmesi çizilmiyor** | Şema sabitlenmiş atomları isteğe koyacak bir alan yayımlamıyor; çizilse basılınca hiçbir şey yapmazdı. |
| **Metin düzenleme düz metin, mark'ları düşürüyor** | Mark farkında editör kural 4'ün lazy-load edeceği bileşen ve henüz yok. Kabul edilebilir olmasının tek sebebi **söylenmesi**: atomun gerçekten mark'ı varsa kaydetmeden **önce** uyarı çıkıyor (P8). |
| **Sözcükleme tek başına silinemiyor** | Sunucuda iki ayrı kural var (B-036); silinmek istenen şey madde. Uç fonksiyonu ve iki reddi de üreten mock duruyor. |
| **Profil başında dil eksenleri düzenlenemiyor** | `sourceLanguage`/`enabledLanguages` **içerik dili** ekseni (Bölüm 38.1), arayüz dili değil. Form ikisini de olduğu gibi geçiriyor ve ikisi de gövdede zorunlu (B-035). ⚠ **Gerekçesi bayatladı ve düzeltildi (2026-09-08):** satır "hangi diller sunulabilir `capabilities`'e bağlı ve o yayımlanmadı" diyordu — `allowedLanguages` yayımlanıyor ve okunuyor, gerçek uca karşı `["en","tr"]`. Bekleyen bağımlılık yok; kalan şey **çizilmemiş bir kontrol**, yani karar. Denetimde 8 satırın 7'si doğru çıktı, bu biri değil. |
| **Bölüm düzeni seçtiren arayüz yok** | `sections.layout` beş değer alıyor (`B-073` ile `paragraph` da) ama hiçbir ekran onu göstermiyor ya da seçtirmiyor; sunucu her bölüm türü için doğrusunu zaten yazıyor. Çizilecekse beşinin de ICU adı ve About için `paragraph` varsayılanı gerekir — yarım hâli kullanıcıya anlamını bilmediği bir seçim verir. |
| **"Yeniden hesaplanıyor…" göstergesi yok** | § 33.3 istiyor, durumu yayımlayan uç yok, ve `B-091` ekranda bir şey gerekmediğini söylüyor. Beklenmeyen bir iş için bekleme hissi üretmek olurdu. |
| ~~**`format=source` düğmesi yok**~~ | **Kapandı, D5 (2026-09-20).** Gerekçesi "uç `400` dönüyor" idi ve `B-105` ikisini birden indirdi — `source` da `html` de. İki aşama boyunca çizilmemesi doğruydu: bir indirme düğmesinin hata paneli açması, hiç çizilmemiş olmasından kötüdür. |
| **Başvurularda duruma göre süzme yok** | `B-093`: sayfalama gerektiğinde birlikte geliyor. Filtresi olmayan bir liste, filtresi olan bir ucın taklidinden iyidir. |
| **Sentry bağlı değil** | **Karar, 2026-09-21** — ve bugüne kadar hiçbir yerde yazılı olmaması bulgunun kendisiydi. § 5.7 onu hata takibi aracı seçiyor, EK C.1 yayın listesinde bir kutusu var; frontend'de ne bağımlılık ne kod vardı, ve tek kayıt D14'te `.env.example`'dan `NEXT_PUBLIC_SENTRY_DSN`'in silinmesiydi — yani *örnek dosya* hakkında bir karar, hata takibi hakkında değil. Gerekçe analitiğinkiyle aynı: gönderilecek yer yokken yazılan kod, çalıştığını hiç görmediğimiz bir bakım yükü. Dağıtım günü listesinde, madde 6. |
| **Uygulama içi sürüm duyurusu yok** | § 55 "sürüm iletişimi + changelog" istiyor; `CHANGELOG.md` yazıldı, **banner yazılmadı**. Bir sürümü yayımlayan uç yok, yani banner frontend'de bir sabit olurdu — sunucunun bilmediği bir olguyu söylemek için düzenlenip dağıtılan bir metin, ve iki tarafın da sahip olmadığı bir doğruluk kaynağı. Bir sürüm akışı indiğinde banner onun üstünde küçük bir ekran. |
| **`fontFamily`'nin dördüncü değeri çizilmiyor** | § 38.5 dört yazı tipi sayıyor (Pagella/`book` dahil), arayüz üçünü sunuyor, ve şema alanı düz `string` olduğu için **hiçbir kontrol farkı göremiyor**. Tahmin etmek `B-116`'nın `two_column`'la düzelttiği hatayı ters yönden tekrarlamak olurdu: küme `F-041`'le soruldu, gelene kadar üç kalıyor. |

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