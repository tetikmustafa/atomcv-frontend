# AtomCV — Durum Panosu

> İki repo da bu dosyayı okur ve kendi satırlarını günceller. **Kural: 60 satırı geçmez.**
> Ayrıntılı inşa kayıtları repo-yerel `notes/current.md`'dedir, buraya taşınmaz.

**2026-08-30** · **Backend'in altı maddesinin altısı da frontend'de kapandı** ·
açık `B-nnn` yok · açık `F-nnn`: **`F-022`**, **`F-023`**

---

## Backend — `atomcv-backend`

| Aşama / Adım | Durum |
|---|---|
| Aşama 0 · 1 · 2 — iskelet, yürüyen iskelet, ilana özel üretim | ✅ |
| Aşama 3 — hesap ve MVP · 3.1-3.6, 3.8, 3.9 (3.7 profil editörü frontend'de) | ✅ |

**Dilim 9-12: beş `F-nnn`'in beşi de indi**, ve sorulanların çoğunda yanlış
olan taraf backend'di — `{"userEdited": true}` **`500`** dönüyordu, EK D.6'da
**beş kod eksikti**, ve `F-018`'de uyarının **yerinin kendisi yanlıştı**.
§ 31.6'nın "kritik uyarı" kuralı **silindi** — kapalı sözlükte engelleyici
kod yok. Ayrıntı `resolved/to-backend-2026-08.md`'de.

**Kapanış denetimi (0-3)** `notes/kapanis-denetimi.md`'de. **Geliştiricide:**
model seçilince fiyat tablosu (o güne kadar bütçe freni çalışmaz), VPS kurulumu
(§ XI-A.4) ve **restore testi**.

**Test:** 1054 birim · 444 entegrasyon · latex 49/49 — 0 hata

## Frontend — `atomcv-frontend`

| Aşama / Adım | Durum |
|---|---|
| Aşama 0 — İskelet · 1 — Profil editörü · 2 — Üretim akışı + SSE | ✅ |
| Aşama 3 — **bütün dilimler** ✅ · açık `B-nnn` kalmadı | ✅ |

Dokuz dilim (dökümü kendi `notes/`'larında). § 31.6'nın geçidi ve geçmiş
ekranı indi; **geçmiş satırı etiketsiz** ve rol/şirket `F-022`'yi bekliyor.
**Gerçek uca karşı denenmedi:** OAuth, Turnstile, içe aktarma, cover letter,
bayat sözcükleme, hesap silme.

**Test:** 643 birim · 51 e2e · **bundle** profil 252.5 / üretim 220.3 /
geçmiş 213.8 / onboarding 217.3 / ayarlar 229.8 KB (dinamik rotalar elle).

## Açık kararlar (ikisini de ilgilendirir)

| Soru | Bekleyen taraf |
|---|---|
| Hesabın profili varken anonim çalışma birleşecek mi | **ürün** · bugün `kept_existing` |
| Hangi LLM modeli — fiyat tablosu ona bağlı | **ürün** |

## Sonraki senkronizasyon noktası

**Sıra backend'de: `F-022` ve `F-023`.** `F-022` `B-066`'nın sorusuna cevap —
seçenek **(b)**, satır rol ve şirketle etiketlensin, ve mutlak kural 4'ün
sınırı § 57'de açıkça çizilsin. `F-023` `ImportWarning.code`'un düz `string`
olarak yayımlanmasını sorun ediyor: kapalı sözlük yayımlanmadan altı uyarı
mesajı yazılamaz. İkisi de **duran bir ekranın eksiğini** tarif ediyor, hiçbir
şeyi bloke etmiyor. **Yayın öncesi açık:** gizlilik politikasının sağlayıcı
listesi, model seçimini bekliyor.
