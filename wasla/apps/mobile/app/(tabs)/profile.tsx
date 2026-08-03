import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '@/api';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { font, colors, radius, rtl, spacing } from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { clear } = useCart();

  function confirmLogout() {
    Alert.alert('تسجيل الخروج', 'هل تريد الخروج من حسابك؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: async () => {
          clear();
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name.charAt(0) ?? '؟'}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.phone}>{user?.phone}</Text>
          {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}
        </View>

        <View style={styles.group}>
          <MenuRow
            icon="location-outline"
            label="عناويني"
            hint="إدارة عناوين التوصيل"
            onPress={() => router.push('/addresses')}
          />
          <MenuRow
            icon="receipt-outline"
            label="طلباتي"
            hint="سجل الطلبات السابقة"
            onPress={() => router.push('/(tabs)/orders')}
          />
        </View>

        <View style={styles.group}>
          <MenuRow icon="help-circle-outline" label="المساعدة والدعم" hint="نجيب على أسئلتك" onPress={showSoon} />
          <MenuRow icon="document-text-outline" label="الشروط والأحكام" onPress={showSoon} />
          <MenuRow icon="information-circle-outline" label="عن وصلة" hint="الإصدار 1.0.0" onPress={showSoon} />
        </View>

        <Pressable onPress={confirmLogout} style={[rtl.row, styles.logout]}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </Pressable>

        <Text style={styles.debug}>السيرفر: {API_BASE_URL}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function showSoon() {
  Alert.alert('قريباً', 'هذه الميزة قيد التطوير.');
}

function MenuRow({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && styles.menuPressed]}>
      <View style={[rtl.row, styles.menuInner]}>
        <View style={styles.menuIcon}>
          <Ionicons name={icon} size={19} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.menuLabel, rtl.text]}>{label}</Text>
          {hint ? <Text style={[styles.menuHint, rtl.text]}>{hint}</Text> : null}
        </View>
        <Ionicons name="chevron-back" size={18} color={colors.textFaint} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSoft },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },

  headerCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 3,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: { fontSize: 30, lineHeight: 45, fontFamily: font.black, color: colors.primary },
  name: { fontSize: 19, lineHeight: 28, fontFamily: font.extrabold, color: colors.text },
  phone: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: colors.textMuted },
  email: { fontFamily: font.regular, fontSize: 13, lineHeight: 20, color: colors.textFaint },

  group: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  menuPressed: { backgroundColor: colors.bgSoft },
  menuInner: { alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { fontSize: 15, lineHeight: 22, fontFamily: font.bold, color: colors.text },
  menuHint: { fontFamily: font.regular, fontSize: 12, lineHeight: 18, color: colors.textFaint, marginTop: 1 },

  logout: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
  },
  logoutText: { fontSize: 15, lineHeight: 22, fontFamily: font.extrabold, color: colors.danger },

  debug: { fontFamily: font.regular, fontSize: 11, lineHeight: 16, color: colors.textFaint, textAlign: 'center' },
});
