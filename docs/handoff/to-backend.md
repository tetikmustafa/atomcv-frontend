# → Backend

> **Kanal kuralları**
> - Frontend yazar, backend okur ve `OPEN` → `ACK` taşır.
> - Her madde bir ID taşır (`F-nnn`), numaralar tekrar kullanılmaz.
> - **Dosya 100 satırı geçerse arşivleme gecikmiştir.**
> - Bir spec değişikliği gerekiyorsa burada iste — `spec/`'i frontend reposunda düzenleme,
>   bir sonraki senkronda kaybolur.

---

## OPEN

> **Dosya 100 satırın üstünde ve arşivlenecek bir şey yok:** `ACK` bölümü
> zaten boş, beş madde de açık. Hepsi Aşama 3'ün kapanışında, kod yazılırken
> çıktı — frontend'in bütün `B-nnn` maddeleri bitti ve sıra bu cevaplarda.
>
> Aciliyet sırası: **`F-018`** § 31.6'nın yarısını bloke ediyor, **`F-020`**
> yayımlanmış bir yeteneği karşılıksız bırakıyor, **`F-019`** iki küçük
> düzeltme, **`F-017`** bir tablo satırı, **`F-021`** üç soru.

### F-021 · Üç küçük soru — hiçbiri bir şeyi bloke etmiyor
**Since:** frontend, Aşama 3 dilim 4-6

Sırasıyla cover letter, bayat varyant ve maddesiz entry dilimlerinde çıktı.
Üçü de bugün çalışan bir şeyi bozmuyor; cevap gelirse bir satır düzeliyor.

1. **`POST …/cover-letter/regenerate`'in `429`'u `Retry-After` göndermiyor.**
   İki kota kapınız hem `resetsAt` hem başlık gönderiyor, bu uç yalnız
   `resetsAt`. Dilim 2b'de `RATE_LIMITED` cümlesini başlıktan kurmaya geçtik,
   o yüzden burada "birazdan tekrar dene" dalına düşüyor — doğru cümle.
   Başlığı eklerseniz süre kendiliğinden yazılmaya başlar.
2. **`PATCH …/variants/{id}` gövdesinde `{"userEdited": true}` hangi kodla
   reddediliyor?** `B-052` reddedildiğini söylüyor, kodunu söylemiyor.
   İstemci hiç göndermiyor; mock'umuz reddi kodluyor (kabul eden bir mock
   istemciye çalıştığını öğretirdi) ve şekli tahmin ettik:
   `400 VALIDATION_FAILED`, `fields: ["userEdited"]`.
3. **`selection_state` telde yok.** `B-061` "neden bu satır çıktı" görünümü
   için `headerOnlyEntries`'e bakmamızı söylüyor, ama `selection_state` hiçbir
   yanıtta yayımlanmıyor. Öyle bir görünüm kurmadık; kuracak olursak
   gerekecek.

### F-020 · `canSaveHistory` var, geçmişi okuyacak uç yok
**Since:** frontend, Aşama 3 dilim 7 · **Spec:** `spec/08-api.md` § 35.7

**Neden:** `capabilities.canSaveHistory` yayımlanmış bir yetenek ve hesapta
`true` — yani ürün kullanıcıya üretimlerinin saklandığını söylüyor. Ama
`GET /api/v1/generations` yok: tekil `GET /generations/{id}` var, liste yok,
sayı yok. Kullanıcı kendi geçmişine hiçbir yoldan bakamıyor, ve biz de
yeteneği doğrulayan bir ekran çizemiyoruz.

**Somut olarak nerede ısırdı:** hesap silme onayı (`B-057`) "neyin gittiğini
saymalı" diyor. Bölüm ve madde sayısını profilden alıyoruz; **üretim sayısını
veremiyoruz** ve tahmin de etmiyoruz — geri alınamayan tek yerde yanlış bir
sayı, hiç sayı olmamasından kötü. Bugün cümle onları saymadan adlandırıyor.

**İstenen:** `GET /api/v1/generations` (sayfalı olabilir), ya da en azından
hesapta bir toplam. İlki `canSaveHistory`'yi anlamlı kılar; ikincisi yalnız
silme ekranını doğrular.

### F-019 · Geri bildirim: `rating` metin geliyor, ve geri okunamıyor
**Since:** frontend, Aşama 3 dilim 7a · **Spec:** `spec/11-operations.md` § 48.4

**İki şey, aynı uç.**

**1. `FeedbackRequest.rating` üretilen tipte `"1" | "-1"` — metin.** Aynı
şemada `format: int32` yazıyor, açıklama "1 for good, -1 for bad" diyor, ve
`FeedbackResponse.rating` `number` olarak dönüyor. openapi-typescript bir
tam sayı enum'unu ancak değerler şemada tırnaklıysa böyle basar. Biz **sayı**
gönderiyoruz ve tipi `Omit` ile daraltıyoruz; bugün bir şey bozulmuyor, ama
daraltma tam olarak "şemayı düzeltmeyi bekleyen kod" ve öyle işaretli.
**İstenen:** `enum` değerleri tırnaksız olsun — `[1, -1]`.

**2. Verilmiş bir yargı geri okunamıyor.** `GET /generations/{id}` geri
bildirimi taşımıyor ve başka bir uç da vermiyor. Maddeniz "geri bildirimini
gönderdin yerine **mevcut seçimi** göstermek doğru davranış" diyor — bunu
yalnız oturum boyunca yapabiliyoruz; sayfa yenilenince ekran hangi başparmağın
basıldığını bilmiyor ve boş başlıyor. Aynı şey `contentGrant` için de geçerli,
ve orası daha önemli: **`accessedAt` gösterilmeli** diyorsunuz, ama izni
verdikten bir gün sonra dönen kullanıcı ona bakamıyor.
**İstenen:** `GET /generations/{id}` gövdesinde `feedback` (rating, category,
`contentGrant`) — yorum hariç, o zaten geri yollanmıyor.

### F-018 · İçe aktarma işinin sonucu yalnız akışta var, ve uyarılar sayılabiliyor ama gösterilemiyor
**Since:** frontend, Aşama 3 dilim 3a · **Spec:** `spec/07-subsystems.md` § 31.6, `spec/08-api.md`

**İki ayrı şey, ikisi de aynı yerden çıkıyor: `JobStatusResponse`.**

**1. Terminal olayın alanları şemada yok.** `B-051` içe aktarma işinin
`profileId`, `sectionCount`, `atomCount`, `warningCount` ve `detectedLanguage`
taşıdığını söylüyor; `JobStatusResponse` ise yalnız `generationId` ve
`pageCount` yayımlıyor. Yani **`GET /jobs/{id}` bir içe aktarma işinin sonucunu
hiç söyleyemiyor** — sayfa yenilenirse sonuç yok. Bu `pageCount`'ın `B-041`
öncesi hâlinin aynısı ve çözümü de aynı olabilir: alanları status yanıtına da
koymak, ya da `JobStatusResponse`'a iş tipine göre dolan bir `result` nesnesi
eklemek. **Bugün SSE yükünü tipsiz taşıyoruz** ve `contracts.ts`'te elle bir
tip duruyor — `gen:api` onu kaldıramıyor, çünkü karşılığı yayımlanmamış.

**2. Ve asıl engelleyen bu: § 31.6'nın iki tasarım kuralı uygulanamıyor.**
Bölüm "sorunlu olanlar otomatik açık" ve "kritik uyarılar çözülmeden Onayla
aktif olmaz" diyor. İkisi de **hangi** bölümün sorunlu olduğunu bilmeyi
gerektiriyor; telde yalnız bir **sayı** var. § 31.4.1 zaten "bu yapı hiçbir
zaman frontend'e çıkmıyor" diyor — yani `warnings[]` bilinçli olarak
gizleniyor, ama o zaman § 31.6'nın iki kuralı yazıldıkları hâliyle
uygulanamaz.

**İstenen:** ya uyarıların **yeri** yayımlansın (en az `path` ya da bir
`sectionId`, ve kritik olup olmadığı), ya da § 31.6 bu iki kuralı
sayı-tabanlı bir nota indirsin. İkincisi de kabul edilebilir bir cevap —
bugün yaptığımız şey o: bölümler kapalı, "şu kadar konuda emin olamadık"
notu, ve Onayla hep aktif.

**Bir de küçük bir soru:** içe aktarma işi `phase`/`label` gönderiyor mu?
Gönderiyorsa anahtarlar ne? Kataloğumuzda `generation.phase.*` var; içe
aktarma için bir şey uydurmadık, mock yalnız `pct` gönderiyor ve ekran kendi
cümlesini yazıyor. Anahtar gönderiyorsanız çeviriyi yazalım.

### F-017 · `COVER_LETTER_REJECTED` hata kataloğu tablosunda yok
**Since:** frontend, Aşama 3 dilim 0 · **Spec:** `spec/08b-api-contract.md` § EK D.6

**Neden:** Kod telde var (`ApiError.code` enum'ında, `gen:api` getirdi) ve
§ 34.4.1 onu `422` + `params.issues` + `retry` diye tarif ediyor. Ama EK D.6'nın
**kod → HTTP → params** tablosunda satırı yok — tablodaki tek eksik kod bu.

Bizim için önemli olmasının sebebi tablonun bizde ne olduğu: kataloğumuzun
tüketicilik testi `params`'ı **o tablodan** okuyup her koda karşı formatlıyor.
Tablosuz bir kod, mesajı yanlış argümanla yazılsa da testten geçer — `B-043`'ün
delik bulduğu yerin aynısı.

**İstenen:** Tabloya bir satır: `| COVER_LETTER_REJECTED | 422 | issues: string[] |`.
Şekil değişikliği değil, tablo eksiği; `gen:api` gerekmiyor.

**Bir de soru — `issues` sözlüğü kapalı mı?** § 34.4.1 altı değer sayıyor
(`unsupported_claim`, `number_invented`, `experience_overstated`,
`wrong_company`, `length_out_of_range`, `cliche`). Kapalıysa altısını da ICU'da
adlandırıp kullanıcıya okunur bir cümle olarak vereceğiz; açıksa mesaj
sebepleri hiç saymayacak, çünkü ham `unsupported_claim` ekrana çıkamaz. Bugün
mesajımız sebep saymıyor ve cevabınızı bekliyor — dilim 4'te (cover letter
ekranı) bağlayacağız.

<!-- Şablon:
### F-001 · Kısa başlık
**Since:** frontend commit <sha> · Adım <n>
**Neden:** <sorunun ne olduğu>
**İstenen:** <backend'den beklenen somut şey>
**Spec:** <ilgili dosya ve bölüm, varsa>
-->

---

## ACK — backend tamamladı, frontend arşivleyebilir

*(`F-001`…`F-016` `resolved/to-backend-2026-08.md`'de)*
