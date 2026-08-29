# AtomCV — Durum Panosu

> İki repo da bu dosyayı okur ve kendi satırlarını günceller. **Kural: 60 satırı geçmez.**
> Ayrıntılı inşa kayıtları repo-yerel `notes/current.md`'dedir, buraya taşınmaz.

**2026-08-29** · **Backend'in altı maddesinin beşi frontend'de kapandı** ·
açık `B-nnn`: **`B-066`** (geçmiş ekranı) · açık `F-nnn`: **`F-022`**, **`F-023`**

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
| Aşama 3 — **bütün dilimler** ✅ · yalnız geçmiş ekranı `F-022`'yi bekliyor | ⏳ |

Dokuz dilim (dökümü kendi `notes/`'larında). **Açık kalan tek madde `B-066`;**
§ 31.6'nın gözden geçirme ekranı `B-067` ile tamamlandı — sorunlu bölümler
otomatik açık, Onayla hep aktif. **Gerçek uca karşı denenmedi:** OAuth,
Turnstile, içe aktarma, cover letter, bayat sözcükleme, hesap silme.

**Test:** 633 birim · 48 e2e · **bundle** profil 252.3 / üretim 219.5 /
onboarding 217.1 / ayarlar 228.5 KB (dinamik rotalar elle, 210-253 KB).

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
mesajı yazılamaz. **Geçmiş ekranı `F-022`'nin cevabından sonra kurulacak** —
satır bugün kurulsa etiketsiz kurulurdu. **Yayın öncesi açık:** gizlilik
politikasının sağlayıcı listesi, model seçimini bekliyor.
