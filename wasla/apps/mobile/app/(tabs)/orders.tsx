import { useCallback } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api';
import { useAsync } from '@/useAsync';
import { formatDate, formatPrice, ORDER_STATUS_LABEL } from '@/format';
import { Badge, Button, EmptyState, ErrorState, Loading } from '@/components/ui';
import { font, colors, radius, rtl, spacing } from '@/theme';

const ACTIVE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'ON_THE_WAY']);

function toneFor(status: string) {
  if (status === 'DELIVERED') return 'success' as const;
  if (status === 'CANCELLED') return 'danger' as const;
  return 'primary' as const;
}

export default function OrdersScreen() {
  const router = useRouter();
  const { data, error, isLoading, reload } = useAsync(() => api.orders(), []);

  // نحدّث القائمة كلما عاد المستخدم للتبويب حتى تظهر الطلبات الجديدة وحالتها
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  if (isLoading && !data) return <Loading />;

  if (error && !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ErrorState message={error} onRetry={reload} />
      </SafeAreaView>
    );
  }

  const orders = data?.orders ?? [];
  const active = orders.filter((o) => ACTIVE_STATUSES.has(o.status));
  const past = orders.filter((o) => !ACTIVE_STATUSES.has(o.status));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, rtl.text]}>طلباتي</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={reload} tintColor={colors.primary} />
        }
      >
        {orders.length === 0 ? (
          <EmptyState
            icon="receipt-outline"
            title="لا توجد طلبات بعد"
            message="عندما تطلب شيئاً سيظهر هنا حتى تتابع حالته."
            action={<Button label="تصفّح المتاجر" onPress={() => router.push('/(tabs)')} />}
          />
        ) : (
          <>
            {active.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, rtl.text]}>طلبات جارية</Text>
                {active.map((order) => (
                  <OrderRow key={order.id} order={order} onPress={() => router.push(`/order/${order.id}`)} />
                ))}
              </View>
            ) : null}

            {past.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, rtl.text]}>طلبات سابقة</Text>
                {past.map((order) => (
                  <OrderRow key={order.id} order={order} onPress={() => router.push(`/order/${order.id}`)} />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderRow({
  order,
  onPress,
}: {
  order: {
    id: string;
    code: string;
    status: string;
    total: number;
    createdAt: string;
    store: { name: string; logoUrl: string };
    items: { quantity: number }[];
  };
  onPress: () => void;
}) {
  const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={[rtl.row, styles.rowInner]}>
        <Image source={{ uri: order.store.logoUrl }} style={styles.logo} contentFit="cover" />

        <View style={styles.rowBody}>
          <View style={[rtl.row, styles.rowTop]}>
            <Text style={[styles.storeName, rtl.text]} numberOfLines={1}>
              {order.store.name}
            </Text>
            <Badge label={ORDER_STATUS_LABEL[order.status] ?? order.status} tone={toneFor(order.status)} />
          </View>

          <Text style={[styles.meta, rtl.text]}>
            {order.code} · {itemCount} صنف · {formatPrice(order.total)}
          </Text>
          <Text style={[styles.date, rtl.text]}>{formatDate(order.createdAt)}</Text>
        </View>

        <Ionicons name="chevron-back" size={18} color={colors.textFaint} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSoft },
  header: { backgroundColor: colors.bg, padding: spacing.lg },
  title: { fontSize: 22, lineHeight: 33, fontFamily: font.extrabold, color: colors.text },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },

  section: { gap: spacing.md },
  sectionTitle: { fontSize: 15, lineHeight: 22, fontFamily: font.extrabold, color: colors.textMuted },

  row: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowPressed: { opacity: 0.9 },
  rowInner: { alignItems: 'center', gap: spacing.md },
  logo: { width: 50, height: 50, borderRadius: radius.md, backgroundColor: colors.bgSoft },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  storeName: { flex: 1, fontSize: 15, lineHeight: 22, fontFamily: font.extrabold, color: colors.text },
  meta: { fontFamily: font.regular, fontSize: 12, lineHeight: 18, color: colors.textMuted },
  date: { fontFamily: font.regular, fontSize: 11, lineHeight: 16, color: colors.textFaint },
});
