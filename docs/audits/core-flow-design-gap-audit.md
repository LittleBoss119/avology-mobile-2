# Core Flow + Design Gap Audit Avology V2

Tanggal audit: 22 Juni 2026
Mode audit: non-edit, static code/read audit, source-of-truth review, design-reference review, typecheck.

Scope yang dibaca:

- `docs/reviews/review-checkpoint-avology-with-design-planning.md`
- `docs/product-alignment/01-product-alignment-decision-log.md`
- `docs/implementation/implementation-master-plan.md`
- `docs/source-of-truth/04-mvp_scope.md`
- `docs/source-of-truth/05-requirement.md`
- `docs/source-of-truth/13-screen-navigation-flow.md`
- `docs/source-of-truth/15-traceability-matrix.md`
- `docs/source-of-truth/16-black-box-plan-testing.md`
- `docs/design-reference/avology-v1/`
- Route, screen, component, service, route guard, formatter, and Supabase migration files related to core flow.

Catatan batas audit:

- Tidak ada kode aplikasi yang diubah.
- Tidak ada database migration yang diubah.
- Tidak ada service yang diubah.
- Tidak ada routing yang diubah.
- Verifikasi yang dilakukan: `npm run typecheck` lulus.
- Audit ini belum menjalankan manual E2E/UAT atau `npm run test:db:all`, sehingga status PASS berarti "terbukti dari mapping/static implementation", bukan "sudah lulus klik end-to-end di device".

## 1. Executive Summary

Avology V2 saat ini sudah lebih dekat ke aplikasi operasional kebun daripada checkpoint sebelumnya. Route utama owner/worker ada, screen khusus yang sebelumnya dicurigai salah mapping sekarang secara static audit sudah mengarah ke screen yang benar, dan service layer untuk SOP, schedule, task, report, condition, growth phase, history, dashboard, serta role guard sudah cukup lengkap.

Namun aplikasi belum siap UAT final. Risiko terbesar bukan lagi "screen tidak ada", melainkan:

1. Ada risiko data core flow pada pembuatan jadwal SOP multi-worker karena fallback direct insert tidak transaksional.
2. Tindak lanjut operational report berpotensi memaksa status laporan menjadi `in_progress` setelah task dibuat, termasuk ketika status sebelumnya bukan `new`.
3. Worker management belum menampilkan rejected/removed worker, sehingga histori akses worker tidak hilang di DB tetapi tidak cukup terlihat di UI.
4. Tree history menyimpan actor id, tetapi display nama aktor untuk removed worker masih lemah pada beberapa area.
5. UI masih jauh dari design reference: tree list belum grid visual, tree detail belum punya hero image/placeholder, schedule list belum punya summary/filter/badge/FAB, farm profile belum menjadi hub seperti "Kebun Saya", dan bottom nav masih text-only serta tetap muncul di banyak nested form/detail.

Kesimpulan: core implementation sekarang layak masuk regression manual terarah, tetapi belum layak disebut UAT-ready. Tahap berikutnya sebaiknya fix batch kecil untuk risiko data/route/action dulu, baru visual reconstruction.

## 2. PASS / FAIL / GAP Table

| Area | Status | Evidence | Catatan |
| --- | --- | --- | --- |
| Auth login/register/logout | PASS | `app/(auth)/*`, `authService`, `AuthProvider` | Flow ada; branding/password UX masih gap desain. |
| Owner create farm | PASS | `create-farm.tsx`, `farmService.createFarm`, RPC `create_farm_with_owner` | Membuat farm + owner active via RPC. |
| Worker join farm | PASS | `join-farm.tsx`, `memberService.requestJoinFarm` | Join code memakai RPC dan pending status. |
| Pending/rejected/removed guard | PASS | `routeGuard.ts`, onboarding routes | Screen ada dan redirect target ada. Perlu manual test. |
| Worker management approve/reject/remove | PASS/GAP | `workers.tsx`, `memberService` | Action ada, tetapi UI hanya pending/active; rejected/removed list tidak terlihat. |
| Create/edit/archive/unarchive tree | PASS | tree routes, `treeService` | Edit route benar; archive/unarchive ada di detail. |
| Worker tree list/detail | PASS | worker tree routes use `TreeDetailScreen mode="worker"` | Owner edit/archive tidak tampil pada mode worker. |
| Condition report | PASS | `tree-condition-report-screen`, trigger `sync_tree_current_condition` | Updates current condition jika migration sudah applied. |
| Growth phase | PASS | `tree-growth-phase-record-screen`, trigger `sync_tree_current_growth_phase` | Updates current growth phase jika migration sudah applied. |
| Care SOP list/create/detail/edit/toggle | PASS | `owner/sops/*`, `careSopService` | Detail, edit, active toggle ada. |
| Create schedule from SOP | PASS/RISK | `owner/sops/[sopId]/schedule.tsx`, `careScheduleService` | Screen ada; multi-worker path non-transaksional. |
| Create manual schedule | PASS | `owner/schedules/create.tsx`, RPC `create_manual_schedule` | Membuat schedule + task untuk satu worker. |
| Care Schedule Detail | PASS | `owner/schedules/[scheduleId].tsx` | Bukan form duplicate; menampilkan detail dan task. |
| Schedule generates worker task | PASS/RISK | RPC/direct insert in `careScheduleService` | Single/manual via RPC; multi-worker SOP direct insert risk. |
| Owner task list/detail | PASS | `owner/tasks/*` | Owner bisa lihat detail dan aktivitas. |
| Worker task list/detail | PASS | `worker/tasks/*` | Detail, complete, postpone, activity list ada. |
| Complete/postpone creates care activity | PASS | RPC `complete_task`, `postpone_task`, trigger status sync | Static DB flow ada; perlu E2E. |
| Operational report worker create/list | PASS | `worker/reports/*`, RLS filters own reports | Worker create dan own list ada. |
| Operational report owner list/detail/status | PASS | `OwnerOperationalReport*`, RPC status update | Status update via RPC. |
| Create task from operational report | PASS/RISK | `owner/reports/[reportId]/task.tsx`, `careTaskService` | Route benar; status report update risk. |
| Owner dashboard summary | PASS/GAP | `dashboardService`, `owner/index.tsx` | Data utama ada; visual hierarchy/design reference masih gap. |
| Worker dashboard | PASS/GAP | `worker/index.tsx` | Task-based ada; masih card/text heavy. |
| Tree history integrated | PASS/GAP | `tree_history_view`, `historyService` | Condition/phase/care tree target ada; actor display/history names perlu diperkuat. |
| UUID/raw enum semantic cleanup | PASS/GAP | `displayFormat`, `treeFormat`, services | Formatter banyak dipakai, tetapi raw DB error bisa bocor jika tidak ada friendly mapping. |
| Design reference alignment | FAIL/GAP | dibanding `docs/design-reference/avology-v1/` | Belum cukup dekat untuk UAT visual. |

## 3. Critical Broken Flow

### 3.1 Create Schedule From SOP multi-worker tidak transaksional

Status: FAIL/RISK.

`CreateScheduleFromSOPScreen` memungkinkan memilih banyak worker. Service `createScheduleFromSOP` memakai RPC `create_schedule_from_sop` hanya saat satu worker. Saat worker lebih dari satu, service membuat schedule dengan direct insert lalu membuat banyak task dengan insert terpisah.

Risiko:

- Jika insert schedule berhasil tetapi insert task gagal, jadwal bisa tersimpan tanpa task lengkap.
- Service mengembalikan error "Jadwal berhasil dibuat, tetapi tugas pekerja gagal dibuat", tetapi tidak melakukan rollback.
- Ini berbahaya karena source-of-truth menyatakan jadwal harus menghasilkan tugas worker.

Rekomendasi: jadikan pembuatan SOP schedule multi-worker transaksional via RPC kecil, atau batasi UI sementara ke satu worker sampai RPC multi-worker tersedia.

### 3.2 Create Task From Operational Report dapat memaksa status report ke `in_progress`

Status: FAIL/RISK.

RPC `create_task_from_operational_report` sudah mengubah status report ke `in_progress` hanya jika status report masih `new`. Namun service `createTaskFromOperationalReport` memanggil `update_operational_report_status` lagi setelah task dibuat dan selalu mengirim `in_progress`.

Risiko:

- Report yang sudah `resolved` atau `rejected` dapat turun kembali menjadi `in_progress` ketika owner membuat task.
- Status report bisa tidak mencerminkan keputusan owner sebelumnya.
- Ini menyentuh core flow owner: report detail/status update/create task from report.

Rekomendasi: status update setelah create task cukup dilakukan di satu tempat dan tidak boleh override status non-`new`.

### 3.3 Removed worker history tidak hilang di DB, tetapi identity display belum aman

Status: GAP/RISK.

Data worker removed tetap dipertahankan oleh status `removed`, dan task/report/activity lama tidak dihapus. Namun beberapa display nama aktor mengambil nama dari `getActiveWorkers` atau fallback actor id yang disanitasi menjadi label generik.

Risiko:

- Histori masih ada, tetapi nama pelaku lama bisa hilang dari UI setelah worker removed.
- UAT bisa menganggap riwayat worker "hilang" karena yang terlihat hanya catatan tanpa identitas manusia yang jelas.

Rekomendasi: gunakan RPC/view basic member profile untuk pending/active/rejected/removed pada tampilan histori owner, tanpa membuka profil bebas.

## 4. Missing or Wrong Route Mapping

| Route/screen khusus | Status | Audit result |
| --- | --- | --- |
| Edit Tree | PASS | `app/(owner)/owner/trees/[treeId]/edit.tsx` memuat `OwnerEditTreeScreen`, load detail tree, submit ke `updateTree`, lalu kembali ke detail. |
| Care Schedule Detail | PASS | `app/(owner)/owner/schedules/[scheduleId].tsx` menampilkan judul, kategori, tanggal, target, instruksi, dan task yang dihasilkan. Bukan salah mapping ke form create. |
| Create Schedule From SOP | PASS/RISK | `app/(owner)/owner/sops/[sopId]/schedule.tsx` benar. Risiko ada di transaksi multi-worker, bukan route. |
| SOP Detail | PASS | `app/(owner)/owner/sops/[sopId].tsx` menampilkan detail, acuan jadwal, edit, toggle active, dan create schedule. |
| Edit SOP | PASS | `app/(owner)/owner/sops/[sopId]/edit.tsx` memuat data SOP dan submit ke `updateCareSOP`. |
| Worker Task Detail | PASS | `app/(worker)/worker/tasks/[taskId].tsx` menampilkan detail, complete, postpone, dan activity. |
| Create Task From Operational Report | PASS/RISK | `app/(owner)/owner/reports/[reportId]/task.tsx` wrapper ke screen yang benar. Risiko status update ada di service. |

Tidak ditemukan route yang secara static audit jelas menampilkan screen lain yang salah. Temuan checkpoint sebelumnya kemungkinan berasal dari screenshot/documentation mismatch atau sudah diperbaiki.

## 5. Missing MVP Screen

| Screen MVP | Status | Catatan |
| --- | --- | --- |
| Rejected Screen | PASS | `app/(onboarding)/rejected.tsx` ada. |
| Removed Access Screen | PASS | `app/(onboarding)/removed-access.tsx` ada. |
| Growth Monitoring | PASS | `app/(owner)/owner/growth-monitoring.tsx` ada. |
| Owner Task List/Detail | PASS | `app/(owner)/owner/tasks/*` ada. |
| Worker Operational Report List | PASS | `app/(worker)/worker/reports/index.tsx` ada. |
| Farm Detail/Profile | PASS/GAP | `owner/farm-profile.tsx` ada, tetapi masih tipis dan belum menjadi hub seperti design reference. |
| Edit Profile | GAP | Fungsi edit profil ada inline di `ProfileScreen`, tetapi tidak ada route/screen terpisah sesuai inventory. Tidak critical jika diterima sebagai simplifikasi MVP. |
| Archived Tree List | GAP/OK | Tidak ada screen terpisah; owner tree list punya toggle Aktif/Diarsipkan. Ini cukup secara fungsi, tetapi berbeda dari inventory jika butuh screen tersendiri. |

## 6. Missing MVP Action

| Action | Status | Catatan |
| --- | --- | --- |
| Owner approve/reject worker | PASS | Ada di Worker Management. |
| Owner remove worker | PASS | Ada sebagai "Nonaktifkan". |
| Owner melihat rejected/removed worker | GAP | Source menyebut owner melihat status pending/active/rejected/removed, tetapi UI hanya pending dan active. |
| Owner unarchive tree | PASS | Tombol "Pulihkan" muncul saat pohon archived. |
| Owner create schedule from SOP dari Schedule area | GAP | Action ada dari SOP Detail, tetapi Schedule List hanya punya "Buat Jadwal Manual". Source Schedule List mengharapkan akses buat dari SOP juga. |
| Owner create manual schedule | PASS | Ada. |
| Worker complete task | PASS | Ada di Worker Task Detail. |
| Worker postpone task dengan catatan | PASS | Ada dan catatan wajib. |
| Worker complete task dengan catatan opsional | GAP | Service mendukung optional note, tetapi UI tidak menyediakan input catatan saat complete. Tidak critical, tetapi requirement menyebut worker dapat menambahkan catatan singkat saat selesai/tunda. |
| Owner create task from operational report | PASS/RISK | Ada, tetapi status report update perlu dibatasi. |
| Farm join code copy/action | GAP | Join code tampil, tetapi belum ada copy interaction seperti reference. |

## 7. Role Guard Risks

Yang sudah kuat:

- `resolveAccessRoute` membedakan no session, no membership, pending, rejected, removed, owner active, worker active.
- Owner/worker layouts refresh auth state on focus dan redirect jika target access route tidak cocok.
- Service layer banyak melakukan check active owner/worker/farm member sebelum operasi.
- RLS policy membatasi worker hanya melihat task sendiri dan operational report sendiri.

Risiko:

- `getCurrentUserFarm` mengambil membership terbaru dengan `.order('created_at', desc).limit(1)`. Jika nanti user punya beberapa membership lintas farm atau histori join yang lebih kompleks, route target bisa mengikuti membership terbaru, bukan membership aktif yang paling relevan. Ini bukan blocker MVP single-farm, tetapi perlu dicatat.
- Bottom navigation selalu muncul di owner/worker layout, termasuk nested form/detail. Ini bukan role bypass, tetapi bisa mengganggu focus dan memberi escape path saat user sedang submit form.
- Owner farm/profile tab label masih "Akun", sementara product alignment merekomendasikan owner tab "Kebun" sebagai hub. Ini membuat owner-only farm actions agak tersembunyi.
- ErrorBanner memakai message service apa adanya jika tidak ada friendly mapping. Pesan teknis dari Supabase/RPC yang belum dipetakan masih bisa tampil user-facing.

## 8. Data/History Risks

Yang sudah kuat:

- Condition report insert memiliki trigger `sync_tree_current_condition`.
- Growth phase insert memiliki trigger `sync_tree_current_growth_phase`.
- `complete_task` dan `postpone_task` membuat `care_activities`.
- Trigger `sync_task_status_from_activity` menyinkronkan status task dari activity terbaru.
- `tree_history_view` menggabungkan condition, phase, dan care activity untuk task target `tree`.
- Database test scripts tersedia untuk membership, condition/phase/history, SOP/schedule/task/activity, operational report RPC, dan dashboard aggregate.

Risiko:

- `tree_history_view` hanya memasukkan care activity yang targetnya pohon. Tugas target farm/row/column/custom tidak muncul di riwayat pohon individual. Ini sesuai model, tetapi perlu dijelaskan saat UAT.
- Multi-worker SOP schedule path non-transaksional bisa menghasilkan jadwal tanpa task lengkap.
- Task from operational report dapat override report status ke `in_progress`.
- Removed worker data tidak dihapus, tetapi nama worker removed belum selalu muncul di history UI.
- `ConditionReportList` masih terpisah dari `TreeHistoryTimeline`, sehingga condition history tampil dua kali secara konsep: timeline terintegrasi dan daftar kondisi khusus. Ini bukan data loss, tetapi UX history terasa redundant.
- DB tests belum dijalankan dalam audit ini; status data/history masih perlu regression aktual.

## 9. UI Semantic Problems

| Problem | Status | Detail |
| --- | --- | --- |
| UUID visible to user | Mostly PASS/GAP | UI memakai display code dan formatter; person id disanitasi. Tetapi raw service error yang tidak termapping masih bisa mengandung id teknis. |
| Raw enum visible | Mostly PASS | Formatter tersedia untuk role, member status, condition, growth phase, report category/status, care category, task status, target type. |
| Technical labels | GAP | Beberapa label masih admin-like: "Status arsip", "Tipe jadwal", "Target default", "Interval", "Tipe sumber". Bisa diterima internal, tetapi kurang natural untuk UAT. |
| Duplicate/redundant buttons | GAP | Tree detail owner punya banyak full-width footer action. Schedule/SOP/report forms juga banyak full-width button. |
| Manual refresh buttons | GAP/OK | Pending/rejected/removed screen punya "Cek Status". Ini functional, tetapi design bisa dibuat lebih halus nanti. |
| Owner-only actions visible to worker | PASS | Worker tree detail tidak menampilkan edit/archive; worker routes tidak expose SOP/schedule management. |
| Worker action hidden/confusing | GAP | Worker "Laporkan Kondisi Pohon" dari dashboard hanya membawa ke tree list, bukan langsung memberi pilihan "pilih pohon lalu lapor". Masih bisa digunakan, tetapi kurang eksplisit untuk worker lapangan. |
| Encoding/format artifact | FAIL/GAP | `formatAreaSize` di farm profile menampilkan artifact satuan luas, terlihat seperti `m2` yang rusak encoding-nya, indikasi encoding artifact user-facing. |

## 10. Design Reference Gap

Audit design reference memakai screenshot Avology V1 yang tersedia di `docs/design-reference/avology-v1/`.

| Area | Status | Gap |
| --- | --- | --- |
| Auth branding/logo | GAP | Login current clean, tetapi belum kuat secara brand/logo/illustration. Reference auth lebih minimal dan punya password visibility. |
| Owner dashboard insight hierarchy | GAP | Current dashboard punya data penting, tetapi belum hero "Kondisi Kebun" dengan persentase sehat, warning card kuat, distribusi fase visual, dan aktivitas terbaru. Join code masih muncul di dashboard. |
| Worker dashboard task hierarchy | GAP | Sudah task-based, tetapi masih text-card dan quick-action. Belum terasa seperti task command center mobile. |
| Tree list grid/visual placeholder/FAB | FAIL/GAP | Current tree list masih satu kolom text card, tanpa image/placeholder, tanpa 2-column grid, dan button tambah ada di footer, bukan FAB. |
| Tree detail hero/info grid/timeline | FAIL/GAP | Current detail informatif tetapi belum punya hero image/placeholder, info icon grid, action layout reference, timeline visual dengan thumbnail/filter. |
| Schedule list summary/filter/badge/FAB | FAIL/GAP | Current schedule list hanya list + create manual. Belum ada summary "hari ini", search/filter chips, status badge kaya reference, atau FAB. |
| Farm/profile hub | GAP | `farm-profile` ada tetapi masih data card + dua tombol. Reference "Kebun Saya" menyatukan data kebun, join code copy, active/pending summary, pending request, dan active worker list. |
| Bottom nav mobile-native behavior | GAP | Current bottom nav text-only, rectangular, tanpa icons, dan tetap tampil di nested form/detail. Reference icon-based, rounded, lebih native. |

## 11. Recommended Fix Batches

Maksimum 5 batch kecil, urut, dan bisa dites satu per satu.

### Batch 1 - Core Data Safety

Tujuan: tutup risiko data yang bisa merusak UAT.

- Perbaiki create schedule from SOP multi-worker agar transaksional, atau batasi sementara ke single worker.
- Perbaiki create task from operational report agar tidak override status non-`new`.
- Test: TC-SCH-01 sampai TC-SCH-04, TC-OPR-05 sampai TC-OPR-08, TC-TASK-01 sampai TC-TASK-05.

### Batch 2 - Missing Action and History Visibility

Tujuan: tutup action/core visibility yang masih gap.

- Tampilkan rejected/removed worker atau minimal section histori akses worker di Worker Management.
- Perkuat display nama aktor pada history/report/activity untuk removed worker memakai safe member profile RPC/view.
- Tambahkan akses "Buat Jadwal dari SOP" dari Schedule List menuju SOP list/detail flow.
- Test: TC-MEM-05 sampai TC-MEM-09, TC-DATA-02, TC-HIS-01 sampai TC-HIS-03.

### Batch 3 - Route/Guard Regression Pass

Tujuan: buktikan semua route core bisa diklik penuh owner/worker.

- Manual regression owner: login, create farm, worker management, tree create/edit/archive/unarchive, condition, phase, SOP create/detail/edit/toggle, schedule from SOP, manual schedule, task/detail, report status/task.
- Manual regression worker: join, pending/rejected/removed guard, dashboard, task list/detail, complete/postpone, tree list/detail, condition, phase, operational report.
- Isi actual result pada black-box matrix.

### Batch 4 - UI Semantic Cleanup

Tujuan: hilangkan rasa database admin sebelum visual reconstruction.

- Sanitasi semua error user-facing dengan `sanitizeUserFacingMessage` atau mapping tambahan.
- Ganti label teknis yang terlalu mentah.
- Perbaiki artifact satuan luas pada farm profile.
- Tambahkan catatan opsional saat worker complete task jika dianggap wajib oleh requirement.
- Test: TC-UX-01 sampai TC-UX-07, TC-UI-01.

### Batch 5 - Design Reconstruction Shell

Tujuan: dekatkan UI ke reference tanpa menambah storage/foto upload.

- Auth branding/logo pass.
- Owner dashboard hero insight + recent activity shell.
- Tree list 2-column visual card + static/local placeholder + FAB.
- Tree detail hero placeholder + info grid + timeline terintegrasi.
- Schedule list summary/search/chips/badge/FAB.
- Farm profile menjadi "Kebun Saya" hub.
- Bottom nav icon-based dan hide/adjust behavior pada nested form/detail.

## 12. Do Not Do Yet

- Jangan implement foto/media/upload/storage dulu.
- Jangan tambah migration attachment.
- Jangan tambah `requires_photo`.
- Jangan permanent delete pohon.
- Jangan refactor besar lintas modul.
- Jangan mengubah routing besar sebelum Batch 1 sampai Batch 3 lulus.
- Jangan visual polish pixel-level sebelum core data safety selesai.
- Jangan tambah fitur prediksi panen, estimasi panen, IoT, chat, notifikasi, atau finance.
- Jangan gabungkan semua rekomendasi dalam satu prompt/perubahan besar.
