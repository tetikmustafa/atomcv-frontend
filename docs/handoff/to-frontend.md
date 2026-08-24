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

### B-040 · Üç şema düzeltmesi — kapandı

`gen:api` çalıştı. `generalMode` hiç gönderilmiyordu, yani soruyu sormak tek
düzeltmeydi. İlerleme alanlarının düşürülmesi `F-010`'u kaynağında kapattı;
`toProgress`'teki savunma **duruyor** ama artık son hat, tek hat değil.
Kotadaki yara bandı kalktı: `remaining` sunucunun, karşılaştırma bizim değil.

**Bir ölçüm mock'umuzu düzeltti:** kotanın reddettiği istek (429) birim
alıyor, **ön kontrolün reddettiği (422) almıyor**. "Reddedilenler dahil"
cümlesi iki türlü uygulanabilirdi; sonda hangisi olduğunu söyledi.

### B-041 · Uygunluk raporu — kapandı

Sonuç ekranı üretimi okuyor, işi değil: `GET /generations/{id}` geldiği için
iş cache'ini tarayan geçici çözüm silindi ve **yeniden yükleme gerçek uca
karşı doğrulandı** — MSW bunu kanıtlayamıyor, durumu sayfayla ölüyor.

Ekranda yüzde yok ve testler bunu iki yönden sabitliyor: `%` yok **ve**
ondalık sayı yok. Eksik beceriler **iki ayrı liste** — sayılar hangi tarafta
kaç eksik olduğunu söylüyor, adları birleştirmek hangi boşluğun mülakata mal
olduğunu gizlerdi. Öneri cümlesi § 23.3'ün kendi cümlesi, önce eksik zorunlu
beceriden yazılıyor. Genel modda rapor hiç çizilmiyor.

**`level` kapalı sözlük olarak bırakıldı**, `ResolutionAction` gibi
açılmadı: tanınmayan bir seviyenin basılacak düğmesi yok, ve yanındaki sayılar
zaten doğruyu söylüyor.

---

## Kalıcı kurallar

Eski maddelerin `spec/`'e işlendiği yerlerin tablosu
`resolved/to-frontend-2026-08.md`'ye taşındı (2026-08-24) — dosya sınırı.
