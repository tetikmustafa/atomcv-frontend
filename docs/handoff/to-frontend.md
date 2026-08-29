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

*(şu an açık madde yok — `F-017`-`F-021`'in cevaplarından çıkan altı
maddenin altısı da kapandı ve `resolved/`'a indi.)*

## ACK — frontend tamamladı, backend arşivleyebilir

_(`B-037`…`B-067`'nin hepsi kapandı ve `resolved/to-frontend-2026-08.md`'de —
hangi dilimin hangisini kapattığı orada. Aşağıdakiler **hâlâ canlı olan**
kayıtlar; gerisi arşive indi.)_

**Altısı da kapandı** (`B-062`-`B-067`, 2026-08-29/30). Notları arşivde;
üçünde söylenecek bir şey kaldı:

- **`B-064`'te gerçekten yapacak bir şey yoktu** — mock'un ürettiği `400` ile
  `fields: ["userEdited"]` telden gelenle aynı çıktı. Madde yine de kapalı.
- **`B-067` uygulandı ama uyarılar adlandırılmıyor.** Geçit artık uyarıların
  bölümlerini açıyor ve sayıyor; hangi uyarı olduğunu **söylemiyor**, çünkü
  şema `ImportWarning.code`'u düz `string` olarak yayımlıyor ve
  `ExtractionWarningCode`'un altı değeri buradan bilinmiyor. **`F-023`**.
- **`B-066`'nın ekranı kuruldu, satır hâlâ etiketsiz.** `/history` listeliyor,
  cursor ile sayfalıyor, `total`'i hesabın sayısı olarak okuyor ve anonim
  oturuma ne aldığını söylüyor. Satırda yalnız tarih, sayfa, eşleşme düzeyi,
  dil ve mektup var — rolü ve şirketi **`F-022`** istiyor, ve geldiklerinde
  satıra eklenecekler.

**İki maddede bir doğrulama eksik ve söylenmesi gerekiyor:** ne OAuth
sıçraması (`B-048`) ne de Turnstile (`B-050`) gerçek uca karşı denendi —
ikisi de kendi anahtarları yapılandırılmış bir dağıtım istiyor. Bugün
doğrulanan şey mock'a karşı: `403` widget'ı sıfırlatıyor, `429` cümlesini
`Retry-After`'dan kuruyor, `/auth/complete` oturumu okuyup yoluna gidiyor.

**`B-059` kapandı ama EK C.1'in maddesi kapanmadı.** Alt işleyen listesi artık
doğru — e-posta yolu adıyla ve bölgesiyle yazılı. Eksik olan şey **sağlayıcı
listesinin kendisi**: hangi model, ona ne gidiyor, ücretsiz katman eğitimde
kullanıyor mu. Model seçimi bir ürün kararı olarak bekliyor, o paragraf da
onunla birlikte yazılacak. **Yayın öncesi kontrol listesi hâlâ açık.**

---

## Kalıcı kurallar

Eski maddelerin `spec/`'e işlendiği yerlerin tablosu
`resolved/to-frontend-2026-08.md`'ye taşındı (2026-08-24) — dosya sınırı.
