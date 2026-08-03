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
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@/api';
import { useAuth } from '@/context/AuthContext';
import { Button, Field } from '@/components/ui';
import { font, colors, radius, rtl, spacing } from '@/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError('');

    if (name.trim().length < 2) return setError('أدخل اسمك الكامل');
    if (!/^0[019]\d{8}$/.test(phone.trim())) return setError('رقم الهاتف غير صحيح (مثال: 0912345678)');
    if (password.length < 6) return setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');

    setSubmitting(true);
    try {
      await register({
        name: name.trim(),
        phone: phone.trim(),
        password,
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إنشاء الحساب، حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.back} accessibilityLabel="رجوع">
            <Ionicons name="arrow-forward" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.header}>
            <Text style={[styles.title, rtl.text]}>إنشاء حساب جديد</Text>
            <Text style={[styles.subtitle, rtl.text]}>خطوة واحدة وتبدأ الطلب</Text>
          </View>

          <View style={styles.form}>
            <Field label="الاسم الكامل" placeholder="مثال: محمد أحمد" value={name} onChangeText={setName} />
            <Field
              label="رقم الهاتف"
              placeholder="09xxxxxxxx"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={10}
            />
            <Field
              label="البريد الإلكتروني (اختياري)"
              placeholder="name@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="كلمة المرور"
              placeholder="6 أحرف على الأقل"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            {error ? <Text style={[styles.error, rtl.text]}>{error}</Text> : null}

            <Button label="إنشاء الحساب" onPress={handleSubmit} loading={submitting} />
          </View>

          <View style={[rtl.row, styles.footer]}>
            <Text style={styles.footerText}>لديك حساب بالفعل؟</Text>
            <Link href="/(auth)/login" style={styles.footerLink}>
              سجّل الدخول
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
  content: { flexGrow: 1, padding: spacing.xl, gap: spacing.xl },

  back: { alignSelf: 'flex-end', padding: spacing.xs },
  header: { gap: spacing.xs },
  title: { fontSize: 24, lineHeight: 36, fontFamily: font.extrabold, color: colors.text },
  subtitle: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: colors.textMuted },

  form: { gap: spacing.lg },
  error: { fontFamily: font.regular,
    fontSize: 13, lineHeight: 20,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radius.sm,
  },

  footer: { justifyContent: 'center', alignItems: 'center', gap: spacing.xs, marginTop: 'auto' },
  footerText: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: colors.textMuted },
  footerLink: { fontSize: 14, lineHeight: 21, fontFamily: font.extrabold, color: colors.primary },
});
