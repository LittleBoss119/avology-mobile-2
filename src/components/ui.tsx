import React from 'react';
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sanitizeDisplayValue, sanitizeUserFacingMessage } from '../utils/displayFormat';

const colors = {
  background: '#F7FAF3',
  backgroundDeep: '#ECF4E7',
  surface: '#FFFFFF',
  text: '#1E2A24',
  muted: '#68746D',
  border: '#DCE7D5',
  primary: '#065F2E',
  primaryPressed: '#044922',
  primarySoft: '#E7F3EA',
  successSurface: '#E7F6EC',
  danger: '#B42318',
  dangerSurface: '#FEE4E2',
  warningSurface: '#FFF4D6',
};

export const appTheme = colors;

export function Screen({
  children,
  floatingAction,
  floatingActionBottom = 24,
  footer,
}: {
  children: React.ReactNode;
  floatingAction?: React.ReactNode;
  floatingActionBottom?: number;
  footer?: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 18, paddingBottom: floatingAction ? 132 : 20 }}
      >
        <View style={{ flex: 1, gap: 18 }}>{children}</View>
        {footer ? <View style={{ gap: 10, paddingBottom: 16 }}>{footer}</View> : null}
      </ScrollView>
      {floatingAction ? (
        <View style={{ bottom: floatingActionBottom, position: 'absolute', right: 20 }}>{floatingAction}</View>
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
    <View style={{ gap: 8, paddingTop: 10 }}>
      <Text selectable style={{ color: colors.text, fontSize: 31, fontWeight: '800', letterSpacing: 0 }}>
        {title}
      </Text>
      {subtitle ? (
        <Text selectable style={{ color: colors.muted, fontSize: 16, lineHeight: 24 }}>
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
    <View style={{ gap: subtitle ? 8 : 0, paddingTop: Math.max(insets.top, 8) }}>
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={{
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: 999,
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
        <Text selectable numberOfLines={1} style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>
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
    <View style={{ alignItems: compact ? 'flex-start' : 'center', gap: 10 }}>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.primary,
          borderColor: '#B8D8BF',
          borderCurve: 'continuous',
          borderRadius: compact ? 18 : 24,
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
      <View style={{ alignItems: compact ? 'flex-start' : 'center', gap: 3 }}>
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

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 4, paddingTop: 2 }}>
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

export function Card({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'highlight';
}) {
  const isHighlight = variant === 'highlight';

  return (
    <View
      style={{
        backgroundColor: isHighlight ? colors.primarySoft : colors.surface,
        borderColor: isHighlight ? '#B8D8BF' : colors.border,
        borderCurve: 'continuous',
        borderRadius: 12,
        borderWidth: 1,
        gap: 13,
        padding: 17,
      }}
    >
      {children}
    </View>
  );
}

type BadgeTone = 'danger' | 'muted' | 'success' | 'warning';

const badgeColors: Record<BadgeTone, { background: string; border: string; text: string }> = {
  danger: {
    background: colors.dangerSurface,
    border: '#FDA29B',
    text: colors.danger,
  },
  muted: {
    background: '#F2F4F7',
    border: '#D0D5DD',
    text: '#475467',
  },
  success: {
    background: colors.successSurface,
    border: '#A6D9B8',
    text: colors.primary,
  },
  warning: {
    background: colors.warningSurface,
    border: '#F6D77A',
    text: '#7A5600',
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
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 5,
        maxWidth,
      }}
    >
      <Text selectable numberOfLines={1} style={{ color: badge.text, fontSize: 12, fontWeight: '700' }}>
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
  tone?: 'danger' | 'muted' | 'primary' | 'success' | 'warning';
  value: number | string;
}) {
  const textColor =
    tone === 'danger'
      ? colors.danger
      : tone === 'warning'
        ? '#7A5600'
        : tone === 'success' || tone === 'primary'
          ? colors.primary
          : colors.muted;

  return (
    <View style={{ flexBasis: '30%', flexGrow: 1, minWidth: 96 }}>
      <Card>
        <View style={{ gap: 5, minHeight: 62, justifyContent: 'space-between' }}>
          <Text selectable numberOfLines={2} style={{ color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 17 }}>
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
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 9,
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
    <View style={{ gap: 7 }}>
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
        {label}
      </Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A098"
        secureTextEntry={secureTextEntry}
        style={{
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: 12,
          borderWidth: 1,
          color: colors.text,
          fontSize: 16,
          minHeight: 50,
          paddingHorizontal: 15,
        }}
        value={value}
      />
    </View>
  );
}

export function DateField({
  label,
  onChangeDate,
  value,
}: {
  label: string;
  onChangeDate: (value: string) => void;
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
    <View style={{ gap: 7 }}>
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
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
          borderRadius: 12,
          borderWidth: 1,
          flexDirection: 'row',
          gap: 10,
          justifyContent: 'center',
          minHeight: 50,
          paddingHorizontal: 15,
        }}
      >
        <DateFieldCalendarIcon />
        <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
          {formatFriendlyDate(value)}
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
        borderColor: isDanger ? '#FDA29B' : isPrimary ? colors.primary : colors.border,
        borderCurve: 'continuous',
        borderRadius: 12,
        borderWidth: 1,
        minHeight: size === 'small' ? 40 : 50,
        justifyContent: 'center',
        opacity: disabled ? 0.6 : 1,
        paddingHorizontal: size === 'small' ? 12 : 16,
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
        borderColor: '#FDA29B',
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
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
        borderColor: '#A6D9B8',
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
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
      <View style={{ flex: 1, justifyContent: 'center', gap: 12 }}>
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
      <Text selectable style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>
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
    <View style={{ gap: 3 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13 }}>
        {label}
      </Text>
      <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
        {safeValue || '-'}
      </Text>
    </View>
  );
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

function formatFriendlyDate(value: string): string {
  const date = parseIsoDate(value);

  if (!date) {
    return 'Pilih tanggal';
  }

  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
