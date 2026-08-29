# AtomCV — Durum Panosu

> İki repo da bu dosyayı okur ve kendi satırlarını günceller. **Kural: 60 satırı geçmez.**
> Ayrıntılı inşa kayıtları repo-yerel `notes/current.md`'dedir, buraya taşınmaz.

**2026-08-29** · **Frontend Aşama 3 — dilim 0, 1 ve 2 (giriş) indi**
· frontend'de açık: **dokuz madde** (`B-051`–`B-053`, `B-056`–`B-061`)

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
| Aşama 3 — **dilim 0 · 1 · 2** ✅ · dilim 3 CV yükleme ⏳ | ⏳ |

**Dilim 0** `gen:api` + CSRF + katalog · **dilim 1** oturum, yetenek kapısı,
kayan TTL · **dilim 2** giriş: `/login`, `/verify`, `/auth/complete`,
`/auth/error`, Turnstile, `Retry-After`'dan kurulan 429, çıkış düğmesi.
Dokuz madde `ACK` (`B-044`-`B-050`, `B-054`, `B-055`). **Sırada dilim 3:**
`B-051`, `B-053`, `B-060`. **OAuth ve Turnstile gerçek uca karşı denenmedi.**
**Size bir madde: `F-017`** — `COVER_LETTER_REJECTED` EK D.6'nın kod tablosunda
yok, ve `issues` sözlüğü kapalı mı?

**Test:** 534 birim · 37 e2e · **bundle** profil 251.3 / üretim 215.7 KB
(auth rotaları dinamik, bütçe betiği ölçmüyor — elle 206-213 KB).

## Açık kararlar (ikisini de ilgilendirir)

| Soru | Bekleyen taraf |
|---|---|
| Hesabın profili varken anonim çalışma birleşecek mi | **ürün** · bugün `kept_existing` |
| Hangi LLM modeli — fiyat tablosu ona bağlı | **ürün** |

## Sonraki senkronizasyon noktası

**Frontend kalan dokuz maddeyi dilim dilim kapatıyor**; backend'in MVP payı
bitti, sırada 3.7 profil editörü ve bu maddeler bizde. **`B-059` yayın öncesi
zorunlu** (gizlilik politikası, alt işleyen listesi) ve kapanış diliminde.
Backend'den beklenen tek şey **`F-017`**.
