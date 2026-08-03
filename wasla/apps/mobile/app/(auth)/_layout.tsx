import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Loading } from '@/components/ui';

export default function AuthLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  // مستخدم مسجّل لا يحتاج شاشات الدخول
  if (user) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
