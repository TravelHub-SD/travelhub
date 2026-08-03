import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, api } from '@/api';
import { useAsync } from '@/useAsync';
import { Badge, Button, EmptyState, ErrorState, Field, Loading } from '@/components/ui';
import { colors, radius, rtl, spacing } from '@/theme';

export default function AddressesScreen() {
  const router = useRouter();
  const { data, error, isLoading, reload } = useAsync(() => api.addresses(), []);

  const [isAdding, setIsAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('الخرطوم');
  const [details, setDetails] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function resetForm() {
    setLabel('');
    setArea('');
    setCity('الخرطوم');
    setDetails('');
    setFormError('');
    setIsAdding(false);
  }

  async function handleCreate() {
    if (!label.trim()) return setFormError('أدخل اسماً للعنوان (مثل: البيت)');
    if (!area.trim()) return setFormError('أدخل المنطقة أو الحي');
    if (!details.trim()) return setFormError('أدخل تفاصيل العنوان');

    setSubmitting(true);
    setFormError('');
    try {
      await api.createAddress({
        label: label.trim(),
        area: area.trim(),
        city: city.trim() || 'الخرطوم',
        details: details.trim(),
      });
      resetForm();
      await reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'تعذّر حفظ العنوان');
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDelete(id: string, name: string) {
    Alert.alert('حذف العنوان', `سيتم حذف "${name}".`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAddress(id);
            await reload();
          } catch (err) {
            Alert.alert('تعذّر الحذف', err instanceof ApiError ? err.message : 'حاول مرة أخرى');
          }
        },
      },
    ]);
  }

  async function makeDefault(id: string) {
    try {
      await api.setDefaultAddress(id);
      await reload();
    } catch (err) {
      Alert.alert('تعذّر التحديث', err instanceof ApiError ? err.message : 'حاول مرة أخرى');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={[rtl.row, styles.header]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton} accessibilityLabel="رجوع">
          <Ionicons name="arrow-forward" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>عناويني</Text>
        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {isLoading && !data ? (
            <Loading />
          ) : error && !data ? (
            <ErrorState message={error} onRetry={reload} />
          ) : data?.addresses.length === 0 && !isAdding ? (
            <EmptyState
              icon="location-outline"
              title="لا توجد عناوين محفوظة"
              message="أضف عنواناً لتتمكن من إتمام الطلبات بسرعة."
              action={<Button label="إضافة عنوان" onPress={() => setIsAdding(true)} icon="add" />}
            />
          ) : (
            <View style={styles.list}>
              {data?.addresses.map((address) => (
                <View key={address.id} style={styles.addressCard}>
                  <View style={[rtl.row, styles.addressTop]}>
                    <View style={styles.addressIcon}>
                      <Ionicons name="location" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.flex}>
                      <View style={[rtl.row, styles.labelRow]}>
                        <Text style={[styles.addressLabel, rtl.text]}>{address.label}</Text>
                        {address.isDefault ? <Badge label="افتراضي" tone="primary" /> : null}
                      </View>
                      <Text style={[styles.addressDetails, rtl.text]}>
                        {address.area}، {address.city}
                      </Text>
                      <Text style={[styles.addressDetails, rtl.text]}>{address.details}</Text>
                    </View>
                  </View>

                  <View style={[rtl.row, styles.addressActions]}>
                    {!address.isDefault ? (
                      <Pressable onPress={() => makeDefault(address.id)} style={styles.action}>
                        <Text style={styles.actionText}>تعيين كافتراضي</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => confirmDelete(address.id, address.label)}
                      style={styles.action}
                    >
                      <Text style={[styles.actionText, styles.actionDanger]}>حذف</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {isAdding ? (
            <View style={styles.form}>
              <Text style={[styles.formTitle, rtl.text]}>عنوان جديد</Text>
              <Field label="اسم العنوان" placeholder="البيت، الشغل..." value={label} onChangeText={setLabel} />
              <Field label="المنطقة / الحي" placeholder="مثال: الرياض" value={area} onChangeText={setArea} />
              <Field label="المدينة" placeholder="الخرطوم" value={city} onChangeText={setCity} />
              <Field
                label="تفاصيل إضافية"
                placeholder="رقم المربع والمنزل وعلامة مميزة"
                value={details}
                onChangeText={setDetails}
              />

              {formError ? <Text style={[styles.error, rtl.text]}>{formError}</Text> : null}

              <View style={styles.formActions}>
                <Button label="حفظ العنوان" onPress={handleCreate} loading={submitting} />
                <Button label="إلغاء" onPress={resetForm} variant="ghost" />
              </View>
            </View>
          ) : data && data.addresses.length > 0 ? (
            <Button label="إضافة عنوان جديد" onPress={() => setIsAdding(true)} variant="secondary" icon="add" />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
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
  headerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },

  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  list: { gap: spacing.md },

  addressCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  addressTop: { gap: spacing.md },
  addressIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelRow: { alignItems: 'center', gap: spacing.sm, marginBottom: 2 },
  addressLabel: { fontSize: 15, fontWeight: '800', color: colors.text },
  addressDetails: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },

  addressActions: {
    gap: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  action: { paddingVertical: 2 },
  actionText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  actionDanger: { color: colors.danger },

  form: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  formTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  formActions: { gap: spacing.sm, marginTop: spacing.xs },
  error: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
    borderRadius: radius.sm,
  },
});
