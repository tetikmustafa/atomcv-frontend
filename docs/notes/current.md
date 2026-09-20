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

**Bir kereliğine sabit bir sıra var.** § XI-A.7 "sabit sıra yok" diyor ve bu
hâlâ doğru; aşağıdaki, o serbestliğin bir kez kullanılmasıdır: on yedi açık
madde, şemanın dokümanı geçtiği dört nokta ve § 55'in kalan `[F]` kalemleri
tek bir listeye dizildi ki "bitti" denebilecek bir son olsun.

**Verilen dört karar.** Kapsam **§ 55'in `[F]` kalemlerinin tamamı** — kasıtlı
boşluklar dahil, büyüme ve açık kaynak dahil. **VPS bu turda alınmıyor**, yani
ölçüm isteyen her şey D14'te toplanıyor ve kod onsuz yazılmıyor. **`B-110`
bağlanıyor** (D2). Sıra önce yazıldı, sonra koşulacak.

**Ölçüm — bu listenin başlangıç noktası, 2026-09-20.** `npm run gen:api`
koşuldu (`api.d.ts` 964 satır), **821 birim testinin hepsi yeşil**, ve
`typecheck` **sekiz** hata veriyor. Sekizi de aşağıda bir dilime bağlı;
başka hiçbir yerde kırık yok.

| # | Dilim | Kapattığı |
|---|---|---|
| D1 | Şemanın açtığı sekiz kırık + iki bayat çeviri anahtarı | `B-111`, `B-112`, `B-116` |
| D2 | `errorCatalogue.test` üretilen tabloyu ayrıştırır | `B-110` |
| D3 | `EXTRACTION_TIMEOUT` metni 503'ten ayrılır; `archive` dalı; iki yeni çözüm anahtarı ve davranışı | `B-113`, `B-114` |
| D4 | `StaleWording` anonimde çizilmez | `B-115`'in tek eksiği |
| D5 | İndirme: `html` + `source` | `B-105` |
| D6 | Üretim isteği: `emphasize`, `note`, `customizationId` | `B-104` + F-034 |
| D7 | Arşivleme | `B-102` |
| D8 | Seçim gerekçeleri: `matchedKeywords`, `heldBackReason` ×4 | `B-108` |
| D9 | Atom etiketleri | `B-103` |
| D10 | `auto` çevirinin üç sonucu | `B-107` |
| D11 | GitHub içe aktarımı | `B-106` |
| D12 | Şablon kapasitesi + adlandırılmış özelleştirmeler | F-035, F-036 |
| D13 | Kasıtlı boşlukların kapananları | aşağıdaki tablo |
| D14 | Açık kaynak ve büyüme | § 55 `[F]` |

**Sıranın gerekçesi.** D1-D4 bugünkü kırığı kapatır ve hiçbir yeni yüzey
açmaz — CI yeşile dönmeden yeni ekran çizmek, kırığı iki katına çıkarmaktır.
D5-D8 telde **zaten var olan** alanları okur, yani en ucuz getiri. D9-D12
yeni ekran ister. D13-D14 karar ve metin ağırlıklı, ve ikisi de kodun geri
kalanı otururken yazılmalı.

**Dört `F-nnn` D6'dan önce açılır** — üçü doküman düzeltmesi, biri soru:
`POST /generations` **`note` alanı geldi** ve `B-104` "gelmedi ve bilerek"
diyor (F-034); **`GET /templates`** ve **`/customizations`** hiçbir maddede
adlandırılmadı (F-035, F-036); `customizationId` de öyle. Dördü de
`gen:api`'nin bulduğu şeyler, bir maddenin değil — **şema dokümanı geçti**,
ve bu, `B-101`'in bağlamak istediği muhafızın yokluğunun ta kendisi.

**Ucu olmayan üç iş `F-nnn` olarak kalır, D13'e girmez:** § 37.5'in arka plan
iş göstergesi, § 33.3'ün "yeniden hesaplanıyor"u, ve ürün dokümanının saydığı
ATS uyumluluk doğrulaması. Üçünün de bugün yayımlanan bir durumu yok. **Dördü
`keep_top_pinned`** — sunucu bu çözümü gönderebiliyor, `ErrorPanel` onu
bilerek çizmiyor, çünkü basıldığında dolduracağı istek alanı yok. Çizilmemesi
doğru ama kalıcı değil: mutlak kural 7 sunucunun gönderdiği bir çözümün düğme
olmasını istiyor, yani burada ya alan gelir ya çözüm kalkar.

**D13 — kasıtlı boşlukların verdikti.** Aşağıdaki tablonun gerekçeleri
duruyor; değişen, hangilerinin artık kapatılacağı. Bir boşluğu kapatmaya
"gerekçesi bayatladı" dendiği için karar veriliyor, "artık yapabiliriz"
dendiği için değil.

| Boşluk | Verdikt |
|---|---|
| Mark'ları düşüren metin düzenleme | **Kapanıyor.** Mutlak kural 4 zaten bileşeni adıyla sayıyor; uyarı bir köprüydü, şablon değil |
| Sözcükleme tek başına silinemiyor | **Kapanıyor.** `deleteVariant` uçta ve `endpoints/profile.ts`'te var, iki reddi de mock üretiyor, yalnız düğme yok |
| Profil başında dil eksenleri | **Kapanıyor.** Gerekçesi 2026-09-08'de bayatladı; `allowedLanguages` yayımlanıyor ve okunuyor |
| Bölüm düzeni seçici | **Kapanıyor**, ve `two_column` kalktığı için artık dört değer. Dördünün ICU adı ve About için `paragraph` varsayılanı ile — yarısı bu boşluğun kendisiydi |
| "Bir sayfadan kısa CV" notu | **Kapanıyor, ama sinyal değişti.** Sunucu hâlâ "sayfa dolmadı" demiyor; `pageCount < maxPages` ise belge *istenenden* kısa demektir, ve o sayılabilir bir olgu. Not bunu söyler, doluluğu değil |
| `format=source` düğmesi | D5'te kapanıyor — uç artık `400` dönmüyor |
| PDF önizlemesi | **Kalıyor.** Ölçülmüş karar ve ölçümü değiştiren bir şey olmadı |
| Başvurularda duruma göre süzme | **Kalıyor.** `B-093`'ün gerekçesi aynen geçerli; tek sayfanın üstünde istemci süzgeci, süzdüğünü sandığı şeyi süzmez |

**D14'ün ikiye ayrıldığı yer.** `README` (bugün hâlâ "Stage 0 — skeleton"
diyor), `CONTRIBUTING`, `SECURITY` ve `.env.example` denetimi dağıtım
istemiyor ve yazılır. **Analitik, `deploy.yml` ve `NEXT_PUBLIC_SITE_URL`
istiyor** — bunlar yazılmaz, aşağıdaki dağıtım kontrol listesine geçer.
Ölçümü alacak bir yer yokken huni ölçen kod yazmak, çalıştığını hiç
görmeyeceğimiz bir şeyi bakım yüküne çevirmek olurdu.

**§ 55'in iki büyüme kalemi kapsam dışı bırakıldı, ve ikisi de kendi
gerekçesiyle** — `handoff/to-backend.md`'ye `F-nnn` gitmiyor, ikisi de
frontend'in kendi kararı:

- **Blog yazılmayacak.** Yerine **tek bir statik "nasıl çalışıyor"
  sayfası**: sayfa garantisini ve atom modelini anlatan, çevrilmiş, kendi JS'i
  olmayan bir pazarlama sayfası. SEO getirisi blogun çoğu, bakım yükü yok —
  bir blog, yazılacak içeriği olmayan bir hattır, ve boş hat SEO getirmez.
  Sayfa `(app)` dışında kalır, yani landing'in 0.0 KB'ı korunur ve
  next-intl'in `Link`'i yerine açık locale önekli `<a>` kullanılır.
- **Üçüncü arayüz dili eklenmeyecek.** 495 anahtar, ve sayı asıl maliyet
  değil: her ICU dalı — `UNPARSEABLE_JOB_DESCRIPTION`'ın yedi reason'ı,
  `OAUTH_FAILED`'ın yedisi, `FEATURE_REQUIRES_ACCOUNT`'ın beşi,
  `COVER_LETTER_REJECTED`'ın altısı — elle doğrulanmak zorunda, ve
  `errorCatalogue.test` her birini ayrı cümle olmaya zorluyor. Kullanıcısı
  olmayan bir dil, yazılan her yeni mesajda ödenen bir vergidir. **İçerik dili
  ekseni bundan ayrı** ve değişmiyor: `allowedLanguages` backend'in, bugün
  `["en","tr"]`, ve `auto` ilanı takip ediyor (`B-107`).

### Kapanan dilimlerin kaydı → `archive/stage-4.md`

D1, D2, D3 oraya indi (2026-09-20), 400 satır sınırı yüzünden. Burada
yalnız **hâlâ geçerli olan** kalıyor; bir dilimde neyin neden öyle yapıldığını
arıyorsan `rg -n "D1 kapandı" docs/notes/archive/`.

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

### `B-097`-`B-099` — backend'in üç cevabı, geldikleri gün (2026-09-12)

İkisi kasıtlı boşluktu ve ikisi de listeden **indi**: elle aç/kapa arayüzü ve
emekliden halefe bağlantı. Üçüncüsü şema hijyeni.

**`gen:api` iki kez koşuldu, ve birincisi bayat bir sunucuya karşıydı.**
8080'de duran süreç işin ortasından bir derlemeydi: `/selection`'ın `GET`'i
yoktu, `operationId`'ler hâlâ numaralıydı, ve `GenerationResponse` ile
`FitReport` şemadan **tamamen düşmüştü** — `GET /generations/{id}`'in 200'ü
`content: {}`. Commit edilseydi sonuç ekranının iki tipini silerdi. Ders,
`docs/notes` ölçeğinde kalıcı: **`gen:api`'nin çıktısı, derlemenin taze
olduğunu kanıtlamaz.** Üretimden sonra `git diff`'e bakılır ve *silinen* bir
şema, eklenen bir alandan daha çok şey söyler.

**Bağlama artık isimle.** 26 operasyon adı değişti; `ReturnsAt`/`AcceptsAt`
silindi, çünkü tek varlık sebepleri numaralı id'lerdi ve § 35.8.1 artık her
uçta açık bir ad zorunlu kılıyor — muhafız isim değil, backend CI'ında
`_<sayı>` gören test. Gerekçesi bayatlamış bir yardımcıyı bırakmak, onu
silmekten pahalı.

**İki düğme aynı adı taşıyordu** ve bunu test buldu: toggle'ın kaydet
düğmesiyle cümle kutusununki ikisi de "Make the change" idi. Aynı ekranda
aynı erişilebilir adı taşıyan iki düğme bir kusurdur — metin ayrıldı ("Apply
these lines"), kopyalama değil.

**Sonuç rotası 219.3 → 224.4 KB** (elle ölçüldü, `next start`, aynı gzip
yöntemi). Panel kapalı başlıyor, yani listeyi açmayan kimse ikinci isteği
ödemiyor.

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