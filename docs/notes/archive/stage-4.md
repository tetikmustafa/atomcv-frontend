# İnşa Notları — Aşama 4 (frontend, sürüyor)

> Aşama 4'ün kapanan dilimleri. **Rutin okunmaz**, arkeoloji için:
> `rg -n "<konu>" docs/notes/archive/`.
>
> Aşama 3'te olduğu gibi burada da ölçek **dilim**, aşama değil:
> `current.md` 400 satırla sınırlı ve aşama sürerken doldu. Aktif dosyaya
> yalnız **değişmezler, kasıtlı boşluklar ve hâlâ açık olanlar** geçti —
> burada duran şey bir dilimde neyin neden öyle yapıldığı.

---

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

### Aşama 3'ün son kod devri kapandı (2026-09-12)

`MockJob` iki iş türünü birden taşıyordu ve bölmek Aşama 3'te ertelenmişti
(`archive/stage-3.md`, dilim 3a). Notlar bunu "davranış değil, isimlendirme"
diye geçiyordu — **değildi.**

- **İçe aktarma işi `generationId: ''` taşıyordu**, çünkü alan zorunluydu.
  Hiçbir şey ifade etmeyen, ama eden bir değer gibi okunan bir değer.
- **Ayrık birleşime (`MockGenerationJob | MockImportJob`) çevrilince derleyici
  yirmi yeri gösterdi** — iki yarının birbirinin üzerinden okunduğu her yer.
  `imported!` gitti, `generationId` artık içe aktarmada **yok**.
- **`isGenerationJob` / `findGeneration` / `generationOf`** tek yerde duruyor;
  öncesinde dört test aynı aramayı elle yapıp `!` ile bitiriyordu.
- Davranış değişmedi: 805 birim · 75 e2e, ikisi de öncesi gibi.

### Notların kendisi denetlendi (2026-09-12)

`current.md` 400 satır sınırına dayanınca kapanan dilimler buraya indi, ve
taşırken **ikinci bir bayat satır** çıktı: "gizlilik politikasının
sağlayıcı listesi eksik, model seçimi ürün kararı olarak duruyor" — oysa
`Legal.privacy.shareBody` OpenRouter'ı ve arkasındaki dört sağlayıcıyı
adıyla saydığı gibi modeli de yazıyor, ve karar 09-09'da kapanmıştı.

2026-09-08'de de bir tanesi böyle yakalanmıştı (dil eksenleri satırı). İki
kez olan şey tesadüf değil: **açık madde listeleri, kapatan değişikliği
yapan kişi başka bir dosyaya baktığı için bayatlıyor.** Taşıma sırasında
okumak çalışıyor; taşıma da bir denetim.
