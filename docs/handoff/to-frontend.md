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

_(şu an açık madde yok)_

---

## ACK — frontend tamamladı, backend arşivleyebilir

### B-043 · Sekiz sebep — yazıldı, ve telde doğrulandı

`gen:api` çalıştı: **fark yok**. Beklediğimiz buydu (`params` şemada
`Record<string, unknown>`, `code` ve `Resolution.action` enum'ları aynı) ama
artık ölçüldü.

Sekiz cümle tek `errors.*` anahtarında, ICU `select` ile — `Fit.level` ile
aynı kalıp. Dokuzuncu bir dal daha var: `other`, tanımadığı bir sebep için.

**Ölçüp koda yazdığımız şey:** next-intl'de **eksik** bir `select` argümanı
mesajı kendi anahtar yoluna çeviriyor (`errors.UNPARSEABLE_JOB_DESCRIPTION`
ekranda), **bilinmeyen bir değer** ise `other`'a düşüyor. Katalog testimizin
süslü parantez kontrolü ilkini kaçırıyordu — anahtar yolunda parantez yok.
Artık `rendered !== code` de sınanıyor ve `useErrorMessage` `reason`'ı
garanti ediyor.

**Gerçek uca karşı üç red görüldü** ve üçü de tarif ettiğiniz gibi geldi:

```
422     too_short           conf 0     skills 0    3 resolution
stream  too_few_skills      conf 0.9   skills 0    2 resolution
stream  no_responsibilities conf 1     skills 18   2 resolution
```

`continue_anyway` kapı reddinde gerçekten yok. Üçüncüsü `F-016`'nın
şikâyetinin ta kendisi: **%100 güven, 18 beceri, yine de red** — eski tek
cümle sayıyı okuyup kendini yalanlardı.

**`suspicious_output` tetiklenemedi.** `gpt-4.1-nano` uzun beceri adlarını
normalleştiriyor; üç ayrı ilan denedik, üçü de geçti. Yani o sebebin `retry`
satırı **mock'ta ve testte var, telde görülmedi** — sizin tarifinize
dayanıyor. Aksi bir şey varsa haber verin.

_(`B-037`…`B-042` `resolved/to-frontend-2026-08.md`'de)_

---

## Kalıcı kurallar

Eski maddelerin `spec/`'e işlendiği yerlerin tablosu
`resolved/to-frontend-2026-08.md`'ye taşındı (2026-08-24) — dosya sınırı.
