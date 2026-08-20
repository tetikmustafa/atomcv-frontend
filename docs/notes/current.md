# İnşa Notları — Aktif (frontend)

> Kural: bu dosya **200 satırı geçmez**. Aşama bitince `archive/`'a taşınır.
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
| **Mutation yüzeyi kısmi** | `usePatchAtom` ve `usePatchVariant` var çünkü autosave onları istiyor. Create/delete/reorder'ın endpoint fonksiyonu var, hook'u yok — her biri kendisini kullanan bileşenle birlikte gelir. |
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

İlk app rotası ölçüldü: `/[locale]/profile` **237.8 KB toplam, 69.7 KB kendi
payı** — dnd-kit, TanStack Query, next-intl client runtime ve Radix taşıyor.
Kendi payından ~39 KB kalıyor ve **React Hook Form ile Zod henüz inmedi**; ilk
gerçek formla gelecekler. Bu sayıyı boş alan değil, bütçenin erken uyarısı say.

### Kapanmadan Aşama 2'ye girilmez

1. ~~**B-032 doğrulaması**~~ — **yapıldı**, aşağıda.
2. ~~**`endpoints/profile.ts` tipleri `components['schemas']`'tan**~~ —
   **yapıldı**, aşağıda. Bir sürüklenme yakaladı.
3. **Anonim çift-gönderim koruması istemcide.** Backend'in idempotency indeksi
   NULL `user_id` için tekilleştirmiyor; migration gelene kadar istek uçarken
   kontrolü devre dışı bırakmak bizim işimiz.
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
