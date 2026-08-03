import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, type ApiMenuItem, type ApiStoreDetail } from '@/api';
import { useAsync } from '@/useAsync';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/format';
import { CartBar } from '@/components/CartBar';
import { Badge, ErrorState, Loading, Rating } from '@/components/ui';
import { font, colors, radius, rtl, spacing } from '@/theme';

export default function StoreScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { addItem, replaceCartWith, cart } = useCart();

  const { data, error, isLoading, reload } = useAsync(() => api.store(slug), [slug]);

  if (isLoading && !data) return <Loading />;
  if (error || !data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ErrorState message={error ?? 'المتجر غير موجود'} onRetry={reload} />
      </SafeAreaView>
    );
  }

  const store = data.store;

  function handleAdd(item: ApiMenuItem, store: ApiStoreDetail) {
    if (!store.isOpen) {
      Alert.alert('المتجر مغلق', 'لا يمكن الطلب من هذا المتجر حالياً.');
      return;
    }

    const storeRef = {
      slug: store.slug,
      name: store.name,
      deliveryFee: store.deliveryFee,
      minOrder: store.minOrder,
    };

    const result = addItem(storeRef, item);
    if (result.ok) return;

    // السلة تخص متجراً آخر — نطلب تأكيد الاستبدال بدل حذفها بصمت
    Alert.alert(
      'سلة من متجر آخر',
      `سلتك الحالية من "${result.conflictWith}". هل تريد إفراغها والبدء من "${store.name}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'ابدأ سلة جديدة',
          style: 'destructive',
          onPress: () => replaceCartWith(storeRef, item),
        },
      ]
    );
  }

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Image source={{ uri: store.imageUrl }} style={styles.hero} contentFit="cover" transition={220} />
          <SafeAreaView edges={['top']} style={styles.heroOverlay}>
            <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityLabel="رجوع">
              <Ionicons name="arrow-forward" size={20} color={colors.text} />
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={styles.headerCard}>
          <View style={[rtl.row, styles.headerTop]}>
            <Image source={{ uri: store.logoUrl }} style={styles.logo} contentFit="cover" />
            <View style={styles.flex}>
              <Text style={[styles.name, rtl.text]}>{store.name}</Text>
              <Text style={[styles.description, rtl.text]}>{store.description}</Text>
            </View>
          </View>

          <View style={[rtl.row, styles.statsRow]}>
            <Stat icon="star" label={`${store.rating.toFixed(1)}`} hint={`${store.ratingCount} تقييم`} />
            <Stat icon="time-outline" label={`${store.etaMinutes} د`} hint="وقت التوصيل" />
            <Stat
              icon="bicycle-outline"
              label={store.deliveryFee === 0 ? 'مجاني' : formatPrice(store.deliveryFee)}
              hint="رسوم التوصيل"
            />
          </View>

          <View style={[rtl.row, styles.badgeRow]}>
            <Badge label={store.isOpen ? 'مفتوح الآن' : 'مغلق'} tone={store.isOpen ? 'success' : 'danger'} />
            {store.minOrder > 0 ? (
              <Badge label={`أقل طلب ${formatPrice(store.minOrder)}`} tone="neutral" />
            ) : null}
            <Badge label={store.area} tone="neutral" />
          </View>
        </View>

        {store.sections.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={[styles.sectionTitle, rtl.text]}>{section.name}</Text>

            <View style={styles.itemList}>
              {section.items.map((item) => {
                const inCart = cart?.lines.find((l) => l.menuItemId === item.id);

                return (
                  <Pressable
                    key={item.id}
                    onPress={() => handleAdd(item, store)}
                    style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                  >
                    <View style={[rtl.row, styles.itemInner]}>
                      <View style={styles.itemBody}>
                        <View style={[rtl.row, styles.itemTitleRow]}>
                          <Text style={[styles.itemName, rtl.text]}>{item.name}</Text>
                          {item.isPopular ? <Badge label="الأكثر طلباً" tone="warning" /> : null}
                        </View>
                        {item.description ? (
                          <Text style={[styles.itemDescription, rtl.text]} numberOfLines={2}>
                            {item.description}
                          </Text>
                        ) : null}
                        <Text style={[styles.itemPrice, rtl.text]}>{formatPrice(item.price)}</Text>
                      </View>

                      <View style={styles.addButton}>
                        {inCart ? (
                          <View style={styles.inCartBubble}>
                            <Text style={styles.inCartText}>{inCart.quantity}</Text>
                          </View>
                        ) : (
                          <Ionicons name="add" size={20} color={colors.primary} />
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <CartBar />
    </View>
  );
}

function Stat({
  icon,
  label,
  hint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statHint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSoft },
  flex: { flex: 1 },
  content: { paddingBottom: 110 },

  hero: { width: '100%', height: 200, backgroundColor: colors.bgSoft },
  heroOverlay: { position: 'absolute', top: 0, right: 0, left: 0 },
  backButton: {
    alignSelf: 'flex-end',
    margin: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerCard: {
    backgroundColor: colors.bg,
    marginTop: -spacing.xl,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  headerTop: { gap: spacing.md, alignItems: 'center' },
  logo: { width: 58, height: 58, borderRadius: radius.md, backgroundColor: colors.bgSoft },
  name: { fontSize: 21, lineHeight: 32, fontFamily: font.black, color: colors.text },
  description: { fontFamily: font.regular, fontSize: 13, lineHeight: 20, color: colors.textMuted, marginTop: 2 },

  statsRow: {
    justifyContent: 'space-around',
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  stat: { alignItems: 'center', gap: 2 },
  statLabel: { fontSize: 14, lineHeight: 21, fontFamily: font.extrabold, color: colors.text },
  statHint: { fontFamily: font.regular, fontSize: 11, lineHeight: 16, color: colors.textFaint },

  badgeRow: { gap: spacing.sm, flexWrap: 'wrap' },

  section: { marginTop: spacing.lg, gap: spacing.md },
  sectionTitle: { fontSize: 17, lineHeight: 26, fontFamily: font.extrabold, color: colors.text, paddingHorizontal: spacing.lg },
  itemList: { paddingHorizontal: spacing.lg, gap: spacing.sm },

  item: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  itemPressed: { backgroundColor: colors.primarySoft },
  itemInner: { alignItems: 'center', gap: spacing.md },
  itemBody: { flex: 1, gap: 3 },
  itemTitleRow: { alignItems: 'center', gap: spacing.sm },
  itemName: { fontSize: 15, lineHeight: 22, fontFamily: font.bold, color: colors.text },
  itemDescription: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  itemPrice: { fontSize: 14, lineHeight: 21, fontFamily: font.extrabold, color: colors.primary, marginTop: 2 },

  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inCartBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inCartText: { color: '#fff', fontFamily: font.extrabold, fontSize: 14, lineHeight: 21 },
});
