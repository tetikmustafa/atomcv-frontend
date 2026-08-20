# İnşa Notları — Aktif (frontend)

> Kural: bu dosya **480 satırı geçmez**. Aşama bitince `archive/`'a taşınır.
> (200'dü; Aşama 1 kapanmadan doldu ve bölmek yerine sınır büyütüldü — D.10
> backend'e taşınan kaynak, ayrı dosyaya alınamaz.)
> Bu dosya **backend'e senkronize edilmez** — repo-yerel.

---

### D.10 — Frontend inşa notları

`atomcv-frontend`'in inşa kararları. Backend'inkiler D.1-D.8'de; bu bölüm
onun karşılığıdır ve **frontend reposunda yazılıp buraya taşınır** — `docs/`
orada salt-okunur bir kopyadır (Bölüm XI-B.1.3), dolayısıyla kaynak burasıdır.

| # | Konu | Tür | Karar |
|---|---|---|---|
| 1 | Next.js sürümü (Bölüm 5.2 "15" diyordu) | Sapma | **16.** 15.x backport dalına geçti; oradan başlamak ilk gün migration borcu demekti. `next-intl` 16'yı destekliyor. Turbopack varsayılan bundler, öyle bırakıldı. Bölüm 5.2 güncellendi. |
| 2 | `tailwind.config.ts` (XI-B.3 bekliyordu) | Düzeltme | **Yok.** Tailwind v4 CSS-first; tema token'ları `src/styles/globals.css` içinde `@theme` ile. |
| 3 | `next.config.mjs` (XI-B.3) | Düzeltme | **`next.config.ts`** — `create-next-app` tipli config üretiyor. |
| 4 | Locale yönlendirmesi | Ekleme | `src/proxy.ts`. Next 16'da `middleware.ts` **`proxy.ts` olarak yeniden adlandırıldı**. Matcher `/api`'yi dışlar: dışlamazsa her API çağrısı `/en/api/v1/...`'e yönlendirilip kırılır. |
| 5 | Client provider'ların yeri | Ekleme | Root layout'ta değil, **`[locale]/(app)/layout.tsx`** içinde. Landing ve legal hiçbir şey fetch etmiyor; app shell'in çektiği her kilobayt aksi hâlde ürünle ilk temasta ödeniyor (Bölüm 12). Ölçüldü: yalnız TanStack Query'yi taşımak **7 KB gzip** kazandırdı. |
| 6 | `NextIntlClientProvider` | Ekleme | O da `(app)` içinde: **tüm mesaj kataloğunu HTML'e serialize ediyor**, root'ta her landing ziyaretçisine legal metnin tamamını gönderiyordu. Bedeli: next-intl'in `Link`'i ve `useTranslations` çağıran client bileşenler yalnız `(app)` altında çalışıyor; dışarıda düz `<a>` + açık `/${locale}` öneki. |
| 7 | `setRequestLocale` | Ekleme | **Her sayfa ve layout'ta ayrı ayrı** çağrılmalı, yalnız parent layout'ta değil. Next layout ve page'i paralel render ediyor, parent'ın çağrısının önce koştuğu garanti değil; eksikse next-intl rotayı dinamik işaretliyor. Legal sayfalar bu yakalanana kadar on-demand render ediliyordu. |
| 8 | Typecheck | Ekleme | `tsc` tek başına yetmiyor. `PageProps`/`LayoutProps` `.next/types`'a **üretiliyor**; `npm run typecheck` önce `next typegen` çalıştırıyor. Temiz checkout'ta düz `tsc` olmayan hatalar uyduruyor, olanları kaçırıyor. |
| 9 | MSW'nin üretime sızması | Düzeltme | Bayrak `NODE_ENV`'e de bakmalı. `next build` `.env.local`'ı da okuyor, yani mock'u lokalde açık bırakan biri MSW runtime'ını kullanıcılara gönderiyor. **İki kez oldu:** ikincisinde dinamik `import()` guard'ın dışına, modül seviyesine taşınmıştı — bundler onu modül grafiğinde erişilebilir görüp chunk'ı korudu, hiçbir şey çağırmasa bile. |
| 10 | MSW worker başlatma | Ekleme | **Idempotent olmalı.** React Strict Mode effect'leri iki kez çalıştırıyor: ilk `start()` başarılı oluyor ama `setReady`'si cleanup'ta iptal ediliyor, ikincisi "cannot configure an already enabled network" ile patlıyor. Kapı hiç açılmıyor ve **tüm uygulama boş render ediliyordu.** |
| 11 | `[locale]/(app)/dev/mocks` | Ekleme | Dev-only doğrulama sayfası; üretim build'inde `notFound()` (Bölüm 51.5'in backend dev uçlarına uyguladığı kuralın aynısı). `(app)` altında başka rota olmadığı için shell, provider'lar ve worker başka türlü hiç mount olmuyordu. |
| 12 | SSE tüketimi (Bölüm 36.4) | Doğrulama | **`EventSource` MSW'nin service worker'ı üzerinden gerçek tarayıcıda doğrulandı**, frame'ler tamponlanmadan tek tek geliyor. Bölüm 36.4 olduğu gibi geçerli; `fetch` + `ReadableStream` yedeğine gerek yok. |
| 13 | Bundle bütçesi aracı (XI-B.3 `bundlesize` diyordu) | Sapma | Ne `bundlesize` ne `size-limit`: ikisi de **isim verebildiğiniz dosyaları** ölçüyor, Next ise içerik-hash'li chunk'lar üretiyor ve hangi rotanın hangisini çektiğini söylemiyor. `scripts/check-bundle-size.mjs` prerender edilmiş her rotanın script etiketlerini okuyor. |
| 14 | Bütçe eşiği (Bölüm 52.3 tek sayı veriyordu) | Karar | `bundle-budget.json`'da **üç sayı**: `sharedKb` (her rotanın ödediği taban, yalnız bağımlılık değişiminde oynar), `perRouteOwnKb` (özellik işinin kontrol ettiği pay), `totalKb` (52.3'ün tavanı). Ölçüm: taban tek başına 168.1 KB, pazarlama rotalarının kendi payı 0 KB. **Bölüm 52.3 rota sınıfına göre iki tavana ayrıldı** — gerekçe orada. |
| 15 | npm sürümü | Ekleme | **npm 11 zorunlu**, CI'da ve Dockerfile'da sabitli. Lock dosyası opsiyonel native paketleri npm 11'in çözdüğü şekilde kaydediyor; `node:22`'nin getirdiği npm 10 aynı dosyayı eksik okuyup `npm ci`'ı düşürüyor. Windows'ta `npm ci` her iki durumda da geçtiği için yalnız Linux'ta görünüyor. |
| 16 | `exactOptionalPropertyTypes` | Sapma | **Kapalı.** Her opsiyonel React prop'una sürtünme ekliyor, karşılığında tek gerçek tehlikeyi kapatıyor — o da merge-patch katmanında. Onun yerine `buildPatch()`: `undefined` anahtarları atıyor, geriye bir şey kalmazsa `null` dönüp çağıranı isteği atlamaya zorluyor. Boş bir merge-patch başarılı oluyor, hiçbir şeyi değiştirmiyor ve kaydetme göstergesini yine "saved"a çeviriyor (Bölüm 37.3) — editörün kullanıcıya yalan söylemesi. |
| 17 | e2e ortamı | Ekleme | Playwright **`next dev`'e** karşı koşuyor, **3100** portunda. MSW üretim build'inde tasarım gereği kapalı, yani backend var olana kadar üretim build'inin hiç API'si yok. Ayrı port, 3000'de asılı kalmış bir sunucunun test edilenle karışmasını engelliyor — bir kez yanlış ölçüme yol açtı. |
| 18 | shadcn primitive tabanı | Ekleme | **Radix açıkça sabitlendi** (`--base radix`). shadcn CLI'ın varsayılanı artık Base UI; Bölüm 5.2 ve 39.1 Radix diyor ve erişilebilirlik gerekçesi ona dayanıyor. |
| 19 | Legal sayfaların yeri (XI-B.3 ve 36.1 `[locale]` dışında gösteriyordu) | Düzeltme | **`[locale]` altında.** Segment dışında çevrilemiyorlar; Türk kullanıcının okuyamadığı bir gizlilik politikası gizlilik politikası değildir. İki bölüm de güncellendi. |
| 20 | `src/app/api/` (XI-B.3 ve Bölüm 36.1 gösteriyordu) | Düzeltme | **Oluşturulmadı ve oluşturulmayacak.** Lokalde aynı-origin görüntüsü `next.config.ts` rewrite'ıyla korunuyor; rewrite bizim kodumuzu çalıştırmadığı için "proxy'de iş mantığı yok" kuralı zaten ihlal edilemiyor. İki bölüm de güncellendi. |

**Bu bölüm nasıl güncellenir.** Bu dosya repo-yerel ve backend'e senkronlanmıyor;
kaynağı burasıdır. `docs/spec/` salt-okunur bir kopya olduğu için orada bir
değişiklik gerekiyorsa `docs/handoff/to-backend.md`'ye `F-nnn` maddesi yazılır.
(Eskiden bu iş `DOC-SYNC-REQUEST.md` ile yapılıyordu; kanal onun yerini aldı.)

---

## Aşama 1 — durum ve devredilenler

Aşama 1'in inşa bilgisi. Ayrıntının çoğu çağrı yerindeki yorumlarda duruyor;
burada yalnız **dosyalar arasına yayılan** ve koda bakarak görülmeyen kısım var.
CLAUDE.md 927 satırdan 347'ye inerken buraya taşındı (handoff · B-033).

### Kasıtlı boşluklar — sorulmadan "düzeltilmez"

| Boşluk | Neden böyle |
|---|---|
| **Metin düzenleme düz metin, mark'ları düşürüyor** | Mark farkında editör kural 4'ün lazy-load edeceği bileşen ve henüz yok. Kabul edilebilir olmasının tek sebebi **söylenmesi**: atomun gerçekten mark'ı varsa kaydetmeden **önce** uyarı çıkıyor (P8). Uyarıyı, onu gereksiz kılan editörü yazmadan kaldırma. |
| **Bayat sözcüklemeyi yeniden üretecek kontrol yok** | Aşama 1 ne uç ne de `stale`'i true yapacak iş yayınlıyor (B-024). Rozet ve açıklaması var, düğme yok — çalışamayacak düğme, zaten bir şeyin bozuk olduğunu söyleyen ekranda hiç yoktan kötü. |
| **Sözcükleme tek başına silinemiyor** | Sunucu birincil sözcüklemeyi silmeyi reddediyor (ölçüldü) ve bir atomda tek sözcükleme zaten birinciler. İkincil olanı kaldıran bir kontrol yazılabilirdi; yazılmadı, çünkü tek başına anlamlı bir jest değil — silmek istenen şey madde. Uç fonksiyonu ve mock'u duruyor. |
| **Profil başında dil eksenleri düzenlenemiyor** | `sourceLanguage` ve `enabledLanguages` **içerik dili** ekseni (Bölüm 38.1), arayüz dili değil — `routing.locales`'i burada kullanmak `lib/i18n/locales.ts`'in açıkça uyardığı hata olurdu. Hangi dillerin sunulabileceği sunucunun `capabilities`'ine bağlı ve Aşama 1 onu yayınlamıyor; sabit liste yazmak "anonim modu hardcoded varsayımdan değil `capabilities`'ten kapıla" kuralını çiğner. Form ikisini **olduğu gibi geçiriyor** (`enabledLanguages` zorunlu). Kontrol `capabilities` ile gelir; kaynak dilin yeri zaten onboarding sihirbazı. |
| **`POST /generations/general`'a kalıcı ekran bağlı değil** | Senkron, Aşama 1'e özgü, hiçbir yere kaydetmiyor (B-022). Aşama 2'de 202 + iş akışıyla değişecek. |

### Dosyalar arasına yayılan değişmezler

- **Sürüm cache'ten gelir, çağırandan değil.** `usePatchAtom`/`usePatchVariant`
  `version` almıyor; istek kurulurken seed'lenmiş kayıttan okuyor. Bileşenden
  geçirilen sürüm bir render'da okunmuştur ve ikinci kaydetmede bayattır, 412
  sonrası ise tanımı gereği bayat. **Bağlı olduğu tek şey: optimistic update
  `version`'a dokunmayacak.** Bir test bunu sabitliyor — sürümü artıran bir
  optimistic yazma, ilk çakışmadan sonraki her kaydetmeyi kimseye karşı
  çakıştırır.
- **Atomlar öğe başına cache'lenir, write-through, asla invalidate edilmez.**
  `GET /profile/atoms/{id}` yok; koleksiyon yanıtı atom başına sürümün tek
  kaynağı. `useAtom`'un `queryFn`'i kasten fırlatıyor — oraya düşmek seed'in
  atlandığı anlamına gelir. Koleksiyonu invalidate et, refetch onları yeniden
  seed'ler; **atom anahtarını asla**.
- **Atom başına iki autosave.** Kontroller `PATCH /atoms/{id}`, sözcükleme
  varyant ucundan; ikisi bağımsız sürümleniyor (B-027). Cümle otururken
  sürüklenen slider onu iptal etmemeli.
- **PATCH `application/json` gider** (B-025). `application/merge-patch+json`
  artık **415**. Bir test media type'ı sabitliyor; prose'a uydurmak için geri
  çevirmek editördeki her kaydetmeyi kırar.
- **`If-Match` tırnaklı olmalı ve onu yalnız `toIfMatch` kurar.** `If-Match: 2`
  → 412, ki bu gerçek çakışmanın da yanıtı: hata, tek başına çalışan
  kullanıcıya "başkası düzenledi" diyaloğu olarak görünür.
- **Boş gövdeli 200 eskiden fırlatıyordu.** `readBody` artık önce metin
  okuyor. e2e yakaladı, hiçbir unit test değil — MSW'nin Node interceptor'ı
  `Content-Length` koyuyor, service worker'ı koymuyor. **Bu maddenin örneği
  yanlıştı:** reorder uçları boş 200 döndürmüyor, koleksiyonu döndürüyor —
  öyle davranan yalnız mock'tu. Koruma yine de duruyor, tehlike 204 ilan
  etmeyen her gövdesiz başarı için gerçek.

### Ölçüm

İlk app rotası ölçüldü: `/[locale]/profile` **238.3 KB toplam, 70.2 KB kendi
payı** — dnd-kit, TanStack Query, next-intl client runtime ve Radix taşıyor.
(Entry katmanı +0.5, madde ekleme +0.5, create formları +2.6, profil başı +0.7,
silme yüzeyi +1.0 KB getirdi; ilk ölçüm 237.8 / 69.7 idi. Güncel: **243.2 / 75.0**.)
Kendi payından ~30 KB kalıyor. Bu sayıyı boş alan değil, bütçenin erken uyarısı say.

### Kapanmadan Aşama 2'ye girilmez

1. ~~**B-032 doğrulaması**~~ — **yapıldı**, aşağıda.
2. ~~**`endpoints/profile.ts` tipleri `components['schemas']`'tan**~~ —
   **yapıldı**, aşağıda. Bir sürüklenme yakaladı.
3. ~~**Anonim çift-gönderim koruması istemcide.**~~ — ilk "ekle" düğmesiyle
   birlikte geldi, aşağıda. Aşama 2'nin `POST /generations`'ı için **yeniden
   bakılmalı**: orada `Idempotency-Key` var ve anonim indeks kusuru
   (`spec/08b-api-contract.md` § D.6.5) hâlâ açık.
4. **Kota UI'ı sıfırlanma saatini söyleyemez** — gün dönümü zaman dilimi
   kararlaşmadı (`STATUS.md` · açık kararlar).

### Gerçek backend'e karşı ilk doğrulama (B-032)

Backend ayağa kalktı; sözcükleme yüzeyi MSW kapalıyken, `next dev` 3100'de,
seed'lenmiş `senior_backend_tr` profiline karşı sürüldü. On üç kontrolün on üçü
geçti — ayrıntı handoff'ta. Burada yalnız **koda bakarak görülmeyen** kısım var.

**`gen:api` yeni bir şey getirmedi.** Üretilen dosya commit'lidekiyle birebir
aynı çıktı, yani B-029/B-030 zaten uygulanmıştı. Yukarıdaki 2. madde bu yüzden
hâlâ açık ama artık **bloke değil**: türetmeyi engelleyen sebep gitti.

**Mock'ların yakalayamadığı hata: promote sözcüklemeyi ekrandan siliyordu.**
`usePatchVariant`'ın iyimser geçişi `content`'i koşulsuz yazıyordu. Sözcükleme
yazarken bu doğru; **promote'ta gövde `content` taşımıyor** ve şemada yokluk
"dokunma" demek — iyimser kopya onu `undefined` yapınca "temizle"ye dönüşüyordu.
Kullanıcının o anda okuduğu cümle, textarea'sı ve mark'ları gösteren önizlemesi
ile birlikte, gidiş-dönüş boyunca boşalıyor ve yanıt inince geri geliyordu.

Neden hiçbir test görmedi: **promote çalışmaya devam ediyordu.** Son durum
doğru, istek doğru, sunucu doğru. Yalnız uçuş anında yanlış. Bunu yakalayan test
handler'ı açık tutuyor — `started` bayrağı bekleniyor, çünkü istek başladıysa
`onMutate` kesinlikle koşmuştur; bu bir zamanlama değil **sıralama** garantisi.
Düzeltme, `content` taşımayan bir gövdede iyimser geçişi tamamen atlıyor;
`primary` bilerek dışarıda kalmaya devam ediyor, çünkü birini yükseltmek
diğerini düşürüyor ve yeniden sıralamayı yalnız başarı yolu bilebilir.

**Bu, f8ca51a'nın açtığı bir kapıydı.** O commit `content`'i göndermeyi
bıraktı — doğru olan buydu, B-028'i kapatıyordu — ama gönderilmeyen alanın
iyimser tarafta hâlâ yazıldığını kimse kontrol etmedi. Bir alanı istekten
çıkarırken, onu önbelleğe yazan yolun da aynı koşula bağlı olup olmadığına bak.

**Sözleşme gözlemi, `to-backend.md` · F-001.** Promote'ta demote edilen satırın
`version`'ı artmıyor. Bizi kırmıyor — yerel demote de sürüme dokunmuyor, yani
tesadüfen hizalıyız — ama Bölüm 35.6'nın "`@Version` → ETag" ifadesiyle
çelişiyor. Backend davranışı değiştirirse yerel demote'un da sürümü artması
gerekir.

**Doğrulama betiği commit edilmedi.** Çalışan bir Spring örneğine ve seed'e
bağlı; CI'da koşamaz, koşarsa da yanlış sebeple kırmızı yanar. Tekrarlanması
gerekirse: MSW kapalı `next dev`, Playwright, `p:not([role="status"])` ile
önizleme paragrafı — birim testi `VariantTabs.test.tsx`'te aynı davranışı
mock'lara karşı sabitliyor.

### Uçlar `operations`'a bağlandı — ve bir sürüklenme çıkardı

`endpoints/profile.ts` artık her şekli ait olduğu operasyona bağlıyor:
`Returns<Op, Media>` başarı gövdesini (204'te `void`), `Accepts<Op>` istek
gövdesini veriyor. Öğe tipleri (`Profile`, `Section`, `Atom` …) şemada kaldı —
API'nin *neden bahsettiğini* adlandırıyorlar ve `domain.ts` onları daraltıyor;
operasyondan geçirmek "hangi uç önce andıysa o" demek olurdu. **Operasyonlar
çağrıları bağlar, şema isimleri bağlar.**

**Yakaladığı şey: üç `reorder` ucu `void` yazılıydı, oysa koleksiyonu
döndürüyorlar.** Gerçek sunucuya ölçüldü — yeniden numaralandırılmış grup
geliyor. Boş `200` döndüren yalnız **mock**'tu, ve istemci ona göre
tiplenmişti. Hiçbir şey kırılmıyordu, çünkü kimsenin okumadığı bir yanıt
kimsenin denetlemediği bir tiple çelişemez. Bağlamanın tüm argümanı bu.

Sürüklenmenin bedeli üç yerdeydi ve üçü de düzeltildi: mock artık grubu
döndürüyor, `client.ts`'in "reorder boş 200 döner" gerekçesi yanlıştı
(koruma duruyor, örneği değişti), ve bu dosyanın kendi maddesi de öyle
diyordu.

**Yanıtı yine de yazamıyoruz.** Kapsamı ölçüldü: on atomluk bir bölümün
içindeki beş atomluk entry, **beş** atomla yanıtlanıyor. Aynı atomlar hem
bölüm hem entry anahtarında cache'li, yani yanıtı geçirmek birini uyumlar
diğerini bayat bırakır. `useReorderAtoms` invalidate etmeye devam ediyor —
artık gerekçesi tahmin değil ölçüm.

**Ders.** Bir alanı ya da yanıtı "kullanmıyoruz" diye `void`/`unknown`
yazmak, sözleşmeyi denetimden çıkarır. Türetilen tipin `never`e çökmediğini
de kanıtla: geçici bir tip-iddiası dosyası ve bir **negatif kontrol** (kasten
yanlış iddia derlemeyi kırmalı) — ikisi de yapıldı, ikisi de commit edilmedi.

### Entry katmanı — editör iki seviyeydi, veri üç

Gerekçelerin çoğu çağrı yerinde: gruplamanın neden **filtreleme olduğu ve
sıralama olmadığı** `SectionList.tsx`'te, UTC tuzağı `lib/i18n/dates.ts`'te,
`role="group"` seçimi ikisinin arasında. Burada yalnız dosyalara yayılan kısım.

**Hata mock'ta görünemezdi.** `displayOrder` entry içinde sayılıyor, yani düz
liste üç işi iç içe geçiriyor (`0,0,0,1,1,1,2,2,3,4`). Fixture'da iki atom ve
sıfır entry vardı, `GET /profile/entries` handler'ı ise hiç yoktu. **Ders
B-032'ninkiyle aynı:** mock yalnız yazıldığı kadarını gösterir, eksik bıraktığı
şekil sessizce yanlış bir UI'a dönüşür. Mock artık atomları `displayOrder`'a
göre sıralıyor — araya girme dev'de de görünsün diye.

Doğrulandı: üç iş 5+3+2 = 10 madde ile doğru gruplandı, tarihler iki dilde de
doğru, gevşek atomlar ek grup açmadan render edildi. H1 → H2 → H3 hiyerarşisi
ayrıca sabitlendi; axe onu *yanlış* olduğunda söylemez.

### Madde ekleme — ve çift-gönderimin gerçek şekli

**Koruma `Idempotency-Key` değil.** O başlık Aşama 2'nin *iş başlatan*
POST'larını kapsıyor (`spec/08b-api-contract.md` § D.6.5), profil create'lerini değil.
Create'lerde `If-Match` de yok — var olmayan bir şeyin sürümü yok. Yani sunucu
iki isteğe iki madde ile cevap veriyor ve ikisine de başarı diyor. **Tek savunma
istemcide: istek uçarken kontrol kilitli.**

**Test ettiğim şey `disabled`, ve bunu negatif kontrolle ayırdım.** `submit()`
içindeki `isPending` guard'ını kaldırdım — testler geçti, yani o guard bugün
hiçbir yoldan erişilmiyor. `disabled`'ı kaldırdım — test düştü. Yorumumdaki
"Enter formu gönderir, devre dışı buton onu durdurmaz" iddiası **yanlıştı**:
`<textarea>` içinde Enter satır atlar, göndermez. Guard yerinde kaldı (alan bir
gün tek satırlık `input` olursa gerekecek) ama artık doğru gerekçeyle.

**Create iyimser değil**, üstündeki her düzenlemenin aksine. Atomun kimliğini
sunucu veriyor ve atom cache'i o id ile anahtarlı; geçici bir id yanıt gelince
yeniden adlandırılmak zorunda kalırdı ve o anahtara bağlanmış bir `AtomEditor`
`useAtom`'un teşhis fırlatmasına düşerdi. Düzenleme bir tuş vuruşu, ekleme
kasıtlı ve seyrek — gidiş-dönüşü karşılayabilir.

**Bölüm türünden atom türüne eşleme istemcide.** `AtomCreate.kind` zorunlu,
sekiz bölüm türüne karşı beş atom türü var, yani biri seçmek zorunda. Düz map
(kural 11), ve bir kural değil **varsayılan** — sözleşme bir skills bölümünün
bullet tutmasını yasaklamıyor.

**RHF + Zod hâlâ inmedi.** Tek zorunlu alanlı bir form için validasyon
kütüphanesi getirmek bütçeye bedava değil; asıl form entry ekleme (başlık + iki
tarih, sıra kontrolü gerektiren) ve onunla gelecekler.

Doğrulandı, gerçek backend'e karşı: madde yazıldığı işin altına düştü, **tek**
istek gitti, grubun sonuna eklendi, ve **Türkçe karakterler sağ çıktı** — bunu
ayrıca sınadım çünkü aynı gövdeyi `curl` ile gönderirken kabuk bozmuştu ve
sunucu 400 `VALIDATION_FAILED` dönmüştü. Hata istemcide değil kabuktaydı;
tarayıcı yolunda böyle bir sorun yok.

### Create yüzeyi — ve bütçenin ilk gerçek çarpması

Üç create bitti: bölüm, entry, madde. Boş profil artık çıkışsız değil —
`GET /profile` 404 dönmediği için yeni hesabın gördüğü ilk ekran boş bölüm
listesiydi ve basılacak hiçbir şey yoktu.

**RHF + Zod indi ve bütçeyi kırdı.** Tahminim ~23 KB'dı; gerçek **75 KB gzip**.
Rotanın kendi payı 70.7 → **145.7 KB** oldu, `bundle-budget.json`'ın 105 KB
tavanının çok üstünde. Çözüm kural 4'ün kendisi: formlar zaten bir düğmenin
arkasında, `next/dynamic` + `ssr: false` ile ayrıldı (`SectionForm`,
`EntryForm`; `AddSection`/`AddEntry` yalnız düğme ve açık/kapalı durumu tutuyor).
**73.3 KB**'a döndü. **Ders: bütçeyi kütüphane eklerken tahmin etme, ölç** —
ve "düğme arkasındaki form" lazy-load için ideal şekil.

**Validasyon dar tutuldu, çünkü çoğunu sunucu zaten yapıyor.** Boş `title` →
400 + `fields: ["title"]`, geçersiz `kind` → 400 + `fields: ["kind"]`, ikisi de
ölçüldü. Sunucunun sahip olduğu bir kuralı istemcide tekrarlamak ikisinin
ayrışma yolu. İstemci **iki** şey için var:
- **Sunucunun hiç bakmadığı şey:** ters tarih aralığı **201** dönüyor
  (`F-002`). Başlık "Oca 2022 – Oca 2019" diye render ediliyor ve makul
  göründüğü için kimse bir daha okumuyor. Bugün tek savunma bu.
- **Round trip'i boşa harcayan şey:** boş başlığı yerinde söylemek.

**Zod mesajları anahtar taşıyor, cümle değil** — `validationKey()` bilinmeyeni
`invalid`'e düşürüyor. Zod kendi İngilizce varsayılanını ("Invalid input") her
adsız hataya iliştiriyor; onu ham basmak Türk kullanıcıya çevrilmemiş bir iç
metin göstermek olurdu. Kural 8'in sunucu hata kodları için dediğinin aynısı.

**`kind` listesi çift yönlü bağlandı.** `Extends<>` iddiası hem yeniden
adlandırmayı hem de **sunucunun eklediği yeni bir türü** derlemede kırıyor —
`ResolutionAction`'ın kasten açık bırakılmasının tersi bir karar, çünkü bu liste
*sunuyor*, *render etmiyor*: bilinmeyen bir değer çökme değil, yazmadığımız bir
özellik. Negatif kontrolle doğrulandı.

**Bölüm iki şekilden birini seçer.** Entry'li bir bölümde gevşek madde eklemek,
gevşek maddeli bir bölümde entry eklemek sunulmuyor; yalnız **boş** bölüme ikisi
de sunuluyor. Karışık bölüm gerçek veride yok ve ekranda hata gibi okunuyor.

**Native `<select>`, Radix listbox değil.** Bölüm 39.1 Radix'i doğal karşılığı
olmayan widget'lar için alıyor; select'in var, klavye ve ekran okuyucuda
yardımsız doğru, telefonda platform seçicisi. Kural 4 gerisini söylüyor.

Doğrulandı, gerçek backend'de: bölüm oluştu ve listede belirdi, boş bölüm iki
şekli de sundu, ters tarih **kullanıcının dilinde** reddedildi ve **sunucuya hiç
gitmedi**, geçerli entry grup olarak render edildi, açık uçlu iş "günümüz" dedi.
Her create için tam **bir** istek.

### Profil başı — inşa sırasının adı konmuş teslimatı

XI-B.9.2'nin 4. adımı "gen:api + **profil formu**" diyordu ve profil başının
formu hiç yoktu: headline bir `<h1>` olarak basılıyordu, iletişim bilgileri ne
görünüyor ne düzenlenebiliyordu.

**`PUT` gönderilmeyeni siler ve bu ölçüldü.** Yalnız `headline` +
`enabledLanguages` gönderen bir gövde `contact`'i `{}` yapıyor. Yani her
kaydetme **bütün başı** taşımak zorunda; düzenlenen alandan kurulan bir gövde
diğer sekizini siler. Bir ayrıntı: `sourceLanguage` omitted olduğunda
**silinmedi**, yani "gönderilmeyen alan temizlenir" tekdüze değil — istemci
davranışı değişmiyor (yine hepsini gönderiyoruz) ama prose'un tam doğru
olmadığını bilmek gerekiyor.

**Bu yüzden baş için tek autosave var, alan başına değil.** Alan başına olsaydı
iki hızlı düzenleme yarışırdı: ikinci istek, birincinin yanıtı cache'e inmeden
kurulur ve **eski headline'ı yenisinin üstüne geri yazardı**. `useAutosave` tek
bir bekleyen değer tutuyor ve aynı anda iki isteği uçurmuyor. Bölüm 37.1 hâlâ
geçerli — Kaydet düğmesi yok; değişen ayrıntı granülerlik.

**Doğrulama sunucunun**, e-posta dâhil (`400` + `fields: ["contact.email"]`,
ölçüldü). Ama `SaveStatus` yalnız "Couldn't save." diyor, **nedenini
söylemiyor** — atomda doğru (hatalar orada çoğunlukla geçici), başta değil:
kullanıcı asla başarılı olmayacak bir isteği tekrar dener. O yüzden başta
`ErrorPanel` de basılıyor; `onRetry`'siz (`SaveStatus` o eylemin sahibi) ve
`conflict` dışarıda (37.4'ün iki düğmesi rakip tavsiye almamalı).

Doğrulandı: tek alan düzenlemesi kaydoluyor ve **diğer sekizi PUT'tan sağ
çıkıyor**, `enabledLanguages` uydurulmadan taşınıyor, bozuk e-postada
sunucunun adlandırdığı alan ekranda. Seed birebir geri yüklendi.

**Kabuk kodlaması üçüncü kez ısırdı** — `curl -d` gövdesinde ve `python -c`
karşılaştırma dizesinde. İkisinde de hata istemcide sanılabilirdi. Elle sonda
yaparken **ASCII kullan**; non-ASCII yolu kendi kodlamasını yöneten bir Node
betiğiyle sına.

### F-001 / F-002 iletildi — backend ikisini de yazmış, henüz deploy değil

Maddeler `sync-handoff.sh pull` ile taşındı. Sonrasında backend reposunda
`EntryService`, `AtomVariantJpaRepository` ve iki entegrasyon testi **commit
edilmemiş** olarak değişmiş — ikisi de bu maddelerin karşılığı. F-002 patch'i
*entry'nin son hâline* göre denetliyor (istediğimiz buydu); F-001
`update versioned` + `isPrimary = true` filtresi kullanıyor — filtre önemli,
onsuz dokunulmayan sözcüklemeler de sürüm artırırdı.

O gün çalışan sunucu bu derlemeyi taşımıyordu (ölçüldü: ters tarih hâlâ `201`,
demote hâlâ artırmıyor), o yüzden istemci **spekülatif değiştirilmedi.**
Sonrası bir alt başlıkta: sunucu yeniden başlatıldı, ikisi de canlı.

**Kanal tuzağı:** `sync-handoff.sh pull` karşı taraftaki handoff dosyalarının
üstüne yazıyor. Bu sefer kayıp olmadı (backend'in kopyası HEAD'de boş
şablondu), ama karşı taraf bir maddeyi `ACK`'a taşıdıktan sonra `pull` çekmek
o düzenlemeyi geri alır.

### B-034 — demote artık sürümleniyor, yerel kopya da öyle

Backend yeniden başlatıldı ve iki düzeltme de canlı. Gerçek uca karşı ölçüldü:

| Ölçüm | Sonuç |
|---|---|
| F-002 · create, ters aralık | `400` + `params.fields: ["endDate"]` |
| F-002 · create, eşit tarih | `201` — tek günlük iş geçerli, `>=` |
| F-002 · patch, iki yönden de ters çevirme | `400`, **saklanan** diğer yarıya göre |
| F-002 · patch, ileri aralık | `200` — kural fazla geniş değil |
| F-001 · promote | demote edilen satır `v=4 → 5`, yalnız o satır |

`usePatchVariant.onSuccess` demote edilen satırın sürümünü artık **+1** yapıyor —
`B-034`'ün istediği bu. Yalnız o satır: promote'a karışmayan sözcüklemeler
sunucuda sürümlenmiyor, hepsini artırmak hâlâ geçerli etag'leri harcar.
`version` telde opsiyonel olduğu için artış koşullu — yoksa `undefined + 1`
`If-Match: "NaN"` olarak giderdi.

**Kanıt, ve neden ilk koşum kanıt değildi.** Tarayıcıda promote edip demote
edilen sözcüklemeyi hemen düzenlemek düzeltme olmadan da geçti: `onSuccess`'in
invalidation'ı koleksiyonu yeniden çekiyor ve sürümleri sunucudan yeniden
seed'liyor, yani eksik artışı **onarıyor**. Pencere localhost'ta refetch'ten
kısa. Ayırt edici koşum için `GET /profile/atoms` Playwright'ta tutuldu:

```
düzeltmesiz   PATCH …/variants/21f6… if-match="14" -> 412
düzeltmeli    PATCH …/variants/21f6… if-match="17" -> 200   (önbellek 16, +1)
```

Birim testi aynı ayrımı gözlemci bırakmayarak yapıyor: koleksiyon
`renderHook` ile çizilmiyor, önbelleğe elle seed'leniyor, o yüzden refetch hiç
olmuyor. Fixture `structuredClone`'lanıyor — handler onu yerinde değiştiriyor,
paylaşılan referans testi kendiliğinden geçirir.

**Pencere her zaman kendini onarmıyor.** Refetch yalnız koleksiyonun **etkin
bir gözlemcisi** varsa oluyor; `AtomEditor` listesiz de çizilebiliyor
(`useProfile.ts` kendi yorumunda söylüyor). O hâlde bayat etag geçici değil,
kalıcı — 412 her denemede gelir.

**Mock'lar da güncellendi**, ikisi de artık sunucudan sapıyordu: entry create
ters aralığı `400` + `endDate` ile reddediyor, promote demote edilen satırı
sürümlüyor. Üçü de negatif kontrolden geçirildi — her biri geri alındığında bir
test kırılıyor. Ters tarihi "sunucu bunu uygulamıyor" diye anlatan üç yorum
(`profileSchemas.ts`, `EntryForm.tsx`, testin kendisi) yeniden yazıldı; istemci
kontrolü **kalıyor**, artık tek savunma değil ama hâlâ daha hızlı olanı ve
mesajı alanın yanına koyan tek olanı.

**Sunucunun `params.fields`'ı hep `endDate` diyor**, `startDate` yamalanırken
bile. Bugün bir şeyi bozmuyor — entry düzenleme formu yok, create formunda iki
alan da ekranda. Tek alanlı bir entry PATCH yüzeyi yazılırsa `params.fields`'ı
odaklanacak input'a çevirmek yanlış alanı işaretler.

**`STATUS.md` düzeltildi:** backend bizim bloğumuza "devredilenler 4/4 kapandı"
yazmıştı. 4. madde kota sıfırlanma saati ve aynı dosyanın açık kararlar
tablosunda hâlâ duruyor; `F-001`'in beklediği karar ayrı bir konuydu. 3/4.

### Silme — ölçüm önce, ekran sonra

Mutation yüzeyinin kalan boşluğuydu. Ekran yazılmadan önce sunucunun **ne
yaptığı** ölçüldü; tamamı bu iş için yaratılıp yıkılan bir ağaç üzerinde, seed'e
dokunulmadan (öncesi ve sonrası: 4 bölüm · 6 entry · 18 atom).

| Ölçüm | Sonuç |
|---|---|
| `DELETE` `If-Match`'siz / yanlış | `428` / `412` — yama ile aynı |
| Bölüm silme | `204` — **entry'leri, onların atomlarını ve bölüme doğrudan asılı atomları da siliyor** |
| Entry silme | `204` — atomları da gidiyor, bölüme **devredilmiyor** |
| Tek sözcüklemeyi silme | `400` + `params.fields: ["variantId"]` |
| İkincisi varken **birincil** sözcüklemeyi silme | `400` — yine reddediyor |

Son iki satır tek kural: **birincil sözcükleme silinemez.** Tek sözcüklemeli bir
atomda o zaten birincildir.

**Cascade onay metninin sayı vermesini zorunlu kılıyor.** "Bu bölümü sil"
diyen bir kontrol, sunucunun duyduğundan çok daha küçük bir işi tarif eder.
Onay iki sayıyı da söylüyor ve sayılar zaten yüklü olan sorgulardan geliyor —
kendi isteği yok, grup zaten o koleksiyonun istemci tarafı filtresi.

**Hiçbiri iyimser değil.** Buradaki her yazma yakalanmış bir kopyadan geri
alınabilir; bu alınamaz — cascade'li bir bölümü geri getirmek sunucunun seçtiği
id'lerle bir ağacı yeniden yaratmak demek ve bunu yapan uç yok. Onay, beklemenin
bedelini ödeyen şey. Geri alma (undo) da bu yüzden seçilmedi.

**Dialog sunucu cevaplayana kadar açık kalıyor.** Radix `Action`'ı tıklamada
kapatıyor; `preventDefault` onu durduruyor (`composeEventHandlers` default
engellenmişse kendi işleyicisini atlıyor). Kapatıp mutation'ı arkadan
çalıştırmak `412`'yi açıklayacak paneli kapanmış bir dialog'un içinde bırakır —
kullanıcı hiçbir şey olmamış bir satıra bakar. Negatif kontrol: `preventDefault`
kaldırılınca iki test kırılıyor.

**`AlertDialog`, `Dialog` değil** — `role="alertdialog"`, dışarı tıklamayla
kapanmıyor, ve odağı yıkıcı eyleme değil **çıkışa** veriyor. Üçü de silme için
gerekli; farkları zaten bu bileşeni seçmenin tek sebebi.

**Sürüm bölüm/entry için koleksiyondan okunuyor** (`versionInList`). İkisinin de
öğe başına önbelleği yok ve gerekmemişti — onlara yapılan her yazma öğeyi elinde
tutan bir formdan geçiyordu. Atomlarda kural değişmedi.

**`profileKeys.all` invalidate edilmiyor**, `queryKeys.ts` "yıkıcı değişiklikten
sonra doğrusu bu" dese de: o önek atom anahtarlarını da kapsıyor ve arkalarında
uç yok — açık bir editörü olan birini invalidate etmek `useAtom`'un teşhis
fırlatmasına refetch demektir. Silinen atomların önbellek kayıtları da
**kaldırılmıyor**: gözlemcisi olan bir anahtarda `removeQueries` yine refetch
tetikler, ve silinen atomun editörü koleksiyon inene kadar hâlâ takılı. Gözlemci
kalmayınca kendiliğinden toplanıyorlar.

**Profil başı da invalidate ediliyor, ölçüm bunu göstermediği hâlde.** Bir bölüm
ve bir atom eklemek `completeness`'i 80'de bıraktı. Ama ölçülen şey *az bir şey
eklemek*'ti; cascade'in kaldırdığı şey koca bir bölüm dolusu içerik ve onu
seed'i yok etmeden ölçmek mümkün değildi. `completeness` sunucuda hesaplanıyor
ve aynı ekranda bir çubuğu besliyor — tek küçük `GET /profile` bahsin ucuz tarafı.

**Bundle:** `AlertDialog` 9.7 KB getirdi, `next/dynamic` ile ayrılınca 8.8'i geri
geldi. Silme yüzeyinin ilk yüklemeye net maliyeti **0.9 KB**. Tetikleyici düğme
bu yüzden `DeleteControl`'de, dialog `DeleteDialog`'da: lazy chunk'ın içindeki
bir tetikleyici basılacak yerde olmazdı.

**Doğrulama.** 10 birim + 1 e2e (modal odak tuzağı ve portal tarayıcıda gerçek),
ve gerçek backend'e karşı MSW kapalı 9 kontrol: onay sunucunun tuttuğu sayıları
söylüyor, vazgeçmek hiçbir istek göndermiyor, silme tırnaklı `If-Match` ile
`204` alıyor, cascade tam olarak o ağacı götürüyor ve ekran reload'suz
güncelleniyor. Seed öncesi/sonrası birebir aynı.
