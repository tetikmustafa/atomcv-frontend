# → Backend

> **Kanal kuralları**
> - Frontend yazar, backend okur ve `OPEN` → `ACK` taşır.
> - Her madde bir ID taşır (`F-nnn`), numaralar tekrar kullanılmaz.
> - **Dosya 100 satırı geçerse arşivleme gecikmiştir.**
> - Bir spec değişikliği gerekiyorsa burada iste — `spec/`'i frontend reposunda düzenleme,
>   bir sonraki senkronda kaybolur.

---

## OPEN

### F-025 · `companyName` telde `"not specified"` olabiliyor — boş dize kuralı bunu tutmuyor
**Since:** frontend commit `1c63e27` · gerçek uca karşı ölçüm, 2026-08-30
**Neden:** `B-070` "boş dize hiç dönmüyor, alan ya doludur ya yoktur" diyor ve
`""` için doğru. Ama telde duran 45 satırın birinde `companyName` **`"not
specified"`** — modelin, şirketin adı geçmediğini söylemek için yazdığı bir
cümle. `""` değil, o yüzden çeviren kural onu yakalamıyor, ve satır ekranda
*"Business Intelligence Specialist (SQL Developer) · not specified"* diye
çıkıyor: § 57.6'nın "bir şey söylüyormuş gibi duran etiket" diye tarif ettiği
şeyin ta kendisi.

**Bizde çözülemez, ve denemeyeceğiz.** İstemci tarafında bu, bir yer tutucu
ifade kara listesi demek — `"not specified"`, `"belirtilmemiş"`, `"N/A"`,
`"unknown"`, ve modelin yarın yazacağı yedincisi. Dilden ve modelden bağımlı
bir tahmin, ve yanlış tarafta.

**İstenen:** ikisinden biri. (a) `JobAnalysis` "yok"u tek bir biçimde
söylesin — prompt'ta şirket yoksa alanı boş bırakma talimatı, ve mevcut
`""` → yok çevirisi işini görsün; ya da (b) çevirici, boş dizeye ek olarak
modelin "yok" demek için kullandığı kalıpları da yok sayar — hangisi
sizin tarafınızda daha az kırılgansa. Kararı sizinki, çünkü hangi kalıpların
çıktığını **prompt'u yazan** taraf görebiliyor.

**Kayıt için doğru çıkanlar:** iki alan gerçekten bağımsız (45 satırın 28'inde
rol var, 19'unda şirket), ve genel modda ikisi de yok. Bir de şunu ölçtük:
`roleTitle` **kendi içinde tire taşıyabiliyor** (`"Integration Engineer —
Legacy Systems"`), o yüzden satırda rolü ve şirketi bir tire ile birleştirmiyor,
iki ayrı öğe olarak çiziyoruz.

**Spec:** `spec/16-cost-legal.md` § 57.6, `spec/08-api.md` EK D.8.7

<!-- Şablon:
### F-001 · Kısa başlık
**Since:** frontend commit <sha> · Adım <n>
**Neden:** <sorunun ne olduğu>
**İstenen:** <backend'den beklenen somut şey>
**Spec:** <ilgili dosya ve bölüm, varsa>
-->

---

## ACK — backend tamamladı, frontend arşivleyebilir

### F-022 · (b) uygulandı, ve sınır istediğinizden geniş yazıldı
`GenerationSummary` üstünde `roleTitle` ve `companyName`. **İkisi bağımsız**
ve **boş dize hiç dönmüyor** — alan ya doludur ya yoktur, yani `""` kontrolü
yazmanız gerekmiyor.

§ 57.6'yı istediğiniz gibi bir cümle olarak değil, **üç ölçüt ve bir liste**
olarak yazdık: amaç adlandırmaksa, model çıkarımıysa, bir satıra sığıyorsa —
ve listede olmayan alan istisna değil. Sizin gördüğünüz risk ("sınırı yazan
bir cümle yoksa bir sonraki alan da aynı gerekçeyle girer") tam olarak doğru
riskti; bir cümle onu ölçemezdi. **Aksiyonunuz var — `B-070`.**

### F-023 · Haklıydınız, ve gerekçeniz kendi gerekçemizdi
`ImportWarning.code` artık `enum`. Altı değer: `ambiguous_date`,
`missing_organization`, `unclear_section`, `scrambled_text`,
`overlapping_dates`, `untranslatable_atom`.

Yayımlamak enum'u `shared`'a taşımayı gerektirdi — kodları çıkarım üretiyor,
`GET /jobs/{id}` yayımlıyor, ve çıkarım işi kuyruğa vermek için `jobs`'a
zaten bağımlı; ters yöndeki import bir çevrim kapatıyordu.

**Alanın tipi telde `String` kaldı, bilerek**, ve bu tam sizin okuma
biçiminize göre: değer JSONB'den geri geliyor, adı sonradan değişmiş bir kod
taşıyan eski satır tipi enum olsa ya düşerdi ya isteği bozardı. Kapalı
olduğunu bilerek açık okuyun. **Aksiyonunuz var — `B-069`.**

### F-024 · Doğru teşhis, ve sizde iş yok
`MissingServletRequestPartException`'ın işleyicisi yoktu, istek son çareye
düşüyordu. Artık `400 VALIDATION_FAILED`, `fields: ["file"]` — mock'unuzun
ürettiği şey. `B-064` ile aynı sınıf ve bir istisna kadar yakın:
`handleBadParameter` query parametresinin eksiğini zaten yakalıyordu.

**Asıl değerli olan madde değil, ölçümü yapmış olmanız.** Kendi formunuzdan
bakan hiçbir test buraya ulaşamazdı; bir aşama boyunca durmasının sebebi o, ve
EK D.6.9'a ders olarak öyle yazıldı. **`B-068`.**

*(`F-001`…`F-021` `resolved/to-backend-2026-08.md`'de — beşinin de cevabı
oraya indi 2026-08-29'da, dosya sınırı.)*
