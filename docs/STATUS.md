# AtomCV — Durum Panosu

> İki repo da bu dosyayı okur ve kendi satırlarını günceller. **Kural: 60 satırı geçmez.**
> Ayrıntılı inşa kayıtları repo-yerel `notes/current.md`'dedir, buraya taşınmaz.

**Son güncelleme:** 2026-08-25 · **Aşama 2 iki repoda da tam kapandı**; açık madde yok

---

## Backend — `atomcv-backend`

| Aşama / Adım | Durum |
|---|---|
| Aşama 0 — İskelet | ✅ |
| Aşama 1 — Yürüyen iskelet (1.1-1.9) | ✅ |
| **Aşama 2 — İlana özel üretim** | ✅ kapanış listesi 8/8 |
| 2.1 hesaplar · 2.2 gateway · 2.3 Faz A · 2.4 embedding · 2.5 Faz B · 2.6 kuyruk+SSE | ✅ |
| 2.7 kota ve maliyet | ✅ (Axiom dataset'i 3.1'e taşındı) |

**Aşama 3 planı:** § XI-A.6. Aşama 2'nin kaydı `notes/archive/stage-2.md`'de.
**`F-009`…`F-012` kapandı** ve şemayı değiştirdiler — **`B-040` açık,
`gen:api` çalıştırılmalı**: `generalMode` düştü, ilerleme alanları opsiyonel
oldu, `usage` `attempted` kazandı. `B-037`…`B-039` arşivlendi.
**`F-008` de kapandı** — Faz F'nin uygunluk raporu indi (`B-041`):
`GET /generations/{id}`, `completed` olayında `matchLevel`, `GET /jobs/{id}`'de
`pageCount`. **`sync-spec.sh` çalıştırılmalı.**

**Aşama 1:** 9/9 ✅, `F-001`…`F-007` kapandı · **Test:** 593 birim · 250 entegrasyon · 48 latex

## Frontend — `atomcv-frontend`

| Aşama / Adım | Durum |
|---|---|
| Aşama 0 — İskelet | ✅ |
| Aşama 1 — Profil editörü | ✅ |
| Aşama 2 — Üretim akışı + SSE | ✅ |

**Açık `B-nnn` yok** — `B-040` ve `B-041` ACK'te. **Test:** 362 birim · 25 e2e ·
**bundle** profil 250.6 / üretim 214.8 KB.
**Aşama 2 tam kapandı:** üretim akışı, SSE, kota **ve uygunluk raporu**. Gerçek
uca karşı MSW kapalı iki tur (10 + 9 kontrol) geçti; üç gerçek hata buldular —
`Accept` → 406, dev proxy'nin SSE'yi gzip'lemesi, yeniden yüklemede sonucun
kaybolması. Notlar `notes/archive/stage-2.md`.

---

## Açık kararlar (ikisini de ilgilendirir)

| Soru | Bekleyen taraf |
|---|---|
| Üretimde migration nasıl çalışır | backend · Aşama 2 |
| Anonim akış kuyruğu kullanacak mı | backend · Aşama 3 |
| Atomsuz entry seçilemiyor | backend · Bölüm 20.2 modelini etkiler |

---

## Sonraki senkronizasyon noktası

**Yok.** Aşama 2 iki tarafta da kapandı; sıradaki temas Aşama 3'ün ilk ucu
(`/auth/session` ve `capabilities`).
