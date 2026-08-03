import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api';
import { useAuth } from '@/context/AuthContext';
import { Button, Field } from '@/components/ui';
import { colors, radius, rtl, spacing } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError('');

    if (!phone.trim() || !password) {
      setError('أدخل رقم الهاتف وكلمة المرور');
      return;
    }

    setSubmitting(true);
    try {
      await login(phone.trim(), password);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر تسجيل الدخول، حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo() {
    setPhone('0912345678');
    setPassword('123456');
    setError('');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.logo}>وصلة</Text>
            <Text style={[styles.title, rtl.text]}>أهلاً بعودتك</Text>
            <Text style={[styles.subtitle, rtl.text]}>سجّل دخولك لمواصلة الطلب</Text>
          </View>

          <View style={styles.form}>
            <Field
              label="رقم الهاتف"
              placeholder="09xxxxxxxx"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={10}
            />
            <Field
              label="كلمة المرور"
              placeholder="••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
            />

            {error ? <Text style={[styles.error, rtl.text]}>{error}</Text> : null}

            <Button label="تسجيل الدخول" onPress={handleSubmit} loading={submitting} />

            <Pressable onPress={fillDemo} style={styles.demoBox}>
              <Text style={[styles.demoText, rtl.text]}>
                للتجربة السريعة: اضغط هنا لتعبئة حساب تجريبي
              </Text>
            </Pressable>
          </View>

          <View style={[rtl.row, styles.footer]}>
            <Text style={styles.footerText}>ليس لديك حساب؟</Text>
            <Link href="/(auth)/register" style={styles.footerLink}>
              أنشئ حساباً
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.xxl },

  header: { gap: spacing.xs },
  logo: { fontSize: 40, fontWeight: '900', color: colors.primary, textAlign: 'center', marginBottom: spacing.lg },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted },

  form: { gap: spacing.lg },
  error: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radius.sm,
  },

  demoBox: {
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
  demoText: { fontSize: 13, color: colors.primary, fontWeight: '600' },

  footer: { justifyContent: 'center', alignItems: 'center', gap: spacing.xs },
  footerText: { fontSize: 14, color: colors.textMuted },
  footerLink: { fontSize: 14, fontWeight: '800', color: colors.primary },
});
