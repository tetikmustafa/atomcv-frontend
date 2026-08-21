# İnşa Notları — Aktif (frontend)

> Kural: bu dosya **400 satırı geçmez**. Aşama bitince `archive/`'a taşınır.
> Bu dosya **backend'e senkronize edilmez** — repo-yerel.
>
> Aşama 1'in tam kaydı `archive/stage-1.md`'de. Aşağıdakiler oradan
> **taşınanlar**: hâlâ geçerli olan kurallar ve kasıtlı boşluklar. Bir şeyin
> *neden* öyle olduğunu arıyorsan önce burası, sonra `rg` ile arşiv.

---

## Aşama 2 — üretim akışı + SSE

Plan: `spec/14-build-guide.md` § XI-A.5 · frontend sırası
`spec/15-repos-and-claude.md` § XI-B.9.2, satır 6.

**Henüz başlanmadı.** Aşama 1'in tam kaydı `archive/stage-1.md`'de.

Kapanış turu: `gen:api` şemadan tek bir fark getirdi — `ProfileUpdate`'te
`sourceLanguage` artık `required` — ve typecheck'i tam öngörülen yerde kırdı.
Düzeltme uydurulmuş bir varsayılan değil, sözleşmenin garanti ettiğini tipte
söylemek oldu: `Profile` `endpoints/profile.ts`'te `sourceLanguage`'ı zorunlu
olacak şekilde **daraltılıyor** (kolon `NOT NULL`, `PUT` onu şart koşuyor).
Alternatifi bir `?? 'en'`'di, yani backend'in tam olarak kaçındığı sessiz
"Türkçe profil İngilizceye döner" hatası. Aynı daraltma mock fixture'ında da
var — yoksa fixture alanı düşürebilir ve testler istemcinin imkânsız dediği
bir şekli sınamaya devam ederdi.

Doğrulama iki turda yapıldı, ikisi de gerçek uca karşı ve seed birebir geri
yüklenerek: API seviyesinde 20 kontrol (B-035, B-036'nın altı vakası, F-003,
bölüm `PATCH`), tarayıcıda MSW kapalı 14 kontrol (baş kaydetme, bölüm
yeniden adlandırma, entry düzenleme ve bir alanı `null` ile boşaltma).

### Aşama 1'den devralınan, Aşama 2'de yeniden bakılacaklar

- **`POST /generations/general` geçicidir** (handoff · B-022). Senkron,
  hiçbir yere kaydetmiyor, Aşama 2'de `POST /generations` + 202 + iş akışı
  onun yerini alacak. **Kalıcı ekran bağlanmadı** ve bağlanmamalı.
- **Çift gönderim koruması `Idempotency-Key`'e taşınacak.** Aşama 1'de tek
  savunma "istek uçarken düğme disabled" — profil create'lerinde
  `Idempotency-Key` yok (`spec/08b-api-contract.md` § D.6.5). Aşama 2'nin
  iş başlatan uçlarında var; oradaki anonim indeks kusuru hâlâ açık.
- **`capabilities` yayınlanınca üç yer açılır:** profil başındaki dil
  eksenleri, kota UI'ı, anonim/kimlikli ayrımı. Üçü de bugün *kasten*
  yok — aşağıya bak.
- **Kota günü UTC döner, `resetsAt` offset'li mutlak bir andır** (F-007,
  `spec/08b-api-contract.md`). Hata katalogu bunu zaten biçimlendiriyor;
  kota *ekranı* `capabilities` ile gelecek.

---

## Kasıtlı boşluklar — sorulmadan "düzeltilmez"

| Boşluk | Neden böyle |
|---|---|
| **Metin düzenleme düz metin, mark'ları düşürüyor** | Mark farkında editör kural 4'ün lazy-load edeceği bileşen ve henüz yok. Kabul edilebilir olmasının tek sebebi **söylenmesi**: atomun gerçekten mark'ı varsa kaydetmeden **önce** uyarı çıkıyor (P8). Uyarıyı, onu gereksiz kılan editörü yazmadan kaldırma. |
| **Bayat sözcüklemeyi yeniden üretecek kontrol yok** | Aşama 1 ne uç ne de `stale`'i true yapacak iş yayınlıyor (B-024). Rozet ve açıklaması var, düğme yok — çalışamayacak düğme, zaten bir şeyin bozuk olduğunu söyleyen ekranda hiç yoktan kötü. |
| **Sözcükleme tek başına silinemiyor** | Sunucuda **iki ayrı kural** var (B-036): son sözcüklemeyi silmek `400` + `["variantId"]`, birincili silmek `400` + `["primary"]`. İkincil bir sözcüklemeyi kaldıran kontrol yazılabilirdi; yazılmadı, çünkü tek başına anlamlı bir jest değil — silinmek istenen şey madde. Uç fonksiyonu ve iki reddi de üreten mock duruyor. |
| **Profil başında dil eksenleri düzenlenemiyor** | `sourceLanguage` ve `enabledLanguages` **içerik dili** ekseni (Bölüm 38.1), arayüz dili değil — `routing.locales`'i burada kullanmak `lib/i18n/locales.ts`'in açıkça uyardığı hata olurdu. Hangi dillerin sunulabileceği `capabilities`'e bağlı ve Aşama 1 onu yayınlamıyor; sabit liste yazmak "anonim modu hardcoded varsayımdan değil `capabilities`'ten kapıla" kuralını çiğner. Form ikisini de **olduğu gibi geçiriyor** ve ikisi de gövdede **zorunlu** (B-035). |
| **`POST /generations/general`'a kalıcı ekran bağlı değil** | Yukarıda. |
| **Dark mode bağlı değil** | CLAUDE.md · *Deferred by Decision*. Yarım uygulamak — `prefers-color-scheme`'i geri koymak — kullanıcıya değiştiremeyeceği bir tema verir. |

---

## Dosyalar arasına yayılan değişmezler

Tek bir dosyaya bakarak görülmeyenler. Çağrı yerlerindeki yorumlar ayrıntıyı
taşıyor; burada yalnız **nerede olduğu** var.

- **Sürüm cache'ten gelir, çağırandan değil.** Yazma hook'ları `version`
  almıyor; istek kurulurken önbellekten okuyor. Bileşenden geçirilen sürüm bir
  render'da okunmuştur ve ikinci kaydetmede bayattır. **Bağlı olduğu tek şey:
  optimistic update `version`'a dokunmayacak.**
- **…ama sunucunun sürüm artırdığı her yerde önbellek tazelenmeli.** Bu
  Aşama 1'de üç kez ısırdı: promote'ta demote edilen satır (B-034), bölüm
  sıralaması, entry sıralaması. Üçünde de düzeltme yanıtı **önbelleğe
  yazmak**, yalnız invalidate etmek değil — invalidation'ın refetch'i pencereyi
  kapatıyor ama pencerenin kendisi bir 412.
- **Atomlar öğe başına cache'lenir, write-through, asla invalidate edilmez.**
  `GET /profile/atoms/{id}` yok; koleksiyon yanıtı atom başına sürümün tek
  kaynağı. `useAtom`'un `queryFn`'i kasten fırlatıyor. Koleksiyonu invalidate
  et; **atom anahtarını asla** — ve `profileKeys.all`'u da asla, o öneki
  kapsıyor.
- **Invalidation gözlemcisiz çalışmaz.** Etkin gözlemcisi olmayan bir sorgu
  refetch edilmez, `setQueryData` ile seed'lenmiş bir anahtarın ise `queryFn`'i
  hiç yoktur ve `refetchType: 'all'` de onu kurtarmaz. "Sonra düzelir" diye
  bırakılan her şey bu yüzden düzelmeyebilir.
- **Atom başına iki autosave.** Kontroller `PATCH /atoms/{id}`, sözcükleme
  varyant ucundan; ikisi bağımsız sürümleniyor (B-027).
- **PATCH `application/json` gider** (B-025). `application/merge-patch+json`
  **415**. Bir test media type'ı sabitliyor.
- **`If-Match` tırnaklı olmalı ve onu yalnız `toIfMatch` kurar.** `If-Match: 2`
  → 412 — ve bu gerçek çakışmanın da yanıtı, yani hata tek başına çalışan
  kullanıcıya "başkası düzenledi" diyaloğu olarak görünür.
- **`PUT /profile` istisnasız değiştirir** (F-004/B-035). Gönderilmeyen alan
  temizlenir; `sourceLanguage` ve `enabledLanguages` gövdede zorunlu. Baş formu
  bu yüzden dokuz alanı da her seferinde gönderiyor, asla diff.
- **`PATCH` yokluğu "dokunma" demek.** Bir alanı boşaltmak `null` göndermekle
  olur, omit etmekle değil — `toEntryPatch` bunun için var.
- **Silme cascade'lidir.** Bölüm entry'lerini ve atomlarını, entry atomlarını
  götürür; hiçbiri devredilmez. Onay metni sayı vermek zorunda, ve "sil sonra
  yeniden yarat" bir düzeltme yöntemi değil — düzenleme yüzeyi bu yüzden var.
- **`completeness` taşıyan bir yanıt güncel bir değer taşır** (F-003) — ama
  bölüm/entry/atom uçları başı **döndürmüyor**, o yüzden onların hook'ları
  başı invalidate ediyor.
- **Boş gövdeli 200'e karşı koruma duruyor.** `readBody` önce metin okuyor;
  MSW'nin Node interceptor'ı `Content-Length` koyuyor, service worker'ı
  koymuyor — yani bu sınıf hatayı yalnız e2e yakalar.

---

## Test ve ölçüm

- **Geçen bir test bir şey kanıtlamaz.** Aşama 1'de üç kez, doğru görünen bir
  test düzeltme geri alındığında da geçti — çünkü arkadan gelen bir refetch
  ölçülen şeyi onarıyordu. Yeni bir değişmez sabitlerken **negatif kontrol
  yap**: düzeltmeyi geri al, testin kırıldığını gör. Gerekirse ilgili `GET`'i
  `delay('infinite')` ile tut.
- **Hiçbir test ön kapıdan girmiyordu.** On beş e2e testinin tamamı
  `page.goto('/en/profile')` ile doğrudan URL'e gidiyordu, yani editör
  enine boyuna sınanırken "bir insan oraya nasıl varıyor?" sorusu hiç
  sorulmadı. Cevap: varamıyordu — iniş sayfasında ürüne giden **tek bir link
  yoktu** ve hiçbir şey kırmadı, çünkü hiçbir şey bakmıyordu. Yalnız bookmark
  ile ulaşılan bir rota ulaşılabilir değildir. Artık iki test ön kapıdan
  yürüyor.
- **Sonda yazarken her dalın `params`'ını bas.** Yalnız `status` loglayıp tek
  ölçülmüş vakadan genelleme yapmak bir handoff maddesini yanlış yazdırdı
  (B-036).
- **Playwright erişilebilir adı alt dizge, Testing Library tam dize eşler.**
  Aynı fark iki yönden de ısırdı: `exact: true` Playwright'ta gerekli,
  Testing Library'de hata.
- **Bundle:** `/[locale]/profile` **244.0 KB toplam / 75.8 KB kendi payı**
  (tavan `bundle-budget.json`). Formlar, silme dialog'u ve ağır bileşenler
  `next/dynamic` arkasında — RHF+Zod tek başına 75 KB, ölçüldü.
- **Türkçe metni shell argümanından geçirme.** Sonda `curl -d` ile gönderilen
  Türkçe gövde bozuk varıyor ve sahte bir `400` üretiyor; sondaları dosyaya
  yazıp `node` ile çalıştır.
