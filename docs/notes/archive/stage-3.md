# İnşa Notları — Aşama 3 (frontend, kapandı 2026-09-02)

> Aşama 3'ün tam inşa kaydı: hesap, oturum, CV yükleme, cover letter, geçmiş
> ve MVP kapanışı — on üç dilim. **Rutin okunmaz**, arkeoloji için:
> `rg -n "<konu>" docs/notes/archive/`.
>
> Dosya aşama sürerken doldu: `current.md` 400 satırla sınırlı olduğu için
> kapanan her dilim buraya taşındı, aşama yerine dilim ölçeğinde. Kapanışta
> kalan dilimler (7b-13) de eklendi, ve **aktif dosyaya yalnız değişmezler
> ile kasıtlı boşluklar geçti** — burada duran şey bir dilimde neyin neden
> öyle yapıldığı.
>
> Madde kayıtları (`B-nnn`, `F-nnn`) burada değil, `handoff/resolved/`'da.

---

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

### Dilim 2a — OAuth yolu · 2026-08-29

`B-048` kapandı; madde kaydı `resolved/`'da. `B-054`'ün **yalnız OAuth yarısı**
indi (`?profile=` iniş parametresi); `POST /auth/verify`'ın gövdesi dilim
2b'de, o yüzden madde açık kaldı. Kodda duran şeyler:

**Bu sayfanın var olma sebebi iki çerezin farkı.** Oturum çerezi
`SameSite=Strict`, ve tarayıcı Strict çerezi zinciri başka sitede başlamış bir
isteğe göndermiyor — zincir Google'da başladı. `/profile`'a doğrudan inmek ilk
ekranı **çıkışlı** çizerdi. `NEXT_LOCALE` ise `Lax`, ve Lax çerezler üst düzey
gezinmede **gidiyor** — yani aynı yönlendirme dili doğru taşıyor, oturumu
taşımıyor. Sayfa tam olarak bu asimetriyi kapatıyor: aynı-origin `fetch` ile
`/auth/session` sorulur, sonra yola devam edilir.

**`next` locale öneki taşımıyor.** Bağlantıyı biz kuruyoruz, öneki next-intl
router'ı ekliyor, yani dil tek yerde karara bağlanıyor. `safeReturnPath` yine
de baştaki bir locale segmentini **atıyor**: adres çubuğundan kopyalanmış bir
`next` iki kez öneklenip başarılı bir girişin sonunda 404 olurdu.

**Açık yönlendirme kontrolü üç aileyi ayrı ayrı yakalıyor**, ve testte hangi
kontrolün hangisini tuttuğu ölçüldü. Baştaki eğik çizgi şeması reddediyor
(`javascript:`, `https://`); `URL` ayrıştırıcısı + origin karşılaştırması
protokol-göreliyi (`//evil.example`) ve tarayıcının normalleştirdiği ters eğik
çizgiyi (`/\evil.example`) reddediyor. Origin kontrolü kaldırılınca bu ikisi
kırılıyor, ötekiler kırılmıyor — kalıp eşleşmesiyle yazılsaydı ilk ikisi
sessizce geçerdi.

**OAuth sıçraması mock'lanamıyor, ve mock'lanmamalı.** Buton bir üst düzey
gezinme ve MSW worker'ı `request.mode === 'navigate'` olan istekleri **bilerek
atlıyor** (`public/mockServiceWorker.js`). Sahte bir sağlayıcı ekranı uydurmak
mock'ların yapmaması gereken tek şeydi; dikiş gerçek olduğu yere çizildi —
bir yanda butonun `href`'i, öbür yanda `/auth/complete`'e tarayıcının indiği
gibi doğrudan inmek.

**Oturum anonim dönerse sayfa duruyor.** Sunucu bir şey bozulduğunu söylemedi,
o yüzden uydurulmuş bir hata kodu yok — istemcinin kendi cümlesi. Yola devam
etmek, girişi yeni bitirmiş birine anonim bir oturum verip sonraki her ekranı
sebebi yazılı olmayan biçimde yanlış çizerdi.

**Tanınmayan bir `profileUpgrade` sessiz geçiyor.** Beşinci bir değer, iyi mi
kötü mü haber olduğu bilinmeden gelir; elimizdeki iki cümlenin ikisi de iddia
taşıyor (biri çalışmanın taşındığını, öteki kaybolduğunu söylüyor). Çerez
etkilenmiyor, yani giriş yine tamamlanıyor.

**`declined` kırmızı panel değil.** Rıza ekranında vazgeçmek ürünün sorduğu
soruya verilmiş bir cevap; `role="alert"` taşıyan bir panel hiçbir şey
bozulmamışken bozulmuş derdi. Kural 7'ye aykırı değil: yasak olan **hata
koduna göre UI dallanması**, bilinçli bir seçimi arıza gibi göstermek zorunda
olmak değil.

**`sign_up` resolution'ı açıldı.** `GenerateScreen` onu düşürüyordu çünkü
gidecek yer yoktu; `FEATURE_REQUIRES_ACCOUNT` tam da "yol hesaptan geçiyor"
diyen kod, ve istemcinin cevabı bugüne kadar hiçbir şey dememekti.

**Vitest'in jsdom'unda `localStorage` verilen değeri tutmuyor** — ölçüldü, üç
satırlık bir sonda ile. Mock'un depolama yarısı orada **hiç koşmuyor**; bu
yüzden dilim 1'in tarayıcı bayrağı yalnız Playwright'ta sınanabiliyor, ve
`SessionControl` biriminin "anonim dönüyor" testi yalnız modül bayrağını
kanıtlıyor. Test yorumu bunu söylüyor; söylemeseydi geçen bir test yanlış
şeyin kanıtı sayılırdı.

**`signOut()` artık depolama bayrağını da yazıyor.** Yazmazsa çıkıştan sonraki
ilk `/auth/session` az önce çıkılan hesabı döndürüyor — düğme bozuk görünürken
arkasındaki istek çalışıyor. Negatif kontrol e2e'de yapıldı: satır kaldırılınca
"çıkışta kalıyor" testi kırılıyor. Playwright yardımcısı da **tohumluyor,
atamıyor** (`addInitScript` her gezinmede koşuyor); koşulsuz yazımla aynı test
kırılıyor, ve düğme suçsuzken kırılıyor.

**`role="alert"` tuzağının tarayıcı ikizi var:** Next kendi route announcer'ını
`<body>`'ye `role="alert"` ile ekliyor, yani kapsamsız bir yokluk iddiası
sayfayla ilgisi olmayan bir canlı bölge yüzünden düşüyor. e2e'de `<main>`'e
kapsandı.

**Bütçe: auth rotaları dinamik, ve `check-bundle-size.mjs` onları hiç
ölçmüyor** — betik prerender edilmiş HTML okuyor, dinamik rotanın öyle bir
dosyası yok. `searchParams` okundukça da dinamik kalacaklar. Elle ölçüldü
(`next start`, aynı gzip yöntemi): `/en/login` **205.5**, `/en/auth/complete`
**212.1**, `/en/auth/error` **206.1** KB — app sınıfı tavanı 280'in altında.
Ölçülen rotalar: profil 251.2 → **251.1**, üretim 215.6 → **215.5**, pazarlama
168.3'te sabit.

### Dilim 2b — magic link, Turnstile, `Retry-After` · 2026-08-29

`B-049`, `B-050` ve `B-054`'ün kalanı kapandı. Kodda duran şeyler:

**Bir `GET` ve bir `POST` arasındaki fark bu ekranın tamamı.** `/verify` iki
şeyi birden yapmamalı: bağlantıyı açmak (§ 40.3 — kurumsal posta tarayıcıları
tıklıyor, tek kullanımlık token tükeniyor) ve bağlantıyı harcamak. Düğme bu
ayrımın kendisi.

**Düğme ayrıca hemen basılamıyor, ve sebebi dilim 0'ın CSRF'i.** `POST
/auth/verify` `XSRF-TOKEN` çerezini yankılıyor; e-postadan gelen tarayıcıda o
çerez **yok**. `useSession` mount'ta koşuyor ve çerezi ekiyor; düğme
`session.isPending` boyunca kapalı. Testte ölçülen ince nokta: **sıra iddiası
tek başına bunu kanıtlamıyor** — `useSession` bir hook, GET zaten her zaman
önce görünür. Kanıtlayan şey düğmenin kapalı başlaması, ve negatif kontrol de
oradan kırılıyor.

**Bir ret sonrası ikinci basış yok, ve bu koda göre dallanma değil.** Çift tek
kullanımlık; sunucu ne demiş olursa olsun aynı çifti yeniden göndermek
çalışamaz. Kalan tek dürüst kontrol yeni bağlantı istemek.

**Widget her retten sonra sıfırlanıyor, yalnız `CHALLENGE_FAILED`'dan sonra
değil.** Turnstile tokenı tek kullanımlık ve sunucu **hangi katmanın**
reddettiğini yayımlamıyor (`B-050`), yani tokenı harcayan bir retle harcamayanı
ayırt etmenin yolu yok. Sıfırlama imperatif bir handle ile değil `key`
bump'ıyla: render'la ayrı düşecek bir API yok.

**Form kendi başarısından sağ çıkmıyor.** `202` sonrası yerini cümle alıyor;
orada duran bir form ikinci isteği davet eder ve her istek üçte birini harcar.
"Başka bir adres dene" bilinçli olarak bir sıfırlama, kendiliğinden bir yeniden
gönderim değil.

**Adres için istemcide tek bir kontrol var, ve gerekçesi `profileSchemas.ts`'in
ikinci maddesi:** boşa gidecek tur. Üç istek / on beş dakika kişinin **kendi**
hakkı; bir yazım hatası onun yirmide birini hiçbir yere giden postaya harcar.
Kural kasten gevşek — adresin ne olduğuna sunucu karar veriyor.

**`Retry-After` artık okunuyor, ve `params`'a yazılmıyor.** `ApiError` bir alan
kazandı: gövde sunucunun yazdığı şey, bu bir **başlık**, ve ikisini
karıştırmak `wireErrors.test.ts`'in ayırt etmek için var olduğu şeyi silerdi.
`ErrorLike` de taşıyor, çünkü tek renderer iki taşıyıcıya bakıyor ve SSE'nin
başlığı hiç yok.

**Cümle dakikaya yuvarlanıyor, ve sıfır "başlık yoktu" demek.** Yukarı
yuvarlama, tekrar reddedilecek bir denemeyi davet etmesin diye; en az bir,
saniyelik bir gecikme "bilmiyoruz" dalıyla çakışmasın diye. 60 dakikada cümle
"yaklaşık 60 dakika" diyor — "bir saat" demiyor; özel dal, yalnız bazen doğru
olacağı için yazılmadı.

**`SELECT_DEFAULTS` `MESSAGE_DEFAULTS` oldu ve `errorParams.ts`'e taşındı.**
Sebebi katalog testi: `retryAfterMinutes` bir **tel parametresi değil**, yani
`PARAMS` onu dürüstçe listeleyemez — ve eksik bir `plural` argümanı mesajı
kendi anahtar yoluna çevirir. Test artık üretimin render ettiği gibi render
ediyor. Bedeli kayıtlı: `PARAMS`'tan düşen bir `reason` artık varsayılanla
örtülür, onu kapatan şey sebep-sebep yazılmış bloklar.

**`RATE_LIMITED` artık `resetsAt`'i kullanmıyor** ve zaman-dilimi testinden
çıkarıldı. İki kota kodu orada kaldı: onlar günlük hakkın **ne zaman
yenilendiğini** söylüyor, ki bu saat olarak söylenecek bir takvim olgusu; bu
ise **ne kadar bekleneceğini** söylüyor ve saati yanlış bir makinede doğru
kalan tek biçim süre.

**Vitest artık Cloudflare'in test site key'iyle koşuyor.** Widget site key'i
modül kapsamında okuyor ve yoksa hiçbir şey çizmiyor — dev sunucusunun ve
e2e'nin durumu bu. Anahtar olmadan sıfırlamanın sınanacağı yer kalmıyordu;
`1x00000000000000000000AA` Cloudflare'in her zaman geçen anahtarı, yani sır da
kurgu da değil. jsdom uzak script yüklemiyor, widget boş kabını çiziyor.

**e2e'de `MAGIC_LINK_INVALID` yok, ve sebebi kayıtlı:** mock'un "harcanmış
selector" durumu sayfada yaşıyor, ikinci bir `page.goto` tam sayfa yüklemesi
ve durumu sıfırlıyor. Birim testi iki render arasında ilkini `unmount` ederek
aynı şeyi yapıyor. e2e'ye zorlamak, mock'a telde karşılığı olmayan bir sıfırlama
ucu eklemek olurdu.

**Bütçe:** `/en/login` 205.5 → **210.3**, `/en/verify` **212.6**,
`/en/auth/complete` 212.1 → **212.5**, `/en/auth/error` **206.2** KB. Ölçülen
rotalar 251.3 / 215.7, pazarlama 168.4 — üçü de bir önceki ölçümün 0.1'i
üstünde ve tavanların altında.


---

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

### Dilim 6 — maddesiz entry · 2026-08-29

`B-061` kapandı, ve **kodda engellenecek bir şey yoktu** — `B-047`'nin ikinci
örneği. Editör maddesiz bir entry'yi hiç engellemiyordu: atomlar entry'den
ayrı ekleniyor, hiçbir doğrulama madde istemiyor, ve `minAtoms` kutusu diye bir
şey hiç çizilmemişti. Değişen üç şey var, üçü de küçük:

**Boş entry metni artık eksiklik ima etmiyor.** "Nothing under this one yet"
maddenin beklendiğini söylüyordu; § 20.2'den sonra bir diplomanın maddesi
olmaması **bitmişlik**. Cümle onu söylüyor, ve "madde ekle" kontrolü duruyor
çünkü seçenek, yükümlülük değil.

**Fixture'a üçüncü bir bölüm şekli girdi:** maddesiz bir entry taşıyan bir
eğitim bölümü. Editörün şikâyetsiz çizmesi gereken şekil buydu ve başka hiçbir
yerde yoktu.

**Ve o fixture bir testi gerçekten test edilebilir hâle getirdi.** Sıralama
testi "yalnız yeri değişen satırlar sürüm alır" diyordu ama iki bölümle bir
takas ikisini de oynatıyordu, yani iddia yorumdaydı ve hiçbir şey onu
denetlemiyordu. Üçüncü bölümle beklenen dizi `[1, 1, 0]` oldu.

**`selection_state` telde yok.** `B-061` "neden bu satır çıktı" görünümü
kuracaksak `headerOnlyEntries`'e bakmamızı söylüyor; şema `selection_state`'i
hiç yayımlamıyor, yani böyle bir görünüm bugün kurulamaz. Kuracak bir şey
yokken madde açmadık — kayıt `B-061`'in `resolved/` kaydında.

### Dilim 7a — geri bildirim · 2026-08-29

`B-058` kapandı.

**Başparmak formun tamamı, ve sırası önemli.** Yargıyı sebebini sormadan kabul
eden bir form daha çok ve daha iyi yargı topluyor; kategori ile yorum yalnız
başparmak basıldıktan sonra açılıyor. Negatif kontrol bunu tutuyor: koşulu
kaldırınca "başparmak basılmadan bir şey sormaz" testi kırılıyor.

**Her istek yargının tamamını taşıyor**, çünkü `contentGranted` bir **anahtar**:
`false` göndermek izni **geri alıyor**. İzin açıldıktan sonra basılan bir
başparmak, alanı atlarsa pencereyi sessizce kapatırdı. Negatif kontrol: sabit
`false` yazınca "fikrini değiştirince izin açık kalıyor" testi kırılıyor.

**`accessedAt` gösteriliyor, ve sebebi bu.** Denetlenemeyen bir onay kutudan
ibaret. Alan biri gerçekten bakana kadar `null`, yani ekranın genellikle
yazacağı cümle "izin açık, henüz kimse bakmadı".

**Kırk sekiz saat ilk evetten başlıyor** ve ikinci bir evet pencereyi ileri
itmiyor. Bunu **ekran üzerinden gösterilemiyor** — iki isteğin `expiresAt`'ini
karşılaştırmak gerekiyor — o yüzden uca doğrudan yazılmış iki test var.
İlk turda bu iddiayı hiçbir şey tutmuyordu; negatif kontrol yakalamayınca
eklendi.

**`rating` üretilen tipte `"1" | "-1"`, yani metin.** Şema `format: int32`
diyor, açıklama "1 for good, -1 for bad" diyor, ve `FeedbackResponse.rating`
sayı olarak dönüyor — openapi-typescript'in enum'u metin literalleri olarak
basması. `Omit` + daraltma ile **sayı** gönderiyoruz; testi de tipi değil
gönderilen değeri denetliyor. Backend'e sorulacaklar listesinde.

**Geri bildirim için `GET` yok.** Sayfa yenilenince ekran boş başlıyor —
tahmin etmektense doğru olan bu. Bu da listede.

**Bütçe:** sonuç ekranı 215.8 → **216.3** KB (dinamik, elle).

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

### Dilim 13 — üç cevabın karşılanması · 2026-09-02

`F-025`, `F-026`, `F-027` cevaplanmış döndü ve `ACK` edildi. Üçü de "sizde iş
yok" diyor, ve ikisi yine de bizde bir şey buldu: **kod değil, iddia.**
`npm run gen:api` fark üretmedi — üç düzeltme de davranışta, şekilde değil.

**İki ayrı yorumumuz telin davranışını yanlış söylüyordu, ve ikisi de aynı
cümleyi.** `deleteAccount` "iki kez basılırsa `204` — düşen bağlantının
ürettiği şey bu" diyordu; mock'un işleyicisi de. Doğrusu `F-027`'de:
silinmiş hesabı gösteren oturum artık oturum değil, yani ikinci basış uca
**ulaşamıyor** ve `401` alıyor. Uç hâlâ idempotent. Eski `204`'ü üreten şey
yerel dev auth stub'ıydı — yani ikimizin de testi onu ölçüyormuş
(backend'inki de düştü: `SecondImportIT` silinmiş kullanıcıdan `409` alıyormuş).

**Mock'un kodu zaten doğruydu, yorumu yanlıştı** — `signOut()` ikinci basışı
kapıya çarpıyordu ve bunu kimse iddia etmemişti. Şimdi ediyor; negatif kontrol
`signOut()` kaldırılınca iki testi birden düşürüyor.

**`F-025`'in kuralı mock'a girdi, çünkü artık uygulanabilir bir kural.**
İşveren, ilanın **içerdiği** bir addır ya da hiçbir şeydir (§ 18.4.1) —
sayılan bir yer tutucu listesi değil, doğrulanabilir bir özellik. Bir mock
bunu pattern-match etmeden uygulayabilir, ve uygulayınca **ilk kez telin en
sık ürettiği satırı üretebiliyor: rollü ama şirketsiz.** Eskiden iki ad
birlikte yazılıyordu, yani o satır yalnız `seedGenerations` ile kurulabiliyordu
— gerçek akıştan hiç geçmiyordu. `roleTitle` kasten kuralın dışında: model rol
adını meşru biçimde yeniden yazıyor.

**Ve düzeltme telde ölçüldü** (2026-09-02, `make record`, MSW kapalı):
`DELETE /account` → `204` ve `sid` `Max-Age=0`; ardından **altı ucun altısı
da `401`**. Dördü eskiden `500` dönüyordu, ikisi (`/account/usage`,
`/generations`) `200` — o da yanlıştı, çünkü hesap yerindeymiş gibi cevap
veriyordu. İkinci `DELETE` de `401`, ve gövdesinde
`resolutions: [{"action": "sign_up"}]`: kataloğumuz onu zaten "Create an
account" diye çiziyor, yani bayat sekmenin önünde çıkışsız bir panel değil
bir düğme var. `GET /auth/session` taze anonim oturum damgalıyor
(`authenticated: false`, `anonymousExpiresAt` dolu) — silme sonrası ekranın
dayandığı iddia, ve artık dev stub'ının değil sunucunun cevabı. Altın profil
`make record` yeniden başlatılınca DevSeeder ile geri geliyor.

**`F-026` istemcide iş çıkarmadı, ve çıkarmaması bir karardı.** Dilim 12'de
metni yumuşatmamıştık; taban 250'den 120'ye inince (§ 34.4.2) "tekrar istemek
genelde geçer" cümlesi yeniden doğru oldu. Ölçüme dayanmayan bir yumuşatma
bugün geri alınacak bir metin olurdu. Uzunluk bandı arayüzde hiçbir yerde
yazılı değil — arayan bir `rg` ile bakıldı — o yüzden bandın değişmesi tek bir
dizeye bile dokunmadı.
