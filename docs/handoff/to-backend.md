# → Backend

> **Kanal kuralları**
> - Frontend yazar, backend okur ve `OPEN` → `ACK` taşır.
> - Her madde bir ID taşır (`F-nnn`), numaralar tekrar kullanılmaz.
> - **Dosya 100 satırı geçerse arşivleme gecikmiştir.**
> - Bir spec değişikliği gerekiyorsa burada iste — `spec/`'i frontend reposunda düzenleme,
>   bir sonraki senkronda kaybolur.

---

## OPEN

### F-031 · Elle toggle'ın çizilebilmesi için seçim durumu yayımlanmalı

**Since:** frontend, Aşama 4 · `B-088` karşılanırken § 24.4

**Neden:** `POST /generations/{id}/selection` indi ve istemci fonksiyonu
yazıldı, ama **ekran çizilemiyor.** Düğme başına bir toggle çizmek için
"bu üretim hangi atomları tarttı ve hangileri sayfaya girdi" bilgisi gerekiyor;
`GET /generations/{id}` uygunluk raporunu ve ön yazıyı taşıyor, seçimi
taşımıyor. Profildeki atomlardan çizmeyi denersek, **bu üretimin hiç
tartmadığı bir atom `400`** olduğu için ekran basılamayacak düğmeler
gösterir. Cümle yarısı (`B-089`) bu boşluktan etkilenmediği için tam indi.

**İstenen:** `GET /generations/{id}` — ya da yeni bir uç — bu üretimin
tarttığı atomları yayımlasın: **atom id'si, sayfaya girip girmediği, ve
satırın metni** (numaralandırılmış hâli modele zaten gösteriliyor). Metin
olmadan liste "atm_7f2c…" diye çizilir, ki o bir arayüz değil.

**İkincisi, aynı uca:** emekli bir üretimin **yerine gelenin id'si**.
Ekran bugün "bunun daha yenisi var" diyebiliyor ama **oraya bağlantı
veremiyor** — telde emekliden halefe giden bir işaret yok, ve geçmişi
yeniden okumak superseded satırları listelemediği için cevabı vermiyor.

**Spec:** `spec/06-pipeline-d-g.md` § 24.4, `spec/08-api.md` § 35.3

### F-032 · `supersededGenerationId` şemada yok, yalnız akışta

**Since:** frontend, Aşama 4 · `B-088`'in 2. maddesi

**Neden:** `B-088` terminal olayın `supersededGenerationId` taşıdığını
söylüyor ve uç açıklaması da söylüyor — ama `JobStatusResponse` alanı
**yayımlamıyor.** SSE yükü `text/event-stream` olduğu için şemada `unknown`,
yani tipli olan tek taşıyıcı geri düşüş: `GET /jobs/{id}`. Orada alan
olmadığı için **akış kopup poll devreye girdiğinde alan kayboluyor**, ve
`api.d.ts` onu ekleyen bir istemciyi derlemede reddediyor.

**İstenen:** `supersededGenerationId`'yi `JobStatusResponse`'a ekleyin
(Faz G işinde dolu, diğerlerinde yok). Bugün kimseyi engellemiyor —
düzenlemeyi gönderen ekran zaten hangi üretimi gönderdiğini biliyor — ama
`F-031`'in bağlantısını çizen ekran için iki taşıyıcı da aynı şeyi
söylemeli.

**Spec:** `spec/08-api.md` § 35.3

### F-033 · springdoc iki yerde şemayı kirletiyor: numaralı `operationId` ve `empty`

**Since:** frontend, Aşama 4 · `npm run gen:api` sonrası

**Neden:** İkisi de sessiz, ve birincisi **bizi ısırdı**.

1. **Numaralı `operationId`'ler konumsal.** `DELETE /account` düne kadar
   `delete_1`'di; başvuru controller'ı inince `delete_2` oldu ve `delete_1`
   **başvuru silmeye** kaydı. İstemcide hesap silmenin dönüş tipi o günden
   beri yanlış operasyona bağlıydı ve **hiçbir şey derlemede patlamadı**:
   ikisi de 204 dönüyor, yani ikisi de `void`. Düzeltmeyi bizde yaptık
   (bu dört uç artık **yoluyla** bağlanıyor), ama kaynağı sizde.
   **İstenen:** adı çakışan controller metotlarına açık `operationId`
   verin (`deleteAccount`, `listApplications`, `updateApplication`,
   `deleteApplication`, `accountSettings`…). Numara bir isim değil.

2. **`isEmpty()` bir alan olarak yayımlanıyor.** `Appearance` ve
   `SelectionEditRequest` şemalarında `empty: boolean` var; kayıtların
   `isEmpty()` getter'ı sızıyor. Okunan `Appearance`'ı doğrudan
   `AppearanceUpdate` olarak geri yazmak bu yüzden **yazma şemasının
   tanımlamadığı bir alan göndermek** oluyor; istemci onu eliyor.
   **İstenen:** `@JsonIgnore` (ya da `@Schema(hidden = true)`).

**Spec:** `spec/08-api.md` § 35.8

<!-- Şablon:
### F-001 · Kısa başlık
**Since:** frontend commit <sha> · Adım <n>
**Neden:** <sorunun ne olduğu>
**İstenen:** <backend'den beklenen somut şey>
**Spec:** <ilgili dosya ve bölüm, varsa>
-->

---

## ACK — backend tamamladı, frontend arşivleyebilir

*(boş. `F-001`…`F-024` `resolved/to-backend-2026-08.md`'de,
`F-025`…`F-030` `resolved/to-backend-2026-09.md`'de — sonuncu üçü
2026-09-09'da indi, kapandıkları gün.)*
