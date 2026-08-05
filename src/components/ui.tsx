import React from 'react';
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type KeyboardEvent,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  colors as designColors,
  radius,
  spacing,
  statusColors,
  theme,
  tokens,
  typography,
  type StatusTone,
} from '../constants/theme';
import { sanitizeDisplayValue, sanitizeUserFacingMessage } from '../utils/displayFormat';
import { Icon, type IconName } from './icons';
import { PhotoSourceSheet } from './bottom-sheet';

const colors = {
  ...designColors,
  background: designColors.bg,
  backgroundDeep: designColors.surfaceMuted,
  muted: designColors.textMuted,
  primaryPressed: designColors.primaryDark,
  successSurface: designColors.successBg,
  dangerSurface: designColors.dangerBg,
  warningSurface: designColors.warningBg,
};

export const appTheme = {
  ...theme.colors,
  background: designColors.bg,
  backgroundDeep: designColors.surfaceMuted,
  muted: designColors.textMuted,
  primaryPressed: designColors.primaryDark,
  successSurface: designColors.successBg,
  dangerSurface: designColors.dangerBg,
  warningSurface: designColors.warningBg,
};

export function Screen({
  applyTopInset = false,
  children,
  floatingAction,
  floatingActionBottom = 24,
  footer,
  header,
  contentStyle,
  scrollRef,
  variant = 'default',
  stickyFooter,
}: {
  // Safe-area atas normalnya diterapkan TopAppBar, bukan Screen (lihat komentar
  // pada slot `header` di bawah). Layar yang TIDAK punya TopAppBar sama sekali —
  // baik lewat slot `header` maupun sebagai children — jadi tidak punya siapa pun
  // yang menerapkannya, dan konten paling atasnya menabrak status bar. Prop ini
  // untuk kasus itu.
  //
  // SENGAJA opt-in, default false. Kalau otomatis menyala saat `header` kosong,
  // layar yang menaruh TopAppBar sebagai children akan kena inset DUA KALI —
  // sekali dari sini, sekali dari TopAppBar-nya sendiri.
  applyTopInset?: boolean;
  children: React.ReactNode;
  floatingAction?: React.ReactNode;
  floatingActionBottom?: number;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollRef?: React.RefObject<ScrollView | null>;
  variant?: 'default' | 'soft' | 'surface';
  stickyFooter?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const hasStickyFooter = Boolean(stickyFooter);
  const keyboard = useKeyboardMetrics(hasStickyFooter);
  const backgroundColor =
    variant === 'surface' ? colors.surface : variant === 'soft' ? colors.backgroundDeep : colors.background;

  // Window tidak menyusut saat keyboard naik (adjustResize tidak berlaku di Android
  // edge-to-edge), jadi stickyFooter yang position:absolute harus diangkat manual.
  //
  // Dipakai `screenY`, BUKAN `height`. Di ReactRootView.java (checkForKeyboardEvents,
  // API >= 30) `height = imeInsets.bottom - barInsets.bottom` — RN sudah mengurangi
  // system bar, jadi angkanya lebih kecil dari keyboard yang digambar. `screenY`
  // (= mVisibleViewArea.bottom, koordinat display) tidak kena pengurangan itu, maka
  // pasangannya tinggi 'screen', bukan 'window' yang juga memotong system bar.
  //
  // ASUMSI: sisi bawah root view berimpit dengan sisi bawah display. Berlaku di
  // edge-to-edge. UJI ULANG saat pertama kali pindah dari Expo Go ke dev build atau
  // APK rilis: kalau ternyata berjalan tanpa edge-to-edge, root berhenti di atas nav
  // bar dan rumus lama (ime - navBar, yaitu `height`) yang benar.
  const screenHeight = Dimensions.get('screen').height;
  const keyboardVisible = keyboard.height > 0;
  // screenY 0/absen berarti data tidak bisa dipakai — jangan menebak, kembali ke
  // perilaku lama apa adanya.
  const screenYBasisActive = keyboardVisible && keyboard.screenY > 0;
  const keyboardLift = !hasStickyFooter
    ? 0
    : screenYBasisActive
      ? Math.max(0, screenHeight - keyboard.screenY)
      : keyboardVisible
        ? Math.max(0, keyboard.height - insets.bottom)
        : 0;
  // Overlap sudah dihitung sampai dasar display, jadi insets.bottom TIDAK dikurangi
  // lagi di sini — nav bar tertutup keyboard, ruang untuknya tidak relevan. Saat
  // keyboard tertutup (atau saat fallback aktif) padding kembali ke rumus lama persis.
  const footerPaddingBottom = screenYBasisActive ? spacing.md : Math.max(insets.bottom, spacing.md);
  const overlayBottomPadding =
    (stickyFooter ? 128 + insets.bottom : floatingAction ? 132 : tokens.space.xxxl) + keyboardLift;

  return (
    <View style={{ flex: 1, backgroundColor }}>
      {header ? (
        // Header fixed (tidak menggulung): sibling di atas ScrollView, di dalam
        // View flex:1 terluar. Duduk di background variant yang sama (0.3) supaya
        // tak belang; pemisah hairline bawah tanpa shadow, tanpa onScroll. Inset
        // atas TIDAK diterapkan di sini — TopAppBar di dalam `header` yang
        // menerapkannya (ui.tsx TopAppBar), agar tidak dobel (0.1/safe-area).
        <View
          style={{
            backgroundColor,
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
            paddingHorizontal: spacing.screenHorizontal,
          }}
        >
          {header}
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor }}
        contentContainerStyle={[
          {
            flexGrow: 1,
            paddingHorizontal: spacing.screenHorizontal,
            // insets.top mentah, bukan Math.max(...): saat inset 0 hasilnya kembali
            // persis ke nilai lama, jadi prop ini tidak pernah menggeser apa pun
            // di perangkat tanpa status bar yang mengintip.
            paddingTop: spacing.xl + (applyTopInset ? insets.top : 0),
            gap: spacing.sectionGap,
            paddingBottom: overlayBottomPadding,
          },
          contentStyle,
        ]}
      >
        {/* flexGrow, BUKAN flex. `flex: 1` di RN berarti flexBasis: 0, sehingga
            pembungkus ini menyumbang NOL ke tinggi natural content container dan
            tingginya selalu jadi sisa ruang — konten tidak pernah bisa melampaui
            viewport, jadi ScrollView tidak punya apa pun untuk digulung. Yoga juga
            tidak punya `min-height: auto` seperti browser, jadi tidak ada jaring
            pengaman yang memaksa overflow. Dengan flexGrow: 1 (flexBasis auto
            bawaan) pembungkus tetap memenuhi layar saat konten pendek — itu yang
            menjaga justifyContent 'center' tetap bekerja — tapi boleh tumbuh
            melewati viewport saat konten panjang, dan barulah bisa di-scroll. */}
        <View style={{ flexGrow: 1, gap: spacing.sectionGap }}>{children}</View>
        {footer ? <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>{footer}</View> : null}
      </ScrollView>
      {stickyFooter ? (
        <View
          style={{
            backgroundColor,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            bottom: keyboardLift,
            left: 0,
            paddingBottom: footerPaddingBottom,
            paddingHorizontal: spacing.screenHorizontal,
            paddingTop: spacing.md,
            position: 'absolute',
            right: 0,
          }}
        >
          {stickyFooter}
        </View>
      ) : null}
      {floatingAction ? (
        <View style={{ bottom: floatingActionBottom, position: 'absolute', right: spacing.screenHorizontal }}>
          {floatingAction}
        </View>
      ) : null}
    </View>
  );
}

type KeyboardMetrics = {
  height: number;
  screenY: number;
};

const CLOSED_KEYBOARD: KeyboardMetrics = { height: 0, screenY: 0 };

// Tinggi keyboard dari React Native core (tanpa dependensi tambahan, aman di
// Expo Go). Android hanya mengirim pasangan did-show/did-hide — will-* tidak
// pernah dikirim di sana. iOS memakai will-show/will-hide supaya pergeseran
// footer berjalan bersamaan dengan animasi keyboard, bukan setelahnya.
// Listener hanya dipasang untuk layar yang benar-benar punya stickyFooter, jadi
// layar lain tidak ikut me-render ulang saat keyboard buka/tutup.
function useKeyboardMetrics(enabled: boolean): KeyboardMetrics {
  const [metrics, setMetrics] = React.useState<KeyboardMetrics>(CLOSED_KEYBOARD);

  React.useEffect(() => {
    if (!enabled) {
      setMetrics(CLOSED_KEYBOARD);
      return;
    }

    function handleShow(event: KeyboardEvent) {
      setMetrics({
        height: event.endCoordinates?.height ?? 0,
        screenY: event.endCoordinates?.screenY ?? 0,
      });
    }

    function handleHide() {
      setMetrics(CLOSED_KEYBOARD);
    }

    const subscriptions =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillShow', handleShow),
            Keyboard.addListener('keyboardWillHide', handleHide),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', handleShow),
            Keyboard.addListener('keyboardDidHide', handleHide),
          ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [enabled]);

  return metrics;
}

export function PageIntro({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={{ gap: spacing.sm, paddingTop: spacing.xs }}>
      <Text
        selectable
        style={{
          color: colors.text,
          fontSize: typography.h1.fontSize,
          fontWeight: typography.h1.fontWeight,
          letterSpacing: 0,
          lineHeight: typography.h1.lineHeight,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text selectable style={{ color: colors.muted, fontSize: typography.body.fontSize, lineHeight: 24 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function TopAppBar({
  badge,
  right,
  subtitle,
  title,
  onBack,
  variant,
}: {
  badge?: React.ReactNode;
  right?: React.ReactNode;
  subtitle?: string;
  // Opsional supaya layar bisa memakai bar ini murni sebagai baris tombol back,
  // dengan judul ditangani PageIntro di badan layar (pola layar auth). Tinggi bar
  // TIDAK bergantung pada judul — baris di bawah sudah punya minHeight 56 eksplisit
  // yang selalu lebih besar dari lineHeight judul (26) maupun tombol back (32) —
  // jadi menghilangkan judul tidak membuat bar menyusut.
  title?: string;
  onBack?: () => void;
  variant?: 'main' | 'detail' | 'plain';
}) {
  const insets = useSafeAreaInsets();
  const resolvedVariant = variant ?? (onBack ? 'detail' : 'plain');
  const titleAlign = resolvedVariant === 'main' ? 'left' : 'center';

  return (
    <View style={{ gap: subtitle ? spacing.sm : 0, paddingTop: Math.max(insets.top, spacing.sm) }}>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          justifyContent: titleAlign === 'left' ? 'flex-start' : 'space-between',
          minHeight: 56,
        }}
      >
        {onBack ? (
          <Pressable
            hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
            onPress={onBack}
            style={{
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderCurve: 'continuous',
              borderRadius: 11,
              borderWidth: 1,
              height: 32,
              justifyContent: 'center',
              width: 32,
            }}
          >
            <Icon name="chevron-left" size={20} color={colors.primary} />
          </Pressable>
        ) : titleAlign === 'center' ? (
          <View style={{ height: 32, width: 32 }} />
        ) : null}
        <View
          style={{
            alignItems: titleAlign === 'left' ? 'flex-start' : 'center',
            flex: 1,
            minWidth: 0,
          }}
        >
          {badge ? (
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm, maxWidth: '100%' }}>
              {title === undefined ? null : (
                <Text
                  selectable
                  numberOfLines={1}
                  style={{
                    color: colors.text,
                    flexShrink: 1,
                    fontSize: resolvedVariant === 'main' ? typography.screenTitle.fontSize : 20,
                    fontWeight: resolvedVariant === 'main' ? typography.screenTitle.fontWeight : '700',
                    lineHeight: typography.screenTitle.lineHeight,
                    textAlign: titleAlign,
                  }}
                >
                  {title}
                </Text>
              )}
              <View style={{ flexShrink: 0 }}>{badge}</View>
            </View>
          ) : title === undefined ? null : (
            <Text
              selectable
              numberOfLines={1}
              style={{
                color: colors.text,
                fontSize: resolvedVariant === 'main' ? typography.screenTitle.fontSize : 20,
                fontWeight: resolvedVariant === 'main' ? typography.screenTitle.fontWeight : '700',
                lineHeight: typography.screenTitle.lineHeight,
                textAlign: titleAlign,
              }}
            >
              {title}
            </Text>
          )}
        </View>
        {right ?? (titleAlign === 'center' ? <View style={{ height: 32, width: 32 }} /> : null)}
      </View>
      {subtitle ? (
        <Text
          selectable
          style={{
            color: colors.muted,
            fontSize: 15,
            lineHeight: 22,
            textAlign: titleAlign,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function ProfileIconButton({
  label = 'Profil Akun',
  onPress,
}: {
  label?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: pressed ? colors.primarySoft : colors.surface,
        borderColor: colors.border,
        borderCurve: 'continuous',
        borderRadius: 11,
        borderWidth: 1,
        height: 32,
        justifyContent: 'center',
        width: 32,
      })}
    >
      <Icon name="user" size={20} color={colors.primary} />
    </Pressable>
  );
}

export function MainTabHeader({
  onProfilePress,
  roleLabel,
  roleTone = 'neutral',
  title,
}: {
  onProfilePress: () => void;
  roleLabel?: string;
  roleTone?: BadgeTone;
  title: string;
}) {
  return (
    <TopAppBar
      badge={roleLabel ? <Badge label={roleLabel} tone={roleTone} /> : undefined}
      right={<ProfileIconButton onPress={onProfilePress} />}
      title={title}
      variant="main"
    />
  );
}

// showWordmark=false menyisakan kotak logo saja. Dipakai layar yang judulnya
// sudah ditangani <PageIntro> di badan layar, supaya "Avology" tidak tercetak
// dua kali dengan dua tagline berbeda. Default true — bentuk lama utuh.
// `align` sengaja TIDAK punya nilai default sendiri: kalau tidak diisi, perataan
// jatuh kembali ke aturan lama (compact = kiri, selain itu tengah), jadi arti
// `compact` yang sudah ada tidak bergeser. Mengisi `align` memisahkan perataan
// dari ukuran, sehingga bisa dapat kotak ukuran penuh yang rata kiri.
export function BrandMark({
  align,
  compact = false,
  showWordmark = true,
}: {
  align?: 'left' | 'center';
  compact?: boolean;
  showWordmark?: boolean;
}) {
  const alignItems = (align ?? (compact ? 'left' : 'center')) === 'left' ? 'flex-start' : 'center';

  return (
    <View style={{ alignItems, gap: spacing.md }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.primary,
          borderColor: colors.primaryBorder,
          borderCurve: 'continuous',
          borderRadius: compact ? radius.lg : radius['2xl'],
          borderWidth: 1,
          height: compact ? 52 : 72,
          justifyContent: 'center',
          width: compact ? 52 : 72,
        }}
      >
        <Image
          // icon.png sudah membawa latar hijaunya sendiri, jadi backgroundColor
          // kotak di atas tinggal berfungsi sebagai fallback kalau aset gagal
          // dimuat — dalam keadaan normal ia tertutup penuh oleh gambar.
          source={require('../../assets/icon.png')}
          style={{
            borderRadius: compact ? radius.lg : radius['2xl'],
            height: '100%',
            width: '100%',
          }}
        />
      </View>
      {showWordmark ? (
        <View style={{ alignItems, gap: spacing.xs }}>
          <Text selectable style={{ color: colors.text, fontSize: compact ? 20 : 24, fontWeight: '700' }}>
            Avology
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: '700' }}>
            Operasional kebun alpukat
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function SectionHeader({
  actionLabel,
  children,
  description,
  onActionPress,
  subtitle,
  title,
}: {
  actionLabel?: string;
  children?: React.ReactNode;
  description?: string;
  onActionPress?: () => void;
  subtitle?: string;
  title: string;
}) {
  const helperText = description ?? subtitle;

  return (
    <View style={{ gap: spacing.xs, paddingTop: spacing.xs }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' }}>
        <Text
          selectable
          style={{
            color: colors.text,
            flex: 1,
            fontSize: typography.h3.fontSize,
            fontWeight: '700',
            lineHeight: typography.h3.lineHeight,
          }}
        >
          {title}
        </Text>
        {actionLabel && onActionPress ? (
          <Pressable onPress={onActionPress} style={{ paddingHorizontal: spacing.xs, paddingVertical: spacing.xs }}>
            <Text selectable style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {helperText ? (
        <Text selectable style={{ color: colors.muted, lineHeight: typography.small.lineHeight }}>
          {helperText}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function Card({
  children,
  padding = spacing.cardPadding,
  style,
  variant = 'default',
}: {
  children: React.ReactNode;
  padding?: number;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'highlight' | 'softGreen' | 'heroGreen' | 'warning' | 'danger' | 'info';
}) {
  const cardStyle = getCardVariantStyle(variant);

  return (
    <View
      style={[
        {
          ...cardStyle,
          borderCurve: 'continuous',
          borderRadius: tokens.radius.card,
          borderWidth: 1,
          gap: spacing.md,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export type BadgeTone = 'danger' | 'info' | 'muted' | 'neutral' | 'pending' | 'success' | 'warning';

export const badgeColors: Record<BadgeTone, { background: string; border: string; text: string }> = {
  danger: {
    background: statusColors.danger.background,
    border: statusColors.danger.border,
    text: statusColors.danger.text,
  },
  info: {
    background: statusColors.info.background,
    border: statusColors.info.border,
    text: statusColors.info.text,
  },
  muted: {
    background: statusColors.neutral.background,
    border: statusColors.neutral.border,
    text: statusColors.neutral.text,
  },
  neutral: {
    background: statusColors.neutral.background,
    border: statusColors.neutral.border,
    text: statusColors.neutral.text,
  },
  pending: {
    background: statusColors.pending.background,
    border: statusColors.pending.border,
    text: statusColors.pending.text,
  },
  success: {
    background: statusColors.success.background,
    border: statusColors.success.border,
    text: statusColors.success.text,
  },
  warning: {
    background: statusColors.warning.background,
    border: statusColors.warning.border,
    text: statusColors.warning.text,
  },
};

export function Badge({
  label,
  maxWidth = 128,
  status,
  tone = 'muted',
}: {
  label?: string;
  maxWidth?: number;
  status?: string;
  tone?: BadgeTone;
}) {
  const displayLabel = label ?? status;

  if (!displayLabel) {
    return null;
  }

  const badge = badgeColors[status ? getStatusTone(status) : tone];

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: badge.background,
        borderColor: badge.border,
        borderRadius: radius.round,
        borderWidth: 1,
        maxWidth,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
    >
      <Text
        selectable={false}
        numberOfLines={1}
        style={{
          color: badge.text,
          fontSize: typography.caption.fontSize,
          fontWeight: '700',
          lineHeight: typography.caption.lineHeight,
        }}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

export function MetricCard({
  label,
  tone = 'muted',
  value,
}: {
  label: string;
  tone?: 'danger' | 'info' | 'muted' | 'primary' | 'success' | 'warning';
  value: number | string;
}) {
  const textColor =
    tone === 'danger'
      ? colors.danger
      : tone === 'info'
        ? colors.info
      : tone === 'warning'
        ? colors.warning
        : tone === 'success' || tone === 'primary'
          ? colors.primary
          : colors.muted;

  return (
    <View style={{ flexBasis: '30%', flexGrow: 1, minWidth: 96 }}>
      <Card>
        <View style={{ gap: spacing.xs, minHeight: 62, justifyContent: 'space-between' }}>
          <Text
            selectable
            numberOfLines={2}
            style={{ color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 17 }}
          >
            {label}
          </Text>
          <Text selectable style={{ color: textColor, fontSize: 25, fontVariant: ['tabular-nums'], fontWeight: '700' }}>
            {value}
          </Text>
        </View>
      </Card>
    </View>
  );
}

export function ChipButton({
  active,
  count,
  label,
  onPress,
}: {
  active: boolean;
  count?: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: active ? colors.primary : colors.surface,
        borderColor: active ? colors.primary : colors.border,
        borderRadius: radius.round,
        borderWidth: 1,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 1,
      }}
    >
      <Text selectable style={{ color: active ? '#FFFFFF' : colors.text, fontSize: 14, fontWeight: '700' }}>
        {count === undefined ? label : `${label} · ${count}`}
      </Text>
    </Pressable>
  );
}

export type FilterChipOption = {
  active?: boolean;
  disabled?: boolean;
  key: string;
  label: string;
  onPress: () => void;
  valueLabel?: string;
};

export function FilterChip({
  active = false,
  disabled = false,
  label,
  onPress,
  valueLabel,
}: Omit<FilterChipOption, 'key'>) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: active ? colors.primarySoft : colors.surface,
        borderColor: active ? colors.primary : colors.border,
        borderCurve: 'continuous',
        borderRadius: radius.chip,
        borderWidth: 1,
        flexDirection: 'row',
        gap: spacing.xs,
        minHeight: 38,
        opacity: disabled ? 0.5 : pressed ? 0.82 : 1,
        paddingHorizontal: spacing.md,
      })}
    >
      <Text
        selectable={false}
        numberOfLines={1}
        style={{
          color: active ? colors.primary : colors.text,
          fontSize: 13,
          fontWeight: '700',
          lineHeight: 18,
        }}
      >
        {valueLabel ? `${label}: ${valueLabel}` : label}
      </Text>
      <Icon name="chevron-down" size={14} color={active ? colors.primary : colors.textSoft} />
    </Pressable>
  );
}

export function FilterChipsRow({
  chips,
  children,
  clearLabel = 'Reset',
  hasActiveFilters,
  onClear,
  style,
}: {
  chips?: FilterChipOption[];
  children?: React.ReactNode;
  clearLabel?: string;
  hasActiveFilters?: boolean;
  onClear?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const shouldShowClear = Boolean(onClear && hasActiveFilters);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ flexGrow: 0 }, style]}
      contentContainerStyle={{
        alignItems: 'center',
        gap: spacing.sm,
        paddingRight: spacing.screenHorizontal,
      }}
    >
      {chips?.map((chip) => (
        <FilterChip
          key={chip.key}
          active={chip.active}
          disabled={chip.disabled}
          label={chip.label}
          valueLabel={chip.valueLabel}
          onPress={chip.onPress}
        />
      ))}
      {children}
      {shouldShowClear ? (
        <Pressable
          accessibilityRole="button"
          onPress={onClear}
          style={({ pressed }) => ({
            borderRadius: radius.chip,
            opacity: pressed ? 0.72 : 1,
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.sm,
          })}
        >
          <Text selectable={false} style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
            {clearLabel}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

export function SectionTitle({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <View style={{ gap: 4, paddingTop: 4 }}>
      <Text selectable style={{ color: colors.text, fontSize: 19, fontWeight: '700' }}>
        {title}
      </Text>
      {subtitle ? (
        <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

// Tinggi minimum area teks multiline. Satu sumber untuk kedua jalur render di
// bawah; nilainya sengaja dipertahankan dari versi lama Field. Belum ada token
// yang sepadan (tokens.layout hanya punya fieldHeight/rowMinHeight/controlHeight).
const FIELD_MULTILINE_MIN_HEIGHT = 96;

type FieldBaseProps = {
  autoCapitalize?: TextInputProps['autoCapitalize'];
  // autoComplete & textContentType sengaja hanya diteruskan, tanpa nilai default:
  // dibiarkan undefined, TextInput berperilaku persis seperti sebelum prop ini ada,
  // jadi pemakaian Field yang sudah ada tidak berubah sama sekali. Keduanya dipakai
  // layar auth supaya password manager & saran email keyboard mau menyala.
  autoComplete?: TextInputProps['autoComplete'];
  error?: string;
  helperText?: string;
  label: string;
  value: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  numberOfLines?: number;
  textContentType?: TextInputProps['textContentType'];
  trailing?: React.ReactNode;
};

// onChangeText ditegakkan tipe, bukan konvensi: hanya field terkunci yang boleh
// tidak punya handler (nilainya memang tidak bisa berubah). Field biasa yang
// lupa mengoper handler gagal saat kompilasi, tidak diam-diam jadi read-only.
export type FieldProps =
  | (FieldBaseProps & { locked: true; onChangeText?: (value: string) => void })
  | (FieldBaseProps & { locked?: false; onChangeText: (value: string) => void });

export function Field({
  autoCapitalize = 'none',
  autoComplete,
  error,
  helperText,
  label,
  locked = false,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
  numberOfLines,
  textContentType,
  trailing,
}: FieldProps) {
  // Dua jalur render yang sengaja dipisah. Jalur "polos" (di bawah, cabang
  // else) adalah kode lama apa adanya: border digambar oleh TextInput sendiri.
  // Jalur "baris" hanya aktif kalau `locked` atau `trailing` diisi — border
  // pindah ke container supaya ikon gembok / tombol mata bisa duduk di dalam
  // border yang sama. Pemisahan ini disengaja: pemakaian Field yang sudah ada
  // tidak menyentuh jalur baru sama sekali, jadi tidak ada pergeseran piksel.
  const useRowLayout = locked || Boolean(trailing);
  // Error mengalahkan helperText; keduanya tidak pernah tampil bersamaan.
  const helperMessage = error ? null : helperText;
  const borderColor = error
    ? tokens.color.status.danger.text
    : locked
      ? tokens.color.line.hairline
      : tokens.color.line.card;

  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
      {useRowLayout ? (
        <View
          style={{
            alignItems: multiline ? 'flex-start' : 'center',
            backgroundColor: locked ? tokens.color.surface.subtle : tokens.color.surface.card,
            borderColor,
            borderCurve: 'continuous',
            borderRadius: tokens.radius.control,
            borderWidth: 1,
            flexDirection: 'row',
            gap: tokens.space.sm,
            minHeight: multiline ? FIELD_MULTILINE_MIN_HEIGHT : tokens.layout.fieldHeight,
            paddingLeft: tokens.space.lg,
            // Sisi kanan dirapatkan saat ada trailing supaya slot 44 tidak
            // mendorong ikon terlalu jauh ke dalam.
            paddingRight: trailing ? tokens.space.xs : tokens.space.lg,
            paddingVertical: multiline ? tokens.space.md : 0,
          }}
        >
          {locked ? (
            <Icon name="lock" size={tokens.icon.sm} color={tokens.color.text.tertiary} />
          ) : null}
          <TextInput
            autoCapitalize={autoCapitalize}
            autoComplete={autoComplete}
            autoCorrect={false}
            editable={!locked}
            keyboardType={keyboardType}
            multiline={multiline}
            numberOfLines={multiline ? numberOfLines ?? 4 : undefined}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={tokens.color.text.tertiary}
            secureTextEntry={secureTextEntry}
            style={{
              // Terkunci dibedakan lewat warna teks sekunder + permukaan redup +
              // gembok, bukan lewat opacity: targetnya terbaca "memang tidak bisa
              // diubah", bukan "sedang dinonaktifkan sementara".
              color: locked ? tokens.color.text.secondary : tokens.color.text.primary,
              flex: 1,
              fontSize: tokens.type.body.fontSize,
              minHeight: multiline ? FIELD_MULTILINE_MIN_HEIGHT - tokens.space.md * 2 : undefined,
              paddingVertical: 0,
            }}
            textAlignVertical={multiline ? 'top' : undefined}
            textContentType={textContentType}
            value={value}
          />
          {trailing ? (
            // Slot sentuh 44x44 (tokens.layout.tapTarget). Kontraknya: elemen yang
            // dititipkan pemanggil HARUS Pressable yang meregang mengisi slot ini.
            // Sengaja BUKAN hitSlop — hitSlop akan meluber ke atas TextInput di
            // sebelahnya dan mencuri tap yang seharusnya menaruh kursor di teks.
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: tokens.layout.tapTarget,
                minWidth: tokens.layout.tapTarget,
              }}
            >
              {trailing}
            </View>
          ) : null}
        </View>
      ) : (
        <TextInput
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines ?? 4 : undefined}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSoft}
          secureTextEntry={secureTextEntry}
          style={{
            backgroundColor: colors.surface,
            borderColor: error ? tokens.color.status.danger.text : colors.border,
            borderCurve: 'continuous',
            borderRadius: 14,
            borderWidth: 1,
            color: colors.text,
            fontSize: 16,
            minHeight: tokens.layout.fieldHeight,
            paddingHorizontal: spacing.lg,
            ...(multiline
              ? {
                  // literal borderRadius 14 / fontSize 16 di atas masih disengaja, sejalan dgn FIELD_MULTILINE_MIN_HEIGHT; disapu saat migrasi Field ke tokens
                  minHeight: FIELD_MULTILINE_MIN_HEIGHT,
                  paddingVertical: tokens.space.md,
                }
              : null),
          }}
          textAlignVertical={multiline ? 'top' : undefined}
          textContentType={textContentType}
          value={value}
        />
      )}
      {error ? (
        <Text
          selectable
          style={{
            color: tokens.color.status.danger.text,
            fontSize: tokens.type.meta.fontSize,
            lineHeight: tokens.type.meta.lineHeight,
          }}
        >
          {error}
        </Text>
      ) : null}
      {helperMessage ? (
        <Text
          selectable
          style={{
            color: tokens.color.text.tertiary,
            fontSize: tokens.type.meta.fontSize,
            lineHeight: tokens.type.meta.lineHeight,
          }}
        >
          {helperMessage}
        </Text>
      ) : null}
    </View>
  );
}

// Password + tombol mata, dibangun di atas <Field> lewat slot `trailing` — bukan
// menggambar border sendiri, supaya tingginya, radiusnya, dan tampilan error-nya
// otomatis ikut Field dan tidak bisa melenceng sendiri.
//
// Diangkat dari definisi lokal di account-password-screen.tsx; definisi lokal di
// sana SENGAJA dibiarkan utuh untuk sementara agar layar "Ubah password" tidak
// ikut bergerak di batch ini.
//
// Tiap instance memegang state show/hide-nya sendiri — membuka satu field tidak
// ikut membuka field password lain di layar yang sama.
export function PasswordField({
  error,
  helperText,
  label,
  onChangeText,
  textContentType,
  value,
}: {
  error?: string;
  helperText?: string;
  label: string;
  onChangeText: (value: string) => void;
  textContentType?: TextInputProps['textContentType'];
  value: string;
}) {
  const [visible, setVisible] = React.useState(false);

  return (
    <Field
      error={error}
      helperText={helperText}
      label={label}
      secureTextEntry={!visible}
      textContentType={textContentType}
      value={value}
      onChangeText={onChangeText}
      trailing={
        <Pressable
          accessibilityLabel={
            visible ? `Sembunyikan ${label.toLowerCase()}` : `Tampilkan ${label.toLowerCase()}`
          }
          accessibilityRole="button"
          accessibilityState={{ selected: visible }}
          onPress={() => setVisible((previous) => !previous)}
          // Meregang mengisi slot 44x44 milik Field, bukan sekadar seukuran ikon
          // dan bukan hitSlop — hitSlop akan meluber ke TextInput di sebelahnya
          // dan mencuri tap yang seharusnya menaruh kursor di teks.
          style={({ pressed }) => ({
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: tokens.layout.tapTarget,
            minWidth: tokens.layout.tapTarget,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon
            name={visible ? 'eye-off' : 'eye'}
            size={tokens.icon.md}
            color={tokens.color.text.tertiary}
          />
        </Pressable>
      }
    />
  );
}

// Tautan silang antar layar auth: "Belum punya akun? Daftar". Diangkat dari
// definisi lokal yang tersalin identik di login.tsx dan register.tsx; kedua
// salinan itu dibersihkan saat layarnya dirombak, bukan di sini.
export function InlineAuthLink({
  actionLabel,
  onPress,
  prefix,
}: {
  actionLabel: string;
  onPress: () => void;
  prefix: string;
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: tokens.space.xs,
        justifyContent: 'center',
      }}
    >
      <Text selectable style={{ color: tokens.color.text.tertiary }}>
        {prefix}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => ({
          opacity: pressed ? 0.6 : 1,
          paddingVertical: tokens.space.sm,
        })}
      >
        <Text selectable={false} style={{ color: tokens.color.brand.base, fontWeight: '700' }}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

export type OptionItem = { value: string; label: string; disabled?: boolean };

export function OptionChip({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const backgroundColor = disabled
    ? tokens.color.surface.canvas
    : selected
      ? tokens.color.brand.soft
      : tokens.color.surface.card;
  const borderColor = disabled
    ? tokens.color.line.hairline
    : selected
      ? tokens.color.brand.base
      : tokens.color.line.card;
  const textColor = disabled
    ? tokens.color.text.tertiary
    : selected
      ? tokens.color.brand.base
      : tokens.color.text.secondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), selected: Boolean(selected) }}
      disabled={disabled}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor,
        borderColor,
        borderCurve: 'continuous',
        borderRadius: tokens.radius.pill,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: tokens.layout.tapTarget,
        paddingHorizontal: tokens.space.md,
      }}
    >
      <Text
        selectable={false}
        style={{
          color: textColor,
          fontSize: tokens.type.label.fontSize,
          fontWeight: tokens.type.label.fontWeight,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function OptionGroup({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label?: string;
  options: OptionItem[];
  value?: string | null;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <View style={{ gap: tokens.space.sm }}>
      {label ? (
        <Text selectable style={{ color: tokens.color.text.primary, ...tokens.type.label }}>
          {label}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm }}>
        {options.map((option) => (
          <OptionChip
            key={option.value}
            disabled={option.disabled}
            label={option.label}
            onPress={() => onChange(option.value)}
            selected={value === option.value}
          />
        ))}
      </View>
      {error ? (
        <Text
          selectable
          style={{
            color: tokens.color.status.danger.text,
            fontSize: tokens.type.meta.fontSize,
            lineHeight: tokens.type.meta.lineHeight,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function DateField({
  error,
  label,
  onChangeDate,
  placeholder = 'Pilih tanggal',
  value,
}: {
  error?: string;
  label: string;
  onChangeDate: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const [showPicker, setShowPicker] = React.useState(false);
  const selectedDate = parseIsoDate(value) ?? new Date();

  function handleValueChange(_event: DateTimePickerChangeEvent, date: Date) {
    if (Platform.OS !== 'ios') {
      setShowPicker(false);
    }

    onChangeDate(formatIsoDate(date));
  }

  function handleDismiss() {
    setShowPicker(false);
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setShowPicker(true)}
        style={{
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderColor: error ? tokens.color.status.danger.text : colors.border,
          borderCurve: 'continuous',
          borderRadius: 14,
          borderWidth: 1,
          flexDirection: 'row',
          gap: spacing.md,
          justifyContent: 'center',
          minHeight: 54,
          paddingHorizontal: spacing.lg,
        }}
      >
          <Icon name="calendar" size={20} color={colors.primary} />
          <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            {formatFriendlyDate(value, placeholder)}
          </Text>
        </Pressable>
      {error ? (
        <Text
          selectable
          style={{
            color: tokens.color.status.danger.text,
            fontSize: tokens.type.meta.fontSize,
            lineHeight: tokens.type.meta.lineHeight,
          }}
        >
          {error}
        </Text>
      ) : null}
      {showPicker ? (
        <DateTimePicker
          display="default"
          mode="date"
          onDismiss={handleDismiss}
          onNeutralButtonPress={handleDismiss}
          onValueChange={handleValueChange}
          value={selectedDate}
        />
      ) : null}
    </View>
  );
}

export function CompactMetaItem({
  icon,
  label,
}: {
  icon: 'calendar' | 'target' | 'user';
  label: string;
}) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 5 }}>
      <Icon name={icon} size={14} color={colors.muted} />
      <Text
        selectable
        ellipsizeMode="tail"
        numberOfLines={1}
        style={{ color: colors.muted, flexShrink: 1, fontSize: 13, lineHeight: 18 }}
      >
        {label}
      </Text>
    </View>
  );
}

export type ButtonVariant = 'danger' | 'ghost' | 'icon' | 'primary' | 'quiet' | 'secondary';

export function Button({
  accessibilityLabel,
  disabled,
  icon,
  loading,
  onPress,
  size = 'regular',
  title = '',
  variant = 'primary',
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
  onPress: () => void;
  size?: 'regular' | 'small';
  title?: string;
  variant?: ButtonVariant;
}) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost' || variant === 'quiet';
  const isIcon = variant === 'icon';
  const contentColor = isPrimary ? '#FFFFFF' : isDanger ? colors.danger : colors.primary;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        alignSelf: size === 'small' || isIcon ? 'flex-start' : 'stretch',
        backgroundColor: getButtonBackground(variant, pressed),
        borderColor: getButtonBorderColor(variant),
        borderCurve: 'continuous',
        borderRadius: isIcon ? radius.round : size === 'small' ? radius.button : radius.button,
        borderWidth: isGhost ? 0 : 1,
        flexDirection: 'row',
        gap: spacing.sm,
        height: isIcon ? (size === 'small' ? 40 : 48) : undefined,
        justifyContent: 'center',
        minHeight: isIcon ? undefined : size === 'small' ? 40 : tokens.layout.controlHeight,
        minWidth: isIcon ? (size === 'small' ? 40 : 48) : undefined,
        opacity: disabled ? 0.6 : 1,
        paddingHorizontal: isIcon ? 0 : size === 'small' ? spacing.md : spacing.lg,
      })}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <>
          {icon}
          {isIcon && !title ? null : (
            <Text
              selectable={false}
              numberOfLines={1}
              style={{
                color: isPrimary ? '#FFFFFF' : isDanger ? colors.danger : isGhost ? colors.primary : colors.text,
                fontSize: size === 'small' ? 14 : 16,
                fontWeight: '700',
              }}
            >
              {title}
            </Text>
          )}
        </>
      )}
    </Pressable>
  );
}

export function FloatingActionButton({
  icon = 'plus',
  label,
  onPress,
}: {
  icon?: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: tokens.color.brand.base,
        borderRadius: tokens.radius.cardInner,
        height: tokens.layout.controlHeight,
        justifyContent: 'center',
        width: tokens.layout.controlHeight,
      }}
    >
      <Icon name={icon} size={24} color="#FFFFFF" />
    </Pressable>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  const safeMessage = sanitizeUserFacingMessage(message);

  if (!safeMessage) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: colors.dangerSurface,
        borderColor: colors.dangerBorder,
        borderRadius: radius.lg,
        borderWidth: 1,
        padding: spacing.md,
      }}
    >
      <Text selectable style={{ color: colors.danger, lineHeight: 20 }}>
        {safeMessage}
      </Text>
    </View>
  );
}

export function SuccessBanner({ message }: { message?: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: colors.successSurface,
        borderColor: colors.successBorder,
        borderRadius: radius.lg,
        borderWidth: 1,
        padding: spacing.md,
      }}
    >
      <Text selectable style={{ color: colors.primary, lineHeight: 20 }}>
        {message}
      </Text>
    </View>
  );
}

export function LoadingState({ message = 'Memuat data...' }: { message?: string }) {
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
        <ActivityIndicator color={colors.primary} />
        <Text selectable style={{ color: colors.muted, textAlign: 'center' }}>
          {message}
        </Text>
      </View>
    </Screen>
  );
}

export function EmptyState({
  icon,
  subtitle,
  title,
  variant = 'card',
}: {
  icon?: IconName;
  subtitle?: string;
  title: string;
  variant?: 'card' | 'plain';
}) {
  if (variant === 'plain') {
    return (
      <View style={{ alignItems: 'center', gap: tokens.space.sm }}>
        {icon ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: tokens.color.surface.subtle,
              borderRadius: tokens.radius.pill,
              height: 56,
              justifyContent: 'center',
              width: 56,
            }}
          >
            <Icon name={icon} size={24} color={tokens.color.text.tertiary} />
          </View>
        ) : null}
        <Text selectable style={{ ...tokens.type.subheading, color: tokens.color.text.primary, textAlign: 'center' }}>
          {title}
        </Text>
        {subtitle ? (
          <Text selectable style={{ ...tokens.type.meta, color: tokens.color.text.tertiary, textAlign: 'center' }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <Card>
      <Text selectable style={{ color: colors.text, fontSize: typography.h3.fontSize, fontWeight: '700' }}>
        {title}
      </Text>
      {subtitle ? (
        <Text selectable style={{ color: colors.muted, lineHeight: 21 }}>
          {subtitle}
        </Text>
      ) : null}
    </Card>
  );
}

export function MetaRow({ label, value }: { label: string; value?: string | null }) {
  const safeValue = sanitizeDisplayValue(value);

  return (
    <View style={{ gap: spacing.xs }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13 }}>
        {label}
      </Text>
      <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
        {safeValue || '-'}
      </Text>
    </View>
  );
}

// Baris menu bernavigasi: ikon kiri + label + chevron kanan. Bentuknya mengikuti
// pola inline yang sudah dipakai di tab Kebun (app/(owner)/owner/farm.tsx, baris
// SOP perawatan), tapi tanpa lingkaran latar ikon karena baris menu profil hanya
// perlu ikon + label. Pemakaian inline lama SENGAJA belum dimigrasikan ke sini.
export function MenuRow({
  danger = false,
  icon,
  label,
  onPress,
}: {
  danger?: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const contentColor = danger ? tokens.color.status.danger.text : tokens.color.text.primary;
  const iconColor = danger ? tokens.color.status.danger.text : tokens.color.brand.base;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        flexDirection: 'row',
        gap: tokens.space.md,
        minHeight: tokens.layout.controlHeight,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon name={icon} size={tokens.icon.md} color={iconColor} />
      <Text
        selectable={false}
        numberOfLines={1}
        style={{
          color: contentColor,
          flex: 1,
          fontSize: tokens.type.bodyStrong.fontSize,
          fontWeight: tokens.type.bodyStrong.fontWeight,
          lineHeight: tokens.type.bodyStrong.lineHeight,
        }}
      >
        {label}
      </Text>
      {/* Varian danger tidak bernavigasi ke halaman lain, jadi tanpa chevron. */}
      {danger ? null : <Icon name="chevron-right" size={tokens.icon.md} color={tokens.color.text.tertiary} />}
    </Pressable>
  );
}

// Container deret baris menu. Pemisah hairline diurus di sini, BUKAN di MenuRow,
// supaya aturan "tidak ada pemisah di baris terakhir" tidak bergantung pada
// kedisiplinan pemanggil. Pola yang sama dipakai member-row.tsx (baris tidak
// menggambar border sendiri). Dipakai sebagai anak tunggal <Card>.
export function MenuRowGroup({ children }: { children: React.ReactNode }) {
  const rows = React.Children.toArray(children);

  return (
    <View>
      {rows.map((row, index) => (
        <View
          key={index}
          style={
            index < rows.length - 1
              ? { borderBottomColor: tokens.color.line.hairline, borderBottomWidth: 1 }
              : undefined
          }
        >
          {row}
        </View>
      ))}
    </View>
  );
}

export function FormSection({
  children,
  description,
  style,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  style?: StyleProp<ViewStyle>;
  title: string;
}) {
  return (
    <View style={style}>
      <Card>
        <SectionHeader description={description} title={title} />
        <View style={{ gap: 14 }}>{children}</View>
      </Card>
    </View>
  );
}

export function SearchFilterRow({
  filterActive = false,
  filterCount,
  onChangeText,
  onFilterPress,
  placeholder = 'Cari data',
  style,
  value,
}: {
  filterActive?: boolean;
  filterCount?: number;
  onChangeText: (value: string) => void;
  onFilterPress?: () => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
  value: string;
}) {
  return (
    <View style={[{ alignItems: 'center', flexDirection: 'row', gap: spacing.md }, style]}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.lg,
          borderWidth: 1,
          flex: 1,
          flexDirection: 'row',
          gap: spacing.sm,
          minHeight: 56,
          paddingHorizontal: spacing.lg,
        }}
      >
        <Icon name="search" size={20} color={colors.textSoft} />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSoft}
          style={{ color: colors.text, flex: 1, fontSize: 16 }}
          value={value}
        />
        {value.length > 0 ? (
          <Pressable
            accessibilityLabel="Hapus pencarian"
            accessibilityRole="button"
            hitSlop={{ bottom: 12, left: 12, right: 12, top: 12 }}
            onPress={() => onChangeText('')}
          >
            <Icon name="x" size={20} color={colors.textSoft} />
          </Pressable>
        ) : null}
      </View>
      {onFilterPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onFilterPress}
          style={{
            alignItems: 'center',
            backgroundColor: filterActive ? colors.primary : colors.surface,
            borderColor: filterActive ? colors.primary : colors.primaryBorder,
            borderCurve: 'continuous',
            borderRadius: radius.lg,
            borderWidth: 1,
            height: 56,
            justifyContent: 'center',
            width: 56,
          }}
        >
          <Icon name="adjustments-horizontal" size={20} color={filterActive ? colors.surface : colors.primary} />
          {(filterCount ?? 0) > 0 ? (
            <View
              style={{
                alignItems: 'center',
                backgroundColor: tokens.color.brand.base,
                borderRadius: tokens.radius.pill,
                height: 20,
                justifyContent: 'center',
                minWidth: 20,
                paddingHorizontal: 4,
                position: 'absolute',
                right: -6,
                top: -6,
              }}
            >
              <Text selectable={false} style={{ ...tokens.type.caption, color: '#FFFFFF', textAlign: 'center' }}>
                {filterCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

export function PhotoPickerCard({
  choosePhotoLabel = 'Pilih Galeri',
  description,
  emptyLabel = 'Tambah foto',
  error,
  imageUri,
  loading = false,
  onChoosePhoto,
  onRemovePhoto,
  onTakePhoto,
  removeLabel = 'Hapus Foto',
  required = false,
  takePhotoLabel = 'Ambil Foto',
  title = 'Foto',
}: {
  choosePhotoLabel?: string;
  description?: string;
  emptyLabel?: string;
  error?: string | null;
  imageUri?: string | null;
  loading?: boolean;
  onChoosePhoto?: () => void;
  onRemovePhoto?: () => void;
  onTakePhoto?: () => void;
  removeLabel?: string;
  required?: boolean;
  takePhotoLabel?: string;
  title?: string;
}) {
  const [sourceSheetOpen, setSourceSheetOpen] = React.useState(false);
  const hasImage = Boolean(imageUri);
  const sourceActions = [
    onTakePhoto ? { label: takePhotoLabel, onPress: onTakePhoto } : null,
    onChoosePhoto ? { label: choosePhotoLabel, onPress: onChoosePhoto } : null,
  ].filter((action): action is { label: string; onPress: () => void } => Boolean(action));

  function handleCardPress() {
    if (loading || sourceActions.length === 0) {
      return;
    }

    if (sourceActions.length === 1) {
      sourceActions[0].onPress();
      return;
    }

    setSourceSheetOpen(true);
  }

  return (
    <Card>
      <PhotoSourceSheet
        cameraLabel={takePhotoLabel}
        galleryLabel={choosePhotoLabel}
        hasPhoto={false}
        visible={sourceSheetOpen}
        onCameraPress={() => {
          setSourceSheetOpen(false);
          onTakePhoto?.();
        }}
        onClose={() => setSourceSheetOpen(false)}
        onDeletePhoto={() => setSourceSheetOpen(false)}
        onGalleryPress={() => {
          setSourceSheetOpen(false);
          onChoosePhoto?.();
        }}
      />
      <View style={{ gap: spacing.xs }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
          <Text selectable style={{ color: colors.text, flex: 1, fontSize: 16, fontWeight: '700' }}>
            {title}
          </Text>
          {required ? <Badge label="Wajib" tone="warning" /> : null}
        </View>
        {description ? (
          <Text selectable style={{ color: colors.muted, lineHeight: typography.small.lineHeight }}>
            {description}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={loading || sourceActions.length === 0}
        onPress={handleCardPress}
        style={{
          alignItems: 'center',
          backgroundColor: colors.photoPlaceholder,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.lg,
          borderWidth: 1,
          justifyContent: 'center',
          minHeight: 180,
          overflow: 'hidden',
        }}
      >
        {hasImage ? (
          <Image
            resizeMode="cover"
            source={{ uri: imageUri ?? undefined }}
            style={{ height: 180, width: '100%' }}
          />
        ) : (
          <View style={{ alignItems: 'center', gap: spacing.sm, padding: spacing.xl }}>
            <View
              style={{
                alignItems: 'center',
                backgroundColor: colors.surface,
                borderColor: colors.primaryBorder,
                borderRadius: radius.round,
                borderWidth: 1,
                height: 52,
                justifyContent: 'center',
                width: 52,
              }}
            >
              <CameraGlyph color={colors.primary} />
            </View>
            <Text selectable={false} style={{ color: colors.text, fontWeight: '700', textAlign: 'center' }}>
              {emptyLabel}
            </Text>
          </View>
        )}
        {onRemovePhoto && hasImage ? (
          <Pressable
            accessibilityLabel={removeLabel}
            accessibilityRole="button"
            disabled={loading}
            onPress={onRemovePhoto}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: colors.danger,
              borderColor: colors.surface,
              borderRadius: radius.round,
              borderWidth: 1,
              height: 34,
              justifyContent: 'center',
              opacity: pressed ? 0.78 : 1,
              position: 'absolute',
              right: spacing.sm,
              top: spacing.sm,
              width: 34,
            })}
          >
            <Icon name="x" size={16} color={colors.surface} />
          </Pressable>
        ) : null}
        {loading ? (
          <View
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(16,32,22,0.28)',
              bottom: 0,
              justifyContent: 'center',
              left: 0,
              position: 'absolute',
              right: 0,
              top: 0,
            }}
          >
            <ActivityIndicator color={colors.surface} />
          </View>
        ) : null}
      </Pressable>

      {error ? <ErrorBanner message={error} /> : null}
    </Card>
  );
}

export function getStatusTone(status: string): StatusTone {
  const normalized = normalizeStatus(status);

  if (
    [
      'healthy',
      'sehat',
      'completed',
      'complete',
      'selesai',
      'active',
      'aktif',
      'resolved',
      'done',
    ].includes(normalized)
  ) {
    return 'success';
  }

  if (
    [
      'needs_attention',
      'perlu_perhatian',
      'postponed',
      'tertunda',
      'pending',
      'menunggu',
      'new',
      'baru',
    ].includes(normalized)
  ) {
    return 'warning';
  }

  if (
    [
      'pest_attacked',
      'disease_indicated',
      'damaged',
      'dead',
      'hama',
      'penyakit',
      'rusak',
      'mati',
      'rejected',
      'ditolak',
      'removed',
      'dikeluarkan',
      'error',
      'failed',
      'gagal',
    ].includes(normalized)
  ) {
    return 'danger';
  }

  if (['in_progress', 'follow_up', 'tindak_lanjut', 'info', 'informational'].includes(normalized)) {
    return 'info';
  }

  return 'neutral';
}

function getButtonBackground(variant: ButtonVariant, pressed: boolean): string {
  if (variant === 'primary') {
    return pressed ? colors.primaryPressed : colors.primary;
  }

  if (variant === 'danger') {
    return pressed ? colors.dangerBorder : colors.dangerSurface;
  }

  if (variant === 'ghost' || variant === 'quiet') {
    return pressed ? colors.primarySoft : 'transparent';
  }

  if (variant === 'icon') {
    return pressed ? colors.primarySoft : colors.surface;
  }

  return pressed ? colors.surfaceMuted : colors.surface;
}

function getButtonBorderColor(variant: ButtonVariant): string {
  if (variant === 'primary') {
    return colors.primary;
  }

  if (variant === 'danger') {
    return colors.dangerBorder;
  }

  if (variant === 'icon') {
    return colors.border;
  }

  return colors.border;
}

function getCardVariantStyle(
  variant: 'default' | 'highlight' | 'softGreen' | 'heroGreen' | 'warning' | 'danger' | 'info'
): { backgroundColor: string; borderColor: string } {
  if (variant === 'highlight' || variant === 'softGreen') {
    return {
      backgroundColor: colors.surfaceGreen,
      borderColor: colors.primaryBorder,
    };
  }

  if (variant === 'heroGreen') {
    return {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    };
  }

  if (variant === 'warning') {
    return {
      backgroundColor: colors.warningBg,
      borderColor: colors.warningBorder,
    };
  }

  if (variant === 'danger') {
    return {
      backgroundColor: colors.dangerBg,
      borderColor: colors.dangerBorder,
    };
  }

  if (variant === 'info') {
    return {
      backgroundColor: colors.infoBg,
      borderColor: colors.infoBorder,
    };
  }

  return {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  };
}

export function CameraGlyph({ color = colors.primary }: { color?: string }) {
  return <Icon name="camera" color={color} size={24} />;
}

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatFriendlyDate(value: string, placeholder = 'Pilih tanggal'): string {
  const date = parseIsoDate(value);

  if (!date) {
    return placeholder;
  }

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
