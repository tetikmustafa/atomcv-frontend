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

> **Dosya hâlâ 100 satır sınırının üstünde, ve sebebi arşivleme gecikmesi
> değil:** üç madde açık. Sınır bir okunabilirlik kuralı; onu delen şey
> burada bir belge sorunu değil, **bir koordinasyon sorunu** — ve mekanizma
> 2026-08-29'da çalışmaya başladı: dilim 0 dördünü, dilim 1 birini, dilim 2a
> birini, dilim 2b üçünü, dilim 3a üçünü, dilim 4, 5 ve 6 birer tane kapattı;
> on beşi
> `resolved/to-frontend-2026-08.md`'ye taşındı ve dosya 496'dan 145'e indi.
> Kalan üçü aşağıda, ve üçü de kapanış dilimi.
>
> Gezinebilir olsun diye aşağıda bir dizin var. Gerekçelerin kalıcı olanı
> `spec/`'e işlendi; burada yalnız *ne yapman lazım* duruyor.

### Dizin — açık maddeler

| ID | Konu | Ne yapman lazım, tek cümlede |
|---|---|---|
| `B-057` | Hesap silme | `DELETE /api/v1/account`. |
| `B-058` | Geri bildirim | Bir başparmak ve 48 saatlik bir içerik izni. |
| `B-059` | Gizlilik Politikası | Alt işleyen listesine Resend + AWS SES (Tokyo). **Yayın öncesi zorunlu.** |

### B-057 · Hesap silme telde — `DELETE /api/v1/account`
**Since:** commit <sha> · Adım 3.9 · **Spec:** `spec/16-cost-legal.md` § 57.4

`DELETE /api/v1/account` → **`204`**, ve yanıt `Set-Cookie` ile oturum çerezini
temizliyor. Gövde yok, onay alanı yok: uç zaten oturum + CSRF arkasında.
**"Emin misin" ekranı sizde** — ve neyin gittiğini saymalı, çünkü geri dönüşü
yok: profil, atomlar, bütün üretimler ve belgeleri, kuyruk işleri, sayaçlar,
e-posta tercihleri.

İki şey **bilerek kalıyor** ve gizlilik metninde de böyle yazmalı: maliyet
geçmişi (kullanıcı bağı koparılmış olarak — artık kimseyi göstermiyor) ve
hard bounce/şikâyet etmiş bir adresin suppression kaydı (adrese ait, hesaba
değil; silmek o adrese yeniden posta atmamıza izin verirdi). Ayrıca **LLM
sağlayıcıları kendi taraflarında kısa süreli log tutabiliyor** — § 57.4 bunun
kullanıcıya söylenmesini istiyor, yeri gizlilik politikası.

**İkinci basış da `204`.** Silinmiş hesabı tekrar silmek hata değil; idempotent.

Silmeden sonra çerez temizlendiği için istemci **anonim** duruma düşüyor —
`GET /auth/session` yeni bir anonim oturum verir. Kullanıcıyı ana sayfaya
atmak doğru davranış.

### B-058 · Geri bildirim telde — bir başparmak, ve 48 saatlik bir izin
**Since:** commit <sha> · Adım 3.9 · **Spec:** `spec/11-operations.md` § 48.4

`POST /api/v1/generations/{id}/feedback` → `200`.

```jsonc
{ "rating": 1,                 // 1 | -1, ZORUNLU, başka değer 400
  "category": "density",       // selection|writing|format|density|other, ops.
  "comment": "...",            // ops., en fazla 4000
  "contentGranted": false }    // ops.
```

**Yalnız başparmak zorunlu.** Sebep sormadan önce yargıyı kabul eden bir form
daha çok ve daha iyi yargı toplar — kategori ile yorum, söyleyecek şeyi olanlar
için.

**Üretim başına tek yargı.** Öbür başparmağa basmak fikrini değiştirmek; ikinci
bir satır açılmıyor, var olan güncelleniyor. Ekranda "geri bildirimini
gönderdin" yerine **mevcut seçimi göstermek** doğru davranış.

**`contentGranted` § 48.4'ün rızası ve asıl dikkat isteyen yer.** Bu üründe
başka her şey şekillerden teşhis ediliyor (karakter sayısı, satır sayısı,
render maliyeti); bu, içeriğe açılan **tek kapı**. İşaretlemek 48 saat açıyor,
`false` göndermek **geri alıyor**. Yanıt grant'i geri yolluyor:

```jsonc
"contentGrant": { "open": true, "expiresAt": "...",
                  "accessedAt": null, "revokedAt": null }
```

**`accessedAt` biri gerçekten bakana kadar `null`** — ve kişiye gösterilmeli.
Kontrol edilemeyen bir onay kutudan ibaret. Ekranda "izin verdin, henüz
bakılmadı / şu tarihte bakıldı" cümlesi bu alandan kuruluyor. İkinci bir "evet"
pencereyi ileri **itmiyor**; 48 saat ilk kabulden başlıyor.

**Yorum geri yollanmıyor** (mutlak kural 4 ile aynı sebep: kişi onu zaten
yazdı, elinde). Saklanıyor ama loglanmıyor.

### B-059 · Gizlilik Politikası'na iki alt işleyen ve bir bölge
**Since:** Adım 3.2 · **Spec:** `spec/14-build-guide.md` § 3.2, `spec/16-cost-legal.md`
**Action:** Politika sayfasındaki alt işleyen listesine e-posta yolunu ekleyin —
bugün orada yok.

Giriş bağlantıları **Resend** üzerinden gidiyor, Resend de altta **AWS SES**
kullanıyor. Bu kurulumun bölgesi **`ap-northeast-1` (Tokyo)** ve öyle kalıyor
(2026-08-28 kararı) — yani e-posta adresi ve gönderim üstverisi **AB dışında**
işleniyor. Politika "veriler AB'de işlenir" gibi bir cümle taşıyorsa yanlış;
taşımıyorsa bile liste eksik.

Yazılacak asgari şey: *e-posta teslimatı — Resend (AWS SES, Tokyo)*.

EK C.1'in "Gizlilik Politikası yayında ve sağlayıcı listesi doğru" maddesi
yayından önce bunu istiyor. **Bu maddeyi kapatmadan MVP yayına alınmamalı.**

## ACK — frontend tamamladı, backend arşivleyebilir

_(`B-037`…`B-043`, dilim 0'ın kapattığı `B-044`, `B-045`, `B-047`, `B-055`,
dilim 1'in kapattığı `B-046`, dilim 2a'nın kapattığı `B-048`, dilim 2b'nin
kapattığı `B-049`, `B-050`, `B-054`, dilim 3a'nın kapattığı `B-051`, `B-053`,
`B-060`, dilim 4'ün kapattığı `B-056`, dilim 5'in kapattığı `B-052` ve
dilim 6'nın kapattığı `B-061` — hepsi
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

---

## Kalıcı kurallar

Eski maddelerin `spec/`'e işlendiği yerlerin tablosu
`resolved/to-frontend-2026-08.md`'ye taşındı (2026-08-24) — dosya sınırı.
