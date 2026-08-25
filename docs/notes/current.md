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

**Henüz başlanmadı.** Aşama 2 tam olarak kapandı: uygunluk raporu dahil,
`B-040` ve `B-041` ile.

### `B-043` — bir kodun arkasındaki sekiz sebep

`F-016`'nın dönüşü. Sekiz sebep tek `errors.*` anahtarında, **ICU `select`**
ile — `Fit.level` ve `Usage.metric` ile aynı kalıp, resolver'a dokunmadan.

**Ölçülen ve koda yazılan şey:** next-intl'de eksik bir `select` argümanı
mesajı **kendi anahtar yoluna** çeviriyor (`errors.UNPARSEABLE_JOB_DESCRIPTION`
ekranda), bilinmeyen bir *değer* ise `other` dalına düşüyor. İkisi hiç
benzemiyor ve ilki sessiz: içinde süslü parantez olmadığı için katalog
testinin brace kontrolü onu **kaçırıyordu**.

- `useErrorMessage` artık `SELECT_DEFAULTS` ile `reason`'ı garanti ediyor.
  Gerçek params üstüne yazıyor, hiç ezmiyor.
- Katalog testi `rendered !== code` **ve** `errors.` içermemeyi de sınıyor.
  Negatif kontrolü yapıldı: `reason`'ı params'tan çıkarınca iki katalog da
  düşüyor, brace kontrolü ise geçiyor — delik tam oradaydı.
- Ön kontrol / kapı ayrımı kopyaya işlendi: ön kontrol **kullanıcının
  metnini** reddetti (yol göster), kapı **modelin cevabını** (metni suçlama).

**Mock artık kapıyı da taşıyor.** Önceden yalnız ön kontrol vardı ve o
senkron; kapı reddi **akıştan** geliyor ve **iki** resolution getiriyor.
`gateRefusal()` bunu üretiyor, `failNextJob(error?)` yerleştiriyor. Hata
**işin üstünde** taşınıyor, fixture'da değil: iş oluşturulurken alınıyor,
akış anında okunuyor, arada gelen ikinci bir iş bunun hatasını miras almasın.

**Testte ölçülen bir tuzak:** `user.type` karakter başına olay gönderiyor;
birkaç yüz karakterlik gerçek bir ilan 5 sn sınırını aşıyor, **ve yarıda
ölen test yarım yazılmış metni `too_short` yaptırıp geç bir POST'u bir
sonraki testin `bodies`'ine düşürüyor**. Üç yeni test kırılırken iki eski
test de onunla kırıldı. `user.paste`'e geçildi — ekranın kendi metni de
zaten "yapıştır" diyor.

**`gen:api` çalıştı: fark yok.** Tahmin doğruydu ama artık ölçüldü.

**Gerçek uca karşı üç red görüldü** — `too_short` (422, üç resolution),
`too_few_skills` ve `no_responsibilities` (ikisi de akıştan, iki resolution,
`continue_anyway` yok). Sonuncusu `F-016`'nın şikâyetinin kendisi: **güven 1,
18 beceri, yine de red.** Yükler `tests/unit/i18n/wireErrors.test.ts`'e
alındı — katalog testi *bildirilen* params'a karşı, o dosya *gerçekten gelen*
yüke karşı; `B-043` ikisinin ayrıştığı yerdi.

**`suspicious_output` telde görülemedi.** `gpt-4.1-nano` uzun beceri adlarını
normalleştiriyor, üç ilan denendi. O sebebin `retry` satırı mock'ta ve testte
var ama **backend'in tarifine dayanıyor, ölçüme değil.** Tetiklenebilirse
doğrulanmalı.

### Aşama 2'ye sonradan eklenen: `B-042` — CV dilinin notu

Gerçek uca karşı test ederken çıktı, ve çıkış yolu kaydedilmeye değer:
**önce ekranda bir tuhaflık görüldü** (Türkçe maddelerin üstünde İngilizce ay
adları), sebebi backend'de bulundu (`F-013`), backend üçüncü bir çözüm seçti
ve alanları yayımladı, biz de cümleyi yazdık. Üç repo-turu, tek oturum.

Kural artık şu: **bir belge tek dilde yazılır**, ve `auto` ilanın diline
yalnız profil o dilde gerçekten yazılabiliyorsa çözülür. Yazılamıyorsa CV
profilin dilinde kalır ve `contentLanguage` ile `postingLanguage` ayrışır —
notun çizildiği tek durum bu.

- **Karşılaştırma birincil alt etiket üzerinden.** `en` ile `en-GB` bir
  dildir; ham `!==` kullanıcıya CV'sinin yanlış dilde çıktığını söylerdi.
- **`languageNames.ts` kuralın tek sahibi.** İkinci çağrı yeri olunca
  çıkarıldı; `VariantTabs` da oradan okuyor. Bir `Intl` kuralının ikinci
  kopyası ikisinin ayrışma yoludur.
- **Türkçe metin çekim eki almıyor** — "Türkçe yazıldı", "İngilizce değil".
  Dil adı yerine geçen bir kalıpta ek, ilk başka dilde kırılır.
- **Not, uyarı değil.** İnce profilin notuyla aynı gerekçe: bozulan bir şey
  yok, tekrar denenecek bir şey yok.

Bu geçici ve geçiciliği kasıtlı: § 21.8'in çeviren fazı indiğinde alanlar aynı
değeri taşımaya başlar ve not kendiliğinden çizilmez olur. Bayrak arkasına
konmadı — silinecek şey, kapatılacak şey değil.

---

## Kasıtlı boşluklar — sorulmadan "düzeltilmez"

| Boşluk | Neden böyle |
|---|---|
| **Sonuç ekranında PDF önizlemesi yok** | Ölçülmüş bir karar: react-pdf ~300 KB ve gösterebileceği tek yeni şey PDF'in kendisi. *(Aynı satır bir zamanlar uygunluk raporunu da sayıyordu; rapor `B-041` ile indi ve 2026-08-25'te gerçek uca karşı doğrulandı. Kasıtlı boşluk listesi bayatlayabiliyor — denetlenmesi gerekiyor.)* |
| **"Bir sayfadan kısa CV" notu yazılmadı** | `pageCount` tam sayı ve sunucu "sayfa dolmadı" diye bir sinyal göndermiyor. Sinyalsiz yazılırsa her CV'de çıkar. |
| **`keep_top_pinned` düğmesi çizilmiyor** | Şema sabitlenmiş atomları isteğe koyacak bir alan yayımlamıyor; çizilse basılınca hiçbir şey yapmazdı. |
| **Metin düzenleme düz metin, mark'ları düşürüyor** | Mark farkında editör kural 4'ün lazy-load edeceği bileşen ve henüz yok. Kabul edilebilir olmasının tek sebebi **söylenmesi**: atomun gerçekten mark'ı varsa kaydetmeden **önce** uyarı çıkıyor (P8). |
| **Bayat sözcüklemeyi yeniden üretecek kontrol yok** | Ne uç ne de `stale`'i true yapacak iş yayımlandı (B-024). Çalışamayacak düğme, zaten bir şeyin bozuk olduğunu söyleyen ekranda hiç yoktan kötü. |
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
- **Bundle:** `/[locale]/profile` **250.6 / 82.3 KB**, `/[locale]/generate`
  **214.8 / 46.4 KB** (tavan `bundle-budget.json`: 280 / 105).
