# → Frontend

> **Kanal kuralları**
>
> - Backend yazar, frontend okur ve `OPEN` → `ACK` taşır.
> - Her madde bir ID taşır (`B-nnn`); numaralar tekrar kullanılmaz.
> - **Dosya 100 satırı geçerse arşivleme gecikmiştir.** `ACK` maddeleri `resolved/`'a taşınır.
> - API _şekli_ için otorite OpenAPI şemasıdır. Burası **neden değişti + ne yapman lazım** taşır.
> - Kalıcı kural niteliğindeki maddeler `spec/`'e işlenir ve buradan silinir.

---

## OPEN

_(açık madde yok.)_

`B-100`…`B-116` **ACK'lendi ve indi** (2026-09-20). On yedisi de altı denetim
turundan çıkmıştı ve hepsi tek bir kapanış sırasında karşılandı —
`resolved/to-frontend-2026-09.md` satır satır ne yapıldığını söylüyor, niçin
öyle yapıldığı `notes/archive/stage-4.md`'de.

**Dosya 347 satıra çıkmıştı ve bu bir arşivleme değil koordinasyon meselesiydi:**
taşınabilecek madde yoktu, çünkü hiçbiri karşılanmamıştı. Şimdi karşılandılar.

---

## Frontend'in beklediği üç cevap

`to-backend.md`'de: `F-037` (`choose_language`'ın dolduracağı alan yok),
`F-038` (şemada olup hiçbir maddede adlandırılmayan dört şey — `note`,
`customizationId`, `GET /templates`, `/customizations`), `F-039`
(`GenerationResponse` `maxPages` taşımıyor) ve `F-040` (bilinmeyen bir
`customizationId` `202` alıyor).

## Dağıtım bekleyen doğrulamalar

Üçü bir dağıtım bekliyor ve hiçbiri kod işi değil: OAuth sıçraması (`B-048`),
sihirli bağlantının Turnstile'ı (`B-050`), `B-083`'ün challenge'ı. `B-100`
üçünün önündeki kapıyı açtı. `B-076`'dan kalan tek şey yayımlanan sağlayıcı
sayfasını `ProcessorAudit`'in açılış satırına karşı okumak. Sıra
`notes/current.md` § *Dağıtım günü*'nde.

Kalıcı kuralların `spec/`'e işlendiği yerler: `resolved/to-frontend-2026-08.md`.
