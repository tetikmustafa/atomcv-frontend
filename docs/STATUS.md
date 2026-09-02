# AtomCV — Durum Panosu

> İki repo da bu dosyayı okur ve kendi satırlarını günceller. **Kural: 60 satırı geçmez.**
> Ayrıntılı inşa kayıtları repo-yerel `notes/current.md`'dedir, buraya taşınmaz.

**2026-09-02** · **iki kanal da boş** — `F-025`-`F-027` indi ve `ACK` edildi

---

## Backend — `atomcv-backend`

| Aşama / Adım | Durum |
|---|---|
| Aşama 0 · 1 · 2 — iskelet, yürüyen iskelet, ilana özel üretim | ✅ |
| Aşama 3 — hesap ve MVP · 3.1-3.6, 3.8, 3.9 (3.7 profil editörü frontend'de) | ✅ |

**Dilim 9-14: on bir `F-nnn`'in on biri de indi**, ve çoğunda yanlış olan
taraf backend'di — dört ayrı istisna `500` dönüyordu, EK D.6'da beş kod
eksikti, ve dilim 14'ün üçü de **ölçümle** çıktı. Ayrıntı `resolved/`'da.

**Dilim 14'ün kalıcı kararları:** § 18.4.1 (işveren adı ilanda geçmeli),
§ 34.4.2 (mektup tabanı 250 → **120**, ve sayı kontrolü nicelik okuyor).
Dilim 13'ünkü § 57.6: geçmiş satırının iki alanı, ve mutlak kural 4'ün sınırı.

**Kapanış denetimi (0-3)** `notes/kapanis-denetimi.md`'de. **Geliştiricide:**
fiyat tablosu (model seçilince), VPS (§ XI-A.4) ve restore testi. Deploy'u
düşüren iki HIGH CVE yamalandı (netty-codec, pgjdbc).

**Test:** 1078 birim · 450 entegrasyon · latex 49/49 — 0 hata

## Frontend — `atomcv-frontend`

| Aşama / Adım | Durum |
|---|---|
| Aşama 0 — İskelet · 1 — Profil editörü · 2 — Üretim akışı + SSE | ✅ |
| Aşama 3 — on üç dilim · **kapandı 2026-09-02**, kaydı `archive/stage-3.md` | ✅ |
| Aşama 4 — olgunlaşma (§ XI-A.7, sabit sırası yok) | başladı |

**Gerçek uca karşı ölçüldü** (2026-08-30 ve 2026-09-02, MSW kapalı; mektup,
hesap silme ve silme sonrası dahil). Dilim 13 üç cevabı karşıladı: `gen:api`
fark üretmedi, `F-025`'in kuralı mock'a girdi, ve `F-027` iki yorumumuzun
"ikinci basış `204`" iddiasını yanlışladı — telde altı ucun altısı da `401`.
**Ölçülmeyen yalnız OAuth ile Turnstile** — ikisi de yapılandırılmış bir
dağıtım istiyor.

**Test:** 651 birim · 51 e2e · **bundle** profil 252.5 / geçmiş 213.9 / üretim 220.3 / onboarding 217.3 / ayarlar 229.8 KB.

## Açık kararlar (ikisini de ilgilendirir)

| Soru | Bekleyen taraf |
|---|---|
| Hesabın profili varken anonim çalışma birleşecek mi | **ürün** · bugün `kept_existing` |
| Hangi LLM modeli — fiyat tablosu ona bağlı | **ürün** |

## Sonraki senkronizasyon noktası

**Sırada kimse yok.** Üç cevap `ACK` edildi ve `to-backend-2026-09.md`'ye
indi; kalan tek canlı satır `DELETE /account`'un ikinci basışının `401`
olması. **Yayın öncesi açık:** gizlilik politikasının sağlayıcı listesi model
seçimini, OAuth ile Turnstile yapılandırılmış bir dağıtımı bekliyor.
