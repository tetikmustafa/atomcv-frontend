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

### `B-075`-`B-084` kapandı (2026-09-09)

Backend'in anonim akışı bitiren dilimi: profil editörü, üretim ve challenge
artık oturumsuz çağıranda da çalışıyor, ve § 35.7'nin ilan ettiği limitler
**gerçekten uygulanıyor**. Dokuz maddenin kaydı `handoff/to-frontend.md`'nin
ACK'inde; burada yalnız **sapmalar ve kararlar** var.

- ~~**`challengeToken` şemada yok, kesişim tipiyle eklendi.**~~ **Alan
  yayımlanıyordu; bizim `api.d.ts` eskiydi** (`B-086`, aynı gün düzeldi).
  Kesişim tipi kalktı, mock şemanın tipine döndü. Ders kesişimde değil
  ölçümde: "şemada yok" dedik, ölçtüğümüz şey **diskteki üretilmiş dosyaydı**,
  canlı şema değil — ve o dosya backend'in üç commit gerisinden üretilmişti.
- **Ön yazı kapısı bir gün `canSaveHistory` vekiliyle durdu, artık kendi
  alanı var** (`canWriteCoverLetter`, `B-085`). Vekili tek bir fonksiyona
  hapsetmek işe yaradı: değişen tek satır oldu. Kapı **oturum yüklenirken de
  kapalı** — görünüp kaybolan bir kontrol basılabilir.
- **Yeni kural, ve bizden çıktı:** `FEATURE_REQUIRES_ACCOUNT`'ın her `feature`
  değerinin yetenek bloğunda bir boolean karşılığı var (§ D.6.1). Karşılığı
  olmayan bir değer, istemcinin **önleyemediği** bir ret demek — ön yazı tam
  o boşluğa düşmüştü.
- **Challenge'ın ölçütü yetenek değil, oturum.** `useIsAnonymous`, çünkü
  Turnstile "hangi özelliği kullanabilirsin" sorusu değil, "karşıda insan var
  mı" sorusu. Ürünün geri kalanı yeteneğe bakmaya devam ediyor.
- **Widget iş ekranında da duruyor, ve her denemeden sonra sıfırlanıyor.**
  Başarısız bir işten çıkan her yol (`retry`, `continue_anyway`,
  `replace_profile`…) yeni bir POST; formla birlikte sökülen bir widget o
  yolları `403 CHALLENGE_FAILED`'e çıkarırdı. Sıfırlama refüze bağlı değil:
  kabul edilen istek de token'ı harcıyor.
- **Token yoksa alan hiç gönderilmiyor.** Boş dize sunucuda **başarısızlık**
  sayılıyor; sırrı olmayan dağıtımda yokluk geçiyor, boş geçmiyor.
- **Mock iki reddin şeklini tahmin etmişti; `B-087` ikisini de kapattı.**
  `422 ATOM_LIMIT_EXCEEDED` `sign_up` **taşıyor** ve hep taşıyormuş — boş
  liste yanlıştı, düzeltildi. Anonim `POST .../feedback` ise bizim tahmin
  ettiğimiz şekle **çevrildi**: uç o güne kadar `401` diyordu, yani canlı bir
  oturumu olan kişiye "oturumun bitti" dedirtiyordu. Sorunun kendisi kusuru
  buldu.
- **`params.feature` kapalı sözlüğü dört:** `atom_controls`, `alternatives`,
  `cover_letter`, `feedback` (`AccountFeature`). Katalog `string` diyordu, yani
  dışarıdan tahminle sözleşme aynı görünüyordu; dördü de ICU dalını alıyor —
  `feedback`'i hiçbir ekran üretemese de, çünkü sözlük sunucunun.
- **`limitAtomsTo()` bir test düğmesi**, `requireChallenge()` gibi. Altmış
  atomluk fixture yazmak ekranı değil fixture'ı test ederdi; handler hâlâ
  `capabilities`'in yayımladığı sayıyı okuyor, yani ikisi çelişemiyor.
- **Sekiz birim test dosyası artık `@/lib/i18n/navigation`'ı mock'luyor.**
  Editör `sign_up` çözümünü yürütmek için router'ı içeri aldı; next-intl'in
  istemci navigasyonu Vitest altında **çözülmüyor bile** (ESM girişi), o
  yüzden ağaçta AtomEditor geçen her dosya mock'a muhtaç. Ne yaptığı tek
  yerde sınanıyor: `useAccountResolution.test`.
- **Bulunan sessiz kusur:** profil editöründeki `ErrorPanel`'ler sunucunun
  `sign_up` düğmesini çiziyordu ve basılınca hiçbir şey olmuyordu — `B-081`
  o reddi gerçek yapana kadar görünmezdi. `useAccountResolution` yalnız o tek
  eylemi üstleniyor, gerisini panelin düşürmesine bırakıyor.
- **`B-081`'in ikinci maddesi boşta:** "alternatif ekle" düğmesi hiç yok
  (`addVariant` istemcide tanımlı, çağıran yok). Çizildiği gün
  `canAddAlternatives` ile kapanacak; mevcut yazımı düzenlemek zaten açık ve
  öyle kalmalı.
- **Gizlilik metni artık model adı taşıyor** (`openai/gpt-5.6-sol`). Metin
  "şu an kullanılan model" diyor, yani model değişince sayfa gözden
  geçirilecek — ve yayımlanan hâli `ProcessorAudit`'in açılış satırına karşı
  okunacak (dağıtım işi).

### `B-088`…`B-094`, `B-096` kapandı (2026-09-11)

Backend'in Aşama 4'te indirdiği sekiz madde, bir oturumda. Ne yapıldığı
`handoff/resolved/to-frontend-2026-09.md`'de; burada **sapmalar ve
kararlar**.

- **`gen:api` sessiz bir yanlışı açığa çıkardı, ve kendi başına
  çıkarmadı.** Başvuru controller'ı inince springdoc `DELETE /account`'u
  `delete_1`'den `delete_2`'ye kaydırdı ve `delete_1`'i **başvuru silmeye**
  verdi. `deleteAccount` o günden beri yanlış operasyona bağlıydı ve
  **typecheck sustu**: ikisi de 204, ikisi de `void`. `operations.ts` artık
  `ReturnsAt`/`AcceptsAt` taşıyor — **yol ve metotla** bağlama — ve
  numaralı id'li her uç onunla bağlanıyor. Adlandırılmış id'ler
  `Returns`'te kaldı: onlar şemaanın kendi kararlı adları, ve kırk çağırı
  yerini değiştirmek bir tehlikeyi kimsenin inceleyemeyeceği bir diff'le
  takas ederdi. `F-033` kaynağını istiyor.
- **`B-088`'in arayüzü çizilmedi, ve bu bir eksik değil bir karar.**
  Düğme başına toggle çizmek "bu üretim neyi tarttı" bilgisini istiyor;
  hiçbir uç yayımlamıyor. Profilin atomlarından çizmek, tartılmamış atom
  `400` döndüğü için **basılamayacak düğmeler** demek olurdu — yani
  kural 7'nin tersi: sunucunun vermediği bir yolu uydurmak. İstemci
  fonksiyonu ve hook'u yine de yazıldı (`editSelection`,
  `useEditSelection`), çünkü davranışı — kota harcamaması — mock'ta
  sınanıyor ve ekran indiği gün değişmeyecek. `F-031`.
- **Emekli üretim ekranı halefe bağlantı veremiyor.** `status:
  "superseded"` okunuyor ve kutu yerine not çiziliyor, ama "yenisini aç"
  diyen bir bağlantı yok: telde emekliden halefe işaret yok ve geçmiş
  emekli satırları listelemiyor. Aynı `F-031`.
- **`supersededGenerationId` yalnız akışta taşınabiliyor.** Şema onu
  `JobStatusResponse`'a koymuyor, yani **tipli olan tek geri düşüş**
  (`GET /jobs/{id}`) onu taşıyamıyor. Bugün kimseyi engellemiyor —
  düzenlemeyi gönderen ekran hangi üretimi gönderdiğini zaten biliyor —
  ve mock akışta yayımlıyor. `contracts.ts` bir alan geri aldı, kuralını
  çiğnemeden: tarif ettiği şey şemada `unknown` olan SSE yükü. `F-032`.
- **`PATCH /profile/preferences` diye bir şey yok.** `B-091` öyle yazıyor;
  şemada yalnız `PUT` var ve **şema kazanıyor**. Sonucu davranışsal:
  "alanı göndermemek şablonun ayarı demek" **replace** anlamında da doğru,
  ama form **bütün tercihleri** göndermek zorunda — yalnız `defaults`
  gönderen bir gövde yazım stilini siler. `B-091`'in "sıfırlamak için
  `null` gönderin" cümlesi de bu uçta geçmiyor: `AppearanceUpdate`'in
  alanları nullable değil, ve `PUT`'ta atlamak zaten sıfırlamak.
- **`Appearance` okunup doğrudan geri yazılamıyor.** springdoc kaydın
  `isEmpty()`'sini `empty: boolean` diye yayımlıyor ve yazma şemasında o alan
  yok. `draftFrom` onu eliyor; `SelectionEditRequest`'te de aynı sızıntı var.
  `F-033`'ün ikinci maddesi.
- **`EDIT_NOT_UNDERSTOOD` sık dönecek, o yüzden metni bir çıkış taşıyor.**
  Mesaj ne yapılamayacağını **adıyla** sayar (yeniden yazma, ton, sayfa
  boyu), çünkü "anlamadık" tek başına çıkmaz sokak. Kotanın iade
  edildiği de yazıyor: kullanıcının soracağı ilk soru o.
- **Mock'un "modeli" isteğin **şeklinden** karar veriyor.** Sihirli bir
  dizge yerine "cümle bu profilin bir atomunu adıyla anıyor mu" — böylece
  ürün kodu gerçek sunucunun yok sayacağı bir tetikleyici öğrenmiyor.
  Eşleşme dört harften uzun sözcüklerde ve `en` locale'iyle katılıyor
  (kural 11).
- **`JobProgress` isteğe bağlı bir `onCompleted` aldı.** Düzenleme işi
  bittiğinde üç şey birden bayatlıyor (emeklinin `status`'ü, geçmiş,
  `total`) ve bunu bilen tek yer akışı dinleyen bileşen. İkinci bir
  `EventSource` açmak, aynı işi iki yerden dinlemek olurdu.
- **Görünüş formu taslağını effect'te değil render sırasında tohumluyor.**
  Effect bir kare boyunca kimsenin sahip olmadığı değerleri gösterirdi;
  lint kuralı (`react-hooks/set-state-in-effect`) da onu reddediyor. Sunucu
  verisi store'a kopyalanmıyor — bu bir **yazı taslağı**, cache hâlâ
  sunucunun dediğini tutuyor.
- **Dokunulmamış bir kontrol sayı basmıyor.** "Şablonun kendi ayarı"
  yazıyor, çünkü `modern`'in varsayılan vurgusu siyah değil (`B-092`) ve
  bir değer basmak hiç görmediğimiz bir şablon hakkında iddia olurdu.
  Slider yine de bir yerde durmak zorunda: aralığın ortasında duruyor ve
  yanındaki yazı onun **seçilmiş** olmadığını söylüyor.
- **§ 33.3'ün "yeniden hesaplanıyor…" göstergesi çizilmedi**, ve
  `F-nnn` ile de istenmedi. `B-091` ekranda bir şey yapmanın gerekmediğini
  söylüyor; göstergeyi istemek, kullanıcının beklemediği bir iş için
  bekleme hissi üretmek olurdu. Bir geri bildirim gelirse açılır.
- **Ayarlar ekranı artık anonim çağırana da bir şey gösteriyor.** Görünüş
  profilin, profil ise anonim oturumun da var; "burada yönetilecek bir şey
  yok" cümlesi bayatladı ve değiştirildi.
- **`/unsubscribe` `(app)` altında**, oturum istemediği hâlde: sayfa bir
  istemci bileşeni ve next-intl'in istemci sağlayıcısı orada. Alternatifi
  tek sayfa için ikinci bir sağlayıcı ağacıydı. `searchParams` okuduğu
  için dinamik; bütçe betiğinin prerender listesinde yok, **elle ölçüldü**.
- **Mock'un e-posta tercihi `localStorage`'a da yazılıyor.** Modül durumu
  sayfa kadar yaşıyor; sınanmaya değer yolculuk ise bir gezinmeyi
  aşıyor (gelen kutusundan kapat, ayarlarda anahtarın uyduğunu gör).
  `MOCK_SESSION_KEY`'in çözümü, aynı korumalı çifte toplanmış hâli.
- **`DeleteAccount` testindeki kaydedici daraltıldı.** "Her hesap isteği"ni
  saydığı için, ayarlara inen `GET /account` "hiçbir şey silinmedi"
  kontrolünü hiçbir şey silmeyen bir istekle düşürüyordu. Artık yalnız
  yazmaları sayıyor.
- **Kapanış kapıları:** typecheck · 751 birim · 56 e2e · lint · prettier ·
  bütçe (`npm run size`, hepsi tavanın altında) · üretim chunk'larında
  `setupWorker` yok.

### Backend beklemeyen beş iş (2026-09-12)

`B-088`…`B-096` kapandıktan sonra kalan, **hiçbir `F-nnn`'e bağlı olmayan**
işler. Önce ölçüldü: notların listesi iki yerde bayatlamıştı —
*performans bütçeleri CI'da* zaten vardı (`ci.yml` `size:check`
çalıştırıyor), ve `addVariant`'ın yalnız çağıranı değil **hook'u da**
yoktu.

- **SEO hiç yoktu, ve tamamı bizimdi.** `robots.ts`, `sitemap.ts`,
  canonical + hreflang (`x-default` dahil), başlık şablonu, açık grafik.
  `robots.txt` **bir izin üzerine kurulu ret listesi**: pazarlama yüzü üç
  sayfa, gerisi birinin kendi ekranı — tarama yapan bir bot orada boş bir
  kabuk, kendisi için açılmış bir anonim oturum ve birinin hız limitinde bir
  satır buluyor. Dil × segment çarpımı **üretiliyor**: `/en/profile`'ı elle
  yazmak, sonradan eklenen bir dilin taranabilir kalmasının yolu.
  `noindex` ayrıca `(app)` ve `(auth)` layout'larında, çünkü `robots.txt`
  **çekmemeyi** rica ediyor — birinin link verdiği bir URL yine de listelenir.
- **Alan adı yok, ve bu bir karar değil bir boşluk.** `NEXT_PUBLIC_SITE_URL`
  yoksa localhost'a düşüyor; uydurma bir alan adı yazmak, kimsenin
  kaydetmediği bir hostu **başkasının sitesini** gösteren bir sitemap'e
  çevirirdi. Dağıtım ayarlayacak.
- **axe taraması ilk koşuşta iki gerçek hata buldu**, ikisi de eşiğin hemen
  altında ve ikisi de shadcn varsayılanı: `muted-foreground` `muted` üzerinde
  4.34, destructive düğme kendi /10'u üzerinde 4.39 — **hover'da 4.01**, ki
  oraya hiçbir otomatik denetim bakmıyor. Beyaz üzerinde ikisi de geçtiği
  için üç aşama fark edilmediler: jsdom'un hesaplanmış rengi yok, yani
  bileşen paketi onları **göremezdi**.
- **⚠ axe'in yapısal bir kör noktası var, ve palet tam oraya düşüyor.**
  Tüm token'lar `oklch` ve Tailwind'in alfa değiştiricileri
  `oklab(… / α)`'ya derleniyor; çalışan sunucuya karşı ölçüldü: axe böyle
  bir arka planı olan düğümü **ne ihlal ne `incomplete`** sayar — düşürür.
  Karanlık temada 3.16'da duran bir düğme taramayı sessizce geçti; negatif
  kontrol **iki kez** geçtiği için fark edildi. `tests/unit/lib/palette.test.ts`
  bu boşluğu kapatıyor: stylesheet'ten token'ları okuyup ürünün gerçekten
  boyadığı her çifti ölçüyor, hover dahil, ve dönüşümü **axe'in kendi
  ürettiği** 4.34'e karşı doğruluyor. Mutlak kural 12 bundan çıktı.
- **Negatif kontrolün kendisi bir kez yalan söyledi:** `next dev` düzenlemeyi
  henüz derlememişken koştuğu için "geçti" dedi. Kontrolü tekrarlamadan
  önce sayfayı bir kez çekmek gerekiyor.
- **`canAddAlternatives` üç aşama boştaydı.** Artık `AddWording` var, ve
  önemli olan yeri: **ifade, varyant yaratılmadan önce yazılıyor.** Yenisini
  mevcut bir ifadenin metniyle tohumlamak hızlı olurdu ve bayat-ifade
  altsisteminin tam da var olma sebebi olan hatayı üretirdi: İngilizce metin
  taşıyan bir Türkçe varyant, Türkçe bir CV'de İngilizce cümle basar ve
  **hiçbir şey bunu söylemez** — sunucu bir ifadeyi atom altından değişince
  bayat işaretliyor, hiç yazılmamış olunca değil.
- **Tema üç durumlu ve flash yok.** Sınıfı ilk boyamadan önce **engelleyen
  bir inline script** yazıyor; React'i bekleyen her çözüm önce açığı basıp
  sonra düzeltir, ki bu karanlık bir odada beyaz bir flash. Script mantığın
  **ikinci kopyası**, o yüzden birim testi ikisini aynı vakalara karşı
  koşuyor — drift, birinin odasında titremek yerine burada düşüyor.
  Toggle yalnız uygulama nav'ında: landing ve legal kendi JS'ini
  taşımadığı kararla duruyor (bütçe teyit etti: **0.0 KB own**) ve head
  script'i her yerde çalıştığı için sistemi yine de izliyorlar.
- **Next 16.3.0 iki **kritik** RCE uyarısının aralığındaydı** (Windows
  sunucular; AVIF ile görüntü optimizasyonu). 16.3.5'e çıkıldı, kesin pin
  korundu; kalan yedi uyarı geliştirme zinciriydi ve `npm audit fix` kapattı.
  **Sıfır açık.** Bağımlılık yükseltmesinin gerektirdiği gibi doğrulandı:
  typecheck · 805 birim · 75 e2e · build · bütçe · MSW sızıntı grep'i.
- **CI action'ları `@v5`, ve bu buradaki tek doğrulanamayan değişiklik** —
  o işler yalnız push'ta koşuyor. Bir koşu kodda değil action'da düşerse
  geri dönüş `@v4`.
- **Kapanış kapıları:** typecheck · 805 birim · 75 e2e · lint · prettier ·
  bütçe (landing 168.8 / **0.0**, profil 254.7 / 85.9 — tavan 280 / 105) ·
  üretim chunk'larında `setupWorker` yok · `npm audit` sıfır.

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