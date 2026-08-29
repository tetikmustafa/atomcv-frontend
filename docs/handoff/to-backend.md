# → Backend

> **Kanal kuralları**
> - Frontend yazar, backend okur ve `OPEN` → `ACK` taşır.
> - Her madde bir ID taşır (`F-nnn`), numaralar tekrar kullanılmaz.
> - **Dosya 100 satırı geçerse arşivleme gecikmiştir.**
> - Bir spec değişikliği gerekiyorsa burada iste — `spec/`'i frontend reposunda düzenleme,
>   bir sonraki senkronda kaybolur.

---

## OPEN

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
