# Batch 3 - Route and Guard Regression Pass

Tanggal audit: 2026-06-22

## 1. Executive Summary

Batch 3 adalah regression pass non-implementasi untuk memastikan route, screen mapping, dan guard utama Avology V2 siap dites manual sebelum masuk batch visual/design reconstruction.

Static verification menunjukkan mayoritas route MVP owner dan worker sudah tersedia dan terdaftar pada Expo Router layout yang sesuai. Guard utama juga sudah memisahkan akses berdasarkan session, membership, role, dan status membership.

Status static pass:

- Core owner route: PASS secara static.
- Core worker route: PASS secara static, kecuali worker operational report detail tidak ditemukan sebagai route terpisah.
- Guard owner/worker: PASS/RISK secara static karena inactive recovery flow masih memakai workaround yang diterima untuk pass ini.
- Manual regression tetap wajib dilakukan karena static audit tidak membuktikan data runtime, RLS, RPC, dan state setelah submit.

## 2. Known Issue Accepted for This Pass

Dedicated Rejected Screen dan Removed Access Screen belum stabil sebagai initial login route sekaligus recovery flow. Keputusan sementara untuk Batch 3: issue ini diterima sebagai workaround selama:

- Worker rejected/removed tidak bisa masuk dashboard worker atau data operasional.
- Worker rejected/removed tetap punya jalan untuk join ulang dan kembali menjadi pending.
- User tanpa membership tetap masuk onboarding.
- Owner active dan worker active tetap masuk dashboard masing-masing.

Issue ini harus tetap dicatat sebagai RISK dan wajib diuji ulang sebelum UAT penuh. Jika manual test menemukan inactive worker bisa masuk area operasional, statusnya naik menjadi Critical.

## 3. Static Route Verification Table

| Area | Route/Screen | Expected | Static Status: PASS/GAP/RISK | Notes |
|---|---|---|---|---|
| Public/Auth | Get Started | Entry screen untuk user tanpa session | PASS | Route ditemukan di `app/(auth)/get-started.tsx`. |
| Public/Auth | Login | User bisa login dan kembali ke root resolver | PASS | Route ditemukan di `app/(auth)/login.tsx`; submit mengarah ke access resolution. |
| Public/Auth | Register | User bisa register dan lanjut ke access resolution | PASS | Route ditemukan di `app/(auth)/register.tsx`. |
| Public/Auth | Profile Account | Profile bisa diakses dari area yang diizinkan | PASS | Route profile ada di onboarding, owner, dan worker. |
| Onboarding | Onboarding Decision | User no membership memilih buat/gabung kebun | PASS | Route ditemukan di `app/(onboarding)/onboarding.tsx`. |
| Onboarding | Create Farm | User bisa membuat kebun dan menjadi owner active | PASS | Route ditemukan di `app/(onboarding)/create-farm.tsx`. |
| Onboarding | Join Farm | Worker bisa join farm code | PASS | Route ditemukan di `app/(onboarding)/join-farm.tsx`. |
| Onboarding | Pending Approval | Worker pending diarahkan ke status menunggu | PASS | Route ditemukan di `app/(onboarding)/pending-approval.tsx`. |
| Onboarding | Rejected Screen | Worker rejected tidak masuk dashboard dan melihat status ditolak | RISK | Route ada, tetapi inactive initial route + recovery flow masih known issue accepted. |
| Onboarding | Removed Access Screen | Worker removed tidak masuk dashboard dan melihat status dinonaktifkan | RISK | Route ada, tetapi inactive initial route + recovery flow masih known issue accepted. |
| Owner | Owner Dashboard | Owner active masuk dashboard owner | PASS | Route ditemukan di `app/(owner)/owner/index.tsx`. |
| Owner | Owner Tree List | Owner melihat daftar pohon | PASS | Route ditemukan di `app/(owner)/owner/trees/index.tsx`. |
| Owner | Create Tree | Owner membuat pohon | PASS | Route ditemukan di `app/(owner)/owner/trees/create.tsx`. |
| Owner | Edit Tree | Owner edit pohon | PASS | Route ditemukan di `app/(owner)/owner/trees/[treeId]/edit.tsx`. |
| Owner | Tree Detail | Owner melihat detail pohon | PASS | Route ditemukan di `app/(owner)/owner/trees/[treeId].tsx`. |
| Owner | Condition Report | Owner membuat catatan kondisi | PASS | Route ditemukan di `app/(owner)/owner/trees/[treeId]/report.tsx`. |
| Owner | Growth Phase Record | Owner membuat catatan fase tumbuh | PASS | Route ditemukan di `app/(owner)/owner/trees/[treeId]/phase.tsx`. |
| Owner | Growth Monitoring | Owner melihat monitoring pertumbuhan | PASS | Route ditemukan di `app/(owner)/owner/growth-monitoring.tsx`. |
| Owner | Worker Management | Owner melihat dan mengelola worker | PASS | Route ditemukan di `app/(owner)/owner/workers.tsx`. |
| Owner | Operational Report List | Owner melihat daftar laporan operasional | PASS | Route ditemukan di `app/(owner)/owner/reports/index.tsx`. |
| Owner | Operational Report Detail | Owner melihat detail laporan operasional | PASS | Route ditemukan di `app/(owner)/owner/reports/[reportId].tsx`. |
| Owner | Create Task From Operational Report | Owner membuat task dari laporan operasional | PASS | Route ditemukan di `app/(owner)/owner/reports/[reportId]/task.tsx`. |
| Owner | SOP List | Owner melihat daftar SOP | PASS | Route ditemukan di `app/(owner)/owner/sops/index.tsx`. |
| Owner | SOP Detail | Owner melihat detail SOP | PASS | Route ditemukan di `app/(owner)/owner/sops/[sopId].tsx`. |
| Owner | Create SOP | Owner membuat SOP | PASS | Route ditemukan di `app/(owner)/owner/sops/create.tsx`. |
| Owner | Edit SOP | Owner edit SOP | PASS | Route ditemukan di `app/(owner)/owner/sops/[sopId]/edit.tsx`. |
| Owner | Create Schedule From SOP | Owner membuat jadwal dari SOP | PASS | Route ditemukan di `app/(owner)/owner/sops/[sopId]/schedule.tsx`; Batch 1 membatasi single worker. |
| Owner | Schedule List | Owner melihat daftar jadwal | PASS | Route ditemukan di `app/(owner)/owner/schedules/index.tsx`. |
| Owner | Manual Schedule | Owner membuat jadwal manual | PASS | Route ditemukan di `app/(owner)/owner/schedules/create.tsx`. |
| Owner | Schedule Detail | Owner melihat detail jadwal | PASS | Route ditemukan di `app/(owner)/owner/schedules/[scheduleId].tsx`. |
| Owner | Owner Task List | Owner melihat daftar task | PASS | Route ditemukan di `app/(owner)/owner/tasks/index.tsx`. |
| Owner | Owner Task Detail | Owner melihat detail task | PASS | Route ditemukan di `app/(owner)/owner/tasks/[taskId].tsx`. |
| Owner | Farm Profile/Kebun | Owner melihat profil kebun | PASS | Route ditemukan di `app/(owner)/owner/farm-profile.tsx`. |
| Owner | Account Profile | Owner melihat profil akun | PASS | Route ditemukan di `app/(owner)/owner/profile.tsx`. |
| Worker | Worker Dashboard | Worker active masuk dashboard worker | PASS | Route ditemukan di `app/(worker)/worker/index.tsx`. |
| Worker | Worker Task List | Worker melihat daftar task | PASS | Route ditemukan di `app/(worker)/worker/tasks/index.tsx`. |
| Worker | Worker Task Detail | Worker melihat detail task | PASS | Route ditemukan di `app/(worker)/worker/tasks/[taskId].tsx`. |
| Worker | Complete Task | Worker menyelesaikan task dari detail task | PASS | Action ditemukan secara static pada worker task detail. |
| Worker | Postpone Task | Worker menunda task dari detail task | PASS | Action ditemukan secara static pada worker task detail. |
| Worker | Worker Tree List | Worker melihat daftar pohon | PASS | Route ditemukan di `app/(worker)/worker/trees/index.tsx`. |
| Worker | Worker Tree Detail | Worker melihat detail pohon | PASS | Route ditemukan di `app/(worker)/worker/trees/[treeId].tsx`. |
| Worker | Condition Report | Worker membuat catatan kondisi | PASS | Route ditemukan di `app/(worker)/worker/trees/[treeId]/report.tsx`. |
| Worker | Growth Phase Record | Worker membuat catatan fase tumbuh | PASS | Route ditemukan di `app/(worker)/worker/trees/[treeId]/phase.tsx`. |
| Worker | Worker Operational Report List | Worker melihat daftar laporan operasional | PASS | Route ditemukan di `app/(worker)/worker/reports/index.tsx`. |
| Worker | Worker Create Operational Report | Worker membuat laporan operasional | PASS | Route ditemukan di `app/(worker)/worker/reports/create.tsx`. |
| Worker | Worker Operational Report Detail | Worker membuka detail laporan operasional | GAP | Tidak ditemukan route `app/(worker)/worker/reports/[reportId].tsx`. Jika UAT mengharuskan worker membuka detail report, perlu batch kecil berikutnya. |
| Worker | Worker Profile | Worker melihat profil akun | PASS | Route ditemukan di `app/(worker)/worker/profile.tsx`. |
| Guard | No session to owner/worker routes | User tanpa session tidak boleh masuk owner/worker | PASS | Guard mengarah ke auth entry. Manual deep link tetap wajib diuji. |
| Guard | Owner active | Owner active diarahkan ke owner dashboard | PASS | Resolver membedakan owner active. |
| Guard | Worker active | Worker active diarahkan ke worker dashboard | PASS | Resolver membedakan worker active. |
| Guard | Worker pending | Worker pending tidak boleh masuk dashboard worker | PASS | Resolver mengarah ke pending approval. |
| Guard | Worker rejected/removed | Worker inactive tidak boleh masuk dashboard worker | RISK | Guard statically memblok operational route, tetapi inactive status + recovery masih known issue accepted. |
| Guard | Worker tree actions | Worker tidak melihat edit/archive pohon | PASS | Tree detail memakai mode owner/worker; edit/archive hanya owner. |
| Guard | Worker owner-only modules | Worker tidak melihat SOP/schedule/worker management dari nav | PASS | Worker layout tidak mendaftarkan route owner modules. |
| Guard | No membership | User tanpa membership masuk onboarding | PASS | Resolver membedakan no membership dari inactive membership. |

## 4. Manual Regression Checklist Owner

| Test ID | Scenario | Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|
| B3-OWN-01 | Owner login | Login dengan akun owner active | Masuk langsung ke Owner Dashboard tanpa onboarding flash | TBD | Not Run | Wajib tes di device/emulator. |
| B3-OWN-02 | Create farm | Register/login akun baru, pilih buat kebun, submit data kebun | Farm dibuat dan user menjadi owner active | TBD | Not Run | Pastikan tidak ada route loop. |
| B3-OWN-03 | Farm profile | Dari owner area buka profil kebun | Nama kebun dan info join code tampil tanpa UUID teknis | TBD | Not Run | |
| B3-OWN-04 | Worker management pending | Worker join farm, owner buka Worker Management | Worker pending tampil di section pengajuan | TBD | Not Run | |
| B3-OWN-05 | Approve/reject/remove worker | Approve worker pending, reject worker lain, remove worker active | Status pindah ke section yang benar dan copywriting user-facing | TBD | Not Run | |
| B3-OWN-06 | Create tree | Buka Owner Tree List, pilih tambah pohon, submit | Pohon baru tampil di list | TBD | Not Run | |
| B3-OWN-07 | Edit tree | Buka detail pohon, pilih edit, simpan perubahan | Detail/list memakai data baru | TBD | Not Run | |
| B3-OWN-08 | Archive/unarchive tree | Dari detail pohon archive lalu restore/unarchive | Status berubah tanpa menghapus histori | TBD | Not Run | |
| B3-OWN-09 | Condition report | Dari detail pohon buat catatan kondisi | Kondisi terkini dan timeline terupdate | TBD | Not Run | |
| B3-OWN-10 | Growth phase | Dari detail pohon buat catatan fase tumbuh | Fase terkini dan timeline terupdate | TBD | Not Run | |
| B3-OWN-11 | Growth monitoring | Buka Growth Monitoring dari owner area | Screen terbuka dan data pertumbuhan terbaca | TBD | Not Run | |
| B3-OWN-12 | Create SOP | Buka SOP List, buat SOP baru | SOP baru tampil di list | TBD | Not Run | |
| B3-OWN-13 | SOP detail/edit/toggle | Buka detail SOP, edit, toggle active/inactive | Detail berubah dan status active tampil user-facing | TBD | Not Run | |
| B3-OWN-14 | Create schedule from SOP | Dari SOP detail/list pilih buat jadwal dari SOP untuk satu worker active | Jadwal dibuat dengan satu worker dan tidak ada multi-select regression | TBD | Not Run | Batch 1 safety check. |
| B3-OWN-15 | Create manual schedule | Buka Schedule List, pilih Buat Manual, submit | Jadwal manual dibuat | TBD | Not Run | |
| B3-OWN-16 | Schedule detail and generated task | Buka schedule detail setelah create schedule | Detail jadwal tampil dan task worker terkait terbentuk | TBD | Not Run | |
| B3-OWN-17 | Owner task list/detail | Buka daftar task owner lalu detail task | Task tampil dengan status, worker, dan sumber jadwal/report | TBD | Not Run | |
| B3-OWN-18 | Operational report list/detail | Buka report list dan detail report worker | Report tampil tanpa UUID/raw enum | TBD | Not Run | |
| B3-OWN-19 | Create task from report | Dari report status new pilih buat task | Task dibuat dan status report berubah sesuai RPC | TBD | Not Run | Batch 1 safety check. |
| B3-OWN-20 | Owner dashboard summary | Setelah data dibuat, kembali ke dashboard | Summary mencerminkan data terbaru secara masuk akal | TBD | Not Run | |

## 5. Manual Regression Checklist Worker

| Test ID | Scenario | Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|
| B3-WRK-01 | Worker no membership onboarding | Login akun worker baru tanpa membership | Masuk Onboarding Decision | TBD | Not Run | Jangan rusak behavior no membership. |
| B3-WRK-02 | Join farm | Dari onboarding pilih Gabung Kebun, input join code valid | Membership menjadi pending dan masuk Pending Approval | TBD | Not Run | |
| B3-WRK-03 | Worker active login | Setelah owner approve, login ulang worker | Masuk Worker Dashboard tanpa onboarding flash | TBD | Not Run | |
| B3-WRK-04 | Worker dashboard | Buka dashboard worker | Hierarchy task utama tampil dan tidak ada action owner-only | TBD | Not Run | |
| B3-WRK-05 | Task list | Dari dashboard buka daftar task | Task worker tampil | TBD | Not Run | |
| B3-WRK-06 | Task detail | Buka salah satu task | Detail task terbuka dan action worker tersedia | TBD | Not Run | |
| B3-WRK-07 | Complete task | Dari task detail pilih complete | Task selesai dan care activity tercatat | TBD | Not Run | |
| B3-WRK-08 | Postpone task | Dari task detail pilih postpone | Task ditunda dan care activity/status tercatat | TBD | Not Run | |
| B3-WRK-09 | Tree list | Buka daftar pohon worker | Pohon kebun tampil tanpa action edit/archive | TBD | Not Run | |
| B3-WRK-10 | Tree detail | Buka detail pohon worker | Detail, timeline, kondisi, fase tampil tanpa UUID/raw actor id | TBD | Not Run | |
| B3-WRK-11 | Create condition report | Dari detail pohon worker buat catatan kondisi | Report dibuat dan timeline menampilkan "Anda" untuk actor sendiri | TBD | Not Run | |
| B3-WRK-12 | Create growth phase | Dari detail pohon worker buat fase tumbuh | Fase dibuat dan timeline terupdate | TBD | Not Run | |
| B3-WRK-13 | Create operational report | Buka Worker Report, pilih buat report, submit | Report operasional dibuat | TBD | Not Run | |
| B3-WRK-14 | Worker operational report list | Kembali ke report list worker | Report baru tampil di list | TBD | Not Run | Worker report detail route belum ditemukan static. |
| B3-WRK-15 | Worker profile/logout | Buka profile worker lalu logout | Profile terbuka, logout kembali ke auth | TBD | Not Run | |

## 6. Manual Regression Checklist Guard/Access

| Test ID | Scenario | Steps | Expected Result | Actual Result | Status | Notes |
|---|---|---|---|---|---|---|
| B3-GRD-01 | No session blocks owner | Logout lalu deep link ke `/owner` | Redirect ke auth/get started | TBD | Not Run | |
| B3-GRD-02 | No session blocks worker | Logout lalu deep link ke `/worker` | Redirect ke auth/get started | TBD | Not Run | |
| B3-GRD-03 | Owner blocked from worker area | Login owner active lalu deep link ke `/worker` | Redirect/stay ke owner dashboard | TBD | Not Run | |
| B3-GRD-04 | Worker blocked from owner area | Login worker active lalu deep link ke `/owner` | Redirect/stay ke worker dashboard | TBD | Not Run | |
| B3-GRD-05 | Pending worker blocked | Login worker pending lalu deep link ke `/worker` | Redirect ke Pending Approval | TBD | Not Run | |
| B3-GRD-06 | Rejected worker blocked | Login worker rejected lalu deep link ke `/worker` | Tidak masuk worker dashboard; masuk status/recovery route sesuai workaround | TBD | Not Run | Known issue accepted only if operational access blocked. |
| B3-GRD-07 | Removed worker blocked | Login worker removed lalu deep link ke `/worker` | Tidak masuk worker dashboard; masuk status/recovery route sesuai workaround | TBD | Not Run | Known issue accepted only if operational access blocked. |
| B3-GRD-08 | Worker tree owner action hidden | Login worker active, buka tree detail | Tidak ada edit/archive/restore tree | TBD | Not Run | |
| B3-GRD-09 | Worker cannot access SOP | Login worker active, deep link ke `/owner/sops` | Redirect ke worker dashboard atau blocked | TBD | Not Run | |
| B3-GRD-10 | Worker cannot access Worker Management | Login worker active, deep link ke `/owner/workers` | Redirect ke worker dashboard atau blocked | TBD | Not Run | |
| B3-GRD-11 | No membership resolver | Login akun tanpa membership | Masuk Onboarding Decision | TBD | Not Run | |
| B3-GRD-12 | Inactive recovery rejoin | Login rejected/removed, gunakan flow join ulang | Bisa submit join code dan status menjadi pending | TBD | Not Run | Accepted workaround path. |
| B3-GRD-13 | Inactive cannot bypass by back button | Setelah rejected/removed mencoba back/deep link operational | Tidak masuk owner/worker operational area | TBD | Not Run | |

## 7. Bugs Found During Manual Test

| Bug ID | Severity: Critical/High/Medium/Low | Area | Reproduction Steps | Expected | Actual | Suggested Next Batch | Status |
|---|---|---|---|---|---|---|---|
| B3-BUG-001 | High | Auth/Inactive Access | Login worker rejected/removed, lalu gunakan tombol recovery dan back/deep link | Initial status jelas, recovery ke onboarding/join jelas, operational route tetap blocked | Dedicated Rejected/Removed Screen belum stabil sebagai initial login route + recovery flow; workaround diterima sementara | Guard hardening mini-batch sebelum UAT jika manual test gagal atau membingungkan tester | Known Accepted |
| B3-BUG-002 | Medium | Worker Operational Report | Worker membuka daftar report lalu mencoba membuka detail report | Jika detail report termasuk UAT, report detail terbuka | Tidak ditemukan route worker report detail secara static | Batch kecil untuk worker report detail jika dikonfirmasi sebagai kebutuhan UAT | Open |
| B3-BUG-003 | Medium | Navigation UX | Buka nested form/detail dengan bottom navigation aktif | Navigasi mobile-native tidak membingungkan tester | Perlu validasi manual; static route tidak membuktikan UX/back stack stabil | Batch visual/navigation cleanup, bukan Batch 3 | Open |
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | Not Run |

## 8. Go / No-Go Criteria Before Batch 4

Critical bug berarti Batch 4 tidak boleh dimulai. Contoh Critical:

- Owner atau worker tidak bisa login ke area yang benar.
- User tanpa session bisa masuk owner/worker route.
- Worker pending/rejected/removed bisa masuk dashboard worker atau data operasional.
- Core data flow rusak: create farm, join farm, create tree, schedule to task, worker complete/postpone task, operational report to task tidak bisa selesai.
- App crash/blocker yang membuat UAT core flow tidak dapat dijalankan.

High bug berarti harus diperbaiki sebelum visual reconstruction jika memengaruhi core flow. Contoh High:

- Task tidak terbentuk dari schedule yang valid.
- Status report salah berubah dari resolved/rejected menjadi in_progress.
- Inactive recovery membuat tester terjebak dan tidak bisa join ulang.
- Owner tidak bisa melihat worker pending/active/inactive yang diperlukan untuk UAT.

Medium bug boleh dikelompokkan setelah core flow aman jika tidak memblokir UAT utama. Contoh Medium:

- Worker report detail route belum ada tetapi list/create masih bisa berjalan.
- Copywriting status kurang jelas tetapi tidak menampilkan UUID/raw enum.
- Back stack atau bottom nav terasa kurang native tetapi tidak membuka akses salah.

Low bug boleh masuk backlog polish. Contoh Low:

- Spacing, empty state, atau microcopy minor.
- Visual hierarchy belum dekat design reference selama action masih jelas dan core flow bisa dites.

Go ke Batch 4 hanya jika:

- Tidak ada Critical bug dari checklist manual.
- Tidak ada High bug yang memblokir owner/worker core flow.
- Known issue inactive access tetap tidak membocorkan dashboard/data operasional.
- Manual tester bisa menyelesaikan minimal satu alur end-to-end: owner create SOP/schedule, worker menerima dan menyelesaikan task, worker membuat report, owner membuat task dari report.
