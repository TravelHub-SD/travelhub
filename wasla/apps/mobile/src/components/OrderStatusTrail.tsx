import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ApiOrderEvent } from '../api';
import { formatTime } from '../format';
import { font, colors, radius, rtl, spacing } from '../theme';

const FLOW = ['PENDING', 'CONFIRMED', 'PREPARING', 'ON_THE_WAY', 'DELIVERED'] as const;

const STEP_META: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  PENDING: { label: 'استلمنا طلبك', icon: 'receipt-outline' },
  CONFIRMED: { label: 'المتجر أكّد الطلب', icon: 'checkmark-circle-outline' },
  PREPARING: { label: 'جاري التجهيز', icon: 'restaurant-outline' },
  ON_THE_WAY: { label: 'المندوب في الطريق', icon: 'bicycle-outline' },
  DELIVERED: { label: 'تم التوصيل', icon: 'home-outline' },
};

export function OrderStatusTrail({
  status,
  events,
}: {
  status: string;
  events: ApiOrderEvent[];
}) {
  if (status === 'CANCELLED') {
    const cancelledAt = events.find((e) => e.status === 'CANCELLED');
    return (
      <View style={[rtl.row, styles.cancelled]}>
        <Ionicons name="close-circle" size={22} color={colors.danger} />
        <View style={styles.cancelledBody}>
          <Text style={[styles.cancelledTitle, rtl.text]}>تم إلغاء الطلب</Text>
          {cancelledAt ? (
            <Text style={[styles.cancelledTime, rtl.text]}>{formatTime(cancelledAt.createdAt)}</Text>
          ) : null}
        </View>
      </View>
    );
  }

  const currentIndex = FLOW.indexOf(status as (typeof FLOW)[number]);
  const timeByStatus = new Map(events.map((e) => [e.status, e.createdAt]));

  return (
    <View style={styles.trail}>
      {FLOW.map((step, index) => {
        const meta = STEP_META[step];
        const isDone = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const time = timeByStatus.get(step);

        return (
          <View key={step} style={[rtl.row, styles.step]}>
            <View style={styles.markerColumn}>
              <View
                style={[
                  styles.marker,
                  isDone && styles.markerDone,
                  isCurrent && styles.markerCurrent,
                ]}
              >
                <Ionicons
                  name={isDone && !isCurrent ? 'checkmark' : meta.icon}
                  size={15}
                  color={isDone ? '#fff' : colors.textFaint}
                />
              </View>
              {index < FLOW.length - 1 ? (
                <View style={[styles.connector, index < currentIndex && styles.connectorDone]} />
              ) : null}
            </View>

            <View style={styles.stepBody}>
              <Text
                style={[
                  styles.stepLabel,
                  rtl.text,
                  isDone && styles.stepLabelDone,
                  isCurrent && styles.stepLabelCurrent,
                ]}
              >
                {meta.label}
              </Text>
              {time ? <Text style={[styles.stepTime, rtl.text]}>{formatTime(time)}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  trail: { gap: 0 },
  step: { gap: spacing.md },
  markerColumn: { alignItems: 'center', width: 32 },
  marker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerDone: { backgroundColor: colors.success },
  markerCurrent: { backgroundColor: colors.primary },
  connector: { width: 2, flex: 1, minHeight: 26, backgroundColor: colors.border },
  connectorDone: { backgroundColor: colors.success },

  stepBody: { flex: 1, paddingBottom: spacing.lg, paddingTop: 5 },
  stepLabel: { fontSize: 14, lineHeight: 21, fontFamily: font.semibold, color: colors.textFaint },
  stepLabelDone: { color: colors.text },
  stepLabelCurrent: { color: colors.primary, fontFamily: font.extrabold },
  stepTime: { fontFamily: font.regular, fontSize: 12, lineHeight: 18, color: colors.textFaint, marginTop: 2 },

  cancelled: {
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.dangerSoft,
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  cancelledBody: { flex: 1 },
  cancelledTitle: { fontSize: 15, lineHeight: 22, fontFamily: font.extrabold, color: colors.danger },
  cancelledTime: { fontFamily: font.regular, fontSize: 12, lineHeight: 18, color: colors.danger, opacity: 0.8, marginTop: 2 },
});
