import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, api } from '@/api';
import { useAsync } from '@/useAsync';
import { useCart } from '@/context/CartContext';
import { formatPrice, PAYMENT_LABEL } from '@/format';
import { Button, Loading } from '@/components/ui';
import { colors, radius, rtl, shadow, spacing } from '@/theme';

const PAYMENT_METHODS = [
  { value: 'CASH', icon: 'cash-outline' as const },
  { value: 'CARD', icon: 'card-outline' as const },
  { value: 'WALLET', icon: 'wallet-outline' as const },
];

export default function CheckoutScreen() {
  const router = useRouter();
  const { cart, subtotal, clear } = useCart();

  const addresses = useAsync(() => api.addresses(), []);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // نختار العنوان الافتراضي تلقائياً بمجرد وصول القائمة
  useEffect(() => {
    if (addressId || !addresses.data) return;
    const list = addresses.data.addresses;
    const preferred = list.find((a) => a.isDefault) ?? list[0];
    if (preferred) setAddressId(preferred.id);
  }, [addresses.data, addressId]);

  if (!cart) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>سلتك فارغة</Text>
          <Button label="العودة للرئيسية" onPress={() => router.replace('/(tabs)')} />
        </View>
      </SafeAreaView>
    );
  }

  const deliveryFee = cart.deliveryFee;
  const total = subtotal + deliveryFee;

  async function handleSubmit() {
    if (!cart) return;
    if (!addressId) {
      setError('اختر عنوان التوصيل أولاً');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const { order } = await api.createOrder({
        storeSlug: cart.storeSlug,
        addressId,
        paymentMethod,
        note: note.trim(),
        items: cart.lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })),
      });

      // السلة تُفرَّغ فقط بعد نجاح إنشاء الطلب على السيرفر
      clear();
      router.replace(`/order/${order.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر إتمام الطلب، حاول مرة أخرى');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={[rtl.row, styles.header]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} accessibilityLabel="رجوع">
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>تأكيد الطلب</Text>
        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <View style={[rtl.row, styles.sectionHeader]}>
              <Text style={[styles.sectionTitle, rtl.text]}>عنوان التوصيل</Text>
              <Pressable onPress={() => router.push('/addresses')}>
                <Text style={styles.link}>إدارة العناوين</Text>
              </Pressable>
            </View>

            {addresses.isLoading && !addresses.data ? (
              <Loading label="جاري تحميل العناوين..." />
            ) : addresses.data?.addresses.length === 0 ? (
              <Pressable onPress={() => router.push('/addresses')} style={styles.addAddress}>
                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.addAddressText}>أضف عنوان توصيل</Text>
              </Pressable>
            ) : (
              <View style={styles.optionList}>
                {addresses.data?.addresses.map((address) => (
                  <Pressable
                    key={address.id}
                    onPress={() => setAddressId(address.id)}
                    style={[rtl.row, styles.option, addressId === address.id && styles.optionActive]}
                  >
                    <Ionicons
                      name={addressId === address.id ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={addressId === address.id ? colors.primary : colors.textFaint}
                    />
                    <View style={styles.flex}>
                      <Text style={[styles.optionTitle, rtl.text]}>{address.label}</Text>
                      <Text style={[styles.optionHint, rtl.text]}>
                        {address.area}، {address.city} — {address.details}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, rtl.text]}>طريقة الدفع</Text>
            <View style={styles.optionList}>
              {PAYMENT_METHODS.map((method) => (
                <Pressable
                  key={method.value}
                  onPress={() => setPaymentMethod(method.value)}
                  style={[rtl.row, styles.option, paymentMethod === method.value && styles.optionActive]}
                >
                  <Ionicons
                    name={paymentMethod === method.value ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={paymentMethod === method.value ? colors.primary : colors.textFaint}
                  />
                  <Ionicons name={method.icon} size={19} color={colors.textMuted} />
                  <Text style={[styles.optionTitle, rtl.text, styles.flex]}>
                    {PAYMENT_LABEL[method.value]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, rtl.text]}>ملاحظات للمندوب (اختياري)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="مثال: اتصل عند الوصول، الباب الأزرق"
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={300}
              style={[styles.noteInput, rtl.text]}
            />
          </View>

          <View style={styles.summary}>
            <Text style={[styles.sectionTitle, rtl.text]}>ملخص الطلب</Text>

            {cart.lines.map((line) => (
              <View key={line.menuItemId} style={[rtl.row, styles.summaryRow]}>
                <Text style={styles.summaryLabel} numberOfLines={1}>
                  {line.quantity} × {line.name}
                </Text>
                <Text style={styles.summaryValue}>{formatPrice(line.price * line.quantity)}</Text>
              </View>
            ))}

            <View style={styles.divider} />
            <View style={[rtl.row, styles.summaryRow]}>
              <Text style={styles.summaryLabel}>المجموع الفرعي</Text>
              <Text style={styles.summaryValue}>{formatPrice(subtotal)}</Text>
            </View>
            <View style={[rtl.row, styles.summaryRow]}>
              <Text style={styles.summaryLabel}>رسوم التوصيل</Text>
              <Text style={styles.summaryValue}>
                {deliveryFee === 0 ? 'مجاني' : formatPrice(deliveryFee)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={[rtl.row, styles.summaryRow]}>
              <Text style={styles.totalLabel}>الإجمالي</Text>
              <Text style={styles.totalValue}>{formatPrice(total)}</Text>
            </View>
          </View>

          {error ? <Text style={[styles.error, rtl.text]}>{error}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            label={`تأكيد الطلب · ${formatPrice(total)}`}
            onPress={handleSubmit}
            loading={submitting}
            disabled={!addressId}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSoft },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  emptyText: { fontSize: 16, color: colors.textMuted },

  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerButton: { width: 40 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },

  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xl },

  section: { gap: spacing.md },
  sectionHeader: { alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  link: { fontSize: 13, fontWeight: '700', color: colors.primary },

  optionList: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  option: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionActive: { backgroundColor: colors.primarySoft },
  optionTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  optionHint: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 18 },

  addAddress: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
  },
  addAddressText: { fontSize: 15, fontWeight: '700', color: colors.primary },

  noteInput: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 84,
    textAlignVertical: 'top',
    fontSize: 14,
    color: colors.text,
  },

  summary: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  summaryRow: { justifyContent: 'space-between', gap: spacing.md },
  summaryLabel: { flex: 1, fontSize: 14, color: colors.textMuted },
  summaryValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.xs },
  totalLabel: { fontSize: 16, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '900', color: colors.primary },

  error: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radius.sm,
  },

  footer: {
    padding: spacing.lg,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...shadow.raised,
  },
});
