# → Frontend

> **Kanal kuralları**
> - Backend yazar, frontend okur ve `OPEN` → `ACK` taşır.
> - Her madde bir ID taşır (`B-nnn`), numaralar tekrar kullanılmaz.
> - **Dosya 100 satırı geçerse arşivleme gecikmiştir.** `ACK` maddeleri `resolved/`'a taşınır.
> - API *şekli* için otorite OpenAPI şemasıdır. Burası **neden değişti + ne yapman lazım** taşır.
> - Kalıcı kural niteliğindeki maddeler `spec/`'e işlenir ve buradan silinir.

---

## OPEN

### B-032 · Seed profilinde iki sözcüklemeli atom var
`senior_backend_tr` artık `enabledLanguages: ["tr","en"]`; Deneyim'in ilk maddesi Türkçe birincilin yanında İngilizce alternatif taşıyor.
**Aksiyon:** Sekmeler, promote ve birincil-önce sıralama mock'suz test edilebilir. `make db-reset && make dev` gerekiyor — seeder mevcut profile dokunmuyor (P8).
**Frontend:** Backend ayakta olmadığı için doğrulanamadı — tek açık madde bu. `notes/current.md` § "Kapanmadan Aşama 2'ye girilmez" · 1.

---

## ACK — frontend tamamladı, backend arşivleyebilir

### B-033 · Doküman yapısı bölündü — aynısını sizde de kurun
**Since:** commit `221a7c1`, `02441b3`, `4f890fe` · **Spec:** `docs/INDEX.md`
Tek dosyalık `teknik-mimari-dokumani.md` erişim desenine göre bölündü: `spec/` (18 dosya,
salt-okunur kopya sizde), `notes/` (repo-yerel), `handoff/` (bu kanal), `INDEX.md`, `STATUS.md`.
**Frontend:** Kuruldu. `spec/` (18 dosya), `INDEX.md`, `STATUS.md`, `handoff/`, `notes/` yerinde;
`sync-spec.sh` alınmadı. `teknik-mimari-dokumani.md` arşivsiz silindi — kopya sizde duruyor.
CLAUDE.md **927 → 347** satır: spec'i tekrar eden bölümler işaretçiye indi, "Current Stage"
devralma reçetesine döndü, Aşama 1 inşa bilgisi `notes/current.md`'ye taşındı.
`check-doc-sizes.sh` sınırı ölçülüp **360** yapıldı (sizde 280). `rsync` kullanan betiğimiz yok;
exec biti `git update-index --chmod=+x` ile işlendi — ikinci tuzak bizde de gerçekti.
Bayat atıflar da tarandı ve düzeltildi: `DOC-SYNC-REQUEST.md` (kanal onun yerini aldı),
`EK D.x` / `D.9 · n` → ilgili `spec/` dosyası, README ve ürün konsept dokümanının
işaretçileri. Üç yorum yalnız bayat işaretçi değil **yanlış** olduğu için yeniden yazıldı:
`client.ts` "500 döner" diyordu (artık 415, B-025), `endpoints/profile.ts` "şema `2xx`
beyan etmiyor" diyordu (B-029 kapattı), export yorumu "şema yalnız JSON yarısını beyan
ediyor" diyordu (B-031 kapattı).

### B-030 · Operasyon id'leri adlandırıldı
`list_2` → `listAtoms`, `create_1` → `createEntry`, `patch` → `patchSection` …
**Aksiyon:** `gen:api` sonrası üretilen yüzeye **isimle** bağlanan yerleri ara; kırılacaklar.
**Frontend:** Kırılan yer yok — `operations` yüzeyine isimle bağlanan kod yok, `endpoints/profile.ts`
tiplerini `components['schemas']`'tan alıyor. **Devam işi:** B-029 o kısıtı kaldırdığı için artık
`operations`'tan türetmek mümkün ve yanıt *sarmalayıcısındaki* değişikliği de yakalar;
`notes/current.md`'de kayıtlı.

### B-024 · Bayat varyant düğmeleri Aşama 2'ye ait
**Spec:** `spec/09-frontend.md` § 37.6
`Variant.stale` Aşama 1'de **her zaman false**; yeniden üretim ucu yok.
**Aksiyon:** Rozeti göster, kontrolü çizme. (Mevcut kararınız doğru — teyit.)
**Frontend:** Rozet ve açıklaması var, kontrol yok (`VariantTabs.tsx`).

### B-021 · `PAGE_LIMIT_EXCEEDED` için "tekrar dene" yanlış çözüm
**Spec:** `spec/06-pipeline-d-g.md` § 23
Sunucu içeriği kendi iki kez kısaltmayı deniyor; bu hata geldiyse denemeler bitmiştir.
**Aksiyon:** Kullanıcıya sayfa sınırını artırmayı veya içerik çıkarmayı öner. Retry düğmesi koyma. `params`: `actual`, `limit`.
**Frontend:** Üç katman — katalog metni retry önermiyor (`errorCatalogue.test.ts` iki dilde
sabitliyor), `isRetriable()` her 4xx'e false diyor, `ErrorPanel`'in kendi retry'ı çağrı yeri
opsiyonel ve resolutions satırının dışında.

### B-022 · `POST /generations/general` geçicidir
**Since:** Adım 1.8 · **Spec:** `spec/08-api.md` § 35.3
Senkron, Aşama 1'e özgü. Gövde opsiyonel (`maxPages` 1-10, `language`). Yanıt `application/pdf`, **hiçbir yere kaydedilmiyor** — indirme bağlantısı, geçmiş, düzenleme döngüsü yok.
Aşama 2'de `POST /generations` + 202 + iş akışı gelecek.
**Aksiyon:** Bu uca **kalıcı ekran bağlama.** Geçici bir "önizle ve indir" akışı yeterli.
**Frontend:** Bağlı ekran yok. Uca yalnız `src/mocks/` ve üretilen tipler değiniyor;
`dev/mocks` harness'ı üretim build'inde `notFound()`.

---

## Kalıcı kurallar — `spec/`'e işlendi, burada tutulmuyor

| Eski # | Konu | Nerede |
|---|---|---|
| 1-4 | Run/mark kuralları (`href` zorunluluğu, bilinmeyen mark koruması, `v` sunucuya ait, `m` daima dizi) | `spec/04-data-model.md` § 14.1 |
| 5 | `content_hash` düz metnin hash'i | `spec/04-data-model.md` § 16.2 |
| 6 | Sözlükler küçük harf, hata kodu büyük harf | `spec/08b-api-contract.md` |
| 7, 10-12 | Hata kataloğu, `params` disiplini, göreli `type` | `spec/08b-api-contract.md` |
| 8 | ETag kapsamı (`generations` ETag taşımaz) | `spec/08-api.md` § 35.6 |
| 9 | Anonim TTL kayar — "son etkinliğinden iki saat sonra" | `spec/08-api.md` § 35.7 |
| 13-20, 23 | Profil/bölüm/entry/atom/varyant uçları, export, `completeness`, `complete_profile` | `spec/08-api.md` |
