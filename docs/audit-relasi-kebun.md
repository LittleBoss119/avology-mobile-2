# Audit Relasi Kebun — Sisi User Tanpa Relasi & Sisi Pemilik

Tanggal audit: 2026-08-05
Branch: `ui-reconstruction-batch-1-foundation` (HEAD `ab41665`)
Sifat: **read-only**. Tidak ada file yang diubah selain dokumen ini. Tidak ada migration/SQL yang dijalankan.

---

## Bagian 1 — Peta File & Navigasi

### 1.1 Daftar file area A (user tanpa relasi kebun)

| Path | Baris | Peran |
|---|---|---|
| [app/index.tsx](../app/index.tsx) | 56 | Router root, memutuskan tujuan berdasarkan sesi + relasi |
| [app/(onboarding)/_layout.tsx](../app/(onboarding)/_layout.tsx) | 96 | Guard + stack seluruh layar tanpa relasi |
| [app/(onboarding)/onboarding.tsx](../app/(onboarding)/onboarding.tsx) | 74 | Layar "Pilih Akses" (buat / gabung) |
| [app/(onboarding)/create-farm.tsx](../app/(onboarding)/create-farm.tsx) | 74 | Form buat kebun |
| [app/(onboarding)/join-farm.tsx](../app/(onboarding)/join-farm.tsx) | 52 | Form input kode kebun |
| [app/(onboarding)/pending-approval.tsx](../app/(onboarding)/pending-approval.tsx) | 10 | Wrapper tipis → `AccessStatusScreen` |
| [app/(onboarding)/rejected.tsx](../app/(onboarding)/rejected.tsx) | 10 | Wrapper tipis → `AccessStatusScreen` |
| [app/(onboarding)/removed-access.tsx](../app/(onboarding)/removed-access.tsx) | 10 | Wrapper tipis → `AccessStatusScreen` |
| [app/(onboarding)/profile.tsx](../app/(onboarding)/profile.tsx) | 3 | Re-export `ProfileScreen` |
| [app/(onboarding)/profile-edit.tsx](../app/(onboarding)/profile-edit.tsx) | 3 | Re-export `ProfileEditScreen` |
| [app/(onboarding)/password.tsx](../app/(onboarding)/password.tsx) | 3 | Re-export `AccountPasswordScreen` |
| [src/components/access-status-screen.tsx](../src/components/access-status-screen.tsx) | 139 | **Satu komponen untuk 3 state**: pending, rejected, removed |
| [src/components/profile-screen.tsx](../src/components/profile-screen.tsx) | 261 | Profil akun (dipakai onboarding + owner + worker) |
| [src/components/profile-edit-screen.tsx](../src/components/profile-edit-screen.tsx) | 196 | Edit profil bersama |
| [src/utils/routeGuard.ts](../src/utils/routeGuard.ts) | 168 | Semua keputusan rute akses |
| [src/context/auth-context.tsx](../src/context/auth-context.tsx) | 214 | Sumber `profile` + `currentFarm` |
| [src/services/farmService.ts](../src/services/farmService.ts) | 313 | `createFarm`, `getCurrentUserFarm`, `getFarmDetail` |
| [src/services/memberService.ts](../src/services/memberService.ts) | 308 | `requestJoinFarm`, dll. |

### 1.2 Daftar file area B (sisi pemilik)

| Path | Baris | Peran |
|---|---|---|
| [app/(owner)/owner/farm.tsx](../app/(owner)/owner/farm.tsx) | 521 | Tab Kebun: identitas, kode, anggota, pengajuan, sheet tinjau |
| [app/(owner)/owner/farm-profile.tsx](../app/(owner)/owner/farm-profile.tsx) | 238 | Edit identitas kebun |
| [app/(owner)/owner/workers.tsx](../app/(owner)/owner/workers.tsx) | 112 | Layar "Riwayat akses" |
| [app/(owner)/_layout.tsx](../app/(owner)/_layout.tsx) | 120 | Guard + stack owner |
| [src/components/member-row.tsx](../src/components/member-row.tsx) | 120 | Baris anggota + Avatar (dipakai owner & worker) |
| [src/components/bottom-sheet.tsx](../src/components/bottom-sheet.tsx) | 367 | `BottomSheet` + `ConfirmDialog` |
| [app/(worker)/worker/farm.tsx](../app/(worker)/worker/farm.tsx) | 256 | Tab Kebun sisi pekerja (pembanding duplikasi) |

Migration yang relevan: `002`, `006`, `007`, `008`, `011`, `012`, `020`, `033`.

### 1.3 Di mana aplikasi memutuskan user "tidak punya relasi kebun"

Tiga lapis, semuanya bersumber pada satu nilai:

1. **Sumber data**: [src/services/farmService.ts:76-131](../src/services/farmService.ts) `getCurrentUserFarm()`. Jalur utama adalah RPC `get_current_user_access` ([farmService.ts:133-143](../src/services/farmService.ts)). Kalau RPC tidak ada, ada fallback query langsung ke `farm_members` ([farmService.ts:103-108](../src/services/farmService.ts)).
2. **Penyimpanan state**: [src/context/auth-context.tsx:52-66](../src/context/auth-context.tsx) → `currentFarm` bernilai `null` kalau tidak ada baris `farm_members` sama sekali.
3. **Keputusan rute**: [src/utils/routeGuard.ts:30-32](../src/utils/routeGuard.ts) — `if (!membership) return '/onboarding'`.

Keputusan final ada di **[src/utils/routeGuard.ts:30](../src/utils/routeGuard.ts)**.

### 1.4 Apakah tiga kondisi dibedakan?

**Ya, dibedakan** — tapi bukan di satu tempat yang sama seperti dugaan.

| Kondisi | Lokasi keputusan | Rute |
|---|---|---|
| (a) Tidak punya relasi sama sekali | [routeGuard.ts:30](../src/utils/routeGuard.ts) (`membership === null`) | `/onboarding` |
| (b) Punya pengajuan pending | [routeGuard.ts:34](../src/utils/routeGuard.ts) (`status === 'pending'`) | `/pending-approval` |
| (c) Pengajuan terakhir ditolak | [routeGuard.ts:38](../src/utils/routeGuard.ts) (`status === 'rejected'`) | `/rejected` |
| (d) Dinonaktifkan pemilik / keluar sendiri | [routeGuard.ts:42](../src/utils/routeGuard.ts) (`status === 'removed'`) | `/removed-access` |

**Tapi** ketiganya jatuh ke **satu komponen tampilan yang sama**: `/pending-approval`, `/rejected`, `/removed-access` semuanya cuma wrapper 10-baris yang memanggil [`AccessStatusScreen`](../src/components/access-status-screen.tsx) dengan `title`/`subtitle` berbeda. Percabangan visual dilakukan di dalam komponen itu lewat `currentFarm.status` ([access-status-screen.tsx:48-55, 116-120](../src/components/access-status-screen.tsx)). Jadi: **rute terpisah, layar menyatu**.

Catatan penting: `removed` menampung dua peristiwa yang berbeda maknanya — dikeluarkan pemilik (`removed_reason = 'removed_by_owner'`) dan keluar sendiri (`'left_by_worker'`) — dan UI tidak membedakan keduanya sama sekali.

### 1.5 Aplikasi ditutup lalu dibuka lagi saat pengajuan pending

**User kembali ke layar tunggu, bukan ke pilih akses.** Statusnya persisten di database (`farm_members.status = 'pending'`), bukan di state lokal. Alur saat cold start:

`AuthProvider` mount → `refresh()` ([auth-context.tsx:69-83](../src/context/auth-context.tsx)) → `getCurrentUserFarm()` → RPC → `currentFarm.status = 'pending'` → [routeGuard.ts:34](../src/utils/routeGuard.ts) → `/pending-approval`.

Hal yang sama berlaku untuk status `rejected` dan `removed` — semuanya persisten. Tidak ada ketergantungan pada AsyncStorage untuk status pengajuan.

**Konsekuensi yang perlu diperhatikan**: karena status ditentukan oleh **satu baris terbaru** (`order by coalesce(updated_at, created_at) desc limit 1`, [migration 020:1183](../supabase/migrations/020_feature_completion_database_foundation.sql)), user yang punya lebih dari satu baris `farm_members` bisa "berpindah identitas" begitu salah satu baris di-update. Lihat temuan **R-01**.

### 1.6 Perpindahan ke dashboard setelah buat kebun / disetujui

**Setelah buat kebun** ([create-farm.tsx:42-44](../app/(onboarding)/create-farm.tsx)):
```
await createFarm(...)  →  await refresh()  →  router.replace('/')
```
`refresh()` dipanggil dan **ditunggu** sebelum navigasi, jadi state tidak basi. `/` kemudian meredirect ke `/owner`. Ada satu render antara — user melihat `LoadingState "Mengarahkan..."` sekejap. Tidak ada layar konfirmasi berisi kode bergabung.

**Setelah pengajuan disetujui**: tidak ada trigger apa pun dari sisi server. Perpindahan hanya terjadi saat user memicu refresh sendiri:
- `useFocusEffect` di [access-status-screen.tsx:20-35](../src/components/access-status-screen.tsx) — refetch saat layar difokuskan;
- `useFocusEffect` di [(onboarding)/_layout.tsx:25-40](../app/(onboarding)/_layout.tsx) — refetch di level layout;
- tombol "Cek Status" ([access-status-screen.tsx:63](../src/components/access-status-screen.tsx)) yang memanggil `refresh()` lalu `router.replace('/')`.

**Risiko state basi**: ada, tapi bukan basi ke arah berbahaya. Selama app terbuka di layar tunggu dan tidak ada perubahan fokus, user tidak akan tahu pengajuannya sudah disetujui. Tidak ada polling, tidak ada realtime subscription.

Ada satu titik yang layak dicatat: `refresh()` di layout dan `refresh()` di `AccessStatusScreen` dua-duanya menyala saat layar difokuskan, jadi setiap fokus memicu **dua** pemanggilan `get_current_user_access` + kemungkinan `getFarmDetail`. Ada guard `refreshVersionRef` ([auth-context.tsx:25-37](../src/context/auth-context.tsx)) yang mencegah hasil lama menimpa hasil baru, jadi ini pemborosan request, bukan bug korektness.

---

## Bagian 2 — Model Data & Sumber Kebenaran Status

### 2.1 Tabel

Hanya **satu tabel** yang memegang relasi user–kebun, pengajuan, dan riwayat akses sekaligus: `public.farm_members`.

**`public.farms`** ([migration 002:9-21](../supabase/migrations/002_create_core_tables.sql)):
| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `name` | text not null | |
| `location` | text | nullable |
| `area_size` | numeric | check `> 0` atau null |
| `join_code` | text not null **unique** | |
| `created_by` | uuid → `profiles(id)` **on delete restrict** | |
| `created_at` / `updated_at` | timestamptz | |

**`public.farm_members`** ([migration 002:23-39](../supabase/migrations/002_create_core_tables.sql) + [migration 020:156-172](../supabase/migrations/020_feature_completion_database_foundation.sql)):
| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | uuid PK | |
| `farm_id` | uuid → `farms(id)` on delete **cascade** | |
| `user_id` | uuid → `profiles(id)` on delete **cascade** | |
| `role` | `public.member_role` not null | enum |
| `status` | `public.member_status` not null default `'pending'` | enum |
| `joined_at` | timestamptz | check: wajib non-null kalau status `active` |
| `created_at` / `updated_at` | timestamptz | `updated_at` diisi trigger ([migration 006:434-436](../supabase/migrations/006_create_indexes_and_triggers.sql)) |
| `removed_at` | timestamptz | ditambah di migration 020 |
| `removed_by` | uuid → `profiles(id)` on delete set null | ditambah di migration 020 |
| `removed_reason` | text | nilai bebas; sejauh terbaca hanya `'removed_by_owner'` dan `'left_by_worker'` |

Constraint: `farm_members_unique_user_per_farm unique (farm_id, user_id)`.
Index: `(farm_id, user_id)`, `(farm_id, status)`, `(user_id, status)` ([migration 006:1-8](../supabase/migrations/006_create_indexes_and_triggers.sql)).

**Tidak ada tabel riwayat akses terpisah.** "Riwayat akses" adalah hasil filter di klien atas baris `farm_members` yang statusnya `rejected` atau `removed` ([workers.tsx:19-21](../app/(owner)/owner/workers.tsx)). Ini konsekuensi besar — lihat **G4** dan **R-02**.

### 2.2 Bentuk penyimpanan status

**Enum PostgreSQL**, bukan text + check.
- `public.member_role` = `('owner', 'worker')` — [migration 001:5-7](../supabase/migrations/001_create_extensions_and_enums.sql)
- `public.member_status` = `('pending', 'active', 'rejected', 'removed')` — [migration 001:9-11](../supabase/migrations/001_create_extensions_and_enums.sql)

Keduanya dibuat dalam blok `do $$ ... if not exists`, jadi **tidak idempotent terhadap perubahan nilai** — kalau enum sudah ada, blok ini tidak menambah/mengubah apa pun.

### 2.3 Berapa tempat di TypeScript yang mendefinisikan nilai status/peran

**Tiga tempat**, tersebar:

1. **Definisi tipe** — [src/types/domain.ts:18](../src/types/domain.ts) `MemberRole` dan [src/types/domain.ts:20](../src/types/domain.ts) `MemberStatus`. Ini union type literal, satu-satunya definisi tipe.
2. **Label bahasa Indonesia** — [src/utils/displayFormat.ts:18-25](../src/utils/displayFormat.ts) `formatRole()` dan [src/utils/displayFormat.ts:27-36](../src/utils/displayFormat.ts) `formatMemberStatus()`.
3. **Label yang di-hardcode ulang di layar**, tidak lewat `displayFormat`:
   - [app/(owner)/owner/farm.tsx:192](../app/(owner)/owner/farm.tsx) — `"Pemilik · kamu"`
   - [app/(owner)/owner/farm.tsx:200](../app/(owner)/owner/farm.tsx) — `` `Pekerja · sejak ...` ``
   - [app/(owner)/owner/workers.tsx:77](../app/(owner)/owner/workers.tsx) — `'Ditolak'` / `'Dinonaktifkan'` (perhatikan: `'Dinonaktifkan'` ≠ `'Akses Dinonaktifkan'` di `displayFormat.ts:32`)
   - [app/(worker)/worker/farm.tsx:229](../app/(worker)/worker/farm.tsx) — `'Pemilik'` / `'Pekerja'`
   - [app/(onboarding)/onboarding.tsx:32, 53](../app/(onboarding)/onboarding.tsx) — Badge `"Pemilik"` / `"Pekerja"`

Selain itu, nilai literal status dipakai sebagai perbandingan tersebar di ±10 file (`status === 'active'`, `status === 'pending'`, dst.) — antara lain [routeGuard.ts:34,38,42,58,62](../src/utils/routeGuard.ts), [farm.tsx:47-53](../app/(owner)/owner/farm.tsx), [workers.tsx:20](../app/(owner)/owner/workers.tsx), [worker/farm.tsx:29](../app/(worker)/worker/farm.tsx), [access-status-screen.tsx:48-55](../src/components/access-status-screen.tsx), [profile-screen.tsx](../src/components/profile-screen.tsx) (lewat `isOwnerActive`/`isWorkerActive`).

### 2.4 Apakah ada file konstanta terpusat untuk keanggotaan?

**Belum ada.** Yang ada hanya [src/constants/operationalReport.ts](../src/constants/operationalReport.ts) (78+ baris) untuk laporan operasional, dengan pola yang jelas: array `as const` + tipe turunan + komentar yang menyebut migration pasangannya.

Tidak ada `src/constants/membership.ts` atau sejenisnya. `MemberStatus`/`MemberRole` hidup sebagai union type telanjang di `domain.ts` tanpa array runtime, sehingga tidak bisa diiterasi, tidak bisa divalidasi saat runtime, dan tidak punya jangkar komentar ke migration mana pun.

**Ini temuan** — lihat **C-01**.

### 2.5 Perbandingan urutan nomor migration

35 file, penomoran `001`–`035`.

- **Nomor lompat**: `017` **tidak ada**. Loncat dari `016_add_requires_photo_and_task_proof.sql` ke `018_sync_requires_photo_schedule_task_rpc.sql`.
- **Nomor duplikat**: tidak ada.
- **File yang menyentuh tabel/fungsi yang sama berulang kali** — ini yang paling relevan untuk audit ini:

| Objek | Didefinisikan ulang di | Jumlah |
|---|---|---|
| `request_join_farm` | 008:62, 012:42, **020:952 (terakhir/aktif)** | 3× |
| `get_current_user_access` | 011:1, 012:1, **020:1141 (terakhir/aktif)** | 3× |
| `approve_worker` | 008:132, **020:1030 (terakhir/aktif)** | 2× |
| `remove_worker` | 008:202, **020:1068 (terakhir/aktif)** | 2× |
| `reject_worker` | **008:167 (satu-satunya)** | 1× |
| `farm_members` (DDL) | 002:23 (create), 020:156 (add columns) | 2× |

**Temuan penting dari perbandingan ini**: `approve_worker` dan `remove_worker` diperbarui di migration 020 untuk mengelola kolom `removed_at`/`removed_by`/`removed_reason`, tetapi **`reject_worker` tidak ikut diperbarui**. Akibatnya penolakan tidak pernah mengisi `removed_at`. Lihat **R-03**.

Perbedaan halus antara versi 008 dan 012/020 dari `request_join_farm`: versi 008 ([008:120-128](../supabase/migrations/008_create_rpc_functions.sql)) melakukan `on conflict do update` **tanpa klausa `where`** — artinya bahkan baris `active` bisa ditimpa jadi `pending`. Versi 012 dan 020 menambahkan `where public.farm_members.status in ('rejected','removed')`. Versi aktif sudah aman; catatan ini penting kalau ada database yang berhenti di migration 008–011.

---

## Bagian 3 — Service Layer & RPC

### 3.1 & 3.2 Daftar fungsi + jalur + guard

| Aksi | Fungsi TS | Jalur DB | Tipe | Guard peran di dalamnya |
|---|---|---|---|---|
| Buat kebun | [`createFarm`](../src/services/farmService.ts) (farmService.ts:54-74) | RPC `create_farm_with_owner` | SECURITY DEFINER ([020 tidak override; 008:1-60](../supabase/migrations/008_create_rpc_functions.sql)) | Hanya cek `auth.uid()` non-null + profil ada. **Tidak ada guard peran** (memang tidak perlu) |
| Gabung kebun | [`requestJoinFarm`](../src/services/memberService.ts) (memberService.ts:64-84) | RPC `request_join_farm` | SECURITY DEFINER ([020:952-1028](../supabase/migrations/020_feature_completion_database_foundation.sql)) | Cek auth + profil + kode valid + tidak ada pending/active **di kebun itu saja** |
| Terima | [`approveWorker`](../src/services/memberService.ts) (memberService.ts:175-179) | RPC `approve_worker` | SECURITY DEFINER ([020:1030-1066](../supabase/migrations/020_feature_completion_database_foundation.sql)) | `is_active_owner(target_farm_id, auth.uid())` ✔ |
| Tolak | [`rejectWorker`](../src/services/memberService.ts) (memberService.ts:181-185) | RPC `reject_worker` | SECURITY DEFINER ([008:167-200](../supabase/migrations/008_create_rpc_functions.sql)) | `is_active_owner(...)` ✔ |
| Nonaktifkan anggota | [`removeWorker`](../src/services/memberService.ts) (memberService.ts:187-191) | RPC `remove_worker` | SECURITY DEFINER ([020:1068-1103](../supabase/migrations/020_feature_completion_database_foundation.sql)) | `is_active_owner(...)` ✔ |
| Keluar dari kebun | [`leaveCurrentFarm`](../src/services/memberService.ts) (memberService.ts:193-207) | RPC `leave_current_farm` | SECURITY DEFINER ([020:1105-1137](../supabase/migrations/020_feature_completion_database_foundation.sql)) | Cari baris milik `auth.uid()` sendiri, role `worker`, status `active` ✔ |
| Baca relasi sendiri | [`getCurrentUserFarm`](../src/services/farmService.ts) (farmService.ts:76-131) | RPC `get_current_user_access` | SECURITY DEFINER ([020:1141-1186](../supabase/migrations/020_feature_completion_database_foundation.sql)) | Hanya cek auth; selalu difilter `user_id = auth.uid()` ✔ |
| Detail kebun | [`getFarmDetail`](../src/services/farmService.ts) (farmService.ts:182-194) | **Query langsung** `from('farms')` | RLS | Policy `Active members can view farm` ([007:115-120](../supabase/migrations/007_enable_rls_and_policies.sql)) — **hanya anggota aktif** |
| Daftar anggota+pengajuan+riwayat | [`getWorkerMemberships`](../src/services/memberService.ts) (memberService.ts:142-173) | **Query langsung** `from('farm_members')` + RPC `get_member_basic_profiles` | RLS + DEFINER | Policy `user_id = auth.uid() or is_active_owner(farm_id, auth.uid())` ([007:132-139](../supabase/migrations/007_enable_rls_and_policies.sql)) ✔ |
| Daftar pengajuan (khusus) | [`getPendingWorkers`](../src/services/memberService.ts) (memberService.ts:86-98) | RPC `get_pending_workers` | SECURITY DEFINER ([008:269-307](../supabase/migrations/008_create_rpc_functions.sql)) | `is_active_owner(...)` ✔ — **tapi fungsi TS ini tidak dipakai di layar mana pun** (dead code) |
| Anggota untuk sisi pekerja | [`getFarmActorDisplayProfiles`](../src/services/memberService.ts) (memberService.ts:128-140) | RPC `get_farm_actor_display_profiles` | SECURITY DEFINER ([033:42-73](../supabase/migrations/033_restore_farm_actor_display_profiles.sql) / 011) | `is_active_farm_member(...)` ✔ |
| Edit identitas kebun | [`updateFarmProfile`](../src/services/farmService.ts) (farmService.ts:196-223) | RPC `update_farm_profile` | SECURITY DEFINER ([020:920-950](../supabase/migrations/020_feature_completion_database_foundation.sql)) | `is_active_owner(...)` ✔ |

Semua RPC di atas punya pola grant yang benar: `revoke execute ... from public, anon` lalu `grant execute ... to authenticated`.

### 3.3 Atomisitas operasi terima/tolak

**Ya, atomik — karena setiap operasi hanya menyentuh satu tabel.** `approve_worker`, `reject_worker`, dan `remove_worker` masing-masing melakukan tepat satu `UPDATE public.farm_members`. Fungsi PL/pgSQL berjalan dalam satu transaksi implisit, jadi tidak ada risiko setengah jalan.

**Tetapi ini atomik karena alasan yang salah**: tidak ada tabel riwayat akses terpisah untuk ditulis. "Riwayat" adalah baris `farm_members` yang sama, kolom `status`-nya diubah di tempat. Begitu tabel riwayat dipisahkan (yang perlu dipertimbangkan — lihat **R-02**), atomisitas ini harus dijaga secara eksplisit di dalam satu fungsi.

`create_farm_with_owner` menyentuh **dua** tabel (`farms` lalu `farm_members`) dalam satu fungsi — tetap satu transaksi, aman.

### 3.4 RPC generik yang menerima status sembarang?

**Tidak ada.** Semua sudah intent-based per aksi: `approve_worker`, `reject_worker`, `remove_worker`, `leave_current_farm`. Tidak ada `update_membership_status(p_status)` atau sejenisnya. Ini titik terang dari desain sekarang dan sebaiknya dipertahankan.

Sebagai pembanding, di domain lain repo ini punya `update_operational_report_status(p_status ...)` yang **memang** pola generik. Itu di luar scope audit ini.

Di sisi TS, ketiganya dibungkus satu helper `updateWorkerMembership(rpcName, ...)` ([memberService.ts:209-225](../src/services/memberService.ts)) yang menerima nama RPC sebagai union literal — aman secara tipe, tidak mengurangi sifat intent-based.

---

## Bagian 4 — Gap Analysis terhadap Desain Target

### G1 — Validasi kode + pratinjau kebun sebelum pengajuan

**BELUM ADA.**

Alur sekarang ([join-farm.tsx:16-31](../app/(onboarding)/join-farm.tsx)): user ketik kode → tekan "Ajukan Gabung" → `requestJoinFarm` langsung menembak `request_join_farm` yang **sekaligus membuat baris pengajuan**. Tidak ada langkah verifikasi terpisah, tidak ada pratinjau.

**Konfirmasi soal RLS — kekhawatiran Anda benar.** Policy `farms` untuk SELECT adalah `Active members can view farm` dengan `using (public.is_active_farm_member(id, auth.uid()))` ([007:115-120](../supabase/migrations/007_enable_rls_and_policies.sql)). Non-anggota **tidak bisa** membaca `farms` sama sekali. `grant select, update on public.farms to authenticated` ([007:348](../supabase/migrations/007_enable_rls_and_policies.sql)) tidak menolong karena RLS tetap memfilter baris.

Jadi pratinjau **wajib** lewat RPC `SECURITY DEFINER` baru. Tidak ada RPC seperti itu di repo — saya sudah menyisir seluruh `supabase/migrations/*.sql` untuk pola `preview`, `lookup`, `by_join_code`, `farm_preview`: nihil.

**Data yang boleh bocor ke non-anggota** (rekomendasi tegas, karena RPC DEFINER menembus RLS):
- BOLEH: `farms.name`, `farms.location`, `farms.area_size`, nama lengkap pemilik (`profiles.full_name` dari anggota `role='owner' and status='active'`), jumlah anggota aktif (angka saja).
- **JANGAN**: `farms.id`, `farms.created_by`, `farms.join_code`, nomor HP siapa pun, daftar nama anggota, `farms.created_at`.

Alasan `farms.id` masuk daftar larangan: pengajuan tetap harus dikirim dengan **kode**, bukan `farm_id`, supaya RPC pengajuan tidak bisa dipakai untuk enumerasi UUID kebun.

Perlu juga dipikirkan bahwa RPC ini menjadi **oracle kode kebun**: siapa pun yang login bisa menebak kode 8 karakter hex dan mendapat nama + lokasi kebun. Ruang kode 16^8 ≈ 4,3 miliar, jadi tebakan acak tidak praktis, tapi rate limiting layak dipertimbangkan. Ini keputusan produk, bukan temuan teknis.

### G2 — Membatalkan pengajuan oleh user sendiri

**BELUM ADA.** Tidak ada fungsi TS, tidak ada RPC, tidak ada tombol.

`leave_current_farm` ([020:1105-1137](../supabase/migrations/020_feature_completion_database_foundation.sql)) tidak bisa dipakai ulang: ia mensyaratkan `role = 'worker' and status = 'active'`, jadi baris `pending` tidak akan ketemu dan fungsi melempar `'Active worker membership not found'`.

Satu-satunya "jalan keluar" dari state pending sekarang: menunggu pemilik memproses, atau logout. Tidak ada cara membatalkan.

### G3 — Pemohon membaca status pengajuannya sendiri setelah ditolak

**SUDAH ADA.** Dua lapis, keduanya bekerja:

1. **RLS**: policy `Users view own membership and owners view farm members` ([007:132-139](../supabase/migrations/007_enable_rls_and_policies.sql)) menggunakan `using (user_id = auth.uid() or public.is_active_owner(farm_id, auth.uid()))`. Klausa `user_id = auth.uid()` **tidak memfilter status sama sekali** — baris `rejected` dan `removed` tetap terbaca oleh pemiliknya sendiri. ✔
2. **RPC**: `get_current_user_access` adalah SECURITY DEFINER dan sama sekali tidak memfilter status ([020:1179-1184](../supabase/migrations/020_feature_completion_database_foundation.sql)) — RLS pun tidak berlaku. ✔

**Tapi ada lubang di data turunannya**: `farms` tetap tidak terbaca oleh user berstatus `rejected`/`pending`. Dan meskipun `get_current_user_access` **sudah mengembalikan kolom `farm_name`** ([020:1154, 1178](../supabase/migrations/020_feature_completion_database_foundation.sql)), sisi klien membuangnya: `mapCurrentUserAccessResult` ([farmService.ts:145-180](../src/services/farmService.ts)) hanya memakai `farm_name` … sebenarnya **tidak memakainya sama sekali** — field `farm_name` ada di tipe `CurrentUserAccessRow` ([farmService.ts:51](../src/services/farmService.ts)) tapi tidak pernah dibaca, dan untuk status non-aktif fungsi langsung `return ok(membership)` tanpa `farm` ([farmService.ts:166-168](../src/services/farmService.ts)).

Akibatnya layar tunggu **selalu** menampilkan `Kebun tujuan: Belum tersedia` ([access-status-screen.tsx:112](../src/components/access-status-screen.tsx)) — user pending/ditolak tidak pernah tahu kebun mana yang dia ajukan. Ini temuan **R-04**, dan perbaikannya murah: pakai `farm_name` yang sudah tersedia.

### G4 — "Coba kode lain" setelah ditolak: baris lama diapakan?

**ADA TAPI BEDA — dan ini titik paling berbahaya di seluruh audit.**

Tombolnya sudah ada tapi namanya lain: "Gabung Kebun Lagi" ([access-status-screen.tsx:77-86](../src/components/access-status-screen.tsx)) yang mengarah ke `/join-farm` dengan param `inactiveRecovery=1`.

Yang terjadi pada baris lama tergantung kode yang dimasukkan:

**Kasus A — kode kebun yang SAMA (kebun yang menolak dia):**
`request_join_farm` kena `on conflict (farm_id, user_id) do update` ([020:1010-1019](../supabase/migrations/020_feature_completion_database_foundation.sql)) dengan `where public.farm_members.status in ('rejected','removed')`. Baris lama **ditimpa di tempat**: `status → 'pending'`, `removed_at/removed_by/removed_reason → null`, `updated_at → now()`.

**Konsekuensi ke riwayat akses: entri riwayat itu HILANG PERMANEN.** Karena "Riwayat akses" hanyalah filter `status in ('rejected','removed')` atas tabel yang sama ([workers.tsx:19-21](../app/(owner)/owner/workers.tsx)), begitu baris berubah jadi `pending` catatan penolakan/penonaktifannya lenyap dari layar pemilik. Tidak ada jejak bahwa orang ini pernah ditolak. Ini **KRITIS** — lihat **R-02**.

**Kasus B — kode kebun BERBEDA:**
`INSERT` baris baru untuk `(farm_B, user)`. Baris lama di `farm_A` **dibiarkan utuh** dengan status `rejected`. Riwayat di kebun A aman.

**Tapi**: user sekarang punya **dua** baris `farm_members`, dan `get_current_user_access` hanya mengambil satu (yang `updated_at` terbaru). Ini bekerja selama kebun A tidak menyentuh baris lama — dan kebun A memang tidak bisa (`approve_worker`/`reject_worker` mensyaratkan `status='pending'`). Jadi kasus B relatif aman, tapi meninggalkan baris yatim yang menumpuk.

### G5 — Penjagaan satu pengajuan aktif per user

**ADA TAPI BEDA — penjagaannya per-kebun, bukan per-user.**

| Level | Yang dijaga | Lokasi |
|---|---|---|
| Database (constraint) | `unique (farm_id, user_id)` — satu baris per pasangan user-kebun | [002:33](../supabase/migrations/002_create_core_tables.sql) |
| Database (RPC) | Tidak boleh punya pending/active **di kebun yang dituju** | [020:986-994](../supabase/migrations/020_feature_completion_database_foundation.sql) |
| UI | `shouldRedirectAccess` memblokir user pending dari membuka `/join-farm` dan `/create-farm` | [routeGuard.ts:98-104, 131-142](../src/utils/routeGuard.ts) |

**Tidak ada unique index global** semacam `unique (user_id) where status in ('pending','active')`. Artinya di level database, satu user **boleh** punya pending di kebun A **dan** pending di kebun B **dan** active sebagai owner di kebun C secara bersamaan.

Yang mencegah itu terjadi sekarang hanyalah **route guard di UI**. `request_join_farm` sendiri sama sekali tidak memeriksa apakah pemanggilnya sudah jadi anggota aktif kebun lain. Lihat **R-01** untuk skenario kerusakannya.

### G6 — Query daftar anggota di tab Kebun, dan angka "3 orang" vs 4 baris

**SUDAH ADA (satu query) — dan ya, saya bisa mengonfirmasi penyebab angka yang tidak cocok.**

**Satu query untuk semuanya**: `getWorkerMemberships(farmId)` ([memberService.ts:142-173](../src/services/memberService.ts)) mengambil **seluruh** baris `farm_members` dengan `role='worker'` tanpa filter status — pending, active, rejected, removed, semuanya. Pemisahan dilakukan di klien:
- `pendingWorkers` — [farm.tsx:47](../app/(owner)/owner/farm.tsx)
- `activeWorkers` — [farm.tsx:48-50](../app/(owner)/owner/farm.tsx)
- `historyCount` — [farm.tsx:51-53](../app/(owner)/owner/farm.tsx)

**Penyebab "3 orang" tapi 4 baris — terkonfirmasi, dan penyebabnya kebalikan dari dugaan umum:**

```
farm.tsx:54   const memberCount = 1 + activeWorkers.length;   // pemilik + pekerja aktif — pending TIDAK dihitung
```

Jadi **angkanya justru sudah benar** menurut desain target ("hitungan hanya menghitung anggota sungguhan"). Yang salah adalah **barisnya**: pengajuan pending di-`push` ke array `memberRows` yang sama ([farm.tsx:178-190](../app/(owner)/owner/farm.tsx)), **sebelum** baris pemilik ([farm.tsx:192](../app/(owner)/owner/farm.tsx)) dan baris pekerja aktif ([farm.tsx:194-215](../app/(owner)/owner/farm.tsx)), lalu semuanya dirender di dalam satu `Card` di bawah `SectionLabel title="Anggota"` ([farm.tsx:304-319](../app/(owner)/owner/farm.tsx)).

Dengan 1 pemilik + 2 pekerja aktif + 1 pengajuan: `memberCount` = 3, jumlah baris = 4. **Persis gejala yang Anda lihat.**

Baris "Riwayat akses" ([farm.tsx:224-246](../app/(owner)/owner/farm.tsx)) juga ikut di-push ke array yang sama, jadi sebenarnya ada 5 baris di dalam kartu "Anggota" — satu di antaranya bukan orang sama sekali.

Perbaikannya sejalan dengan desain target: keluarkan pending jadi section sendiri di atas, dan keluarkan "Riwayat akses" dari kartu anggota.

### G7 — Mekanisme refresh di layar tunggu

**ADA TAPI BEDA.** Yang ada sekarang:

| Mekanisme | Status | Lokasi |
|---|---|---|
| Refetch on focus | ✔ ADA, bahkan dobel | [access-status-screen.tsx:20-35](../src/components/access-status-screen.tsx) + [(onboarding)/_layout.tsx:25-40](../app/(onboarding)/_layout.tsx) |
| Tombol manual "Cek Status" | ✔ ADA — **desain target minta ini dihapus** | [access-status-screen.tsx:62-64](../src/components/access-status-screen.tsx) |
| Pull-to-refresh | ✘ TIDAK ADA | `Screen` di [ui.tsx:231](../src/components/ui.tsx) memakai `ScrollView` polos tanpa `refreshControl` — saya menyisir seluruh `ui.tsx`, tidak ada `RefreshControl` sama sekali di repo |
| Polling | ✘ TIDAK ADA | — |
| Realtime subscription | ✘ TIDAK ADA | Tidak ada `supabase.channel(...)` di mana pun |

Jadi jarak ke target: hapus tombol "Cek Status", tambahkan pull-to-refresh (yang memerlukan `Screen` mendukung `refreshControl` — ini menyentuh komponen bersama, jadi berdampak lebih luas dari sekadar layar tunggu).

### G8 — Riwayat akses: event apa yang benar-benar ditulis

**Konfirmasi: benar, hanya "ditolak" dan "dinonaktifkan" yang muncul. "Diterima" memang tidak tercatat.**

**Tabel**: `public.farm_members` — **tidak ada tabel event terpisah**.
**Kolom event**: tidak ada kolom `event`. Yang berperan sebagai penanda event adalah kombinasi:
- `status` (`rejected` / `removed`) — inilah filternya ([workers.tsx:20](../app/(owner)/owner/workers.tsx))
- `removed_reason` — `'removed_by_owner'` atau `'left_by_worker'`, **tidak ditampilkan di UI mana pun**
- `removed_at` / `removed_by` — hanya terisi untuk `removed`
- `updated_at` — dipakai sebagai stempel waktu untuk `rejected` ([workers.tsx:81-87](../app/(owner)/owner/workers.tsx))

Kenapa "diterima" tidak tercatat: `approve_worker` mengubah `status` menjadi `'active'` ([020:1057-1064](../supabase/migrations/020_feature_completion_database_foundation.sql)). Karena riwayat = filter atas `status`, baris `active` otomatis keluar dari daftar riwayat. Tidak ada baris kedua yang dibuat.

Tiga masalah turunan dari desain "riwayat = status saat ini":
1. Riwayat **hilang** kalau orangnya mengajukan ulang ke kebun yang sama (**R-02**).
2. Riwayat **maksimal satu entri per orang per kebun** — kalau seseorang ditolak, diterima, lalu dinonaktifkan, yang tersisa hanya "dinonaktifkan".
3. `reject_worker` tidak mengisi `removed_at` ([008:194-198](../supabase/migrations/008_create_rpc_functions.sql)), jadi tanggal penolakan hanya bisa diambil dari `updated_at` — yang akan tertimpa oleh perubahan apa pun berikutnya (**R-03**).

Perbedaan istilah yang perlu diputuskan: `removed_reason = 'left_by_worker'` (pekerja keluar sendiri) ditampilkan sebagai **"Dinonaktifkan"** ([workers.tsx:77](../app/(owner)/owner/workers.tsx)) — dari sudut pandang pemilik ini menyesatkan, seolah dia yang mengeluarkan.

### G9 — Kode bergabung: generate, unique, normalisasi

**SUDAH ADA, lengkap dan benar.**

**Generate** — [migration 006:62-83](../supabase/migrations/006_create_indexes_and_triggers.sql):
```
code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
```
- **Panjang**: 8 karakter
- **Charset**: heksadesimal `0-9A-F` saja (16 simbol, bukan 36) — ruang kode 16^8 ≈ 4,29 miliar
- **Huruf besar**: ya, `upper()` diterapkan saat generate
- **Anti-tabrakan**: `loop ... exit when not exists (select 1 from farms where join_code = code)` — retry sampai unik

**Unique index**: ya — `join_code text not null unique` ([002:14](../supabase/migrations/002_create_core_tables.sql)) menciptakan unique index otomatis. Jadi ada dua lapis (loop + constraint).

**Normalisasi input user**: ya, **dua lapis**:
1. Klien: `input.joinCode.trim().toUpperCase()` ([memberService.ts:67](../src/services/memberService.ts))
2. Server: `where join_code = upper(trim(p_join_code))` ([020:980](../supabase/migrations/020_feature_completion_database_foundation.sql))

Satu catatan UX kecil: `Field` di [join-farm.tsx:45](../app/(onboarding)/join-farm.tsx) tidak menyetel `autoCapitalize="characters"` maupun `autoCorrect={false}`, jadi user melihat ketikannya huruf kecil meski sistem menerimanya. Kosmetik, tapi membingungkan untuk pengguna yang tidak akrab teknologi.

Karena charset hex, karakter yang mudah tertukar (`O` vs `0`, `I` vs `1`) **tidak** menjadi masalah — `O` dan `I` tidak pernah muncul. Ini kebetulan yang menguntungkan.

### G10 — Placeholder `AVOL-ABC123`

**ADA — dan memang menyesatkan.** Tiga lokasi:

| Lokasi | Isi | Sifat |
|---|---|---|
| [app/(onboarding)/join-farm.tsx:45](../app/(onboarding)/join-farm.tsx) | `placeholder="Contoh: AVOL-ABC123"` | **Kode aplikasi — ini yang dilihat user** |
| [docs/final-design/avology_v2_final_design_spec.md:742](../docs/final-design/avology_v2_final_design_spec.md) | `Placeholder: Contoh: AVOL-ABC123` | Dokumen desain |
| [docs/final-design/avology_v2_final_design_spec.md:1382](../docs/final-design/avology_v2_final_design_spec.md) | `Kode Gabung: AVOL-ABC123` | Dokumen desain |

Format sebenarnya adalah 8 karakter hex tanpa prefix (mis. `85CBFCD4`) sesuai `generate_join_code()`. Placeholder `AVOL-ABC123` memiliki prefix, tanda hubung, dan huruf di luar A–F — **tidak ada satu pun karakteristiknya yang benar**. Pengguna yang tidak akrab teknologi kemungkinan besar akan mencoba mengetik prefix `AVOL-`.

Saya sudah menyisir seluruh `src/` dan `app/` untuk format kode berprefix lain: tidak ada yang lain. Kode kebun asli ditampilkan apa adanya di [farm.tsx:279](../app/(owner)/owner/farm.tsx) dengan font monospace — itu sudah benar.

---

## Bagian 5 — Guard & Edge Case

| # | Skenario | Ditangani? | Yang terjadi |
|---|---|---|---|
| 1 | Kode kebun yang dia **sudah jadi anggotanya** | **Ya, di DB** | `request_join_farm` cek `status in ('pending','active')` untuk kebun itu ([020:986-994](../supabase/migrations/020_feature_completion_database_foundation.sql)) → exception `'User already has a pending or active membership'` → dipetakan jadi *"Anda sudah memiliki pengajuan atau keanggotaan aktif di kebun ini."* ([serviceResult.ts:28](../src/utils/serviceResult.ts)). Di praktiknya user aktif juga tidak bisa membuka `/join-farm` karena route guard. |
| 2 | Kode kebun yang **dia sendiri pemiliknya** | **Ya, tapi tidak sengaja** | Jatuh ke guard yang sama seperti #1, karena pemilik punya baris `role='owner', status='active'` di kebun itu. Pesannya jadi janggal: pemilik diberi tahu dia "sudah punya pengajuan", bukan "ini kebun kamu sendiri". Tidak ada cek `role='owner'` eksplisit. |
| 3 | Tekan **"Ajukan Gabung" dua kali** karena lag | **Ya, dua lapis** | UI: `Button` di-`disabled` saat `loading` ([ui.tsx:1538](../src/components/ui.tsx)) yang diikat ke state `submitting` ([join-farm.tsx:17](../app/(onboarding)/join-farm.tsx)). DB: kalaupun dua request lolos, yang kedua kena guard #1 → exception. **Tidak ada data rusak**, tapi user bisa melihat pesan error membingungkan padahal pengajuannya berhasil. |
| 4 | **Kebun dihapus / pemilik hapus akun** saat pengajuan pending | **Sebagian** | Hapus kebun: FK `farm_id ... on delete cascade` ([002:25](../supabase/migrations/002_create_core_tables.sql)) → baris pengajuan ikut terhapus → `get_current_user_access` mengembalikan `null` → user dilempar ke `/onboarding` tanpa penjelasan apa pun. Hapus akun pemilik: **diblokir database** — `farms.created_by ... on delete restrict` ([002:15](../supabase/migrations/002_create_core_tables.sql)) menolak penghapusan profil selama dia masih punya kebun. **TIDAK PASTI**: apakah aplikasi punya fitur hapus kebun / hapus akun sama sekali — saya tidak menemukan RPC `delete_farm` atau `delete_account` di repo, jadi skenario ini kemungkinan hanya bisa terjadi lewat dashboard Supabase. |
| 5 | Pemilik **menolak tepat saat pemohon membuka layar tunggu** | **Sebagian** | Tidak ada realtime. Pemohon tetap melihat "Menunggu Persetujuan" sampai dia memicu refresh (fokus ulang layar atau tekan "Cek Status"). Tidak ada kerusakan data; hanya tampilan basi yang bisa bertahan tak terbatas selama layar tidak kehilangan fokus. |
| 6 | Pemilik tekan **"Terima" dua kali** pada pengajuan yang sama | **Ya, dua lapis** | UI: `Button loading={busy}` ([farm.tsx:372](../app/(owner)/owner/farm.tsx)) men-disable tombol. DB: `approve_worker` mencari baris dengan `status='pending'` ([020:1042-1051](../supabase/migrations/020_feature_completion_database_foundation.sql)); panggilan kedua tidak menemukannya → exception `'Pending worker not found'` → snackbar *"Pengajuan pekerja tidak ditemukan atau sudah diproses."* Tidak ada data rusak. Pesannya cukup baik. |
| 7 | User yang **dinonaktifkan** mengajukan lagi ke **kebun yang sama** | **Ya, diizinkan secara sengaja** | Klausa `where status in ('rejected','removed')` pada `on conflict do update` ([020:1019](../supabase/migrations/020_feature_completion_database_foundation.sql)) memang dirancang untuk ini (migration 012 judulnya `refine_inactive_rejoin_flow`). Baris lama ditimpa jadi `pending`, `removed_*` di-null-kan. **Efek samping: entri riwayat aksesnya hilang** (lihat **R-02**). |
| 8 | Pengajuan dikirim, lalu **logout dan login di device lain** | **Ya, sepenuhnya** | Status murni dari database. Login baru → `onAuthStateChange('SIGNED_IN')` ([auth-context.tsx:100-104](../src/context/auth-context.tsx)) → `refresh()` → `get_current_user_access` → status `pending` → `/pending-approval`. Tidak ada state pengajuan di AsyncStorage. |

**Skenario tambahan yang saya temukan dan tidak ada di daftar Anda** (masuk ke temuan **R-01**): user yang sudah jadi **pemilik aktif kebun B** memanggil `request_join_farm` dengan kode **kebun A**. RPC mengizinkannya — guardnya hanya memeriksa keanggotaan di kebun yang dituju. Kalau pemilik A menyetujui, `updated_at` baris kebun A menjadi yang terbaru, dan `get_current_user_access` (yang `limit 1 order by updated_at desc`) akan mengembalikan **keanggotaan pekerja di kebun A** — user terlempar keluar dari dashboard kebunnya sendiri dan tidak punya cara kembali lewat UI. Saat ini hanya route guard di klien yang mencegah skenario ini terjadi.

---

## Bagian 6 — Copy, Konstanta, dan Kebersihan Kode

### 6.1 Teks penjelasan panjang di area A dan B

| Lokasi | Teks | Catatan |
|---|---|---|
| [access-status-screen.tsx:131](../src/components/access-status-screen.tsx) | "Perbarui status setelah pemilik memproses pengajuan. Selama menunggu, data kebun belum dapat diakses." | Dua kalimat; kalimat kedua menerangkan mekanisme internal |
| [access-status-screen.tsx:135](../src/components/access-status-screen.tsx) | "Akses kebun sudah dinonaktifkan. Kamu dapat kembali ke pilihan akses untuk membuat kebun sendiri atau mengajukan akses baru." | Menjelaskan apa yang sudah terlihat sebagai tombol |
| [access-status-screen.tsx:138](../src/components/access-status-screen.tsx) | "Pengajuan akses ditolak. Kamu dapat kembali ke pilihan akses atau menggunakan kode kebun lain jika tersedia." | Sama — duplikasi tombol dalam bentuk kalimat |
| [access-status-screen.tsx](../src/components/access-status-screen.tsx) via [pending-approval.tsx:7](../app/(onboarding)/pending-approval.tsx) | "Pengajuan sudah terkirim. Tunggu persetujuan pemilik kebun." | Subtitle |
| [create-farm.tsx:69](../app/(onboarding)/create-farm.tsx) | "Luas lahan boleh dikosongkan jika belum pasti." | Bisa jadi hint di bawah field, bukan paragraf terpisah |
| [join-farm.tsx:47](../app/(onboarding)/join-farm.tsx) | "Masukkan kode dari pemilik kebun." | Redundan dengan label field "Kode Kebun *" |
| [onboarding.tsx:37](../app/(onboarding)/onboarding.tsx) | "Buat ruang kerja kebun baru." | Redundan dengan judul kartu "Buat Kebun" |
| [onboarding.tsx:58](../app/(onboarding)/onboarding.tsx) | "Masukkan kode dari pemilik." | Redundan dengan judul kartu "Gabung Kebun" |
| [farm.tsx:281](../app/(owner)/owner/farm.tsx) | "Bagikan ke pekerja baru." | Wajar dipertahankan |
| [farm.tsx:452](../app/(owner)/owner/farm.tsx) | "{Nama} akan kehilangan akses ke kebun ini. Dia perlu mengajukan ulang dengan kode bergabung untuk kembali." | Dua kalimat di dialog konfirmasi; kalimat kedua adalah penjelasan mekanisme |
| [farm.tsx:449](../app/(owner)/owner/farm.tsx) | "{Nama} tidak akan bisa mengakses kebun ini." | Cukup ringkas |
| [farm.tsx:350](../app/(owner)/owner/farm.tsx) | "Template instruksi untuk pekerja" | Subtitle menu SOP |
| [worker/farm.tsx:183](../app/(worker)/worker/farm.tsx) | "Kamu perlu kode bergabung untuk masuk lagi." | Cukup ringkas |
| [profile-screen.tsx:96](../src/components/profile-screen.tsx) | "Masuk ulang jika data akun belum muncul." | Empty state |
| [profile-screen.tsx:178](../src/components/profile-screen.tsx) | "Kamu perlu masuk lagi untuk membuka Avology." | Konfirmasi logout |

Pola dominan: **judul + kalimat yang mengulangi judul**. Kandidat penghapusan paling jelas adalah `onboarding.tsx:37`, `onboarding.tsx:58`, `join-farm.tsx:47`, dan kalimat kedua di `access-status-screen.tsx:131/135/138`.

### 6.2 Ketidakkonsistenan istilah

| Konsep | Istilah yang dipakai | Lokasi |
|---|---|---|
| Orang yang mengajukan diri | **"pengajuan"** (farm.tsx:138, 416; access-status-screen.tsx:55) vs **"permintaan"** (tidak ditemukan) vs **"pending"** (kode) — sebenarnya cukup konsisten di UI | — |
| Pekerja vs anggota | **"Anggota"** sebagai judul section ([farm.tsx:305](../app/(owner)/owner/farm.tsx), [worker/farm.tsx:142](../app/(worker)/worker/farm.tsx)) tapi datanya `WorkerMembership` dan fungsinya `getWorkerMemberships` — **"Pekerja"** dipakai untuk baris individual ([farm.tsx:200](../app/(owner)/owner/farm.tsx)) | Judul layar `/owner/workers` adalah "Riwayat akses" tapi nama file `workers.tsx` dan komponennya `WorkerAccessHistoryScreen` |
| Status `removed` | **"Akses Dinonaktifkan"** ([displayFormat.ts:32](../src/utils/displayFormat.ts)) vs **"Dinonaktifkan"** ([workers.tsx:77](../app/(owner)/owner/workers.tsx)) vs **"Nonaktifkan akses"** (tombol, [farm.tsx:384](../app/(owner)/owner/farm.tsx)) vs **"Keluar dari kebun"** ([worker/farm.tsx:175](../app/(worker)/worker/farm.tsx), padahal menulis status yang sama) | Empat frasa untuk satu nilai enum |
| Status `pending` | **"Menunggu Persetujuan"** ([displayFormat.ts:30](../src/utils/displayFormat.ts)) vs **"Status Pengajuan"** (judul kartu, [access-status-screen.tsx:55](../src/components/access-status-screen.tsx)) vs **"Mengajukan {tanggal}"** ([farm.tsx:183](../app/(owner)/owner/farm.tsx)) | |
| Aksi menerima | **"Terima"** (tombol, [farm.tsx:372](../app/(owner)/owner/farm.tsx)) vs **"diterima"** (snackbar, [farm.tsx:122](../app/(owner)/owner/farm.tsx)) vs **"menyetujui"** ([serviceResult.ts:31](../src/utils/serviceResult.ts), memberService.ts:178) vs **"persetujuan"** (rute `/pending-approval`) | |
| Kode kebun | **"Kode Kebun"** (label field, [join-farm.tsx:45](../app/(onboarding)/join-farm.tsx)) vs **"Kode bergabung"** (section owner, [farm.tsx:266](../app/(owner)/owner/farm.tsx)) vs **"kode bergabung"** ([farm.tsx:452](../app/(owner)/owner/farm.tsx), [worker/farm.tsx:183](../app/(worker)/worker/farm.tsx)) | Dua istilah untuk satu benda — pemilik dan pekerja melihat nama berbeda |
| Pemilik | **"Pemilik"** (UI) vs **"owner"** (kode, pesan error `'Hanya owner aktif...'` di [farmService.ts:305](../src/services/farmService.ts)) | `sanitizeUserFacingMessage` ([displayFormat.ts:187-188](../src/utils/displayFormat.ts)) menambal ini dengan regex — tambal sulam, bukan solusi |

### 6.3 File >400 baris di area ini

Hanya **satu** di area audit:

**[app/(owner)/owner/farm.tsx](../app/(owner)/owner/farm.tsx) — 521 baris.** Isinya lima tanggung jawab: fetch data + identitas kebun + kartu kode bergabung + daftar anggota/pengajuan/riwayat + dua overlay (BottomSheet & ConfirmDialog) + enam helper format tanggal/angka.

Saran pembagian (deskriptif, jangan dieksekusi sekarang):
- Pindahkan enam helper format (`formatDayMonth`, `formatDateTimeFull`, `formatArea`, `toTime`, `buildFarmMetaLine`) ke util bersama — `formatArea` dan `buildFarmMetaLine` **sudah diduplikasi persis** di `worker/farm.tsx`.
- Angkat kartu "Kode bergabung" jadi komponen sendiri.
- Angkat sheet tinjau pengajuan (`mode: 'pending'`) dan sheet opsi anggota aktif (`mode: 'active'`) jadi dua komponen terpisah — sekarang keduanya dipaksa berbagi satu `SheetState` dengan percabangan `mode`, dan desain target menuntut perilaku berbeda (konfirmasi tolak di dalam sheet).
- Angkat penyusunan daftar anggota jadi komponen, sekalian memisahkan section "Pengajuan masuk" sesuai desain target.

Di luar area audit tapi relevan sebagai konteks: [src/components/ui.tsx](../src/components/ui.tsx) **2.284 baris** dan [src/types/domain.ts](../src/types/domain.ts) **903 baris**. Keduanya menyentuh area ini tapi pembagiannya adalah pekerjaan lintas-fitur.

### 6.4 Komponen yang diduplikasi antara layar owner dan worker

| Yang diduplikasi | Lokasi owner | Lokasi worker | Sifat |
|---|---|---|---|
| `SectionLabel` | [farm.tsx:424-441](../app/(owner)/owner/farm.tsx) | [worker/farm.tsx:198-222](../app/(worker)/worker/farm.tsx) | **Identik secara fungsional**, beda gaya penulisan style saja |
| `buildFarmMetaLine` | [farm.tsx:455-470](../app/(owner)/owner/farm.tsx) | [worker/farm.tsx:233-248](../app/(worker)/worker/farm.tsx) | **Identik baris demi baris** |
| `formatArea` | [farm.tsx:472-478](../app/(owner)/owner/farm.tsx) | [worker/farm.tsx:250-256](../app/(worker)/worker/farm.tsx) | **Identik baris demi baris** |
| Kartu identitas kebun | [farm.tsx:252-264](../app/(owner)/owner/farm.tsx) | [worker/farm.tsx:123-139](../app/(worker)/worker/farm.tsx) | Nyaris identik; owner punya tombol "Edit" tambahan |
| Section "Anggota" + hitungan | [farm.tsx:304-319](../app/(owner)/owner/farm.tsx) | [worker/farm.tsx:141-160](../app/(worker)/worker/farm.tsx) | Struktur sama, sumber data berbeda (`WorkerMembership` vs `FarmActorDisplayProfile`), dan **hitungannya dihitung dengan rumus berbeda** — owner `1 + activeWorkers.length`, worker `activeMembers.length` |
| Blok `load()` + `useFocusEffect` + retry | [farm.tsx:56-99](../app/(owner)/owner/farm.tsx) | [worker/farm.tsx:32-75](../app/(worker)/worker/farm.tsx) | Pola identik |

Sudah dibagi dengan benar: `MemberRow`/`Avatar` ([member-row.tsx](../src/components/member-row.tsx)), `AccessStatusScreen`, `ProfileScreen`, `ProfileEditScreen`, `AccountPasswordScreen`.

**Dead code yang ditemukan**: `getPendingWorkers()` ([memberService.ts:86-98](../src/services/memberService.ts)) beserta tipe `PendingWorkerRow` ([memberService.ts:18-26](../src/services/memberService.ts)) dan `mapPendingWorker` ([memberService.ts:227-237](../src/services/memberService.ts)) **tidak dipanggil dari layar mana pun** — `farm.tsx` mengambil pengajuan lewat `getWorkerMemberships`. RPC `get_pending_workers` di database pun jadi tidak terpakai. Ada tiga lapis kode mati yang saling menopang.

---

## Bagian 7 — Risiko & Urutan Kerja

### 7.1 Temuan diurutkan berdasarkan risiko

| ID | Severity | Lokasi | Temuan | Dampak | Arah perbaikan |
|---|---|---|---|---|---|
| **R-01** | KRITIS | [migration 020:986-994](../supabase/migrations/020_feature_completion_database_foundation.sql) + [020:1183](../supabase/migrations/020_feature_completion_database_foundation.sql) | `request_join_farm` hanya melarang pengajuan kalau user sudah pending/active **di kebun yang dituju**. Tidak ada larangan global, dan tidak ada unique index yang menjaganya. Sementara itu `get_current_user_access` memilih satu baris dengan `order by coalesce(updated_at, created_at) desc limit 1` | Satu user bisa punya beberapa baris `farm_members` aktif/pending sekaligus. Identitas dan dashboard-nya lalu ditentukan oleh baris mana yang `updated_at`-nya paling baru — pemilik kebun bisa terlempar keluar dari kebunnya sendiri saat pengajuannya di kebun lain disetujui, tanpa jalan kembali lewat UI. Saat ini hanya route guard klien yang mencegah | Tambahkan guard di dalam `request_join_farm`: tolak kalau pemanggil punya baris `status in ('pending','active')` di kebun **mana pun**. Perkuat dengan partial unique index pada `user_id` untuk status tersebut. Setelah itu `limit 1` pada `get_current_user_access` menjadi benar secara struktural, bukan kebetulan |
| **R-02** | KRITIS | [migration 020:1010-1019](../supabase/migrations/020_feature_completion_database_foundation.sql) + [workers.tsx:19-21](../app/(owner)/owner/workers.tsx) | Riwayat akses tidak punya tabel sendiri — ia adalah baris `farm_members` yang statusnya `rejected`/`removed`. `request_join_farm` menimpa baris itu jadi `pending` saat orang yang sama mengajukan ulang ke kebun yang sama | Catatan penolakan/penonaktifan **hilang permanen** begitu orangnya mengajukan ulang. Pemilik kehilangan satu-satunya jejak bahwa dia pernah menolak orang ini, persis pada momen dia paling butuh informasi itu (saat meninjau pengajuan orang yang sama). Riwayat juga terbatas satu entri per orang per kebun | Pisahkan riwayat menjadi tabel append-only (`farm_access_events` atau serupa) yang ditulis oleh setiap RPC keanggotaan dalam transaksi yang sama. Riwayat berhenti bergantung pada `status` saat ini |
| **R-03** | TINGGI | [migration 008:194-198](../supabase/migrations/008_create_rpc_functions.sql) | `reject_worker` adalah satu-satunya RPC keanggotaan yang **tidak** diperbarui di migration 020 — ia tidak mengisi `removed_at`, `removed_by`, `removed_reason`, padahal `approve_worker` dan `remove_worker` sudah | Tanggal penolakan hanya bisa diambil dari `updated_at` ([workers.tsx:86](../app/(owner)/owner/workers.tsx)), yang tertimpa oleh perubahan apa pun berikutnya. Siapa yang menolak tidak tercatat sama sekali | Selaraskan `reject_worker` dengan dua saudaranya. Kalau R-02 dikerjakan lebih dulu, ini larut ke dalamnya |
| **R-04** | TINGGI | [farmService.ts:145-180](../src/services/farmService.ts) + [access-status-screen.tsx:112](../src/components/access-status-screen.tsx) | RPC sudah mengembalikan `farm_name` ([020:1154](../supabase/migrations/020_feature_completion_database_foundation.sql)) dan tipe `CurrentUserAccessRow` sudah mendeklarasikannya ([farmService.ts:51](../src/services/farmService.ts)), tapi mapper tidak pernah membacanya. Untuk status non-aktif fungsi langsung `return ok(membership)` tanpa objek `farm` | Layar tunggu, ditolak, dan dinonaktifkan **selalu** menampilkan `Kebun tujuan: Belum tersedia`. User tidak pernah tahu kebun mana yang dia ajukan — masalah nyata untuk user yang mencoba beberapa kode | Teruskan `farm_name` ke state relasi sebagai nama kebun untuk status non-aktif. Perbaikan kecil, seluruhnya di sisi klien, tidak butuh migration |
| **R-05** | TINGGI | [join-farm.tsx:16-31](../app/(onboarding)/join-farm.tsx) | Tidak ada validasi kode + pratinjau sebelum pengajuan dikirim (**G1**). RPC yang dibutuhkan tidak ada, dan RLS `farms` melarang non-anggota membaca tabelnya | User membuat pengajuan tanpa pernah melihat kebun apa yang dia tuju. Salah ketik satu karakter → pengajuan nyasar ke kebun asing → butuh pemilik asing itu menolaknya, dan **tidak ada tombol batal** (R-06) | RPC `SECURITY DEFINER` baru yang menerima kode dan mengembalikan pratinjau terbatas (nama, lokasi, luas, nama pemilik, jumlah anggota) — **tanpa** `farm_id`, `join_code`, `created_by`, atau nomor HP |
| **R-06** | TINGGI | Tidak ada — fungsi belum dibuat | Tidak ada cara membatalkan pengajuan sendiri (**G2**). `leave_current_farm` tidak bisa dipakai ulang karena mensyaratkan `status='active'` | User yang salah kirim pengajuan **terkunci** di layar tunggu sampai pemilik asing memprosesnya. Kombinasi dengan R-05 membuat satu salah ketik menjadi jalan buntu tanpa jalan keluar | RPC intent-based `cancel_join_request` yang hanya menyentuh baris milik `auth.uid()` sendiri berstatus `pending`. Perlu keputusan: baris dihapus, atau diberi status baru — lihat 7.3 |
| **R-07** | SEDANG | [farm.tsx:54](../app/(owner)/owner/farm.tsx) vs [farm.tsx:178-246](../app/(owner)/owner/farm.tsx) | `memberCount` tidak menghitung pending (benar), tapi baris pending — dan baris "Riwayat akses" — ikut dirender di dalam kartu "Anggota" (salah) | Angka dan jumlah baris tidak cocok ("3 orang", 4–5 baris). Pemilik kehilangan kepercayaan pada angka yang ditampilkan | Keluarkan pengajuan jadi section tersendiri di atas "Anggota", dan keluarkan "Riwayat akses" dari kartu anggota. Sesuai desain target |
| **R-08** | SEDANG | [access-status-screen.tsx:20-35](../src/components/access-status-screen.tsx) + [(onboarding)/_layout.tsx:25-40](../app/(onboarding)/_layout.tsx) | Tidak ada pull-to-refresh; `Screen` ([ui.tsx:231](../src/components/ui.tsx)) memakai `ScrollView` tanpa `refreshControl`. Refresh hanya lewat on-focus (dobel) dan tombol manual | Pemohon yang membiarkan layar terbuka tidak akan pernah tahu pengajuannya sudah diproses. Desain target menghapus tombol "Cek Status", jadi tanpa pull-to-refresh justru mundur | Tambahkan dukungan `refreshControl` di `Screen`. Perhatikan: ini menyentuh komponen bersama yang dipakai hampir semua layar — perlu perlakuan hati-hati |
| **R-09** | SEDANG | [farm.tsx:373-378](../app/(owner)/owner/farm.tsx) + [farm.tsx:395-419](../app/(owner)/owner/farm.tsx) | "Tolak" adalah blok berwarna `variant="danger"`, dan konfirmasinya berupa `ConfirmDialog` terpisah yang muncul **di atas** BottomSheet | Dua overlay bertumpuk; aksi destruktif punya bobot visual yang sama dengan aksi utama "Terima". Menyimpang dari desain target di dua hal sekaligus | Turunkan "Tolak" jadi tombol teks, dan pindahkan konfirmasi ke dalam sheet yang sama sebagai langkah kedua |
| **R-10** | SEDANG | [join-farm.tsx:45](../app/(onboarding)/join-farm.tsx) | Placeholder `Contoh: AVOL-ABC123` — prefix, tanda hubung, dan huruf di luar A–F semuanya salah dibanding format asli 8 karakter hex (**G10**) | Pengguna yang tidak akrab teknologi kemungkinan mengetik prefix `AVOL-`, gagal, dan tidak tahu kenapa. Placeholder yang salah lebih buruk daripada tidak ada placeholder | Ganti dengan contoh format asli. Sekalian setel `autoCapitalize="characters"` dan `autoCorrect={false}` |
| **R-11** | SEDANG | [migration 020:986-994](../supabase/migrations/020_feature_completion_database_foundation.sql) | Tidak ada cek eksplisit untuk "ini kebun kamu sendiri" (edge case #2). Pemilik yang memasukkan kodenya sendiri mendapat pesan *"Anda sudah memiliki pengajuan atau keanggotaan aktif di kebun ini"* | Pesan salah sasaran dan membingungkan pada skenario yang cukup masuk akal untuk user awam | Tambahkan cabang `role='owner'` dengan pesan sendiri, dan bawa ke pemetaan pesan di [serviceResult.ts](../src/utils/serviceResult.ts) |
| **R-12** | SEDANG | [workers.tsx:77](../app/(owner)/owner/workers.tsx) | `removed_reason = 'left_by_worker'` ditampilkan sebagai "Dinonaktifkan", sama dengan `'removed_by_owner'`. Kolom `removed_reason` tidak pernah dibaca UI | Pemilik melihat pekerja yang keluar sendiri seolah dia yang mengeluarkannya — riwayat yang menyesatkan tentang keputusannya sendiri | Bedakan label berdasarkan `removed_reason`, yang sudah tersimpan tapi belum dipetakan ke `WorkerMembership` |
| **C-01** | SEDANG | [src/types/domain.ts:18,20](../src/types/domain.ts) | Tidak ada file konstanta terpusat untuk keanggotaan, padahal polanya sudah mapan di [src/constants/operationalReport.ts](../src/constants/operationalReport.ts) (**2.4**). Nilai status/peran tersebar sebagai literal di ±10 file, dan label di-hardcode ulang di 5 tempat di luar `displayFormat.ts` | Perubahan status (mis. menambah `cancelled` untuk R-06) harus disisir manual ke seluruh repo tanpa bantuan compiler untuk menemukan tempat yang terlewat | Buat `src/constants/membership.ts` dengan pola yang sama seperti `operationalReport.ts`: array `as const`, tipe turunan, komentar yang menunjuk migration 001 |
| **C-02** | RENDAH | [memberService.ts:86-98](../src/services/memberService.ts) | `getPendingWorkers()` + `PendingWorkerRow` + `mapPendingWorker` tidak dipanggil dari mana pun; RPC `get_pending_workers` di database ikut tidak terpakai | Tiga lapis kode mati yang saling menopang, memberi kesan ada jalur pengambilan pengajuan terpisah padahal tidak ada | Hapus atau justru **pakai** — kalau pengajuan dipisah jadi section sendiri (R-07), RPC ini mungkin justru jalur yang lebih tepat daripada memfilter `getWorkerMemberships` di klien |
| **C-03** | RENDAH | [farm.tsx:455-478](../app/(owner)/owner/farm.tsx) vs [worker/farm.tsx:233-256](../app/(worker)/worker/farm.tsx) | `buildFarmMetaLine`, `formatArea`, dan `SectionLabel` diduplikasi persis antara layar owner dan worker (**6.4**) | Perubahan format luas/lokasi harus dikerjakan dua kali; sudah terbukti mudah lepas sinkron | Angkat ke util/komponen bersama |
| **C-04** | RENDAH | [displayFormat.ts:32](../src/utils/displayFormat.ts) vs [workers.tsx:77](../app/(owner)/owner/workers.tsx) vs [farm.tsx:384](../app/(owner)/owner/farm.tsx) vs [worker/farm.tsx:175](../app/(worker)/worker/farm.tsx) | Empat frasa berbeda untuk status `removed`; dua istilah untuk kode kebun ("Kode Kebun" vs "Kode bergabung") (**6.2**) | Pemilik dan pekerja melihat nama berbeda untuk benda yang sama | Tetapkan satu istilah per konsep dalam glosarium, terapkan lewat `displayFormat.ts` |
| **C-05** | RENDAH | [onboarding.tsx:37,58](../app/(onboarding)/onboarding.tsx), [join-farm.tsx:47](../app/(onboarding)/join-farm.tsx), [access-status-screen.tsx:131,135,138](../src/components/access-status-screen.tsx) | Kalimat penjelas yang mengulangi judul atau menerangkan tombol yang sudah terlihat (**6.1**) | Kepadatan teks tinggi di layar yang justru paling perlu ringkas | Hapus yang redundan; pertahankan hanya yang menyampaikan informasi baru |
| **C-06** | RENDAH | [supabase/migrations/](../supabase/migrations/) | Nomor `017` hilang; `request_join_farm` dan `get_current_user_access` masing-masing didefinisikan 3× di file berbeda (**2.5**) | Membaca perilaku sebenarnya menuntut menyisir semua definisi dan menebak mana yang terakhir dijalankan — mudah salah baca saat merancang perubahan | Catat di komentar migration berikutnya versi mana yang aktif. Jangan menulis ulang sejarah migration |

### 7.2 Usulan pembagian fase (dengan dependensi)

Tidak dieksekusi. Ini peta, bukan perintah.

**Fase 0 — Keputusan (blocking, tidak ada kode)**
Jawab pertanyaan di 7.3. Semua fase berikutnya bergantung pada ini, terutama keputusan tentang tabel riwayat dan nasib baris pengajuan yang dibatalkan.

**Fase 1 — Fondasi data & integritas** *(depends on: Fase 0)*
R-01 (guard satu pengajuan aktif global), R-02 (pisahkan riwayat jadi tabel append-only), R-03 (selaraskan `reject_worker`). Ketiganya menyentuh skema dan RPC yang sama, jadi paling murah dikerjakan sebagai satu migration. **Harus lebih dulu** dari fase mana pun yang menambah state baru — menambahkan pembatalan pengajuan di atas model riwayat yang sekarang akan menambah cara baru kehilangan data.

**Fase 2 — RPC baru untuk alur pemohon** *(depends on: Fase 1)*
R-05 (`preview_farm_by_join_code`) dan R-06 (`cancel_join_request`). Keduanya RPC baru, tidak mengubah yang lama. R-06 bergantung pada Fase 1 karena pembatalan adalah event riwayat yang perlu tempat menulis.

**Fase 3 — Layar pemohon** *(depends on: Fase 2)*
Alur gabung dua langkah (kode → pratinjau → ajukan), tombol batalkan + konfirmasi, hapus tombol "Cek Status", state ditolak dengan dua jalan keluar, R-04 (nama kebun di layar tunggu), R-10 (placeholder). R-04 dan R-10 sebenarnya tidak bergantung pada apa pun dan bisa didahulukan kapan saja sebagai perbaikan lepas.

**Fase 4 — Layar pemilik** *(depends on: Fase 1; independen dari Fase 2–3)*
R-07 (pisahkan section pengajuan, betulkan hitungan), R-09 (tombol tolak jadi teks + konfirmasi dalam sheet), R-12 (bedakan keluar sendiri vs dinonaktifkan). Bisa berjalan paralel dengan Fase 2–3 karena tidak berbagi file.

**Fase 5 — Konfirmasi pasca-aksi** *(depends on: Fase 3 dan Fase 4)*
Layar konfirmasi berisi kode bergabung setelah buat kebun; konfirmasi setelah pengajuan disetujui. Ditaruh terakhir karena menyentuh titik transisi kedua sisi.

**Fase 6 — Kebersihan** *(depends on: semua di atas)*
C-01 (konstanta keanggotaan terpusat), C-02 (dead code), C-03 (duplikasi owner/worker), C-04 (glosarium istilah), C-05 (pangkas copy), pemecahan `farm.tsx`. Sengaja terakhir: memecah file sambil mengubah perilakunya membuat review jadi jauh lebih sulit. Pengecualian: **C-01 layak dinaikkan ke Fase 1** kalau Fase 1 ternyata menambah nilai status baru — lebih murah membuat konstantanya sekalian daripada menyisir literal dua kali.

Catatan tentang R-08 (pull-to-refresh): menyentuh `Screen` di `ui.tsx` yang dipakai hampir semua layar aplikasi. Layak diperlakukan sebagai pekerjaan terpisah dengan pengujian regresi sendiri, bukan diselipkan ke Fase 3.

### 7.3 Keputusan yang masih perlu Anda ambil sebelum implementasi

1. **Nasib baris pengajuan yang dibatalkan user (R-06).** Dihapus (`DELETE`), atau diberi nilai status baru (mis. `cancelled` di enum `member_status`)? Menghapus itu bersih tapi menghilangkan jejak; menambah nilai enum menyentuh `member_status` dan seluruh `switch`/perbandingan status di klien. **Ini keputusan paling menentukan** — ia menentukan apakah Fase 1 perlu `ALTER TYPE` atau tidak.

2. **Tabel riwayat terpisah atau tidak (R-02).** Tabel `farm_access_events` append-only menyelesaikan R-02, R-03, dan G8 sekaligus, dan memberi tempat untuk mencatat "diterima" yang sekarang hilang. Harganya: satu tabel baru, satu set policy RLS baru, dan setiap RPC keanggotaan harus menulis ke dua tabel dalam satu transaksi. Alternatif yang lebih murah: jangan timpa baris lama saat mengajukan ulang — tapi itu bertabrakan dengan constraint `unique (farm_id, user_id)`, jadi sebenarnya bukan alternatif yang lebih murah.

3. **Apakah "diterima" perlu masuk riwayat akses.** Sekarang tidak tercatat sama sekali. Kalau perlu, keputusan #2 praktis sudah terjawab (butuh tabel terpisah).

4. **Isi persis pratinjau kebun (R-05).** Saya sudah mengusulkan batasnya di G1. Yang perlu Anda putuskan: apakah **nama pemilik** boleh terlihat oleh orang asing yang cuma menebak kode. Ini kebocoran informasi paling sensitif dari daftar itu, dan sekaligus yang paling berguna untuk meyakinkan pemohon bahwa dia tidak salah kebun.

5. **Apakah satu user boleh punya lebih dari satu relasi kebun sama sekali (R-01).** Audit ini mengasumsikan **tidak** (sesuai desain target "satu pengajuan aktif per user"). Kalau di kemudian hari Anda ingin satu pekerja melayani dua kebun, `get_current_user_access ... limit 1` dan seluruh `routeGuard` harus dirancang ulang, bukan ditambal. Menutup pintu ini sekarang lebih murah daripada nanti — tapi itu keputusan produk.

6. **Apakah pemilik boleh ikut punya pengajuan di kebun lain (R-01/R-11).** Konsekuensi langsung dari #5. Kalau tidak boleh, guard-nya sederhana; kalau boleh, `get_current_user_access` butuh konsep "kebun aktif yang sedang dipilih" — pekerjaan yang jauh lebih besar.

7. **Nama baku untuk kode kebun (C-04).** "Kode kebun" atau "kode bergabung"? Sekarang pemilik dan pekerja melihat istilah berbeda. Sekali diputuskan, sebarkan ke seluruh copy dan dokumen desain.

8. **Apakah pekerja yang keluar sendiri dan yang dinonaktifkan pemilik perlu dibedakan di UI (R-12).** Datanya sudah ada di `removed_reason`, tinggal keputusan produk apakah pembedaan itu berguna bagi pemilik atau justru menambah kebisingan.

---

## Lampiran A — Daftar File yang Dibaca Selama Audit

**Kode aplikasi (dibaca penuh):**
- `app/index.tsx`
- `app/(onboarding)/_layout.tsx`
- `app/(onboarding)/onboarding.tsx`
- `app/(onboarding)/create-farm.tsx`
- `app/(onboarding)/join-farm.tsx`
- `app/(onboarding)/pending-approval.tsx`
- `app/(onboarding)/rejected.tsx`
- `app/(onboarding)/removed-access.tsx`
- `app/(onboarding)/profile.tsx`
- `app/(onboarding)/profile-edit.tsx`
- `app/(onboarding)/password.tsx`
- `app/(owner)/_layout.tsx`
- `app/(owner)/owner/farm.tsx`
- `app/(owner)/owner/workers.tsx`
- `app/(worker)/worker/farm.tsx`
- `src/components/access-status-screen.tsx`
- `src/components/member-row.tsx`
- `src/components/profile-screen.tsx`
- `src/context/auth-context.tsx`
- `src/services/farmService.ts`
- `src/services/memberService.ts`
- `src/utils/routeGuard.ts`
- `src/utils/serviceResult.ts`
- `src/utils/displayFormat.ts`

**Kode aplikasi (dibaca sebagian / dicari terarah):**
- `app/(auth)/register.tsx` (bagian alur pendaftaran)
- `app/(owner)/owner/farm-profile.tsx` (80 baris pertama)
- `src/components/bottom-sheet.tsx` (daftar export)
- `src/components/ui.tsx` (`Screen`, `Button`, pencarian `RefreshControl`)
- `src/constants/operationalReport.ts` (40 baris pertama, sebagai pola pembanding)
- `src/types/domain.ts` (baris 14–143)
- `package.json`

**Migration (dibaca penuh):**
- `supabase/migrations/001_create_extensions_and_enums.sql`
- `supabase/migrations/002_create_core_tables.sql`
- `supabase/migrations/011_create_access_and_actor_display_rpc.sql`
- `supabase/migrations/012_refine_inactive_rejoin_flow.sql`

**Migration (dibaca sebagian / dicari terarah):**
- `supabase/migrations/006_create_indexes_and_triggers.sql` (index `farm_members`, `generate_join_code`, trigger `updated_at`)
- `supabase/migrations/007_enable_rls_and_policies.sql` (baris 1–150: helper `is_active_*` dan policy `farms`/`farm_members`)
- `supabase/migrations/008_create_rpc_functions.sql` (baris 1–355: seluruh RPC keanggotaan)
- `supabase/migrations/020_feature_completion_database_foundation.sql` (baris 915–1190 + pencarian kolom `removed_*`)
- `supabase/migrations/033_restore_farm_actor_display_profiles.sql` (bagian `farm_members`)
- Seluruh 35 file migration disisir dengan pencarian pola untuk: `farm_members`, `farms`, `removed_*`, `reject_worker`, `approve_worker`, `remove_worker`, `request_join_farm`, `create_farm_with_owner`, `leave_current_farm`, `generate_join_code`, `alter type`, `add value`

**Dokumen:**
- `docs/final-design/avology_v2_final_design_spec.md` (hanya pencarian string `AVOL`)

**Tidak dibaca** (di luar scope, dicatat sebagai batas audit): seluruh layar pohon, jadwal, SOP, tugas, laporan operasional, dan media/foto — beserta migration `003`–`005`, `010`, `013`–`019`, `021`–`032`, `034`–`035` selain pencarian pola di atas.

---

## Lampiran B — Hal yang Ditandai TIDAK PASTI

| # | Yang tidak pasti | Kenapa tidak bisa dipastikan dari kode | Yang dibutuhkan untuk memastikan |
|---|---|---|---|
| U-01 | **Migration mana yang benar-benar sudah dijalankan** di database yang Anda pakai | Repo punya 35 file dengan `create or replace` bertumpuk; `request_join_farm` dan `get_current_user_access` masing-masing punya 3 versi. Tidak ada cara membaca dari repo versi mana yang aktif di server | Query **Q1** dan **Q2** |
| U-02 | Apakah **migration 017** pernah ada dan dihapus, atau nomornya memang dilewati | Tidak ada jejak di repo. `git log` untuk file yang tidak pernah di-commit tidak akan menunjukkan apa pun | Cek riwayat: `git log --all --diff-filter=D --name-only -- 'supabase/migrations/017*'`. Kalau kosong, nomornya memang dilewati |
| U-03 | Apakah enum `operational_report_category` di database **sudah** berisi `'pest'`, `'disease'`, `'weather'`, `'disaster'` | `src/constants/operationalReport.ts:19-29` memakai keempat nilai itu, tapi tidak ada satu pun `ALTER TYPE ... ADD VALUE` di seluruh 35 migration, dan `001` mendefinisikan `'area_pest_disease'`/`'disaster_weather'` sebagai gantinya. Salah satu dari dua kemungkinan: enum diubah manual di luar migration, atau ada ketidakcocokan nyata. **Di luar scope audit ini** — dicatat di Lampiran D | Query **Q6** |
| U-04 | Apakah aplikasi punya fitur **hapus kebun** atau **hapus akun** | Saya tidak menemukan RPC `delete_farm`/`delete_account` maupun layar yang memanggilnya. Tapi ketiadaan di repo bukan bukti ketiadaan di server | Query **Q2** (daftar fungsi akan memperlihatkannya) |
| U-05 | Apakah **sudah ada baris `farm_members` bermasalah di produksi** — user dengan lebih dari satu relasi pending/active (R-01), atau baris yatim dari pengajuan lintas kebun | Ini pertanyaan tentang data, bukan tentang kode. Route guard klien mencegahnya terjadi lewat UI, tapi tidak menjamin data yang sudah terlanjur ada bersih | Query **Q3** |
| U-06 | Berapa banyak **entri riwayat yang sudah hilang** akibat R-02 | Baris yang ditimpa tidak meninggalkan jejak. `updated_at > created_at` pada baris `pending` adalah petunjuk kuat (baris itu pernah punya status lain), tapi bukan bukti pasti karena trigger `updated_at` menyala untuk perubahan apa pun | Query **Q4** — hasilnya indikatif, bukan konklusif |
| U-07 | Apakah policy RLS di server **sama persis** dengan yang di migration `007` | Migration `013`–`019` banyak menyentuh policy `photo_attachments` dan `storage.objects`; saya tidak menyisir apakah ada yang mengubah policy `farms`/`farm_members` secara tidak langsung. Pencarian pola tidak menemukannya, tapi policy bisa juga diubah lewat dashboard | Query **Q5** |
| U-08 | Perilaku persis saat **race condition** antara pemohon menekan "Ajukan Gabung" dan pemilik menyetujui/menolak pengajuan sebelumnya | Ini perilaku konkurensi tingkat transaksi. Dari membaca kode, `on conflict do update ... where` seharusnya aman, tapi urutan penguncian baris tidak bisa dipastikan tanpa pengujian | Uji manual dua sesi, atau tes DB terjadwal. **Bukan** sesuatu yang bisa dijawab dengan query |

---

## Lampiran C — Query Database yang Saya Butuhkan dari Anda

Saya tidak menjalankan satu pun dari query ini. Semuanya **read-only**. Jalankan di SQL Editor Supabase dan tempelkan hasilnya kalau Anda ingin saya menutup ketidakpastian di Lampiran B.

### Q1 — Versi migration yang sudah dijalankan
*Menutup U-01.* Tanpa ini, semua analisis RPC di Bagian 3 dan 4 bertumpu pada asumsi bahwa migration 020 adalah yang terakhir dijalankan. Kalau ternyata database berhenti di 011, perilaku `request_join_farm` **berbeda secara material** — versi 008 menimpa bahkan baris `active`.

```sql
select version, name
from supabase_migrations.schema_migrations
order by version;
```

### Q2 — Definisi fungsi yang benar-benar aktif di server
*Menutup U-01 dan U-04.* Ini pemeriksaan paling penting dari semuanya. Ia memperlihatkan versi mana dari setiap RPC yang sungguh berjalan, dan sekaligus mengungkap fungsi yang ada di server tapi tidak ada di repo.

```sql
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as is_security_definer,
  md5(p.prosrc) as body_hash,
  length(p.prosrc) as body_length
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'request_join_farm', 'approve_worker', 'reject_worker', 'remove_worker',
    'leave_current_farm', 'create_farm_with_owner', 'get_current_user_access',
    'get_pending_workers', 'get_active_workers', 'get_member_basic_profiles',
    'get_farm_actor_display_profiles', 'update_farm_profile', 'generate_join_code'
  )
order by p.proname;
```

Kalau Anda ingin saya membandingkan isi persisnya (bukan sekadar hash), jalankan ini untuk fungsi yang mencurigakan:
```sql
select pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'request_join_farm';
```

### Q3 — Apakah sudah ada user dengan lebih dari satu relasi
*Menutup U-05, membuktikan atau menyangkal R-01 terjadi di data nyata.* Kalau hasilnya kosong, R-01 masih risiko struktural tapi belum menimbulkan kerusakan — dan perbaikannya bisa murni preventif tanpa migrasi data.

```sql
select
  user_id,
  count(*) as total_rows,
  count(*) filter (where status in ('pending','active')) as aktif_atau_pending,
  array_agg(farm_id::text || ':' || role::text || ':' || status::text
            order by coalesce(updated_at, created_at) desc) as detail
from public.farm_members
group by user_id
having count(*) filter (where status in ('pending','active')) > 1
   or count(*) > 1
order by total_rows desc;
```

### Q4 — Indikasi riwayat yang sudah tertimpa
*Menutup U-06.* Baris `pending` yang `updated_at`-nya jauh setelah `created_at` hampir pasti adalah baris yang pernah `rejected`/`removed` lalu diajukan ulang — artinya entri riwayatnya sudah hilang. Hasilnya indikatif, bukan bukti.

```sql
select
  fm.id, fm.farm_id, fm.user_id, fm.status,
  fm.created_at, fm.updated_at,
  fm.updated_at - fm.created_at as selisih,
  fm.removed_at, fm.removed_reason
from public.farm_members fm
where fm.status = 'pending'
  and fm.updated_at is not null
  and fm.updated_at > fm.created_at + interval '1 minute'
order by fm.updated_at desc;
```

### Q5 — Policy RLS yang aktif di server
*Menutup U-07.* Memastikan analisis G1 (non-anggota tidak bisa baca `farms`) dan G3 (pemohon bisa baca barisnya sendiri) benar untuk database yang sungguhan, bukan cuma untuk file migration.

```sql
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('farms', 'farm_members', 'profiles')
order by tablename, policyname;
```

### Q6 — Nilai enum yang sesungguhnya
*Menutup U-03 dan memverifikasi 2.2.* Sekaligus memastikan `member_status` di server benar-benar berisi empat nilai yang saya asumsikan — penting sebelum memutuskan apakah `cancelled` perlu ditambahkan (keputusan 7.3 #1).

```sql
select t.typname, array_agg(e.enumlabel order by e.enumsortorder) as nilai
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
  and t.typname in ('member_status', 'member_role', 'operational_report_category')
group by t.typname;
```

### Q7 — Constraint dan index yang aktif pada `farm_members`
*Mendukung keputusan 7.3 #1 dan #5.* Sebelum menambahkan partial unique index untuk R-01, saya perlu tahu persis apa yang sudah ada — termasuk index yang mungkin ditambahkan lewat dashboard dan tidak tercatat di migration.

```sql
select
  i.indexname,
  i.indexdef
from pg_indexes i
where i.schemaname = 'public' and i.tablename = 'farm_members'
union all
select
  con.conname,
  pg_get_constraintdef(con.oid)
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace n on n.oid = rel.relnamespace
where n.nspname = 'public' and rel.relname = 'farm_members';
```

---

## Lampiran D — Temuan Luar Scope

Dicatat, **tidak disentuh**, tidak masuk urutan kerja di 7.2.

| # | Lokasi | Temuan |
|---|---|---|
| **L-01** | [src/constants/operationalReport.ts:19-29](../src/constants/operationalReport.ts) vs [migration 001:34-44](../supabase/migrations/001_create_extensions_and_enums.sql) | Konstanta TS memakai kategori `'pest'`, `'disease'`, `'weather'`, `'disaster'`. Enum `operational_report_category` di migration `001` berisi `'area_pest_disease'` dan `'disaster_weather'` — bukan keempatnya. Tidak ada `ALTER TYPE ... ADD VALUE` di seluruh 35 migration. Entah enum diubah manual di luar migration, atau ada ketidakcocokan nyata antara klien dan database. **TIDAK PASTI** — butuh **Q6**. Kalau enum di server memang belum punya nilai-nilai itu, ini KRITIS untuk fitur laporan operasional |
| **L-02** | [migration 007:122-128](../supabase/migrations/007_enable_rls_and_policies.sql) + [007:348](../supabase/migrations/007_enable_rls_and_policies.sql) | `farms` punya policy UPDATE untuk pemilik aktif **dan** `grant update on public.farms to authenticated`, padahal aplikasi selalu lewat RPC `update_farm_profile`. Dua jalur tulis untuk satu operasi; jalur langsung tidak punya validasi nama kosong yang ada di RPC ([020:935-937](../supabase/migrations/020_feature_completion_database_foundation.sql)) |
| **L-03** | [src/components/ui.tsx](../src/components/ui.tsx) | 2.284 baris dalam satu file berisi seluruh sistem komponen. Di luar scope, tapi menjadi penghalang nyata untuk R-08 (menambah `refreshControl` ke `Screen`) |
| **L-04** | [src/types/domain.ts](../src/types/domain.ts) | 903 baris berisi seluruh tipe domain aplikasi. Sama seperti L-03: bukan masalah audit ini, tapi menjadi tempat perubahan C-01 harus mendarat |
| **L-05** | [src/utils/displayFormat.ts:176-196](../src/utils/displayFormat.ts) | `sanitizeUserFacingMessage` menerjemahkan istilah teknis ke Indonesia lewat regex (`worker`→`pekerja`, `owner`→`pemilik`, dst.) pada pesan error yang sudah terlanjur lolos. Ini tambal sulam atas akar masalah bahwa pesan `raise exception` di RPC ditulis dalam bahasa Inggris dan sebagian bocor ke user. Bekerja, tapi rapuh |
| **L-06** | [(onboarding)/_layout.tsx:25-40](../app/(onboarding)/_layout.tsx) + [access-status-screen.tsx:20-35](../src/components/access-status-screen.tsx) | `refresh()` dipanggil dua kali setiap kali layar tunggu difokuskan (sekali di layout, sekali di komponen). Guard `refreshVersionRef` mencegah race condition, jadi ini pemborosan request, bukan bug — tapi menggandakan beban RPC pada layar yang justru paling sering di-refokus |

---

*Audit selesai. Tidak ada perbaikan yang dikerjakan dan tidak ada fase yang dimulai.*
