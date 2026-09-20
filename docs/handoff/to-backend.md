# → Backend

> **Kanal kuralları**
> - Frontend yazar, backend okur ve `OPEN` → `ACK` taşır.
> - Her madde bir ID taşır (`F-nnn`), numaralar tekrar kullanılmaz.
> - **Dosya 100 satırı geçerse arşivleme gecikmiştir.**
> - Bir spec değişikliği gerekiyorsa burada iste — `spec/`'i frontend reposunda düzenleme,
>   bir sonraki senkronda kaybolur.

---

## OPEN

### F-037 · `choose_language`'ın dolduracağı alan yok

**Since:** frontend `feat/stage-4-closing` · D3 · `B-114`

**Neden:** `B-114` `LANGUAGE_UNDETECTED`'a `choose_language` verdi ve ekranın
soruyu sorması doğru — `detectedCandidates` en fazla tek elemanlı, yani "şu mu,
yoksa başka bir dil mi". Ama cevabın gideceği yer yok: `POST /profile/import`
yalnız `mode` query parametresini yayımlıyor, multipart gövde de `file` ve
`challengeToken` taşıyor. Üstelik bu kod **işten** geliyor (§ 08b, Adım 3.4
dilim 4), yani reddin geldiği anda ortada yazılmış bir profil de yok; kişi
bir dil seçse onu yazacak bir satır bulunmuyor.

Düğme çizilirse basıldığında aynı reddi yeniden üretir. `ErrorPanel`'in
politikası gereği **çizilmiyor** (`canResolve`), tıpkı `keep_top_pinned`
gibi — ve bu, sunucunun gönderdiği bir çözümü düşürmek demek, ki mutlak
kural 7 ile sürtünüyor.

**İstenen — üçünden biri:**
1. `POST /profile/import`'a bir dil alanı (`language`, ISO 639-1) ekleyin;
   gönderildiğinde tespit atlanır. Tercihimiz bu.
2. Ya da `choose_language`'ı bu kodun çözüm listesinden düşürün — o zaman
   `LANGUAGE_UNDETECTED` çözümsüz kalır ve `ErrorCatalogueTest`'inizin
   `everyActionIsOfferedSomewhere` kontrolü eylemin başka bir üretenini
   arayacaktır.
3. Ya da eylemin anlamı başkaysa söyleyin — belki gözden geçirme ekranında
   bir yere bağlanıyor ve biz yanlış yerde arıyoruz.

**Spec:** `08b-api-contract.md` Adım 3.4 · `handoff/to-frontend.md` `B-114`

### F-038 · Şemada olup hiçbir maddede adlandırılmayan dört şey

**Since:** frontend `feat/stage-4-closing` · D1 · `npm run gen:api`

**Neden:** `gen:api` `B-100`…`B-116` okunduktan sonra koşuldu ve dört şey
çıktı; hiçbiri bir `B-nnn` taşımıyor, yani ACK sırasında görülmeyecekti:

| Ne | Maddelerde |
|---|---|
| `POST /generations` **`note`** (500 karakter, Faz D'ye gidiyor) | `B-104` *"`freeformNote` gelmedi ve bilerek"* diyor |
| `POST /generations` **`customizationId`** | yok |
| **`GET /templates`** (`TemplateSummary`, ölçülmüş kapasiteyle) | yok |
| **`/customizations`** (liste/oluştur/yama/sil, profil başına 20) | yok |

`note` özellikle önemli, çünkü `B-104` onun **gelmediğini** açıkça yazıyor ve
gerekçesini de veriyor ("tek makul okuyucu Faz D'nin prompt'u — o da yeni bir
prompt sürümü ve EK C.3'ün eval koşusu demek"). Uç açıklamasına bakılırsa o iş
yapılmış. İkisinden biri bayat.

**İstenen:** dördünün de bir maddesi olsun (ya da bu madde ACK'lenip
`to-frontend.md`'ye dördünü anlatan bir `B-nnn` yazılsın). Biz dördünü de
D6 ve D12'de telden okuyacağız; sormamızın sebebi **kapsam değil, muhafız**:
`B-101`'in bağlamak istediği `contract-check` tam olarak bunu yakalardı ve o
iş hâlâ ikimizde de yapılmadı.

**Spec:** `08-api.md` § 35.8 · `to-frontend.md` `B-101`, `B-104`

<!-- Şablon:
### F-001 · Kısa başlık
**Since:** frontend commit <sha> · Adım <n>
**Neden:** <sorunun ne olduğu>
**İstenen:** <backend'den beklenen somut şey>
**Spec:** <ilgili dosya ve bölüm, varsa>
-->

---

## ACK — backend tamamladı, frontend arşivleyebilir

**`F-031`, `F-032`, `F-033` karşılandı (2026-09-12), geldikleri gün.**
Ne yapıldığı ve frontend'in ne yapması gerektiği `to-frontend.md`'de
`B-097`…`B-099` olarak duruyor — **`B-099` `npm run gen:api`'yi zorunlu
kılıyor**, 33 operasyon adı değişti.

Üçünün de karşılığı tek cümleyle: `GET /generations/{id}/selection`
tartılan satırları metniyle yayımlıyor ve `GenerationResponse`
`supersededByGenerationId` taşıyor (`F-031`); `JobStatusResponse`
`supersededGenerationId` **ve** `matchLevel` taşıyor (`F-032` — ikincisi
istenmemişti, aynı kusurdu); her ucun açık bir `operationId`'si var ve
`empty` iki şemadan da kalktı (`F-033`).

*(`F-001`…`F-024` `resolved/to-backend-2026-08.md`'de,
`F-025`…`F-030` `resolved/to-backend-2026-09.md`'de.)*
