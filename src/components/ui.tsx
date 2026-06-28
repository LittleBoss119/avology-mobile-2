import React from 'react';
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  colors as designColors,
  radius,
  spacing,
  statusColors,
  theme,
  typography,
  type StatusTone,
} from '../constants/theme';
import { sanitizeDisplayValue, sanitizeUserFacingMessage } from '../utils/displayFormat';

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
  children,
  floatingAction,
  floatingActionBottom = 24,
  footer,
  stickyFooter,
}: {
  children: React.ReactNode;
  floatingAction?: React.ReactNode;
  floatingActionBottom?: number;
  footer?: React.ReactNode;
  stickyFooter?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const overlayBottomPadding = stickyFooter
    ? 128 + insets.bottom
    : floatingAction
      ? 132
      : spacing['2xl'];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.xl,
          gap: spacing.xl,
          paddingBottom: overlayBottomPadding,
        }}
      >
        <View style={{ flex: 1, gap: spacing.xl }}>{children}</View>
        {footer ? <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>{footer}</View> : null}
      </ScrollView>
      {stickyFooter ? (
        <View
          style={{
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            bottom: 0,
            left: 0,
            paddingBottom: Math.max(insets.bottom, spacing.md),
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            position: 'absolute',
            right: 0,
          }}
        >
          {stickyFooter}
        </View>
      ) : null}
      {floatingAction ? (
        <View style={{ bottom: floatingActionBottom, position: 'absolute', right: spacing.xl }}>
          {floatingAction}
        </View>
      ) : null}
    </View>
  );
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
  right,
  subtitle,
  title,
  onBack,
}: {
  right?: React.ReactNode;
  subtitle?: string;
  title: string;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ gap: subtitle ? spacing.sm : 0, paddingTop: Math.max(insets.top, spacing.sm) }}>
      <View
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'space-between',
          minHeight: 56,
        }}
      >
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={{
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.round,
              borderWidth: 1,
              height: 44,
              justifyContent: 'center',
              width: 44,
            }}
          >
            <Text selectable style={{ color: colors.primary, fontSize: 24, fontWeight: '900', lineHeight: 26 }}>
              {'<'}
            </Text>
          </Pressable>
        ) : (
          <View style={{ height: 44, width: 44 }} />
        )}
        <Text selectable numberOfLines={1} style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>
          {title}
        </Text>
        {right ?? <View style={{ height: 44, width: 44 }} />}
      </View>
      {subtitle ? (
        <Text selectable style={{ color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <View style={{ alignItems: compact ? 'flex-start' : 'center', gap: spacing.md }}>
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
        <Text selectable style={{ color: '#FFFFFF', fontSize: compact ? 24 : 34, fontWeight: '900' }}>
          A
        </Text>
      </View>
      <View style={{ alignItems: compact ? 'flex-start' : 'center', gap: spacing.xs }}>
        <Text selectable style={{ color: colors.text, fontSize: compact ? 20 : 24, fontWeight: '900' }}>
          Avology
        </Text>
        <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: '700' }}>
          Operasional kebun alpukat
        </Text>
      </View>
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
            fontWeight: '800',
            lineHeight: typography.h3.lineHeight,
          }}
        >
          {title}
        </Text>
        {actionLabel && onActionPress ? (
          <Pressable onPress={onActionPress} style={{ paddingHorizontal: spacing.xs, paddingVertical: spacing.xs }}>
            <Text selectable style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>
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
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'highlight' | 'softGreen' | 'heroGreen' | 'warning' | 'danger' | 'info';
}) {
  const cardStyle = getCardVariantStyle(variant);

  return (
    <View
      style={{
        ...cardStyle,
        borderCurve: 'continuous',
        borderRadius: radius.xl,
        borderWidth: 1,
        gap: spacing.md,
        padding: spacing.lg,
      }}
    >
      {children}
    </View>
  );
}

export type BadgeTone = 'danger' | 'info' | 'muted' | 'neutral' | 'pending' | 'success' | 'warning';

const badgeColors: Record<BadgeTone, { background: string; border: string; text: string }> = {
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
  tone = 'muted',
}: {
  label: string;
  maxWidth?: number;
  tone?: BadgeTone;
}) {
  const badge = badgeColors[tone];

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
        selectable
        numberOfLines={1}
        style={{
          color: badge.text,
          fontSize: typography.caption.fontSize,
          fontWeight: '700',
          lineHeight: typography.caption.lineHeight,
        }}
      >
        {label}
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
          <Text selectable style={{ color: textColor, fontSize: 25, fontVariant: ['tabular-nums'], fontWeight: '900' }}>
            {value}
          </Text>
        </View>
      </Card>
    </View>
  );
}

export function ChipButton({
  active,
  label,
  onPress,
}: {
  active: boolean;
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
      <Text selectable style={{ color: active ? '#FFFFFF' : colors.text, fontSize: 14, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SectionTitle({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <View style={{ gap: 4, paddingTop: 4 }}>
      <Text selectable style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>
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

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSoft}
        secureTextEntry={secureTextEntry}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: 14,
          borderWidth: 1,
          color: colors.text,
          fontSize: 16,
          minHeight: 54,
          paddingHorizontal: spacing.lg,
        }}
        value={value}
      />
    </View>
  );
}

export function DateField({
  label,
  onChangeDate,
  placeholder = 'Pilih tanggal',
  value,
}: {
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
          borderColor: colors.border,
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
          <DateFieldCalendarIcon />
          <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
            {formatFriendlyDate(value, placeholder)}
          </Text>
        </Pressable>
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
      <CompactMetaIcon name={icon} />
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

function CompactMetaIcon({ name }: { name: 'calendar' | 'target' | 'user' }) {
  const color = colors.muted;

  if (name === 'calendar') {
    return (
      <View style={{ borderColor: color, borderRadius: 3, borderWidth: 1.5, height: 14, width: 13 }}>
        <View style={{ backgroundColor: color, height: 1.5, marginTop: 3 }} />
      </View>
    );
  }

  if (name === 'target') {
    return (
      <View style={{ alignItems: 'center', borderColor: color, borderRadius: 999, borderWidth: 1.5, height: 14, justifyContent: 'center', width: 14 }}>
        <View style={{ borderColor: color, borderRadius: 999, borderWidth: 1.5, height: 6, width: 6 }} />
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center', width: 14 }}>
      <View style={{ borderColor: color, borderRadius: 999, borderWidth: 1.5, height: 6, width: 6 }} />
      <View style={{ borderColor: color, borderRadius: 999, borderWidth: 1.5, height: 6, marginTop: -1, width: 12 }} />
    </View>
  );
}

function DateFieldCalendarIcon() {
  return (
    <View style={{ borderColor: colors.primary, borderRadius: 4, borderWidth: 2, height: 18, width: 17 }}>
      <View style={{ backgroundColor: colors.primary, height: 2, marginTop: 4 }} />
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  size = 'regular',
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  size?: 'regular' | 'small';
}) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        alignSelf: size === 'small' ? 'flex-start' : 'stretch',
        backgroundColor: isPrimary
          ? pressed
            ? colors.primaryPressed
            : colors.primary
          : isDanger
            ? colors.dangerSurface
            : colors.surface,
        borderColor: isDanger ? colors.dangerBorder : isPrimary ? colors.primary : colors.border,
        borderCurve: 'continuous',
        borderRadius: size === 'small' ? radius.md : radius.lg,
        borderWidth: 1,
        minHeight: size === 'small' ? 40 : isPrimary ? 56 : 52,
        justifyContent: 'center',
        opacity: disabled ? 0.6 : 1,
        paddingHorizontal: size === 'small' ? spacing.md : spacing.lg,
      })}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#FFFFFF' : colors.primary} />
      ) : (
        <Text
          selectable
          style={{
            color: isPrimary ? '#FFFFFF' : isDanger ? colors.danger : colors.text,
            fontSize: size === 'small' ? 14 : 16,
            fontWeight: '700',
          }}
        >
          {title}
        </Text>
      )}
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

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
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
  onChangeText,
  onFilterPress,
  placeholder = 'Cari data',
  style,
  value,
}: {
  filterActive?: boolean;
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
          minHeight: 56,
          paddingHorizontal: spacing.lg,
        }}
      >
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSoft}
          style={{ color: colors.text, flex: 1, fontSize: 16, width: '100%' }}
          value={value}
        />
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
          <FilterGlyph active={filterActive} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function PhotoPickerCard({
  choosePhotoLabel = 'Pilih Galeri',
  description,
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
  const hasImage = Boolean(imageUri);

  return (
    <Card>
      <View style={{ gap: spacing.xs }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' }}>
          <Text selectable style={{ color: colors.text, flex: 1, fontSize: 16, fontWeight: '800' }}>
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

      <View
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
              <Text selectable style={{ color: colors.primary, fontSize: 24, fontWeight: '900' }}>
                +
              </Text>
            </View>
            <Text selectable style={{ color: colors.muted, fontWeight: '700', textAlign: 'center' }}>
              Foto belum dipilih
            </Text>
          </View>
        )}
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
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {onTakePhoto ? (
          <View style={{ flexBasis: 132, flexGrow: 1 }}>
            <Button disabled={loading} title={takePhotoLabel} variant="secondary" onPress={onTakePhoto} />
          </View>
        ) : null}
        {onChoosePhoto ? (
          <View style={{ flexBasis: 132, flexGrow: 1 }}>
            <Button disabled={loading} title={choosePhotoLabel} variant="secondary" onPress={onChoosePhoto} />
          </View>
        ) : null}
        {onRemovePhoto && hasImage ? (
          <View style={{ flexBasis: 132, flexGrow: 1 }}>
            <Button disabled={loading} title={removeLabel} variant="danger" onPress={onRemovePhoto} />
          </View>
        ) : null}
      </View>
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

function FilterGlyph({ active }: { active: boolean }) {
  const color = active ? colors.surface : colors.primary;

  return (
    <View style={{ gap: 4 }}>
      <View style={{ backgroundColor: color, borderRadius: radius.round, height: 2, width: 22 }} />
      <View style={{ backgroundColor: color, borderRadius: radius.round, height: 2, marginLeft: 4, width: 14 }} />
      <View style={{ backgroundColor: color, borderRadius: radius.round, height: 2, width: 18 }} />
    </View>
  );
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
