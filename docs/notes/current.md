# İnşa Notları — Aktif (frontend)

> Kural: bu dosya **400 satırı geçmez**. Aşama bitince `archive/`'a taşınır.
> Bu dosya **backend'e senkronize edilmez** — repo-yerel.
>
> Aşama 2'nin tam kaydı `archive/stage-2.md`'de. Aşağıdakiler oradan
> **taşınanlar**: hâlâ geçerli olan kurallar ve kasıtlı boşluklar. Bir şeyin
> *neden* öyle olduğunu arıyorsan önce burası, sonra `rg` ile arşiv.

---

## Aşama 2 — kalan işler (`B-040`, `B-041`)

Aşama 2 bir teslimatı eksik kapanmıştı: uygunluk raporunun telde karşılığı
yoktu (`F-008`). Backend beş `F-nnn`'i de yanıtladı ve **veriyi yayımladı**,
yani eksik parça artık yazılabilir. Aşama 3'e o bitince geçilir; bu bölüm
kapanışta `archive/stage-2.md`'ye eklenir.

### F2.8 — `gen:api` ve `B-040`'ın üç düzeltmesi

- **`generalMode` şemadan düştü.** Hiç yazılmamış; bir record'un
  `isGeneralMode()` getter'ı springdoc'a sızmış. İstemci onu hiç göndermiyordu,
  yani kod değişmedi — `F-009` sorusunu sormak yeterliydi.
- **İlerleme alanları boşken gönderilmiyor artık.** Ölçüldü: anlık durum
  `{"pct":0}`, başka hiçbir şey yok. `F-010` kaynağında kapandı; `toProgress`
  içindeki savunma **duruyor** ama artık son savunma hattı, tek savunma değil.
  Mock'un `SCHEDULE`'ı da alanları düşürüyor — sunucu ne gönderiyorsa o.
- **Kota iki sayıya ayrıldı.** `used` harcanan (asla `limit`'ten büyük değil),
  `attempted` birim alan her istek. Sayı yanlış değildi, **adı** yanlıştı.
  `UsageNote`'taki yara bandı kalktı: karşılaştırma bizim değil, `remaining`
  sunucunun. "Hakkın kalmadı" cümlesi kaldı — "20 of 20" doğru ama okuyucunun
  bilmek istediği şey değil.

**Bir ölçüm mock'u düzeltti:** kotanın reddettiği istek (429) birim alıyor,
**ön kontrolün reddettiği (422) almıyor**. Mock ikisini de saymıyordu; artışı
kota kapısına taşıdım, isteğin kendisine değil. Sonda olmadan "reddedilenler
dahil" cümlesi iki farklı şekilde uygulanabilirdi.

### Aşama 3'te yeniden bakılacaklar

- **`capabilities` hâlâ yayımlanmadı.** `/auth/session` Aşama 3; `contracts.ts`
  onu hâlâ tarif ediyor ve tarif etmeye devam etmeli. Yayımlandığı gün üç yer
  açılır: profil başındaki dil eksenleri, anonim/kimlikli ayrımı, şablon
  seçimi.
- **`sign_up` bir düğme olarak çizilmiyor** (`canResolve`), çünkü gideceği
  rota yok. Auth indiği gün `GenerateScreen`'in `HANDLED` listesine eklenir —
  ve o gün `ANONYMOUS_SESSION_EXPIRED` gerçekten görünür hâle gelir.
- **`Retry-After` okunmuyor** (`B-039` ACK'i). Otomatik yeniden deneme geldiği
  gün doğru olan tek değer o; `RequestOptions`'a eklenecek yer hazır.
- **`used` `limit`'i geçebiliyor** (`F-012`). `UsageNote` sınır aşılınca
  cümleyi değiştiriyor; backend karar verince yara bandı kalkar.
- **`profile_extract` sayacı çizilmiyor.** Çıkarım Aşama 3; uç zaten iki
  metriği de döndürüyor, ekran birini seçiyor.

---

## Kasıtlı boşluklar — sorulmadan "düzeltilmez"

| Boşluk | Neden böyle |
|---|---|
| **Sonuç ekranında ne önizleme ne uygunluk raporu var** | İkisi de veri istiyor, veri yok (`F-008`). Önizleme ayrıca ölçülmüş bir karar: react-pdf ~300 KB ve gösterebileceği tek yeni şey PDF'in kendisi. |
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
