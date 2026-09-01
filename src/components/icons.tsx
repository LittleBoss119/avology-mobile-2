import Svg, { Path } from 'react-native-svg';

import { tokens } from '../constants/theme';

// Ikon SVG lokal berbasis react-native-svg. viewBox 0 0 24 24, digambar bergaya
// stroke: fill none, ujung & sambungan membulat, strokeWidth = tokens.icon.stroke
// (2) kecuali pemanggil menyebut lain. ICON_PATHS di bawah adalah satu-satunya
// sumber kebenaran path; komponen <Icon> merender semuanya secara seragam dan
// ekspor lama (FlowerIcon dst.) hanyalah pembungkus tipis yang memanggil <Icon>.
//
// DUA ASAL PATH, dan bedanya penting supaya atribusinya tetap jujur:
//
//   1. Ikon antarmuka biasa — data path diambil VERBATIM dari Tabler Icons
//      (lisensi MIT), varian outline.
//   2. Glif sel peta, berawalan `cell-` — DIGAMBAR SENDIRI untuk berkas ini,
//      bukan dari Tabler. Alasannya di catatan blok kedua di bawah.
//
// Jangan menambahkan glif `cell-` ke kelompok pertama atau sebaliknya.

export type IconName =
  | 'home'
  | 'list-check'
  | 'tree'
  | 'file-text'
  | 'building-warehouse'
  | 'clipboard'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'dots'
  | 'x'
  | 'check'
  | 'clock'
  | 'pencil'
  | 'calendar'
  | 'repeat'
  | 'target'
  | 'user'
  | 'copy'
  | 'camera'
  | 'filter'
  | 'search'
  | 'adjustments-horizontal'
  | 'plus'
  | 'calendar-plus'
  | 'flower'
  | 'flower-off'
  | 'alert-triangle'
  | 'basket'
  | 'spray'
  | 'eye'
  | 'eye-off'
  | 'lock'
  | 'logout'
  | 'user-edit'
  | 'zoom-in'
  | 'zoom-out'
  | 'cell-insect'
  | 'cell-leaf-spot'
  | 'cell-broken-twig'
  | 'cell-flower'
  | 'cell-fruit'
  | 'cell-fruit-seed';

const ICON_PATHS: Record<IconName, string[]> = {
  home: [
    'M5 12l-2 0l9 -9l9 9l-2 0',
    'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7',
    'M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6',
  ],
  'list-check': [
    'M3.5 5.5l1.5 1.5l2.5 -2.5',
    'M3.5 11.5l1.5 1.5l2.5 -2.5',
    'M3.5 17.5l1.5 1.5l2.5 -2.5',
    'M11 6l9 0',
    'M11 12l9 0',
    'M11 18l9 0',
  ],
  tree: [
    'M12 13l-2 -2',
    'M12 12l2 -2',
    'M12 21v-13',
    'M9.824 16a3 3 0 0 1 -2.743 -3.69a3 3 0 0 1 .304 -4.833a3 3 0 0 1 4.615 -3.707a3 3 0 0 1 4.614 3.707a3 3 0 0 1 .305 4.833a3 3 0 0 1 -2.919 3.695h-4l-.176 -.005',
  ],
  'file-text': [
    'M14 3v4a1 1 0 0 0 1 1h4',
    'M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2',
    'M9 9l1 0',
    'M9 13l6 0',
    'M9 17l6 0',
  ],
  'building-warehouse': [
    'M3 21v-13l9 -4l9 4v13',
    'M13 13h4v8h-10v-6h6',
    'M13 21v-9a1 1 0 0 0 -1 -1h-2a1 1 0 0 0 -1 1v3',
  ],
  // Tabler "clipboard-text" (outline), verbatim seperti entri lain di file ini.
  clipboard: [
    'M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2',
    'M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z',
    'M9 12h6',
    'M9 16h6',
  ],
  'chevron-left': ['M15 6l-6 6l6 6'],
  'chevron-right': ['M9 6l6 6l-6 6'],
  'chevron-down': ['M6 9l6 6l6 -6'],
  dots: [
    'M4 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
    'M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
    'M18 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
  ],
  x: ['M18 6l-12 12', 'M6 6l12 12'],
  check: ['M5 12l5 5l10 -10'],
  clock: [
    'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
    'M12 7v5l3 3',
  ],
  pencil: [
    'M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4',
    'M13.5 6.5l4 4',
  ],
  calendar: [
    'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12',
    'M16 3v4',
    'M8 3v4',
    'M4 11h16',
    'M11 15h1',
    'M12 15v3',
  ],
  // Tabler "repeat" (outline), verbatim seperti entri lain di file ini.
  repeat: [
    'M4 12v-3a3 3 0 0 1 3 -3h13m-3 -3l3 3l-3 3',
    'M20 12v3a3 3 0 0 1 -3 3h-13m3 3l-3 -3l3 -3',
  ],
  target: [
    'M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
    'M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0',
    'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
  ],
  user: [
    'M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0',
    'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2',
  ],
  copy: [
    'M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z',
    'M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1',
  ],
  camera: [
    'M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2',
    'M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0',
  ],
  filter: [
    'M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345v-2.227',
  ],
  search: [
    'M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0',
    'M21 21l-6 -6',
  ],
  'adjustments-horizontal': [
    'M12 6a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M4 6l8 0',
    'M16 6l4 0',
    'M6 12a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M4 12l2 0',
    'M10 12l10 0',
    'M15 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M4 18l11 0',
    'M19 18l1 0',
  ],
  plus: [
    'M12 5l0 14',
    'M5 12l14 0',
  ],
  'calendar-plus': [
    'M12.5 21h-6.5a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v4',
    'M16 3v4',
    'M8 3v4',
    'M4 11h16',
    'M16 19h6',
    'M19 16v6',
  ],
  flower: [
    'M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
    'M12 2a3 3 0 0 1 3 3c0 .562 -.259 1.442 -.776 2.64l-.724 1.36l1.76 -1.893c.499 -.6 .922 -1 1.27 -1.205a2.968 2.968 0 0 1 4.07 1.099a3.011 3.011 0 0 1 -1.09 4.098c-.374 .217 -.99 .396 -1.846 .535l-2.664 .366l2.4 .326c1 .145 1.698 .337 2.11 .576a3.011 3.011 0 0 1 1.09 4.098a2.968 2.968 0 0 1 -4.07 1.098c-.348 -.202 -.771 -.604 -1.27 -1.205l-1.76 -1.893l.724 1.36c.516 1.199 .776 2.079 .776 2.64a3 3 0 0 1 -6 0c0 -.562 .259 -1.442 .776 -2.64l.724 -1.36l-1.76 1.893c-.499 .601 -.922 1 -1.27 1.205a2.968 2.968 0 0 1 -4.07 -1.098a3.011 3.011 0 0 1 1.09 -4.098c.374 -.218 .99 -.396 1.846 -.536l2.664 -.366l-2.4 -.325c-1 -.145 -1.698 -.337 -2.11 -.576a3.011 3.011 0 0 1 -1.09 -4.099a2.968 2.968 0 0 1 4.07 -1.099c.348 .203 .771 .604 1.27 1.205l1.76 1.894c-1 -2.292 -1.5 -3.625 -1.5 -4a3 3 0 0 1 3 -3',
  ],
  'flower-off': [
    'M9.875 9.882a3 3 0 0 0 4.247 4.238m.581 -3.423a3.012 3.012 0 0 0 -1.418 -1.409',
    'M9 5a3 3 0 0 1 6 0c0 .562 -.259 1.442 -.776 2.64l-.724 1.36l1.76 -1.893c.499 -.6 .922 -1 1.27 -1.205a2.968 2.968 0 0 1 4.07 1.099a3.011 3.011 0 0 1 -1.09 4.098c-.374 .217 -.99 .396 -1.846 .535l-1.779 .244m.292 .282l1.223 .166c1 .145 1.698 .337 2.11 .576a3.011 3.011 0 0 1 1.226 3.832m-2.277 1.733a2.968 2.968 0 0 1 -1.929 -.369c-.348 -.202 -.771 -.604 -1.27 -1.205l-1.76 -1.893l.724 1.36c.516 1.199 .776 2.079 .776 2.64a3 3 0 0 1 -6 0c0 -.562 .259 -1.442 .776 -2.64l.724 -1.36l-1.76 1.893c-.499 .601 -.922 1 -1.27 1.205a2.968 2.968 0 0 1 -4.07 -1.098a3.011 3.011 0 0 1 1.09 -4.098c.374 -.218 .99 -.396 1.846 -.536l2.664 -.366l-2.4 -.325c-1 -.145 -1.698 -.337 -2.11 -.576a3.011 3.011 0 0 1 -1.09 -4.099a2.968 2.968 0 0 1 2.134 -1.467',
    'M3 3l18 18',
  ],
  'alert-triangle': [
    'M12 9v4',
    'M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0',
    'M12 16h.01',
  ],
  basket: [
    'M10 14a2 2 0 1 0 4 0a2 2 0 0 0 -4 0',
    'M5.001 8h13.999a2 2 0 0 1 1.977 2.304l-1.255 7.152a3 3 0 0 1 -2.966 2.544h-9.512a3 3 0 0 1 -2.965 -2.544l-1.255 -7.152a2 2 0 0 1 1.977 -2.304',
    'M17 10l-2 -6',
    'M7 10l2 -6',
  ],
  spray: [
    'M4 12a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-4a2 2 0 0 1 -2 -2l0 -7',
    'M6 10v-4a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v4',
    'M15 7h.01',
    'M18 9h.01',
    'M18 5h.01',
    'M21 3h.01',
    'M21 7h.01',
    'M21 11h.01',
    'M10 7h1',
  ],
  eye: [
    'M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0',
    'M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6',
  ],
  'eye-off': [
    'M10.585 10.587a2 2 0 0 0 2.829 2.828',
    'M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87',
    'M3 3l18 18',
  ],
  lock: [
    'M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z',
    'M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0',
    'M8 11v-4a4 4 0 1 1 8 0v4',
  ],
  logout: [
    'M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2',
    'M9 12h12l-3 -3',
    'M18 15l3 -3',
  ],
  'user-edit': [
    'M6 21v-2a4 4 0 0 1 4 -4h3.5',
    'M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0',
    'M18.42 15.61a2.1 2.1 0 0 1 2.97 2.97l-3.39 3.42h-3v-3l3.42 -3.39z',
  ],
  'zoom-in': [
    'M4 11a7 7 0 1 0 14 0a7 7 0 1 0 -14 0',
    'M21 21l-6 -6',
    'M8 11h6',
    'M11 8v6',
  ],
  'zoom-out': [
    'M4 11a7 7 0 1 0 14 0a7 7 0 1 0 -14 0',
    'M21 21l-6 -6',
    'M8 11h6',
  ],

  // -------------------------------------------------------------------------
  // GLIF SEL PETA — digambar sendiri, BUKAN dari Tabler.
  //
  // KENAPA TIDAK MEMAKAI TABLER SAJA. Ikon Tabler digambar untuk dibaca pada
  // 20-24px. Glif di bawah dibaca pada 13px, di dalam kotak 48px, di layar
  // ponsel yang dipegang di kebun. Pada ukuran itu detail bukan hiasan yang
  // hilang diam-diam — ia berubah jadi gumpalan yang menutup bentuk induknya.
  // `flower` Tabler misalnya adalah satu path berisi enam kelopak berlekuk;
  // pada 13px ia rata jadi lingkaran abu-abu dan berhenti bisa dibedakan dari
  // `cell-fruit`.
  //
  // ATURAN YANG DIPAKAI MENGGAMBARNYA, supaya glif berikutnya konsisten:
  //
  //   * Maksimal LIMA subpath. Lebih dari itu, jarak antar goresan turun di
  //     bawah tebal goresannya sendiri pada 13px dan keduanya menyatu.
  //   * Tidak ada detail yang bergantung pada celah lebih sempit dari 2 satuan
  //     viewBox (≈1px pada 13px).
  //   * SILUET dulu, isi belakangan: bentuk terluar harus sudah membedakan glif
  //     ini dari kelima glif lain sebelum satu pun detail dalam digambar.
  //
  // APA YANG DISEDERHANAKAN dari gambaran wajarnya, disebut apa adanya:
  //
  //   cell-insect       — tanpa kaki. Enam kaki pada 13px jadi rumbai yang
  //                       menempel ke badan. Yang tersisa: badan bulat, garis
  //                       belah, dua antena. Siluet kumbang.
  //   cell-leaf-spot    — tanpa tulang daun. Ia bersaing dengan bercaknya di
  //                       ruang yang sama; bercak yang menang, karena itu yang
  //                       membedakan glif ini dari daun biasa. Bercaknya dua,
  //                       bukan tiga.
  //   cell-broken-twig  — tanpa ranting samping. Tinggal dua potongan dengan
  //                       ujung menyerpih ke arah berlawanan dan celah di
  //                       antaranya; celah itulah yang menyatakan "patah".
  //   cell-flower       — empat kelopak, bukan lima atau enam, dan kelopaknya
  //                       lingkaran polos, bukan bentuk berlekuk.
  //   cell-fruit-seed   — tanpa daun di tangkai, tidak seperti cell-fruit.
  //                       Bijinya yang harus terbaca, dan daun di sudut atas
  //                       menarik mata ke tempat yang salah.
  //
  // cell-fruit dan cell-fruit-seed sengaja berbagi siluet yang sama — keduanya
  // memang buah — dan dibedakan HANYA oleh biji di tengah. Itu cukup karena
  // keduanya tidak pernah muncul di sel yang sama, dan pembacanya membandingkan
  // dengan legenda, bukan dengan sel tetangga.
  // -------------------------------------------------------------------------

  'cell-insect': [
    'M6 13a6 6 0 1 0 12 0a6 6 0 1 0 -12 0',
    'M12 7v12',
    'M9.5 8l-2.5 -4',
    'M14.5 8l2.5 -4',
  ],
  'cell-leaf-spot': [
    'M4 20c0 -8 5 -14 16 -16c0 10 -6 16 -16 16',
    'M8.1 14a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0 -3.8 0',
    'M12.6 9.5a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0 -3.8 0',
  ],
  'cell-broken-twig': [
    'M5 3l5 7l-3 1',
    'M19 21l-5 -7l3 -1',
  ],
  'cell-flower': [
    'M9.7 12a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0',
    'M9.1 6.4a2.9 2.9 0 1 0 5.8 0a2.9 2.9 0 1 0 -5.8 0',
    'M14.7 12a2.9 2.9 0 1 0 5.8 0a2.9 2.9 0 1 0 -5.8 0',
    'M9.1 17.6a2.9 2.9 0 1 0 5.8 0a2.9 2.9 0 1 0 -5.8 0',
    'M3.5 12a2.9 2.9 0 1 0 5.8 0a2.9 2.9 0 1 0 -5.8 0',
  ],
  'cell-fruit': [
    'M5.5 14.5a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0 -13 0',
    'M12 8v-4',
    'M12 5.5l3.5 -1.5',
  ],
  'cell-fruit-seed': [
    'M5.5 14.5a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0 -13 0',
    'M12 8v-4',
    'M9.4 14.5a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0',
  ],
};

export function Icon({
  name,
  size = tokens.icon.md,
  color = tokens.color.text.secondary,
  strokeWidth = tokens.icon.stroke,
}: {
  name: IconName;
  size?: number;
  color?: string;
  // Tebal goresan dalam satuan viewBox, bukan piksel — ia ikut mengecil bersama
  // `size`. Default tokens.icon.stroke (2), jadi setiap pemanggil yang sudah ada
  // tidak bergeser sedikit pun.
  //
  // ADA UNTUK SATU KEADAAN: glif sel peta pada 13px. Di sana goresan 2 satuan
  // menjadi 2 x 13/24 ≈ 1,1 piksel, dan garis setipis itu hilang di layar yang
  // kena silau matahari — tepat kondisi tempat aplikasi ini dipakai. Menaikkan
  // default untuk semua ikon bukan jawabannya: pada 20-24px goresan tebal
  // membuat ikon terlihat gempal dan menutup celah dalamnya.
  strokeWidth?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {ICON_PATHS[name].map((d, index) => (
        <Path
          key={index}
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

type IconProps = {
  color: string;
  size?: number;
};

// Ekspor lama: pembungkus tipis di atas <Icon>. Path tetap sama persis (dari
// ICON_PATHS), agar pemakai lama tidak berubah tampilan dan tidak ada dua sumber
// kebenaran. Penggantian pemanggilan ke <Icon> langsung dilakukan di P-2b.

export function FlowerIcon({ color, size = 20 }: IconProps) {
  return <Icon name="flower" color={color} size={size} />;
}

export function FlowerOffIcon({ color, size = 20 }: IconProps) {
  return <Icon name="flower-off" color={color} size={size} />;
}

export function AlertTriangleIcon({ color, size = 20 }: IconProps) {
  return <Icon name="alert-triangle" color={color} size={size} />;
}

export function BasketIcon({ color, size = 20 }: IconProps) {
  return <Icon name="basket" color={color} size={size} />;
}

export function SprayIcon({ color, size = 20 }: IconProps) {
  return <Icon name="spray" color={color} size={size} />;
}

export function ChevronRightIcon({ color, size = 20 }: IconProps) {
  return <Icon name="chevron-right" color={color} size={size} />;
}
