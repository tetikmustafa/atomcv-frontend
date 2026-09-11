# AtomCV — Durum Panosu

> İki repo da okur ve kendi satırlarını günceller. **Kural: 60 satırı geçmez.**
> Ayrıntı repo-yerel `notes/current.md`'de.

**2026-09-11** · **sıra backend'de** — `B-088`…`B-094`, `B-096` ACK; `F-031`…`F-033` açık

## Backend — `atomcv-backend`

| Aşama / Adım | Durum |
|---|---|
| Aşama 0-3 — hesap, MVP, anonim akış (kapanış denetimi 08-28) | ✅ |
| Aşama 4 — buradan yapılabilecek maddelerin hepsi | ✅ |

**Aşama 4'te inenler.** **Faz G** düzenleme döngüsü: elle aç/kapa (`B-088`, kotasız) ve doğal dil (`B-089`, kotalı) — düzenleme render'a değil selection state'e uygulanıyor, sayfa sınırı yirmi düzenleme sonra da duruyor. **Üç şablon** (`B-090`, `B-092`), **Katman B** slider'ları (`B-091`, V12), **başvuru takibi** (`B-093`), **DOCX indirme** (`B-094`), **yaşam döngüsü e-postaları** (`B-096`, V14). Test tarafında: **LLM eval** lane'i (`llmEval`, § 53.5), **performans bütçeleri** (§ 52.6) ve golden set'in üç şablona genişletilmesi. **Açık kaynak hazırlığı**: lisans zaten MIT'ti, iş `CONTRIBUTING.md`'de ve bayat ön kapıdaydı.

**Ekleme — § 57.7 yaşam döngüsü e-postalarını tanımladı**, çünkü inşa kılavuzu maddeyi adlandırıp bırakıyordu. Liste **kapalı**: hoş geldin (ilk başarılı girişte, tercihe tabi) ve silme onayı (işlemsel, kapatılamaz — § 57.4 söylemeyi zorunlu kılıyor). Tercih `users.lifecycle_emails`, kapatma bağlantısı satırdaki opak bir jetonla ve **bir sayfaya** iniyor: § 40.3'ün ön-getirmesi, uca inen bir bağlantıyı hiç tıklamamış kişilerin postasını kesen bir şeye çevirirdi. Spec **uygulanmadan önce iki kez düzeltildi**: satır tetikleyicisi giriş kutusuna adresi yazılan herkese posta gönderirdi (§ 40.4 satırı hemen yaratıyor), ve tercihi `PUT /profile/preferences`'a koymak bir CV çakışmasının e-posta ayarını reddetmesi olurdu.

**Düzeltme — `.env.example` hiçbir şeyin okumadığı bir harcama limiti sunuyordu.** `DAILY_BUDGET_USD`'yi spec dört yerde anıyor ve yayın kontrol listesinde bir maddesi var; kod `ANOMALY_DAILY_BUDGET_USD` okuyor. Operatörün ayarladığı sayı hiçbir şey yapmıyordu; kurtaran tek şey varsayılanın daha düşük olması. `EnvExampleTest` iki kuralı tutuyor: örnekte okunmayan ad olamaz, varsayılanı olmayan ad eksik olamaz.

**Sayfa garantisi: üçünün de tuttuğu gerçek derleyiciye karşı doğrulandı** — yedi golden profil, hepsi %3 içinde. Genişletme **beş kusur** çıkardı ve beşi de aynı cümleydi: *sayfanın dizdiği ama ölçümün hiç görmediği bir şey.* Listeden sonraki bölüm başlığı; sabit sanılan başlık bloğu (V13 `profiles.header_costs`, artık ölçülüyor); `\resumeItem`'ın iki ayrı kaçak boşluğu; compact'in aynı boşluğu iki kez yazması. **İkisi kullanıcıya ulaşmıştı** — compact'te ve modern'de birer profil ikinci sayfaya taşıyordu. `B-095` açıldı, düzeltildi, kapandı. **Şablon sürümleri yükseldi** (`classic:v6`, `compact:v2`, `modern:v3`); sürüm yalnız ölçüm anahtarlarında geçiyor, API'de değil.

**Ölçümler:** Faz D eşiklerine hiçbir gerçek skor ulaşmıyor (`PhaseDReachTest`, sebep aritmetik); `cover_letter` **v1** (v2 turu 169 kelime, bant 255-290); üç BOM override'ı hâlâ gerekli, `SecurityPatchFloorTest` tutuyor.

**Geliştiricide:** VPS/restore (**restore sonrası anonim satırları silmek**, § 49.4); OAuth, Turnstile ve `B-083`'ün challenge'ı gerçek uca karşı denenmedi; GitHub entegrasyonu (§ 31.8) gerçek bir OAuth uygulaması istiyor.

**Test:** 1712 birim · 529 entegrasyon · latex 141 — 0 hata

## Frontend — `atomcv-frontend`

| Aşama / Adım | Durum |
|---|---|
| Aşama 0-2 — iskelet, profil editörü, üretim akışı + SSE | ✅ |
| Aşama 3 — **bütün dilimler** | ✅ |
| Aşama 4 — `B-071`-`B-074`, `B-085`-`B-087`, `B-088`-`B-094`, `B-096` | ✅ |

**Aşama 4'ün sekizi karşılandı (2026-09-11).** Faz G'nin **cümle kutusu** (`B-089`) sonuç ekranında ve düzenleme yeni bir üretime taşıyor; emekli üretim okunur ve indirilir kalıyor, geçmiş ve `total` onu saymıyor. **Üç şablon + Katman B** ayarlarda, dokunulmamış her alan "şablonun kendi ayarı" diyor. **`/applications`** rotası nav'da, dört uç ve `If-Match`. **DOCX** düğmesi ve § 22.6'nın cümlesi. **`/unsubscribe`** sayfası — basılmadan kapatmıyor — ve ayarlarda e-posta anahtarı.

**Eksik kalan bir şey var ve bilerek:** `B-088`'in **elle aç/kapa arayüzü** çizilmedi. Hangi atomların tartıldığını söyleyen uç yok, ve profilden çizmek basılamayacak düğmeler demek olurdu — `F-031`. İstemci fonksiyonu, hook'u ve `GENERATION_SUPERSEDED` indi.

**`gen:api` bir sessiz kusur açığa çıkardı:** springdoc `DELETE /account`'u `delete_1`'den `delete_2`'ye kaydırdı ve `delete_1` **başvuru silmeye** geçti; ikisi de 204 döndüğü için typecheck sustu. `operations.ts` artık numaralı id'li her ucu **yoluyla** bağlıyor. `F-033` kaynağını istiyor.

**Test:** 751 birim · 56 e2e · **bundle** profil 253.2 / ayarlar 240.0 / üretim 222.9 / onboarding 219.8 / başvurular 215.6 / geçmiş 214.3 KB.

## Açık kararlar

| Soru | Bekleyen taraf |
|---|---|
| Faz D eşiklerinin normalizasyonu | **veri** · `default` setli üretim biriktiğinde |

_Kapandı 09-09: model `openai/gpt-5.6-sol`; `emphasis` kalın, bedeli sıfır; anonim çalışma **profiliyle üretimleriyle** taşınıyor (hesabın profili varsa `kept_existing`, ikisi de sönüyor)._

## Sonraki senkronizasyon noktası

**Sıra backend'de.** Üç madde açık: `F-031` (seçim durumu + halef id'si — `B-088`'in arayüzünü bekleten tek şey), `F-032` (`supersededGenerationId` `JobStatusResponse`'ta yok), `F-033` (numaralı `operationId`'ler ve `isEmpty()`'nin alan olarak sızması).

**Frontend'de Aşama 4'ten kalanlar:** analitik (Umami) ve SEO — ikisi de backend beklemiyor, sıra geliştiricinin kararında.