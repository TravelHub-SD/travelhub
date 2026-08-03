import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { font, colors, radius, rtl, spacing } from '../theme';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  const palette = {
    primary: { bg: colors.primary, fg: '#fff', border: 'transparent' },
    secondary: { bg: colors.primarySoft, fg: colors.primary, border: 'transparent' },
    ghost: { bg: 'transparent', fg: colors.text, border: colors.border },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && !isDisabled && styles.buttonPressed,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={[rtl.row, styles.buttonInner]}>
          {icon ? <Ionicons name={icon} size={18} color={palette.fg} /> : null}
          <Text style={[styles.buttonLabel, { color: palette.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  ...inputProps
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, rtl.text]}>{label}</Text>
      <TextInput
        {...inputProps}
        placeholderTextColor={colors.textFaint}
        style={[styles.input, rtl.text, !!error && styles.inputError, inputProps.style]}
      />
      {error ? <Text style={[styles.fieldError, rtl.text]}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'danger' | 'primary' | 'warning';
}) {
  const palette = {
    neutral: { bg: colors.bgSoft, fg: colors.textMuted },
    success: { bg: colors.successSoft, fg: colors.success },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    primary: { bg: colors.primarySoft, fg: colors.primary },
    warning: { bg: '#FEF6E7', fg: colors.warning },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeLabel, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <View style={[rtl.row, styles.rating]}>
      <Ionicons name="star" size={13} color={colors.star} />
      <Text style={styles.ratingValue}>{value.toFixed(1)}</Text>
      {count !== undefined ? <Text style={styles.ratingCount}>({count})</Text> : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={34} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, rtl.text]}>{title}</Text>
      <Text style={[styles.emptyMessage, rtl.text]}>{message}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label = 'جاري التحميل...' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingLabel}>{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name="cloud-offline-outline" size={34} color={colors.danger} />
      </View>
      <Text style={[styles.emptyTitle, rtl.text]}>تعذّر تحميل البيانات</Text>
      <Text style={[styles.emptyMessage, rtl.text]}>{message}</Text>
      {onRetry ? (
        <View style={styles.emptyAction}>
          <Button label="إعادة المحاولة" onPress={onRetry} variant="secondary" icon="refresh" />
        </View>
      ) : null}
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
}) {
  return (
    <View style={[rtl.row, styles.stepper]}>
      <Pressable
        onPress={() => onChange(value + 1)}
        accessibilityLabel="زيادة الكمية"
        style={styles.stepperButton}
      >
        <Ionicons name="add" size={17} color={colors.primary} />
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        accessibilityLabel="إنقاص الكمية"
        style={[styles.stepperButton, value <= min && styles.stepperButtonDisabled]}
      >
        <Ionicons name="remove" size={17} color={value <= min ? colors.textFaint : colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.5 },
  buttonInner: { alignItems: 'center', gap: spacing.sm },
  buttonLabel: { fontSize: 16, lineHeight: 24, fontFamily: font.bold },

  field: { gap: spacing.xs },
  fieldLabel: { fontSize: 13, lineHeight: 20, fontFamily: font.semibold, color: colors.textMuted },
  input: { fontFamily: font.regular,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  fieldError: { fontFamily: font.regular, fontSize: 12, lineHeight: 18, color: colors.danger },

  card: {
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },

  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeLabel: { fontSize: 12, lineHeight: 18, fontFamily: font.bold },

  rating: { alignItems: 'center', gap: 3 },
  ratingValue: { fontSize: 13, lineHeight: 20, fontFamily: font.bold, color: colors.text },
  ratingCount: { fontFamily: font.regular, fontSize: 12, lineHeight: 18, color: colors.textFaint },

  empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: { fontSize: 17, lineHeight: 26, fontFamily: font.extrabold, color: colors.text },
  emptyMessage: { fontFamily: font.regular, fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  emptyAction: { marginTop: spacing.md, minWidth: 190 },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  loadingLabel: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: colors.textMuted },

  stepper: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    padding: 3,
    gap: spacing.xs,
  },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: { backgroundColor: 'transparent' },
  stepperValue: { minWidth: 22, textAlign: 'center', fontSize: 15, lineHeight: 22, fontFamily: font.extrabold, color: colors.text },
});
