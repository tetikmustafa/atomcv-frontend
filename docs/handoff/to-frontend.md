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

> **Açık madde kalmadı.** Backend'in yazdığı on sekiz maddenin on sekizi de
> kapandı ve `resolved/to-frontend-2026-08.md`'ye taşındı; dosya 496 satırdan
> buraya indi. Sıradaki madde geldiğinde bu bölüm yeniden dolar.

## ACK — frontend tamamladı, backend arşivleyebilir

_(`B-037`…`B-043`, dilim 0'ın kapattığı `B-044`, `B-045`, `B-047`, `B-055`,
dilim 1'in kapattığı `B-046`, dilim 2a'nın kapattığı `B-048`, dilim 2b'nin
kapattığı `B-049`, `B-050`, `B-054`, dilim 3a'nın kapattığı `B-051`, `B-053`,
`B-060`, dilim 4'ün kapattığı `B-056`, dilim 5'in kapattığı `B-052` ve
dilim 6'nın kapattığı `B-061`, dilim 7a'nın kapattığı `B-058` ve dilim 7b'nin
kapattığı `B-057` ile `B-059` — hepsi
`resolved/to-frontend-2026-08.md`'de.)_

**`B-047`'de yapılacak bir şey çıkmadı:** LinkedIn hiçbir zaman giriş
sağlayıcısı olarak çizilmemişti. Silinmedi, hiç yoktu — madde yine de kapalı.

**`B-046`'nın ertelenen yarısı indi:** çıkış düğmesi artık çizili, ve giriş
yoluyla birlikte geldi — ulaşılamayan bir durumun düğmesi olmasın diye
beklemişti.

**İki maddede bir doğrulama eksik ve söylenmesi gerekiyor:** ne OAuth
sıçraması (`B-048`) ne de Turnstile (`B-050`) gerçek uca karşı denendi —
ikisi de kendi anahtarları yapılandırılmış bir dağıtım istiyor. Bugün
doğrulanan şey mock'a karşı: `403` widget'ı sıfırlatıyor, `429` cümlesini
`Retry-After`'dan kuruyor, `/auth/complete` oturumu okuyup yoluna gidiyor.

**`B-051` kapandı ama § 31.6'nın gözden geçirme ekranı yarım.** "Sorunlu
bölümler otomatik açık" ve "kritik uyarılar Onayla'yı kapalı tutar"
uygulanamadı, çünkü telde hangi bölümün sorunlu olduğunu söyleyen bir alan
yok — yalnız bir sayı var. Uydurmadık; ne yapılabildiği ve ne istediğimiz
**`F-018`**'de. O maddeye kadar geçit "şu kadar konuda emin olamadık" notuyla
duruyor.

**`B-059` kapandı ama EK C.1'in maddesi kapanmadı.** Alt işleyen listesi artık
doğru — e-posta yolu adıyla ve bölgesiyle yazılı. Eksik olan şey **sağlayıcı
listesinin kendisi**: hangi model, ona ne gidiyor, ücretsiz katman eğitimde
kullanıyor mu. Model seçimi bir ürün kararı olarak bekliyor, o paragraf da
onunla birlikte yazılacak. **Yayın öncesi kontrol listesi hâlâ açık.**

---

## Kalıcı kurallar

Eski maddelerin `spec/`'e işlendiği yerlerin tablosu
`resolved/to-frontend-2026-08.md`'ye taşındı (2026-08-24) — dosya sınırı.
