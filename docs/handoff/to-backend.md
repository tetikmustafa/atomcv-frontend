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
**Since:** frontend commit `<bu commit>` · Aşama 2
**Spec:** `spec/06-pipeline-d-g.md` § 23.3, `spec/07-subsystems.md` § 30.6

**Neden:** Gerçek uçta ölçtük; `completed` olayı iki alan taşıyor:
`data:{"generationId":"1d812494-…","pageCount":1}`. § 30.6'nın örneği üçüncü
bir alan gösteriyor (`"matchLevel":"STRONG"`) ve **gelmiyor**. `FitReport`'un
kendisi (§ 23.3 — `requiredCovered/Total`, `coveredSkills`, `missingRequired`)
hiçbir uçta yok; `GET /generations/{id}` kaynak haritasında (§ 35.2) var ama
şemada yok.

**İstenen:** Raporun hangi uçtan geleceği. XI-B.9.2'nin 8. satırı "SSE ilerleme
+ **uygunluk raporu**" diyor; ilerleme bağlanabiliyor, rapor bugün inşa
edilemiyor. Sonuç ekranı bu yüzden Aşama 2'de sayfa sayısı notu ve indirmeyle
sınırlı — kasıtlı ve `notes/current.md`'de kayıtlı, uydurulmuş bir yüzde değil.

---

### F-009 · `POST /generations` gövdesi düz; § 35.3 iç içe gösteriyor, `generalMode` belgesiz
**Since:** frontend commit `<bu commit>` · Aşama 2 · **Spec:** `spec/08-api.md` § 35.3

**Neden:** Şema `{jobDescription?, acknowledgePreflight, maxPages?, language?,
generalMode?}` yayımlıyor; § 35.3'ün örneği hâlâ `{"jobDescription": "…",
"directives": {…}, "options": {…}}`. Şema kazanıyor (CLAUDE.md) ve istemci düz
gövde gönderiyor — ama bir sonraki okuyan aynı çelişkiye düşer.

**İstenen:** İkisi.
1. § 35.3 örneğinin düz gövdeye çekilmesi.
2. **`generalMode` ne işe yarıyor?** `jobDescription` yokluğu zaten genel mod
   (§ 35.3, `B-038`) — boş gövdeyle `{}` **202** aldık. İkinci bir bayrak iki
   ayrı "genel" tanımı doğuruyor: hangisi otorite, ve `jobDescription` doluyken
   `generalMode: true` ne demek? Gerekmiyorsa şemadan düşsün.

---

### F-010 · Bağlanıştaki anlık durum boş dize taşıyor, alan düşürmüyor
**Since:** frontend commit `<bu commit>` · Aşama 2 · **Spec:** `spec/07-subsystems.md` § 30.6

**Neden:** Abone olur olmaz gelen ilk `phase` olayı:
`data:{"phase":"","label":"","pct":0,"detail":""}`.

`label` bir çeviri anahtarı (`B-038`). Boş dize anahtar değil, ama alanın
**yokluğundan da ayırt edilmiyor** — istemci onu özel durum yapmak zorunda,
yoksa `generation.phase.` diye bir anahtarı çevirmeye kalkar ve ürünün en çok
görülen satırına ham anahtar basar. `detail: ""` aynı: § 30.6'nın örneğinde
`detail` yalnız değeri olduğunda var.

**İstenen:** Kuyrukta bekleyen bir işin anlık durumunda `phase`, `label` ve
`detail` **düşürülsün**, boş dize gönderilmesin. İstemci şimdilik boşu da
yokluğu da aynı sayıyor, yani düzeltme geldiğinde bir şey kırılmaz.

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
