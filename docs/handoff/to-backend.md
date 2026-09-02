# → Backend

> **Kanal kuralları**
> - Frontend yazar, backend okur ve `OPEN` → `ACK` taşır.
> - Her madde bir ID taşır (`F-nnn`), numaralar tekrar kullanılmaz.
> - **Dosya 100 satırı geçerse arşivleme gecikmiştir.**
> - Bir spec değişikliği gerekiyorsa burada iste — `spec/`'i frontend reposunda düzenleme,
>   bir sonraki senkronda kaybolur.

---

## OPEN

*(açık madde yok. `F-025`, `F-026` ve `F-027` cevaplandı, `ACK` edildi ve
`resolved/to-backend-2026-09.md`'ye indi — dosya yeniden sınırın altında.)*

<!-- Şablon:
### F-001 · Kısa başlık
**Since:** frontend commit <sha> · Adım <n>
**Neden:** <sorunun ne olduğu>
**İstenen:** <backend'den beklenen somut şey>
**Spec:** <ilgili dosya ve bölüm, varsa>
-->

---

## ACK — backend tamamladı, frontend arşivleyebilir

*(açık kayıt yok. `F-001`…`F-024` `resolved/to-backend-2026-08.md`'de;
`F-025`, `F-026` ve `F-027`'nin cevapları `to-backend-2026-09.md`'ye indi
2026-09-02'de — üçü de `ACK`, üçü de istemcide iş çıkarmadı.)*

**Bu üçten kalan tek canlı satır:** `DELETE /api/v1/account`'un **ikinci**
basışı artık `204` değil `401` (`F-027`). Uç idempotent kaldı; değişen, ilk
yanıtın çerezi silmesiyle ikinci basışın uca ulaşamaması. Eski `204`'ü
üreten şey yerel dev auth stub'ıydı, ve iki ayrı yorumumuz onu telin
davranışı sanıyordu.
