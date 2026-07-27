# Audit Faktual Kondisi Styling — Iterasi Polish

> Peta faktual styling saat ini sebelum penetapan design token. Semua klaim
> disertai path + baris. Read-only; tidak ada rekomendasi.
> Cakupan grep: file `*.tsx` di `src/` dan `app/` (mengecualikan `theme.ts` yang
> berekstensi `.ts`), kecuali disebut lain.

---

## A. Inventaris token yang sudah ada

Sumber tunggal: [`src/constants/theme.ts`](src/constants/theme.ts) (156 baris).
Diekspor sebagai objek terpisah (`colors`, `spacing`, `radius`, `typography`,
`shadows`, `statusColors`) + agregat `theme` (baris 147).

### A.1 Warna — `colors` (theme.ts:3–46)

| Token | Hex | Token | Hex |
|---|---|---|---|
| primaryGreen | `#065F2E` | primary | `#065F2E` |
| primaryGreenDark | `#044722` | primaryDark | `#044722` |
| primaryGreenSoft | `#E7F5EC` | primarySoft | `#E7F5EC` |
| background | `#F7FAF3` | bg | `#F7FAF3` |
| surfaceSoft | `#F1F6EA` | surface | `#FFFFFF` |
| textPrimary | `#17231B` | surfaceMuted | `#F1F6EA` |
| textSecondary | `#5B6B60` | surfaceGreen | `#E7F5EC` |
| textMuted | `#8A978D` | primaryBorder | `#B7DFC0` |
| text | `#17231B` | textSoft | `#8A978D` |
| border | `#DDE8D8` | divider | `#E7EEE3` |
| textMutedLegacy | `#647067` | photoPlaceholder | `#EAF0E6` |
| white | `#FFFFFF` | black | `#000000` |

Palet status (pasangan text/bg/border):

| Grup | text | bg | border |
|---|---|---|---|
| warning | `#B7791F` | `#FFF4D6` | `#F3D78A` |
| danger | `#C2410C` | `#FDE7E7` | `#F2B8B5` |
| success | `#16803C` | `#E2F6E8` | `#B8E3C3` |
| info | `#2563EB` | `#E8F1FF` | `#BDD6FF` |
| neutral | `#4B5563` | `#F3F4F6` | `#E5E7EB` |
| pending | `#6B5B00` | `#FFF8D8` | `#EEE3A0` |

Diringkas ke `statusColors` (theme.ts:114–145). Ada **duplikasi/alias sinonim**:
`primaryGreen`==`primary`==`primaryGreenSoft`==`primarySoft`==`surfaceGreen`,
`background`==`bg`, `textMuted`==`textSoft` (nilai sama, nama beda). Ada dua nama
"muted" legacy: `textMutedLegacy` (`#647067`) tidak dipakai konsisten.

### A.2 Spacing — `spacing` (theme.ts:48–62)

| Token | Nilai | Token | Nilai |
|---|---|---|---|
| xs | 4 | 3xl | 32 |
| sm | 8 | 4xl | 40 |
| md | 12 | screenHorizontal | 16 |
| lg | 16 | sectionGap | 18 |
| xl | 20 | cardPadding | 16 |
| 2xl | 24 | listGap | 12 |
| — | — | buttonHeight | 52 |

**Skala inti = kelipatan 4** (4/8/12/16/20/24/32/40) — konsisten. Tapi ada token
semantik di luar grid-4: `sectionGap: 18` (bukan kelipatan 4). Sisanya alias ke
nilai grid (`cardPadding`=16=lg, `listGap`=12=md, `screenHorizontal`=16=lg).

### A.3 Radius — `radius` (theme.ts:64–76)

| Token | Nilai | Token | Nilai |
|---|---|---|---|
| sm | 8 | round | 999 |
| md | 12 | screenCard | 18 |
| lg | 16 | input | 14 |
| xl | 20 | button | 14 |
| 2xl | 24 | chip | 999 |
| — | — | imageCard | 16 |

Skala 8/12/16/20/24 (kelipatan 4). Nilai ganjil semantik: `screenCard: 18`,
`input`/`button: 14`. `chip`=`round`=999 (alias).

### A.4 Tipografi — `typography` (theme.ts:80–95)

| Token | fontSize | weight | lineHeight |
|---|---|---|---|
| display | 32 | 800 | 38 |
| h1 | 28 | 800 | 34 |
| h2 | 22 | 800 | 28 |
| h3 | 18 | 700 | 24 |
| title | 30 | 800 | 36 |
| screenTitle | 20 | 700 | 26 |
| sectionTitle | 17 | 700 | 23 |
| body | 16 | 400 | 22 |
| bodyStrong | 16 | 700 | 22 |
| small | 14 | 400 | 20 |
| meta | 13 | 400 | 18 |
| caption | 12 | 600 | 16 |
| badge | 12 | 700 | 16 |
| navLabel | 11 | 600 | 14 |

**Weight maksimum di token = 800.** Tidak ada token weight 900 (lihat §D — 900
dipakai 57× sebagai literal). `title`(30) dan `display`(32) tumpang tindih peran.

### A.5 Shadow / elevation — `shadows` (theme.ts:97–112)

| Token | shadowOpacity | shadowRadius | offset | elevation |
|---|---|---|---|---|
| card | 0.05 | 10 | {0, 4} | 2 |
| elevated | 0.10 | 16 | {0, −4} | 8 |

`shadowColor` = `colors.black`. (Bandingkan §B: menu detail pohon pakai shadow
literal tersendiri, bukan token ini.)

### A.6 Font family

**Tidak ada custom font.** Grep `useFonts|expo-font|fontFamily|loadAsync` di
`src`+`app` → **0 hasil**. [`app/_layout.tsx`](app/_layout.tsx) tidak memuat font.
`typography` tidak punya field `fontFamily`. Semua teks pakai font sistem default
(San Francisco di iOS, Roboto di Android). `app.json` tidak mendaftarkan aset font.

### A.7 Dark mode / useColorScheme

**Tidak ada.** Grep `useColorScheme|colorScheme|DarkTheme|prefers-color` → **0 hasil**.
[`app.json`](app.json:8) menetapkan `"userInterfaceStyle": "light"`.
[`app/_layout.tsx`](app/_layout.tsx:11) memaksa `<StatusBar barStyle="dark-content" />`
dan warna header hardcode light. Palet `colors` single-mode (tak ada varian gelap).

---

## B. Layar detail pohon (acuan gaya) — PALING DETAIL

File utama: [`src/components/tree-detail-screen.tsx`](src/components/tree-detail-screen.tsx)
(806 baris). Router tipis: [`app/(owner)/owner/trees/[treeId].tsx`](app/(owner)/owner/trees/[treeId].tsx)
(14 baris) & [`app/(worker)/worker/trees/[treeId].tsx`](app/(worker)/worker/trees/[treeId].tsx)
(14 baris) → keduanya hanya render `<TreeDetailScreen mode=... />`.

### B.1 Komponen yang dirender (urutan tampil, `TreeDetailScreen` baris 347–417)

| Komponen | Asal | Baris def | Shared/Lokal |
|---|---|---|---|
| `Screen` | `./ui` | ui.tsx:54 | shared |
| `TreeDetailTopBar` → `TopAppBar` | lokal → `./ui` | 420 / ui.tsx:157 | lokal membungkus shared |
| `ErrorBanner` | `./ui` | ui.tsx:951 | shared |
| `TreeDetailHero` | lokal | 445 | **lokal** |
| ├ `TreeVisualPlaceholder` | `./tree-components` | tree-components.tsx:146 | shared (2 pemakai) |
| └ `ConditionStatusBadge` → `Badge` | `./tree-components` → `./ui` | tree-components.tsx:491 | shared |
| `OwnerTreeMenu` | lokal | 644 | **lokal** |
| `PhotoSourceSheet` | lokal | 711 | **lokal** |
| `InfoGrid` / `InfoCell` | lokal | 495 / 514 | **lokal** |
| `FloweringAgeMarker` | `./flowering-marker` | flowering-marker.tsx | shared (1 pemakai) |
| `Button` "Catat aktivitas" | `./ui` | ui.tsx:878 | shared |
| `RecordActivitySheet` / `RecordActivityRow` | lokal | 527 / 597 | **lokal** |
| `SectionTitle` | **lokal** | 775 | **lokal (duplikat nama dari ui.tsx:692)** |
| `TreeHistoryTimeline` | `./tree-components` | tree-components.tsx:530 | shared (1 pemakai) |
| `ConditionReportList` | `./tree-components` | tree-components.tsx:503 | shared |

Kesimpulan struktur: **hibrida.** Cangkang (Screen/TopAppBar/Button/banner) =
shared; seluruh isi (hero, grid, sheet, menu, judul seksi) = komponen lokal dengan
style inline. Import token tersedia (`colors, radius, spacing, typography`,
tree-detail-screen.tsx:5) tapi sering dilewati dengan literal.

### B.2 Nilai konkret per bagian visual

**Cangkang `Screen`** (ui.tsx:80–99): paddingHorizontal `spacing.screenHorizontal`(16),
paddingTop `spacing.xl`(20), gap antar-seksi `spacing.sectionGap`(**18**). Ritme
luar = token; isi dalam banyak literal.

| Bagian | Baris | Properti | Nilai | Sumber |
|---|---|---|---|---|
| **TopBar kebab btn** | 425–434 | bg / border | `#FFFFFF` / `#DCE7D5` | HARDCODE (bukan token; border≠`#DDE8D8`) |
| | 429–433 | radius / size / borderWidth | `999` / `44×44` / `1` | HARDCODE |
| | 436 | glyph `...` | color `#065F2E`, fontSize 22, weight `900`, lh 24 | HARDCODE (weight off-scale) |
| **Hero container** | 457 | gap | `spacing.md`(12) | token |
| Hero photo-loading overlay | 462–472 | bg / radius | `rgba(6,95,46,0.66)` / `radius.xl`(20) | HARDCODE bg / token radius |
| Hero kode pohon | 480 | color / size / weight / lh | `colors.primary` / `32` / `900` / `38` | token color; size+weight+lh **HARDCODE** (≈`display` tapi weight 900≠800) |
| Hero lokasi | 483 | color / size / lh | `colors.textMuted` / `15` / `21` | token color; `15` off-scale HARDCODE |
| Hero row | 478 | gap / justify | `spacing.md`(12) / space-between | token |
| **TreeVisualPlaceholder** (regular) | tc:166–177 | radius / minHeight / borderWidth / padding | `radius.xl`(20) / `220` / `1` / `spacing.lg`(16) | token kecuali minHeight |
| — accent sehat | tc:767–773 | bg/border/fruit/leaf | `#DCEFE3`/`#B8D8BF`/`#5C8A45`/`primary` | HARDCODE (4 hex non-token) |
| — accent non-sehat | tc:757–764 | bg/border/fruit/haze/leaf | `#FFF8E8`/`#F6D77A`/`#C49A25`/`#F6D77A`/`#8A9A31` | HARDCODE (5 hex non-token) |
| **InfoGrid** | 504–510 | rowGap / kolom / paddingRight | `spacing.lg`(16) / flexBasis `50%` / `spacing.md`(12) | token |
| **InfoCell** | 516–523 | gap | `3` | HARDCODE (bukan skala 4) |
| — label | 517 | color / size | `colors.textMuted` / `13` | token color; `13` literal (≈meta) |
| — value | 520 | color / size / weight | `colors.text` / `16` / `700` | token color; size+weight literal |
| **Button "Catat aktivitas"** | 389 | (primary) minHeight / radius / bg | `56` / `radius.button`(14) / `colors.primary` | ui.tsx:915,921 |
| **SectionTitle (lokal)** | 777–786 | gap / paddingTop | `spacing.xs`(4) | token |
| — judul | 778 | color / size / weight / lh | `colors.text` / `typography.h2.fontSize`(22) / `800` / `typography.h2.lineHeight`(28) | token size+lh; weight literal |
| — subjudul | 782 | color / lh | `colors.textMuted` / `21` | **fontSize tak diset** (default RN); lh literal |
| **TreeHistoryTimeline** wrapper | tc:546 | gap | `spacing.md`(12) | token |
| — dot | tc:611–619 | size / radius / marginTop | `34×34` / `999` / `spacing.xs` | HARDCODE size |
| — dot bg per tipe | tc:776–790 | condition/phase/harvest/care | `#FCEFC7`/`#E7F6EC`/`#FFF4D6`/`#E7EEF8` | HARDCODE |
| — ikon warna per tipe | tc:792–806 | condition/phase/harvest/care | `#7A5600`/`#065F2E`/`#8A5B00`/`#184E91` | HARDCODE |
| — ikon size | tc:808–822 | semua | `18` | HARDCODE |
| — kartu riwayat | tc:623–634 | bg / border / radius / borderWidth / padding / gap | `colors.surface` / `primaryBorder`\|`border` / `radius.xl`(20) / `1` / `spacing.md`(12) / `spacing.sm`(8) | token |
| — judul item | tc:646 | size / weight / lh | `typography.bodyStrong`(16) / `800` / `bodyStrong.lineHeight`(22) | token size+lh; weight literal |
| — tanggal | tc:642,654 | color / size | `colors.textMuted` / `13` | token color; `13` literal |
| — chevron | tc:665 | ikon / color / size | `ChevronRightIcon` / `colors.textSoft` / `20` | shared SVG |

### B.3 Tombol pembuka sheet (RecordActivitySheet, 527–595)

| Elemen | Baris | Nilai | Sumber |
|---|---|---|---|
| Modal | 544 | `animationType="slide"`, transparent | — |
| overlay | 550 | `rgba(30,42,36,0.5)` | HARDCODE |
| sheet | 552–561 | bg `colors.surface`, radius atas **`28`**, gap `spacing.sm`(8), padBottom `spacing['3xl']`(32), padH `spacing.xl`(20), padTop `spacing.md`(12) | radius HARDCODE; sisanya token |
| grabber | 563 | `44×5`, radius 999, bg `colors.border`, marginBottom `spacing.xs` | HARDCODE size |
| judul | 564 | fontSize `19`, weight `900` | HARDCODE (19 off-scale) |
| **RecordActivityRow** | 609–622 | bg `colors.surface`, border `colors.border`, radius `radius.lg`(16), borderWidth 1, gap `spacing.md`, padH/padV `spacing.md`(12), `borderCurve:'continuous'` | token |
| — bulatan ikon | 624–633 | `38×38`, radius 999, bg = prop `iconBg` | HARDCODE size |
| — 4 pasang ikon+bg | 568–590 | kondisi `#7A5600`/`#FCEFC7`, fase `#065F2E`/`#E7F6EC`, panen `#8A5B00`/`#FFF4D6`, rawat `#184E91`/`#E7EEF8`, ikon size 20 | HARDCODE — **duplikat literal** dari timeline (§B.2 & tc:776–822) |
| — label | 636 | color `colors.text`, size 16, weight `800` | token color |
| — chevron | 639 | `ChevronRightIcon` `colors.textSoft` size 20 | shared |

### B.4 Chevron / ikon

Chevron dipakai konsisten via `ChevronRightIcon` (icons.tsx:102, SVG stroke 2)
`size={20}` di sheet-row (639) dan timeline (tc:665). Ikon dot timeline & row =
SVG size 18/20 (lihat §E). "Tombol back" & "kebab" **bukan** SVG — teks glyph (§E).

### B.5 Menu & sheet lain di file yang sama (untuk pembanding §F/§H)

| Komponen | Baris | radius | padding | overlay | grabber |
|---|---|---|---|---|---|
| RecordActivitySheet | 544–591 | `28` | token (20/12/32) | `rgba(30,42,36,0.5)` | `44×5` |
| PhotoSourceSheet | 725–751 | `28` | literal (padH 22, padTop 12, padBottom 28) | `rgba(30,42,36,0.12)` | `48×5` |
| OwnerTreeMenu (dropdown) | 666–707 | `14` | anchor padTop `92`, padRight `20` | `rgba(30,42,36,0.04)` | — |
| — shadow menu | 675–681 | shadowColor `#1E2A24`, opacity `0.14`, radius `14`, elevation `5`, minWidth `210` | — | HARDCODE (≠ `shadows.*`) |
| MenuItem | 767–771 | padding `14`, fontSize `15`, weight `800` | — | HARDCODE |

Catatan divergensi **dalam satu file**: dua bottom-sheet pakai radius 28 tapi satu
memakai padding token & satu memakai literal; grabber lebar 44 vs 48; tiga overlay
opacity berbeda (0.5 / 0.12 / 0.04); border card menu `#DCE7D5` (bukan
`colors.border` `#DDE8D8`); shadow menu literal `#1E2A24` (bukan `shadows.elevated`).

---

## C. Audit isolasi: shared vs lokal

### C.1 Ekspor `src/components/ui.tsx` (1553 baris) + jumlah pemakai

Jumlah pemakai = berkas `*.tsx` di `src`+`app` (di luar `ui.tsx` sendiri) yang
merender tag JSX komponen tsb.

| Komponen | Baris | Props utama | #pemakai |
|---|---|---|---|
| `Screen` | 54 | children, floatingAction, footer, stickyFooter, variant, contentStyle | **42** |
| `ErrorBanner` | 951 | message | **40** |
| `LoadingState` | 997 | message | **35** |
| `Button` | 878 | title, onPress, variant(6), size, icon, loading, disabled | **35** |
| `TopAppBar` | 157 | title, subtitle, right, onBack, variant(main/detail/plain) | **28** |
| `Card` | 391 | children, padding, style, variant(7) | **28** |
| `EmptyState` | 1010 | title, subtitle | **23** |
| `MetaRow` | 1025 | label, value | **21** |
| `Badge` | 463 | label, status, tone(7), maxWidth | **17** |
| `Field` | 707 | label, value, onChangeText, placeholder, secureTextEntry, keyboardType | **12** |
| `SectionHeader` | 341 | title, subtitle/description, actionLabel, onActionPress, children | **11** |
| `FormSection` | 1040 | title, description, children, style | **11** |
| `MainTabHeader` | 275 | title, subtitle, roleLabel, roleTone, onProfilePress | **10** |
| `DateField` | 752 | label, value, onChangeDate, placeholder | **8** |
| `CompactMetaItem` | 819 | icon(calendar/target/user), label | **7** |
| `FilterChipsRow` | 633 | chips[], hasActiveFilters, onClear, children | **6** |
| `ChipButton` | 551 | active, label, onPress | **6** |
| `SuccessBanner` | 975 | message | **5** |
| `SearchFilterRow` | 1061 | value, onChangeText, onFilterPress, filterActive | **5** |
| `appTheme` (objek) | 43 | — (dipakai di 5 file) | **5** |
| `CameraGlyph` | 1455 | color (dipakai internal + 5 file) | **5** |
| `PhotoPickerCard` | 1124 | title, imageUri, onTakePhoto, onChoosePhoto, onRemovePhoto, loading, required, … | **3** |
| `PageIntro` | 127 | title, subtitle | **3** |
| `FilterChip` | 588 | active, label, valueLabel, onPress, disabled | **2** |
| `SectionTitle` | 692 | title, subtitle | **1** (yang terhitung = SectionTitle **lokal** tree-detail; ekspor ui **0**) |
| `ProfileIconButton` | 246 | label, onPress | **0** (hanya dipakai internal oleh MainTabHeader) |
| `getStatusTone` (util) | 1300 | status→StatusTone | **1** |
| `MetricCard` | 511 | label, value, tone | **0 (tak terpakai)** |
| `BrandMark` | 309 | compact | **0 (tak terpakai)** |

Tipe yang diekspor: `ButtonVariant`, `BadgeTone`, `FilterChipOption`, `StatusTone`.

### C.2 Kandidat lokal (dipakai 1 layar) vs shared berisiko (≥2)

- **Shared "berisiko bocor" (≥2 pemakai):** `Screen`(42), `ErrorBanner`(40),
  `LoadingState`(35), `Button`(35), `TopAppBar`(28), `Card`(28), `EmptyState`(23),
  `MetaRow`(21), `Badge`(17), `Field`(12), `SectionHeader`(11), `FormSection`(11),
  `MainTabHeader`(10), `DateField`(8), `CompactMetaItem`(7), `FilterChipsRow`(6),
  `ChipButton`(6), `SuccessBanner`(5), `SearchFilterRow`(5), `PhotoPickerCard`(3),
  `PageIntro`(3), `FilterChip`(2). Mengubah salah satunya berdampak lintas layar.
- **Kandidat lokal / hampir-mati:** `SectionTitle` ui (0 eksternal),
  `ProfileIconButton` (0, internal), `getStatusTone` (1). 
- **Dead export (0 pemakai):** `MetricCard`, `BrandMark` — didefinisikan tapi tak
  pernah dirender.

### C.3 Modul shared kedua: `tree-components.tsx` (1132 baris)

Diimpor oleh detail-pohon. Ekspor dipakai lintas layar (mis. `TreeCard`,
`ConditionStatusBadge`, `GrowthPhaseBadge`, `TreeForm`, `ConditionReportList`,
`TreeVisualPlaceholder`, `TreeHistoryTimeline`). `TreeVisualPlaceholder` dipakai
oleh **detail-pohon** (tree-detail:459) **dan** `TreeCard` (tc:117) → 2 pemakai,
sehingga ubahannya bocor ke kartu daftar pohon.

### C.4 Jawaban "detail pohon: shared atau lokal?"

**Hibrida** (lihat §B.1): cangkang shared, isi lokal inline. `SectionTitle` di
detail-pohon adalah **redefinisi lokal** (tree-detail:775) yang menimpa peran
`SectionTitle` shared (ui.tsx:692) dengan style berbeda (22px vs 19px).

---

## D. Sebaran nilai hardcode

### D.1 Warna hex literal di luar `theme.ts`

**25 hex unik, 120 kemunculan** di `*.tsx` (`src`+`app`).

| Hex | # | Sama dengan token? |
|---|---|---|
| `#1E2A24` | 27 | **BUKAN token** (near-black rogue; token text = `#17231B`) |
| `#FFFFFF` | 19 | = `colors.white`/`surface` (literal ganti token) |
| `#F7FAF3` | 10 | = `colors.bg`/`background` |
| `#DDEFE2` | 10 | **BUKAN token** (hijau muda lain) |
| `#065F2E` | 9 | = `colors.primary` |
| `#DCE7D5` | 7 | **BUKAN token** (border detail-pohon; token border = `#DDE8D8`) |
| `#68746D` | 6 | **BUKAN token** (muted lain) |
| `#F6D77A` | 4 | = `statusColors.warning.border` (dipakai literal) |
| `#B8D8BF` | 4 | **BUKAN token** (accent visual pohon) |
| `#FFF4D6` | 2 | = `colors.warningBg` |
| `#FCEFC7` | 2 | **BUKAN token** |
| `#E7F6EC` | 2 | ≈ `primarySoft` `#E7F5EC` (beda 1 digit!) |
| `#E7EEF8` | 2 | **BUKAN token** (biru muda care) |
| `#A6D96A` | 2 | **BUKAN token** |
| `#8A5B00` | 2 | **BUKAN token** |
| `#7A5600` | 2 | **BUKAN token** |
| `#184E91` | 2 | **BUKAN token** |
| `#FFF8E8` `#FDA29B` `#DDE4DA` `#DCEFE3` `#C49A25` `#94A098` `#8A9A31` `#5C8A45` | 1 ea | semua **BUKAN token** |

Top file (kemunculan hex):

| # | File |
|---|---|
| 21 | [tree-detail-screen.tsx](src/components/tree-detail-screen.tsx) |
| 18 | [tree-components.tsx](src/components/tree-components.tsx) |
| 16 | [operational-report-screen.tsx](src/components/operational-report-screen.tsx) |
| 8 | [owner/schedules/index.tsx](app/(owner)/owner/schedules/index.tsx) |
| 7 | [owner/tasks/[taskId].tsx](app/(owner)/owner/tasks/[taskId].tsx) |
| 7 | [owner/index.tsx](app/(owner)/owner/index.tsx) |
| 6 | [owner/sops/index.tsx](app/(owner)/owner/sops/index.tsx) |
| 4 | [ui.tsx](src/components/ui.tsx), [growth-monitoring-screen.tsx](src/components/growth-monitoring-screen.tsx), 5× `_layout.tsx` |
| 3 | [care-schedule-components.tsx](src/components/care-schedule-components.tsx) |

Catatan: banyak literal **menyalin nilai token** (`#065F2E`, `#FFFFFF`, `#F7FAF3`,
`#FFF4D6`) → menyulitkan retema. `#1E2A24` (27×) adalah warna teks/overlay yang
sama sekali tak ada di `theme.ts`.

### D.2 Border radius numerik literal

| Nilai | # | Padanan token |
|---|---|---|
| `999` | 33 | = `radius.round`/`chip` |
| `14` | 5 | = `radius.button`/`input` |
| `3` | 4 | (ikon hand-made, no token) |
| `2` | 2 | (ikon) |
| `12` | 2 | = `radius.md` |
| `8` `10` `5` `4` | 1 ea | 8=`radius.sm`; 10/5/4 no token |
| **Sheet atas:** `30` | 4 (2 sisi ×2 file) | no token |
| **Sheet atas:** `28` | 4 (2 sisi ×2 sheet) | no token |

Radius sheet **30 vs 28** = skala tak tertulis untuk "sheet corner", divergen
antar file (§F).

### D.3 Padding / margin numerik literal

Padding: nilai grid-4 muncul literal (`padding: 20`×2, `10`×2, `12`, `14`) **plus**
off-grid: `padding: 11`(5×), `paddingVertical: 9`(4×), `paddingHorizontal: 22`(3×),
`14`(3×), `15`(2×), `paddingBottom: 28`(3×), `paddingTop: 92`(1×). Margin negatif
untuk ikon: `marginTop: -1/-3/-6/-11`.

Gap literal (bukan `spacing.*`):

| gap | # | = grid? | gap | # | = grid? |
|---|---|---|---|---|---|
| `8` | 42 | =sm | `4` | 12 | =xs |
| `12` | 25 | =md | `3` | 7 | off |
| `10` | 20 | **off** | `9` | 5 | off |
| `7` | 12 | **off** | `6` `5` | 3 ea | off |
| | | | `20`/`14`/`2`/`16` | 1–2 | mix |

→ Terbentuk **skala gap tak tertulis** yang didominasi nilai grid (8,12,4) tapi
bocor ke off-grid (10 ×20, 7 ×12, 9 ×5, 3 ×7).

### D.4 fontSize & fontWeight literal

`fontWeight` literal: `800`×92, `900`×**57**, `700`×50, `600`×9, `400`×3.
→ **`900` dipakai 57× padahal tak ada token weight 900** (§A.4 max 800).

`fontSize` literal (top): `14`×45, `13`×44, `16`×37, `17`×24, `15`×18, `12`×12,
`20`×10, `22`×9, `24`×6, `18`×5, `28`×3, `52`×2, `34`×2, `23`×2, `19`×2, `36/32/30/25/11`×1.
→ Nilai **di luar skala token**: `15, 19, 23, 24, 25, 34, 36, 52` (skala tersirat
lebih lebar dari `typography`).

---

## E. Sistem ikon

### E.1 `react-native-svg`

Diimpor **hanya di satu tempat**: [`src/components/icons.tsx`](src/components/icons.tsx:1)
(`import Svg, { Path }`). Grep `react-native-svg` di `src`/`app` → hanya icons.tsx
(sisanya di package.json/docs). Versi `15.15.4` (package.json:30).

Ikon SVG (semua `viewBox="0 0 24 24"`, `fill="none"`, `strokeWidth={2}`,
`strokeLinecap/Linejoin="round"`, default `size=20`):

| Ikon | Baris |
|---|---|
| `FlowerIcon` | icons.tsx:16 |
| `FlowerOffIcon` | icons.tsx:37 |
| `AlertTriangleIcon` | icons.tsx:65 |
| `BasketIcon` | icons.tsx:75 |
| `SprayIcon` | icons.tsx:86 |
| `ChevronRightIcon` | icons.tsx:102 |

Helper `StrokePath` (icons.tsx:12) mengunci `strokeWidth={2}`.

### E.2 Ikon buatan tangan (View+border) yang masih hidup

Semua di [`ui.tsx`](src/components/ui.tsx):

| Glyph | Baris | borderWidth | Ukuran |
|---|---|---|---|
| `CompactMetaIcon` (calendar/target/user) | 841–866 | `1.5` | 13–14 |
| `DateFieldCalendarIcon` | 868–874 | `2` | 17×18 |
| `FilterGlyph` (3 bar) | 1443–1453 | height bar `2` | 14–22 |
| `CameraGlyph` | 1455–1491 | `2` | 25×19 |
| `UserGlyph` | 1493–1517 | `2` | 8–16 |

Glyph berbasis **teks** (bukan SVG, bukan View+border):

| Glyph | Lokasi | Nilai |
|---|---|---|
| Back arrow `<` | ui.tsx:199 | fontSize 24, weight 900 |
| Kebab `...` | tree-detail:436 | fontSize 22, weight 900 |
| Chip caret `v` | ui.tsx:627 | fontSize 12, weight 900 |
| Close `x` | ui.tsx:1261, PhotoAttachmentPreviewList:93 | fontSize 18/17, weight 900 |

### E.3 Konsistensi ukuran & stroke

- **Stroke SVG konsisten**: selalu `2`.
- **Ukuran SVG tidak seragam**: `20` (sheet-row tree-detail:568–589, chevron 639/tc:665)
  vs `18` (dot timeline tc:808–822). Default prop `20` (icons.tsx:9).
- **Ikon hand-made tidak seragam**: borderWidth `1.5` (CompactMetaIcon) vs `2`
  (lainnya); tak sinkron dengan stroke SVG `2`.
- **Tiga paradigma ikon berdampingan**: SVG (icons.tsx), View+border glyph (ui.tsx),
  dan teks-karakter (`<`, `...`, `v`, `x`). Tidak ada satu `<Icon name size>` bersama.

---

## F. Bottom sheet & overlay

Semua `<Modal>` (9 titik render; tidak ada komponen sheet/overlay bersama —
setiap layar merakit sendiri):

| # | File:baris | Tujuan | anim | radius atas | overlay | grabber |
|---|---|---|---|---|---|---|
| 1 | tree-detail-screen.tsx:544 | Sheet "Catat aktivitas" | slide | `28` | `rgba(30,42,36,0.5)` | 44×5 |
| 2 | tree-detail-screen.tsx:666 | Dropdown menu owner (anchored) | fade | `14` | `rgba(30,42,36,0.04)` | — |
| 3 | tree-detail-screen.tsx:725 | Sheet sumber foto | slide | `28` | `rgba(30,42,36,0.12)` | 48×5 |
| 4 | [owner/trees/index.tsx:324](app/(owner)/owner/trees/index.tsx) | Sheet filter pohon | slide | `30` | `rgba(30,42,36,0.12)` | 48×5 |
| 5 | [worker/trees/index.tsx:286](app/(worker)/worker/trees/index.tsx) | Sheet filter pohon | slide | `30` | `rgba(30,42,36,0.12)` | 48×5 |
| 6 | [owner/sops/[sopId].tsx:279](app/(owner)/owner/sops/[sopId].tsx) | Dropdown menu (anchored) | fade | `radius.lg`(16) | — (Pressable flex:1) | — |
| 7 | tree-components.tsx:725 | Preview foto full-screen | fade | img `14` | `rgba(30,42,36,0.72)` | — |
| 8 | [task-proof-photo.tsx:103](src/components/task-proof-photo.tsx) | Preview foto full-screen | fade | img `radius.lg` | `rgba(18,28,22,0.78)` | — |
| 9 | [PhotoAttachmentPreviewList.tsx:108](src/components/media/PhotoAttachmentPreviewList.tsx) | Preview foto full-screen | fade | img `radius.lg` | `rgba(18,28,22,0.78)` | — |

Pola **salin-tempel, bukan komponen bersama**:

- **Filter-sheet #4 & #5** (owner vs worker) hampir identik: radius `30`, overlay
  `rgba(30,42,36,0.12)`, padH `22`, padTop `10`, padBottom `28`, grabber 48×5
  (owner:326–337, worker:288–298). Berbeda dari sheet detail-pohon (radius `28`).
- **Dropdown menu #2 & #6** pola sama (anchored, absolute kanan-atas) beda nilai:
  radius `14` vs `radius.lg`(16); anchor top `92` vs `76`; width `210` vs `190`.
- **Preview foto #7/#8/#9** tiga salinan; overlay divergen: `rgba(30,42,36,0.72)`
  (#7) vs `rgba(18,28,22,0.78)` (#8,#9). #8 & #9 identik.
- Radius sudut sheet tak konsisten: `28` (detail) / `30` (filter) — keduanya
  literal, tak ada token untuk "sheet".

---

## G. Peta layar (route `app/`)

Router di `app/` umumnya **tipis** (3–56 baris) dan mendelegasikan ke layar nyata
di `src/components/*`. File "gemuk" = yang merakit UI inline sendiri.

### G.1 Root / auth / onboarding

| Route | Baris | Route | Baris |
|---|---|---|---|
| index.tsx | 56 | (auth)/register.tsx | 164 |
| _layout.tsx | 30 | (auth)/login.tsx | 145 |
| (auth)/_layout.tsx | 61 | (auth)/get-started.tsx | 46 |
| (onboarding)/_layout.tsx | 89 | (onboarding)/onboarding.tsx | 74 |
| (onboarding)/create-farm.tsx | 74 | (onboarding)/join-farm.tsx | 52 |
| pending-approval / rejected / removed-access | 10 ea | password / profile | 3 ea |

### G.2 Owner (`app/(owner)/…`)

| Route | Baris | Route | Baris |
|---|---|---|---|
| **schedules/index.tsx** | **681** | trees/[treeId]/edit.tsx | 258 |
| **trees/index.tsx** | **585** | farm.tsx | 261 |
| **sops/[sopId]/schedule.tsx** | **554** | sops/[sopId]/edit.tsx | 205 |
| **schedules/[scheduleId].tsx** | **540** | tasks/index.tsx | 199 |
| workers.tsx | 391 | schedules/create.tsx | 197 |
| index.tsx (beranda) | 368 | sops/create.tsx | 181 |
| sops/index.tsx | 345 | trees/create.tsx | 147 |
| sops/[sopId].tsx | 336 | _layout.tsx | 110 |
| tasks/[taskId].tsx | 309 | trees/[treeId].tsx | 14 |
| farm-profile.tsx | 292 | records/[recordType]/[recordId].tsx | 23 |
| schedules/[scheduleId]/edit.tsx | 270 | reports/index.tsx | 18 |
| growth-monitoring.tsx | 5 | trees/[treeId]/{report,phase,harvest,care}.tsx | 9 ea |
| reports/[reportId].tsx, /task.tsx, profile*.tsx | 3–9 | | |

### G.3 Worker (`app/(worker)/…`)

| Route | Baris | Route | Baris |
|---|---|---|---|
| **tasks/[taskId].tsx** | **844** ⚠ terbesar | index.tsx (beranda) | 265 |
| **trees/index.tsx** | **518** | farm.tsx | 222 |
| tasks/index.tsx | 304 | _layout.tsx | 98 |
| trees/[treeId].tsx | 14 | records/[recordType]/[recordId](/edit).tsx | 23 ea |
| reports/index.tsx | 18 | trees/[treeId]/{report,phase,harvest,care}.tsx | 9 ea |
| reports/[reportId](/edit).tsx, profile*.tsx | 3–9 | | |

### G.4 Layar nyata di `src/components/` (yang paling gemuk)

| File | Baris | File | Baris |
|---|---|---|---|
| **operational-report-screen.tsx** | **2146** ⚠ | tree-record-detail-screen.tsx | 523 |
| ui.tsx | 1553 | tree-record-edit-screen.tsx | 503 |
| tree-components.tsx | 1132 | care-sop-components.tsx | 486 |
| **tree-detail-screen.tsx** (acuan) | **806** | tree-condition-report-screen.tsx | 394 |
| care-schedule-components.tsx | 564 | role-bottom-navigation.tsx | 295 |

File paling gemuk keseluruhan: `worker/tasks/[taskId].tsx` (844, route inline) dan
`operational-report-screen.tsx` (2146, komponen).

---

## H. Temuan berisiko (untuk rombak UI)

1. **`SectionTitle` ganda dengan style beda.** ui.tsx:692 (fontSize 19, weight 800)
   vs redefinisi lokal tree-detail:775 (typography.h2 = 22, weight 800). Ada juga
   `SectionHeader` (ui.tsx:341, h3=18) dan `PageIntro` (ui.tsx:127, h1=28) untuk
   peran "judul" — **empat komponen heading** dengan ukuran berbeda tak seragam.

2. **Warna `#1E2A24` (27×) tak ada di `theme.ts`.** Dipakai untuk judul header
   ([_layout.tsx:18](app/_layout.tsx)), shadowColor menu (tree-detail:678), dan basis
   overlay `rgba(30,42,36,…)`. Token teks resmi `#17231B`. Retema warna teks/overlay
   tak akan tertangkap kalau hanya ubah `colors.text`.

3. **Literal menyalin nilai token.** `#065F2E`(9×)=primary, `#FFFFFF`(19×)=surface,
   `#F7FAF3`(10×)=bg, `#FFF4D6`=warningBg, `#F6D77A`=warning.border. Ganti token
   tidak berefek di titik-titik ini; harus grep-replace manual.

4. **Palet ikon riwayat/aktivitas didefinisikan dua kali.** Pasangan
   `#7A5600/#FCEFC7`, `#065F2E/#E7F6EC`, `#8A5B00/#FFF4D6`, `#184E91/#E7EEF8` ada di
   tree-detail (RecordActivityRow 568–590) **dan** tree-components (getTimelineDot/Text
   776–822). Ubah satu, yang lain tertinggal.

5. **`TreeVisualPlaceholder` dipakai 2 layar (detail + TreeCard).** tree-components:146,
   dirender di tree-detail:459 dan tc:117 dengan prop `size` beda. Mengubah gayanya
   bocor ke kartu daftar pohon (owner & worker `trees/index`).

6. **Tidak ada komponen bottom-sheet/overlay bersama** (§F, 9 Modal salin-tempel).
   Radius sudut sheet `28` vs `30`, overlay opacity `0.5/0.12/0.04/0.72/0.78`, grabber
   `44` vs `48` — menyeragamkan berarti menyentuh ≥5 file terpisah.

7. **`fontWeight: '900'` (57×) di luar skala token** (max 800). Detail-pohon banyak
   pakai 900 (hero, kebab, judul sheet). Menetapkan token weight harus memutuskan
   apakah 900 dipertahankan atau diturunkan.

8. **Layar acuan sendiri hibrida & banyak literal.** tree-detail-screen.tsx: 21 hex
   literal, 806 baris, isi utama (hero/grid/sheet/menu) inline lokal. "Acuan gaya"
   belum ter-token-kan; menjadikannya patokan berarti mengekstrak nilai-nilai
   literalnya lebih dulu (§B.2/§B.3).

9. **`gap`/`padding` off-grid tersebar** (gap `10`×20, `7`×12, `9`×5, `3`×7;
   padding `11`×5, `9`×4, `22`×3). Ada skala tak tertulis; layout tertentu bergantung
   pada nilai magic ini (mis. anchor menu `top:92`/`76`, `paddingTop: 92`).

10. **Dead export & alias membingungkan sumber token.** `MetricCard`/`BrandMark`
    (0 pemakai), `ProfileIconButton` (internal), plus alias warna sinonim
    (`primary`==`primaryGreen`==`primarySoft`==`surfaceGreen`) — saat menetapkan
    token, tidak jelas mana yang kanonik.

11. **Dua "muted" mirip tapi beda** membuat teks sekunder tak konsisten:
    token `textMuted` `#8A978D`, `textSecondary` `#5B6B60`, `textMutedLegacy`
    `#647067`, plus literal non-token `#68746D`(6×) & `#94A098`(1×).

12. **`#E7F6EC` (2×) vs token `primarySoft` `#E7F5EC`** — beda 1 digit (F6 vs F5).
    Kemungkinan salah ketik yang lolos; retema hijau-muda bisa menyisakan varian ini.
