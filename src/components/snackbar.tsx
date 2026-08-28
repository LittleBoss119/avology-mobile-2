import React from 'react';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tokens } from '../constants/theme';
import { Icon } from './icons';

// Snackbar bersama: satu baris konfirmasi + ikon check, auto-dismiss, tanpa
// tombol aksi. State sengaja dipecah supaya memanggil showSnackbar TIDAK
// me-render ulang subtree navigator: context hanya menyimpan fungsi `show`
// yang stabil (identitasnya tak berubah), sedangkan pesan yang berganti hanya
// menggerakkan <SnackbarHost>. `children` diteruskan apa adanya sehingga React
// melewati render ulang cabang tersebut saat state internal provider berubah.

type ShowSnackbar = (text: string) => void;

type SnackbarState = {
  key: number;
  text: string;
};

const AUTO_DISMISS_MS = 3500;

const SnackbarContext = React.createContext<ShowSnackbar | null>(null);

export function useSnackbar(): ShowSnackbar {
  const show = React.useContext(SnackbarContext);

  if (!show) {
    throw new Error('useSnackbar harus dipakai di dalam SnackbarProvider.');
  }

  return show;
}

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [snack, setSnack] = React.useState<SnackbarState | null>(null);
  const keyRef = React.useRef(0);

  // Identitas stabil: consumer & cabang children tidak ikut render ulang saat
  // pesan berganti. Key naik tiap panggilan agar pesan identik pun retrigger.
  const show = React.useCallback<ShowSnackbar>((text) => {
    const trimmed = text.trim();

    if (!trimmed) {
      return;
    }

    keyRef.current += 1;
    setSnack({ key: keyRef.current, text: trimmed });
  }, []);

  // Guard anti-stale: hanya menutup jika key yang menutup masih yang aktif,
  // supaya animasi keluar dari pesan lama tak menghapus pesan baru.
  const handleRequestClose = React.useCallback((key: number) => {
    setSnack((current) => (current && current.key === key ? null : current));
  }, []);

  return (
    <SnackbarContext.Provider value={show}>
      <View style={{ flex: 1 }}>
        {children}
        <SnackbarHost snack={snack} onRequestClose={handleRequestClose} />
      </View>
    </SnackbarContext.Provider>
  );
}

function SnackbarHost({
  onRequestClose,
  snack,
}: {
  onRequestClose: (key: number) => void;
  snack: SnackbarState | null;
}) {
  const insets = useSafeAreaInsets();
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(12)).current;

  const activeKey = snack?.key;

  React.useEffect(() => {
    if (activeKey === undefined) {
      return;
    }

    opacity.setValue(0);
    translateY.setValue(12);

    Animated.parallel([
      Animated.timing(opacity, { duration: 180, toValue: 1, useNativeDriver: true }),
      Animated.timing(translateY, { duration: 180, toValue: 0, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { duration: 180, toValue: 0, useNativeDriver: true }),
        Animated.timing(translateY, { duration: 180, toValue: 12, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) {
          onRequestClose(activeKey);
        }
      });
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [activeKey, onRequestClose, opacity, translateY]);

  if (!snack) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        alignItems: 'center',
        bottom: insets.bottom + tokens.space.lg,
        left: 0,
        opacity,
        paddingHorizontal: tokens.space.lg,
        position: 'absolute',
        right: 0,
        transform: [{ translateY }],
      }}
    >
      {/* alignItems 'flex-start', BUKAN 'center': begitu teksnya boleh dua
          baris, 'center' akan menaruh ikon centang di tengah blok dua baris —
          sejajar dengan celah antar baris, bukan dengan baris pertama.
          'flex-start' menjaga centangnya sebaris dengan kata pertama, dan pada
          pesan satu baris hasilnya tidak berbeda dari sebelumnya.

          flexShrink 1 pada teks WAJIB menemani numberOfLines 2: tanpa itu blok
          teks menolak menyusut, pil melampaui maxWidth '100%', dan kalimat
          panjang terpotong di tepi layar alih-alih membungkus. */}
      <View
        style={{
          alignItems: 'flex-start',
          backgroundColor: tokens.color.text.primary,
          borderCurve: 'continuous',
          borderRadius: tokens.radius.pill,
          flexDirection: 'row',
          gap: tokens.space.sm,
          maxWidth: '100%',
          paddingHorizontal: tokens.space.lg,
          paddingVertical: tokens.space.md,
          ...tokens.elevation.overlay,
        }}
      >
        <Icon name="check" size={tokens.icon.sm} color={tokens.color.status.success.border} />
        <Text
          numberOfLines={2}
          style={{
            color: tokens.color.text.onBrand,
            flexShrink: 1,
            fontSize: tokens.type.bodyStrong.fontSize,
            fontWeight: tokens.type.bodyStrong.fontWeight,
            lineHeight: tokens.type.bodyStrong.lineHeight,
          }}
        >
          {snack.text}
        </Text>
      </View>
    </Animated.View>
  );
}
