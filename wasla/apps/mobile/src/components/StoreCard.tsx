import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import type { ApiStore } from '../api';
import { formatPrice } from '../format';
import { colors, radius, rtl, shadow, spacing } from '../theme';
import { Rating } from './ui';

export function StoreCard({ store }: { store: ApiStore }) {
  return (
    <Link href={`/store/${store.slug}`} asChild>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <View>
          <Image source={{ uri: store.imageUrl }} style={styles.image} contentFit="cover" transition={200} />
          {!store.isOpen ? (
            <View style={styles.closedOverlay}>
              <Text style={styles.closedLabel}>مغلق حالياً</Text>
            </View>
          ) : null}
          <View style={styles.etaChip}>
            <Ionicons name="time-outline" size={12} color={colors.text} />
            <Text style={styles.etaText}>{store.etaMinutes} د</Text>
          </View>
        </View>

        <View style={styles.body}>
          <View style={[rtl.row, styles.titleRow]}>
            <Text style={[styles.name, rtl.text]} numberOfLines={1}>
              {store.name}
            </Text>
            <Rating value={store.rating} count={store.ratingCount} />
          </View>

          <Text style={[styles.description, rtl.text]} numberOfLines={1}>
            {store.description}
          </Text>

          <View style={[rtl.row, styles.metaRow]}>
            <View style={[rtl.row, styles.meta]}>
              <Ionicons name="location-outline" size={13} color={colors.textFaint} />
              <Text style={styles.metaText}>{store.area}</Text>
            </View>
            <View style={[rtl.row, styles.meta]}>
              <Ionicons name="bicycle-outline" size={13} color={colors.textFaint} />
              <Text style={styles.metaText}>
                {store.deliveryFee === 0 ? 'توصيل مجاني' : formatPrice(store.deliveryFee)}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  pressed: { opacity: 0.9 },
  image: { width: '100%', height: 132, backgroundColor: colors.bgSoft },
  closedOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(20,24,31,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closedLabel: { color: '#fff', fontWeight: '800', fontSize: 14 },
  etaChip: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  etaText: { fontSize: 12, fontWeight: '700', color: colors.text },

  body: { padding: spacing.md, gap: 5 },
  titleRow: { alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  description: { fontSize: 13, color: colors.textMuted },
  metaRow: { alignItems: 'center', gap: spacing.lg, marginTop: 2 },
  meta: { alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: colors.textFaint },
});
