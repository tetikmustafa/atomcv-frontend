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

> Altısı `F-017`-`F-021`'in cevaplarından çıkmıştı. **Beşi kapandı ve
> `resolved/`'a indi** (2026-08-29); kalan tek madde `B-066`, ve yarısı
> kapalı: sorusuna **`F-022`** ile cevap verildi, geçmiş ekranı ondan sonra.

### B-066 · `GET /api/v1/generations` indi — ve satırda başlık yok, kasten
**Since:** commit `b776047` · `F-020` · **Spec:** `spec/08-api.md` § 35.3, EK D.8.7

**Aksiyon:** `gen:api`, geçmiş ekranını kurun; **ve aşağıdaki soruya cevap
verin** — satırı neyle etiketleyeceğiz.

`capabilities.canSaveHistory` artık karşılıksız değil. Gövde
`{ items, nextCursor, total }`:

- **Cursor, offset değil.** `nextCursor`'ı `cursor` olarak geri verin;
  **yokluğu geçmişin sonu** (boş bir `items` bir sayfa geç kalmış olurdu).
  Opak — bizim okuyacağımız, sizin yankılayacağınız bir değer; parçalamayın,
  sıralama bizim değiştirebileceğimiz bir şey. `limit` varsayılan 20, tavan
  100, ve **aşan istek kırpılıyor, reddedilmiyor.**
- **`total` sayfanın değil hesabın sayısı.** İstediğiniz ikinci şey buydu:
  **hesap silme onayındaki sayıyı buradan alın** (`GET /generations?limit=1`
  yeter). Sayfaları yürüyerek sayılan bir sayı, yürüyüş bitene kadar başka bir
  sayı olurdu.
- **Satır:** `generationId`, `status`, `createdAt`, `pageCount`, `matchLevel`,
  `contentLanguage`, `hasCoverLetter`. **İlan yok, mektup metni yok.**
- **Bozuk cursor `400 VALIDATION_FAILED`**, `fields: ["cursor"]`.

**Soru — satırı neyle etiketleyeceğiz?** Bugün bir satır "1 sayfa · 29 Ağustos
· strong" diyor ve **başka hiçbir şey demiyor**; on üretimi olan biri için bu
liste neredeyse okunmaz. Bir geçmiş ekranının isteyeceği etiket — rol adı,
şirket — **ilandan** okunuyor, ve `GenerationResponse` ilanı baştan beri geri
döndürmüyor (mutlak kural 4). Buraya `jdAnalysis.role.title` koymak o kuralın
sınırını **kazara** çizmek olurdu, o yüzden koymadık.

Cevabınıza göre üçünden biri olacak: (a) etiket gerekmiyor, tarih yeter;
(b) rol/şirket yayımlansın — o zaman bunu § 57'de açık bir karar olarak
yazarız; (c) kullanıcının kendi verdiği bir ad. **Bir `F-nnn` ile söyleyin**,
biz spec sorusu olarak kapatalım.

## ACK — frontend tamamladı, backend arşivleyebilir

_(`B-037`…`B-065` ile `B-067` kapandı ve `resolved/to-frontend-2026-08.md`'de
— hangi dilimin hangisini kapattığı orada. Aşağıdakiler **hâlâ canlı olan**
kayıtlar; gerisi arşive indi.)_

**`B-062`, `B-063`, `B-064`, `B-065` ve `B-067` kapandı** (2026-08-29).
Notları arşivde; ikisinde söylenecek bir şey kaldı:

- **`B-064`'te gerçekten yapacak bir şey yoktu** — mock'un ürettiği `400` ile
  `fields: ["userEdited"]` telden gelenle aynı çıktı. Madde yine de kapalı.
- **`B-067` uygulandı ama uyarılar adlandırılmıyor.** Geçit artık uyarıların
  bölümlerini açıyor ve sayıyor; hangi uyarı olduğunu **söylemiyor**, çünkü
  şema `ImportWarning.code`'u düz `string` olarak yayımlıyor ve
  `ExtractionWarningCode`'un altı değeri buradan bilinmiyor. **`F-023`**.

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
