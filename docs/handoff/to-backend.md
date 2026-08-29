# → Backend

> **Kanal kuralları**
> - Frontend yazar, backend okur ve `OPEN` → `ACK` taşır.
> - Her madde bir ID taşır (`F-nnn`), numaralar tekrar kullanılmaz.
> - **Dosya 100 satırı geçerse arşivleme gecikmiştir.**
> - Bir spec değişikliği gerekiyorsa burada iste — `spec/`'i frontend reposunda düzenleme,
>   bir sonraki senkronda kaybolur.

---

## OPEN

### F-022 · Geçmiş satırının etiketi — cevabımız (b): rol ve şirket
**Since:** frontend commit `c62de11` · `B-066`'nın sorusu
**Neden:** Üç seçeneğinizden **(b)**. (a) yetmiyor: tarihle sayfa sayısı iki
üretimi birbirinden ayırmıyor, ve bu ekranın tek işi "hangisiydi o" sorusuna
cevap vermek. (c) — kullanıcının verdiği ad — kullanıcıya, hiç istemediği bir
adlandırma işi yüklüyor; on üretimi olan biri onu da yapmaz ve liste yine
okunmaz kalır.

**İstenen:** `GenerationSummary` üstünde ilanın rolü ve şirketi —
`jdAnalysis`'in okuduğu iki alan, satır için yeterli olan en dar hâlleriyle.
İkisi de **yoksa** (genel mod, ya da ilanda şirket geçmiyorsa) alan hiç
olmasın; boş bir dize satırı bir şey söylüyormuş gibi gösterir. Uç, ilanın
kendisini döndürmesin — istediğimiz etiket, metin değil.

**Ve bunun mutlak kural 4'ün sınırını çizdiğini biz de görüyoruz.** Bugüne
kadar hiçbir yanıt ilanı geri vermiyordu; iki alan onu bir istisnaya çeviriyor
ve istisnanın nerede bittiğini yazan bir cümle yoksa bir sonraki alan da aynı
gerekçeyle girer. **§ 57'de açık bir karar olarak yazın** — "satırı
adlandıracak kadarı, ilanın kendisi değil" gibi bir sınırla.

**Spec:** `spec/08-api.md` EK D.8.7 (satır), `spec/16-cost-legal.md` § 57

### F-023 · `ImportWarning.code` telde düz `string` — kapalı sözlük yayımlanmıyor
**Since:** frontend commit `c62de11` · `B-067`
**Neden:** `B-067` "mesajı `code` üstünden kurun" diyor, ve § 31.6.4
`ExtractionWarningCode`'un **kapalı ve tam altı değerli** olduğunu söylüyor —
ama şemada alan `code?: string`. Yani altı değerin beşi buradan bilinmiyor:
`spec/`'in yazdığı tek kod `AMBIGUOUS_DATE` (§ 31.4'ün örneği). Altı ICU
anahtarı yazmanın yolu yok, ve tahminle yazılan bir anahtar kümesi hiç
eşleşmeyecek altı satır olurdu — **`B-067`'nin faz çevirileri için verdiği
gerekçenin aynısı.**

Bugün geçit uyarıları **sayıyor ve yerlerini açıyor**, hiçbirini
adlandırmıyor. Bu doğru bir ekran, ama eksik olanı da o: okuyan kişi hangi
bölümün neden açıldığını göremiyor.

**İstenen:** `ExtractionWarningCode` enum olarak yayımlansın — hata kataloğu
`code`'ları ile aynı disiplinde, `@Schema(implementation = ...)` ya da
neyse. Değerleri gördüğümüz gün altı ICU mesajını yazarız; bilmediğimiz bir
yedinci kod da genel bir cümleye düşer, çünkü enum'un **kapalı olduğunu
bilerek** açık okuyacağız (aynı `ResolutionAction`'da yaptığımız gibi).

**Spec:** `spec/07-subsystems.md` § 31.6.4, `spec/08-api.md` (şema)

### F-024 · `file` parçası olmayan içe aktarma isteği `500` dönüyor
**Since:** frontend commit `b99b6c1` · gerçek uca karşı ölçüm, 2026-08-30
**Neden:** `POST /api/v1/profile/import`'a multipart gövde gönderip **`file`
parçasını koymayınca** cevap `500 INTERNAL_ERROR`. Muhtemelen
`MissingServletRequestPartException`'ın advice'ta işleyicisi yok — `B-064`'ün
`IllegalArgumentException`'ı ile aynı sınıf, aynı sonuç: sunucu kullanıcıya
"isteğin beni bozdu" diyor.

**Bizim arayüzümüzden ulaşılmıyor** (form dosya seçilmeden göndermiyor), o
yüzden acil değil. Ama `500` bir istemci hatasının cevabı değil, ve bir dahaki
istemci — mobil, betik, bizim gelecekteki bir ekranımız — bunu bir sunucu
arızası sanır.

**İstenen:** `400 VALIDATION_FAILED`, `fields: ["file"]`. Mock'umuz bugün de
bunu üretiyor, yani cevabınız evetse bizde yapılacak bir şey yok.

**Ölçümün kaydı:** `curl -F "notfile=@cv.txt"` → `500`. Aynı oturumda
ölçülen ve **doğru** çıkan her şey: `413` → `409` → `415`/`422` sırası,
`{"userEdited": true}` → `400`, `405`/`406`/`415`, `rating: 0` → `400`,
cursor'lu sayfalama ve bozuk cursor'ın `400`'ü, CSRF'siz yazmanın `403`'ü.

**Spec:** `spec/08b-api-contract.md` EK D.6

<!-- Şablon:
### F-001 · Kısa başlık
**Since:** frontend commit <sha> · Adım <n>
**Neden:** <sorunun ne olduğu>
**İstenen:** <backend'den beklenen somut şey>
**Spec:** <ilgili dosya ve bölüm, varsa>
-->

---

## ACK — backend tamamladı, frontend arşivleyebilir

*(`F-001`…`F-021` `resolved/to-backend-2026-08.md`'de — beşinin de cevabı
oraya indi 2026-08-29'da, dosya sınırı.)*
