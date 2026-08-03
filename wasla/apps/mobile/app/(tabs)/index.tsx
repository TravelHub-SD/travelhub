import { useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api';
import { useAsync } from '@/useAsync';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/format';
import { StoreCard } from '@/components/StoreCard';
import { RtlRow } from '@/components/RtlRow';
import { CartBar } from '@/components/CartBar';
import { ErrorState, Loading } from '@/components/ui';
import { colors, radius, rtl, shadow, spacing } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categories = useAsync(() => api.categories(), []);
  const popular = useAsync(() => api.popularItems(), []);
  const stores = useAsync(
    () => api.stores(activeCategory ? { category: activeCategory } : {}),
    [activeCategory]
  );

  const defaultAddress = useAsync(() => api.addresses(), []);
  const address = defaultAddress.data?.addresses.find((a) => a.isDefault);

  const isInitialLoading = categories.isLoading && !categories.data;
  const error = categories.error || stores.error;

  async function reloadAll() {
    await Promise.all([categories.reload(), stores.reload(), popular.reload(), defaultAddress.reload()]);
  }

  if (isInitialLoading) return <Loading />;

  if (error && !stores.data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ErrorState message={error} onRetry={reloadAll} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={stores.isLoading} onRefresh={reloadAll} tintColor={colors.primary} />
        }
      >
        <View style={styles.header}>
          <View style={[rtl.row, styles.headerTop]}>
            <View style={styles.flex}>
              <Text style={[styles.greeting, rtl.text]}>أهلاً {user?.name.split(' ')[0]} 👋</Text>
              <Pressable onPress={() => router.push('/addresses')} style={[rtl.row, styles.addressRow]}>
                <Ionicons name="location" size={14} color={colors.primary} />
                <Text style={styles.addressText} numberOfLines={1}>
                  {address ? `${address.label} — ${address.area}` : 'أضف عنوان التوصيل'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          <Pressable onPress={() => router.push('/(tabs)/search')} style={[rtl.row, styles.searchBar]}>
            <Ionicons name="search" size={18} color={colors.textFaint} />
            <Text style={styles.searchPlaceholder}>ابحث عن مطعم أو متجر...</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, rtl.text]}>التصنيفات</Text>
          <RtlRow contentContainerStyle={styles.categoryRow}>
            <CategoryChip
              label="الكل"
              icon="🏷️"
              active={activeCategory === null}
              onPress={() => setActiveCategory(null)}
            />
            {categories.data?.categories.map((category) => (
              <CategoryChip
                key={category.id}
                label={category.name}
                icon={category.icon}
                active={activeCategory === category.slug}
                onPress={() => setActiveCategory(category.slug)}
              />
            ))}
          </RtlRow>
        </View>

        {popular.data && popular.data.items.length > 0 && activeCategory === null ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, rtl.text]}>الأكثر طلباً</Text>
            <RtlRow contentContainerStyle={styles.popularRow}>
              {popular.data.items.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/store/${item.storeSlug}`)}
                  style={styles.popularCard}
                >
                  <Image
                    source={{ uri: item.imageUrl || undefined }}
                    style={styles.popularImage}
                    contentFit="cover"
                    transition={200}
                  />
                  <View style={styles.popularBody}>
                    <Text style={[styles.popularName, rtl.text]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.popularStore, rtl.text]} numberOfLines={1}>
                      {item.storeName}
                    </Text>
                    <Text style={[styles.popularPrice, rtl.text]}>{formatPrice(item.price)}</Text>
                  </View>
                </Pressable>
              ))}
            </RtlRow>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, rtl.text]}>
            {activeCategory
              ? categories.data?.categories.find((c) => c.slug === activeCategory)?.name
              : 'كل المتاجر'}
          </Text>

          <View style={styles.storeList}>
            {stores.data?.stores.length === 0 ? (
              <Text style={[styles.noStores, rtl.text]}>لا توجد متاجر في هذا التصنيف حالياً</Text>
            ) : (
              stores.data?.stores.map((store) => <StoreCard key={store.id} store={store} />)
            )}
          </View>
        </View>
      </ScrollView>

      <CartBar bottomOffset={0} />
    </SafeAreaView>
  );
}

function CategoryChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.categoryChip, active && styles.categoryChipActive]}>
      <Text style={styles.categoryIcon}>{icon}</Text>
      <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSoft },
  flex: { flex: 1 },
  content: { paddingBottom: 110 },

  header: { backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.md },
  headerTop: { alignItems: 'center' },
  greeting: { fontSize: 20, fontWeight: '800', color: colors.text },
  addressRow: { alignItems: 'center', gap: 4, marginTop: 2 },
  addressText: { fontSize: 13, color: colors.textMuted, flexShrink: 1 },

  searchBar: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  searchPlaceholder: { fontSize: 14, color: colors.textFaint },

  section: { marginTop: spacing.xl, gap: spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.text, paddingHorizontal: spacing.lg },

  categoryRow: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  categoryChip: {
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minWidth: 84,
  },
  categoryChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  categoryIcon: { fontSize: 22 },
  categoryLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  categoryLabelActive: { color: colors.primary },

  popularRow: { paddingHorizontal: spacing.lg, gap: spacing.md },
  popularCard: {
    width: 148,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  popularImage: { width: '100%', height: 88, backgroundColor: colors.bgSoft },
  popularBody: { padding: spacing.md, gap: 2 },
  popularName: { fontSize: 14, fontWeight: '700', color: colors.text },
  popularStore: { fontSize: 11, color: colors.textFaint },
  popularPrice: { fontSize: 13, fontWeight: '800', color: colors.primary, marginTop: 2 },

  storeList: { paddingHorizontal: spacing.lg, gap: spacing.md },
  noStores: { fontSize: 14, color: colors.textMuted, paddingVertical: spacing.xl, textAlign: 'center' },
});
