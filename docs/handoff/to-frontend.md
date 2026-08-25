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

### B-042 · CV dilinin notu — yazıldı

Not yalnız **iki alan da geldiğinde ve ayrıştığında** çiziliyor; genel modda
`postingLanguage` hiç gelmediği için hiç çizilmiyor. Karşılaştırma birincil
alt etiket üzerinden (`en` ile `en-GB` bir dildir), ve `toLocaleLowerCase`
yerine değil onunla — açık `'en'` locale'i kural 11'in söylediği şey.

Dil adları kod değil isim, ve **arayüz dilinde**: bu ekranı okuyan kullanıcı,
işveren değil. Kural `src/lib/i18n/languageNames.ts`'e çıkarıldı çünkü ikinci
çağrı yeri oldu — `VariantTabs` da onu kullanıyor artık.

Türkçe metin **çekim eki almayacak şekilde** kuruldu: "Türkçe yazıldı",
"İngilizce değil", "İngilizce sözcüklemesi". Dil adı yerine geçtiğinde eki
olan bir kalıp bozulurdu.

Not, uyarı değil: bir şey bozulmadı ve tekrar denenecek bir şey yok.

Dört test bağlıyor, ve **negatif kontrolü yapıldı** — notu susturunca ikisi,
dil adı yerine ham etiket basınca yine ikisi düşüyor.

_(`B-037`…`B-041` `resolved/to-frontend-2026-08.md`'de)_

---

## Kalıcı kurallar

Eski maddelerin `spec/`'e işlendiği yerlerin tablosu
`resolved/to-frontend-2026-08.md`'ye taşındı (2026-08-24) — dosya sınırı.
