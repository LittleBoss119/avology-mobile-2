-- 039: selaraskan enum operational_report_category dengan database yang sebenarnya
--
-- KENAPA MIGRATION INI ADA, PADAHAL DI DATABASE SEKARANG TIDAK MENGUBAH APA PUN:
--
-- Enum public.operational_report_category dibuat di migration 001 dengan TUJUH
-- nilai: land_damage, broken_tool, out_of_stock, area_pest_disease,
-- disaster_weather, worker_need, other.
--
-- Database live berisi SEBELAS. Empat nilai terakhir — pest, disease, weather,
-- disaster — tidak dibuat oleh satu pun file migration di repo ini; keduanya
-- muncul di posisi paling belakang urutan enum, ciri khas ALTER TYPE ADD VALUE
-- yang dijalankan manual lewat SQL Editor di luar migration.
--
-- Ini pola yang sama dengan insiden migration 031, cuma arahnya terbalik: dulu
-- file lebih lengkap daripada database, sekarang database lebih lengkap daripada
-- file. Akibatnya siapa pun yang membangun database dari nol lewat file
-- migration akan mendapat enum tanpa empat nilai itu, dan fitur laporan
-- operasional rusak di atasnya — src/constants/operationalReport.ts memakai
-- keempatnya sebagai kategori aktif. Belum menggigit hanya karena sampai
-- sekarang belum pernah ada environment kedua.
--
-- Jadi di database yang sekarang file ini adalah no-op; nilainya baru terasa di
-- database yang dibangun dari nol.
--
-- CATATAN TEKNIS:
--
-- 1. Sengaja TANPA pembungkus begin/commit. ALTER TYPE ... ADD VALUE punya
--    batasan terhadap blok transaksi, dan nilai yang baru ditambahkan tidak
--    boleh dipakai dalam transaksi yang sama. File ini hanya menambahkan dan
--    tidak memakai, tapi pembungkusnya tetap dihindari.
--
-- 2. Urutan penambahan (pest, disease, weather, disaster) sengaja mengikuti
--    urutan di database live. Tanpa klausa BEFORE/AFTER, ADD VALUE menempel di
--    belakang, sehingga database baru mendapat enumsortorder yang sama persis
--    dengan yang lama.
--
-- 3. area_pest_disease dan disaster_weather TIDAK dihapus. PostgreSQL tidak
--    mendukung penghapusan nilai enum, dan keduanya sudah nol pemakaian di
--    operational_reports. Keduanya tetap ada sebagai peninggalan mati — sisi
--    TypeScript sudah mengakuinya lewat LEGACY_OPERATIONAL_REPORT_CATEGORIES.

alter type public.operational_report_category add value if not exists 'pest';
alter type public.operational_report_category add value if not exists 'disease';
alter type public.operational_report_category add value if not exists 'weather';
alter type public.operational_report_category add value if not exists 'disaster';
