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
