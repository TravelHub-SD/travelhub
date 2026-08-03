import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../format';
import { colors, radius, rtl, shadow, spacing } from '../theme';

/** شريط عائم يظهر فوق التبويبات كلما كانت السلة غير فارغة */
export function CartBar({ bottomOffset = 0 }: { bottomOffset?: number }) {
  const router = useRouter();
  const { cart, itemCount, subtotal } = useCart();

  if (!cart || itemCount === 0) return null;

  return (
    <Pressable
      onPress={() => router.push('/cart')}
      accessibilityRole="button"
      accessibilityLabel="عرض السلة"
      style={({ pressed }) => [styles.bar, { bottom: bottomOffset + spacing.lg }, pressed && styles.pressed]}
    >
      <View style={[rtl.row, styles.inner]}>
        <View style={[rtl.row, styles.left]}>
          <View style={styles.countBubble}>
            <Text style={styles.countText}>{itemCount}</Text>
          </View>
          <View>
            <Text style={styles.title}>عرض السلة</Text>
            <Text style={styles.store} numberOfLines={1}>
              {cart.storeName}
            </Text>
          </View>
        </View>

        <View style={[rtl.row, styles.right]}>
          <Text style={styles.total}>{formatPrice(subtotal)}</Text>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadow.raised,
  },
  pressed: { opacity: 0.92 },
  inner: { alignItems: 'center', justifyContent: 'space-between' },
  left: { alignItems: 'center', gap: spacing.md, flex: 1 },
  countBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  title: { color: '#fff', fontWeight: '800', fontSize: 15 },
  store: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  right: { alignItems: 'center', gap: spacing.xs },
  total: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
