# AtomCV — Durum Panosu

> İki repo da bu dosyayı okur ve kendi satırlarını günceller. **Kural: 60 satırı geçmez.**
> Ayrıntılı inşa kayıtları repo-yerel `notes/current.md`'dedir, buraya taşınmaz.

**2026-08-29** · **Frontend Aşama 3 — dilim 0-6 indi** · açık: **iki madde**

---

## Backend — `atomcv-backend`

| Aşama / Adım | Durum |
|---|---|
| Aşama 0 · 1 · 2 — iskelet, yürüyen iskelet, ilana özel üretim | ✅ |
| Aşama 3 — hesap ve MVP · 3.1 hesaplar ✅ · **3.2 e-posta domain ✅** | ✅ |
| 3.3 kimlik · 3.4 çıkarım · 3.5 çok dillilik · 3.6 anonim · 3.8 Faz D · 3.9 hukuki | ✅ |
| 3.7 profil editörü **frontend'de** | ⏳ |

**Kapanış denetimi (0-3): sekiz dilimin sekizi de indi**, kaydı
`notes/kapanis-denetimi.md`'de. **Açık kod maddesi kalmadı;** sonuncusu atomsuz
entry (2026-08-28, § 20.2), frontend'e düşeni `B-061`.

**Geliştiricide:** yeni model seçilince fiyat tablosu (o güne kadar bütçe freni
çalışmaz), VPS kurulumu (§ XI-A.4) ve **restore testi**.

**Test:** 1043 birim · 427 entegrasyon · latex 49/49 — 0 hata

## Frontend — `atomcv-frontend`

| Aşama / Adım | Durum |
|---|---|
| Aşama 0 — İskelet · 1 — Profil editörü · 2 — Üretim akışı + SSE | ✅ |
| Aşama 3 — **bütün dilimler** ✅ · yalnız § 31.6'nın yarısı `F-018`'i bekliyor | ⏳ |

**Dilim 0** `gen:api` + CSRF + katalog · **1** oturum, yetenek kapısı, kayan
TTL · **2** giriş (`/login`, `/verify`, `/auth/*`, Turnstile, `Retry-After`,
çıkış) · **3a** CV yükleme (multipart, beş senkron ret, `409`, § 31.6'nın
**atlanamaz** geçidi) · **4** cover letter · **5** bayat sözcükleme · **6**
maddesiz entry · **7** geri bildirim, hesap silme, gizlilik politikası.
**On sekiz maddenin on sekizi `ACK`.** **Gerçek uca karşı denenmedi:** OAuth,
Turnstile, içe aktarma, cover letter, bayat sözcükleme, hesap silme.

**Test:** 607 birim · 47 e2e · **bundle** profil 252.3 / üretim 219.5 /
onboarding 217.1 / ayarlar 228.5 KB (dinamik rotalar elle, 210-253 KB).

## Açık kararlar (ikisini de ilgilendirir)

| Soru | Bekleyen taraf |
|---|---|
| Hesabın profili varken anonim çalışma birleşecek mi | **ürün** · bugün `kept_existing` |
| Hangi LLM modeli — fiyat tablosu ona bağlı | **ürün** |

## Sonraki senkronizasyon noktası

**Frontend'de açık `B-nnn` kalmadı**; sıra **beş `F-nnn` cevabında**
(`F-017`-`F-021`). Aciliyet: `F-018` § 31.6'nın yarısını bloke ediyor,
`F-020` `canSaveHistory`'yi karşılıksız bırakıyor. **Yayın öncesi hâlâ
açık:** gizlilik politikasının sağlayıcı listesi, model seçimini bekliyor.
