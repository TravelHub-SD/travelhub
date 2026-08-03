import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { font, colors } from '@/theme';

/** بوابة الإقلاع: ننتظر استعادة الجلسة ثم نوجّه للتطبيق أو لتسجيل الدخول */
export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.logo}>وصلة</Text>
        <Text style={styles.tagline}>طلبك يوصلك بسرعة</Text>
        <ActivityIndicator color="#fff" style={styles.spinner} />
      </View>
    );
  }

  return <Redirect href={user ? '/(tabs)' : '/(auth)/login'} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  logo: { fontSize: 46, lineHeight: 69, fontFamily: font.black, color: '#fff', letterSpacing: 1 },
  tagline: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.9)' },
  spinner: { marginTop: 28 },
});
