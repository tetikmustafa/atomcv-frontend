# Doc sync request — frontend → backend repo

Hand-off artifact. `docs/` is a read-only copy here, so everything below has to
be applied in `atomcv-backend` and re-synced. Delete this file once it has been.

Same pattern as the contract gaps: raised here, folded into EK D there, copy
deleted.

---

## 1. Frontend Stage 0 is complete — nothing records it

**EK D.7 is the progress record and has no frontend rows.** It tracks backend
steps only, with a "Frontend'e etkisi" column. So the state of the frontend is
written down nowhere in the specification, even though D.7 says it is the one
address the frontend should read.

Bölüm 55's `[F] Frontend iskeleti` list is satisfied in full:

| Bölüm 55 item                    | State                                               |
| -------------------------------- | --------------------------------------------------- |
| Next.js + Tailwind + shadcn/ui   | ✅ Next 16, Tailwind v4, shadcn on Radix            |
| Klasör yapısı (XI-B.3)           | ✅ with the deviations in section 3 below           |
| i18n iskeleti (next-intl, en+tr) | ✅ ICU, locale routing, `proxy.ts` redirects        |
| MSW mock altyapısı               | ✅ one handler set for dev, Vitest and Playwright   |
| CLAUDE.md                        | ✅                                                  |
| CI build + test, gitleaks        | ✅ both green on `main`                             |
| CD pipeline                      | correctly deferred — Bölüm 55 now says post-Stage 1 |

Beyond that list, also shipped: the RFC 7807 error envelope and fetch client,
the app shell and accessibility baseline, landing and legal pages, 17 unit and
9 end-to-end tests, a per-route bundle budget, and a Docker image.

**Request: add frontend rows to D.7**, or a parallel table. Suggested shape:

| Adım | Durum | Üretilen | Backend'den beklenen |
| ---- | ----- | -------- | -------------------- |

The last column is the mirror of D.7's existing one and is what makes the
record useful in both directions.

---

## 2. Frontend build notes have no home — propose EK D.10

The backend records its build decisions in D.1-D.8. The frontend has an
equivalent set with nothing to append to. They currently live only in
`atomcv-frontend/CLAUDE.md`, which is not synced.

The ones with a documentation consequence:

| #   | Konu                                                         | Tür      | Karar                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Next.js sürümü (Bölüm 5.2 "15" diyor)                        | Sapma    | **16.** 15.x backport dalına geçti; oradan başlamak ilk gün migration borcu demekti. `next-intl` 16'yı destekliyor. Turbopack varsayılan bundler, öyle bırakıldı.                                                                                                                                                                                                                                                                              |
| 2   | `tailwind.config.ts` (XI-B.3 bekliyor)                       | Düzeltme | **Yok.** Tailwind v4 CSS-first; tema token'ları `src/styles/globals.css` içinde `@theme` ile.                                                                                                                                                                                                                                                                                                                                                  |
| 3   | `next.config.mjs` (XI-B.3)                                   | Düzeltme | **`next.config.ts`** — create-next-app tipli config üretiyor.                                                                                                                                                                                                                                                                                                                                                                                  |
| 4   | Locale yönlendirmesi                                         | Ekleme   | `src/proxy.ts`. Next 16'da `middleware.ts` **`proxy.ts` olarak yeniden adlandırıldı**. Matcher `/api`'yi dışlar: dışlamazsa her API çağrısı `/en/api/v1/...`'e yönlendirilip kırılır.                                                                                                                                                                                                                                                          |
| 5   | Client provider'ların yeri                                   | Ekleme   | Root layout'ta değil, **`[locale]/(app)/layout.tsx`** içinde. Landing ve legal hiçbir şey fetch etmiyor; app shell'in çektiği her kilobayt aksi halde ürünle ilk temasta ödeniyor (Bölüm 12). Ölçüldü: yalnız TanStack Query'yi taşımak 7 KB gzip kazandırdı.                                                                                                                                                                                  |
| 6   | `NextIntlClientProvider`                                     | Ekleme   | O da `(app)` içinde: **tüm mesaj kataloğunu HTML'e serialize ediyor**, root'ta her landing ziyaretçisine legal metnin tamamını gönderiyordu. Bedeli: next-intl'in `Link`'i ve `useTranslations` çağıran client bileşenler yalnız `(app)` altında çalışıyor; dışarıda düz `<a>` + açık `/${locale}` öneki.                                                                                                                                      |
| 7   | `setRequestLocale`                                           | Ekleme   | **Her sayfa ve layout'ta ayrı ayrı** çağrılmalı, yalnız parent layout'ta değil. Next layout ve page'i paralel render ediyor, parent'ın çağrısının önce koştuğu garanti değil; eksikse next-intl rotayı dinamik işaretliyor. Legal sayfalar bu yakalanana kadar on-demand render ediliyordu.                                                                                                                                                    |
| 8   | Typecheck                                                    | Ekleme   | `tsc` tek başına yetmiyor. `PageProps`/`LayoutProps` `.next/types`'a **üretiliyor**; `npm run typecheck` önce `next typegen` çalıştırıyor. Temiz checkout'ta düz `tsc` olmayan hatalar uyduruyor, olanları kaçırıyor.                                                                                                                                                                                                                          |
| 9   | MSW'nin üretime sızması                                      | Düzeltme | Bayrak `NODE_ENV`'e de bakmalı. `next build` `.env.local`'ı da okuyor, yani mock'u lokalde açık bırakan biri MSW runtime'ını kullanıcılara gönderiyor. **İki kez oldu:** ikincisinde dinamik `import()` guard'ın dışına, modül seviyesine taşınmıştı — bundler onu modül grafiğinde erişilebilir görüp chunk'ı korudu, hiçbir şey çağırmasa bile.                                                                                              |
| 10  | MSW worker başlatma                                          | Ekleme   | **Idempotent olmalı.** React Strict Mode effect'leri iki kez çalıştırıyor: ilk `start()` başarılı oluyor ama `setReady`'si cleanup'ta iptal ediliyor, ikincisi "cannot configure an already enabled network" ile patlıyor. Kapı hiç açılmıyor ve **tüm uygulama boş render ediliyordu.**                                                                                                                                                       |
| 11  | `[locale]/(app)/dev/mocks`                                   | Ekleme   | Dev-only doğrulama sayfası; üretim build'inde `notFound()` (Bölüm 51.5'in backend dev uçlarına uyguladığı kural). `(app)` altında başka rota olmadığı için shell, provider'lar ve worker başka türlü hiç mount olmuyordu.                                                                                                                                                                                                                      |
| 12  | SSE tüketimi (Bölüm 36.4)                                    | Ekleme   | **`EventSource` MSW'nin service worker'ı üzerinden gerçek tarayıcıda doğrulandı**, frame'ler tamponlanmadan tek tek geliyor. Bölüm 36.4 olduğu gibi geçerli, `fetch`+`ReadableStream` yedeğine gerek yok.                                                                                                                                                                                                                                      |
| 13  | Bundle bütçesi aracı (XI-B.3 `bundlesize` diyor)             | Sapma    | Ne `bundlesize` ne `size-limit`: ikisi de **isim verebildiğiniz dosyaları** ölçüyor, Next ise içerik-hash'li chunk'lar üretiyor ve hangi rotanın hangisini çektiğini söylemiyor. `scripts/check-bundle-size.mjs` prerender edilmiş her rotanın script etiketlerini okuyor.                                                                                                                                                                     |
| 14  | Bütçe eşiği (Bölüm 52.3 tek sayı veriyor)                    | Ekleme   | `bundle-budget.json`'da **üç sayı**: `sharedKb` (her rotanın ödediği taban, yalnız bağımlılık değişiminde oynar), `perRouteOwnKb` (özellik işinin kontrol ettiği pay), `totalKb` (52.3'ün tavanı). Tek eşik kötü bir tel kapan: taban bütçenin çoğunu yiyor, alarm sıradan işte ötüyor, yükseltiliyor, sonra kimse inanmıyor.                                                                                                                  |
| 15  | npm sürümü                                                   | Ekleme   | **npm 11 zorunlu**, CI'da ve Dockerfile'da sabitli. Lock dosyası opsiyonel native paketleri npm 11'in çözdüğü şekilde kaydediyor; `node:22`'nin getirdiği npm 10 aynı dosyayı eksik okuyup `npm ci`'ı düşürüyor. Windows'ta `npm ci` her iki durumda da geçtiği için yalnız Linux'ta görünüyor.                                                                                                                                                |
| 16  | `exactOptionalPropertyTypes`                                 | Sapma    | **Kapalı.** Her opsiyonel React prop'una sürtünme ekliyor, karşılığında tek gerçek tehlikeyi kapatıyor — o da merge-patch katmanında. Onun yerine `buildPatch()`: `undefined` anahtarları atıyor, geriye bir şey kalmazsa `null` dönüp çağıranı isteği atlamaya zorluyor. Boş bir merge-patch başarılı oluyor, hiçbir şeyi değiştirmiyor ve kaydetme göstergesini yine "saved"a çeviriyor (Bölüm 37.3) — editörün kullanıcıya yalan söylemesi. |
| 17  | e2e ortamı                                                   | Ekleme   | Playwright **`next dev`'e** karşı koşuyor, 3100 portunda. MSW üretim build'inde tasarım gereği kapalı, yani backend var olana kadar üretim build'inin hiç API'si yok. Ayrı port, 3000'de asılı kalmış bir sunucunun test edilenle karışmasını engelliyor — bir kez yanlış ölçüme yol açtı.                                                                                                                                                     |
| 18  | shadcn primitive tabanı                                      | Ekleme   | **Radix açıkça sabitlendi** (`--base radix`). shadcn CLI'ın varsayılanı artık Base UI; Bölüm 5.2 ve 39.1 Radix diyor ve erişilebilirlik gerekçesi ona dayanıyor.                                                                                                                                                                                                                                                                               |
| 19  | Legal sayfaların yeri (XI-B.3 `[locale]` dışında gösteriyor) | Düzeltme | **`[locale]` altında.** Segment dışında çevrilemiyorlar; Türk kullanıcının okuyamadığı bir gizlilik politikası gizlilik politikası değil.                                                                                                                                                                                                                                                                                                      |
| 20  | `src/app/api/` (XI-B.3 ve Bölüm 36.1 gösteriyor)             | Düzeltme | **Oluşturulmadı ve oluşturulmamalı.** Lokalde aynı-origin görüntüsü `next.config.ts` rewrite'ıyla korunuyor; rewrite bizim kodumuzu çalıştırmadığı için "iş mantığı yok" kuralını ihlal etmiyor.                                                                                                                                                                                                                                               |

---

## 3. XI-B.3 (frontend klasör yapısı) güncel değil

Var olan ama listede olmayanlar:

```
src/proxy.ts                          locale yönlendirmesi (Next 16)
src/lib/i18n/                         routing.ts, request.ts, navigation.ts, locales.ts
src/components/providers/             AppProviders.tsx, MockProvider.tsx
src/components/layout/                SkipLink, Announcer, AppShell, SiteFooter, LegalDocument
src/mocks/node.ts                     Vitest için aynı handler'lar
src/mocks/contracts.ts                SCAFFOLDING — gen:api çalışınca silinir
src/app/[locale]/(app)/dev/mocks/     dev-only doğrulama sayfası
scripts/check-bundle-size.mjs
bundle-budget.json
vitest.config.mts, tests/setup.ts
.dockerignore, .gitattributes
AGENTS.md                             next dev üretiyor, o yüzden commit'li
```

Listede olan ama olmayanlar / farklı olanlar:

```
next.config.mjs      → next.config.ts
tailwind.config.ts   → yok (Tailwind v4)
src/lib/utils/       → src/lib/utils.ts (shadcn o yolu bekliyor)
src/app/api/         → yok, olmayacak
legal/               → [locale]/legal/
deploy.yml           → Aşama 1 sonrasına ertelendi (Bölüm 55 artık aynısını diyor)
ci.yml yorumu        → "bundlesize" değil, kendi script'imiz
```

---

## 4. Karar bekleyen: 200 KB tavanı editörde tutmuyor

Bölüm 52.3'ün sayısı ve ölçüm:

|                                         | gzip                                |
| --------------------------------------- | ----------------------------------- |
| Paylaşılan taban (React + Next runtime) | **168.1 KB**                        |
| Pazarlama rotalarının kendi payı        | **0.0 KB** — hepsi server component |
| Bölüm 52.3 tavanı                       | 200 KB                              |
| Kalan                                   | ~30 KB                              |

dnd-kit + React Hook Form + Zod tek başına o mertebede, biz tek bileşen
yazmadan. İki yol var:

1. Editör rotasında agresif bölme — sürükle-bırak ve form makinesi
   navigasyonda değil, etkileşimde yüklensin. Tek sayı korunur.
2. Pazarlama ve uygulama rotalarına ayrı bütçe. **Bölüm 52.3 zaten LCP'de aynı
   ayrımı yapıyor** (landing 2.0s, editör 2.5s) ve gerekçe birebir taşınıyor:
   landing ilk temas ve anonim huninin en ince yeri, editöre ise kararlı bir
   kullanıcı bilinçli bir eylemle geliyor.

2 spesifikasyonun daha tutarlı okuması, ama dokümante edilmiş bir sayıyı
değiştirmek karar gerektiriyor. **Bölüm 52.3'te karara bağlanmalı.**

---

## 5. Küçük düzeltmeler

- **Bölüm 5.2** hâlâ "Next.js 15 (App Router)" diyor → 16, Turbopack varsayılan.
- **Bölüm 36.1** sayfa yapısı `legal/`'i `[locale]` dışında ve `api/`'yi
  gösteriyor; XI-B.3 ile aynı iki düzeltme gerekiyor.
- **D.9 · 7** "frontend reposundaki kopyalar da silinebilir" diyor —
  yapıldı, `BACKEND-CONTRACT-GAPS.md` silindi.
