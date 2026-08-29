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
> değil:** altı madde açık. Sınır bir okunabilirlik kuralı; onu delen şey
> burada bir belge sorunu değil, **bir koordinasyon sorunu** — ve mekanizma
> 2026-08-29'da çalışmaya başladı: dilim 0 dördünü, dilim 1 birini, dilim 2a
> birini, dilim 2b üçünü, dilim 3a üçünü kapattı; on ikisi
> `resolved/to-frontend-2026-08.md`'ye taşındı ve dosya 496'dan 244'e indi.
> Kalan altısı aşağıda, dilim dilim kapanacak.
>
> Gezinebilir olsun diye aşağıda bir dizin var. Gerekçelerin kalıcı olanı
> `spec/`'e işlendi; burada yalnız *ne yapman lazım* duruyor.

### Dizin — açık maddeler

| ID | Konu | Ne yapman lazım, tek cümlede |
|---|---|---|
| `B-052` | Bayat varyant | Bir sözcüklemeyi düzenlemek ötekileri bayatlatıyor; uyarıyı siz gösterin. |
| `B-056` | Cover letter | Bir bayrak, bir uç, ve reddedilebilir. |
| `B-057` | Hesap silme | `DELETE /api/v1/account`. |
| `B-058` | Geri bildirim | Bir başparmak ve 48 saatlik bir içerik izni. |
| `B-059` | Gizlilik Politikası | Alt işleyen listesine Resend + AWS SES (Tokyo). **Yayın öncesi zorunlu.** |
| `B-061` | Maddesiz entry | Altında madde olmayan bir entry artık CV'ye çıkabiliyor — editörde engellemeyin. |

### B-052 · Bir sözcüklemeyi düzenlemek ötekileri bayatlatıyor — ekranı siz kuruyorsunuz
**Since:** commit <sha> · Adım 3.5 · **Spec:** `spec/07-subsystems.md` § 32.2, § 32.2.1

Kullanıcı Türkçe maddeyi düzenleyince İngilizcesi **bayat** işaretleniyor.
Sunucu ne yapacağına kendi karar vermiyor — **siz soruyorsunuz.**

**Varyant nesnesi artık iki bayrak taşıyor**, ve uyarı ikisinin **çiftinden**
kuruluyor:

| `stale` | `userEdited` | Ne demek | Ekranda |
|---|---|---|---|
| `false` | — | Güncel | — |
| `true` | `false` | Kaynağı değişti, **arka planda yenileniyor** | "güncelleniyor" göstergesi yeter |
| `true` | `true` | Kaynağı değişti **ama bu sözcüklemeyi sen yazdın** | § 32.2'nin iki düğmesi |

Üçüncü satır maddenin tamamı. Sunucu, kullanıcının kendi yazdığı bir
sözcüklemeyi **asla** kendiliğinden yenilemiyor; onu yalnız işaretleyip
bırakıyor. § 32.2'nin metni:

> ⚠ Bu maddenin Türkçe hali güncellendi, İngilizce halini sen düzenlemiştin.
>   [ İngilizceyi yeniden üret ] [ Benim halimi koru ]

**"Yeniden üret" düğmesi bağlanabilir** — varyanta `PATCH` gönderin, gövdede
`{"userEdited": false}`. Sunucu bayrağı temizliyor ve satır bayatsa çeviriyi
**hemen** kuyruğa alıyor. `{"userEdited": true}` **reddediliyor**: bir
sözcükleme kelime yazarak sizin olur, iddia ederek değil.

"Benim halimi koru" sunucuya hiçbir şey sormuyor: kullanıcı uyarıyı kapatır,
satır bayat kalır. Bu doğru davranış, eksik değil.

**Yenileme başarısız olabilir** ve bu da sessiz: iş `TRANSLATION_FAILED` (422,
parametresiz) ile düşerse sözcükleme **bayat kalır**. Ekranınız zaten doğru
şeyi gösteriyor olur; ayrıca bir hata bildirimi göstermeyin.

### B-056 · Cover letter telde — bir bayrak, bir uç, ve reddedilebilir
**Since:** commit <sha> · Adım 3.8 · **Spec:** `spec/07-subsystems.md` § 34

**İki yol var ve ikisi de sizde.**

1. `POST /api/v1/generations` gövdesine **`"coverLetter": true`** — CV ile
   birlikte yazılır. **Varsayılan `false`**, çünkü ikinci bir LLM çağrısı.
2. **`POST /api/v1/generations/{id}/cover-letter/regenerate`** — sonradan, ya da
   yeniden. Gövde tamamen opsiyonel:
   `{"style": "default|shorter|more_formal", "companyNote": "..."}`.
   Boş gövde (`{}`) geçerli bir istek.

Yanıt: `{"generationId", "coverLetter", "style"}`. `GET /generations/{id}` de
artık **`coverLetter`** alanı taşıyor (yazılmadıysa alan yok). **Düz metin**,
paragraflar arası boş satırla — § 34.7 belge üretmiyor, çünkü mektup bir forma
ya da e-postaya yapıştırılıyor.

**Yeni ve önemli: bu uç reddedebilir.** `422 COVER_LETTER_REJECTED`,
`params.issues` bir dizi (`unsupported_claim`, `number_invented`,
`experience_overstated`, `wrong_company`, `length_out_of_range`, `cliche`),
çözüm eylemi `retry`. Sebebi: mektubun arkasında **orijinal yok** — CV'de
reddedilen bir cümlenin yerine kişinin kendi cümlesi basılıyor, mektupta
basılacak bir şey yok. **Bunu bir hata ekranı gibi göstermeyin**; "bu taslak
denetimden geçmedi, tekrar dene" doğru cümle. `issues` kullanıcıya ne olduğunu
söylemek için orada.

`429 RATE_LIMITED` da mümkün: saatte on mektup. `params.resetsAt` var.

**Üretim sırasında istenen mektup CV'yi düşürmez.** `coverLetter: true` ile
üretilen bir CV'de mektup yazılamadıysa iş yine `completed` oluyor ve
`GET /generations/{id}` mektup alanını taşımıyor — düğmeyle tekrar istenebilir.

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

### B-061 · Maddesiz bir entry artık CV'ye çıkabiliyor
**Since:** commit <sha> · kapanış denetimi dilim 5 · **Spec:** `spec/05-pipeline-a-c.md` § 20.2

Bugüne kadar seçim atom atom çalışıyordu: altında hiç madde olmayan bir entry
aday bile değildi, yani **"2019-2023, Yıldız Teknik Üniversitesi, Bilgisayar
Mühendisliği" satırı üretilen CV'ye hiçbir yoldan giremiyordu.** Bir diplomanın
maddesi olmaz; alternatif — her entry'ye zorunlu bir madde yazdırmak — tam da
bu ürünün karşı durduğu şeyi, şişirmeyi yaptırırdı.

**Aksiyonunuz:**

1. **Profil editöründe maddesiz entry'yi engellemeyin** ve maddesiz bırakmayı
   caydıran bir metin varsa kaldırın. "Bu entry CV'ye çıkmaz" diyen bir uyarı
   varsa artık yanlış.
2. **Boş bir entry, boş bir entry'dir.** Başlığı (`title`) olmayan bir satır
   hâlâ anlamsız — o doğrulama kalsın; kalkan yalnız *madde* zorunluluğu.
3. `minAtoms`, maddesi olan entry'ler için geçerli; maddesiz bir entry ona
   takılmıyor. Editörde `minAtoms` kutusunu maddesiz bir entry'de göstermeye
   gerek yok.

**Telde ne değişti:** `selection_state` içinde yeni bir alan var —
`headerOnlyEntries: UUID[]`, sayfaya maddesiz çıkan entry'lerin id'leri. Eski
üretimlerde yok ve **boş liste olarak okunur**, yani mevcut ekranların hiçbiri
kırılmıyor. Bir "neden bu satır çıktı" görünümü kuracaksanız bakacağınız yer
burası: o entry `selected` listesinde **görünmez**, çünkü seçilmiş bir atomu
yok.

**Bütçe tarafı:** böyle bir entry başlığının maliyetini öder, madde listesinin
maliyetini ödemez. Sayfa sınırı garantisi aynen duruyor.

---

## ACK — frontend tamamladı, backend arşivleyebilir

_(`B-037`…`B-043`, dilim 0'ın kapattığı `B-044`, `B-045`, `B-047`, `B-055`,
dilim 1'in kapattığı `B-046`, dilim 2a'nın kapattığı `B-048`, dilim 2b'nin
kapattığı `B-049`, `B-050`, `B-054` ve dilim 3a'nın kapattığı `B-051`,
`B-053`, `B-060` — hepsi `resolved/to-frontend-2026-08.md`'de.)_

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
