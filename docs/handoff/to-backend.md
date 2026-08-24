# → Backend

> **Kanal kuralları**
> - Frontend yazar, backend okur ve `OPEN` → `ACK` taşır.
> - Her madde bir ID taşır (`F-nnn`), numaralar tekrar kullanılmaz.
> - **Dosya 100 satırı geçerse arşivleme gecikmiştir.**
> - Bir spec değişikliği gerekiyorsa burada iste — `spec/`'i frontend reposunda düzenleme,
>   bir sonraki senkronda kaybolur.

---

## OPEN

### F-008 · Uygunluk raporu telde yok — sıra 8 buna bağlı
**Since:** frontend `49eb0e1` · Aşama 2 · **Spec:** `spec/06-pipeline-d-g.md` § 23.3, `spec/07-subsystems.md` § 30.6

**Neden:** `completed` iki alan taşıyor — `{"generationId":"…","pageCount":1}`.
§ 30.6'nın örneğindeki `matchLevel` **gelmiyor**, `FitReport` (§ 23.3) hiçbir
uçta yok, ve `GET /generations/{id}` kaynak haritasında var ama şemada yok.

**İstenen:** Raporun hangi uçtan geleceği. XI-B.9.2 sıra 8 "SSE ilerleme +
**uygunluk raporu**" diyor; ilerleme bağlandı, rapor inşa edilemiyor. Sonuç
ekranı sayfa sayısı + indirmeyle sınırlı kaldı — uydurulmuş bir yüzde § 23.3'ün
adıyla yasakladığı şey. **`pageCount` de yalnız akışta**: geri düşüşle uzlaşan
bir iş sonuca sahip ama sayfa sayısına değil.

---

### F-009 · İstek gövdesi düz; § 35.3 iç içe gösteriyor, `generalMode` belgesiz
**Since:** frontend `49eb0e1` · Aşama 2 · **Spec:** `spec/08-api.md` § 35.3

**Neden:** Şema `{jobDescription?, acknowledgePreflight, maxPages?, language?,
generalMode?}`; § 35.3 hâlâ `directives`/`options` gösteriyor. Şema kazanıyor,
ama bir sonraki okuyan aynı çelişkiye düşer.

**İstenen:** (1) § 35.3 örneğinin düzeltilmesi. (2) **`generalMode` ne işe
yarıyor?** `jobDescription` yokluğu zaten genel mod ve boş gövdeyle 202 aldık;
ikinci bir bayrak iki ayrı "genel" tanımı doğuruyor. Gerekmiyorsa şemadan düşsün.

---

### F-010 · Bağlanıştaki anlık durum boş dize taşıyor, alan düşürmüyor
**Since:** frontend `49eb0e1` · Aşama 2 · **Spec:** `spec/07-subsystems.md` § 30.6

**Neden:** İlk `phase` olayı `{"phase":"","label":"","pct":0,"detail":""}`.
`label` bir çeviri anahtarı; boş dize anahtar değil ama yokluktan da ayırt
edilmiyor, yani istemci onu özel durum yapmazsa `generation.phase.` diye bir
anahtarı çevirmeye kalkar ve ürünün en çok görülen satırına ham anahtar basar.

**İstenen:** Kuyruktaki işin anlık durumunda `phase`, `label`, `detail`
**düşürülsün**. İstemci şimdilik boşu da yokluğu da aynı sayıyor.

---

### F-011 · Dev proxy SSE'yi gzip'liyordu — bizde çözüldü, § 30.6'ya bir satır lazım
**Since:** frontend `<bu commit>` · Aşama 2 · **Spec:** `spec/07-subsystems.md` § 30.6

**Neden:** Lokalde frontend Spring'e `next.config.ts` rewrite'ıyla gidiyor.
Next'in dev sunucusu proxy'lediği yanıtı **gzip'liyor** ve gzip tamponluyor:

```
doğrudan :8080      phase@1ms   phase@256ms phase@272ms completed@905ms
rewrite üzerinden   phase@867ms phase@867ms phase@867ms completed@867ms
```

Lokalde ilerleme çubuğu hiç hareket etmiyor; istemci bozuk sanılır. Düzeltme
bizde (`compress: false`, yalnız geliştirmede — üretimde rewrite zaten yok).
Doğrulandı: 0/319/334/814 ms.

**İstenen:** § 30.6 nginx için `proxy_buffering off` diyor; yanına "Next'in dev
rewrite'ı da tamponlar" satırı. Aynı tuzağın ikinci yüzü, tam burada aranır.

---

### F-012 · `used`, `limit`'i geçiyor — reddedilen istek de sayılıyor
**Since:** frontend `<bu commit>` · Adım 2.7 · **Spec:** `spec/10-security.md` § 44

**Neden:** `GET /account/usage` `{"metric":"generation","used":26,"limit":20}`
döndürdü; 429 alan istekler de sayacı artırıyor. Ekranda "24 of 20" bozuk bir
ekran gibi okunuyor. Sayıyı kırpmak sunucuyu yanlış aktarmak olurdu, o yüzden
sınır aşılınca cümle değişiyor — ama bu bizde bir yara bandı.

**İstenen:** Karar. `used` **tüketimi** mi ölçüyor (reddedilen artırmamalı),
yoksa **denemeyi** mi (o zaman `used`/`limit` çifti "şu kadarını kullandın"
diye okunamaz)? Denemeleri saymak makul; ikisini aynı alanda toplamak değil.

<!-- Şablon:
### F-001 · Kısa başlık
**Since:** frontend commit <sha> · Adım <n>
**Neden:** <sorunun ne olduğu>
**İstenen:** <backend'den beklenen somut şey>
**Spec:** <ilgili dosya ve bölüm, varsa>
-->

---

## ACK — backend tamamladı, frontend arşivleyebilir

*(boş — `F-001`…`F-007` `resolved/to-backend-2026-08.md`'de)*
