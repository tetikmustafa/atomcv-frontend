# AtomCV — Durum Panosu

> İki repo da bu dosyayı okur ve kendi satırlarını günceller. **Kural: 60 satırı geçmez.**
> Ayrıntılı inşa kayıtları repo-yerel `notes/current.md`'dedir, buraya taşınmaz.

**2026-08-29** · **Frontend Aşama 3 — dilim 0, 1, 2 (giriş) ve 3a (yükleme) indi**
· frontend'de açık: **altı madde** (`B-052`, `B-056`–`B-059`, `B-061`)

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
| Aşama 3 — **dilim 0 · 1 · 2 · 3a** ✅ · 3b gözden geçirme `F-018`'i bekliyor | ⏳ |

**Dilim 0** `gen:api` + CSRF + katalog · **dilim 1** oturum, yetenek kapısı,
kayan TTL · **dilim 2** giriş: `/login`, `/verify`, `/auth/complete`,
`/auth/error`, Turnstile, `Retry-After`'dan kurulan 429, çıkış düğmesi ·
**dilim 3a** CV yükleme: multipart, beş senkron ret, `409` + iki resolution,
§ 31.6'nın **atlanamaz** geçidi. On iki madde `ACK`; sırada **dilim 4**
(`B-056`). **OAuth, Turnstile ve içe aktarma gerçek uca karşı denenmedi.**

**Test:** 576 birim · 42 e2e · **bundle** profil 251.7 / üretim 215.9 /
onboarding 217.0 KB (dinamik rotalar betiğin dışında — elle 210-252 KB).

## Açık kararlar (ikisini de ilgilendirir)

| Soru | Bekleyen taraf |
|---|---|
| Hesabın profili varken anonim çalışma birleşecek mi | **ürün** · bugün `kept_existing` |
| Hangi LLM modeli — fiyat tablosu ona bağlı | **ürün** |

## Sonraki senkronizasyon noktası

**Frontend kalan altı maddeyi dilim dilim kapatıyor**; backend'in MVP payı
bitti. **`B-059` yayın öncesi zorunlu** ve kapanış diliminde. Backend'den
beklenen iki madde: **`F-017`** (katalog tablosu) ve **`F-018`** — ikincisi
§ 31.6'nın gözden geçirme ekranının yarısını bloke ediyor, çünkü hangi
bölümün sorunlu olduğunu söyleyen bir alan telde yok.
