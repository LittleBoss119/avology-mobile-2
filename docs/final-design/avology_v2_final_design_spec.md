# Avology V2 Final Design Specification

> **Note — partially superseded (2026-07-07):** On **navigation labels, design tokens, the photo-picker pattern, and the tree-detail action button**, this spec is superseded by [`../ui-review/avology-v2-design-recommendation-for-codex.md`](../ui-review/avology-v2-design-recommendation-for-codex.md) (2026-07-02), which is authoritative on those specific points. Everything else in this document still applies.

**Status:** Final UI/UX direction for Avology V2  
**Purpose:** Menjadi panduan implementasi desain di project Avology Mobile V2.  
**Design strategy:** V2 tetap menjadi project final dan sumber kebenaran fitur. V1 digunakan sebagai referensi visual polish, sectioning form, card hierarchy, dan rasa mobile app yang lebih matang.

---

## 1. Ringkasan Keputusan Desain

Avology V2 harus dipertahankan sebagai struktur produk final karena fitur operasionalnya lebih lengkap: laporan operasional, SOP perawatan, manajemen pekerja, jadwal, tugas worker, bukti foto, dan status tindak lanjut laporan.

Namun, tampilan V2 perlu dipoles menggunakan pendekatan visual V1 karena V1 lebih kuat dalam:

- card hierarchy,
- section form,
- spacing,
- visual softness,
- badge status,
- screen yang terasa seperti aplikasi mobile, bukan sekadar form database.

**Keputusan final:**

> Gunakan V2 sebagai arsitektur fitur dan flow. Gunakan V1 sebagai bahasa visual.

---

## 2. Prinsip Desain Utama

### 2.1 Fokus aplikasi

Avology adalah aplikasi manajemen kebun alpukat berbasis mobile untuk dua role:

- **Owner / Pemilik:** memantau kebun, mengatur pohon, jadwal, laporan, pekerja, SOP, dan data kebun.
- **Worker / Pekerja:** melihat tugas, melaporkan progres, membuat laporan operasional, melihat pohon, dan melihat informasi kebun.

### 2.2 Mental model utama

Aplikasi harus dibagi berdasarkan aktivitas kerja nyata di kebun:

- **Beranda:** ringkasan dan prioritas.
- **Pohon:** data pohon dan riwayat kondisi/fase.
- **Jadwal/Tugas:** rencana kerja dan eksekusi kerja.
- **Laporan:** laporan operasional lapangan.
- **Kebun:** data kebun, anggota, SOP, dan pengaturan akses.

### 2.3 Aturan penting

1. Jangan mencampur **Profil Akun** dan **Kebun** sebagai satu konsep.
2. Bottom navigation harus berisi aktivitas utama, bukan halaman yang jarang dibuka.
3. Owner dan worker sama-sama punya tab **Kebun** agar mental model konsisten.
4. Profil akun tetap bisa diakses lewat avatar/header dan card **Akun Saya** di tab Kebun.
5. Form panjang harus dibagi menjadi section card.
6. Detail page harus punya top app bar dengan back button dan menu aksi.
7. Dashboard hanya menampilkan data yang membantu keputusan cepat.
8. Worker tidak boleh melihat aksi yang hanya boleh dilakukan owner.
9. Jangan membuat UI terlalu ramai seperti dashboard statistik mentah.
10. Jangan membuat UI terlalu kosong seperti form debug.

---

## 3. Design Tokens

### 3.1 Color palette final

Gunakan color palette berikut secara konsisten.

| Token | Hex | Fungsi |
|---|---:|---|
| `color.bg` | `#F7FAF3` | Background utama aplikasi |
| `color.surface` | `#FFFFFF` | Card utama, form field, modal |
| `color.surfaceMuted` | `#F1F6EC` | Background section lembut |
| `color.surfaceGreen` | `#EAF7E8` | Card highlight hijau muda |
| `color.primary` | `#065F2E` | Tombol utama, active nav, heading penting |
| `color.primaryDark` | `#04421F` | Tekanan visual, hero card gelap |
| `color.primarySoft` | `#DDF3D8` | Selected state, active chip background |
| `color.primaryBorder` | `#B7DFC0` | Border komponen hijau lembut |
| `color.text` | `#102016` | Teks utama |
| `color.textMuted` | `#647067` | Subtitle, helper text |
| `color.textSoft` | `#8A948C` | Placeholder, metadata |
| `color.border` | `#DDE7DA` | Border card/input |
| `color.divider` | `#E7EEE3` | Divider tipis |
| `color.warning` | `#B7791F` | Status tertunda/perlu perhatian |
| `color.warningBg` | `#FFF4D6` | Background warning |
| `color.warningBorder` | `#F3D78A` | Border warning |
| `color.danger` | `#B42318` | Status error, aksi berbahaya |
| `color.dangerBg` | `#FDE7E7` | Background danger |
| `color.success` | `#0F7A3D` | Status selesai/sehat |
| `color.successBg` | `#E2F6E8` | Background success |
| `color.info` | `#2563EB` | Informasi non-warning |
| `color.infoBg` | `#E8F1FF` | Background info |
| `color.photoPlaceholder` | `#EAF0E6` | Placeholder foto pohon/laporan |

### 3.2 Pemakaian warna status

| Status | Text | Background | Border |
|---|---:|---:|---:|
| Sehat / Selesai / Aktif | `#0F7A3D` | `#E2F6E8` | `#B8E3C3` |
| Perlu perhatian / Tertunda | `#B7791F` | `#FFF4D6` | `#F3D78A` |
| Penyakit / Hama / Error | `#B42318` | `#FDE7E7` | `#F2B8B5` |
| Menunggu | `#6B5B00` | `#FFF8D8` | `#EEE3A0` |
| Info / Tindak lanjut | `#2563EB` | `#E8F1FF` | `#BDD6FF` |
| Netral / Manual / Arsip | `#4B5563` | `#F3F4F6` | `#E5E7EB` |

### 3.3 Typography

Gunakan font default React Native/Expo. Jangan menambah font eksternal kecuali sudah ada di project.

| Token | Size | Weight | Line height | Fungsi |
|---|---:|---:|---:|---|
| `display` | 32 | 800 | 38 | Hero title get started / auth |
| `h1` | 28 | 800 | 34 | Title root page utama |
| `h2` | 22 | 800 | 28 | Section utama |
| `h3` | 18 | 700 | 24 | Card title |
| `body` | 16 | 400 | 22 | Teks normal |
| `bodyStrong` | 16 | 700 | 22 | Nilai penting |
| `small` | 14 | 400 | 20 | Subtitle, helper text |
| `caption` | 12 | 600 | 16 | Badge, metadata kecil |
| `navLabel` | 11 | 600 | 14 | Label bottom nav |

Aturan:

- Jangan gunakan title 32px di semua halaman.
- Root screen maksimal `h1` 28px.
- Form title cukup `h2` atau app bar title 18-20px.
- Metadata pakai `small` atau `caption`, bukan body besar.

### 3.4 Spacing scale

Gunakan spacing konsisten:

| Token | Value |
|---|---:|
| `space.xs` | 4 |
| `space.sm` | 8 |
| `space.md` | 12 |
| `space.lg` | 16 |
| `space.xl` | 20 |
| `space.2xl` | 24 |
| `space.3xl` | 32 |
| `space.4xl` | 40 |

Screen default:

- Horizontal padding: `20px`.
- Vertical padding top root screen: `20px` setelah safe area.
- Gap antar section: `20px`.
- Gap antar card dalam section: `12px`.
- Gap antar field form: `14px`.
- Bottom padding screen dengan tab nav: minimal `96px`.
- Bottom padding form tanpa tab nav: minimal `32px`.

### 3.5 Radius

| Token | Value | Fungsi |
|---|---:|---|
| `radius.sm` | 8 | badge, small chip |
| `radius.md` | 12 | input, small button |
| `radius.lg` | 16 | card kecil |
| `radius.xl` | 20 | card utama |
| `radius.2xl` | 24 | hero card / bottom sheet |
| `radius.round` | 999 | FAB, avatar, pill badge |

### 3.6 Shadow / elevation

Gunakan shadow sangat halus. Jangan membuat card melayang berlebihan.

Recommended React Native style:

```ts
shadowColor: '#000',
shadowOpacity: 0.05,
shadowRadius: 10,
shadowOffset: { width: 0, height: 4 },
elevation: 2,
```

Untuk bottom nav / bottom sheet:

```ts
shadowColor: '#000',
shadowOpacity: 0.10,
shadowRadius: 16,
shadowOffset: { width: 0, height: -4 },
elevation: 8,
```

---

## 4. Layout Foundation

### 4.1 Screen container

Semua screen utama harus memakai struktur:

```tsx
<SafeAreaView style={styles.safeArea}>
  <ScrollView
    contentContainerStyle={styles.scrollContent}
    showsVerticalScrollIndicator={false}
  >
    {/* content */}
  </ScrollView>
</SafeAreaView>
```

Default style:

```ts
safeArea: {
  flex: 1,
  backgroundColor: colors.bg,
},
scrollContent: {
  paddingHorizontal: 20,
  paddingTop: 20,
  paddingBottom: 96,
},
```

Untuk form screen yang tidak memakai bottom tab:

```ts
scrollContent: {
  paddingHorizontal: 20,
  paddingTop: 16,
  paddingBottom: 32,
},
```

### 4.2 Root page structure

Root tab page memakai pola:

```tsx
<RootHeader />
<MainSection />
<Section title="..." />
<Section title="..." />
```

Urutan visual:

1. Header ringkas.
2. Optional hero/summary card.
3. Search/filter jika halaman list.
4. Content list/grid.
5. FAB jika ada aksi tambah.

### 4.3 Detail page structure

Detail page memakai pola:

```tsx
<AppTopBar title="Detail Pohon" showBack showMenu />
<HeroImage />
<IdentityBlock />
<ActionRow />
<InfoCard />
<TimelineOrRelatedContent />
```

Bottom nav boleh tetap tampil di detail jika detail merupakan bagian natural dari tab. Untuk form create/edit, bottom nav sebaiknya disembunyikan.

### 4.4 Form page structure

Form page memakai pola:

```tsx
<AppTopBar title="Tambah Pohon" showBack />
<FormSection title="Identitas Pohon" description="..." />
<FormSection title="Kondisi Awal" description="..." />
<FormSection title="Foto Pohon" description="..." />
<FormActions />
```

Aturan:

- Jangan menaruh semua field dalam satu layar polos.
- Field wajib diberi label jelas.
- Helper text harus dipakai untuk field yang rawan salah, seperti tanggal tanam, kode kebun, bukti foto.
- Tombol utama selalu di bawah section terakhir.

---

## 5. Component Specification

### 5.1 RootHeader

Digunakan di root tab screen: Beranda, Pohon, Jadwal/Tugas, Laporan, Kebun.

Layout:

```txt
[Role chip optional]                         [Avatar button]
Title besar
Subtitle kecil
```

Style:

- Container margin bottom: `20px`.
- Avatar size: `44x44`.
- Avatar shape: circle/rounded.
- Title size: `28px`, weight 800.
- Subtitle size: `15-16px`, color muted.

Contoh owner Beranda:

```txt
[Pemilik]                              [avatar]
Halo, Udin
Pantau kondisi MS Farm hari ini.
```

Contoh Pohon:

```txt
[Pemilik]                              [avatar]
Data Pohon
12 pohon aktif di MS Farm.
```

### 5.2 AppTopBar

Digunakan untuk detail dan form.

Layout:

```txt
[Back button]        Title        [Menu/optional]
```

Style:

- Height: `56px`.
- Back button: `44x44`, background `surface`, border `border`, radius `round`.
- Title: 18-20px, weight 800.
- Menu button: `44x44`, same style.
- Margin bottom: `16px`.

### 5.3 BottomNavigation

Height:

- Container height: `72px`.
- Position: fixed absolute bottom or router tab bar.
- Horizontal margin: if floating style, `16px`, bottom `12px`, border radius `24px`.

Visual:

- Background `#FFFFFF`.
- Active item background: `#E2F6E8` or transparent with green icon.
- Active icon/text: `#065F2E`.
- Inactive icon/text: `#7C887F`.
- Label always visible.

Owner tabs:

```txt
Beranda | Pohon | Jadwal | Laporan | Kebun
```

Worker tabs:

```txt
Beranda | Tugas | Pohon | Laporan | Kebun
```

Icons recommendation:

| Tab | Icon concept |
|---|---|
| Beranda | home |
| Pohon | sprout/tree |
| Jadwal | calendar/list-check |
| Tugas | check-square/list-check |
| Laporan | clipboard/document-warning |
| Kebun | map/farm/leaf-grid |

Jangan gunakan icon gedung untuk kebun. Kebun bukan kantor pajak.

### 5.4 Card

Base card:

```ts
backgroundColor: colors.surface,
borderWidth: 1,
borderColor: colors.border,
borderRadius: 20,
padding: 16,
```

Card variants:

| Variant | Background | Border | Use |
|---|---:|---:|---|
| default | `#FFFFFF` | `#DDE7DA` | Form, list card |
| softGreen | `#EAF7E8` | `#B7DFC0` | Highlight card |
| heroGreen | `#065F2E` | transparent | Dashboard hero |
| warning | `#FFF4D6` | `#F3D78A` | Warning info |
| danger | `#FDE7E7` | `#F2B8B5` | Rejected/error/danger |
| info | `#E8F1FF` | `#BDD6FF` | Informational notice |

### 5.5 Button

Primary button:

- Height: `56px`.
- Background: `#065F2E`.
- Text: white, 16px, 700.
- Radius: `16px`.

Secondary button:

- Height: `52px`.
- Background: `#FFFFFF`.
- Border: `#DDE7DA`.
- Text: `#102016` or `#065F2E`.

Danger button:

- Height: `52px`.
- Background: `#FDE7E7`.
- Text: `#B42318`.
- Border: `#F2B8B5`.

Button placement:

- Primary action always placed above secondary/danger when paired.
- Danger action should be visually separated in lower section.

### 5.6 Input

Input style:

```ts
height: 54,
borderRadius: 14,
borderWidth: 1,
borderColor: colors.border,
backgroundColor: colors.surface,
paddingHorizontal: 16,
fontSize: 16,
color: colors.text,
```

Label:

- 14px, weight 700, color text.
- Required marker uses `*` in muted danger color.

Helper text:

- 13px, color textMuted.
- Placed below input.

### 5.7 Search + filter row

Layout:

```txt
[ Search input flexible ] [ Filter button 56x56 ]
```

Style:

- Search height: `56px`.
- Filter button: green filled if active, green outline if inactive.
- Gap: `10-12px`.

### 5.8 Badge / Chip

Base badge:

```ts
borderRadius: 999,
paddingHorizontal: 10,
paddingVertical: 5,
fontSize: 12,
fontWeight: '700',
```

Badge should always use semantic status color tokens.

### 5.9 FAB

Floating action button:

- Size: `58x58`.
- Background: primary.
- Icon: plus, white.
- Position: bottom `92px`, right `20px`.
- Radius: round.
- Shadow medium.

FAB appears only on screens where add action is primary:

- Owner Pohon: Tambah Pohon.
- Owner Jadwal: Buat Jadwal.
- Worker Laporan: Buat Laporan.

### 5.10 SectionHeader

Layout:

```txt
Title                                 Optional action
Description optional
```

Style:

- Title: h2 or h3.
- Description: small, muted.
- Margin bottom: 10-12px.

---

## 6. Navigation Architecture

### 6.1 Owner bottom navigation

| Tab | Route concept | Purpose |
|---|---|---|
| Beranda | `/owner` | Ringkasan kondisi kebun dan prioritas |
| Pohon | `/owner/trees` | Data pohon dan histori kondisi/fase |
| Jadwal | `/owner/schedules` | Jadwal perawatan dan tugas worker |
| Laporan | `/owner/reports` | Laporan operasional worker dan tindak lanjut |
| Kebun | `/owner/farm` | Data kebun, anggota, SOP, akun saya |

### 6.2 Worker bottom navigation

| Tab | Route concept | Purpose |
|---|---|---|
| Beranda | `/worker` | Ringkasan tugas dan laporan |
| Tugas | `/worker/tasks` | Eksekusi tugas worker |
| Pohon | `/worker/trees` | Lihat data pohon dan detail |
| Laporan | `/worker/reports` | Buat dan lihat laporan operasional |
| Kebun | `/worker/farm` | Info kebun, anggota, akun saya, keluar kebun |

### 6.3 Profil akun

Profil akun bukan bottom tab utama.

Akses dari:

1. Avatar di header root tab.
2. Card **Akun Saya** di tab Kebun.
3. Onboarding / pending / rejected screen.

Route concept:

```txt
/profile
/profile/edit
/profile/password
```

---

## 7. Auth & Onboarding Screens

### 7.1 Splash / Loading

Purpose:

- Menampilkan proses checking session dan relasi kebun.

Layout:

```txt
[center logo/icon]
Avology
Memeriksa sesi dan relasi kebun...
```

Style:

- Background: `color.bg`.
- Logo/icon 72x72.
- Text center.
- Jangan tampilkan UI yang terlihat seperti Expo bundling di final app.

### 7.2 Get Started

Gunakan gabungan:

- Visual calm dari V1.
- Copywriting ringkas dari V2.

Layout:

```txt
Top area:
  [Logo Avology]
  Avology
  Operasional kebun alpukat

Middle:
  Kelola kebun alpukat dari genggaman
  Pantau pohon, tugas perawatan, laporan lapangan, dan akses pekerja dalam satu ruang kerja.

Info card:
  Operasional kebun alpukat
  Kelola pohon, jadwal, laporan, dan pekerja dengan alur sederhana.

Bottom fixed-ish:
  [Mulai / Buat Akun]
  [Masuk]
```

Recommended final labels:

- Primary: **Mulai** atau **Buat Akun**.
- Secondary: **Masuk**.

Pilih satu. Untuk user baru, **Mulai** lebih netral. Untuk flow cepat, **Buat Akun** lebih eksplisit. Rekomendasi final: **Mulai**.

### 7.3 Register

Layout:

```txt
[Logo kecil]
Buat Akun
Daftarkan akun sebelum membuat atau bergabung ke kebun.

[Card Form]
Nama lengkap
Nomor HP
Email
Password
Konfirmasi Password

[Daftar]
Sudah punya akun? Masuk
```

Notes:

- V1 punya konfirmasi password. Pertahankan.
- V2 punya Nomor HP. Pertahankan jika sudah masuk schema/profile.
- Jangan membuat form terlalu turun ke bawah saat keyboard muncul. Pastikan ScrollView dan KeyboardAvoidingView benar.

### 7.4 Login

Layout:

```txt
[Logo kecil]
Masuk
Masuk untuk melanjutkan ke area pemilik atau pekerja.

[Card Form]
Email
Password + show/hide icon

[Masuk]
Belum punya akun? Daftar
```

### 7.5 Onboarding / Pilih Akses

Gunakan layout V1 karena pilihan Buat Kebun dan Gabung Kebun lebih jelas.

Layout:

```txt
[Header]
Halo, {nama}
Hubungkan akun dengan kebun untuk mulai bekerja.
[avatar/profile button]

[Card highlighted softGreen]
Buat Kebun
Untuk pemilik yang ingin mengelola kebun baru.
Buat data kebun dan dapatkan kode untuk mengundang pekerja.
[Button Buat Kebun]

[Card white]
Gabung Kebun
Untuk pekerja yang menerima kode dari pemilik.
Ajukan akses menggunakan kode kebun, lalu tunggu persetujuan pemilik.
[Button Gabung Kebun]
```

Menu avatar:

- Profil Akun
- Logout

### 7.6 Buat Kebun

Pakai sectioning V1.

Layout:

```txt
[AppTopBar: Buat Kebun]

[FormSection: Data Kebun]
Nama Kebun *
Lokasi *

[FormSection: Informasi Tambahan]
Luas Lahan (m²)

[Primary: Simpan Kebun]
[Secondary: Batal]
```

Field labels:

- `Nama Kebun *`
- `Lokasi *`
- `Luas Lahan (m²)`

Do not use example `1.25` for luas kebun if actual context uses `6500`. Placeholder should be:

```txt
Contoh: 6500
```

### 7.7 Gabung Kebun

Layout:

```txt
[AppTopBar: Gabung Kebun]

Halo, {nama}
Masukkan kode dari pemilik untuk mengajukan akses.

[Card]
Gabung Kebun
Kode diberikan oleh pemilik kebun.
Kode Kebun *
Placeholder: Contoh: AVOL-ABC123
Helper: Pastikan kode sesuai sebelum mengirim pengajuan.

[Info notice]
Setelah pengajuan dikirim, akses kebun baru tersedia setelah disetujui pemilik.

[Primary: Ajukan Gabung]
[Secondary: Batal]
```

### 7.8 Menunggu Persetujuan

Layout:

```txt
[Header with avatar]
Halo, {nama} [Pekerja]
Pemilik kebun perlu menyetujui pengajuan kamu terlebih dahulu.

[Card]
Status Pengajuan [Menunggu]
Kebun Tujuan: {farmName}
Peran: Pekerja

[Warning notice]
Perbarui status setelah pemilik memproses pengajuan. Selama menunggu, data kebun belum dapat diakses.

[Primary: Perbarui Status]
```

Avatar menu:

- Profil Akun
- Status Pengajuan
- Logout

### 7.9 Pengajuan Ditolak

Layout:

```txt
[Header with avatar]
Halo, {nama} [Pekerja]
Kamu belum memiliki akses ke kebun ini.

[Card]
Pengajuan Ditolak [Ditolak]
Kebun Tujuan: {farmName}
Peran: Pekerja

[Danger notice]
Kamu dapat mengajukan ulang ke kebun ini atau menggunakan kode kebun lain.

[Primary: Ajukan Ulang ke Kebun Ini]
[Secondary: Gabung Kebun Lain]
[Secondary: Buat Kebun Sendiri]
```

---

## 8. Owner Screens

## 8.1 Owner Beranda

Purpose:

- Memberi ringkasan kondisi kebun dan prioritas kerja hari ini.

Layout order:

```txt
RootHeader:
  [Pemilik chip] [avatar]
  Halo, {name}
  Pantau kondisi {farmName} hari ini.

Hero card: Kondisi Kebun
  60% pohon dalam kondisi sehat
  [Total Pohon] [Sehat] [Bermasalah]

Section: Insight Kebun
  2-column stats cards:
    Total Pohon
    Pohon Sehat
    Pohon Bermasalah
    Tugas Hari Ini
    Tugas Belum Selesai
    Laporan Operasional Baru
    Pengajuan Pekerja

Section: Prioritas
  List priority cards:
    Pohon perlu perhatian
    Tugas belum selesai
    Pengajuan pekerja
    SOP jarang dipakai / optional only if data exists

Section: Aktivitas Terbaru
  Compact list:
    kondisi dicatat
    tugas selesai
    laporan masuk
```

Hero card style:

- Background: `primary`.
- Text white.
- Radius: 24.
- Padding: 20.
- Inner stat cards: translucent white with opacity 0.12.

Important:

- Jangan tampilkan semua statistik jika data kosong. Gunakan empty state ringkas.
- Jika ada prioritas kritis, section Prioritas harus muncul sebelum Aktivitas Terbaru.

## 8.2 Owner Pohon List

Purpose:

- Melihat, mencari, memfilter, dan menambah pohon.

Layout:

```txt
RootHeader:
  Data Pohon
  {count} pohon aktif di {farmName}.

SearchFilterRow:
  [Cari kode atau varietas] [filter button]

Meta row:
  Menampilkan {n} pohon                 Urut: Kode

Grid 2 columns:
  TreeCard
  TreeCard
  ...

FAB +
```

TreeCard:

```txt
[Image 100% width, aspect ratio 1.2:1]
[Badge condition top-right over image]
Code: A-1
Varietas: mentega
Fase: Berbuah
Umur: 1 tahun
```

Card style:

- Width: `(screenWidth - 20*2 - 12) / 2`.
- Radius: 18.
- Image height: 95-110.
- Padding bottom: 12.
- Gap grid: 12.

Condition placeholder:

- Jika tidak ada foto, tampilkan abstract avocado leaf placeholder, bukan blank gray.
- Placeholder background: `photoPlaceholder`.

FAB:

- Opens Tambah Pohon.

Filter bottom sheet:

- Kondisi: Semua, Sehat, Perlu Perhatian, Hama, Penyakit, Rusak, Mati.
- Fase: Semua, Awal Tanam, Vegetatif, Berbunga, Berbuah, Siap Panen/Selesai Panen.
- Status: Aktif, Arsip.
- Sort: Kode, Kondisi, Fase, Terbaru.

## 8.3 Owner Detail Pohon

Layout:

```txt
AppTopBar:
  [Back] Detail Pohon [More]

HeroImage:
  photo or placeholder

Identity:
  A-1                         [Sehat]
  mentega

InfoCard: Informasi Pohon
  2-column grid:
    Varietas: mentega
    Tanggal Tanam: 09 Sep 2024
    Umur Pohon: 1 tahun
    Lokasi: Baris A · Kolom 1
    Fase Tumbuh: Berbuah
    Status Arsip: Aktif

ActionRow:
  [Catat Kondisi] [Catat Fase]

Section: Timeline Riwayat
  Filter chips: Semua | Kondisi | Fase | Operasional
  Timeline items
```

More menu owner:

```txt
Ganti Foto Pohon
Hapus Foto Pohon
Edit Pohon
Arsipkan Pohon
```

If archived:

```txt
Pulihkan Pohon
```

Timeline item layout:

```txt
[Vertical line + dot]
[Card]
  [Badge: Kondisi/Fase/Operasional]   date/time
  Title/status
  Notes
  Photo thumbnail optional
  Dicatat oleh {name}
```

## 8.4 Owner Tambah Pohon

Pakai form section seperti V1.

Layout:

```txt
AppTopBar: Tambah Pohon

FormSection: Identitas Pohon
  Description: Kode pohon dibuat otomatis dari posisi baris dan kolom.
  Row 2 columns:
    Baris *
    Kolom *
  AutoCode preview:
    Kode pohon otomatis
    A-01
  Varietas *

FormSection: Kondisi Awal
  Tanggal Tanam
  Helper: Kosongkan jika tanggal tanam belum diketahui.
  Quick action: [Gunakan hari ini]
  Fase Awal
  Status Kondisi
  Catatan

FormSection: Foto Pohon
  Description: Opsional, digunakan sebagai identitas visual pohon.
  Photo placeholder / preview
  Row:
    [Ambil Foto]
    [Pilih Galeri]

[Primary: Simpan Pohon]
[Secondary: Batal]
```

Validation:

- Baris wajib.
- Kolom wajib.
- Varietas wajib.
- Kode otomatis harus update live saat baris/kolom berubah.
- Tanggal tanam harus date picker, bukan input manual format mentah.

Date picker display:

```txt
Pilih tanggal tanam
```

When selected:

```txt
09 September 2024
```

## 8.5 Owner Edit Pohon

Sama dengan Tambah Pohon, tetapi:

- Title: Edit Pohon.
- Code preview menampilkan kode saat ini.
- Foto section menampilkan preview existing photo.
- Tambahkan button `Hapus Foto` jika foto ada.
- Primary button: `Simpan Perubahan`.

## 8.6 Owner Catat Kondisi

Layout:

```txt
AppTopBar: Catat Kondisi

ContextCard:
  Kode pohon: Z-01
  Lokasi: Baris Z · Kolom 01
  Varietas: Miki
  Kondisi terakhir: [Sehat]

FormSection: Kondisi Baru
  Segmented vertical options:
    Sehat
    Perlu Perhatian
    Terserang Hama
    Terindikasi Penyakit
    Rusak
    Mati

FormSection: Catatan
  Textarea optional

FormSection: Foto Kondisi
  Description: Opsional, untuk mendokumentasikan kondisi pohon.
  Photo preview / placeholder
  [Ambil Foto] [Pilih Galeri]

[Primary: Simpan Kondisi]
[Secondary: Batal]
```

State selected:

- Selected option background: `primarySoft`.
- Selected option border: `primary`.
- Selected option text: `primary`.

## 8.7 Owner Catat Fase

Layout:

```txt
AppTopBar: Catat Fase

ContextCard:
  Kode pohon
  Lokasi
  Fase saat ini

FormSection: Fase Baru
  Awal Tanam
  Vegetatif
  Berbunga
  Berbuah
  Siap Panen / Panen

FormSection: Catatan
  Textarea optional

[Primary: Simpan Fase]
[Secondary: Batal]
```

Do not include photo unless it is already in V2 scope for phase. Jika belum ada, jangan tambah scope baru.

## 8.8 Owner Jadwal List

Purpose:

- Memantau jadwal perawatan dan membuat jadwal baru.

Layout:

```txt
RootHeader:
  Jadwal Perawatan
  Pantau jadwal kerja dan perawatan yang perlu diselesaikan.

Hero card:
  Hari Ini
  0 jadwal
  4 belum selesai dari seluruh jadwal aktif.
  [Belum] [Selesai] [Tertunda]

SearchFilterRow:
  Cari judul, target, atau pekerja

Meta row:
  9 jadwal                         Terdekat

List:
  ScheduleCard

FAB +
```

FAB action:

- Opens bottom sheet:

```txt
Buat Jadwal
Pilih sumber jadwal perawatan.
[Primary: Buat dari SOP]
[Secondary: Buat Manual]
```

## 8.9 Owner ScheduleCard

Layout:

```txt
[Title]                         [Status badge]
[Category badge] [Manual/SOP badge] [Butuh bukti optional]
Date icon  24 Jun 2026
Target icon  Seluruh kebun / Baris A / Pohon A-01
Worker icon  Asep
```

Style:

- Card white.
- Status badge top-right.
- If overdue, add thin left border warning/danger.

## 8.10 Owner Buat Jadwal Manual

Layout:

```txt
AppTopBar: Jadwal Manual

FormSection: Rencana Perawatan
  Judul Jadwal *
  Kategori *
    Penyiraman
    Pemupukan
    Penyemprotan
    Pengendalian Gulma
    Lainnya
  Tanggal Jadwal *

FormSection: Pekerja
  Pekerja Aktif *
  selectable worker options

FormSection: Target
  Target Jadwal *
    Seluruh Kebun
    Baris
    Kolom
    Pohon
    Target Khusus
  Conditional fields based on selected target

FormSection: Instruksi
  Textarea

FormSection: Butuh Bukti Foto
  Segmented:
    Tidak Wajib
    Wajib
  Helper: Jika wajib, pekerja harus mengunggah foto sebelum menyelesaikan tugas.

[Primary: Simpan Jadwal]
[Secondary: Batal]
```

## 8.11 Owner Buat Jadwal dari SOP

Layout:

```txt
AppTopBar: Buat dari SOP

FormSection: Pilih SOP
  SOP Perawatan *
  Preview selected SOP:
    Kategori
    Instruksi default
    Butuh bukti foto default

FormSection: Jadwal
  Tanggal Jadwal *
  Pekerja Aktif *
  Target Jadwal *

FormSection: Instruksi Tambahan
  Textarea optional

[Primary: Simpan Jadwal]
[Secondary: Batal]
```

## 8.12 Owner Detail Jadwal

Layout:

```txt
AppTopBar: Detail Jadwal

SummaryCard softGreen:
  Judul
  [Status] [Manual/SOP]
  Kategori
  Target
  Tanggal Jadwal
  Pekerja
  Jumlah Tugas

Card: Instruksi
  Instruction text or empty state

Section: Tugas Pekerja
  TaskCard(s)
```

More menu owner:

- Edit Jadwal if still pending.
- Batalkan Jadwal if allowed.

TaskCard inside detail:

```txt
Title
[Task status] [Category] [Butuh bukti]
Date
Target
Worker
```

If task is completed and has proof photo:

- Show thumbnail.
- Show completion note.
- Show completion date.

## 8.13 Owner Laporan List

Purpose:

- Melihat laporan operasional worker dan memberi tindak lanjut.

Layout:

```txt
RootHeader:
  Laporan Operasional
  Tinjau laporan lapangan dari pekerja.

Hero/Summary card:
  Laporan Masuk
  [Belum Respons] [Tindak Lanjut] [Selesai] [Ditolak]

SearchFilterRow:
  Cari judul, lokasi, atau pelapor

Filter chips:
  Semua | Belum Respons | Tindak Lanjut | Selesai | Ditolak

List:
  ReportCard
```

## 8.14 Owner ReportCard

Layout:

```txt
[Title]                         [Status badge]
Description snippet max 2 lines
Location/target
Reported by {workerName}
Date/time
[Photo badge if has photo]
```

Status color:

- Belum Respons: warning.
- Tindak Lanjut: info.
- Selesai: success.
- Ditolak: danger.

## 8.15 Owner Detail Laporan

Layout:

```txt
AppTopBar: Detail Laporan

Image/Photo preview if exists

SummaryCard:
  Title
  [Status badge]
  Category/location/target
  Pelapor
  Tanggal laporan

Card: Catatan Laporan
  Notes

Card: Tindak Lanjut
  If no response:
    [Primary: Buat Tugas Tindak Lanjut]
    [Secondary: Tandai Selesai]
    [Danger: Tolak Laporan]
  If tindak lanjut:
    Show linked task/schedule
  If selesai/ditolak:
    Show resolution notes
```

## 8.16 Owner Kebun

Owner dan worker sama-sama memakai tab Kebun. Owner memiliki permission lebih besar.

Layout owner:

```txt
RootHeader:
  Kebun
  Kelola data kebun, anggota, dan operasional.

Card: Data Kebun
  MS Farm
  Cangkring, Talang
  Luas: 6500 m²
  Total Pohon: 190
  Kode Gabung: AVOL-ABC123
  [Salin Kode] [Bagikan]

Card: Anggota Kebun
  Owner: Udin
  Pekerja aktif: 2
  Pengajuan menunggu: 1
  [Kelola Anggota]

Card: Manajemen Operasional
  Row item: Manajemen Pekerja
  Row item: Pengajuan Pekerja
  Row item: SOP Perawatan

Card: Pengaturan Kebun
  Row item: Edit Data Kebun
  Optional danger: Hapus/arsipkan kebun only if implemented

Card: Akun Saya
  Nama
  Email
  Nomor HP
  [Profil Akun]
  [Logout]
```

Important:

- Jangan beri label tab `Akun` untuk owner.
- Jangan sembunyikan profil owner. Profil tetap ada di card Akun Saya dan avatar.
- Danger action harus paling bawah.

## 8.17 Owner Manajemen Pekerja

Layout:

```txt
AppTopBar: Manajemen Pekerja

Summary row/card:
  Aktif
  Menunggu
  Ditolak/Dikeluarkan optional

Section: Pengajuan Menunggu
  WorkerRequestCard

Section: Pekerja Aktif
  WorkerMemberCard

Section: Riwayat / Ditolak optional
```

WorkerRequestCard:

```txt
Name
Email/phone
Requested at
[Approve] [Reject]
```

WorkerMemberCard:

```txt
Name
Role: Pekerja
Status: Aktif
Joined at
[Detail] [Keluarkan]
```

Danger action `Keluarkan` requires confirmation modal.

## 8.18 Owner SOP Perawatan

SOP bukan bottom tab utama. SOP berada di tab Kebun dan digunakan di Jadwal.

Layout:

```txt
AppTopBar: SOP Perawatan

Root/section intro:
  Template instruksi untuk membuat jadwal lebih cepat.

SearchFilterRow optional

List:
  SOPCard

FAB +
```

SOPCard:

```txt
Title
[Category badge]
Instruction preview max 2 lines
Butuh bukti foto: Ya/Tidak
Updated at
```

Create/Edit SOP form:

```txt
FormSection: Informasi SOP
  Nama SOP *
  Kategori *

FormSection: Instruksi Default
  Textarea *

FormSection: Bukti Foto
  Segmented:
    Tidak Wajib
    Wajib

[Primary: Simpan SOP]
[Secondary: Batal]
```

---

## 9. Worker Screens

## 9.1 Worker Beranda

Purpose:

- Membantu worker tahu apa yang harus dikerjakan hari ini.

Layout:

```txt
RootHeader:
  [Pekerja chip] [avatar]
  Halo, {name}
  Tugas kamu di {farmName} hari ini.

Hero card:
  Tugas Hari Ini
  3 tugas
  [Belum] [Selesai] [Tertunda]

Section: Prioritas Tugas
  TaskCard compact list

Section: Laporan Terakhir
  Last reports with status

Section: Aksi Cepat
  [Lihat Tugas]
  [Buat Laporan]
  [Lihat Pohon]
```

## 9.2 Worker Tugas List

Tab name: **Tugas**, not Jadwal.

Layout:

```txt
RootHeader:
  Tugas
  Selesaikan pekerjaan yang diberikan pemilik kebun.

Summary card:
  Hari Ini
  [Belum] [Selesai] [Tertunda]

Filter chips:
  Hari Ini | Belum | Tertunda | Selesai | Semua

List:
  TaskCard
```

TaskCard:

```txt
Title                         [Status]
[Category] [Butuh bukti optional]
Date
Target
Instruction preview
```

Quick action:

- If task does not require photo: allow quick `Selesaikan` from card or detail.
- If task requires photo: card CTA should say `Upload Bukti`, must go to detail/realisasi screen.

## 9.3 Worker Detail Tugas / Realisasi Tugas

Layout:

```txt
AppTopBar: Detail Tugas

SummaryCard:
  Title
  [Status] [Butuh bukti]
  Kategori
  Target
  Tanggal
  Dari jadwal/SOP

Card: Instruksi
  Instruction text

FormSection: Realisasi
  Status realisasi:
    Selesai
    Tertunda
  Catatan realisasi

FormSection: Bukti Foto
  Required if task.requires_photo = true
  Photo preview
  [Ambil Foto] [Pilih Galeri]

[Primary: Simpan Realisasi]
[Secondary: Batal]
```

Validation:

- If `requires_photo = true`, do not allow complete without photo.
- If status `Tertunda`, photo optional unless product rules say otherwise.

## 9.4 Worker Pohon List

Same visual as owner Pohon List, but:

- No FAB tambah pohon.
- No edit/archive actions.
- Detail page hides owner-only menu.

Worker allowed actions:

- View detail.
- Laporkan kondisi if scope allows.

## 9.5 Worker Detail Pohon

Layout same as owner detail, but action row differs:

```txt
[Laporkan Kondisi]
```

or if worker can also record phase:

```txt
[Laporkan Kondisi] [Catat Fase]
```

Do not show:

- Edit Pohon.
- Arsipkan Pohon.
- Ganti Foto Master.

## 9.6 Worker Laporan List

Layout:

```txt
RootHeader:
  Laporan
  Buat dan pantau laporan operasional kamu.

Summary card:
  Laporan Saya
  [Belum Respons] [Tindak Lanjut] [Selesai] [Ditolak]

Filter chips:
  Semua | Belum Respons | Tindak Lanjut | Selesai | Ditolak

List:
  ReportCard

FAB +
```

FAB:

- Opens Buat Laporan.

## 9.7 Worker Buat Laporan

Layout:

```txt
AppTopBar: Buat Laporan

FormSection: Informasi Laporan
  Judul Laporan *
  Target/Lokasi *
    Seluruh kebun
    Baris
    Kolom
    Pohon
    Lainnya

FormSection: Catatan Lapangan
  Textarea *

FormSection: Foto Laporan
  Optional photo
  [Ambil Foto] [Pilih Galeri]

[Primary: Kirim Laporan]
[Secondary: Batal]
```

## 9.8 Worker Detail Laporan

Layout:

```txt
AppTopBar: Detail Laporan

Image if exists

SummaryCard:
  Title
  [Status]
  Target/location
  Tanggal dibuat

Card: Catatan
  Notes

Card: Status Owner
  If belum respons:
    Menunggu respons pemilik.
  If tindak lanjut:
    Pemilik membuat tugas tindak lanjut.
    Show linked task if available.
  If selesai:
    Laporan sudah ditandai selesai.
  If ditolak:
    Show rejection note if available.
```

## 9.9 Worker Kebun

Layout worker:

```txt
RootHeader:
  Kebun
  Informasi kebun tempat kamu bekerja.

Card: Data Kebun
  MS Farm
  Cangkring, Talang
  Luas: 6500 m²
  Total Pohon: 190
  Owner: Udin

Card: Anggota Kebun
  Owner
  Pekerja lain
  Role masing-masing

Card: Status Akses
  Role: Pekerja
  Status: Aktif
  Bergabung sejak: {date}

Card: Akun Saya
  Nama
  Email
  Nomor HP
  [Profil Akun]

Danger action:
  [Keluar Kebun]
```

Worker permissions:

- Can view farm info.
- Can view members.
- Can edit own account via profile.
- Can leave farm.
- Cannot edit farm data.
- Cannot remove members.
- Cannot manage SOP.
- Cannot approve/reject workers.

---

## 10. Profile Account Screens

### 10.1 Profil Akun

Route is global, accessible from owner/worker/onboarding.

Layout:

```txt
AppTopBar: Profil Akun

ProfileHeaderCard:
  Avatar/initial
  Name
  Role active badge

Card: Informasi Akun
  Nama
  Nomor HP
  Email Login
  Role Aktif
  Kebun Aktif

Action row:
  [Edit Profil]
  [Password]

Danger:
  [Keluar Akun]
```

### 10.2 Edit Profil

Layout:

```txt
AppTopBar: Edit Profil

FormSection: Data Pribadi
  Nama Lengkap *
  Nomor HP

[Primary: Simpan Perubahan]
[Secondary: Batal]
```

### 10.3 Ganti Password

Layout:

```txt
AppTopBar: Password

FormSection: Keamanan Akun
  Password lama
  Password baru
  Konfirmasi password baru

[Primary: Simpan Password]
[Secondary: Batal]
```

---

## 11. Empty State, Loading, Error

### 11.1 Empty State

Pattern:

```txt
[Small illustration/icon]
Title
Description
Optional action button
```

Examples:

Pohon empty owner:

```txt
Belum ada pohon
Tambahkan pohon pertama untuk mulai memantau kebun.
[Tambah Pohon]
```

Pohon empty worker:

```txt
Belum ada pohon
Data pohon akan muncul setelah pemilik menambahkannya.
```

Laporan owner empty:

```txt
Belum ada laporan
Laporan operasional dari pekerja akan muncul di sini.
```

Tugas worker empty:

```txt
Tidak ada tugas hari ini
Tugas baru akan muncul jika pemilik membuat jadwal.
```

### 11.2 Loading State

Use skeleton cards rather than giant blank screen for list pages.

Loading list:

- Header visible.
- 3-5 skeleton cards.

Loading detail:

- Top bar visible.
- Hero skeleton.
- Info card skeleton.

### 11.3 Error State

Pattern:

```txt
Title: Data belum bisa dimuat
Description: Terjadi kendala saat mengambil data. Coba muat ulang.
[Button: Coba Lagi]
```

Do not show raw database errors to end user.

Developer logging may keep raw error in console.

### 11.4 Pull to refresh

Prefer pull-to-refresh for list pages. Avoid visible permanent `Muat Ulang` button unless in error state.

Use `RefreshControl` on ScrollView/FlatList.

---

## 12. Interaction Rules

### 12.1 Confirmation modal

Required for dangerous actions:

- Logout optional confirmation only if data unsaved.
- Keluar Kebun.
- Keluarkan worker.
- Arsipkan pohon.
- Hapus foto.
- Hapus/arsipkan kebun.

Modal layout:

```txt
Title
Description
[Danger action]
[Cancel]
```

### 12.2 Toast / feedback

Use toast/snackbar for:

- Data berhasil disimpan.
- Foto berhasil diunggah.
- Kode kebun disalin.
- Status berhasil diperbarui.

Use inline error for form validation.

### 12.3 Keyboard behavior

- All form screens must be scrollable.
- Primary button should remain reachable when keyboard appears.
- Use `KeyboardAvoidingView` on iOS and Android-safe handling.
- Inputs should not be hidden under bottom nav.

### 12.4 Photo behavior

Photo component states:

1. Empty placeholder.
2. Uploading/loading.
3. Preview selected photo.
4. Uploaded existing photo.
5. Error with retry.

Photo action layout:

```txt
[Ambil Foto] [Pilih Galeri]
[Hapus Foto] only if existing/selected photo
```

For required photo:

- Show badge `Wajib`.
- Show helper text.
- Disable completion until photo exists.

---

## 13. Implementation Notes for Codex / AI Agent

### 13.1 Do not rebuild from scratch

Do not recreate the app. Apply this as controlled redesign/refactor inside Avology V2.

### 13.2 Recommended implementation order

1. Create/update design tokens: colors, spacing, radius, typography.
2. Refactor shared UI components:
   - Screen
   - RootHeader
   - AppTopBar
   - Card
   - Button
   - Badge
   - SearchFilterRow
   - SectionHeader
   - FormSection
   - BottomNavigation config
   - EmptyState
   - PhotoPickerCard
3. Fix bottom navigation for owner and worker.
4. Refactor tab Kebun for owner and worker.
5. Refactor Profil Akun as global screen.
6. Refactor Pohon list/detail/forms.
7. Refactor Jadwal/Tugas screens.
8. Refactor Laporan screens.
9. Refactor Dashboard/Beranda screens.
10. Run typecheck and smoke test key flows.

### 13.3 Do not change database unless required

This design spec should not require new database migration except if existing schema truly lacks a field already required by V2 scope.

Do not add features outside current V2 scope just because design mentions optional display. If data does not exist, hide that field or show graceful fallback.

### 13.4 Component naming suggestion

Suggested files:

```txt
src/components/ui/Screen.tsx
src/components/ui/RootHeader.tsx
src/components/ui/AppTopBar.tsx
src/components/ui/Card.tsx
src/components/ui/Button.tsx
src/components/ui/Badge.tsx
src/components/ui/SectionHeader.tsx
src/components/ui/FormSection.tsx
src/components/ui/SearchFilterRow.tsx
src/components/ui/EmptyState.tsx
src/components/ui/PhotoPickerCard.tsx
src/constants/theme.ts
```

If the project already has `src/components/ui.tsx`, either:

- extend it carefully, or
- split gradually only if imports remain safe.

Do not do a huge import migration blindly.

### 13.5 Acceptance criteria

A screen passes design implementation if:

- It uses `color.bg` as background.
- It has correct root header or app top bar.
- Cards use consistent radius, border, and spacing.
- Bottom nav labels match role and content.
- Owner and worker both have tab Kebun.
- Profil Akun is accessible but not a main bottom tab.
- Forms are divided into section cards.
- Date input uses date picker display, not raw manual format.
- Status badges use semantic color mapping.
- Empty/loading/error states exist.
- No raw Supabase/database error appears in UI.
- Owner-only actions do not appear for worker.
- Worker-only task actions do not appear for owner.

---

## 14. Final Screen Map

### 14.1 Public/Auth

```txt
Splash / Loading
Get Started
Login
Register
Onboarding / Pilih Akses
Buat Kebun
Gabung Kebun
Menunggu Persetujuan
Pengajuan Ditolak
Profil Akun
Edit Profil
Ganti Password
```

### 14.2 Owner

```txt
Owner Beranda
Owner Pohon
  Detail Pohon
  Tambah Pohon
  Edit Pohon
  Catat Kondisi
  Catat Fase
Owner Jadwal
  Buat Jadwal Manual
  Buat Jadwal dari SOP
  Detail Jadwal
Owner Laporan
  Detail Laporan
  Buat Tugas Tindak Lanjut
Owner Kebun
  Edit Data Kebun
  Manajemen Pekerja
  SOP Perawatan
  Profil Akun
  Ganti Password
```

### 14.3 Worker

```txt
Worker Beranda
Worker Tugas
  Detail Tugas
  Realisasi Tugas
Worker Pohon
  Detail Pohon
  Laporkan Kondisi optional
Worker Laporan
  Buat Laporan
  Detail Laporan Saya
Worker Kebun
  Profil Akun
  Keluar Kebun
```

---

## 15. Final Design Decision Summary

1. V2 is the final project architecture.
2. V1 is the visual reference, not the codebase to migrate back to.
3. Owner navigation: `Beranda`, `Pohon`, `Jadwal`, `Laporan`, `Kebun`.
4. Worker navigation: `Beranda`, `Tugas`, `Pohon`, `Laporan`, `Kebun`.
5. Profile account is global, accessed from avatar and Kebun tab card.
6. Owner and worker both see Kebun, but actions differ by permission.
7. Forms must use section cards.
8. Dashboard should prioritize actionable data.
9. Laporan Operasional and SOP from V2 must be kept.
10. V2 visual style must be polished with V1 card hierarchy, spacing, and form structure.

