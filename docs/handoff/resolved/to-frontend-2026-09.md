# Kapatılmış — → Frontend · 2026-09

`to-frontend.md`'nin `OPEN` bölümünden buraya taşındı. Maddeler frontend
tarafından karşılandı; burada yalnız "bu karar ne zaman ve neden verilmişti?"
sorusu için duruyorlar. Tam metinleri backend reposundaki kopyada.

`B-085`…`B-087` (2026-09-09, şema yeniden üretimi · `canWriteCoverLetter` ·
`params.feature`'ın dördü) geldikleri gün kapandı; kayıtları
`docs/notes/current.md`'de.

---

## Aşama 4 — `B-088`…`B-094`, `B-096` (2026-09-11)

Sekizi bir arada geldi ve bir arada karşılandı. Her satır **ne yapıldığını**
söylüyor; niçin öyle yapıldığı `docs/notes/current.md`'de.

### B-088 · Faz G'nin manuel toggle'ı
İstemci fonksiyonu (`editSelection`) ve hook'u indi, **ekranı inmedi** — hangi
atomların tartıldığını yayımlayan bir uç yok, `F-031` onu istiyor. Geri kalanı
tam: `GENERATION_SUPERSEDED` iki katalogda, emekli üretimde düzenleme kutusu
yerine not (indirme duruyor), geçmiş ve `total` emekli satırları saymıyor.
Silme onayı metni zaten "N CV" diyordu — düzeltme gerekmedi.

### B-089 · Faz G'nin doğal dil yarısı
Sonuç ekranında cümle kutusu (`POST /{id}/edits`, 500 karakter). Kotadan
düştüğü kutunun yanında yazıyor. `EDIT_NOT_UNDERSTOOD` metni **ne
yapabildiğini söylüyor**, yoksa çıkmaz sokak olurdu; sunucunun `retry`'ı
düğme olarak çiziliyor. İş bitince yeni üretime taşınıyor.

### B-090 · İkinci şablon, ve `templateId`'nin etkili olması
### B-092 · Üçüncü şablon, ve ilk renkli varsayılan
Ayarlarda **CV görünüşü** bölümü açıldı; şablon listesi `capabilities`'ten,
sırası sunucunun. "Her şablon siyah başlar" varsayımı hiç kurulmadı:
dokunulmamış her alan "şablonun kendi ayarı" diyor, bir renk basmıyor.
Tanımadığı bir id'nin klasiğe düşmesi mock'ta da öyle.

### B-091 · Katman B
Beş kontrol, `canCustomizeTemplate` arkasında: üç slider (Radix, klavye
bedava), yazı tipi, vurgu rengi. Alan **atlanınca** şablonun ayarına dönüyor.
9pt uyarısı var, engel yok. Ölçüm kuyruğu için ekranda bir şey yok — § 33.3'ün
göstergesini yayımlayan uç yok ve istenmedi.

### B-093 · Başvuru takibi
`/applications` rotası, nav'da. Dört uç, `If-Match` gövdedeki `version`'dan.
Hiçbir geçiş kilitli değil. `generationId` null olan satır yerinde duruyor ve
indirme düğmesi göstermiyor.

### B-094 · DOCX indirme
Sonuç ekranında ikinci düğme; `format` PDF'te **atlanıyor**, DOCX'te
gönderiliyor. Yanında § 22.6'nın cümlesi: PDF birebir, Word yaklaşık.
`format=source` istemciden hiç çağrılmıyor — mock onu 400'le reddediyor ki bir
gün çağıran olursa burada görülsün.

### B-096 · Yaşam döngüsü e-postaları
`/unsubscribe?t=` sayfası: düğmeye basılmadan hiçbir şey olmuyor (§ 40.3'ün
ön-getirme tuzağı), bilinmeyen jeton da "kapatıldı" diyor. Ayarlarda anahtar
(`GET`/`PATCH /account`). Metin, silme onayının **kapsam dışı** olduğunu
söylüyor — § 57.4 onu kapatılabilir göstermeyi yasaklıyor.

---

## Denetimlerin on yedisi — `B-100`…`B-116` (2026-09-20)

Hepsi altı denetim turundan çıktı ve hepsi **tek bir kapanış sırasında**
karşılandı: D1…D14, `docs/notes/current.md` § *Kapanış sırası*. Niçin öyle
yapıldığı orada ve `notes/archive/stage-4.md`'de; burada yalnız ne yapıldığı.

**Önce `npm run gen:api` koşuldu**, maddelerin istediği gibi. `api.d.ts` 964
satır değişti ve `typecheck` sekiz hata verdi — sekizi de aşağıdaki
maddelerden birine bağlıydı.

| Madde | Ne yapıldı |
|---|---|
| `B-100` · CSP | Kod işi yok. Dağıtım günü kontrol listesine geçti (`notes/current.md`), Turnstile'ın çizildiğinin gözle görülmesi olarak. |
| `B-101` · `contract-check` | **CI'da yazıldı** ve `main/openapi.json`'ı çekiyor. Frontend'de bu iş Aşama 0'dan beri bir `TODO` olarak duruyordu; yerelde backend'in commit'li şemasına karşı koşuldu ve üretilen tipler commit'li `api.d.ts` ile **birebir** çıktı. |
| `B-102` · arşivleme | Uç, hook ve kontrol indi. İşaret sonuç ekranında konuyor, geçmişte satırın olguları arasında okunuyor. Anonimde çizilmiyor — esirgeme değil anlamsızlık. `archive`, `FEATURE_REQUIRES_ACCOUNT`'un beşinci dalı oldu. |
| `B-103` · atom etiketleri | İki uç, `AtomTags` bileşeni, `auto`/`user` ayrı çiziliyor. Sürüm gönderilmiyor ve gönderilmediği testle sabit. Ham skorun dörtte biri sıfırdan çıktı. |
| `B-104` · `emphasize` | `Directives` panelinde, **varsayılan kapalı**. `note` da orada — madde "gelmedi" diyordu, gelmiş (`F-038`). |
| `B-105` · `html` + `source` | İki düğme, ve sayfa sınırının üç ayrı cümlesi: PDF'te kesin, Word'de yaklaşık, HTML'de hiç geçerli değil. `DOWNLOAD_EXTENSION` `source`'u `.tex` yapıyor. |
| `B-106` · GitHub | İki adımlı: öneri hiçbir şey yazmıyor, uygulama seçilenleri yazıyor. Birleştirme ile yeni proje ayrı çiziliyor, hiçbiri işaretli gelmiyor. |
| `B-107` · `auto` çeviri | Üç sonucu da indi: `SCORING` içindeki beklemenin notu, dil notunun yeni gerekçesi, ve `llm_translate` sözcüklemesinin kendi notu. |
| `B-108` · seçim gerekçeleri | `matchedKeywords` çip olarak, `heldBackReason` **dört ayrı cümle**. `EXCLUDED_BY_DIRECTIVE` "profiline dokunulmadı" diyor. Skor yayımlanmadı ve istenmedi. |
| `B-109` · uç açıklamaları | `gen:api` koşuldu. Tip farkı çıkmadı, maddenin beklediği gibi. |
| `B-110` · katalog testi | **Bağlandı.** `errorCatalogue.test` `docs/error-catalogue.md`'yi ayrıştırıyor ve kendi `PARAMS`'ıyla kod kümesini, ad ve tipleri karşılaştırıyor. Negatif kontrol üç yönde yapıldı. |
| `B-111` · çeviri dosyaları | Denetlendi ve **bulgu tersine çıktı**: 41 kodun 41'i yazılıydı, iki dil birebir senkrondu. Fazlalık vardı — `REWRITE_VALIDATION_FAILED` ve `NO_ANONYMOUS_PROFILE` silindi. Maddenin sayıları da yanlıştı: enum 40, katalog 40. |
| `B-112` · iki sözlük daraldı | `gen:api`; `createdBy`'ın dört değerini ayıran bir arayüz zaten yoktu. |
| `B-113` · `EXTRACTION_TIMEOUT` | Metin yazıldı ve 503'ünkinden **davranışça** ayrıldı: 504 aynı dosyayla tekrar denemeye davet ediyor, 503 denemenin yardımcı olmayacağını söylüyor. Üç kontrolle sabit. |
| `B-114` · iki yeni eylem | `upload_another_file` dosya seçiciyi açıyor (tekrar **değil**: aynı şifreli dosya aynı yerde düşer). `choose_language` **çizilmiyor** — `F-037`, dolduracağı alan yok. |
| `B-115` · bayat varyant | Üç maddesi zaten yazılıydı; dördüncüsü indi (anonimde çizilmiyor). Ayrıca **bir şey kanıtlamadan geçen bir test** bulundu: `/regenerate/i` ile aranan düğmenin adı "Write it again from the new source" idi. |
| `B-116` · üç sözlük | `failed` ve `cancelled` dalları silindi, `TERMINAL` yayımlanan enum'a karşı sınıflandırma kontrolü kazandı. `two_column` zaten sunulmuyordu; gerçek uca karşı reddi doğrulandı (`400`, `fields:["layout"]`). |

**Gerçek uca karşı ölçüldü (2026-09-20).** Yeni yüzeyin hepsi bugüne kadar
yalnız MSW'ye karşı doğrulanmıştı; `:8080`'e karşı koşulan sonda etiketleri
(kanonik, idempotent, `If-Match`siz, tekrar silmede 404), şablon registry'sini,
özelleştirmeleri, GitHub önerilerini, `layout`u ve `emphasize`/`note`
sınırlarını doğruladı — ve **üç fark buldu**: registry'nin sayıları § 33.5'in
tablosundan farklı, `POST /customizations` atlanmış alanları şablonun
kendisinden **çözüyor**, ve bilinmeyen bir `customizationId` reddedilmiyor
(`F-040`).


---

## Backend'in dört cevabı — `B-117`…`B-119` (2026-09-21)

`F-037`…`F-040`'ın karşılığıydılar ve **üçü bir arada karşılandı.** Niye
öyle yapıldığı `docs/notes/current.md`'de.

**Önce bir bulgu: `:8080`'de koşan derleme bayattı.** `npm run gen:api`
şemayı **hiç değiştirmedi** — ne `maxPages` ne `language` içindeydi. Tipler
backend reposunun kökündeki `openapi.json`'dan üretildi; CI'ın
`contract-check`'i de `main`'den aynı dosyayı çekiyor.

### B-117 · `F-038`'in dört şeyi
**Kod yazdırmadı:** dördü de D6 ve D12'de inmişti — `note` ve
`customizationId` istekte, şablon listesi `GET /templates`'ten (sabit
listeden değil), `/customizations`'ın dört ucu ve 20 tavanı ekranda.
Maddenin asıl söylediği doğruydu: muhafız eksikti, kapsam değil.

### B-118 · `maxPages`, ve bayat bir `customizationId`
Sonuç ekranı `pageCount`'u **o üretimin** sınırına karşı okuyor; alan yoksa
not yok, çünkü eksik bir alan "sınır bir sayfaydı" demek değil. Geçmiş
satırında **tek olgu** ("bir sayfa — izin verilen 2"), rozet değil. `404`'te
ekran cerrahi: paneli sunucunun metni çiziyor, ekran yalnız ölü seçimi
düşürüp listeyi tazeliyor — onarım, hata arayüzü değil (kural 7).

### B-119 · `choose_language` artık çiziliyor
Düğme `LANGUAGE_UNDETECTED`'da çiziliyor, cevap bir sonraki
`POST /profile/import`'un `language` alanında gidiyor. Seçicinin listesinin
**iki yarısı da sunucunun**: reddin `detectedCandidates`'i önce, sonra
`capabilities.allowedLanguages`. Beyan dosya değişinde düşüyor. `B-114`'ün
"çizilmiyor" kaydı böylece tersine döndü — **kural değil, olgu değişti**:
taşıyamadığı cevabı olan bir çözüm hâlâ düşüyor (`keep_top_pinned`).
Yokluğunu doğrulayan test silinmedi, yerine geçeni yazıldı.

**Geriye kalan:** `language`'ın `400`'ünün kapı sırasındaki yeri ölçülemedi
(`F-041`), ve `B-101`'in `contract-check`'i artık CI'da.
