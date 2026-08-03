import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, api } from '@/api';
import { useAsync } from '@/useAsync';
import { formatDate, formatPrice, ORDER_STATUS_LABEL, PAYMENT_LABEL } from '@/format';
import { OrderStatusTrail } from '@/components/OrderStatusTrail';
import { Badge, Button, ErrorState, Loading } from '@/components/ui';
import { font, colors, radius, rtl, shadow, spacing } from '@/theme';

const LIVE_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'ON_THE_WAY']);
const POLL_MS = 6000;

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, error, isLoading, reload } = useAsync(() => api.order(id), [id]);
  const order = data?.order;

  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  // نستعلم دورياً ما دام الطلب نشطاً، ونتوقف فور تسليمه أو إلغائه
  useEffect(() => {
    if (!order || !LIVE_STATUSES.has(order.status)) return;

    const timer = setInterval(() => {
      reload();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [order?.status, reload]);

  if (isLoading && !order) return <Loading />;

  if (error || !order) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ErrorState message={error ?? 'الطلب غير موجود'} onRetry={reload} />
      </SafeAreaView>
    );
  }

  const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED';
  const canReview = order.status === 'DELIVERED' && !order.review;

  function confirmCancel() {
    Alert.alert('إلغاء الطلب', 'هل تريد إلغاء هذا الطلب؟', [
      { text: 'تراجع', style: 'cancel' },
      {
        text: 'إلغاء الطلب',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await api.cancelOrder(id);
            await reload();
          } catch (err) {
            Alert.alert('تعذّر الإلغاء', err instanceof ApiError ? err.message : 'حاول مرة أخرى');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  async function submitReview() {
    if (rating === 0) {
      Alert.alert('التقييم مطلوب', 'اختر عدد النجوم أولاً.');
      return;
    }

    setBusy(true);
    try {
      await api.reviewOrder(id, { rating, comment: comment.trim() });
      await reload();
    } catch (err) {
      Alert.alert('تعذّر إرسال التقييم', err instanceof ApiError ? err.message : 'حاول مرة أخرى');
    } finally {
      setBusy(false);
    }
  }

  /** تسريع المراحل للعرض — يقابل نقطة /advance في السيرفر */
  async function advance() {
    setBusy(true);
    try {
      await api.advanceOrder(id);
      await reload();
    } catch (err) {
      Alert.alert('تعذّر التقديم', err instanceof ApiError ? err.message : 'حاول مرة أخرى');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={[rtl.row, styles.header]}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/orders'))}
          style={styles.headerButton}
          accessibilityLabel="رجوع"
        >
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>طلب {order.code}</Text>
          <Text style={styles.headerSub}>{formatDate(order.createdAt)}</Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statusCard}>
          <View style={[rtl.row, styles.statusTop]}>
            <Image source={{ uri: order.store.logoUrl }} style={styles.logo} contentFit="cover" />
            <View style={styles.flex}>
              <Text style={[styles.storeName, rtl.text]}>{order.store.name}</Text>
              <Badge
                label={ORDER_STATUS_LABEL[order.status] ?? order.status}
                tone={
                  order.status === 'DELIVERED'
                    ? 'success'
                    : order.status === 'CANCELLED'
                      ? 'danger'
                      : 'primary'
                }
              />
            </View>
            {LIVE_STATUSES.has(order.status) ? (
              <View style={styles.etaBox}>
                <Text style={styles.etaValue}>{order.etaMinutes}</Text>
                <Text style={styles.etaLabel}>دقيقة</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.divider} />
          <OrderStatusTrail status={order.status} events={order.events ?? []} />
        </View>

        <View style={styles.card}>
          <Text style={[styles.cardTitle, rtl.text]}>عنوان التوصيل</Text>
          <View style={[rtl.row, styles.addressRow]}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <Text style={[styles.addressText, rtl.text]}>{order.addressSnapshot}</Text>
          </View>
          {order.note ? (
            <View style={[rtl.row, styles.addressRow]}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.noteText, rtl.text]}>{order.note}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={[styles.cardTitle, rtl.text]}>الأصناف</Text>
          {order.items.map((item) => (
            <View key={item.id} style={[rtl.row, styles.itemRow]}>
              <Text style={[styles.itemName, rtl.text]} numberOfLines={1}>
                {item.quantity} × {item.name}
              </Text>
              <Text style={styles.itemPrice}>{formatPrice(item.unitPrice * item.quantity)}</Text>
            </View>
          ))}

          <View style={styles.divider} />
          <View style={[rtl.row, styles.itemRow]}>
            <Text style={styles.summaryLabel}>المجموع الفرعي</Text>
            <Text style={styles.summaryValue}>{formatPrice(order.subtotal)}</Text>
          </View>
          <View style={[rtl.row, styles.itemRow]}>
            <Text style={styles.summaryLabel}>رسوم التوصيل</Text>
            <Text style={styles.summaryValue}>
              {order.deliveryFee === 0 ? 'مجاني' : formatPrice(order.deliveryFee)}
            </Text>
          </View>
          <View style={[rtl.row, styles.itemRow]}>
            <Text style={styles.summaryLabel}>طريقة الدفع</Text>
            <Text style={styles.summaryValue}>{PAYMENT_LABEL[order.paymentMethod]}</Text>
          </View>
          <View style={styles.divider} />
          <View style={[rtl.row, styles.itemRow]}>
            <Text style={styles.totalLabel}>الإجمالي</Text>
            <Text style={styles.totalValue}>{formatPrice(order.total)}</Text>
          </View>
        </View>

        {order.review ? (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, rtl.text]}>تقييمك</Text>
            <View style={[rtl.row, styles.starsRow]}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= order.review!.rating ? 'star' : 'star-outline'}
                  size={22}
                  color={colors.star}
                />
              ))}
            </View>
            {order.review.comment ? (
              <Text style={[styles.reviewComment, rtl.text]}>{order.review.comment}</Text>
            ) : null}
          </View>
        ) : null}

        {canReview ? (
          <View style={styles.card}>
            <Text style={[styles.cardTitle, rtl.text]}>كيف كانت تجربتك؟</Text>
            <View style={[rtl.row, styles.starsRow]}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => setRating(star)}
                  accessibilityLabel={`${star} نجوم`}
                  hitSlop={6}
                >
                  <Ionicons
                    name={star <= rating ? 'star' : 'star-outline'}
                    size={30}
                    color={colors.star}
                  />
                </Pressable>
              ))}
            </View>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="اكتب رأيك (اختياري)"
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={500}
              style={[styles.reviewInput, rtl.text]}
            />
            <Button label="إرسال التقييم" onPress={submitReview} loading={busy} />
          </View>
        ) : null}

        {canCancel ? (
          <Button label="إلغاء الطلب" onPress={confirmCancel} variant="danger" loading={busy} />
        ) : null}

        {LIVE_STATUSES.has(order.status) ? (
          <Pressable onPress={advance} disabled={busy} style={styles.devButton}>
            <Text style={styles.devText}>
              (للعرض) تقديم الطلب للمرحلة التالية — تُحدَّث تلقائياً كل {POLL_MS / 1000} ثوانٍ
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSoft },
  flex: { flex: 1 },

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
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 16, lineHeight: 24, fontFamily: font.extrabold, color: colors.text },
  headerSub: { fontFamily: font.regular, fontSize: 11, lineHeight: 16, color: colors.textFaint, marginTop: 1 },

  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },

  statusCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadow.card,
  },
  statusTop: { alignItems: 'center', gap: spacing.md },
  logo: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.bgSoft },
  storeName: { fontSize: 17, lineHeight: 26, fontFamily: font.extrabold, color: colors.text, marginBottom: spacing.xs },
  etaBox: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  etaValue: { fontSize: 19, lineHeight: 28, fontFamily: font.black, color: colors.primary },
  etaLabel: { fontFamily: font.regular, fontSize: 10, lineHeight: 15, color: colors.primary },

  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { fontSize: 15, lineHeight: 22, fontFamily: font.extrabold, color: colors.text },

  addressRow: { alignItems: 'flex-start', gap: spacing.sm },
  addressText: { fontFamily: font.regular, flex: 1, fontSize: 14, color: colors.textMuted, lineHeight: 21 },
  noteText: { fontFamily: font.regular, flex: 1, fontSize: 13, color: colors.textFaint, lineHeight: 20 },

  itemRow: { justifyContent: 'space-between', gap: spacing.md },
  itemName: { fontFamily: font.regular, flex: 1, fontSize: 14, lineHeight: 21, color: colors.text },
  itemPrice: { fontSize: 14, lineHeight: 21, fontFamily: font.semibold, color: colors.text },
  summaryLabel: { fontFamily: font.regular, flex: 1, fontSize: 13, lineHeight: 20, color: colors.textMuted },
  summaryValue: { fontSize: 13, lineHeight: 20, fontFamily: font.semibold, color: colors.text },
  totalLabel: { flex: 1, fontSize: 16, lineHeight: 24, fontFamily: font.extrabold, color: colors.text },
  totalValue: { fontSize: 18, lineHeight: 27, fontFamily: font.black, color: colors.primary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },

  starsRow: { gap: spacing.sm, justifyContent: 'center' },
  reviewInput: { fontFamily: font.regular,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 72,
    textAlignVertical: 'top',
    fontSize: 14,
    color: colors.text,
  },
  reviewComment: { fontFamily: font.regular, fontSize: 14, color: colors.textMuted, lineHeight: 21 },

  devButton: { padding: spacing.md, alignItems: 'center' },
  devText: { fontFamily: font.regular, fontSize: 11, color: colors.textFaint, textAlign: 'center', lineHeight: 17 },
});
