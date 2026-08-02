import Svg, { Path } from 'react-native-svg';

import { tokens } from '../constants/theme';

// Ikon SVG lokal berbasis react-native-svg. Semua data path diambil VERBATIM dari
// Tabler Icons (lisensi MIT), varian outline, viewBox 0 0 24 24, digambar bergaya
// stroke seperti aslinya: fill none, ujung & sambungan membulat, strokeWidth =
// tokens.icon.stroke (2). ICON_PATHS di bawah adalah satu-satunya sumber kebenaran
// path; komponen <Icon> merender semuanya secara seragam dan ekspor lama
// (FlowerIcon dst.) hanyalah pembungkus tipis yang memanggil <Icon>.

export type IconName =
  | 'home'
  | 'list-check'
  | 'tree'
  | 'file-text'
  | 'building-warehouse'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'dots'
  | 'x'
  | 'check'
  | 'clock'
  | 'pencil'
  | 'calendar'
  | 'target'
  | 'user'
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
  | 'spray';

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
  target: [
    'M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
    'M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0',
    'M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
  ],
  user: [
    'M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0',
    'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2',
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
};

export function Icon({
  name,
  size = tokens.icon.md,
  color = tokens.color.text.secondary,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {ICON_PATHS[name].map((d, index) => (
        <Path
          key={index}
          d={d}
          stroke={color}
          strokeWidth={tokens.icon.stroke}
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
