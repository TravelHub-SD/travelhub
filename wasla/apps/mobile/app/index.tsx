import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { WaslaLogo } from '@/components/WaslaLogo';
import { colors } from '@/theme';

/** بوابة الإقلاع: ننتظر استعادة الجلسة ثم نوجّه للتطبيق أو لتسجيل الدخول */
export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <WaslaLogo
          size={140}
          color="#FFFFFF"
          inkColor="#FFFFFF"
          taglineColor="rgba(255,255,255,0.92)"
        />
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
  },
  spinner: { marginTop: 36 },
});
