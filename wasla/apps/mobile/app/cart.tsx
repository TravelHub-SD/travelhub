import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/format';
import { Button, EmptyState, Stepper } from '@/components/ui';
import { colors, radius, rtl, shadow, spacing } from '@/theme';

export default function CartScreen() {
  const router = useRouter();
  const { cart, subtotal, itemCount, setQuantity, clear } = useCart();

  const deliveryFee = cart?.deliveryFee ?? 0;
  const total = subtotal + deliveryFee;
  const minOrder = cart?.minOrder ?? 0;
  const belowMin = subtotal < minOrder;

  function confirmClear() {
    Alert.alert('إفراغ السلة', 'سيتم حذف كل الأصناف من السلة.', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إفراغ', style: 'destructive', onPress: clear },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={[rtl.row, styles.header]}>
        <Pressable onPress={() => router.back()} accessibilityLabel="إغلاق" style={styles.headerButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>السلة</Text>
        {cart ? (
          <Pressable onPress={confirmClear} accessibilityLabel="إفراغ السلة" style={styles.headerButton}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
      </View>

      {!cart || itemCount === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="سلتك فارغة"
          message="أضف أصنافاً من أي متجر وستظهر هنا."
          action={<Button label="تصفّح المتاجر" onPress={() => router.replace('/(tabs)')} />}
        />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={[rtl.row, styles.storeBanner]}>
              <Ionicons name="storefront-outline" size={18} color={colors.primary} />
              <Text style={[styles.storeName, rtl.text]}>{cart.storeName}</Text>
            </View>

            <View style={styles.lines}>
              {cart.lines.map((line) => (
                <View key={line.menuItemId} style={[rtl.row, styles.line]}>
                  <View style={styles.lineBody}>
                    <Text style={[styles.lineName, rtl.text]}>{line.name}</Text>
                    <Text style={[styles.linePrice, rtl.text]}>{formatPrice(line.price)} للحبة</Text>
                  </View>

                  <View style={styles.lineActions}>
                    <Stepper value={line.quantity} onChange={(q) => setQuantity(line.menuItemId, q)} />
                    <Text style={styles.lineTotal}>{formatPrice(line.price * line.quantity)}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.summary}>
              <SummaryRow label="المجموع الفرعي" value={formatPrice(subtotal)} />
              <SummaryRow
                label="رسوم التوصيل"
                value={deliveryFee === 0 ? 'مجاني' : formatPrice(deliveryFee)}
              />
              <View style={styles.divider} />
              <SummaryRow label="الإجمالي" value={formatPrice(total)} emphasis />
            </View>

            {belowMin ? (
              <View style={[rtl.row, styles.warning]}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
                <Text style={[styles.warningText, rtl.text]}>
                  الحد الأدنى للطلب {formatPrice(minOrder)} — أضف بقيمة {formatPrice(minOrder - subtotal)} للمتابعة
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              label={`متابعة الطلب · ${formatPrice(total)}`}
              onPress={() => router.push('/checkout')}
              disabled={belowMin}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <View style={[rtl.row, styles.summaryRow]}>
      <Text style={[styles.summaryLabel, emphasis && styles.summaryLabelStrong]}>{label}</Text>
      <Text style={[styles.summaryValue, emphasis && styles.summaryValueStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSoft },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerButton: { width: 40, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },

  content: { padding: spacing.lg, gap: spacing.lg },

  storeBanner: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  storeName: { fontSize: 14, fontWeight: '800', color: colors.primary },

  lines: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  line: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lineBody: { flex: 1, gap: 2 },
  lineName: { fontSize: 15, fontWeight: '700', color: colors.text },
  linePrice: { fontSize: 12, color: colors.textFaint },
  lineActions: { alignItems: 'center', gap: spacing.sm },
  lineTotal: { fontSize: 13, fontWeight: '800', color: colors.text },

  summary: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryRow: { justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14, color: colors.textMuted },
  summaryLabelStrong: { fontSize: 16, fontWeight: '800', color: colors.text },
  summaryValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  summaryValueStrong: { fontSize: 17, fontWeight: '900', color: colors.primary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.xs },

  warning: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#FEF6E7',
    padding: spacing.md,
    borderRadius: radius.md,
  },
  warningText: { flex: 1, fontSize: 13, color: '#8A6100', lineHeight: 20 },

  footer: {
    padding: spacing.lg,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...shadow.raised,
  },
});
