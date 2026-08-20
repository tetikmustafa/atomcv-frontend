# → Backend

> **Kanal kuralları**
> - Frontend yazar, backend okur ve `OPEN` → `ACK` taşır.
> - Her madde bir ID taşır (`F-nnn`), numaralar tekrar kullanılmaz.
> - **Dosya 100 satırı geçerse arşivleme gecikmiştir.**
> - Bir spec değişikliği gerekiyorsa burada iste — `spec/`'i frontend reposunda düzenleme,
>   bir sonraki senkronda kaybolur.

---

## OPEN

### F-002 · `POST /profile/entries` ters tarih aralığını kabul ediyor
**Since:** frontend commit `d5f33e3` · Adım 1 · create yüzeyi yazılırken
**Neden:** `endDate` `startDate`'ten önce olan bir entry **201** dönüyor. Ölçüldü:

```
{"sectionId":"…","title":"Backwards","startDate":"2022-01-01","endDate":"2019-01-01"}
→ 201, kaydedildi
```

Aynı uç boş `title`'ı **400** + `params.fields: ["title"]` ile, `POST /profile/sections`
geçersiz `kind`'ı yine 400 ile reddediyor — yani validasyon var, bu kural eksik.

Sonucu görünür: entry başlığı "Oca 2022 – Oca 2019" diye render ediliyor ve bu değer
CV üretimine de girer. Kullanıcı bunu bir daha okumaz, çünkü makul görünür.

**İstenen:** İkisi de doluysa `endDate >= startDate` şartı; ihlalde `400 VALIDATION_FAILED`,
`params.fields: ["endDate"]`. `PATCH /profile/entries/{id}` için de aynısı — orada
tek alan güncellendiğinde diğerinin mevcut değeriyle karşılaştırılmalı.

**Frontend:** İstemci şimdilik kendisi engelliyor (`lib/forms/profileSchemas.ts`, testli).
Ama bu bir veri garantisi değil — başka bir istemci, doğrudan API çağrısı ya da
ingestion hattı hâlâ ters aralık yazabilir. Siz kapattığınızda istemci kontrolü
**kalacak** (round trip'ten önce söylemek daha iyi), yalnız tek savunma olmaktan çıkacak.
**Spec:** `spec/08-api.md` § 35 · entry uçları

### F-001 · Promote'ta demote edilen varyantın `version`'ı artmıyor
**Since:** frontend commit `272edaa` · B-032 doğrulaması sırasında · Adım 1
**Neden:** `PATCH /profile/atoms/{id}/variants/{vid}` ile bir varyant birincil yapıldığında
yazılan satırın sürümü artıyor, **demote edilen satırınki artmıyor** — `primary` `true`'dan
`false`'a döndüğü hâlde. Gerçek uçta ölçüldü:

```
başlangıç   tr primary=true  v=0   |  en primary=false v=2
{"primary":true} → en          tr primary=false v=0   |  en primary=true  v=3
```

Bölüm 35.6 "JPA `@Version` → ETag" diyor ve `atom_variants`'ı ETag taşıyan altı tablodan biri
olarak sayıyor. Bu hâliyle `version`, satırın değiştiğini bildiren bir işaret olmaktan çıkıyor:
`tr`'yi v=0'da okumuş bir istemci `If-Match: "0"` ile yazabiliyor, oysa satır o okumadan sonra
değişti. İyimser kilidin verdiği garanti tam olarak budur.

**İstenen:** Ya demote da bir sürüm artışı saysın, ya da Bölüm 35.6'ya "birincil değişimi karşı
satırda sürüm artırmaz" istisnası yazılsın. Hangisi doğruysa — karar sizin, ama ikisinden biri
olmalı; şu an şema ile davranış ayrı şeyler söylüyor.

**Frontend'i bugün kırmıyor.** `usePatchVariant` demote'u önbelleğe kendisi uyguluyor ve
`version`'a dokunmuyor, yani tesadüfen sunucuyla aynı hizada; arkasından gelen invalidation da
sürümleri yeniden seed'liyor. Yani bu bir hata raporu değil, **sözleşme ile davranışın
ayrıştığı** bir bildirim. Davranışı değiştirirseniz haber verin, yerel demote'un sürümü de
artması gerekir.
**Spec:** `spec/08-api.md` § 35.6

<!-- Şablon:
### F-001 · Kısa başlık
**Since:** frontend commit <sha> · Adım <n>
**Neden:** <sorunun ne olduğu>
**İstenen:** <backend'den beklenen somut şey>
**Spec:** <ilgili dosya ve bölüm, varsa>
-->

---

## ACK — backend tamamladı, frontend arşivleyebilir

*(boş)*
