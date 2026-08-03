import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api, type ApiStore } from '@/api';
import { ApiError } from '@/api';
import { StoreCard } from '@/components/StoreCard';
import { CartBar } from '@/components/CartBar';
import { EmptyState, Loading } from '@/components/ui';
import { colors, radius, rtl, spacing } from '@/theme';

const SUGGESTIONS = ['شاورما', 'بيتزا', 'فول', 'حلويات', 'صيدلية', 'عصير'];

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiStore[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  // تأخير البحث حتى يتوقف المستخدم عن الكتابة بدل طلب لكل حرف
  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      setResults(null);
      setError('');
      return;
    }

    let cancelled = false;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const { stores } = await api.stores({ q: trimmed });
        if (!cancelled) {
          setResults(stores);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'تعذّر البحث');
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={[rtl.row, styles.searchBar]}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="ابحث عن مطعم، متجر أو منطقة..."
            placeholderTextColor={colors.textFaint}
            style={[styles.input, rtl.text]}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} accessibilityLabel="مسح البحث">
              <Ionicons name="close-circle" size={18} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!query.trim() ? (
          <View style={styles.suggestions}>
            <Text style={[styles.suggestTitle, rtl.text]}>عمليات بحث شائعة</Text>
            <View style={styles.chipWrap}>
              {SUGGESTIONS.map((term) => (
                <Pressable key={term} onPress={() => setQuery(term)} style={styles.chip}>
                  <Text style={styles.chipText}>{term}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : isSearching && !results ? (
          <Loading label="جاري البحث..." />
        ) : error ? (
          <EmptyState icon="alert-circle-outline" title="تعذّر البحث" message={error} />
        ) : results && results.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="لا توجد نتائج"
            message={`لم نجد أي متجر يطابق "${query.trim()}". جرّب كلمة أخرى.`}
          />
        ) : (
          <View style={styles.results}>
            <Text style={[styles.resultCount, rtl.text]}>{results?.length} نتيجة</Text>
            {results?.map((store) => <StoreCard key={store.id} store={store} />)}
          </View>
        )}
      </ScrollView>

      <CartBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgSoft },
  header: { backgroundColor: colors.bg, padding: spacing.lg },
  searchBar: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  input: { flex: 1, fontSize: 14, color: colors.text },

  content: { padding: spacing.lg, paddingBottom: 110 },

  suggestions: { gap: spacing.md },
  suggestTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  chipWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },

  results: { gap: spacing.md },
  resultCount: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.xs },
});
