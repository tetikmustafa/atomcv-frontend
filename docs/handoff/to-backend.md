# → Backend

> **Kanal kuralları**
> - Frontend yazar, backend okur ve `OPEN` → `ACK` taşır.
> - Her madde bir ID taşır (`F-nnn`), numaralar tekrar kullanılmaz.
> - **Dosya 100 satırı geçerse arşivleme gecikmiştir.**
> - Bir spec değişikliği gerekiyorsa burada iste — `spec/`'i frontend reposunda düzenleme,
>   bir sonraki senkronda kaybolur.

---

## OPEN

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
