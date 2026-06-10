import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';

const colors = {
  background: '#F6F7F2',
  surface: '#FFFFFF',
  text: '#1E2A24',
  muted: '#68746D',
  border: '#DDE4DA',
  primary: '#2F6F4E',
  primaryPressed: '#25583E',
  danger: '#B42318',
  dangerSurface: '#FEE4E2',
};

export function Screen({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 16 }}
    >
      <View style={{ flex: 1, gap: 16 }}>{children}</View>
      {footer ? <View style={{ gap: 10, paddingBottom: 12 }}>{footer}</View> : null}
    </ScrollView>
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
    <View style={{ gap: 8, paddingTop: 8 }}>
      <Text selectable style={{ color: colors.text, fontSize: 30, fontWeight: '700' }}>
        {title}
      </Text>
      {subtitle ? (
        <Text selectable style={{ color: colors.muted, fontSize: 16, lineHeight: 23 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderCurve: 'continuous',
        borderRadius: 8,
        borderWidth: 1,
        gap: 12,
        padding: 16,
      }}
    >
      {children}
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
          borderRadius: 8,
          borderWidth: 1,
          color: colors.text,
          fontSize: 16,
          minHeight: 48,
          paddingHorizontal: 14,
        }}
        value={value}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
}) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        backgroundColor: isPrimary
          ? pressed
            ? colors.primaryPressed
            : colors.primary
          : isDanger
            ? colors.dangerSurface
            : colors.surface,
        borderColor: isDanger ? '#FDA29B' : isPrimary ? colors.primary : colors.border,
        borderCurve: 'continuous',
        borderRadius: 8,
        borderWidth: 1,
        minHeight: 48,
        justifyContent: 'center',
        opacity: disabled ? 0.6 : 1,
        paddingHorizontal: 16,
      })}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#FFFFFF' : colors.primary} />
      ) : (
        <Text
          selectable
          style={{
            color: isPrimary ? '#FFFFFF' : isDanger ? colors.danger : colors.text,
            fontSize: 16,
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
  if (!message) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: colors.dangerSurface,
        borderColor: '#FDA29B',
        borderRadius: 8,
        borderWidth: 1,
        padding: 12,
      }}
    >
      <Text selectable style={{ color: colors.danger, lineHeight: 20 }}>
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
  return (
    <View style={{ gap: 3 }}>
      <Text selectable style={{ color: colors.muted, fontSize: 13 }}>
        {label}
      </Text>
      <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
        {value || '-'}
      </Text>
    </View>
  );
}
