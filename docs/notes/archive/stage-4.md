# İnşa Notları — Aşama 4 (frontend, sürüyor)

> Aşama 4'ün kapanan dilimleri. **Rutin okunmaz**, arkeoloji için:
> `rg -n "<konu>" docs/notes/archive/`.
>
> Aşama 3'te olduğu gibi burada da ölçek **dilim**, aşama değil:
> `current.md` 400 satırla sınırlı ve aşama sürerken doldu. Aktif dosyaya
> yalnız **değişmezler, kasıtlı boşluklar ve hâlâ açık olanlar** geçti —
> burada duran şey bir dilimde neyin neden öyle yapıldığı.

---

### D7 kapandı — arşivleme, ve vaadin bugünkü büyüklüğü (2026-09-20)

`B-102`: uç kaynak haritasında ilk taslaktan beri, `generations.archived`
kolonu V1'den beri vardı ve ikisi hiç buluşmamıştı.

**Kopya bugün doğru olanı vaat ediyor, yarın doğru olacağı değil.** İşaretin
satın aldığı şey bir saklama kuralı — arşivlenmiş bir üretimin çıktısı hiç
sonlanmıyor — ama nesne deposu inene kadar zaten hiçbir şey sonlanmıyor
(§ 57.4). O yüzden cümle "işaret tutuluyor ve okunuyor" diyor, "dosyanı
silinmekten koruyor" demiyor. Kural ısırmaya başladığında cümle **güçlenir**;
önce fazla vaat eden bir cümle **zayıflamak** zorunda kalırdı, ve kimse
düzeltme okumaz.

**İşaret bir yerde konuyor, başka yerde okunuyor** ve maddenin kendisi böyle
diyor: sonuç ekranı kişinin "bu CV önemliydi" dediği yer, geçmiş ise
okunduğu. Geçmişte **kendi rozeti yok** — satır hakkında doğru olan bir şey
daha, dili ya da sayfa sayısı gibi; olgulara katılınca erişilebilir ada da
bedavaya giriyor, ve renk ya da ikon değil söz (kural 6).

**Anonimde çizilmiyor, ve bu esirgeme değil anlamsızlık.** Anonim oturumun
üretimleri profiliyle gidiyor, yani işaretin saklayacağı bir şey yok. Diğer
iki eksik kontrolden (ön yazı, geri bildirim) farkı bu, ve test bunu ayrı
cümleyle yazıyor.

**Mock'ta iki gövde bire indi.** Arşivleme ucu "üretimin şu anki hâlini"
döndürüyor, yani okumayla aynı gövde — iki literal, bir yazma ile bir okumanın
ayrışmaya başlama şeklidir, ve ayrışma ekranda "cache'e yazdım, yenileyince
başka şey gördüm" diye çıkar. `generationBody` çıkarıldı.

**Boş gövde "değişiklik yok" değil, `true`.** Bir istemcinin en kolay ters
anlayacağı şey bu; mock alanı zorunlu tutsaydı, hiçbir şey göndermeyen bir
çağıran doğru görünürdü.

**`count` bilerek invalidate edilmiyor.** Arşivleme bir üretim eklemiyor ya da
silmiyor — işaret bir saklama kuralı, silme değil — yani silme ekranının sesli
söylediği sayı değişmedi; invalidate etmek, zaten doğru olan bir şeyi öğrenmek
için istek atmak olurdu.

**Negatif kontrol yapıldı:** anonim kapısı kaldırıldı, anonim testi düştü.

**Ölçüm:** 909 birim testi yeşil, typecheck ve lint temiz.

### D8 kapandı — seçimin gerekçeleri (2026-09-20)

`B-108`: İlke 7 her seçimin gerekçesinin gösterilmesini istiyor ve **üç şey**
adlandırıyor — skor, eşleşen keyword'ler, red nedeni. Üçü de hesaplanıyordu,
hiçbiri telde değildi; yani bu liste **gerekçesi hiç yayımlanmamış** bir
sıralamaydı.

**Skor hâlâ yok ve istenmemeli.** § 23.3'ün yüzdeye itirazı bir madde
yanındaki sayı için de geçerli, ve sıra zaten sıralamayı söylüyor.

**Yokluk sözleşmenin parçası, eksiklik değil.** `matchedKeywords` **hiç
gelmiyor**, boş dizi olarak değil: seçilmiş bir satırın yanındaki boş dizi
"hiçbir şey eşleşmedi" diye okunur, ve genel CV modunda — ortada ilan
yokken — bu içerik hakkında bir iddia olurdu. Mock ikisini de üretiyor: hem
alanı, hem alanın olmayışını. Hep gönderen bir fixture, ekranın sunucunun hiç
göndermediği bir şekle karşı yazılmasına izin verirdi.

**Dört neden dört ayrı cümle, ve biri tehlikeli.**
`EXCLUDED_BY_DIRECTIVE` **bu CV'de** yapılmış bir düzenleme; onu profil ayarı
gibi geri aldıran bir ekran, kişiye kalıcı bir kararı geri aldırır. Cümle
"profiline hiç dokunulmadı" diyor. `INACTIVE` tersi — profil hakkında bir
olgu — ve **tek** profil bağlantısı taşıyan o.

**Cümle taslağa göre çiziliyor, sunucunun cevabına göre değil.** Switch
açıldığı anda satır sayfaya gidiyor; yokluğu açıklayan bir cümle, kişinin az
önce terk ettiği bir durumu tarif ederdi. Alan zaten sayfaya giren satırda
yok, yani kişinin kendi çıkardığı satır da burada bir şey söylemiyor —
sunucu onu geri tutmadı, kişi tuttu.

**Mock'un `EXCLUDED_BY_DIRECTIVE`'i bir düzenlemeden doğuyor**, `weigh`'den
değil: tek üreteni bir insan, ve `include` gelen satırda alan **siliniyor** —
seçilmiş bir satırın yanında bayat bir neden, olmayan bir yokluğu açıklardı.

**Kapalı atom testte kuruluyor, ortak fixture'da değil.** `INACTIVE` profil
hakkında bir olgu, yani durum kişinin kuracağı gibi kurulmalı; seed profilde
kapalı atom yok ve olmamalı — editörün kendi testlerindeki her atom sayısı
onunla kayardı. `resetProfileFixture` geri alıyor.

**Bir sorgu kapsandı ve sebebi kayda değer:** birkaç satır terim taşıyor, yani
kapsamsız bir `getByRole('list')` ya yanlış satırı bulur ya da **başka bir
satıra ait** bir çiple geçer.

**Ölçüm:** 914 birim testi yeşil, typecheck ve lint temiz.

### D9 kapandı — atom etiketleri, ve sıfırdan çıkan çeyrek (2026-09-20)

`B-103` sayıyı veriyor: **Faz B'nin ham skorunun dörtte biri** atomun
etiketleriyle ilanın istedikleri arasındaki örtüşme, ve `tags` ile `atom_tags`
tablolarına **hiçbir şey** yazılmıyordu — içe aktarım modelin bulduğu
etiketleri normalize edip düşürüyordu. Yani o çeyrek, her atom için her ilana
karşı **yapısal olarak sıfırdı**. § 55'in "etiket / önem / kilit" editörünün
eksik yarısı buydu.

**`TagInput` yeniden kullanılmadı, ve bu bir tekrar değil.** Yanındaki üç
liste `AtomPatch`'in **alanları** ve bütün olarak değişiyor; etiketler **satır**
— id'si var, tek tek ekleniyor ve siliniyor, ve kimin koyduğunu taşıyor. Ortak
kontrol, ya tek etiket alan bir uca bütün liste göndermek ya da satır şeklinde
bir şeyi alan gibi göstermek olurdu. `TagInput`'a eklenen tek şey D6'nın
`maxCount`'u.

**`auto` ile `user` farklı çiziliyor, çünkü farklı iddialar.** `auto` çıkarımın
kişinin işi hakkındaki tahmini, `user` kişinin kendi kararı. Aynı çizilseler
tahmin bir seçim gibi görünürdü — ve hangisinin hangisi olduğunu ayırt
edemeyen birinin ikisini de düzeltmek için sebebi olmaz. Ayrım kenarlıkla
**ve sözle** (kural 6).

**Hiçbir sürüm gitmiyor**, ve bu dosyadaki diğer her yazmadan farkı bu: etiket
kendi satırı, atoma dokunulmuyor, yani önkoşulun hakkında olacağı bir atom
sürümü yok. `versionOf`'a uzanmak, uçun istemediği bir `If-Match` göndermek ve
bir atomu etiketleyen iki kişiyi çakışma saymak olurdu — doğru sonuç iki
etiket. Test bunu **hem başlığın yokluğuyla hem atom sürümünün kıpırdamamasıyla**
sabitliyor.

**Ekranda yazılan değil, dönen çiziliyor.** Etiket kırpılmış ve küçük harfe
çevrilmiş saklanıyor, çünkü skorlayıcının karşılaştırdığı biçim o; girdiyi
yankılamak, skorlanan sözcük olmayan bir sözcüğü göstermek olurdu.

**Zaten taşınan bir etiket istek üretmiyor.** Uç idempotent, yani zararsız
olurdu — ama boşa bir gidiş dönüş ve alanın bir şey yapmış gibi göründüğü bir
an. Karşılaştırma `toLocaleLowerCase('en')` ile: `ETL` okuyucunun Türkçe
locale'inde `etl`'ye eşleşmezdi (kural 11).

**Mock idempotent çağrıda `source`'u yeniden yazmıyor:** çıkarımın tahmininin
üstüne aynı etiketi yazan kişi, onu sessizce sahiplenmiyor.

**Ölçüm:** 922 birim testi yeşil; `/profile` **255.8 → 256.5 KB** (tavan 280),
landing 0.0 KB.

### D4 kapandı — bayat varyant kontrolü ve iki bayat test (2026-09-20)

`B-115`'in dört maddesinden üçü zaten yazılıydı; eksik olan dördüncüsüydü.
**Anonim oturumda çeviri kuyruğa girmiyor** — o oturumun ne işi sahiplenecek
bir id'si var ne ikinci bir dili — yani iki satır da kendince yalan olurdu:
"yenileniyor" olmayacak bir işi adlandırır, "yeniden üret" sunucunun kabul
edip hiçbir şey kuyruğa koymadığı bir yamayı gönderir. Doğru şekli sessizlik.

**Koşul `!== false`**, `=== true` değil: oturum uçuşurken de çizilmiyor.
`useCanWriteCoverLetter`'ın gerekçesi — görünüp kaybolan bir kontrol arada
basılabilir — burada bir kat daha ağır basıyor, çünkü basılacak ekran kişiye
**kendi cümlesinin** değiştirileceğini söyleyen ekran.

**Bugün başka yoldan da erişilemez** ve bu yüzden dal değil muhafız: anonim
profil tek dilli, yani hiçbir sözcükleme başkasından türemiyor ve `stale`'in
doğru olacağı bir şey yok. § 9'un dar ürünü dilleri eksilterek daralıyor,
doğruluğu değil.

**İki test bayattı ve ikisi de aynı sebepten.** `VariantTabs.test` ile
`StaleWording.test` oturumu hiç okumuyordu — mock'un varsayılanı anonim, yani
iki sözcüklemeli bir atomu anonim bir oturumda çiziyorlardı; anonim profilin
üretemeyeceği bir şekil. Şimdi ikisi de `signIn()` okuyor.

**Biri ise bir şey kanıtlamadan geçiyordu.** *"offers no regenerate button,
because nothing could answer it"* — Aşama 1'de doğruydu, Aşama 3'te ikisi de
değişti, satır kaldı. Üstelik eşleştirmesi `/regenerate/i` ve düğmenin adı
"Write it again from the new source": düğme indiği günden beri **hiç
bulunamayacak** bir adın yokluğunu iddia ediyordu. Bir test hem bayat bir
kararı sabitleyip hem hiçbir şey ölçmeyebiliyor. Tersine çevrildi.

**Negatif kontrol yapıldı:** muhafız kaldırıldı, anonim testi düştü.

**Ölçüm:** 892 birim testi yeşil, typecheck ve lint temiz.

### D5 kapandı — dört biçim, üç farklı sayfa iddiası (2026-09-20)

`B-105` iki şeyi birden indirdi: `format=source` ilk taslaktan beri § 35.3'ün
haritasındaydı ve `400` dönüyordu, HTML renderer'ın paketi de boştu. İkisi de
serviste, yani iki yeni düğme.

**Sayfa sınırı artık üç şey söylüyor ve üçü ayrı cümle.** PDF'te **kesin**,
Word'de **yaklaşık** (atomlar dizilmiş bir sayfaya sığanlar, Word onları kendi
fontlarının aldığı yerde diziyor), HTML'de **hiç geçerli değil** — Word'ün
zayıf hâli değil: aşılacak bir sayfa yok. "Aşağı yukarı bir sayfa" ile "burada
sayfa diye bir şey yok" farklı vaatler, ve HTML'i bir forma yapıştıran kişiye
lazım olan ikincisi. Ekran iki satır yukarıda bir sayfa sayısı söylüyor, yani
bu cümle o sayının neyi kapsamadığını söyleyen tek yer.

**`DOWNLOAD_EXTENSION` bir kolaylık değil.** Query değeri bir **biçim** adı,
dosya ise `.tex`: `format` interpolate edilseydi tarayıcı
`atomcv-<id>.source` diye kaydederdi ve kişinin makinesinde onu açan hiçbir
şey olmazdı. Aynı harita mock'un `Content-Disposition`'ında da var, ve testin
asıl iddiası o.

**`source` `text/plain` olarak servis ediliyor**, `application/x-tex`'in
yazımlarından biri olarak değil: bu **bakılacak** LaTeX, ve tarayıcının
bilinmeyen tür sayıp indirdiği bir medya tipi, açacağı bir tipten kötü. Ters
yöne LaTeX göndermek zaten yasak — okumayı zararsız kılan da bu.

**Bilinmeyen biçimin reddi duruyor** ve gerekçesi ilk yazıldığı günkü: sessiz
bir PDF'e düşüş, hiç servis edilmeyen bir biçimin düğmesine PDF döndürürdü ve
kimse dosyayı açana kadar fark etmezdi. Test `rtf` ile soruyor.

**Ölçüm:** 897 birim testi yeşil, typecheck ve lint temiz.

### D6 kapandı — iki yönlendirme alanı, varsayılan kapalı (2026-09-20)

**Kapsam bir alan daraldı ve gerekçesi kayda değer.** Plan D6'ya üç alan
yazıyordu; `customizationId` **D12'ye taşındı**, çünkü kaydedilmiş bir görünüm
seti yokken bir seçici çizmek, kişiye özelliğin bozuk olduğunu öğreten bir
kontroldür. Alan telde duruyor, isteği kuran yer aynı — eksik olan tek şey
kaydı üreten ekran.

**Kapalı olması bir yerleşim tercihi değil, ürün kuralı.** "Elle kontrol
isteğe bağlı", varsayılan çıktının kimse hiçbir şeye dokunmadan kullanılabilir
olması demek; üç girdiyle açılan bir ekran, boş iki tanesinin önemli olduğunu
**zaten söylemiş** olur. Panel kapalıyken **mount edilmiyor**, yani "varsayılan
senden bir şey istemiyor" iddiası sekme sırası için de doğru.

**İkisi de ne profile ne ilana ait, istek alanı olmalarının sebebi bu.**
`emphasize` ilanın kendi keyword'lerine tek koşu için katılıyor ve **pasted
metne katlanamaz**: bir ilanın analizi hash'iyle cache'leniyor ve onu
yapıştıran herkes arasında paylaşılıyor, yönlendirme ise bir kişiye ve bir
koşuya ait. `note` yalnız Faz D'ye gidiyor — Faz B ilana karşı sıralıyor ve bir
cümle terim değil.

**İkisi de boşken gönderilmiyor.** Boş bir `emphasize` hiçbir terim adlandıran
bir yönlendirme, boş bir `note` prompt'a verilip yok sayılması gereken bir
cümle. Şemanın kendi açıklaması `customizationId` için aynı okumayı yapıyor:
"yokluğu neredeyse her isteğin kastettiği şey".

**Reddedilmeden yeniden gönderilenler korunuyor.** Bu ekrandaki her çıkış yolu
isteği tekrar gönderiyor (`continue_anyway`, `continue_as_general_cv`,
`increase_page_limit`) ve gönderdiği şey kişinin kastettiği istek. Yönlendirmeyi
orada düşürmek, tek işi aynı isteği tekrar göndermek olan bir düğmenin
arkasında isteği sessizce değiştirmek olurdu.

**`TagInput` bir `maxCount` kazandı** ve sınırda **devre dışı kalıp sebebini
söylüyor**. On birinci girdiyi yutmak, kişiye listesinin yanlış olduğunu birer
birer öğretirdi (P8) — üstelik burada liste, sıralamanın okuduğu şey. `onBlur`
sınıra giderken de tetiklendiği için taslak ayrıca düşürülüyor.

**Sınır mock'ta da var, ekranda olmasına rağmen.** Ekran ikisini de kapıyor,
yani gönderdiği hiçbir şey oraya varamaz — reddin kodlanma sebebi tam olarak
bu: yalnız istemcinin tuttuğu bir sınır, ikinci bir çağıran yazılana kadar
tutan bir sınırdır.

**Bir test kapsamsız sorguyla kırıldı ve düzeltilmesi doğruydu.** "Üç çıkış
yolu, gönderildiği sırada" ekrandaki **bütün** düğmeleri okuyordu ve formun
kendi submit'ini de listeye sayıyordu; iddia sunucunun sıralaması hakkında,
ekranın kaç kontrolü olduğu hakkında değil. Panele kapsandı, ve "submit satırın
dışında" ayrı bir iddia olarak yazıldı.

**Ölçüm:** 902 birim testi yeşil, typecheck ve lint temiz.

### D1 kapandı — şemanın açtığı sekiz kırık (2026-09-20)

**`failed` ve `cancelled` birer dal değil, birer yokluktu.** `B-116`'nın
gerekçesi yapısal ve ikisi de aynı cümleden çıkıyor: `selection_state`
`NOT NULL`, yani seçimden önce düşen bir koşunun yazacak **generation satırı
yok** — arıza **işin** üstünde yaşıyor, ki `JobStatusResponse.status`
`failed`'i hâlâ taşıyor. `cancelled`'ı ise hiçbir uç üretmiyor.

Bunun mock'a maliyeti göründüğünden büyüktü. Geçmiş listesi başarısız bir işi
`status: 'failed'` ile **satır olarak** yayımlıyordu ve `GET /generations/{id}`
onu buluyordu; ikisi de veritabanının tutamayacağı bir şeyi tarif ediyor. Mock
artık başarısız koşuyu listeden düşürüyor ve tekil okumada **404** veriyor.
Ekran tarafında `History`'nin "bitmemişse bağlantı değil" dalı silindi —
kalan tek koşul `generationId` yokluğu, ve `superseded` **bilerek dışarıda**:
değiştirilmiş bir üretim belgesi olan bitmiş bir üretimdir.

**Testin kendisi tersine çevrildi, silinmedi.** "Başarısız üretime yol
açmıyor" artık "başarısız koşu geçmişte hiç yok" diyor; eski hâli doğru
şekilli ama var olmayan bir satır hakkındaydı.

**İki muhafız eklendi.** `endpoints/jobs.ts`'te `TERMINAL` artık yayımlanan
enum'a karşı **sınıflandırma** kontrolü taşıyor: her durum ya terminal ya
uçuşta, üçüncüsü derlemeyi düşürüyor. `cancelled` geri geldiği gün — iptal bir
özellik — bu, sessizce asılı kalan bir akış yerine bir typecheck hatası olur.
`MockSelectionLine`'ın `Required<>`'ı da daraltıldı: `B-108`'in iki alanı
**yokluğuyla** anlam taşıyor (`matchedKeywords: []` "hiçbir şey eşleşmedi"
diye okunur), ve yokluğu ifade edemeyen bir fixture ekranın karşılaşacağı
durumu üretemez.

**İki bayat çeviri anahtarı silindi** (`REWRITE_VALIDATION_FAILED`,
`NO_ANONYMOUS_PROFILE`) ve `History.status`'ın `failed` dalı da. `B-111`'in
korktuğu "on beş eksik mesaj" **çıkmadı** — 41 kodun 41'i yazılıydı, iki dil
birebir senkrondu; gerçek bulgu fazlalıktı. `B-114`'ün iki yeni eylemi
**etiket olarak** indi, davranışları D3'te.

**Ölçüm:** 821 birim testi yeşil, typecheck temiz, lint temiz.

### D2 kapandı — katalog testi üretilen tabloya bağlandı (2026-09-20)

`B-110`'un teklifi alındı. `errorCatalogue.test.ts` artık
`docs/error-catalogue.md`'yi **veri olarak** okuyor ve kendi `PARAMS`'ıyla üç
şeyi karşılaştırıyor: kod kümesi, kod başına parametre **adları**, ve her
adın **tipi**. Zincirin ikinci halkası bağlandı — backend bir kod eklediğinde
`ErrorCatalogueDocumentTest` orada, bu test burada düşüyor.

**Sayılar da denetlendi ve `B-111`'in ikisi de yanlıştı.** Madde "27'ye karşı
enum'da 41" diyordu; ölçüldü: **enum 40, katalog 40, ve ikisi birebir aynı.**
Bizim tarafta bir eylem gerektirmiyor, ama bir sayıyı doğru sanmakla ölçmek
arasındaki farkın kaydı olsun.

**Tip karşılaştırması tek yönlü.** Soru "`PARAMS` yalan mı söylüyor" — "tek
doğru bu mu" değil. `integer` 2.3'ü reddediyor, `number` 1'i kabul ediyor:
daraltan taraf katalog. `timestamp` telde bir metin, çünkü `Date` teli
geçemez — `formatErrorParams` onu çeviren tek yer.

**`Vite`'ın bir kuralına çarpıldı ve kayda değer.** `new URL(yol,
import.meta.url)` Vite'ta bir **varlık referansıdır**; kalıp derleme anında
yeniden yazılıyor ve `fileURLToPath` elinde çıplak bir `/docs/…` buluyor,
sonra fırlatıyor. Dizin önce alınırsa kuralın eşleşeceği bir şey kalmıyor.

**Boş yere geçmenin yolu kapatıldı.** Her kontrol ayrıştırılmış satırlar
üzerinde dönüyor, yani hiçbir şey eşleştirmeyen bir ayrıştırıcı hepsini tek
satır okumadan geçerdi — biçim değişikliğinin yaratacağı hatanın ta kendisi,
ve başarıya benzeyen tek hata. `read the file` bunun için var, ve okunamayan
bir satır artık atlanmıyor, **fırlatıyor**: kırkta otuz dokuzu ayrıştıran bir
biçim değişikliği eşiği geçerdi.

**Negatif kontrol yapıldı, üç yönde** (Aşama 2'nin dersi): yanlış tip →
tip kontrolü düştü; katalogda ad değişikliği → ad kontrolü düştü; tablo
biçimi bozuldu → `read the file` düştü.

**Ölçüm:** 880 birim testi yeşil (D1'de 821'di), typecheck ve lint temiz.

### D3 kapandı — dört reddin çıkış yolu, iki metnin ayrılması (2026-09-20)

**`B-114`'ün asıl bulgusu mock'un sadakatiydi.** Dört çıkarım reddi boş bir
`resolutions` dizisiyle geliyordu ve mock bunu **sadakatle** üretiyordu — yani
"cümle var, düğme yok" hâli defalarca bakıldı ve hiç görülmedi. Üçü artık
çözüm taşıyor; `switch_to_manual_form` sözlükte üretensiz duruyordu.

**`upload_another_file` bir `retry` değil ve fark maddenin tamamı.** Şifreli
dosya her seferinde aynı yerde düşüyor, yani tekrar düğmesi kilitli olduğu
bilinen bir kapı açıyor. Seçilen dosya **önce temizleniyor**: seçici kapatılıp
Yükle'ye basılabilseydi, kaçınmak için yazılan tekrar geri gelirdi.

**`choose_language` çizilmiyor ve bu `F-037`.** Sunucu onu gönderiyor, ekranın
soruyu sorması doğru, ama cevabın gideceği alan yok: `POST /profile/import`
yalnız `mode` yayımlıyor, gövde `file` ve `challengeToken` taşıyor. Üstelik kod
**işten** geliyor (§ 08b, Adım 3.4), yani red anında yazılmış bir profil de
yok. `ErrorPanel`'in politikası — taşıyamadığını düşür — `keep_top_pinned`'de
verilen kararın aynısı, ve mutlak kural 7 ile sürtündüğü için madde açıldı.
**Düğmenin çizilmediği bir testle sabitlendi**: alan indiği gün o test
düğmenin artık borç olduğunu söyleyecek.

**İki metin ayrıldı, çünkü `B-113` sunucuda ayırmıştı.** 504 aynı dosyayla
tekrar denemeye davet ediyor, 503 denemenin yardımcı olmayacağını söylüyor —
ikisi kullanıcıdan **zıt** şeyler istiyor ve ikisi de "bir şeyler ters gitti"
deseydi ayrım ekrana giderken kaybolurdu. Üç kontrol: 504 tekrar diyor mu,
503 yardımcı olmaz diyor mu, ikisi aynı cümle değil mi.

**`FEATURE_REQUIRES_ACCOUNT` beşinci dalını aldı** (`archive`) ve cümlesi
"hesap gerekiyor"dan fazlasını söylüyor: anonim oturumun üretimleri profiliyle
gidiyor, yani işaretin saklayacağı bir şey **yok** — kontrol esirgenmiş değil,
anlamsız.

**Ölçüm:** 891 birim testi yeşil, typecheck ve lint temiz.

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
