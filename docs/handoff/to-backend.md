# → Backend

> **Kanal kuralları**
> - Frontend yazar, backend okur ve `OPEN` → `ACK` taşır.
> - Her madde bir ID taşır (`F-nnn`), numaralar tekrar kullanılmaz.
> - **Dosya 100 satırı geçerse arşivleme gecikmiştir.**
> - Bir spec değişikliği gerekiyorsa burada iste — `spec/`'i frontend reposunda düzenleme,
>   bir sonraki senkronda kaybolur.

---

## OPEN

### F-016 · "Okunamadı" derken params'ın %95 güven yazması
**Since:** frontend commit `1373586` · `local-real`, gerçek ilanlarla
**Neden:** Sıradan bir React ilanı **422 `UNPARSEABLE_JOB_DESCRIPTION`** ile
reddedildi, ama parametreleri reddi yalanlıyordu:

```
params: { confidence: 0.95, skillsFound: 8 }
```

`PlausibilityGate`'in **dört** verdict'i tek hata koduna düşüyor ve `params`
yalnız ilk ikisinin ölçtüğünü taşıyor:

```
LOW_CONFIDENCE       confidence anlatıyor      ✓
TOO_FEW_SKILLS       skillsFound anlatıyor     ✓
NO_RESPONSIBILITIES  params sessiz             ✗
SUSPICIOUS_OUTPUT    params sessiz             ✗
```

Bu vakayı **daralttık**: aynı ilanın gereksinimleri kısa beceri adlarına
bölünmüş hâli sorunsuz geçti. Yani reddeden `SUSPICIOUS_OUTPUT`'tu — modelin
çıkardığı bir alan `MAX_SKILL_NAME`'i (60) aşmıştı; muhtemelen
`"Accessibility: WCAG 2.2 AA, screen reader testing, keyboard interaction"`
tek beceri adı olarak çıkarıldı.

Ekranda çıkan cümle şu oluyor: *"ilanı okuyamadık — güven %95, 8 beceri
bulundu."* Kullanıcı yapıştırdığı metnin tamamen normal olduğunu biliyor.

Not: `SUSPICIOUS_OUTPUT`'un kendi yorumu bunu zaten ayırıyor — *"the first
three say the posting was thin, this one says the answer is not shaped like
an analysis at all."* İki farklı şey, tek kod ve tek cümle.

**İstenen:** biri, sizin tercihiniz:
1. `SUSPICIOUS_OUTPUT` kendi koduna ayrılsın — kullanıcının ilanı değil,
   modelin cevabı sorunlu; doğru çözüm **yeniden denemek** olabilir, ve
   `retry` resolution'ı bugün bu 422'de yok.
2. `params` verdict'i taşısın (kapalı sözlük), ve `errors.*` anahtarını ona
   göre çözelim — dört sebebe dört cümle.

Uzun alanı **kırpmak** üçüncü bir yol ama sessizce yanlış: § 18.4'ün tavanı
enjeksiyona karşı, ve kırpılmış bir beceri adı uygunluk raporuna girer.

<!-- Şablon:
### F-001 · Kısa başlık
**Since:** frontend commit <sha> · Adım <n>
**Neden:** <sorunun ne olduğu>
**İstenen:** <backend'den beklenen somut şey>
**Spec:** <ilgili dosya ve bölüm, varsa>
-->

---

## ACK — backend tamamladı, frontend arşivleyebilir

### F-013 · Tek CV iki dil taşıyor — kapandı, üçüncü bir yolla
İkisinden birini değil, ortasını seçtik: **bir belge tek dilde yazılır ve o dil
profilin taşıdığından seçilir.** `auto`, ilanın diline yalnızca profil o dilde
gerçekten yazılabiliyorsa çözülüyor — sayfaya çıkabilecek her atomun hedef
dilde varyantı varsa. Yoksa `sourceLanguage`'de kalıyor, ve tarih ile "Halen"
tek bir `contentLanguage` okuduğu için ayrışamıyorlar.

2. seçeneğiniz § 21.8'in **çalışan** yarısını kapatırdı (tüm atomları çevrilmiş
bir profil bugün gerçek bir İngilizce CV alıyor, maliyeti sıfır); 1. seçeneğiniz
tarihi düzeltir, atom atom geri düşen gövdeyi düzeltmezdi.

İstediğiniz sinyal telde: `contentLanguage` ve `postingLanguage`.
**Aksiyonunuz var — `B-042`.**

### F-014 · Sessiz sağlayıcı hataları — kapandı
Adaptörden çıkışın **tek** yolu var ve WARN'ı orada basıyor: `promptRef`,
`kind`, `detail`. Dört yolun dördü de kapsandı, ve iki mükerrer satır düştü —
bir başarısızlık artık tam olarak bir satır. Gövde ve prompt asla
(mutlak kural 4); teşhisi zincirin yan etkilerinden çıkarmanız gerekmeyecek.
§ 27.2'ye yazıldı.

### F-015 · Fiyat tablosundaki ölü model — kapandı
Haklıydınız, ve alıntıladığınız cümle sonucu tam olarak söylüyordu. Tablo artık
kullanılan modeli kapsıyor; **ücretsiz model açıkça sıfır** yazılıyor, çünkü
rakam aynı olsa da iddia değil — biri "sağlayıcı ücret almıyor" der, öteki
"bilmiyoruz". Asıl eklenen `LlmPricingAudit`: `ApplicationReadyEvent`'te
tabloyu `atomcv.llm.models` ile karşılaştırıyor ve fiyatı olmayan her modeli
adıyla WARN'lıyor. § 27.4'e yazıldı.

*(`F-001`…`F-012` `resolved/to-backend-2026-08.md`'de)*
