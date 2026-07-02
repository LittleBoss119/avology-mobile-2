import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { registerUser } from '../../src/services/authService';
import { Button, ErrorBanner, Field, Screen, TopAppBar } from '../../src/components/ui';
import { colors, radius, spacing } from '../../src/constants/theme';
import { useAuth } from '../../src/context/auth-context';

export default function RegisterScreen() {
  const { refresh } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = React.useState(false);
  const [fullName, setFullName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Konfirmasi password belum sesuai.');
      setSubmitting(false);
      return;
    }

    const result = await registerUser({
      email,
      password,
      fullName,
      phone,
    });

    if (result.error) {
      setError(result.error.message);
      setSubmitting(false);
      return;
    }

    await refresh();
    setSubmitting(false);
    router.replace('/');
  }

  return (
    <Screen
      footer={
        <>
          <Button title="Daftar" loading={submitting} onPress={handleSubmit} />
          <InlineAuthLink
            prefix="Sudah punya akun?"
            actionLabel="Masuk"
            onPress={() => router.replace('/login')}
          />
        </>
      }
    >
      <TopAppBar title="Daftar" onBack={() => router.back()} />
      <ErrorBanner message={error} />
      <View style={{ gap: spacing.lg }}>
        <Field label="Nama lengkap" value={fullName} onChangeText={setFullName} placeholder="Nama pengguna" />
        <Field label="Nomor HP" value={phone} onChangeText={setPhone} placeholder="08..." keyboardType="phone-pad" />
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="nama@email.com" keyboardType="email-address" />
        <PasswordField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Minimal 6 karakter"
          visible={passwordVisible}
          onToggleVisible={() => setPasswordVisible((value) => !value)}
        />
        <PasswordField
          label="Konfirmasi Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Ulangi password"
          visible={confirmPasswordVisible}
          onToggleVisible={() => setConfirmPasswordVisible((value) => !value)}
        />
      </View>
    </Screen>
  );
}

function PasswordField({
  label,
  onChangeText,
  onToggleVisible,
  placeholder,
  value,
  visible,
}: {
  label: string;
  onChangeText: (value: string) => void;
  onToggleVisible: () => void;
  placeholder: string;
  value: string;
  visible: boolean;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text selectable style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
        {label}
      </Text>
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderCurve: 'continuous',
          borderRadius: radius.input,
          borderWidth: 1,
          flexDirection: 'row',
          minHeight: 54,
          paddingHorizontal: spacing.lg,
        }}
      >
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSoft}
          secureTextEntry={!visible}
          style={{ color: colors.text, flex: 1, fontSize: 16, minHeight: 52, paddingRight: spacing.md }}
          value={value}
        />
        <Pressable accessibilityRole="button" onPress={onToggleVisible} style={{ padding: spacing.sm }}>
          <Text selectable={false} style={{ color: colors.primary, fontSize: 13, fontWeight: '800' }}>
            {visible ? 'Sembunyikan' : 'Lihat'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function InlineAuthLink({
  actionLabel,
  onPress,
  prefix,
}: {
  actionLabel: string;
  onPress: () => void;
  prefix: string;
}) {
  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' }}>
      <Text selectable style={{ color: colors.textMuted }}>
        {prefix}
      </Text>
      <Pressable accessibilityRole="button" onPress={onPress} style={{ paddingVertical: spacing.sm }}>
        <Text selectable={false} style={{ color: colors.primary, fontWeight: '800' }}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}
