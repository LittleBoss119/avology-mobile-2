# Design Token v1 — Pemetaan LAMA → BARU

Acuan migrasi untuk P-2 dst. Layer `tokens` ditambahkan **aditif** di
[src/constants/theme.ts](../../src/constants/theme.ts) (P-1); ekspor lama
(`colors`, `spacing`, `radius`, `typography`, `shadows`, `statusColors`, `theme`)
**masih utuh** dan belum ada layar yang dimigrasi.

> ⚠️ **Satu-satunya perubahan warna yang disengaja**: warna **panen (harvest)**
> `#FFF4D6`/`#8A5B00` → `#FDEBD9`/`#9A4C0A`. Semua pemetaan lain menjaga hue
> (atau ditandai "belum dipetakan"). Jangan menimbulkan perubahan warna lain
> secara diam-diam saat migrasi.

---

## 1. Hex liar (25 dari audit) → token baru

| Hex lama | # | Peran sekarang | Token baru | Nilai baru | Catatan |
|---|---|---|---|---|---|
| `#1E2A24` | 27 | teks judul header, shadow menu, basis overlay | `color.text.primary` | `#17231B` | rogue near-black → teks kanonik; utk overlay lihat `color.overlay.scrim/scrimLight` |
| `#FFFFFF` | 19 | surface/kartu; teks & ikon di atas brand | `color.surface.card` | `#FFFFFF` | sama nilai; di atas brand pakai `color.brand.on` / `color.text.onBrand` |
| `#F7FAF3` | 10 | latar layar | `color.surface.canvas` | `#F7FAF3` | sama |
| `#DDEFE2` | 10 | teks sekunder di atas hero brand (beranda/kartu hijau) | `color.text.onBrandMuted` | `#DDEFE2` | nilai sama |
| `#065F2E` | 9 | hijau utama | `color.brand.base` | `#065F2E` | sama |
| `#DCE7D5` | 7 | border kartu/menu detail-pohon | `color.line.card` | `#DDE8D8` | penyeragaman border |
| `#68746D` | 6 | teks muted | `color.text.secondary` | `#5B6B60` | — |
| `#F6D77A` | 4 | accent pohon non-sehat + angka "warning" di hero | **belum dipetakan** | — | accent + metric hero; diputuskan saat layar terkait |
| `#B8D8BF` | 4 | accent visual pohon (border/haze sehat) | **belum dipetakan** | — | accent pohon |
| `#FFF4D6` | 2 | **panen** bg | `color.record.harvest.bg` | `#FDEBD9` | 🔸 **BERUBAH** (disengaja) |
| `#FCEFC7` | 2 | kondisi bg | `color.record.condition.bg` | `#FCEFC7` | sama |
| `#E7F6EC` | 2 | (salah ketik) brand soft | `color.brand.soft` | `#E7F5EC` | koreksi F6→F5 |
| `#E7EEF8` | 2 | perawatan bg | `color.record.care.bg` | `#E7EEF8` | sama |
| `#A6D96A` | 2 | angka "success" hero + accent | **belum dipetakan** | — | accent/metric hero |
| `#8A5B00` | 2 | **panen** text | `color.record.harvest.text` | `#9A4C0A` | 🔸 **BERUBAH** (disengaja) |
| `#7A5600` | 2 | kondisi text | `color.record.condition.text` | `#7A5600` | sama |
| `#184E91` | 2 | perawatan text | `color.record.care.text` | `#184E91` | sama |
| `#FFF8E8` | 1 | accent pohon non-sehat bg | **belum dipetakan** | — | accent pohon |
| `#FDA29B` | 1 | angka "danger" hero + accent | **belum dipetakan** | — | accent/metric hero |
| `#DDE4DA` | 1 | border | `color.line.card` | `#DDE8D8` | penyeragaman border |
| `#DCEFE3` | 1 | accent pohon sehat bg | **belum dipetakan** | — | accent pohon |
| `#C49A25` | 1 | accent pohon (fruit non-sehat) | **belum dipetakan** | — | accent pohon |
| `#94A098` | 1 | teks muted terang | `color.text.tertiary` | `#8A978D` | — |
| `#8A9A31` | 1 | accent pohon (leaf non-sehat) | **belum dipetakan** | — | accent pohon |
| `#5C8A45` | 1 | accent pohon (fruit sehat) | **belum dipetakan** | — | accent pohon |

**Accent visual pohon (belum dipetakan, diputuskan saat layar terkait):**
`#DCEFE3 #B8D8BF #5C8A45 #FFF8E8 #C49A25 #8A9A31 #A6D96A #FDA29B` (+ `#F6D77A`,
angka/warning hero).

**Border record adalah tambahan baru** (bukan pengganti hex lama tertentu): dot/
chip riwayat lama tak punya border eksplisit. Nilai baru:
`record.condition.border #EBD9A0`, `record.phase.border #B7DFC0`,
`record.harvest.border #F2C69B`, `record.care.border #C2D4EC`.

---

## 2. Token warna LAMA (`colors.*`) → BARU (`tokens.color.*`)

| `colors.*` lama | Hex | `tokens.color.*` baru |
|---|---|---|
| `primary` / `primaryGreen` | `#065F2E` | `brand.base` |
| `primaryDark` / `primaryGreenDark` | `#044722` | `brand.dark` |
| `primarySoft` / `primaryGreenSoft` / `surfaceGreen` | `#E7F5EC` | `brand.soft` |
| `primaryBorder` | `#B7DFC0` | `brand.border` |
| `text` / `textPrimary` | `#17231B` | `text.primary` |
| `textSecondary` | `#5B6B60` | `text.secondary` |
| `textMuted` / `textSoft` | `#8A978D` | `text.tertiary` |
| `textMutedLegacy` | `#647067` | `text.secondary` (legacy → sekunder) |
| `bg` / `background` | `#F7FAF3` | `surface.canvas` |
| `surface` / `white` | `#FFFFFF` | `surface.card` (/ `brand.on`) |
| `surfaceMuted` / `surfaceSoft` | `#F1F6EA` | `surface.subtle` |
| `border` | `#DDE8D8` | `line.card` |
| `divider` | `#E7EEE3` | `line.hairline` |
| `statusColors.{success,warning,danger,info,neutral}` | — | `color.status.{...}` (nilai sama) |
| `pending*` | — | **belum dipetakan** (tak ada di `status` baru; diputuskan saat layar) |
| `photoPlaceholder` `#EAF0E6`, `black` `#000000` | — | **belum dipetakan** |

---

## 3. Tipografi LAMA (`typography.*`) → BARU (`tokens.type.*`)

Aturan berat huruf: **`fontWeight` 800 & 900 turun ke `700`**; untuk
`subheading` & `bodyStrong` turun ke `600`. (Literal `'800'`/`'900'` yang
tersebar di layar juga mengikuti aturan ini saat migrasi.)

| Lama | size/wt/lh | Baru | size/wt/lh | Catatan |
|---|---|---|---|---|
| `display` | 32/800/38 | `type.display` | 32/**700**/38 | wt 800→700 |
| `title` | 30/800/36 | `type.display` | 32/**700**/38 | size 30→32, wt 800→700 |
| `h1` | 28/800/34 | `type.title` | 24/**700**/30 | size 28→24, wt 800→700 |
| `h2` | 22/800/28 | `type.heading` | 20/**700**/26 | size 22→20, wt 800→700 |
| `h3` | 18/700/24 | `type.subheading` | 17/**600**/23 | size 18→17, wt 700→600 |
| `screenTitle` | 20/700/26 | `type.heading` | 20/700/26 | sama |
| `sectionTitle` | 17/700/23 | `type.subheading` | 17/**600**/23 | wt 700→600 |
| `body` | 16/400/22 | `type.body` | 16/400/22 | sama |
| `bodyStrong` | 16/700/22 | `type.bodyStrong` | 16/**600**/22 | wt 700→600 |
| `small` | 14/400/20 | `type.bodySmall` | 14/400/20 | sama (bukan perubahan weight) |
| `meta` | 13/400/18 | `type.meta` | 13/400/18 | sama |
| `caption` | 12/600/16 | `type.caption` | 12/600/16 | sama |
| `badge` | 12/700/16 | `type.caption` | 12/**600**/16 | wt 700→600 |
| `navLabel` | 11/600/14 | **belum dipetakan** | — | nav 11px; skala baru minimal 12; diputuskan saat rombak navigasi |
| *(baru)* | — | `type.label` | 14/500/20 | label form & label metrik; **bukan** teks sekunder biasa (itu `type.bodySmall`) |

---

## 4. Radius LAMA → BARU

| Lama | Nilai | Baru | Nilai | Catatan |
|---|---|---|---|---|
| `sm` | 8 | `radius.control` | 14 | naik (skala baru tak punya 8) |
| `md` | 12 | `radius.control` | 14 | 12→14 |
| `input` / `button` | 14 | `radius.control` | 14 | sama |
| `lg` / `imageCard` | 16 | `radius.cardInner` | 16 | sama |
| `screenCard` | 18 | `radius.card` | 20 | 18→20 |
| `xl` | 20 | `radius.card` | 20 | sama |
| `2xl` | 24 | `radius.card` | 20 | 24→20 |
| *(literal sheet)* | 28 | `radius.sheet` | 28 | sama |
| *(literal sheet)* | 30 | `radius.sheet` | 28 | 30→28 |
| `round` / `chip` | 999 | `radius.pill` | 999 | sama |

---

## 5. Spacing / layout LAMA → BARU

| Lama | Nilai | Baru | Nilai | Catatan |
|---|---|---|---|---|
| `spacing.xs…4xl` | 4/8/12/16/20/24/32/40 | `space.xs…xxxxl` | idem | grid-4, sama |
| `spacing.screenHorizontal` | 16 | `layout.screenX` | 16 | sama |
| *(paddingTop layar)* | 20 | `layout.screenTop` | 20 | formalisasi |
| `spacing.sectionGap` | **18** | `layout.sectionGap` | **24** | 🔸 18→24 |
| `spacing.cardPadding` | 16 | `layout.cardPadding` | 16 | sama |
| `spacing.listGap` | 12 | `layout.listGap` | 12 | sama |
| `spacing.buttonHeight` | **52** | `layout.controlHeight` | **56** | 🔸 52→56 |
| *(tak ada)* | — | `layout.rowMinHeight` | 48 | **baru** |
| *(tak ada)* | — | `layout.tapTarget` | 44 | **baru** (a11y target) |

Ikon: `tokens.icon` skala **xs14 / sm16 / md20 / lg24** (+ `stroke` 2). `xs:14`
ditambahkan di P-2b-1 untuk `CompactMetaItem` (24 pemakai, nol perubahan layout)
+ caret chevron di chip filter; sm16/md20/lg24 memformalkan ukuran SVG yang
tersebar (18/20) + stroke 2 dari [icons.tsx](../../src/components/icons.tsx).
Elevation: `tokens.elevation.overlay` menggantikan shadow literal menu detail-pohon
(shadowColor `#1E2A24`→`#17231B`, radius 14→16, elevation 5→6).

> **Pengecualian:** label bottom navigation tetap 11px, di luar skala `type`
> (minimum 12). Alasan: lima tab, label 'Beranda'/'Laporan' berisiko terpotong
> di layar sempit. Keputusan sadar, bukan token yang terlewat.

---

## 6. Token LAMA yang direncanakan DIHAPUS (commit pembersih akhir Polish)

Setelah **semua** layar migrasi ke `tokens`, seluruh ekspor lama menjadi kandidat
hapus. Yang paling jelas redundan / bikin ambigu sumber kebenaran:

- **Alias warna duplikat:** `primaryGreen`, `primaryGreenDark`, `primaryGreenSoft`
  (dup `primary*`), `background` (dup `bg`), `surfaceSoft` (dup `surfaceMuted`),
  `surfaceGreen` (dup `primarySoft`), `textPrimary` (dup `text`), `textSoft`
  (dup `textMuted`), `textMutedLegacy`.
- **Typography padat** yang melebur ke skala baru: `title`, `h1`, `h2`, `h3`,
  `screenTitle`, `sectionTitle`, `small`, `badge`, `navLabel`.
- **Radius padat:** `sm`, `md`, `2xl`, `screenCard`, `input`, `button`, `imageCard`,
  `chip` (lebur ke `control`/`cardInner`/`card`/`pill`).
- **Agregat lama:** `theme`, `statusColors` (→ `tokens.color.status`),
  `shadows` (→ `tokens.elevation`), `type StatusTone` (tinjau ulang).

Penghapusan menyusul hanya setelah grep membuktikan nol pemakai tersisa untuk
tiap simbol; tidak dilakukan di P-1.
