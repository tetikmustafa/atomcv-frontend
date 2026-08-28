# AtomCV — Durum Panosu

> İki repo da bu dosyayı okur ve kendi satırlarını günceller. **Kural: 60 satırı geçmez.**
> Ayrıntılı inşa kayıtları repo-yerel `notes/current.md`'dedir, buraya taşınmaz.

**2026-08-29** · **Frontend Aşama 3 — dilim 0 (temel) ve dilim 1 (oturum) indi**
· frontend'de açık: **on üç madde** (`B-048`–`B-054`, `B-056`–`B-061`)

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
| Aşama 3 — **dilim 0 temel** ✅ · **dilim 1 oturum** ✅ · dilim 2 giriş ⏳ | ⏳ |

**Dilim 0:** `gen:api` (Aşama 3'ün tamamı telde), CSRF çift-gönderim (`B-044`),
dokuz hata kodu + iki resolution katalogda (`B-045`), `REWRITING` (`B-055`),
`B-047` incelemeyle. **Dilim 1:** `/auth/session` + `/auth/logout`, iki yetenek
kümesi, `canEditAtomControls` kapısı ve kayan TTL bildirimi (`B-046`). **Beşi
de `ACK`**, `resolved/`'a taşındı. Çıkış **düğmesi** dilim 2'de — bugün kimse
giriş yapamıyor. **Sırada dilim 2:** `B-048`-`B-050`, `B-054`.
**Size bir madde: `F-017`** — `COVER_LETTER_REJECTED` EK D.6'nın kod tablosunda
yok, ve `issues` sözlüğü kapalı mı?

**Test:** 464 birim · 26 e2e · **bundle** profil 251.2 / üretim 215.6 KB.

## Açık kararlar (ikisini de ilgilendirir)

| Soru | Bekleyen taraf |
|---|---|
| Hesabın profili varken anonim çalışma birleşecek mi | **ürün** · bugün `kept_existing` |
| Hangi LLM modeli — fiyat tablosu ona bağlı | **ürün** |

## Sonraki senkronizasyon noktası

**Frontend kalan on dört maddeyi dilim dilim kapatıyor**; backend'in MVP payı
bitti, sırada 3.7 profil editörü ve bu maddeler bizde. **`B-059` yayın öncesi
zorunlu** (gizlilik politikası, alt işleyen listesi) ve kapanış diliminde.
Backend'den beklenen tek şey **`F-017`**.
