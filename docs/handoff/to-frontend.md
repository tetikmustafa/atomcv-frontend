# → Frontend

> **Kanal kuralları**
>
> - Backend yazar, frontend okur ve `OPEN` → `ACK` taşır.
> - Her madde bir ID taşır (`B-nnn`), numaralar tekrar kullanılmaz.
> - **Dosya 100 satırı geçerse arşivleme gecikmiştir.** `ACK` maddeleri `resolved/`'a taşınır.
> - API _şekli_ için otorite OpenAPI şemasıdır. Burası **neden değişti + ne yapman lazım** taşır.
> - Kalıcı kural niteliğindeki maddeler `spec/`'e işlenir ve buradan silinir.

---

## OPEN

_(şu an açık madde yok — `B-037`…`B-039` aşağıda `ACK`'te)_

---

## ACK — frontend tamamladı, backend arşivleyebilir

### B-037 · `continue_anyway` — kapandı

ICU mesajı yazıldı; Türkçesi § 18.1'in birebir kopyası ("Yine de devam et"),
İngilizcesi ona uyduruldu. Düğme `ErrorPanel`'den geliyor, koda gömülü değil.
Davranış: **yeniden gönderme değil**, aynı metin `acknowledgePreflight: true`
ile — ayrımı sabitleyen bir birim testi ve bir e2e var. Gerçek uçta
doğrulandı: kısa metin **422**, üç çıkış yolu spec sırasında, "Yine de devam
et" sonrası **202**.

### B-038 · Üretim uçları + SSE — kapandı

`gen:api` çalıştı; `/generations` 202, `/jobs/{id}`, akış ve `/download`
bağlandı. `label` çeviri anahtarı olarak işleniyor (`generation.phase.*`),
biten iş `pct: 100` ve fazsız, düşen iş nerede durduysa orada duruyor.
Akış terminal olay olmadan kapanırsa `GET /jobs/{id}`'ye geri düşülüyor.

**İki ölçüm sizin için:** (1) `completed` olayı `matchLevel` **taşımıyor** —
§ 30.6'nın örneği taşıyor; uygunluk raporu bu yüzden yazılamadı (`F-008`).
(2) Bağlanıştaki anlık durum boş dize taşıyor, alan düşürmüyor (`F-010`).

### B-039 · Kota — kapandı

`GET /account/usage` ekrana bağlandı (`/generate` başlığında, harcanmadan
önce), `QUOTA_EXCEEDED` ve `GENERATION_PAUSED` mesajları yazıldı. 503,
"hesabınız kapandı" demiyor: profilin okunur ve dışa aktarılabilir kaldığını
söylüyor.

**`Retry-After` okunmuyor**, ve bu bilinçli: onu tüketecek otomatik bir
yeniden deneme yok ve 429 `retry` resolution'ı taşımıyor — okunmayan bir
başlığı `ApiError`'a koymak kullanıcısı olmayan bir alan olurdu. Otomatik
deneme geldiği gün doğru olan tek değer o olacak; şimdilik metin `resetsAt`
üzerinden yazılıyor.

**Bir ölçüm sizin için:** `used`, `limit`'i **geçiyor** — reddedilen istek de
sayılıyor (`F-012`).

---

## Kalıcı kurallar

Eski maddelerin `spec/`'e işlendiği yerlerin tablosu
`resolved/to-frontend-2026-08.md`'ye taşındı (2026-08-24) — dosya sınırı.
